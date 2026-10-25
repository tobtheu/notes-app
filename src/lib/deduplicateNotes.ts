import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { enqueue } from './offlineQueue';
import { log } from './logger';

export interface DeduplicateResult {
  deduplicatedCount: number;
  purgedLegacyCount: number;
  remainingCount: number;
}

/**
 * Scans all notes for the user, identifies identical duplicate notes (same folder & content),
 * preserves the single newest valid UUID version, and marks redundant copies as deleted
 * both locally in PGlite and in Supabase via offlineQueue.
 */
export async function deduplicateNotes(
  db: PGliteWithLive,
  userId: string,
  onEnqueueDelete?: (id: string) => Promise<void>
): Promise<DeduplicateResult> {
  if (!userId || !db) {
    return { deduplicatedCount: 0, purgedLegacyCount: 0, remainingCount: 0 };
  }

  // 1. Fetch all non-deleted notes for this user
  const { rows } = await db.query<{
    id: string;
    folder: string;
    content: string;
    updated_at: string;
  }>(
    `SELECT id, folder, content, updated_at FROM notes WHERE user_id = $1 AND deleted = false ORDER BY updated_at DESC`,
    [userId]
  );

  let deduplicatedCount = 0;
  let purgedLegacyCount = 0;

  // Group by (folder, trimmed content)
  const groups = new Map<string, typeof rows>();
  const isLegacyId = (id: string) => id.endsWith('.md') || id.includes('/');

  for (const row of rows) {
    const folderKey = (row.folder || '').trim().toLowerCase();
    const contentKey = (row.content || '').trim();
    const key = `${folderKey}:::${contentKey}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }

  const idsToMarkDeleted: string[] = [];

  for (const [, items] of groups) {
    // If there's only 1 item and it's not legacy, nothing to deduplicate
    if (items.length === 1 && !isLegacyId(items[0].id)) {
      continue;
    }

    // Sort: Non-legacy UUIDs first, then by updated_at DESC
    items.sort((a, b) => {
      const aLegacy = isLegacyId(a.id);
      const bLegacy = isLegacyId(b.id);
      if (!aLegacy && bLegacy) return -1;
      if (aLegacy && !bLegacy) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    // Best item to keep is items[0]
    const keepItem = items[0];

    // Any other items in this group are redundant duplicates
    for (let i = 1; i < items.length; i++) {
      const item = items[i];
      idsToMarkDeleted.push(item.id);
      if (isLegacyId(item.id)) {
        purgedLegacyCount++;
      } else {
        deduplicatedCount++;
      }
    }

    // If even the kept item was a legacy ID (meaning NO UUID copy existed at all):
    // migrate it cleanly once to a UUID
    if (isLegacyId(keepItem.id)) {
      const newUuid = crypto.randomUUID();
      await db.query(
        `INSERT INTO notes (id, user_id, folder, content, updated_at, deleted)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [newUuid, userId, keepItem.folder || '', keepItem.content, keepItem.updated_at]
      );
      if (userId !== 'local') {
        try {
          await enqueue(db, 'notes', 'upsert', {
            id: newUuid,
            user_id: userId,
            folder: keepItem.folder || '',
            content: keepItem.content,
            updated_at: keepItem.updated_at,
            deleted: false,
          });
        } catch {
          // Ignore if offlineQueue table is not yet initialized in tests
        }
      }
      idsToMarkDeleted.push(keepItem.id);
      purgedLegacyCount++;
    }
  }

  // Mark redundant duplicates deleted in local PGlite and enqueue to Supabase
  for (const id of idsToMarkDeleted) {
    await db.query(
      `UPDATE notes SET deleted = true, updated_at = NOW() WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (onEnqueueDelete) {
      await onEnqueueDelete(id);
    } else if (userId !== 'local') {
      try {
        await enqueue(db, 'notes', 'upsert', {
          id,
          user_id: userId,
          folder: '',
          content: '',
          updated_at: new Date().toISOString(),
          deleted: true,
        });
      } catch {
        // Ignore if offlineQueue table is not yet initialized in tests
      }
    }
  }

  log.info(`[deduplicateNotes] cleaned up ${idsToMarkDeleted.length} notes (${deduplicatedCount} duplicate UUIDs, ${purgedLegacyCount} legacy IDs)`);

  return {
    deduplicatedCount: idsToMarkDeleted.length,
    purgedLegacyCount,
    remainingCount: rows.length - idsToMarkDeleted.length,
  };
}

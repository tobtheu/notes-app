import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { enqueue } from './offlineQueue';
import { log } from './logger';

export interface DeduplicateResult {
  deduplicatedCount: number;
  purgedLegacyCount: number;
  remainingCount: number;
}

/**
 * Scans all notes for the user, identifies identical duplicate notes,
 * preserves the single newest valid UUID version (and preserves non-empty folder),
 * marks redundant copies as deleted both locally in PGlite and in Supabase,
 * and remaps pinnedNotes in app_config to surviving UUIDs.
 */
export async function deduplicateNotes(
  db: PGliteWithLive,
  userId: string,
  onEnqueueDelete?: (id: string) => Promise<void>
): Promise<DeduplicateResult> {
  if (!userId || !db) {
    return { deduplicatedCount: 0, purgedLegacyCount: 0, remainingCount: 0 };
  }

  // 1. Fetch all notes for this user (both active and deleted for mapping)
  const allNotesQuery = await db.query<{
    id: string;
    folder: string;
    content: string;
    updated_at: string;
    deleted: boolean;
  }>(
    `SELECT id, folder, content, updated_at, deleted FROM notes WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId]
  );

  const activeRows = allNotesQuery.rows.filter(r => !r.deleted);

  let deduplicatedCount = 0;
  let purgedLegacyCount = 0;

  const isLegacyId = (id: string) => id.endsWith('.md') || id.includes('/');

  // Group notes into duplicate clusters.
  // When remote Supabase lacks a 'folder' column, pulled notes have folder = ''.
  // Therefore:
  // - For identical non-empty content:
  //   - If all copies have the same folder, or some have empty folder, merge them into 1 group.
  //   - Only keep separate if they belong to 2+ distinct non-empty folders (e.g. 'Folder A' vs 'Folder B').
  // - For empty content: only group by exact folder.
  const contentMap = new Map<string, typeof activeRows>();

  for (const row of activeRows) {
    const contentKey = (row.content || '').trim();
    if (!contentMap.has(contentKey)) {
      contentMap.set(contentKey, []);
    }
    contentMap.get(contentKey)!.push(row);
  }

  const groups: (typeof activeRows)[] = [];

  for (const [contentKey, rowsWithSameContent] of contentMap) {
    if (contentKey === '') {
      // Empty notes: group by exact folder
      const folderSubgroups = new Map<string, typeof activeRows>();
      for (const row of rowsWithSameContent) {
        const fKey = (row.folder || '').trim().toLowerCase();
        if (!folderSubgroups.has(fKey)) folderSubgroups.set(fKey, []);
        folderSubgroups.get(fKey)!.push(row);
      }
      for (const group of folderSubgroups.values()) {
        groups.push(group);
      }
      continue;
    }

    // Non-empty content: find distinct non-empty folders
    const distinctNonEmptyFolders = Array.from(
      new Set(
        rowsWithSameContent
          .map(r => (r.folder || '').trim())
          .filter(Boolean)
      )
    );

    if (distinctNonEmptyFolders.length <= 1) {
      // 0 or 1 non-empty folder: all these copies belong to the same note
      groups.push(rowsWithSameContent);
    } else {
      // Multiple distinct folders (e.g. 'Ordner A' and 'Ordner B').
      // Group by folder, and merge any empty folder copies into the newest distinct folder group.
      const folderSubgroups = new Map<string, typeof activeRows>();
      for (const f of distinctNonEmptyFolders) {
        folderSubgroups.set(f.toLowerCase(), []);
      }

      const emptyFolderRows: typeof activeRows = [];
      for (const row of rowsWithSameContent) {
        const f = (row.folder || '').trim();
        if (f) {
          folderSubgroups.get(f.toLowerCase())?.push(row);
        } else {
          emptyFolderRows.push(row);
        }
      }

      // Assign empty folder copies to the first (newest) non-empty folder group
      const firstGroup = folderSubgroups.values().next().value;
      if (firstGroup && emptyFolderRows.length > 0) {
        firstGroup.push(...emptyFolderRows);
      }

      for (const group of folderSubgroups.values()) {
        if (group.length > 0) groups.push(group);
      }
    }
  }

  const idsToMarkDeleted: string[] = [];
  const idRemap = new Map<string, string>();
  const newlyCreatedUuids: string[] = [];

  for (const items of groups) {
    if (items.length === 1 && !isLegacyId(items[0].id)) {
      continue;
    }

    // Sort: Non-legacy UUIDs first, prefer copy that has a folder, then newest updated_at
    items.sort((a, b) => {
      const aLegacy = isLegacyId(a.id);
      const bLegacy = isLegacyId(b.id);
      if (!aLegacy && bLegacy) return -1;
      if (aLegacy && !bLegacy) return 1;

      const aHasFolder = (a.folder || '').trim().length > 0;
      const bHasFolder = (b.folder || '').trim().length > 0;
      if (aHasFolder && !bHasFolder) return -1;
      if (!aHasFolder && bHasFolder) return 1;

      const timeDiff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (timeDiff !== 0) return timeDiff;

      return a.id.localeCompare(b.id);
    });

    const keepItem = items[0];
    const bestFolder = items.find(i => (i.folder || '').trim().length > 0)?.folder?.trim() || '';

    // If kept item was missing folder but another copy had it, restore folder!
    if (bestFolder && (keepItem.folder || '').trim() !== bestFolder) {
      keepItem.folder = bestFolder;
      await db.query(
        `UPDATE notes SET folder = $1 WHERE id = $2 AND user_id = $3`,
        [bestFolder, keepItem.id, userId]
      );
    }

    let survivingId = keepItem.id;

    // Handle case where keepItem itself is a legacy ID: migrate cleanly to UUID
    if (isLegacyId(keepItem.id)) {
      const newUuid = crypto.randomUUID();
      survivingId = newUuid;
      newlyCreatedUuids.push(newUuid);
      idRemap.set(keepItem.id, newUuid);

      await db.query(
        `INSERT INTO notes (id, user_id, folder, content, updated_at, deleted)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [newUuid, userId, bestFolder || keepItem.folder || '', keepItem.content, keepItem.updated_at]
      );

      if (userId !== 'local') {
        try {
          await enqueue(db, 'notes', 'upsert', {
            id: newUuid,
            user_id: userId,
            folder: bestFolder || keepItem.folder || '',
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

    // Mark remaining items in this group as deleted and record remap
    for (let i = 1; i < items.length; i++) {
      const item = items[i];
      idsToMarkDeleted.push(item.id);
      idRemap.set(item.id, survivingId);
      if (isLegacyId(item.id)) {
        purgedLegacyCount++;
      } else {
        deduplicatedCount++;
      }
    }
  }

  // 2. Mark redundant duplicates deleted in local PGlite and enqueue to Supabase
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

  // 3. Remap pinnedNotes in app_config
  try {
    const configRes = await db.query<{ metadata: any; updated_at: string }>(
      `SELECT metadata, updated_at FROM app_config WHERE user_id = $1`,
      [userId]
    );

    if (configRes.rows.length > 0) {
      const configRow = configRes.rows[0];
      const meta = typeof configRow.metadata === 'string'
        ? JSON.parse(configRow.metadata)
        : { ...configRow.metadata };

      if (meta && Array.isArray(meta.pinnedNotes) && meta.pinnedNotes.length > 0) {
        const deletedSet = new Set(idsToMarkDeleted);
        const activeSurvivingIds = new Set(
          activeRows
            .filter(r => !deletedSet.has(r.id))
            .map(r => r.id)
        );
        for (const uuid of newlyCreatedUuids) {
          activeSurvivingIds.add(uuid);
        }

        let configChanged = false;
        const remappedPins: string[] = [];

        for (const pin of meta.pinnedNotes) {
          // If pin is already an active surviving note and not marked deleted
          if (activeSurvivingIds.has(pin)) {
            remappedPins.push(pin);
            continue;
          }

          // If pin was marked deleted in this deduplication run
          if (idRemap.has(pin)) {
            remappedPins.push(idRemap.get(pin)!);
            configChanged = true;
            continue;
          }

          // Check if pin matches a note in allNotesQuery (e.g. deleted previously)
          const noteMatch = allNotesQuery.rows.find(n => n.id === pin);
          if (noteMatch) {
            const survivingNote = activeRows.find(
              r => !deletedSet.has(r.id) && (r.content || '').trim() === (noteMatch.content || '').trim()
            );
            if (survivingNote) {
              remappedPins.push(survivingNote.id);
              configChanged = true;
              continue;
            }
          }

          // Check by filename / title match for legacy paths (e.g. 'home/is now pinned test.md')
          const rawFilename = pin.includes('/') ? pin.slice(pin.lastIndexOf('/') + 1) : pin;
          const cleanTitle = rawFilename.replace(/\.md$/i, '').trim().toLowerCase();

          const titleMatch = activeRows.find(r => {
            if (deletedSet.has(r.id)) return false;
            const firstLine = (r.content || '').split('\n')[0].replace(/^#+\s*/, '').trim().toLowerCase();
            return firstLine === cleanTitle;
          });

          if (titleMatch) {
            remappedPins.push(titleMatch.id);
            configChanged = true;
            continue;
          }
        }

        const uniquePins = Array.from(new Set(remappedPins.filter(Boolean)));
        if (
          configChanged ||
          uniquePins.length !== meta.pinnedNotes.length ||
          uniquePins.some((p, i) => p !== meta.pinnedNotes[i])
        ) {
          meta.pinnedNotes = uniquePins;
          const newUpdatedAt = new Date().toISOString();
          await db.query(
            `UPDATE app_config SET metadata = $1, updated_at = $2 WHERE user_id = $3`,
            [JSON.stringify(meta), newUpdatedAt, userId]
          );

          if (userId !== 'local') {
            try {
              await enqueue(db, 'app_config', 'upsert', {
                user_id: userId,
                metadata: meta,
                updated_at: newUpdatedAt,
              });
            } catch {
              // Ignore if offlineQueue table is not yet initialized in tests
            }
          }

          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('lama-metadata', JSON.stringify(meta));
            }
          } catch {
            // Ignore in environments without localStorage
          }
        }
      }
    }
  } catch (err) {
    log.error('[deduplicateNotes] failed to remap pinnedNotes in app_config:', err);
  }

  log.info(`[deduplicateNotes] cleaned up ${idsToMarkDeleted.length} notes (${deduplicatedCount} duplicate UUIDs, ${purgedLegacyCount} legacy IDs)`);

  return {
    deduplicatedCount: idsToMarkDeleted.length,
    purgedLegacyCount,
    remainingCount: activeRows.length - idsToMarkDeleted.length,
  };
}

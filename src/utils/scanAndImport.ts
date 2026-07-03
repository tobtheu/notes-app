import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { getPathId } from './path';
import { enqueue } from '../lib/offlineQueue';
import { log } from '../lib/logger';

/**
 * Scans the mirror folder and imports any .md files whose ID is not yet in PGlite.
 * Safe to call repeatedly — existing notes are never overwritten (ON CONFLICT DO NOTHING).
 * For cloud users, new notes are also enqueued for Supabase sync.
 */
export async function scanAndImportNewFiles(
    db: PGliteWithLive,
    uid: string,
    folder: string,
): Promise<void> {
    try {
        const scanned = await (window.tauriAPI as any).scanImportFolder(folder) as
            { relPath: string; content: string; updatedAt: string }[];
        if (!scanned?.length) return;

        const { rows: existingRows } = await db.query<{ id: string }>(
            `SELECT id FROM notes WHERE user_id = $1 AND deleted = false`,
            [uid],
        );
        const existingIds = new Set(existingRows.map(r => r.id));

        let imported = 0;
        for (const file of scanned) {
            const parts = file.relPath.replace(/\\/g, '/').split('/');
            const filename = parts.pop() ?? file.relPath;
            const fileFolder = parts.join('/');
            const id = getPathId(filename, fileFolder);
            if (existingIds.has(id)) continue;

            const content = file.content.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart();
            await db.query(
                `INSERT INTO notes (id, user_id, content, updated_at, deleted)
                 VALUES ($1, $2, $3, $4, false)
                 ON CONFLICT (id, user_id) DO NOTHING`,
                [id, uid, content, file.updatedAt],
            );

            // For cloud users, also enqueue for Supabase sync
            if (uid !== 'local') {
                await enqueue(db, 'notes', 'upsert', {
                    id, user_id: uid, content, updated_at: file.updatedAt, deleted: false,
                });
            }

            imported++;
        }

        if (imported > 0) {
            log.info(`[scanAndImportNewFiles] imported ${imported} new file(s) for user ${uid}`);
        }
    } catch (e) {
        log.warn('[scanAndImportNewFiles] error:', String(e));
    }
}

import { useCallback } from 'react';
import { enqueue, flushQueue } from '../lib/offlineQueue';
import { log } from '../lib/logger';
import type { PGliteWithLive } from '@electric-sql/pglite/live';

interface UseNotesDbWriterProps {
    dbRef: React.MutableRefObject<PGliteWithLive | null>;
    userId: string | null;
}

const NOTE_SIZE_LIMIT = 5 * 1024 * 1024;

export function useNotesDbWriter({ dbRef, userId }: UseNotesDbWriterProps) {
    const writeNote = useCallback(async (
        id: string,
        content: string,
        updatedAt: string,
        deleted = false,
    ) => {
        if (!userId || !dbRef.current) return;
        const db = dbRef.current;

        if (!deleted && (content.length > 2_500_000 && new Blob([content]).size > NOTE_SIZE_LIMIT)) {
            log.warn(`[useNotes:writeNote] note ${id} exceeds 5MB size limit — write blocked`);
            throw new Error('Note is too large (max. 5 MB). Please shorten the content.');
        }

        const existing = await db.query<{ updated_at: string }>(
            `SELECT updated_at FROM notes WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );
        let finalUpdatedAt = updatedAt;
        if (existing.rows.length > 0) {
            const existingTime = new Date(existing.rows[0].updated_at).getTime();
            const localTime = new Date(updatedAt).getTime();
            if (existingTime >= localTime) {
                finalUpdatedAt = new Date(existingTime + 1).toISOString();
            }
        }

        await db.query(
            /* sql */ `
      INSERT INTO notes (id, user_id, content, updated_at, deleted)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id, user_id) DO UPDATE SET
        content    = EXCLUDED.content,
        updated_at = EXCLUDED.updated_at,
        deleted    = EXCLUDED.deleted
      `,
            [id, userId, content, finalUpdatedAt, deleted],
        );

        await enqueue(db, 'notes', 'upsert', {
            id,
            user_id: userId,
            content,
            updated_at: finalUpdatedAt,
            deleted,
        });

        if (navigator.onLine) {
            flushQueue(db).catch((e: unknown) => log.error(String(e)));
        }
    }, [userId, dbRef]);

    return { writeNote };
}

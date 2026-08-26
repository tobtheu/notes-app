import { useCallback } from 'react';
import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { normalizeStr } from '../utils/path';
import { enqueue, flushQueue } from '../lib/offlineQueue';
import { log } from '../lib/logger';

interface UseNotesTrashOpsProps {
    dbRef: React.MutableRefObject<PGliteWithLive | null>;
    userId: string | null;
    writeNote: (id: string, content: string, updatedAt: string, deleted?: boolean) => Promise<void>;
}

export function useNotesTrashOps({
    dbRef,
    userId,
    writeNote
}: UseNotesTrashOpsProps) {
    /**
     * Restore a soft-deleted note from trash.
     */
    const restoreNote = useCallback(async (id: string) => {
        if (!userId || !dbRef.current) return;
        const normalizedId = normalizeStr(id);
        const db = dbRef.current;

        const res = await db.query<{ content: string }>(
            `SELECT content FROM notes WHERE id = $1 AND user_id = $2`,
            [normalizedId, userId]
        );
        if (res.rows.length === 0) return;
        const content = res.rows[0].content;
        const updatedAt = new Date().toISOString();
        await writeNote(normalizedId, content, updatedAt, false);
    }, [userId, dbRef, writeNote]);

    /**
     * Permanently delete a note (hard-delete from PGlite & Supabase queue).
     */
    const permanentlyDeleteNote = useCallback(async (id: string) => {
        if (!userId || !dbRef.current) return;
        const normalizedId = normalizeStr(id);
        const db = dbRef.current;

        await db.query(
            `DELETE FROM notes WHERE id = $1 AND user_id = $2`,
            [normalizedId, userId]
        );

        await db.query(
            `DELETE FROM pending_writes WHERE id = $1`,
            [`notes:${normalizedId}`]
        );

        if (userId !== 'local') {
            await enqueue(db, 'notes', 'delete', {
                id: normalizedId,
                user_id: userId,
            });

            if (navigator.onLine) {
                flushQueue(db).catch((e: unknown) => log.error(String(e)));
            }
        }

        const mirrorFolder = typeof localStorage !== 'undefined' && typeof localStorage?.getItem === 'function'
            ? localStorage.getItem('notes-folder')
            : null;
        if (mirrorFolder && window.tauriAPI?.deleteMirrorFile) {
            window.tauriAPI.deleteMirrorFile({ mirrorFolder, noteId: normalizedId }).catch(() => {});
        }
    }, [userId, dbRef]);

    /**
     * Empty all notes currently in the trash bin.
     */
    const emptyTrash = useCallback(async () => {
        if (!userId || !dbRef.current) return;
        const db = dbRef.current;

        const res = await db.query<{ id: string }>(
            `SELECT id FROM notes WHERE user_id = $1 AND deleted = true`,
            [userId]
        );
        for (const row of res.rows) {
            await permanentlyDeleteNote(row.id);
        }
    }, [userId, dbRef, permanentlyDeleteNote]);

    /**
     * Clean up notes in trash that are older than 30 days.
     */
    const cleanExpiredTrashNotes = useCallback(async () => {
        if (!userId || !dbRef.current) return;
        const db = dbRef.current;
        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const res = await db.query<{ id: string }>(
            `SELECT id FROM notes WHERE user_id = $1 AND deleted = true AND CAST(updated_at AS timestamptz) < CAST($2 AS timestamptz)`,
            [userId, cutoffDate]
        );
        for (const row of res.rows) {
            await permanentlyDeleteNote(row.id);
        }
    }, [userId, dbRef, permanentlyDeleteNote]);

    return {
        restoreNote,
        permanentlyDeleteNote,
        emptyTrash,
        cleanExpiredTrashNotes,
    };
}

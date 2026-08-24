import { useCallback, useRef } from 'react';
import type { Note, AppMetadata, FolderMetadata } from '../types';
import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { getPathId, normalizeStr } from '../utils/path';
import { enqueue, flushQueue } from '../lib/offlineQueue';
import { log } from '../lib/logger';

interface UseNotesOperationsProps {
    dbRef: React.MutableRefObject<PGliteWithLive | null>;
    userId: string | null;
    metadata?: AppMetadata;
    metadataRef: React.MutableRefObject<AppMetadata>;
    notes: Note[];
    sortedFolders: string[];
    selectedNoteId: string | null;
    setSelectedNoteId: (id: string | null) => void;
    selectedCategory: string | null;
    setSelectedCategory: (cat: string | null) => void;
    writeNote: (id: string, content: string, updatedAt: string, deleted?: boolean) => Promise<void>;
    writeConfig: (newMetadata: AppMetadata) => Promise<void>;
    getNoteId: (note: Note) => string;
}

export function useNotesOperations({
    dbRef,
    userId,
    metadataRef,
    notes,
    sortedFolders,
    selectedNoteId,
    setSelectedNoteId,
    selectedCategory,
    setSelectedCategory,
    writeNote,
    writeConfig,
    getNoteId
}: UseNotesOperationsProps) {

    const savingNotes = useRef<Record<string, Promise<string> | undefined>>({});

    /**
     * Unified, non-destructive note save.
     * Updates note content & timestamp with stable ID (no destructive renaming).
     */
    const saveNote = useCallback(async (
        currentId: string,
        _filename: string,
        content: string,
        _folder: string | null = null,
    ): Promise<string> => {
        if (!userId) return currentId;

        if (savingNotes.current[currentId]) {
            try { await savingNotes.current[currentId]; } catch { /* ignore */ }
        }

        let resolvePromise!: (id: string) => void;
        const savePromise = new Promise<string>(r => { resolvePromise = r; });
        savingNotes.current[currentId] = savePromise;

        try {
            const updatedAt = new Date().toISOString();
            await writeNote(currentId, content, updatedAt, false);
            resolvePromise(currentId);
            return currentId;
        } finally {
            delete savingNotes.current[currentId];
        }
    }, [userId, writeNote]);

    /**
     * Instant, atomic note creation.
     * Generates a clean filename (Untitled note.md) in the active folder and opens the editor immediately.
     */
    const createNote = useCallback(async () => {
        if (!userId) return;
        const folderStr = selectedCategory ?? '';
        const normFolder = normalizeStr(folderStr);
        const existingFilenames = new Set(
            notes.filter(n => normalizeStr(n.folder) === normFolder).map(n => n.filename)
        );

        let filename = 'Untitled note.md';
        let counter = 1;
        while (existingFilenames.has(filename)) {
            filename = `Untitled note ${counter}.md`;
            counter++;
        }
        const id = getPathId(filename, folderStr);
        const updatedAt = new Date().toISOString();

        // 1. Select immediately so the editor mounts in <1ms
        setSelectedNoteId(id);

        // 2. Direct single-write into PGlite database
        await writeNote(id, '# ', updatedAt, false);
    }, [userId, notes, selectedCategory, setSelectedNoteId, writeNote]);

    /**
     * Delete note with soft-delete flag in PGlite and clean up metadata pins.
     */
    const deleteNote = useCallback(async (id: string) => {
        const normalizedId = normalizeStr(id);
        const updatedAt = new Date().toISOString();
        const note = notes.find(n => getNoteId(n) === normalizedId);
        if (!note) return;

        if (selectedNoteId && normalizeStr(selectedNoteId) === normalizedId) {
            setSelectedNoteId(null);
        }

        await writeNote(normalizedId, note.content, updatedAt, true);

        // Clean up pin in metadata
        const current = metadataRef.current;
        if (current.pinnedNotes?.some(p => normalizeStr(p) === normalizedId)) {
            const newMeta = { ...current };
            newMeta.pinnedNotes = (newMeta.pinnedNotes ?? []).filter(
                p => normalizeStr(p) !== normalizedId
            );
            await writeConfig(newMeta);
        }
    }, [notes, getNoteId, selectedNoteId, writeNote, setSelectedNoteId, writeConfig, metadataRef]);

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

        await enqueue(db, 'notes', 'delete', {
            id: normalizedId,
            user_id: userId,
        });

        if (navigator.onLine) {
            flushQueue(db).catch((e: unknown) => log.error(String(e)));
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

    const updateNoteLocally = useCallback(async (
        filename: string,
        content: string,
        folder = '',
    ) => {
        if (!dbRef.current || !userId) return;
        const id = getPathId(filename, folder);
        await dbRef.current.query(
            /* sql */ `
            UPDATE notes SET content = $1
            WHERE id = $2 AND user_id = $3
            `,
            [content, id, userId],
        );
    }, [userId, dbRef]);

    const moveNote = useCallback(async (noteId: string, targetFolder: string | null) => {
        const note = notes.find(n => getNoteId(n) === noteId);
        if (!note || note.folder === (targetFolder ?? '')) return;

        const newId = getPathId(note.filename, targetFolder ?? '');
        const updatedAt = new Date().toISOString();

        if (notes.some(n => getNoteId(n) === newId)) return;

        await writeNote(noteId, note.content, updatedAt, true);
        await writeNote(newId, note.content, updatedAt, false);

        const current = metadataRef.current;
        if (current.pinnedNotes?.some(p => normalizeStr(p) === noteId)) {
            const newMeta = { ...current };
            newMeta.pinnedNotes = (newMeta.pinnedNotes ?? []).map(p =>
                normalizeStr(p) === noteId ? newId : p,
            );
            await writeConfig(newMeta);
        }

        if (selectedNoteId === noteId) setSelectedNoteId(newId);
    }, [notes, getNoteId, metadataRef, selectedNoteId, writeNote, writeConfig, setSelectedNoteId]);

    const createFolder = useCallback(async (folderName: string) => {
        const current = metadataRef.current;
        const order = current.folderOrder ?? [];
        if (!order.some(f => normalizeStr(f) === normalizeStr(folderName))) {
            await writeConfig({ ...current, folderOrder: [...order, folderName] });
        }
    }, [metadataRef, writeConfig]);

    const deleteFolder = useCallback(async (folderRelative: string, _mode: 'recursive' | 'move') => {
        const normalizedTarget = normalizeStr(folderRelative);

        const folderNotes = notes.filter(n => normalizeStr(n.folder) === normalizedTarget);
        const updatedAt = new Date().toISOString();
        await Promise.all(folderNotes.map(n => writeNote(getNoteId(n), n.content, updatedAt, true)));

        const current = metadataRef.current;
        const newMeta = { ...current };
        const existingKey = Object.keys(newMeta.folders).find(k => normalizeStr(k) === normalizedTarget);
        if (existingKey) delete newMeta.folders[existingKey];
        if (newMeta.folderOrder) newMeta.folderOrder = newMeta.folderOrder.filter(f => normalizeStr(f) !== normalizedTarget);
        if (newMeta.pinnedNotes) {
            const prefix = `${normalizedTarget}/`;
            newMeta.pinnedNotes = newMeta.pinnedNotes.filter(p => !normalizeStr(p).startsWith(prefix));
        }
        await writeConfig(newMeta);

        if (selectedCategory === folderRelative) setSelectedCategory(null);
    }, [notes, getNoteId, metadataRef, selectedCategory, writeNote, writeConfig, setSelectedCategory]);

    const renameFolder = useCallback(async (oldName: string, newName: string) => {
        const normalizedOld = normalizeStr(oldName);
        const normalizedNew = normalizeStr(newName);
        const updatedAt = new Date().toISOString();

        if (normalizedOld !== normalizedNew) {
            const folderNotes = notes.filter(n => normalizeStr(n.folder) === normalizedOld);
            await Promise.all(folderNotes.map(async n => {
                const oldId = getNoteId(n);
                const newId = getPathId(n.filename, newName);
                await writeNote(oldId, n.content, updatedAt, true);
                await writeNote(newId, n.content, updatedAt, false);
            }));
        }

        const current = metadataRef.current;
        const newMeta = { ...current };
        const existingKey = Object.keys(newMeta.folders).find(k => normalizeStr(k) === normalizedOld);
        if (existingKey) {
            newMeta.folders[newName] = newMeta.folders[existingKey];
            if (existingKey !== newName) delete newMeta.folders[existingKey];
        }
        if (newMeta.pinnedNotes && normalizedOld !== normalizedNew) {
            const oldPrefix = `${normalizedOld}/`;
            const newPrefix = `${normalizedNew}/`;
            newMeta.pinnedNotes = newMeta.pinnedNotes.map(p => {
                const np = normalizeStr(p);
                return np.startsWith(oldPrefix) ? np.replace(oldPrefix, newPrefix) : p;
            });
        }
        if (newMeta.folderOrder) {
            newMeta.folderOrder = newMeta.folderOrder.map(f => normalizeStr(f) === normalizedOld ? newName : f);
        }
        await writeConfig(newMeta);

        if (selectedCategory === oldName) setSelectedCategory(newName);
        return { success: true };
    }, [notes, getNoteId, metadataRef, selectedCategory, writeNote, writeConfig, setSelectedCategory]);

    const reorderFolders = useCallback(async (newOrder: string[]) => {
        const current = metadataRef.current;
        const currentOrder = current.folderOrder ?? sortedFolders;
        const seen = new Set(newOrder.map(normalizeStr));
        const merged = [...newOrder];
        for (let i = 0; i < currentOrder.length; i++) {
            const f = currentOrder[i];
            const norm = normalizeStr(f);
            if (!seen.has(norm)) {
                seen.add(norm);
                merged.push(f);
            }
        }
        await writeConfig({ ...current, folderOrder: merged });
    }, [metadataRef, sortedFolders, writeConfig]);

    const togglePinNote = useCallback(async (note: Note) => {
        const notePath = normalizeStr(getNoteId(note));
        const current = metadataRef.current;
        const pinned = (current.pinnedNotes ?? []).map(normalizeStr);
        const pinnedSet = new Set(pinned);
        
        let newPins: string[];
        if (pinnedSet.has(notePath)) {
            newPins = pinned.filter(p => p !== notePath);
        } else {
            newPins = [...pinned, notePath];
        }
        await writeConfig({ ...current, pinnedNotes: newPins });
    }, [getNoteId, metadataRef, writeConfig]);

    const updateFolderMetadata = useCallback(async (folderName: string, meta: FolderMetadata) => {
        const current = metadataRef.current;
        const normalizedTarget = normalizeStr(folderName);
        const existingKey = Object.keys(current.folders ?? {}).find(k => normalizeStr(k) === normalizedTarget);
        const keyToUse = existingKey ?? folderName;
        const newMeta = { ...current, folders: { ...current.folders } };
        newMeta.folders[keyToUse] = { ...newMeta.folders[keyToUse], ...meta };
        await writeConfig(newMeta);
    }, [writeConfig, metadataRef]);

    const saveSettings = useCallback(async (settings: any) => {
        const current = metadataRef.current;
        await writeConfig({ ...current, settings: { ...current.settings, ...settings } });
    }, [writeConfig, metadataRef]);

    return {
        saveNote,
        createNote,
        deleteNote,
        updateNoteLocally,
        moveNote,
        createFolder,
        deleteFolder,
        renameFolder,
        reorderFolders,
        togglePinNote,
        updateFolderMetadata,
        saveSettings,
        restoreNote,
        permanentlyDeleteNote,
        emptyTrash,
        cleanExpiredTrashNotes,
    };
}

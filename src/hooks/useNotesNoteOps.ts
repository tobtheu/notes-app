import { useCallback, useRef } from 'react';
import type { Note, AppMetadata } from '../types';
import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { getPathId, normalizeStr } from '../utils/path';

interface UseNotesNoteOpsProps {
    dbRef: React.MutableRefObject<PGliteWithLive | null>;
    userId: string | null;
    notes: Note[];
    selectedNoteId: string | null;
    setSelectedNoteId: (id: string | null) => void;
    selectedCategory: string | null;
    metadataRef: React.MutableRefObject<AppMetadata>;
    writeNote: (id: string, content: string, updatedAt: string, deleted?: boolean) => Promise<void>;
    writeConfig: (newMetadata: AppMetadata) => Promise<void>;
    getNoteId: (note: Note) => string;
}

export function useNotesNoteOps({
    dbRef,
    userId,
    notes,
    selectedNoteId,
    setSelectedNoteId,
    selectedCategory,
    metadataRef,
    writeNote,
    writeConfig,
    getNoteId
}: UseNotesNoteOpsProps) {
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
        togglePinNote,
        saveSettings,
    };
}

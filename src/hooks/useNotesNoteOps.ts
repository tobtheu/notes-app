import { useCallback, useRef } from 'react';
import type { Note, AppMetadata } from '../types';
import type { PGliteWithLive } from '@electric-sql/pglite/live';

interface UseNotesNoteOpsProps {
    dbRef: React.MutableRefObject<PGliteWithLive | null>;
    userId: string | null;
    notes: Note[];
    trashNotes?: Note[];
    selectedNoteId: string | null;
    setSelectedNoteId: (id: string | null) => void;
    selectedCategory: string | null;
    metadataRef: React.MutableRefObject<AppMetadata>;
    writeNote: (
        id: string,
        folderOrContent: string,
        contentOrUpdatedAt: string,
        updatedAtOrDeleted?: string | boolean,
        maybeDeleted?: boolean
    ) => Promise<void>;
    writeConfig: (newMetadata: AppMetadata) => Promise<void>;
    getNoteId?: (note: Note) => string;
}

export function useNotesNoteOps({
    dbRef,
    userId,
    notes,
    trashNotes: _trashNotes,
    selectedNoteId,
    setSelectedNoteId,
    selectedCategory,
    metadataRef,
    writeNote,
    writeConfig,
    getNoteId
}: UseNotesNoteOpsProps) {
    const resolveNoteId = useCallback((note: Note): string => {
        return note.id ?? (getNoteId ? getNoteId(note) : '');
    }, [getNoteId]);

    const savingNotes = useRef<Record<string, Promise<string> | undefined>>({});

    /**
     * Unified, non-destructive note save.
     * Updates note content & timestamp with stable ID (no destructive renaming).
     */
    const saveNote = useCallback(async (
        currentId: string,
        arg2: string,
        arg3?: string,
        arg4: string = '',
    ): Promise<string> => {
        if (!userId) return currentId;

        let content: string;
        let folder: string;

        if (typeof arg3 === 'string' && (arg4 !== '' || arg2.endsWith('.md'))) {
            // Legacy 4-arg or 3-arg with filename: (id, filename, content, folder)
            content = arg3;
            folder = arg4;
        } else {
            // Modern 2-arg or 3-arg: (id, content, folder?)
            content = arg2;
            folder = arg3 ?? (notes.find(n => resolveNoteId(n) === currentId)?.folder ?? '');
        }

        if (savingNotes.current[currentId]) {
            try { await savingNotes.current[currentId]; } catch { /* ignore */ }
        }

        let resolvePromise!: (id: string) => void;
        const savePromise = new Promise<string>(r => { resolvePromise = r; });
        savingNotes.current[currentId] = savePromise;

        try {
            const updatedAt = new Date().toISOString();
            await writeNote(currentId, folder, content, updatedAt, false);
            resolvePromise(currentId);
            return currentId;
        } finally {
            delete savingNotes.current[currentId];
        }
    }, [userId, notes, resolveNoteId, writeNote]);

    /**
     * Instant, atomic note creation using UUIDv4.
     * Creates a fresh note in the active folder with globally unique ID.
     */
    const createNote = useCallback(async () => {
        if (!userId) return;
        const folder = selectedCategory ?? '';
        const id = crypto.randomUUID();
        const updatedAt = new Date().toISOString();

        // 1. Select immediately so the editor mounts in <1ms
        setSelectedNoteId(id);

        // 2. Direct single-write into PGlite database
        await writeNote(id, folder, '# ', updatedAt, false);
    }, [userId, selectedCategory, setSelectedNoteId, writeNote]);

    /**
     * Soft-delete note by UUID and clean up metadata pins.
     */
    const deleteNote = useCallback(async (id: string) => {
        const note = notes.find(n => resolveNoteId(n) === id);
        if (!note) return;

        if (selectedNoteId && selectedNoteId === id) {
            setSelectedNoteId(null);
        }

        const updatedAt = new Date().toISOString();
        await writeNote(id, note.folder ?? '', note.content, updatedAt, true);

        // Clean up pin in metadata
        const current = metadataRef.current;
        if (current.pinnedNotes?.includes(id)) {
            const newMeta = { ...current };
            newMeta.pinnedNotes = (newMeta.pinnedNotes ?? []).filter(p => p !== id);
            await writeConfig(newMeta);
        }
    }, [notes, resolveNoteId, selectedNoteId, writeNote, setSelectedNoteId, writeConfig, metadataRef]);

    const updateNoteLocally = useCallback(async (
        id: string,
        content: string,
    ) => {
        if (!dbRef.current || !userId) return;
        await dbRef.current.query(
            /* sql */ `
            UPDATE notes SET content = $1
            WHERE id = $2 AND user_id = $3
            `,
            [content, id, userId],
        );
    }, [userId, dbRef]);

    /**
     * Move note to target folder in-place without altering its UUID.
     */
    const moveNote = useCallback(async (noteId: string, targetFolder: string | null) => {
        const note = notes.find(n => resolveNoteId(n) === noteId);
        if (!note || (note.folder ?? '') === (targetFolder ?? '')) return;

        const newFolder = targetFolder ?? '';
        const updatedAt = new Date().toISOString();
        await writeNote(noteId, newFolder, note.content, updatedAt, false);
    }, [notes, resolveNoteId, writeNote]);

    const togglePinNote = useCallback(async (note: Note) => {
        const id = resolveNoteId(note);
        const current = metadataRef.current;
        const pinned = current.pinnedNotes ?? [];
        const pinnedSet = new Set(pinned);
        
        let newPins: string[];
        if (pinnedSet.has(id)) {
            newPins = pinned.filter(p => p !== id);
        } else {
            newPins = [...pinned, id];
        }
        await writeConfig({ ...current, pinnedNotes: newPins });
    }, [resolveNoteId, metadataRef, writeConfig]);

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

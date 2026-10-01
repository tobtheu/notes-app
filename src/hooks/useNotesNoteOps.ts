import { useCallback, useRef } from 'react';
import type { Note, AppMetadata } from '../types';
import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { getPathId, normalizeStr } from '../utils/path';

interface UseNotesNoteOpsProps {
    dbRef: React.MutableRefObject<PGliteWithLive | null>;
    userId: string | null;
    notes: Note[];
    trashNotes?: Note[];
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
    trashNotes,
    selectedNoteId,
    setSelectedNoteId,
    selectedCategory,
    metadataRef,
    writeNote,
    writeConfig,
    getNoteId
}: UseNotesNoteOpsProps) {
    const savingNotes = useRef<Record<string, Promise<string> | undefined>>({});
    const inFlightCreations = useRef<Set<string>>(new Set());

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
     * Prevents note overwriting and collisions across active notes, trash, and in-flight creations.
     */
    const createNote = useCallback(async () => {
        if (!userId) return;
        const folderStr = selectedCategory ?? '';

        // 1. Gather all existing IDs (case-normalized) from active notes, trash, and in-flight creations
        const existingIds = new Set<string>();
        for (const n of notes) {
            existingIds.add(normalizeStr(getNoteId(n)));
        }
        if (trashNotes) {
            for (const n of trashNotes) {
                existingIds.add(normalizeStr(getNoteId(n)));
            }
        }
        for (const inFlight of inFlightCreations.current) {
            existingIds.add(inFlight);
        }

        // 2. Compute first free candidate filename & ID synchronously so selection mounts in <1ms
        let filename = 'Untitled note.md';
        let candidateId = getPathId(filename, folderStr);
        let counter = 1;
        while (existingIds.has(candidateId)) {
            filename = `Untitled note ${counter}.md`;
            candidateId = getPathId(filename, folderStr);
            counter++;
        }

        // Reserve ID immediately so rapid consecutive calls won't pick the same ID
        inFlightCreations.current.add(candidateId);
        const updatedAt = new Date().toISOString();

        // 3. Select immediately so the editor mounts in <1ms
        setSelectedNoteId(candidateId);

        // 4. Verify against DB if available (defense-in-depth against external sync / trash collisions)
        try {
            if (dbRef.current) {
                try {
                    const res = await dbRef.current.query<{ id: string }>(
                        `SELECT id FROM notes WHERE user_id = $1`,
                        [userId]
                    );
                    const dbIds = new Set(res.rows.map(r => normalizeStr(r.id)));
                    if (dbIds.has(candidateId)) {
                        while (existingIds.has(candidateId) || dbIds.has(candidateId)) {
                            filename = `Untitled note ${counter}.md`;
                            candidateId = getPathId(filename, folderStr);
                            counter++;
                        }
                        inFlightCreations.current.add(candidateId);
                        setSelectedNoteId(candidateId);
                    }
                } catch {
                    // Fall back to in-memory check
                }
            }

            // 5. Direct single-write into PGlite database
            await writeNote(candidateId, '# ', updatedAt, false);
        } finally {
            inFlightCreations.current.delete(candidateId);
        }
    }, [userId, notes, trashNotes, selectedCategory, setSelectedNoteId, writeNote, getNoteId, dbRef]);

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

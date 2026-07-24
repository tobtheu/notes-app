import { useCallback, useRef } from 'react';
import type { Note, AppMetadata, FolderMetadata } from '../types';
import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { getPathId, normalizeStr } from '../utils/path';

interface UseNotesOperationsProps {
    dbRef: React.MutableRefObject<PGliteWithLive | null>;
    userId: string | null;
    metadata: AppMetadata;
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
    metadata,
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

    const saveNote = useCallback(async (
        currentId: string,
        filename: string,
        content: string,
        folder: string | null = null,
        skipRename = false,
    ): Promise<string> => {
        if (!userId) return currentId;

        if (savingNotes.current[currentId]) {
            try { await savingNotes.current[currentId]; } catch { /* ignore */ }
        }

        let resolvePromise!: (id: string) => void;
        const savePromise = new Promise<string>(r => { resolvePromise = r; });
        savingNotes.current[currentId] = savePromise;

        try {
            const folderStr = folder ?? '';
            let targetFilename = filename;

            if (!skipRename) {
                const firstLine = content.split('\n')[0].replace(/^#\s*/, '').trim();
                const safeTitle = firstLine.replace(/[^a-z0-9äöüß ]/gi, '').trim().substring(0, 50);
                if (safeTitle) targetFilename = `${safeTitle}.md`;
            }

            const newId = getPathId(targetFilename, folderStr);
            const updatedAt = new Date().toISOString();

            if (newId !== currentId && !skipRename) {
                const currentNote = notes.find(n => getNoteId(n) === currentId);
                if (currentNote) {
                    const collision = notes.some(n =>
                        getNoteId(n) === newId && getNoteId(n) !== currentId,
                    );
                    if (!collision) {
                        await writeNote(currentId, currentNote.content, updatedAt, true);
                        await writeNote(newId, content, updatedAt, false);

                        const current = metadataRef.current;
                        if (current.pinnedNotes?.some(p => normalizeStr(p) === currentId)) {
                            const newMeta = { ...current };
                            newMeta.pinnedNotes = (newMeta.pinnedNotes ?? []).map(p =>
                                normalizeStr(p) === currentId ? newId : p,
                            );
                            await writeConfig(newMeta);
                        }

                        if (selectedNoteId === currentId) setSelectedNoteId(newId);
                        resolvePromise(newId);
                        return newId;
                    }
                }
            }

            await writeNote(currentId, content, updatedAt, false);
            resolvePromise(currentId);
            return currentId;
        } finally {
            delete savingNotes.current[currentId];
        }
    }, [userId, notes, getNoteId, metadataRef, selectedNoteId, writeNote, writeConfig, setSelectedNoteId]);

    const createNote = useCallback(async () => {
        if (!userId) return;
        const folderStr = selectedCategory ?? '';
        let filename = 'Untitled note.md';
        let counter = 1;
        while (notes.some(n => n.filename === filename && normalizeStr(n.folder) === normalizeStr(folderStr))) {
            filename = `Untitled note ${counter}.md`;
            counter++;
        }
        const id = getPathId(filename, folderStr);
        const updatedAt = new Date().toISOString();
        await writeNote(id, '# ', updatedAt, false);
        setSelectedNoteId(id);
    }, [userId, notes, selectedCategory, writeNote, setSelectedNoteId]);

    const deleteNote = useCallback(async (id: string) => {
        const normalizedId = normalizeStr(id);
        const updatedAt = new Date().toISOString();
        const note = notes.find(n => getNoteId(n) === normalizedId);
        if (!note) return;

        await writeNote(normalizedId, note.content, updatedAt, true);

        const mirrorFolder = localStorage.getItem('notes-folder');
        if (mirrorFolder) {
            window.tauriAPI.deleteMirrorFile({ mirrorFolder, noteId: normalizedId }).catch(() => {});
        }

        // Clean up pin in metadata
        const current = metadataRef.current;
        if (current.pinnedNotes?.some(p => normalizeStr(p) === normalizedId)) {
            const newMeta = { ...current };
            newMeta.pinnedNotes = (newMeta.pinnedNotes ?? []).filter(
                p => normalizeStr(p) !== normalizedId
            );
            await writeConfig(newMeta);
        }

        if (selectedNoteId === normalizedId) setSelectedNoteId(null);
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

        const mirrorFolder = localStorage.getItem('notes-folder');
        if (mirrorFolder) {
            window.tauriAPI.deleteMirrorFile({ mirrorFolder, noteId }).catch(() => {});
        }
        if (selectedNoteId === noteId) setSelectedNoteId(newId);
    }, [notes, getNoteId, metadataRef, selectedNoteId, writeNote, writeConfig, setSelectedNoteId]);

    const createFolder = useCallback(async (folderName: string) => {
        const mirrorFolder = localStorage.getItem('notes-folder');
        if (mirrorFolder) {
            await window.tauriAPI.createFolder(mirrorFolder, `${mirrorFolder}/${folderName}`);
        }
        const current = metadataRef.current;
        const order = current.folderOrder ?? [];
        if (!order.some(f => normalizeStr(f) === normalizeStr(folderName))) {
            await writeConfig({ ...current, folderOrder: [...order, folderName] });
        }
    }, [metadataRef, writeConfig]);

    const deleteFolder = useCallback(async (folderRelative: string, mode: 'recursive' | 'move') => {
        const normalizedTarget = normalizeStr(folderRelative);

        const folderNotes = notes.filter(n => normalizeStr(n.folder) === normalizedTarget);
        const updatedAt = new Date().toISOString();
        await Promise.all(folderNotes.map(n => writeNote(getNoteId(n), n.content, updatedAt, true)));

        const mirrorFolder = localStorage.getItem('notes-folder');
        if (mirrorFolder) {
            const folderAbs = `${mirrorFolder}/${folderRelative}`;
            if (mode === 'recursive') {
                window.tauriAPI.deleteFolderRecursive(mirrorFolder, folderAbs).catch(() => {});
            } else {
                window.tauriAPI.deleteFolderMoveContents({ folderPath: folderAbs, rootPath: mirrorFolder }).catch(() => {});
            }
        }

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

        const mirrorFolder = localStorage.getItem('notes-folder');
        if (mirrorFolder) {
            window.tauriAPI.renameFolder({ rootPath: mirrorFolder, oldName, newName }).catch(() => {});
        }

        if (selectedCategory === oldName) setSelectedCategory(newName);
        return { success: true };
    }, [notes, getNoteId, metadataRef, selectedCategory, writeNote, writeConfig, setSelectedCategory]);

    const reorderFolders = useCallback(async (newOrder: string[]) => {
        const current = metadataRef.current;
        const currentOrder = current.folderOrder ?? sortedFolders;
        const newOrderNorm = newOrder.map(f => normalizeStr(f));
        const merged = [...newOrder];
        currentOrder.forEach(f => {
            if (!newOrderNorm.includes(normalizeStr(f))) merged.push(f);
        });
        await writeConfig({ ...current, folderOrder: merged });
    }, [metadataRef, sortedFolders, writeConfig]);

    const togglePinNote = useCallback(async (note: Note) => {
        const notePath = getNoteId(note);
        const current = metadataRef.current;
        const pinned = (current.pinnedNotes ?? []).map(p => normalizeStr(p));
        const newPins = pinned.includes(notePath)
            ? pinned.filter(p => p !== notePath)
            : [...pinned, notePath];
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

    const isNotePinned = useCallback(
        (note: Note) => (metadata.pinnedNotes ?? []).includes(getNoteId(note)),
        [getNoteId, metadata.pinnedNotes],
    );

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
        isNotePinned
    };
}

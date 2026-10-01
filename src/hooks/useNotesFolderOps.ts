import { useCallback } from 'react';
import type { Note, AppMetadata, FolderMetadata } from '../types';
import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { normalizeStr } from '../utils/path';

interface UseNotesFolderOpsProps {
    dbRef?: React.MutableRefObject<PGliteWithLive | null>;
    userId?: string | null;
    notes: Note[];
    sortedFolders: string[];
    selectedCategory: string | null;
    setSelectedCategory: (cat: string | null) => void;
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

export function useNotesFolderOps({
    dbRef,
    userId,
    notes,
    sortedFolders,
    selectedCategory,
    setSelectedCategory,
    metadataRef,
    writeNote,
    writeConfig,
    getNoteId
}: UseNotesFolderOpsProps) {
    const resolveNoteId = useCallback((note: Note): string => {
        return note.id ?? (getNoteId ? getNoteId(note) : '');
    }, [getNoteId]);

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
        await Promise.all(folderNotes.map(n => writeNote(resolveNoteId(n), n.folder, n.content, updatedAt, true)));

        const current = metadataRef.current;
        const newMeta = { ...current };
        const existingKey = Object.keys(newMeta.folders).find(k => normalizeStr(k) === normalizedTarget);
        if (existingKey) delete newMeta.folders[existingKey];
        if (newMeta.folderOrder) newMeta.folderOrder = newMeta.folderOrder.filter(f => normalizeStr(f) !== normalizedTarget);
        if (newMeta.pinnedNotes) {
            const deletedIds = new Set(folderNotes.map(resolveNoteId));
            newMeta.pinnedNotes = newMeta.pinnedNotes.filter(p => !deletedIds.has(p));
        }
        await writeConfig(newMeta);

        if (selectedCategory === folderRelative) setSelectedCategory(null);
    }, [notes, resolveNoteId, metadataRef, selectedCategory, writeNote, writeConfig, setSelectedCategory]);

    const renameFolder = useCallback(async (oldName: string, newName: string) => {
        const normalizedOld = normalizeStr(oldName);
        const normalizedNew = normalizeStr(newName);
        const updatedAt = new Date().toISOString();

        if (normalizedOld !== normalizedNew) {
            const folderNotes = notes.filter(n => normalizeStr(n.folder) === normalizedOld);
            await Promise.all(folderNotes.map(async n => {
                const noteId = resolveNoteId(n);
                await writeNote(noteId, newName, n.content, updatedAt, false);
            }));

            if (dbRef?.current && userId) {
                await dbRef.current.query(
                    `UPDATE notes SET folder = $1 WHERE folder = $2 AND user_id = $3`,
                    [newName, oldName, userId]
                );
            }
        }

        const current = metadataRef.current;
        const newMeta = { ...current };
        const existingKey = Object.keys(newMeta.folders).find(k => normalizeStr(k) === normalizedOld);
        if (existingKey) {
            newMeta.folders[newName] = newMeta.folders[existingKey];
            if (existingKey !== newName) delete newMeta.folders[existingKey];
        }
        if (newMeta.folderOrder) {
            newMeta.folderOrder = newMeta.folderOrder.map(f => normalizeStr(f) === normalizedOld ? newName : f);
        }
        await writeConfig(newMeta);

        if (selectedCategory === oldName) setSelectedCategory(newName);
        return { success: true };
    }, [notes, resolveNoteId, dbRef, userId, metadataRef, selectedCategory, writeNote, writeConfig, setSelectedCategory]);

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

    const updateFolderMetadata = useCallback(async (folderName: string, meta: FolderMetadata) => {
        const current = metadataRef.current;
        const normalizedTarget = normalizeStr(folderName);
        const existingKey = Object.keys(current.folders ?? {}).find(k => normalizeStr(k) === normalizedTarget);
        const keyToUse = existingKey ?? folderName;
        const newMeta = { ...current, folders: { ...current.folders } };
        newMeta.folders[keyToUse] = { ...newMeta.folders[keyToUse], ...meta };
        await writeConfig(newMeta);
    }, [writeConfig, metadataRef]);

    return {
        createFolder,
        deleteFolder,
        renameFolder,
        reorderFolders,
        updateFolderMetadata,
    };
}

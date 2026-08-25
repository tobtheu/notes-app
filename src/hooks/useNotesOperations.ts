import type { Note, AppMetadata } from '../types';
import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { useNotesTrashOps } from './useNotesTrashOps';
import { useNotesFolderOps } from './useNotesFolderOps';
import { useNotesNoteOps } from './useNotesNoteOps';

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
    const trashOps = useNotesTrashOps({
        dbRef,
        userId,
        writeNote
    });

    const folderOps = useNotesFolderOps({
        notes,
        sortedFolders,
        selectedCategory,
        setSelectedCategory,
        metadataRef,
        writeNote,
        writeConfig,
        getNoteId
    });

    const noteOps = useNotesNoteOps({
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
    });

    return {
        ...noteOps,
        ...folderOps,
        ...trashOps,
    };
}

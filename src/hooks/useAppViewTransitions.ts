import { useState } from 'react';
import type { Note, FolderMetadata } from '../types';

interface UseAppViewTransitionsProps {
    setSelectedCategory: (cat: string | null) => void;
    setSelectedNote: (id: string | null) => void;
    getNoteId: (note: Note) => string;
    createNote: () => Promise<void>;
    renameFolder: (oldName: string, newName: string) => Promise<any> | void;
    updateFolderMetadata: (folder: string, meta: FolderMetadata) => Promise<void> | void;
    deleteFolder: (folder: string, mode: 'recursive' | 'move') => Promise<void> | void;
}

export function useAppViewTransitions({
    setSelectedCategory,
    setSelectedNote,
    getNoteId,
    createNote,
    renameFolder,
    updateFolderMetadata,
    deleteFolder,
}: UseAppViewTransitionsProps) {
    const [activeView, setActiveView] = useState<'sidebar' | 'notelist' | 'editor'>('notelist');
    const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
    const [editingCategory, setEditingCategory] = useState<string | null>(null);

    const handleSelectCategory = (category: string | null) => {
        setSelectedCategory(category);
        setActiveView('notelist');
    };

    const handleSelectNote = (note: Note) => {
        if (typeof window !== 'undefined') {
            (window as any).__noteOpenStartTime = performance.now();
        }
        setSelectedNote(getNoteId(note));
        setActiveView('editor');
    };

    const handleCreateNote = () => {
        createNote();
        setActiveView('editor');
    };

    const handleNavigate = (id: string) => {
        setSelectedNote(id);
        setActiveView('editor');
    };

    const handleSaveCategory = (newName: string, folderMeta: FolderMetadata) => {
        if (editingCategory) {
            if (newName !== editingCategory) {
                renameFolder(editingCategory, newName);
                setEditingCategory(newName);
            }
            updateFolderMetadata(newName, folderMeta);
        }
    };

    const handleDeleteCategory = async (mode: 'recursive' | 'move') => {
        if (categoryToDelete) {
            await deleteFolder(categoryToDelete, mode);
            setCategoryToDelete(null);
        }
    };

    return {
        activeView,
        setActiveView,
        categoryToDelete,
        setCategoryToDelete,
        editingCategory,
        setEditingCategory,
        handleSelectCategory,
        handleSelectNote,
        handleCreateNote,
        handleNavigate,
        handleSaveCategory,
        handleDeleteCategory,
    };
}

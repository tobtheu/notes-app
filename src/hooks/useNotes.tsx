import { useState, useEffect, useCallback } from 'react';
import type { Note } from '../types';

export function useNotes() {
    const [currentFolder, setCurrentFolder] = useState<string | null>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Load folder from local storage or ask user
    useEffect(() => {
        const savedFolder = localStorage.getItem('notes-folder');
        if (savedFolder) {
            setCurrentFolder(savedFolder);
        }
    }, []);

    const loadNotes = useCallback(async () => {
        if (!currentFolder) return;
        try {
            const loadedNotes = await window.electronAPI.listNotes(currentFolder);
            setNotes(loadedNotes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
        } catch (error) {
            console.error("Failed to load notes", error);
        }
    }, [currentFolder]);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    // Setup Watcher
    useEffect(() => {
        if (!currentFolder) return;
        window.electronAPI.startWatch(currentFolder);
        const cleanup = window.electronAPI.onFileChanged((data) => {
            console.log('File changed remotely:', data);
            loadNotes(); // Reload list on any change for now
        });
        return cleanup;
    }, [currentFolder, loadNotes]);

    const selectFolder = async () => {
        console.log('Hook: selectFolder called');
        try {
            const folder = await window.electronAPI.selectFolder();
            console.log('Hook: Received folder:', folder);
            if (folder) {
                setCurrentFolder(folder);
                localStorage.setItem('notes-folder', folder);
            }
        } catch (error) {
            console.error('Hook: Error selecting folder', error);
        }
    };

    const saveNote = async (filename: string, content: string) => {
        if (!currentFolder) return;
        await window.electronAPI.saveNote({ folderPath: currentFolder, filename, content });
        // Optimistic update or wait for reload? 
        // For auto-save, we might want to update local state immediately to avoid stutter
        setNotes(prev => prev.map(n => n.filename === filename ? { ...n, content, updatedAt: new Date().toISOString() } : n));
    };

    const createNote = async () => {
        if (!currentFolder) return;
        const filename = `Untitled-${Date.now()}.md`;
        await window.electronAPI.saveNote({ folderPath: currentFolder, filename, content: '' });
        await loadNotes();
        setSelectedNoteId(filename); // Select the new note
    };

    const deleteNote = async (filename: string) => {
        if (!currentFolder) return;
        await window.electronAPI.deleteNote({ folderPath: currentFolder, filename });
        if (selectedNoteId === filename) {
            setSelectedNoteId(null);
        }
        await loadNotes();
    }

    // Derived state
    const selectedNote = notes.find(n => n.filename === selectedNoteId) || null;

    const filteredNotes = notes.filter(note => {
        const contentMatch = note.content.toLowerCase().includes(searchTerm.toLowerCase());
        const titleMatch = note.filename.toLowerCase().includes(searchTerm.toLowerCase());
        return contentMatch || titleMatch;
    });

    return {
        currentFolder,
        notes: filteredNotes,
        selectedNote,
        setSelectedNote: setSelectedNoteId, // Expose as setSelectedNote but it takes ID or we wrap it
        searchTerm,
        setSearchTerm,
        selectFolder,
        saveNote,
        createNote,
        deleteNote,
        reloadNotes: loadNotes
    };
}

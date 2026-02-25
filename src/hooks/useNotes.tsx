import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note, AppMetadata, FolderMetadata } from '../types';

export function useNotes() {
    const [baseFolder, setBaseFolder] = useState<string | null>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [folders, setFolders] = useState<string[]>([]);
    const [metadata, setMetadata] = useState<AppMetadata>({ folders: {}, pinnedNotes: [] });
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null); // This is now the relative path: "folder/filename.md" or "filename.md" (lowercased)
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const getNoteId = (note: Note) => {
        const folder = note.folder ? note.folder.replace(/\\/g, '/') : '';
        const path = folder ? `${folder}/${note.filename}` : note.filename;
        return path.toLowerCase(); // Consistent unique ID
    };

    // Load folder from local storage or ask user
    useEffect(() => {
        const savedFolder = localStorage.getItem('notes-folder');
        if (savedFolder) {
            setBaseFolder(savedFolder);
        }
    }, []);

    const loadMetadata = useCallback(async () => {
        if (!baseFolder) return;
        const meta = await window.electronAPI.readMetadata(baseFolder);
        // Normalize pinned notes in metadata to lowercase for consistency
        if (meta.pinnedNotes) {
            meta.pinnedNotes = meta.pinnedNotes.map(p => p.toLowerCase());
        } else {
            meta.pinnedNotes = [];
        }
        setMetadata(meta);
    }, [baseFolder]);

    const loadNotes = useCallback(async () => {
        if (!baseFolder) return;
        try {
            const loadedNotes = await window.electronAPI.listNotes(baseFolder);

            // Deduplicate by normalized ID (sanity check)
            const uniqueMap = new Map();
            loadedNotes.forEach(note => {
                const id = getNoteId(note);
                if (!uniqueMap.has(id)) {
                    uniqueMap.set(id, note);
                }
            });
            const uniqueNotes = Array.from(uniqueMap.values());

            setNotes(uniqueNotes.sort((a, b) => {
                const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                if (timeDiff !== 0) return timeDiff;
                return a.filename.localeCompare(b.filename);
            }));

            const loadedFolders = await window.electronAPI.listFolders(baseFolder);
            setFolders(loadedFolders);

            await loadMetadata();
        } catch (error) {
            console.error("Failed to load notes or folders", error);
        }
    }, [baseFolder, loadMetadata]);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    const lastSaveTime = useRef<number>(0);

    // Setup Watcher
    useEffect(() => {
        if (!baseFolder) return;
        window.electronAPI.startWatch(baseFolder);
        const cleanup = window.electronAPI.onFileChanged(() => {
            // Ignore events if we just saved (prevent "save-reload-loop")
            const now = Date.now();
            if (now - lastSaveTime.current < 3000) return;

            loadNotes();
        });
        return cleanup;
    }, [baseFolder, loadNotes]);

    const selectFolder = async () => {
        try {
            const folder = await window.electronAPI.selectFolder();
            if (folder) {
                setBaseFolder(folder);
                localStorage.setItem('notes-folder', folder);
            }
        } catch (error) {
            console.error('Hook: Error selecting folder', error);
        }
    };

    const updateNoteLocally = (filename: string, content: string, folder: string = "", updateTimestamp: boolean = false) => {
        const id = folder ? `${folder}/${filename}`.toLowerCase() : filename.toLowerCase();
        setNotes(prev => prev.map(n =>
            getNoteId(n) === id
                ? {
                    ...n,
                    content,
                    updatedAt: updateTimestamp ? new Date().toISOString() : n.updatedAt
                }
                : n
        ));
    };

    const saveNote = async (filename: string, content: string, folder: string | null = null) => {
        if (!baseFolder) return;

        // Extract title from content to see if we should rename
        const lines = content.split('\n');
        const firstLine = lines[0].replace(/^#\s*/, '').trim();
        const safeTitle = firstLine.replace(/[^a-z0-9äöüß ]/gi, '').trim().substring(0, 50);

        let targetFilename = filename;
        if (safeTitle && safeTitle.length > 0) {
            targetFilename = `${safeTitle}.md`;
        }

        const folderPath = folder ? `${baseFolder}/${folder}`.replace(/\/+/g, '/') : baseFolder;

        // Find current note by id
        const currentNote = selectedNoteId ? notes.find(n => getNoteId(n) === selectedNoteId) : null;
        const isRenaming = currentNote && currentNote.filename !== targetFilename;

        if (isRenaming) {
            // Check if another note with targetFilename already exists in the same folder
            const collision = notes.find(n => n.filename === targetFilename && n.folder === (folder || ""));
            if (collision && getNoteId(collision) !== selectedNoteId) {
                targetFilename = currentNote!.filename;
            } else {
                const renameResult = await window.electronAPI.renameNote({
                    folderPath,
                    oldFilename: currentNote!.filename,
                    newFilename: targetFilename
                });

                if (renameResult.success) {
                    const oldPath = selectedNoteId!;
                    const newPathRaw = folder ? `${folder}/${targetFilename}` : targetFilename;
                    const newPath = newPathRaw.toLowerCase();

                    if (metadata.pinnedNotes?.includes(oldPath)) {
                        const newMeta = { ...metadata };
                        newMeta.pinnedNotes = (newMeta.pinnedNotes || []).map(p =>
                            p.toLowerCase() === oldPath ? newPath : p.toLowerCase()
                        );
                        setMetadata(newMeta);
                        await window.electronAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
                    }

                    // Optimistic update of the notes local state to prevent unmounting
                    setNotes(prev => prev.map(n =>
                        getNoteId(n) === oldPath
                            ? { ...n, filename: targetFilename, folder: folder || "" }
                            : n
                    ));
                    setSelectedNoteId(newPath);
                } else {
                    console.error("Rename failed:", renameResult.error);
                    targetFilename = currentNote!.filename;
                }
            }
        }

        const result = await window.electronAPI.saveNote({
            folderPath,
            filename: targetFilename,
            content
        });

        if (result) {
            lastSaveTime.current = Date.now();
            await loadNotes();
        }
    };

    const createNote = async () => {
        if (!baseFolder) return;

        const folderRelative = selectedCategory || "";
        const folderAbsolute = folderRelative ? `${baseFolder}/${folderRelative}` : baseFolder;

        let filename = "Untitled note.md";
        let counter = 1;
        while (notes.some(n => n.filename === filename && n.folder === folderRelative)) {
            filename = `Untitled note ${counter}.md`;
            counter++;
        }

        const initialContent = '# ';
        await window.electronAPI.saveNote({ folderPath: folderAbsolute, filename, content: initialContent });
        await loadNotes();
        const newPathRaw = folderRelative ? `${folderRelative}/${filename}` : filename;
        setSelectedNoteId(newPathRaw.toLowerCase());
    };

    const deleteNote = async (id: string) => {
        if (!baseFolder) return;
        const normalizedId = id.toLowerCase();
        const note = notes.find(n => getNoteId(n) === normalizedId);
        if (!note) return;

        const folderPath = note.folder ? `${baseFolder}/${note.folder}` : baseFolder;
        await window.electronAPI.deleteNote({ folderPath, filename: note.filename });
        if (selectedNoteId === normalizedId) {
            setSelectedNoteId(null);
        }
        await loadNotes();
    };

    const deleteFolder = async (folderRelative: string, mode: 'recursive' | 'move') => {
        if (!baseFolder) return;
        const folderAbsolute = `${baseFolder}/${folderRelative}`;

        if (mode === 'recursive') {
            await window.electronAPI.deleteFolderRecursive(folderAbsolute);
        } else {
            await window.electronAPI.deleteFolderMoveContents({
                folderPath: folderAbsolute,
                rootPath: baseFolder
            });
        }

        // Clean up metadata
        const newMeta = { ...metadata };
        delete newMeta.folders[folderRelative];

        // Remove pins for notes in this folder
        if (newMeta.pinnedNotes) {
            const prefix = `${folderRelative.toLowerCase()}/`;
            newMeta.pinnedNotes = newMeta.pinnedNotes.filter(p => !p.toLowerCase().startsWith(prefix));
        }

        await window.electronAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });

        if (selectedCategory === folderRelative) {
            setSelectedCategory(null);
        }
        await loadNotes();
    };

    const createFolder = async (folderName: string) => {
        if (!baseFolder) return;
        // Always create at root
        const target = `${baseFolder}/${folderName}`;
        await window.electronAPI.createFolder(target);
        await loadNotes();
    };

    const renameFolder = async (oldName: string, newName: string) => {
        if (!baseFolder) return;
        const result = await window.electronAPI.renameFolder({ rootPath: baseFolder, oldName, newName });
        if (result.success) {
            // Update metadata mapping
            const newMeta = { ...metadata };

            // Update folder meta
            if (newMeta.folders[oldName]) {
                newMeta.folders[newName] = newMeta.folders[oldName];
                delete newMeta.folders[oldName];
            }

            // Update pinned notes paths if folder changed
            if (newMeta.pinnedNotes) {
                const oldPrefix = `${oldName.toLowerCase()}/`;
                const newPrefix = `${newName.toLowerCase()}/`;
                newMeta.pinnedNotes = newMeta.pinnedNotes.map(p => {
                    const lp = p.toLowerCase();
                    if (lp.startsWith(oldPrefix)) {
                        return lp.replace(oldPrefix, newPrefix);
                    }
                    return lp;
                });
            }

            await window.electronAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });

            if (selectedCategory === oldName) {
                setSelectedCategory(newName);
            }
            await loadNotes();
        }
        return result;
    };

    const togglePinNote = async (note: Note) => {
        if (!baseFolder) return;
        const notePath = getNoteId(note);
        const newMeta = { ...metadata };
        const pinned = (newMeta.pinnedNotes || []).map(p => p.toLowerCase());

        if (pinned.includes(notePath)) {
            newMeta.pinnedNotes = pinned.filter(p => p !== notePath);
        } else {
            newMeta.pinnedNotes = [...pinned, notePath];
        }

        setMetadata(newMeta);
        await window.electronAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
    };

    const updateFolderMetadata = async (folderName: string, meta: FolderMetadata) => {
        if (!baseFolder) return;
        const newMetadata = { ...metadata };
        newMetadata.folders[folderName] = {
            ...newMetadata.folders[folderName],
            ...meta
        };
        setMetadata(newMetadata);
        await window.electronAPI.saveMetadata({ rootPath: baseFolder, metadata: newMetadata });
    };

    // Helper to check if a note is pinned
    const isNotePinned = (note: Note) => {
        const notePath = getNoteId(note);
        return metadata.pinnedNotes?.includes(notePath) || false;
    };

    // Derived state
    const selectedNote = notes.find(n => getNoteId(n) === selectedNoteId) || null;

    const filteredNotes = notes
        .filter(note => {
            // Filter by search term
            const searchLower = searchTerm.toLowerCase();
            const contentMatch = note.content.toLowerCase().includes(searchLower);
            const titleMatch = note.filename.toLowerCase().includes(searchLower);
            if (!contentMatch && !titleMatch) return false;

            // Filter by category (Flat structure: exact match only)
            if (selectedCategory) {
                return note.folder === selectedCategory;
            }

            return true;
        })
        .sort((a, b) => {
            const aPinned = isNotePinned(a);
            const bPinned = isNotePinned(b);

            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;

            const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            if (timeDiff !== 0) return timeDiff;
            return a.filename.localeCompare(b.filename);
        });

    // Auto-deselect if note is filtered out
    useEffect(() => {
        if (selectedNoteId && !filteredNotes.some(n => getNoteId(n) === selectedNoteId)) {
            setSelectedNoteId(null);
        }
    }, [filteredNotes, selectedNoteId]);

    return {
        currentFolder: baseFolder,
        notes: filteredNotes,
        allNotes: notes,
        folders,
        metadata,
        selectedNote,
        setSelectedNote: setSelectedNoteId,
        selectedCategory,
        setSelectedCategory,
        searchTerm,
        setSearchTerm,
        selectFolder,
        saveNote,
        updateNoteLocally,
        createNote,
        deleteNote,
        createFolder,
        renameFolder,
        updateFolderMetadata,
        deleteFolder,
        togglePinNote,
        isNotePinned,
        reloadNotes: loadNotes,
        getNoteId
    };
}

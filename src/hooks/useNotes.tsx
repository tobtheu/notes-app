import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note, AppMetadata, FolderMetadata } from '../types';

const normalizeStr = (s: string) => s.normalize('NFC').toLowerCase();

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
        return normalizeStr(path); // Consistent unique ID (normalized)
    };

    // Load folder from local storage or ask user
    useEffect(() => {
        const savedFolder = localStorage.getItem('notes-folder');
        if (savedFolder) {
            setBaseFolder(savedFolder);
        }
    }, []);


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
                return normalizeStr(a.filename).localeCompare(normalizeStr(b.filename));
            }));

            const loadedFolders = await window.electronAPI.listFolders(baseFolder);
            const meta = await window.electronAPI.readMetadata(baseFolder);

            // Normalize pinned notes in metadata to lowercase/NFC for consistency
            if (meta.pinnedNotes) {
                meta.pinnedNotes = meta.pinnedNotes.map(p => normalizeStr(p));
            } else {
                meta.pinnedNotes = [];
            }
            setMetadata(meta);

            // Sort folders based on metadata order (case-insensitive + normalized)
            let order = meta.folderOrder || [];
            let needsMetadataSave = false;

            // Normalize order to handle casing and Unicode robustly
            const orderNormalized = order.map(f => normalizeStr(f));

            // Guarantee that any folder existing on disk is in the order array (case-insensitive check)
            loadedFolders.forEach(folder => {
                const normalizedFolder = normalizeStr(folder);
                if (!orderNormalized.includes(normalizedFolder)) {
                    order.push(folder);
                    orderNormalized.push(normalizedFolder);
                    needsMetadataSave = true;
                }
            });

            // If we found missing folders, update the metadata immediately
            if (needsMetadataSave) {
                meta.folderOrder = order;
                setMetadata(meta);
                lastSaveTime.current = Date.now(); // Prevent save loop
                window.electronAPI.saveMetadata({ rootPath: baseFolder, metadata: meta }).catch(e => {
                    console.error("Failed to automatically repair folder order in metadata", e);
                });
            }

            const sortedFolders = [...loadedFolders].sort((a, b) => {
                const indexA = orderNormalized.indexOf(normalizeStr(a));
                const indexB = orderNormalized.indexOf(normalizeStr(b));
                if (indexA === -1 && indexB === -1) return a.localeCompare(b, undefined, { sensitivity: 'accent' });
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
            setFolders(sortedFolders);
        } catch (error) {
            console.error("Failed to load notes or folders", error);
        }
    }, [baseFolder]);

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
            // Reduced guard time to 200ms for better responsiveness
            if (now - lastSaveTime.current < 200) return;

            loadNotes();
        });

        // Polling fallback every 30 seconds for cloud sync reliability
        const pollInterval = setInterval(() => {
            const now = Date.now();
            if (now - lastSaveTime.current > 5000) { // Only poll if not recently saved
                loadNotes();
            }
        }, 30000);

        return () => {
            cleanup();
            clearInterval(pollInterval);
        };
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

    const moveNote = async (noteId: string, targetFolder: string | null) => {
        if (!baseFolder) return;

        const note = notes.find(n => getNoteId(n) === noteId);
        if (!note) return;

        // Note is already in the target folder
        if (note.folder === (targetFolder || "")) return;

        const oldFilename = note.folder ? `${note.folder}/${note.filename}` : note.filename;
        const newFilename = targetFolder ? `${targetFolder}/${note.filename}` : note.filename;

        // Check collision in target folder
        if (notes.some(n => n.filename === note.filename && n.folder === (targetFolder || ""))) {
            console.error("A note with this name already exists in the target folder.");
            return;
        }

        const renameResult = await window.electronAPI.renameNote({
            folderPath: baseFolder,
            oldFilename,
            newFilename
        });

        if (renameResult.success) {
            const newPath = newFilename.toLowerCase();

            // Handle pinned notes update
            if (metadata.pinnedNotes?.includes(noteId)) {
                const newMeta = { ...metadata };
                newMeta.pinnedNotes = (newMeta.pinnedNotes || []).map(p =>
                    p.toLowerCase() === noteId ? newPath : p.toLowerCase()
                );
                setMetadata(newMeta);
                lastSaveTime.current = Date.now();
                await window.electronAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
            }

            // Optimistic update
            setNotes(prev => prev.map(n =>
                getNoteId(n) === noteId
                    ? { ...n, folder: targetFolder || "" }
                    : n
            ));

            if (selectedNoteId === noteId) {
                setSelectedNoteId(newPath);
            }

            lastSaveTime.current = Date.now();
            await loadNotes();
        } else {
            console.error("Failed to move note:", renameResult.error);
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
        // Find existing key with potential case/Unicode difference
        const normalizedTarget = normalizeStr(folderRelative);
        const existingKey = Object.keys(newMeta.folders).find(k => normalizeStr(k) === normalizedTarget);
        if (existingKey) {
            delete newMeta.folders[existingKey];
        } else {
            delete newMeta.folders[folderRelative];
        }

        if (newMeta.folderOrder) {
            newMeta.folderOrder = newMeta.folderOrder.filter(f => normalizeStr(f) !== normalizedTarget);
        }

        // Remove pins for notes in this folder
        if (newMeta.pinnedNotes) {
            const prefix = `${normalizedTarget}/`;
            newMeta.pinnedNotes = newMeta.pinnedNotes.filter(p => !normalizeStr(p).startsWith(prefix));
        }

        lastSaveTime.current = Date.now();
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

        // Update order metadata to include the new folder at the end
        const newMeta = { ...metadata };
        const normalizedNew = normalizeStr(folderName);
        if (newMeta.folderOrder) {
            if (!newMeta.folderOrder.some(f => normalizeStr(f) === normalizedNew)) {
                newMeta.folderOrder = [...newMeta.folderOrder, folderName];
            }
        } else {
            newMeta.folderOrder = [...folders, folderName];
        }
        lastSaveTime.current = Date.now();
        await window.electronAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });

        await loadNotes();
    };

    const reorderFolders = async (newOrder: string[]) => {
        if (!baseFolder) return;

        // Robust merge: Preserve hidden/non-disk folders in metadata
        const currentOrder = metadata.folderOrder || folders;
        const newOrderNormalized = newOrder.map(f => normalizeStr(f));

        // Start with the new order from UI
        let mergedOrder = [...newOrder];

        // Then append anything that was in the old order but NOT touched by the UI reorder
        currentOrder.forEach(f => {
            if (!newOrderNormalized.includes(normalizeStr(f))) {
                mergedOrder.push(f);
            }
        });

        const newMeta = { ...metadata, folderOrder: mergedOrder };
        setMetadata(newMeta);
        setFolders(newOrder); // Optimistic update (UI only shows what matters now)

        lastSaveTime.current = Date.now();
        await window.electronAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
    };

    const renameFolder = async (oldName: string, newName: string) => {
        if (!baseFolder) return;
        const result = await window.electronAPI.renameFolder({ rootPath: baseFolder, oldName, newName });
        if (result.success) {
            // Update metadata mapping
            const newMeta = { ...metadata };

            // Update folder meta
            const normalizedOld = normalizeStr(oldName);
            const normalizedNew = normalizeStr(newName);

            // Update folder keys in metadata.folders
            const existingMetaKey = Object.keys(newMeta.folders).find(k => normalizeStr(k) === normalizedOld);
            if (existingMetaKey) {
                newMeta.folders[newName] = newMeta.folders[existingMetaKey];
                if (existingMetaKey !== newName) {
                    delete newMeta.folders[existingMetaKey];
                }
            }

            // Update pinned notes paths if folder changed
            if (newMeta.pinnedNotes) {
                const oldPrefix = `${normalizedOld}/`;
                const newPrefix = `${normalizedNew}/`;
                newMeta.pinnedNotes = newMeta.pinnedNotes.map(p => {
                    const normalizedP = normalizeStr(p);
                    if (normalizedP.startsWith(oldPrefix)) {
                        return normalizedP.replace(oldPrefix, newPrefix);
                    }
                    return p;
                });
            }

            // Update folderOrder if it exists
            if (newMeta.folderOrder) {
                newMeta.folderOrder = newMeta.folderOrder.map(f => normalizeStr(f) === normalizedOld ? newName : f);
            }

            lastSaveTime.current = Date.now();
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
        const pinned = (newMeta.pinnedNotes || []).map(p => normalizeStr(p));

        if (pinned.includes(notePath)) {
            newMeta.pinnedNotes = pinned.filter(p => p !== notePath);
        } else {
            newMeta.pinnedNotes = [...pinned, notePath];
        }

        setMetadata(newMeta);
        lastSaveTime.current = Date.now();
        await window.electronAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
    };

    const updateFolderMetadata = async (folderName: string, meta: FolderMetadata) => {
        if (!baseFolder) return;
        const newMetadata = { ...metadata };
        // Find existing key case-insensitively + normalized
        const normalizedTarget = normalizeStr(folderName);
        const existingKey = Object.keys(newMetadata.folders).find(k => normalizeStr(k) === normalizedTarget);
        const keyToUse = existingKey || folderName;

        newMetadata.folders[keyToUse] = {
            ...newMetadata.folders[keyToUse],
            ...meta
        };
        setMetadata(newMetadata);
        lastSaveTime.current = Date.now();
        await window.electronAPI.saveMetadata({ rootPath: baseFolder, metadata: newMetadata });
    };

    const saveSettings = async (settings: any) => {
        if (!baseFolder) return;
        const newMetadata = { ...metadata, settings: { ...metadata.settings, ...settings } };
        setMetadata(newMetadata);
        lastSaveTime.current = Date.now();
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
                return normalizeStr(note.folder) === normalizeStr(selectedCategory);
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
        saveSettings,
        deleteFolder,
        reorderFolders,
        moveNote,
        togglePinNote,
        isNotePinned,
        reloadNotes: loadNotes,
        getNoteId
    };
}

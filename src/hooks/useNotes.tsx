import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note, AppMetadata, FolderMetadata } from '../types';

const normalizeStr = (s: string) => s.normalize('NFC').toLowerCase();

/**
 * useNotes Hook
 * The core business logic of the application. Manages:
 * - File system operations (reading/writing/renaming/deleting notes)
 * - Metadata synchronization (pins, folder order, icons, colors)
 * - Real-time file watching and polling fallbacks
 * - Note filtering and sorting
 */
export function useNotes() {
    /**
     * --- STATE MANAGEMENT ---
     */
    const [baseFolder, setBaseFolder] = useState<string | null>(null); // The root directory of the notes
    const [notes, setNotes] = useState<Note[]>([]); // Current list of all notes found on disk
    const [folders, setFolders] = useState<string[]>([]); // List of subdirectories (categories)
    const [metadata, setMetadata] = useState<AppMetadata>({ folders: {}, pinnedNotes: [] }); // UI settings (order, pins)
    const [isLoading, setIsLoading] = useState(false);

    // tracks the currently active note by its unique ID
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const isRepairing = useRef(false); // Guard against recursive calls during metadata repair

    /**
     * Unique Identifier Generation
     * Consistent IDs are critical for tracking notes across renames and moves.
     * Logic: Lowercased "folder/filename.md" normalized to NFC.
     */
    const getNoteId = (note: Note) => {
        const folder = note.folder ? note.folder.replace(/\\/g, '/') : '';
        const path = folder ? `${folder}/${note.filename}` : note.filename;
        return normalizeStr(path);
    };

    /**
     * --- INITIALIZATION ---
     */
    useEffect(() => {
        const savedFolder = localStorage.getItem('notes-folder');
        if (savedFolder) setBaseFolder(savedFolder);
    }, []);

    /**
     * --- DATA LOADING & SYNC ---
     */

    const loadNotes = useCallback(async () => {
        if (!baseFolder || isRepairing.current) return;
        setIsLoading(true);
        try {
            const [loadedNotes, loadedFolders, meta] = await Promise.all([
                window.tauriAPI.listNotes(baseFolder),
                window.tauriAPI.listFolders(baseFolder),
                window.tauriAPI.readMetadata(baseFolder)
            ]);

            // Deduplicate notes by their normalized ID to handle OS casing variations
            const uniqueMap = new Map();
            loadedNotes.forEach(note => {
                const id = getNoteId(note);
                if (!uniqueMap.has(id)) uniqueMap.set(id, note);
            });
            const uniqueNotes = Array.from(uniqueMap.values());

            // Default Sort: Updated date (descending), then filename
            setNotes(uniqueNotes.sort((a, b) => {
                const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                if (timeDiff !== 0) return timeDiff;
                return normalizeStr(a.filename).localeCompare(normalizeStr(b.filename));
            }));

            // Ensure pins in metadata are normalized for robust matching
            if (meta.pinnedNotes) {
                meta.pinnedNotes = meta.pinnedNotes.map(p => normalizeStr(p));
            } else {
                meta.pinnedNotes = [];
            }
            setMetadata(meta);

            // FOLDER REPAIR: Ensure folders seen on disk exist in the metadata order
            let order = meta.folderOrder || [];
            let needsMetadataSave = false;
            const orderNormalized = order.map(f => normalizeStr(f));

            loadedFolders.forEach(folder => {
                const normalizedFolder = normalizeStr(folder);
                if (!orderNormalized.includes(normalizedFolder)) {
                    order.push(folder);
                    orderNormalized.push(normalizedFolder);
                    needsMetadataSave = true;
                }
            });

            if (needsMetadataSave) {
                isRepairing.current = true;
                meta.folderOrder = order;
                setMetadata({ ...meta }); // Trigger state update
                lastSaveTime.current = Date.now(); // Update immediately before the async call
                try {
                    await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: meta });
                } catch (e) {
                    console.error("Failed to save repaired metadata", e);
                } finally {
                    isRepairing.current = false;
                }
            }

            // apply the metadata order to the folder list
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
        } finally {
            setIsLoading(false);
        }
    }, [baseFolder]);

    /**
     * --- FILE SYSTEM WATCHING ---
     */

    const lastSaveTime = useRef<number>(0);

    useEffect(() => {
        if (!baseFolder) return;

        // Initial load
        loadNotes();

        window.tauriAPI.startWatch(baseFolder);

        // Listener for external changes (e.g. OneDrive/Git sync)
        let debounceTimer: any = null;
        const cleanup = window.tauriAPI.onFileChanged(() => {
            const now = Date.now();
            if (now - lastSaveTime.current < 500) return; // Increased guard

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                loadNotes();
                debounceTimer = null;
            }, 300); // Debounce to batch multiple rapid changes
        });


        // Configuration Point: Polling Interval (ms)
        // Fallback for cases where OS events fail or cloud drives sync silently
        const pollInterval = setInterval(() => {
            const now = Date.now();
            if (now - lastSaveTime.current > 5000) loadNotes();
        }, 30000);

        return () => {
            cleanup();
            clearInterval(pollInterval);
        };
    }, [baseFolder, loadNotes]);

    /**
     * --- CORE ACTIONS: NOTES ---
     */

    const selectFolder = async () => {
        try {
            const folder = await window.tauriAPI.selectFolder();
            if (folder) {
                setBaseFolder(folder);
                localStorage.setItem('notes-folder', folder);
            }
        } catch (error) {
            console.error('Hook: Error selecting folder', error);
        }
    };

    /**
     * updateNoteLocally
     * Performs an "Optimistic Update" on the UI state without waiting for the disk write.
     * Crucial for smooth typing experiences.
     */
    const updateNoteLocally = (filename: string, content: string, folder: string = "", updateTimestamp: boolean = false) => {
        const id = folder ? `${folder}/${filename}`.toLowerCase() : filename.toLowerCase();
        setNotes(prev => prev.map((n: Note) =>
            getNoteId(n) === id
                ? {
                    ...n,
                    content,
                    updatedAt: updateTimestamp ? new Date().toISOString() : n.updatedAt
                }
                : n
        ));
    };

    /**
     * saveNote
     * Handles: Content saving, Auto-renaming based on the first line (Title),
     * and ID synchronization (updating pins if renamed).
     */
    const saveNote = async (filename: string, content: string, folder: string | null = null) => {
        if (!baseFolder) return;

        // PREEMPTIVE GUARD: Block the file watcher immediately before the async work starts
        lastSaveTime.current = Date.now();

        // Configuration Point: Filename Generation Logic
        const lines = content.split('\n');
        const firstLine = lines[0].replace(/^#\s*/, '').trim();
        const safeTitle = firstLine.replace(/[^a-z0-9äöüß ]/gi, '').trim().substring(0, 50);

        let targetFilename = filename;
        if (safeTitle && safeTitle.length > 0) {
            targetFilename = `${safeTitle}.md`;
        }

        const folderPath = folder ? `${baseFolder}/${folder}`.replace(/\/+/g, '/') : baseFolder;
        const currentNote = selectedNoteId ? notes.find((n: Note) => getNoteId(n) === selectedNoteId) : null;
        const isRenaming = currentNote && currentNote.filename !== targetFilename;

        if (isRenaming) {
            // Check for collisions to avoid accidentally overwriting existing files
            const collision = notes.find((n: Note) => n.filename === targetFilename && n.folder === (folder || ""));
            if (collision && getNoteId(collision) !== selectedNoteId) {
                targetFilename = currentNote!.filename;
            } else {
                const renameResult = await window.tauriAPI.renameNote({
                    folderPath,
                    oldFilename: currentNote!.filename,
                    newFilename: targetFilename
                });

                if (renameResult.success) {
                    const oldPath = selectedNoteId!;
                    const newPath = (folder ? `${folder}/${targetFilename}` : targetFilename).toLowerCase();

                    // Migrate pins if the note was renamed
                    if (metadata.pinnedNotes?.includes(oldPath)) {
                        const newMeta = { ...metadata };
                        newMeta.pinnedNotes = (newMeta.pinnedNotes || []).map((p: string) =>
                            p.toLowerCase() === oldPath ? newPath : p.toLowerCase()
                        );
                        setMetadata(newMeta);
                        await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
                    }

                    // Optimistic update to keep the Note object in memory
                    setNotes(prev => prev.map((n: Note) =>
                        getNoteId(n) === oldPath
                            ? { ...n, filename: targetFilename, folder: folder || "" }
                            : n
                    ));
                    setSelectedNoteId(newPath);
                } else {
                    targetFilename = currentNote!.filename;
                }
            }
        }

        const result = await window.tauriAPI.saveNote({
            folderPath,
            filename: targetFilename,
            content
        });

        if (result) {
            await loadNotes();
        }
    };

    /**
     * moveNote
     * Relocates a file between root and category folders.
     */
    const moveNote = async (noteId: string, targetFolder: string | null) => {
        if (!baseFolder) return;
        const note = notes.find(n => getNoteId(n) === noteId);
        if (!note || note.folder === (targetFolder || "")) return;

        const oldFilename = note.folder ? `${note.folder}/${note.filename}` : note.filename;
        const newFilename = targetFolder ? `${targetFolder}/${note.filename}` : note.filename;

        if (notes.some(n => n.filename === note.filename && n.folder === (targetFolder || ""))) {
            console.error("Collision error");
            return;
        }

        // PREEMPTIVE GUARD
        lastSaveTime.current = Date.now();
        const renameResult = await window.tauriAPI.renameNote({
            folderPath: baseFolder,
            oldFilename,
            newFilename
        });

        if (renameResult.success) {
            const newPath = newFilename.toLowerCase();
            if (metadata.pinnedNotes?.includes(noteId)) {
                const newMeta = { ...metadata };
                newMeta.pinnedNotes = (newMeta.pinnedNotes || []).map(p => p.toLowerCase() === noteId ? newPath : p.toLowerCase());
                setMetadata(newMeta);
                await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
            }

            setNotes(prev => prev.map(n => getNoteId(n) === noteId ? { ...n, folder: targetFolder || "" } : n));
            if (selectedNoteId === noteId) setSelectedNoteId(newPath);
            await loadNotes();
        }
    };

    const createNote = async () => {
        if (!baseFolder) return;
        lastSaveTime.current = Date.now();
        const folderRelative = selectedCategory || "";
        const folderAbsolute = folderRelative ? `${baseFolder}/${folderRelative}` : baseFolder;

        let filename = "Untitled note.md";
        let counter = 1;
        while (notes.some(n => n.filename === filename && n.folder === folderRelative)) {
            filename = `Untitled note ${counter}.md`;
            counter++;
        }

        await window.tauriAPI.saveNote({ folderPath: folderAbsolute, filename, content: '# ' });
        await loadNotes();
        setSelectedNoteId(`${folderRelative ? folderRelative + '/' : ''}${filename}`.toLowerCase());
    };

    const deleteNote = async (id: string) => {
        if (!baseFolder) return;
        lastSaveTime.current = Date.now();
        const normalizedId = id.toLowerCase();
        const note = notes.find(n => getNoteId(n) === normalizedId);
        if (!note) return;

        const folderPath = note.folder ? `${baseFolder}/${note.folder}` : baseFolder;
        await window.tauriAPI.deleteNote({ folderPath, filename: note.filename });
        if (selectedNoteId === normalizedId) setSelectedNoteId(null);
        await loadNotes();
    };

    /**
     * --- CORE ACTIONS: FOLDERS ---
     */

    const deleteFolder = async (folderRelative: string, mode: 'recursive' | 'move') => {
        if (!baseFolder) return;
        lastSaveTime.current = Date.now();
        const folderAbsolute = `${baseFolder}/${folderRelative}`;

        if (mode === 'recursive') {
            await window.tauriAPI.deleteFolderRecursive(folderAbsolute);
        } else {
            await window.tauriAPI.deleteFolderMoveContents({ folderPath: folderAbsolute, rootPath: baseFolder });
        }

        const newMeta = { ...metadata };
        const normalizedTarget = normalizeStr(folderRelative);
        const existingKey = Object.keys(newMeta.folders).find(k => normalizeStr(k) === normalizedTarget);
        if (existingKey) delete newMeta.folders[existingKey];
        if (newMeta.folderOrder) newMeta.folderOrder = newMeta.folderOrder.filter(f => normalizeStr(f) !== normalizedTarget);
        if (newMeta.pinnedNotes) {
            const prefix = `${normalizedTarget}/`;
            newMeta.pinnedNotes = newMeta.pinnedNotes.filter(p => !normalizeStr(p).startsWith(prefix));
        }

        lastSaveTime.current = Date.now();
        await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
        if (selectedCategory === folderRelative) setSelectedCategory(null);
        await loadNotes();
    };

    const createFolder = async (folderName: string) => {
        if (!baseFolder) return;
        lastSaveTime.current = Date.now();
        await window.tauriAPI.createFolder(`${baseFolder}/${folderName}`);
        const newMeta = { ...metadata };
        const normalizedNew = normalizeStr(folderName);
        if (newMeta.folderOrder) {
            if (!newMeta.folderOrder.some(f => normalizeStr(f) === normalizedNew)) newMeta.folderOrder = [...newMeta.folderOrder, folderName];
        } else {
            newMeta.folderOrder = [...folders, folderName];
        }
        lastSaveTime.current = Date.now();
        await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
        await loadNotes();
    };

    const reorderFolders = async (newOrder: string[]) => {
        if (!baseFolder) return;
        const currentOrder = metadata.folderOrder || folders;
        const newOrderNormalized = newOrder.map(f => normalizeStr(f));
        let mergedOrder = [...newOrder];
        currentOrder.forEach(f => { if (!newOrderNormalized.includes(normalizeStr(f))) mergedOrder.push(f); });
        const newMeta = { ...metadata, folderOrder: mergedOrder };
        setMetadata(newMeta);
        setFolders(newOrder); // Optimistic UI update
        lastSaveTime.current = Date.now();
        await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
    };

    const renameFolder = async (oldName: string, newName: string) => {
        if (!baseFolder) return;
        lastSaveTime.current = Date.now();
        const result = await window.tauriAPI.renameFolder({ rootPath: baseFolder, oldName, newName });
        if (result.success) {
            const newMeta = { ...metadata };
            const normalizedOld = normalizeStr(oldName);
            const normalizedNew = normalizeStr(newName);
            const existingMetaKey = Object.keys(newMeta.folders).find(k => normalizeStr(k) === normalizedOld);
            if (existingMetaKey) {
                newMeta.folders[newName] = newMeta.folders[existingMetaKey];
                if (existingMetaKey !== newName) delete newMeta.folders[existingMetaKey];
            }
            if (newMeta.pinnedNotes) {
                const oldPrefix = `${normalizedOld}/`;
                const newPrefix = `${normalizedNew}/`;
                newMeta.pinnedNotes = newMeta.pinnedNotes.map(p => {
                    const normalizedP = normalizeStr(p);
                    return normalizedP.startsWith(oldPrefix) ? normalizedP.replace(oldPrefix, newPrefix) : p;
                });
            }
            if (newMeta.folderOrder) newMeta.folderOrder = newMeta.folderOrder.map(f => normalizeStr(f) === normalizedOld ? newName : f);
            lastSaveTime.current = Date.now();
            await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
            if (selectedCategory === oldName) setSelectedCategory(newName);
            await loadNotes();
        }
        return result;
    };

    const togglePinNote = async (note: Note) => {
        if (!baseFolder) return;
        const notePath = getNoteId(note);
        const newMeta = { ...metadata };
        const pinned = (newMeta.pinnedNotes || []).map(p => normalizeStr(p));
        newMeta.pinnedNotes = pinned.includes(notePath) ? pinned.filter(p => p !== notePath) : [...pinned, notePath];
        setMetadata(newMeta);
        lastSaveTime.current = Date.now();
        await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
    };

    const updateFolderMetadata = async (folderName: string, meta: FolderMetadata) => {
        if (!baseFolder) return;
        const newMetadata = { ...metadata };
        const normalizedTarget = normalizeStr(folderName);
        const existingKey = Object.keys(newMetadata.folders).find(k => normalizeStr(k) === normalizedTarget);
        const keyToUse = existingKey || folderName;
        newMetadata.folders[keyToUse] = { ...newMetadata.folders[keyToUse], ...meta };
        setMetadata(newMetadata);
        lastSaveTime.current = Date.now();
        await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMetadata });
    };

    const saveSettings = async (settings: any) => {
        if (!baseFolder) return;
        const newMetadata = { ...metadata, settings: { ...metadata.settings, ...settings } };
        setMetadata(newMetadata);
        lastSaveTime.current = Date.now();
        await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMetadata });
    };

    const isNotePinned = (note: Note) => (metadata.pinnedNotes?.includes(getNoteId(note)) || false);

    /**
     * --- DERIVED STATE: FILTERING & SORTING ---
     */

    const selectedNote = notes.find(n => getNoteId(n) === selectedNoteId) || null;

    const filteredNotes = notes
        .filter(note => {
            const searchLower = searchTerm.toLowerCase();
            const contentMatch = note.content.toLowerCase().includes(searchLower);
            const titleMatch = note.filename.toLowerCase().includes(searchLower);
            if (!contentMatch && !titleMatch) return false;
            if (selectedCategory && normalizeStr(note.folder) !== normalizeStr(selectedCategory)) return false;
            return true;
        })
        .sort((a, b) => {
            // Priority 1: Pinned notes at top
            const aPinned = isNotePinned(a);
            const bPinned = isNotePinned(b);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;

            // Priority 2: Modified date
            const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            if (timeDiff !== 0) return timeDiff;
            return a.filename.localeCompare(b.filename);
        });

    /**
     * Auto-deselect: If the active note disappears from the filtered list (e.g. category switch),
     * we clear the selection to avoid editing a hidden note.
     */
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
        getNoteId,
        isLoading
    };
}

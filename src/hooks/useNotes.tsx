import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note, AppMetadata, FolderMetadata } from '../types';
import { normalizeStr, getPathId } from '../utils/path';

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
    const notesRef = useRef<Note[]>([]);
    useEffect(() => { notesRef.current = notes; }, [notes]);
    const [folders, setFolders] = useState<string[]>([]); // List of subdirectories (categories)
    const [metadata, setMetadata] = useState<AppMetadata>({ folders: {}, pinnedNotes: [] }); // UI settings (order, pins)
    const [isLoading, setIsLoading] = useState(false);

    // tracks the currently active note by its unique ID
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const isRepairing = useRef(false); // Guard against recursive calls during metadata repair
    const lastSaveTime = useRef<number>(0);
    const lastLoadTime = useRef<number>(0);
    const savingNotes = useRef<Record<string, Promise<any> | undefined>>({}); // Serialize saves for same note ID

    /**
     * Unique Identifier Generation
     * Consistent IDs are critical for tracking notes across renames and moves.
     * Logic: Lowercased "folder/filename.md" normalized to NFC.
     */
    const getNoteId = useCallback((note: Note) => {
        return getPathId(note.filename, note.folder || "");
    }, []);

    /**
     * --- INITIALIZATION ---
     */
    useEffect(() => {
        const initFolder = async () => {
            let savedFolder = localStorage.getItem('notes-folder');
            
            // CRITICAL FIX: iOS changes the app container UUID on updates/reinstalls.
            // If we blindly trust the absolute path in localStorage, we get OS Sandbox EPERM errors.
            // On mobile, force-resolve the current Document Dir instead of relying on saved absolute paths.
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                try {
                    const docDir = await window.tauriAPI.getDocumentDir();
                    const newPath = `${docDir}/NotizApp`.replace(/\\/g, '/');
                    // Ensure the folder exists in the new sandbox path
                    await window.tauriAPI.createFolder(docDir, newPath);
                    savedFolder = newPath;
                    localStorage.setItem('notes-folder', savedFolder);
                } catch (e) {
                    console.error("Failed to resolve dynamic mobile path:", e);
                }
            }

            if (savedFolder && !savedFolder.startsWith('null')) {
                setBaseFolder(savedFolder);
            } else {
                setBaseFolder(null);
            }
        };
        initFolder();
    }, []);

    /**
     * --- DATA LOADING & SYNC ---
     */
    type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict';
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>(
        navigator.onLine ? 'idle' : 'offline'
    );
    const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
    const [conflictPairs, setConflictPairs] = useState<{ original: string; conflictCopy: string }[]>([]);
    const [syncError, setSyncError] = useState<string | null>(null);

    const loadNotes = useCallback(async (showLoader: boolean = true) => {
        if (!baseFolder || isRepairing.current) return;
        if (showLoader) setIsLoading(true);
        try {
            const [loadedNotes, loadedFolders, meta] = await Promise.all([
                window.tauriAPI.listNotes(baseFolder).catch(e => { console.error('listNotes failed:', e); return []; }),
                window.tauriAPI.listFolders(baseFolder).catch(e => { console.error('listFolders failed:', e); return []; }),
                window.tauriAPI.readMetadata(baseFolder).catch(e => { console.error('readMetadata failed:', e); return { folders: {}, pinnedNotes: [], folderOrder: [], settings: {} }; })
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
            if (showLoader) setIsLoading(false);
            lastLoadTime.current = Date.now();
        }
    }, [baseFolder]);

    const resetSyncStatus = useCallback(() => {
        setSyncStatus('idle');
        setConflictPairs([]);
    }, []);

    const triggerSync = useCallback(async () => {
        if (!baseFolder || !navigator.onLine) return;
        setIsSyncing(true);
        setSyncStatus('syncing');
        setSyncError(null);
        try {
            const result = await window.tauriAPI.syncNow(baseFolder);
            if (result.hadConflicts) {
                setSyncStatus('conflict');
                setConflictPairs(result.conflictPairs);
            } else {
                setSyncStatus('synced');
                setLastSyncedAt(new Date());
                setConflictPairs([]);
            }
            // Reload notes if we pulled any remote changes
            if (result.hadChanges) {
                await loadNotes();
            }
        } catch (e) {
            console.error("Sync failed:", e);
            setSyncError(String(e));
            setSyncStatus('error');
        } finally {
            setIsSyncing(false);
        }
    }, [baseFolder, loadNotes]);

    // Online/Offline detection — auto-sync when connection returns
    useEffect(() => {
        const handleOnline = () => {
            setSyncStatus('idle');
            triggerSync();
        };
        const handleOffline = () => {
            setSyncStatus('offline');
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        // Set initial state
        if (!navigator.onLine) setSyncStatus('offline');
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [triggerSync]);

    // 60-second background auto-pull (only when online and idle)
    useEffect(() => {
        if (!baseFolder) return;

        const intervalId = setInterval(() => {
            if (!navigator.onLine) return;
            const timeSinceLastSave = Date.now() - lastSaveTime.current;
            // Only pull if user hasn't typed in the last 30 seconds to avoid interruptions
            if (timeSinceLastSave > 30000 && !isSyncing) {
                triggerSync();
            }
        }, 60000); // 60 seconds

        return () => clearInterval(intervalId);
    }, [baseFolder, isSyncing, triggerSync]);

    /**
     * --- FILE SYSTEM WATCHING ---
     */

    useEffect(() => {
        if (!baseFolder) return;

        // Initial load
        loadNotes();

        triggerSync();

        window.tauriAPI.startWatch(baseFolder);

        // Listener for external changes (e.g. OneDrive/Git sync)
        let debounceTimer: any = null;
        const cleanup = window.tauriAPI.onFileChanged(() => {
            const now = Date.now();
            if (now - lastSaveTime.current < 2000) return; // Increased guard to 2s
            if (isSyncing) return; // Ignore changes while syncing to avoid loops

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                loadNotes(false);
                debounceTimer = null;
            }, 300);
        });


        // Fallback for cases where OS events fail or cloud drives sync silently
        const pollInterval = setInterval(() => {
            const now = Date.now();
            // Fallback for cases where OS events fail
            // Only poll if no recent save AND no recent load AND not currently syncing
            // Increased guard to 30s for save and 45s for load to be more conservative during typing
            if (now - lastSaveTime.current > 30000 && now - lastLoadTime.current > 45000 && !isSyncing) {
                loadNotes(false);
            }
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

    const setupDefaultWorkspace = async (updateState = true) => {
        try {
            const docDir = await window.tauriAPI.getDocumentDir();
            const defaultPath = `${docDir}/NotizApp`.replace(/\\/g, '/');
            await window.tauriAPI.createFolder(docDir, defaultPath);
            if (updateState) {
                setBaseFolder(defaultPath);
                localStorage.setItem('notes-folder', defaultPath);
            }
            return defaultPath;
        } catch (error) {
            console.error('Hook: Error setting up default workspace', error);
            throw error;
        }
    };

    const startGitHubOnboarding = async () => {
        return await window.tauriAPI.startGithubOAuth();
    };

    const completeGitHubOnboarding = async (deviceCode: string, interval: number, folderPath: string) => {
        const username = await window.tauriAPI.completeGithubOAuth(deviceCode, interval, folderPath);

        // After success, we MUST set the base folder and save it to localStorage
        // so the app actually "lands" in the new workspace.
        setBaseFolder(folderPath);
        localStorage.setItem('notes-folder', folderPath);

        setSyncStatus('idle');
        triggerSync();
        return username;
    };

    /**
     * updateNoteLocally
     * Performs an "Optimistic Update" on the UI state without waiting for the disk write.
     * Crucial for smooth typing experiences.
     */
    const updateNoteLocally = useCallback((filename: string, content: string, folder: string = "", updateTimestamp: boolean = false) => {
        const id = getPathId(filename, folder);

        // CRITICAL: Update lastSaveTime to block background sync/poll while typing
        lastSaveTime.current = Date.now();

        setNotes(prev => prev.map((n: Note) =>
            getNoteId(n) === id
                ? {
                    ...n,
                    content,
                    updatedAt: updateTimestamp ? new Date().toISOString() : n.updatedAt
                }
                : n
        ));
    }, []);

    /**
     * saveNote
     * Handles: Content saving, Auto-renaming based on the first line (Title),
     * and ID synchronization (updating pins if renamed).
     */
    const saveNote = useCallback(async (currentId: string, filename: string, content: string, folder: string | null = null, skipRename: boolean = false) => {
        if (!baseFolder) return currentId;

        // --- SERIALIZATION ---
        // If there's an active save for this logical note, wait for it to finish
        // to ensure we always have the latest on-disk state and valid ID.
        if (savingNotes.current[currentId]) {
            try { await savingNotes.current[currentId]; } catch (e) { /* ignore */ }
        }

        let resolveSave: (val: any) => void;
        const currentSavePromise = new Promise(resolve => { resolveSave = resolve; });
        savingNotes.current[currentId] = currentSavePromise;

        try {
            // PREEMPTIVE GUARD: Block the file watcher immediately before the async work starts
            lastSaveTime.current = Date.now();

            // Use the Ref instead of the state to avoid stale closure issues during rapid saves
            const currentNotes = notesRef.current;

            // Configuration Point: Filename Generation Logic
            const lines = content.split('\n');
            const firstLine = lines[0].replace(/^#\s*/, '').trim();
            const safeTitle = firstLine.replace(/[^a-z0-9äöüß ]/gi, '').trim().substring(0, 50);

            let targetFilename = filename;
            if (safeTitle && safeTitle.length > 0) {
                targetFilename = `${safeTitle}.md`;
            }

            const folderPath = folder ? `${baseFolder}/${folder}`.replace(/\/+/g, '/') : baseFolder;

            // Use the passed-in ID to find the note, which is more reliable than the hook's state
            let currentNote = currentNotes.find((n: Note) => getNoteId(n) === currentId);

            // FALLBACK LOOKUP: If ID lookup failed (e.g. background state refresh), try identifying by filename/folder
            if (!currentNote && currentId) {
                currentNote = currentNotes.find((n: Note) =>
                    normalizeStr(n.filename) === normalizeStr(filename) &&
                    normalizeStr(n.folder) === normalizeStr(folder || "")
                );
            }

            // CRITICAL: Zombie Protection
            // If we have an ID but NO currentNote (even after fallback), it means the note is missing 
            // from the current app state (maybe a sync is in progress). 
            // ABORT to avoid creating a new duplicate file from a stale ID.
            // EXCEPTION: Allow "Quick Note.md" to be created even if not in state yet.
            if (currentId && !currentNote && filename !== 'Quick Note.md') {
                console.warn(`[saveNote] Aborting save: Note ID ${currentId} is not in current state. Prevents duplicate creation.`);
                return currentId;
            }

            if (skipRename) {
                await window.tauriAPI.saveNote({
                    rootPath: baseFolder,
                    folderPath,
                    filename: currentNote?.filename || filename,
                    content
                });
                return currentId;
            }

            const isRenaming = currentNote && normalizeStr(currentNote.filename) !== normalizeStr(targetFilename);

            let finalId = currentId;

            if (isRenaming) {
                // Check for collisions to avoid accidentally overwriting existing files
                const collision = currentNotes.find((n: Note) => normalizeStr(n.filename) === normalizeStr(targetFilename) && normalizeStr(n.folder) === normalizeStr(folder || ""));

                if (collision && getNoteId(collision) !== currentId) {
                    targetFilename = currentNote!.filename;
                } else {
                    const oldRelativePath = folder ? `${folder}/${currentNote!.filename}` : currentNote!.filename;
                    const newRelativePath = folder ? `${folder}/${targetFilename}` : targetFilename;

                    const renameResult = await window.tauriAPI.renameNote({
                        rootPath: baseFolder,
                        oldFilename: oldRelativePath,
                        newFilename: newRelativePath
                    });

                    if (renameResult.success) {
                        const oldPathId = currentId;
                        const newPathId = getPathId(targetFilename, folder || "");

                        // Migrate pins if the note was renamed
                        if (metadata.pinnedNotes?.some(p => normalizeStr(p) === oldPathId)) {
                            const newMeta = { ...metadata };
                            newMeta.pinnedNotes = (newMeta.pinnedNotes || []).map((p: string) =>
                                normalizeStr(p) === oldPathId ? newPathId : p
                            );
                            setMetadata(newMeta);
                            await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
                        }

                        // Optimistic update to keep the Note object in memory
                        setNotes(prev => {
                            const updated = prev.map((n: Note) =>
                                getNoteId(n) === oldPathId
                                    ? { ...n, filename: targetFilename, folder: folder || "" }
                                    : n
                            );
                            const uniqueMap = new Map<string, Note>();
                            updated.forEach(n => uniqueMap.set(getNoteId(n), n));
                            return Array.from(uniqueMap.values());
                        });

                        // IF the note we just renamed is still the one actually selected in the hook,
                        // we update the hook's selection state.
                        if (selectedNoteId === oldPathId) {
                            setSelectedNoteId(newPathId);
                        }
                        finalId = newPathId;
                    } else {
                        targetFilename = currentNote!.filename;
                    }
                }
            }

            const result = await window.tauriAPI.saveNote({
                rootPath: baseFolder,
                folderPath,
                filename: isRenaming ? targetFilename : (currentNote?.filename || filename),
                content
            });

            if (result) {
                // Already updated locally and optimistically, no need for full loadNotes flicker
                // await loadNotes(false);
                return finalId;
            }
            return currentId;
        } finally {
            // Unblock next save
            delete savingNotes.current[currentId];
            resolveSave!(null);
        }
    }, [baseFolder, getNoteId, metadata.pinnedNotes, selectedNoteId]);

    /**
     * moveNote
     * Relocates a file between root and category folders.
     */
    const moveNote = useCallback(async (noteId: string, targetFolder: string | null) => {
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
            rootPath: baseFolder,
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

            setNotes(prev => {
                const updated = prev.map(n => getNoteId(n) === noteId ? { ...n, folder: targetFolder || "" } : n);
                const uniqueMap = new Map<string, Note>();
                updated.forEach(n => uniqueMap.set(getNoteId(n), n));
                return Array.from(uniqueMap.values());
            });
            if (selectedNoteId === noteId) setSelectedNoteId(newPath);
            await loadNotes();
        }
    }, [baseFolder, getNoteId, loadNotes, metadata.pinnedNotes, notes, selectedNoteId]);

    const createNote = useCallback(async () => {
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

        await window.tauriAPI.saveNote({ rootPath: baseFolder, folderPath: folderAbsolute, filename, content: '# ' });
        await loadNotes();
        setSelectedNoteId(`${folderRelative ? folderRelative + '/' : ''}${filename}`.toLowerCase());
    }, [baseFolder, loadNotes, notes, selectedCategory]);

    const deleteNote = useCallback(async (id: string) => {
        if (!baseFolder) return;
        lastSaveTime.current = Date.now();
        const normalizedId = id.toLowerCase();
        const note = notes.find(n => getNoteId(n) === normalizedId);
        if (!note) return;

        const folderPath = note.folder ? `${baseFolder}/${note.folder}` : baseFolder;
        await window.tauriAPI.deleteNote({ rootPath: baseFolder, folderPath, filename: note.filename });
        if (selectedNoteId === normalizedId) setSelectedNoteId(null);
        await loadNotes();
    }, [baseFolder, getNoteId, loadNotes, notes, selectedNoteId]);

    /**
     * --- CORE ACTIONS: FOLDERS ---
     */

    const deleteFolder = useCallback(async (folderRelative: string, mode: 'recursive' | 'move') => {
        if (!baseFolder) return;
        lastSaveTime.current = Date.now();
        const folderAbsolute = `${baseFolder}/${folderRelative}`;

        if (mode === 'recursive') {
            await window.tauriAPI.deleteFolderRecursive(baseFolder, folderAbsolute);
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
    }, [baseFolder, loadNotes, metadata, selectedCategory]);

    const createFolder = useCallback(async (folderName: string) => {
        if (!baseFolder) return;
        lastSaveTime.current = Date.now();
        await window.tauriAPI.createFolder(baseFolder, `${baseFolder}/${folderName}`);
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
    }, [baseFolder, folders, loadNotes, metadata]);

    const reorderFolders = useCallback(async (newOrder: string[]) => {
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
    }, [baseFolder, folders, metadata]);

    const renameFolder = useCallback(async (oldName: string, newName: string) => {
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
    }, [baseFolder, loadNotes, metadata, selectedCategory]);

    const togglePinNote = useCallback(async (note: Note) => {
        if (!baseFolder) return;
        const notePath = getNoteId(note);
        const newMeta = { ...metadata };
        const pinned = (newMeta.pinnedNotes || []).map(p => normalizeStr(p));
        newMeta.pinnedNotes = pinned.includes(notePath) ? pinned.filter(p => p !== notePath) : [...pinned, notePath];
        setMetadata(newMeta);
        lastSaveTime.current = Date.now();
        await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMeta });
    }, [baseFolder, getNoteId, metadata]);

    const updateFolderMetadata = useCallback(async (folderName: string, meta: FolderMetadata) => {
        if (!baseFolder) return;
        const newMetadata = { ...metadata };
        const normalizedTarget = normalizeStr(folderName);
        const existingKey = Object.keys(newMetadata.folders).find(k => normalizeStr(k) === normalizedTarget);
        const keyToUse = existingKey || folderName;
        newMetadata.folders[keyToUse] = { ...newMetadata.folders[keyToUse], ...meta };
        setMetadata(newMetadata);
        lastSaveTime.current = Date.now();
        await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMetadata });
    }, [baseFolder, metadata]);

    const saveSettings = useCallback(async (settings: any) => {
        if (!baseFolder) return;
        const newMetadata = { ...metadata, settings: { ...metadata.settings, ...settings } };
        setMetadata(newMetadata);
        lastSaveTime.current = Date.now();
        await window.tauriAPI.saveMetadata({ rootPath: baseFolder, metadata: newMetadata });
    }, [baseFolder, metadata]);

    const isNotePinned = useCallback((note: Note) => (metadata.pinnedNotes?.includes(getNoteId(note)) || false), [getNoteId, metadata.pinnedNotes]);

    /**
     * --- DERIVED STATE: FILTERING & SORTING ---
     */

    /**
     * --- STICKY SELECTION ---
     * Derived selectedNote object. 
     * We keep the last valid note object in a ref so if the 'notes' array 
     * is temporarily empty (polling/sync), the editor doesn't unmount.
     */
    const lastValidSelectedNote = useRef<Note | null>(null);
    const selectedNote = notes.find(n => getNoteId(n) === selectedNoteId) || lastValidSelectedNote.current;

    // Update the sticky ref whenever we find the selected note in the actual list
    if (selectedNote && (!lastValidSelectedNote.current || getNoteId(selectedNote) !== getNoteId(lastValidSelectedNote.current) || selectedNote.content !== lastValidSelectedNote.current.content)) {
        lastValidSelectedNote.current = selectedNote;
    }

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
     * Auto-deselect: If the active note disappears from the ENTIRE disk (e.g. deleted elsewhere),
     * we clear the selection. We check allNotes instead of filteredNotes to ensure
     * that searching or temporary renaming transitions don't unmount the editor.
     */
    /**
     * Remove auto-deselect. We want the selection to be sticky
     * so that background refreshes don't unmount the editor.
     * deselecting should only happen explicitly via UI.
     */

    return {
        currentFolder: baseFolder,
        notes: filteredNotes,
        allNotes: notes,
        folders,
        metadata,
        selectedNoteId,
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
        triggerSync,
        startGitHubOnboarding,
        completeGitHubOnboarding,
        setupDefaultWorkspace,
        clearGithubCredentials: window.tauriAPI.clearGithubCredentials,
        isSyncing,
        syncStatus,
        syncError,
        lastSyncedAt,
        conflictPairs,
        resetSyncStatus,
        getNoteId,
        isLoading
    };
}

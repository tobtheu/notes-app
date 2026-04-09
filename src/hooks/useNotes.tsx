import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from '@electric-sql/pglite-react';
import type { Note, AppMetadata, FolderMetadata } from '../types';
import { normalizeStr, getPathId } from '../utils/path';
import { getDb, startElectricSync, stopElectricSync } from '../lib/electric';
import { supabase, setSupabaseSession, clearSupabaseSession } from '../lib/supabaseClient';
import { enqueue, flushQueue, hasPendingWrites } from '../lib/offlineQueue';
import type { PGlite } from '@electric-sql/pglite';

// ---------------------------------------------------------------------------
// Sync status type
// ---------------------------------------------------------------------------

export type SyncStatus =
  | 'initialising'   // PGlite loading / first sync
  | 'synced'         // Connected, Electric shapes active
  | 'offline'        // No network
  | 'pending'        // Has unsynced local writes
  | 'error'          // Auth or connection error
  | 'unauthenticated'; // Not signed in

// ---------------------------------------------------------------------------
// Helper: derive Note from a DB row
// ---------------------------------------------------------------------------

function rowToNote(row: {
  id: string;
  content: string;
  updated_at: string;
}): Note {
  // id is the normalized path e.g. "work/my-note.md"
  const lastSlash = row.id.lastIndexOf('/');
  const filename = lastSlash >= 0 ? row.id.slice(lastSlash + 1) : row.id;
  const folder = lastSlash >= 0 ? row.id.slice(0, lastSlash) : '';
  return { filename, folder, content: row.content, updatedAt: row.updated_at };
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useNotes() {
  // ── Auth ────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('initialising');
  const [syncError, setSyncError] = useState<string | null>(null);

  // ── Local UI state ───────────────────────────────────────────────────────
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Db ref — set once PGlite is ready
  const dbRef = useRef<PGlite | null>(null);

  // ── Initialise PGlite + restore session ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const db = await getDb();
        if (cancelled) return;
        dbRef.current = db;

        // Restore stored Supabase session from Tauri secure store
        const stored = await window.tauriAPI.getSupabaseCredentials().catch(() => null);
        if (!stored) {
          setSyncStatus('unauthenticated');
          return;
        }

        // Wire up supabase-js client with the stored tokens
        await setSupabaseSession(stored.accessToken, stored.refreshToken);
        setUserId(stored.userId);
        setUserEmail(stored.email);

        // Start Electric shapes — real-time sync begins here
        if (!navigator.onLine) {
          setSyncStatus('offline');
        } else {
          setSyncStatus('synced');
        }
        await startElectricSync(stored.userId, stored.accessToken);

        // Flush any writes that accumulated while offline
        if (navigator.onLine) await flushQueue(db);
      } catch (err) {
        if (!cancelled) {
          setSyncError(String(err));
          setSyncStatus('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Network reconnect → flush queue ──────────────────────────────────────
  useEffect(() => {
    const handleOnline = async () => {
      if (!dbRef.current || !userId) return;
      setSyncStatus('synced');
      await flushQueue(dbRef.current);
    };
    const handleOffline = () => setSyncStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId]);

  // ── Live queries — Notes ──────────────────────────────────────────────────
  const notesQuery = useLiveQuery<{
    id: string; content: string; updated_at: string;
  }>(
    userId
      ? `SELECT id, content, updated_at
           FROM notes
          WHERE user_id = $1 AND deleted = 0
          ORDER BY updated_at DESC`
      : null,
    userId ? [userId] : undefined,
  );

  // ── Live queries — Folders ────────────────────────────────────────────────
  const foldersQuery = useLiveQuery<{ folder: string }>(
    userId
      ? `SELECT DISTINCT
               CASE
                 WHEN instr(id, '/') > 0 THEN substr(id, 1, instr(id, '/') - 1)
                 ELSE ''
               END AS folder
           FROM notes
          WHERE user_id = $1 AND deleted = 0 AND instr(id, '/') > 0
          ORDER BY folder ASC`
      : null,
    userId ? [userId] : undefined,
  );

  // ── Live queries — App Config ─────────────────────────────────────────────
  const configQuery = useLiveQuery<{ metadata: string }>(
    userId
      ? `SELECT metadata FROM app_config WHERE user_id = $1`
      : null,
    userId ? [userId] : undefined,
  );

  // Derived state from queries
  const rawNotes = notesQuery?.rows ?? [];
  const notes: Note[] = rawNotes.map(rowToNote);

  const folders: string[] = (foldersQuery?.rows ?? [])
    .map(r => r.folder)
    .filter(Boolean);

  const metadata: AppMetadata = (() => {
    const row = configQuery?.rows?.[0];
    if (!row) return { folders: {}, pinnedNotes: [] };
    try {
      return JSON.parse(row.metadata) as AppMetadata;
    } catch {
      return { folders: {}, pinnedNotes: [] };
    }
  })();

  // Apply folder order from metadata
  const sortedFolders = [...folders].sort((a, b) => {
    const order = metadata.folderOrder ?? [];
    const orderNorm = order.map(f => normalizeStr(f));
    const idxA = orderNorm.indexOf(normalizeStr(a));
    const idxB = orderNorm.indexOf(normalizeStr(b));
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  // ── Note ID helper ────────────────────────────────────────────────────────

  const getNoteId = useCallback((note: Note) => {
    return getPathId(note.filename, note.folder ?? '');
  }, []);

  // ── Pending writes indicator ──────────────────────────────────────────────

  const pendingQuery = useLiveQuery<{ count: number }>(
    `SELECT COUNT(*) AS count FROM pending_writes`,
  );
  const hasPending = (pendingQuery?.rows?.[0]?.count ?? 0) > 0;

  useEffect(() => {
    if (syncStatus === 'synced' || syncStatus === 'offline') {
      setSyncStatus(hasPending && navigator.onLine ? 'pending' : syncStatus);
    }
  }, [hasPending, syncStatus]);

  // ── File Mirror ───────────────────────────────────────────────────────────
  // Write .md files to the filesystem whenever notes change in PGlite.
  // Files are a read-only mirror for external tools (Finder, Obsidian, etc.)
  const mirrorWrittenRef = useRef<Map<string, string>>(new Map()); // id → last written content

  useEffect(() => {
    if (!notes.length) return;
    const mirrorFolder = localStorage.getItem('notes-folder');
    if (!mirrorFolder) return;

    notes.forEach(note => {
      const id = getNoteId(note);
      const lastWritten = mirrorWrittenRef.current.get(id);
      if (lastWritten === note.content) return; // No change, skip

      mirrorWrittenRef.current.set(id, note.content);
      window.tauriAPI.writeMirrorFile({ mirrorFolder, note }).catch(err => {
        console.warn('[mirror] Failed to write', id, err);
      });
    });
  }, [notes, getNoteId]);

  // ── Core note write helper ────────────────────────────────────────────────

  const writeNote = useCallback(async (
    id: string,
    content: string,
    updatedAt: string,
    deleted = false,
  ) => {
    if (!userId || !dbRef.current) return;
    const db = dbRef.current;

    // 1. Write to PGlite immediately (offline-first, UI reacts instantly)
    await db.query(
      /* sql */ `
      INSERT INTO notes (id, user_id, content, updated_at, deleted)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id, user_id) DO UPDATE SET
        content    = EXCLUDED.content,
        updated_at = EXCLUDED.updated_at,
        deleted    = EXCLUDED.deleted
      `,
      [id, userId, content, updatedAt, deleted ? 1 : 0],
    );

    // 2. Enqueue for Supabase flush
    await enqueue(db, 'notes', 'upsert', {
      id,
      user_id: userId,
      content,
      updated_at: updatedAt,
      deleted,
    });

    // 3. Flush immediately if online
    if (navigator.onLine) {
      flushQueue(db).catch(console.error);
    }
  }, [userId]);

  // ── Core config write helper ──────────────────────────────────────────────

  const writeConfig = useCallback(async (newMetadata: AppMetadata) => {
    if (!userId || !dbRef.current) return;
    const db = dbRef.current;
    const updatedAt = new Date().toISOString();
    const metaJson = JSON.stringify(newMetadata);

    await db.query(
      /* sql */ `
      INSERT INTO app_config (user_id, metadata, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        metadata   = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
      `,
      [userId, metaJson, updatedAt],
    );

    await enqueue(db, 'app_config', 'upsert', {
      user_id: userId,
      metadata: newMetadata,
      updated_at: updatedAt,
    });

    if (navigator.onLine) flushQueue(db).catch(console.error);
  }, [userId]);

  // ── CRUD — Notes ──────────────────────────────────────────────────────────

  const savingNotes = useRef<Record<string, Promise<string> | undefined>>({});

  /**
   * saveNote — auto-rename based on first line title, then persist.
   * Returns the final note ID (may differ if renamed).
   */
  const saveNote = useCallback(async (
    currentId: string,
    filename: string,
    content: string,
    folder: string | null = null,
    skipRename = false,
  ): Promise<string> => {
    if (!userId) return currentId;

    // Serialize saves for the same note to avoid races
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

      // If renamed: soft-delete old id, write new id
      if (newId !== currentId && !skipRename) {
        const currentNote = notes.find(n => getNoteId(n) === currentId);
        if (currentNote) {
          // Check for collision
          const collision = notes.some(n =>
            getNoteId(n) === newId && getNoteId(n) !== currentId,
          );
          if (!collision) {
            await writeNote(currentId, currentNote.content, updatedAt, true);
            await writeNote(newId, content, updatedAt, false);

            // Migrate pins
            if (metadata.pinnedNotes?.some(p => normalizeStr(p) === currentId)) {
              const newMeta = { ...metadata };
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
  }, [userId, notes, getNoteId, metadata, selectedNoteId, writeNote, writeConfig]);

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
  }, [userId, notes, selectedCategory, writeNote]);

  const deleteNote = useCallback(async (id: string) => {
    const normalizedId = normalizeStr(id);
    const updatedAt = new Date().toISOString();
    const note = notes.find(n => getNoteId(n) === normalizedId);
    if (!note) return;

    await writeNote(normalizedId, note.content, updatedAt, true);

    // Delete mirror file
    const mirrorFolder = localStorage.getItem('notes-folder');
    if (mirrorFolder) {
      window.tauriAPI.deleteMirrorFile({ mirrorFolder, noteId: normalizedId }).catch(() => {});
    }

    if (selectedNoteId === normalizedId) setSelectedNoteId(null);
  }, [notes, getNoteId, selectedNoteId, writeNote]);

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
  }, [userId]);

  const moveNote = useCallback(async (noteId: string, targetFolder: string | null) => {
    const note = notes.find(n => getNoteId(n) === noteId);
    if (!note || note.folder === (targetFolder ?? '')) return;

    const newId = getPathId(note.filename, targetFolder ?? '');
    const updatedAt = new Date().toISOString();

    // Check collision
    if (notes.some(n => getNoteId(n) === newId)) return;

    await writeNote(noteId, note.content, updatedAt, true);
    await writeNote(newId, note.content, updatedAt, false);

    // Migrate pins
    if (metadata.pinnedNotes?.some(p => normalizeStr(p) === noteId)) {
      const newMeta = { ...metadata };
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
  }, [notes, getNoteId, metadata, selectedNoteId, writeNote, writeConfig]);

  // ── CRUD — Folders ────────────────────────────────────────────────────────

  const createFolder = useCallback(async (folderName: string) => {
    const mirrorFolder = localStorage.getItem('notes-folder');
    if (mirrorFolder) {
      await window.tauriAPI.createFolder(mirrorFolder, `${mirrorFolder}/${folderName}`);
    }
    const order = metadata.folderOrder ?? [];
    if (!order.some(f => normalizeStr(f) === normalizeStr(folderName))) {
      await writeConfig({ ...metadata, folderOrder: [...order, folderName] });
    }
  }, [metadata, writeConfig]);

  const deleteFolder = useCallback(async (folderRelative: string, mode: 'recursive' | 'move') => {
    const normalizedTarget = normalizeStr(folderRelative);

    // Soft-delete all notes in folder
    const folderNotes = notes.filter(n => normalizeStr(n.folder) === normalizedTarget);
    const updatedAt = new Date().toISOString();
    await Promise.all(folderNotes.map(n => writeNote(getNoteId(n), n.content, updatedAt, true)));

    // Delete mirror folder
    const mirrorFolder = localStorage.getItem('notes-folder');
    if (mirrorFolder) {
      const folderAbs = `${mirrorFolder}/${folderRelative}`;
      if (mode === 'recursive') {
        window.tauriAPI.deleteFolderRecursive(mirrorFolder, folderAbs).catch(() => {});
      } else {
        window.tauriAPI.deleteFolderMoveContents({ folderPath: folderAbs, rootPath: mirrorFolder }).catch(() => {});
      }
    }

    const newMeta = { ...metadata };
    const existingKey = Object.keys(newMeta.folders).find(k => normalizeStr(k) === normalizedTarget);
    if (existingKey) delete newMeta.folders[existingKey];
    if (newMeta.folderOrder) newMeta.folderOrder = newMeta.folderOrder.filter(f => normalizeStr(f) !== normalizedTarget);
    if (newMeta.pinnedNotes) {
      const prefix = `${normalizedTarget}/`;
      newMeta.pinnedNotes = newMeta.pinnedNotes.filter(p => !normalizeStr(p).startsWith(prefix));
    }
    await writeConfig(newMeta);

    if (selectedCategory === folderRelative) setSelectedCategory(null);
  }, [notes, getNoteId, metadata, selectedCategory, writeNote, writeConfig]);

  const renameFolder = useCallback(async (oldName: string, newName: string) => {
    const normalizedOld = normalizeStr(oldName);
    const normalizedNew = normalizeStr(newName);
    const updatedAt = new Date().toISOString();

    // Re-id all notes in the folder
    const folderNotes = notes.filter(n => normalizeStr(n.folder) === normalizedOld);
    await Promise.all(folderNotes.map(async n => {
      const oldId = getNoteId(n);
      const newId = getPathId(n.filename, newName);
      await writeNote(oldId, n.content, updatedAt, true);
      await writeNote(newId, n.content, updatedAt, false);
    }));

    // Rename mirror folder
    const mirrorFolder = localStorage.getItem('notes-folder');
    if (mirrorFolder) {
      window.tauriAPI.renameFolder({ rootPath: mirrorFolder, oldName, newName }).catch(() => {});
    }

    const newMeta = { ...metadata };
    const existingKey = Object.keys(newMeta.folders).find(k => normalizeStr(k) === normalizedOld);
    if (existingKey) {
      newMeta.folders[newName] = newMeta.folders[existingKey];
      if (existingKey !== newName) delete newMeta.folders[existingKey];
    }
    if (newMeta.pinnedNotes) {
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

    if (selectedCategory === oldName) setSelectedCategory(newName);
    return { success: true };
  }, [notes, getNoteId, metadata, selectedCategory, writeNote, writeConfig]);

  const reorderFolders = useCallback(async (newOrder: string[]) => {
    const currentOrder = metadata.folderOrder ?? sortedFolders;
    const newOrderNorm = newOrder.map(f => normalizeStr(f));
    const merged = [...newOrder];
    currentOrder.forEach(f => {
      if (!newOrderNorm.includes(normalizeStr(f))) merged.push(f);
    });
    await writeConfig({ ...metadata, folderOrder: merged });
  }, [metadata, sortedFolders, writeConfig]);

  // ── Metadata helpers ──────────────────────────────────────────────────────

  const togglePinNote = useCallback(async (note: Note) => {
    const notePath = getNoteId(note);
    const pinned = (metadata.pinnedNotes ?? []).map(p => normalizeStr(p));
    const newPins = pinned.includes(notePath)
      ? pinned.filter(p => p !== notePath)
      : [...pinned, notePath];
    await writeConfig({ ...metadata, pinnedNotes: newPins });
  }, [getNoteId, metadata, writeConfig]);

  const updateFolderMetadata = useCallback(async (folderName: string, meta: FolderMetadata) => {
    const normalizedTarget = normalizeStr(folderName);
    const existingKey = Object.keys(metadata.folders).find(k => normalizeStr(k) === normalizedTarget);
    const keyToUse = existingKey ?? folderName;
    const newMeta = { ...metadata };
    newMeta.folders[keyToUse] = { ...newMeta.folders[keyToUse], ...meta };
    await writeConfig(newMeta);
  }, [metadata, writeConfig]);

  const saveSettings = useCallback(async (settings: any) => {
    await writeConfig({ ...metadata, settings: { ...metadata.settings, ...settings } });
  }, [metadata, writeConfig]);

  const isNotePinned = useCallback(
    (note: Note) => (metadata.pinnedNotes ?? []).includes(getNoteId(note)),
    [getNoteId, metadata.pinnedNotes],
  );

  // ── Auth ──────────────────────────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await window.tauriAPI.supabaseSignIn(email, password);
    const creds = await window.tauriAPI.getSupabaseCredentials();
    if (creds) {
      await setSupabaseSession(creds.accessToken, creds.refreshToken);
      setUserId(result.userId);
      setUserEmail(result.email);
      const db = await getDb();
      dbRef.current = db;
      await startElectricSync(result.userId, creds.accessToken);
      setSyncStatus('synced');
      if (navigator.onLine) await flushQueue(db);
    }
    return result;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await window.tauriAPI.supabaseSignUp(email, password);
    const creds = await window.tauriAPI.getSupabaseCredentials();
    if (creds) {
      await setSupabaseSession(creds.accessToken, creds.refreshToken);
      setUserId(result.userId);
      setUserEmail(result.email);
      const db = await getDb();
      dbRef.current = db;
      await startElectricSync(result.userId, creds.accessToken);
      setSyncStatus('synced');
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await window.tauriAPI.supabaseSignOut();
    await clearSupabaseSession();
    stopElectricSync();
    setUserId(null);
    setUserEmail(null);
    setSyncStatus('unauthenticated');
  }, []);

  // ── Workspace setup ───────────────────────────────────────────────────────

  const setupDefaultWorkspace = useCallback(async (updateState = true) => {
    const docDir = await window.tauriAPI.getDocumentDir();
    const defaultPath = `${docDir}/Lama Notes`.replace(/\\/g, '/');
    await window.tauriAPI.createFolder(docDir, defaultPath);
    if (updateState) {
      localStorage.setItem('notes-folder', defaultPath);
    }
    return defaultPath;
  }, []);

  const selectFolder = useCallback(async () => {
    const folder = await window.tauriAPI.selectFolder();
    if (folder) {
      localStorage.setItem('notes-folder', folder);
    }
  }, []);

  // ── Derived state — filtering & sorting ───────────────────────────────────

  const lastValidSelectedNote = useRef<Note | null>(null);
  const selectedNote = selectedNoteId
    ? (notes.find(n => getNoteId(n) === selectedNoteId) ?? lastValidSelectedNote.current)
    : null;

  if (selectedNote && (!lastValidSelectedNote.current
    || getNoteId(selectedNote) !== getNoteId(lastValidSelectedNote.current)
    || selectedNote.content !== lastValidSelectedNote.current.content)) {
    lastValidSelectedNote.current = selectedNote;
  }
  if (!selectedNoteId) lastValidSelectedNote.current = null;

  const isLoading = syncStatus === 'initialising';

  const filteredNotes = notes
    .filter(note => {
      const searchLower = searchTerm.toLowerCase();
      if (searchTerm && !note.content.toLowerCase().includes(searchLower) && !note.filename.toLowerCase().includes(searchLower)) return false;
      if (selectedCategory && normalizeStr(note.folder) !== normalizeStr(selectedCategory)) return false;
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

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    // State
    notes: filteredNotes,
    allNotes: notes,
    folders: sortedFolders,
    metadata,
    selectedNoteId,
    selectedNote,
    selectedCategory,
    searchTerm,
    isLoading,
    syncStatus,
    syncError,
    hasPending,
    userId,
    userEmail,
    currentFolder: localStorage.getItem('notes-folder'),

    // Setters
    setSelectedNote: setSelectedNoteId,
    setSelectedCategory,
    setSearchTerm,

    // Note actions
    saveNote,
    updateNoteLocally,
    createNote,
    deleteNote,
    moveNote,
    getNoteId,

    // Folder actions
    createFolder,
    deleteFolder,
    renameFolder,
    reorderFolders,

    // Metadata
    togglePinNote,
    updateFolderMetadata,
    saveSettings,
    isNotePinned,

    // Auth
    signIn,
    signUp,
    signOut,

    // Workspace
    selectFolder,
    setupDefaultWorkspace,

    // Legacy compatibility (no-ops or re-mapped)
    reloadNotes: async () => {},
    triggerSync: async () => { if (dbRef.current) await flushQueue(dbRef.current); },
    isSyncing: syncStatus === 'initialising',
    lastSyncedAt: null as Date | null,
    conflictPairs: [] as { original: string; conflictCopy: string }[],
    resetSyncStatus: () => setSyncStatus(navigator.onLine ? 'synced' : 'offline'),
    clearGithubCredentials: window.tauriAPI.clearGithubCredentials,
  };
}

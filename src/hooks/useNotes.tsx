import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLiveQuery } from '@electric-sql/pglite-react';
import type { Note, SyncStatus } from '../types';
import { getPathId, normalizeStr } from '../utils/path';
import { flushQueue } from '../lib/offlineQueue';
import type { PGliteWithLive } from '@electric-sql/pglite/live';

import { useNotesAuth } from './useNotesAuth';
import { useNotesWorkspace } from './useNotesWorkspace';
import { useNotesOperations } from './useNotesOperations';
import { useNotesInit } from './useNotesInit';
import { useNotesFilter } from './useNotesFilter';
import { useNotesConfig } from './useNotesConfig';
import { useNotesDbWriter } from './useNotesDbWriter';

export type { SyncStatus };

// Helper: derive Note from a DB row
function rowToNote(row: {
  id: string;
  content: string;
  updated_at: string;
}): Note {
  const lastSlash = row.id.lastIndexOf('/');
  const filename = lastSlash >= 0 ? row.id.slice(lastSlash + 1) : row.id;
  const folder = lastSlash >= 0 ? row.id.slice(0, lastSlash) : '';
  return { filename, folder, content: row.content, updatedAt: row.updated_at };
}

export function useNotes() {
  // ── Auth ────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem('lama-user-id'));
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem('lama-user-email'));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    localStorage.getItem('lama-user-id') ? 'synced' : 'initialising',
  );
  const [syncError, setSyncError] = useState<string | null>(null);

  // ── Local UI state ───────────────────────────────────────────────────────
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string | null>(() => localStorage.getItem('notes-folder'));

  const dbRef = useRef<PGliteWithLive | null>(null);

  // ── Initialise PGlite + restore session + network listeners ─────────────
  useNotesInit({
    dbRef,
    userId,
    setUserId,
    setUserEmail,
    setSyncStatus,
    setSyncError,
  });

  // ── Live queries — Notes ──────────────────────────────────────────────────
  const notesQuery = useLiveQuery<{
    id: string; content: string; updated_at: string;
  }>(
    userId
      ? `SELECT id, content, updated_at FROM notes WHERE user_id = $1 AND deleted = false ORDER BY updated_at DESC`
      : `SELECT id, content, updated_at FROM notes WHERE 1=0`,
    userId ? [userId] : [],
  );

  // ── Live queries — Folders ────────────────────────────────────────────────
  const foldersQuery = useLiveQuery<{ folder: string }>(
    userId
      ? `SELECT DISTINCT
               CASE
                 WHEN strpos(id, '/') > 0 THEN substring(id, 1, strpos(id, '/') - 1)
                 ELSE ''
               END AS folder
           FROM notes
          WHERE user_id = $1 AND deleted = false AND strpos(id, '/') > 0
          ORDER BY folder ASC`
      : `SELECT '' AS folder WHERE 1=0`,
    userId ? [userId] : [],
  );

  // ── Live queries — Trash Notes ────────────────────────────────────────────
  const trashQuery = useLiveQuery<{
    id: string; content: string; updated_at: string;
  }>(
    userId
      ? `SELECT id, content, updated_at FROM notes WHERE user_id = $1 AND deleted = true ORDER BY updated_at DESC`
      : `SELECT id, content, updated_at FROM notes WHERE 1=0`,
    userId ? [userId] : [],
  );

  const trashNotes = useMemo(() => {
    return trashQuery?.rows?.map(rowToNote) ?? [];
  }, [trashQuery?.rows]);

  // ── App Config & Metadata Sync ───────────────────────────────────────────
  const { metadata, metadataRef, writeConfig } = useNotesConfig({ dbRef, userId });

  // Note ID helper
  const getNoteId = useCallback((note: Note) => {
    return getPathId(note.filename, note.folder);
  }, []);

  // Pending writes indicator
  const pendingQuery = useLiveQuery<{ count: number }>(
    `SELECT COUNT(*) AS count FROM pending_writes`,
  );
  const hasPending = (pendingQuery?.rows?.[0]?.count ?? 0) > 0;

  useEffect(() => {
    if (syncStatus === 'error' || syncStatus === 'initialising' || syncStatus === 'unauthenticated') return;
    if (hasPending && navigator.onLine) {
      setSyncStatus('pending');
    } else {
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    }
  }, [hasPending, syncStatus]);

  // ── Notes memoization directly from PGlite Live Query ───────────────────────
  const notes = useMemo(() => {
    return notesQuery?.rows?.map(rowToNote) ?? [];
  }, [notesQuery?.rows]);

  // ── Core note write helper ────────────────────────────────────────────────
  const { writeNote } = useNotesDbWriter({ dbRef, userId });

  // ── Combined folders from metadata.folderOrder + notes + metadata.folders ─
  const folders = useMemo(() => {
    const ordered = metadata.folderOrder ?? [];
    const fromNotes = foldersQuery?.rows?.map((r) => r.folder).filter(Boolean) ?? [];
    const fromMeta = Object.keys(metadata.folders || {}).filter(Boolean);

    const allSources = [...ordered, ...fromNotes, ...fromMeta];
    const result: string[] = [];
    const seenNormalized = new Set<string>();

    for (const f of allSources) {
      const trimmed = f.trim();
      if (!trimmed) continue;
      const norm = normalizeStr(trimmed);
      if (!seenNormalized.has(norm)) {
        seenNormalized.add(norm);
        result.push(trimmed);
      }
    }

    return result;
  }, [foldersQuery?.rows, metadata.folders, metadata.folderOrder]);

  // ── Filter & Search hook ──────────────────────────────────────────────────
  const {
    filteredNotes,
    selectedNote,
    isNotePinned,
  } = useNotesFilter({
    notes,
    searchTerm,
    selectedCategory,
    selectedNoteId,
    metadata,
    getNoteId,
  });

  // ── Workspace Operations ──────────────────────────────────────────────────
  const {
    selectFolder,
    setupDefaultWorkspace,
    importFolder,
    importFiles,
    exportBackup,
    resetDatabase,
    goLocalOnly,
  } = useNotesWorkspace({
    dbRef,
    userId,
    setUserId,
    setCurrentFolder,
    setSyncStatus,
    writeNote,
  });

  // ── Note & Folder & Trash Operations ──────────────────────────────────────
  const {
    saveNote,
    createNote,
    deleteNote,
    createFolder,
    deleteFolder,
    renameFolder,
    reorderFolders,
    updateFolderMetadata,
    saveSettings,
    moveNote,
    togglePinNote,
    updateNoteLocally,
    restoreNote,
    permanentlyDeleteNote,
    emptyTrash,
  } = useNotesOperations({
    dbRef,
    userId,
    notes,
    sortedFolders: folders,
    metadata,
    metadataRef,
    writeNote,
    writeConfig,
    selectedCategory,
    setSelectedCategory,
    selectedNoteId,
    setSelectedNoteId,
    getNoteId,
  });

  // ── Auth Operations ───────────────────────────────────────────────────────
  const {
    signIn,
    signUp,
    signOut,
    deleteAccount,
  } = useNotesAuth({
    dbRef,
    userId,
    setUserId,
    setUserEmail,
    setSyncStatus,
    setSyncError,
  });

  const triggerSync = useCallback(async () => {
    if (!dbRef.current || !userId) return;
    await flushQueue(dbRef.current);
  }, [userId]);

  const isLoading = syncStatus === 'initialising';

  return {
    allNotes: notes,
    notes: filteredNotes,
    folders,
    metadata,
    currentFolder,
    selectedCategory,
    isLoading,
    selectFolder,
    createNote,
    saveNote,
    deleteNote,
    createFolder,
    deleteFolder,
    renameFolder,
    updateFolderMetadata,
    reorderFolders,
    saveSettings,
    selectedNote,
    setSelectedNote: setSelectedNoteId,
    setSelectedCategory,
    updateNoteLocally,
    moveNote,
    togglePinNote,
    isNotePinned,
    getNoteId,
    searchTerm,
    setSearchTerm,
    triggerSync,
    syncStatus,
    syncError,
    hasPending,
    setupDefaultWorkspace,
    signIn,
    signUp,
    signOut,
    deleteAccount,
    userId,
    userEmail,
    importFolder,
    importFiles,
    exportBackup,
    resetDatabase,
    goLocalOnly,
    trashNotes,
    restoreNote,
    permanentlyDeleteNote,
    emptyTrash,
  };
}

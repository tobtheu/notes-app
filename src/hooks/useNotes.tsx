import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLiveQuery } from '@electric-sql/pglite-react';
import type { Note, SyncStatus } from '../types';
import { normalizeStr, getPathId } from '../utils/path';
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
    setSelectedNoteId,
    metadata,
    getNoteId,
  });

  // ── Workspace Operations ──────────────────────────────────────────────────
  const {
    isLoading,
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
    setCurrentFolder,
    writeConfig,
    setSyncStatus,
    setUserId,
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
    metadata,
    metadataRef,
    writeNote,
    writeConfig,
    selectedCategory,
    setSelectedCategory,
    setSelectedNoteId,
    getNoteId,
  });

  // ── Auth Operations ───────────────────────────────────────────────────────
  const {
    signIn,
    signUp,
    signOut,
    deleteAccount,
    triggerSync,
  } = useNotesAuth({
    dbRef,
    setUserId,
    setUserEmail,
    setSyncStatus,
    setSyncError,
    setCurrentFolder,
    setupDefaultWorkspace,
  });

  // ── Combined folders from notes + metadata ─────────────────────────────────
  const folders = useMemo(() => {
    const fromNotes = foldersQuery?.rows?.map((r) => r.folder).filter(Boolean) ?? [];
    const fromMeta = Object.keys(metadata.folders || {});
    const combined = Array.from(new Set([...fromNotes, ...fromMeta]));

    if (metadata.folderOrder && Array.isArray(metadata.folderOrder)) {
      const order = metadata.folderOrder;
      combined.sort((a, b) => {
        const iA = order.indexOf(a);
        const iB = order.indexOf(b);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1;
        if (iB !== -1) return 1;
        return a.localeCompare(b);
      });
    } else {
      combined.sort();
    }
    return combined;
  }, [foldersQuery?.rows, metadata.folders, metadata.folderOrder]);

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

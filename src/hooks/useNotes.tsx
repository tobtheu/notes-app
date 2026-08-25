import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLiveQuery } from '@electric-sql/pglite-react';
import type { Note, AppMetadata, SyncStatus } from '../types';
import { sanitizeAppMetadata } from '../types';
import { normalizeStr, getPathId } from '../utils/path';
import { enqueue, flushQueue } from '../lib/offlineQueue';
import { log } from '../lib/logger';
import type { PGliteWithLive } from '@electric-sql/pglite/live';

import { useNotesAuth } from './useNotesAuth';
import { useNotesWorkspace } from './useNotesWorkspace';
import { useNotesOperations } from './useNotesOperations';
import { useNotesInit } from './useNotesInit';
import { useNotesFilter } from './useNotesFilter';

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
  const lastConfigWriteAt = useRef<string | null>(null);
  const metadataRef = useRef<AppMetadata>({ folders: {}, pinnedNotes: [] });

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

  // ── App Config ───────────────────────────────────────────────────────────
  const configQuery = useLiveQuery<{ metadata: string | AppMetadata; updated_at: string }>(
    userId
      ? `SELECT metadata, updated_at FROM app_config WHERE user_id = $1`
      : `SELECT '' AS metadata, '' AS updated_at WHERE 1=0`,
    userId ? [userId] : [],
  );

  const [metadata, setMetadataState] = useState<AppMetadata>(() => {
    try {
      const cached = localStorage.getItem('lama-metadata');
      return cached ? sanitizeAppMetadata(JSON.parse(cached)) : { folders: {}, pinnedNotes: [] };
    } catch {
      return { folders: {}, pinnedNotes: [] };
    }
  });

  // Reset metadata only when an active user changes to a DIFFERENT active user or signs out.
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (
      prevUserIdRef.current !== undefined &&
      prevUserIdRef.current !== null &&
      prevUserIdRef.current !== userId
    ) {
      setMetadataState({ folders: {}, pinnedNotes: [] });
      metadataRef.current = { folders: {}, pinnedNotes: [] };
      try { localStorage.removeItem('lama-metadata'); } catch {}
    }
    prevUserIdRef.current = userId;
  }, [userId]);

  const configRow = configQuery?.rows?.[0];
  const configUpdatedAt = configRow?.updated_at;
  const configMetadataRaw = configRow?.metadata;

  useEffect(() => {
    if (!configRow) return;
    const incomingAt = configRow.updated_at;
    // Skip if this is our own write echoing back (same or older timestamp)
    if (lastConfigWriteAt.current && incomingAt <= lastConfigWriteAt.current) return;
    // It's a remote change (or initial load) — apply it
    try {
      const m = configRow.metadata;
      const parsed = typeof m === 'string' ? JSON.parse(m) : m;
      const safeMetadata = sanitizeAppMetadata(parsed);
      setMetadataState(safeMetadata);
      metadataRef.current = safeMetadata;
      try { localStorage.setItem('lama-metadata', JSON.stringify(safeMetadata)); } catch {}
    } catch { /* ignore parse errors */ }
  }, [configUpdatedAt, configMetadataRaw]);

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
  const NOTE_SIZE_LIMIT = 5 * 1024 * 1024;

  const writeNote = useCallback(async (
    id: string,
    content: string,
    updatedAt: string,
    deleted = false,
  ) => {
    if (!userId || !dbRef.current) return;
    const db = dbRef.current;

    if (!deleted && (content.length > 2_500_000 && new Blob([content]).size > NOTE_SIZE_LIMIT)) {
      log.warn(`[useNotes:writeNote] note ${id} exceeds 5MB size limit — write blocked`);
      throw new Error('Note is too large (max. 5 MB). Please shorten the content.');
    }

    const existing = await db.query<{ updated_at: string }>(
      `SELECT updated_at FROM notes WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    let finalUpdatedAt = updatedAt;
    if (existing.rows.length > 0) {
      const existingTime = new Date(existing.rows[0].updated_at).getTime();
      const localTime = new Date(updatedAt).getTime();
      if (existingTime >= localTime) {
        finalUpdatedAt = new Date(existingTime + 1).toISOString();
      }
    }

    await db.query(
      /* sql */ `
      INSERT INTO notes (id, user_id, content, updated_at, deleted)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id, user_id) DO UPDATE SET
        content    = EXCLUDED.content,
        updated_at = EXCLUDED.updated_at,
        deleted    = EXCLUDED.deleted
      `,
      [id, userId, content, finalUpdatedAt, deleted],
    );

    await enqueue(db, 'notes', 'upsert', {
      id,
      user_id: userId,
      content,
      updated_at: finalUpdatedAt,
      deleted,
    });

    if (navigator.onLine) {
      flushQueue(db).catch((e: unknown) => log.error(String(e)));
    }
  }, [userId]);

  // ── Core config write helper ──────────────────────────────────────────────
  const writeConfig = useCallback(async (newMetadata: AppMetadata) => {
    if (!userId || !dbRef.current) return;
    const db = dbRef.current;
    const updatedAt = new Date().toISOString();

    // Instant UI state update & local persistence
    setMetadataState(newMetadata);
    metadataRef.current = newMetadata;
    try { localStorage.setItem('lama-metadata', JSON.stringify(newMetadata)); } catch {}

    const existing = await db.query<{ updated_at: string }>(
      `SELECT updated_at FROM app_config WHERE user_id = $1`,
      [userId]
    );
    let finalUpdatedAt = updatedAt;
    if (existing.rows.length > 0) {
      const existingTime = new Date(existing.rows[0].updated_at).getTime();
      const localTime = new Date(updatedAt).getTime();
      if (existingTime >= localTime) {
        finalUpdatedAt = new Date(existingTime + 1).toISOString();
      }
    }

    lastConfigWriteAt.current = finalUpdatedAt;

    await db.query(
      /* sql */ `
      INSERT INTO app_config (user_id, metadata, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        metadata   = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
      `,
      [userId, JSON.stringify(newMetadata), finalUpdatedAt],
    );

    await enqueue(db, 'app_config', 'upsert', {
      user_id: userId,
      metadata: newMetadata,
      updated_at: finalUpdatedAt,
    });

    if (navigator.onLine) flushQueue(db).catch((e: unknown) => log.error(String(e)));
  }, [userId]);

  // ── Derived state — folder lists ──────────────────────────────────────────
  const sortedFolders = useMemo(() => {
    const active = foldersQuery?.rows?.map(r => r.folder) ?? [];
    const ordered = metadata.folderOrder ?? [];
    const result = [...ordered];
    const seenNormalized = new Set(ordered.map(normalizeStr));

    for (let i = 0; i < active.length; i++) {
      const f = active[i];
      const norm = normalizeStr(f);
      if (!seenNormalized.has(norm)) {
        seenNormalized.add(norm);
        result.push(f);
      }
    }
    return result;
  }, [foldersQuery?.rows, metadata.folderOrder]);

  // ── sub-hooks ─────────────────────────────────────────────────────────────
  const auth = useNotesAuth({
    dbRef,
    userId,
    setUserId,
    setUserEmail,
    setSyncStatus,
    setSyncError,
  });

  const workspace = useNotesWorkspace({
    dbRef,
    userId,
    setUserId,
    setCurrentFolder,
    setSyncStatus,
    writeNote
  });

  const operations = useNotesOperations({
    dbRef,
    userId,
    metadata,
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
  });

  const filter = useNotesFilter({
    notes,
    searchTerm,
    selectedCategory,
    selectedNoteId,
    metadata,
    getNoteId,
  });

  // Auto-cleanup: remove soft-deleted notes older than 30 days
  useEffect(() => {
    if (userId && dbRef.current) {
      operations.cleanExpiredTrashNotes().catch(e => log.error('[useNotes:autoCleanup] error:', e));
    }
  }, [userId, operations.cleanExpiredTrashNotes]);

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    notes: filter.filteredNotes,
    allNotes: notes,
    trashNotes,
    folders: sortedFolders,
    metadata,
    selectedNoteId,
    selectedNote: filter.selectedNote,
    selectedCategory,
    isLoading: syncStatus === 'initialising',
    setSelectedNote: setSelectedNoteId,
    setSelectedCategory,
    searchTerm,
    setSearchTerm,
    syncStatus,
    syncError,
    hasPending,
    userId,
    userEmail,
    currentFolder,
    getNoteId,
    isNotePinned: filter.isNotePinned,

    // Auth
    ...auth,

    // Workspace
    ...workspace,

    // Operations
    ...operations,

    // Sync helpers
    triggerSync: async () => { if (dbRef.current) await flushQueue(dbRef.current); },
    resetSyncStatus: () => setSyncStatus(navigator.onLine ? 'synced' : 'offline'),
  };
}

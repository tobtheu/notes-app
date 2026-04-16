import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLiveQuery } from '@electric-sql/pglite-react';
import type { Note, AppMetadata, FolderMetadata } from '../types';
import { normalizeStr, getPathId } from '../utils/path';
import { getDb, startElectricSync, stopElectricSync } from '../lib/electric';
import { setSupabaseSession, clearSupabaseSession } from '../lib/supabaseClient';
import { enqueue, flushQueue } from '../lib/offlineQueue';
import { log } from '../lib/logger';
import type { PGliteWithLive } from '@electric-sql/pglite/live';

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
// Folder scan helper — imports .md files not yet known to PGlite
// ---------------------------------------------------------------------------

/**
 * Scans the mirror folder and imports any .md files whose ID is not yet in PGlite.
 * Safe to call repeatedly — existing notes are never overwritten (ON CONFLICT DO NOTHING).
 * For cloud users, new notes are also enqueued for Supabase sync.
 */
async function scanAndImportNewFiles(
  db: PGliteWithLive,
  uid: string,
  folder: string,
): Promise<void> {
  try {
    const scanned = await (window.tauriAPI as any).scanImportFolder(folder) as
      { relPath: string; content: string; updatedAt: string }[];
    if (!scanned?.length) return;

    const { rows: existingRows } = await db.query<{ id: string }>(
      `SELECT id FROM notes WHERE user_id = $1 AND deleted = false`,
      [uid],
    );
    const existingIds = new Set(existingRows.map(r => r.id));

    let imported = 0;
    for (const file of scanned) {
      const parts = file.relPath.replace(/\\/g, '/').split('/');
      const filename = parts.pop() ?? file.relPath;
      const fileFolder = parts.join('/');
      const id = getPathId(filename, fileFolder);
      if (existingIds.has(id)) continue;

      const content = file.content.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart();
      await db.query(
        `INSERT INTO notes (id, user_id, content, updated_at, deleted)
         VALUES ($1, $2, $3, $4, false)
         ON CONFLICT (id, user_id) DO NOTHING`,
        [id, uid, content, file.updatedAt],
      );

      // For cloud users, also enqueue for Supabase sync
      if (uid !== 'local') {
        await enqueue(db, 'notes', 'upsert', {
          id, user_id: uid, content, updated_at: file.updatedAt, deleted: false,
        });
      }

      imported++;
    }

    if (imported > 0) {
      log.info(`[scanAndImportNewFiles] imported ${imported} new file(s) for user ${uid}`);
    }
  } catch (e) {
    log.warn('[scanAndImportNewFiles] error:', String(e));
  }
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export function useNotes() {
  // ── Auth ────────────────────────────────────────────────────────────────
  // Pre-seed userId from localStorage so live queries run immediately on mount,
  // before the async Tauri secure-store read completes. The async init will
  // validate/refresh the session and start Electric in the background.
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

  // Db ref — set once PGlite is ready
  const dbRef = useRef<PGliteWithLive | null>(null);

  // Tracks the updated_at of our last local config write.
  // Used to filter out Electric echoes of our own writes.
  const lastConfigWriteAt = useRef<string | null>(null);
  // Ref that always holds the latest metadata — avoids stale closures in callbacks
  const metadataRef = useRef<AppMetadata>({ folders: {}, pinnedNotes: [] });

  // ── Initialise PGlite + restore session ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        log.info('[useNotes:init] start — localStorage:', {
          'lama-mode': localStorage.getItem('lama-mode'),
          'lama-user-id': localStorage.getItem('lama-user-id'),
          'notes-folder': localStorage.getItem('notes-folder'),
        });

        const db = await getDb();
        log.info('[useNotes:init] PGlite ready');
        if (cancelled) return;
        dbRef.current = db;

        // Restore local-only mode if previously selected (no auth needed)
        if (localStorage.getItem('lama-mode') === 'local') {
          log.info('[useNotes:init] restoring local-only mode');
          setUserId('local');
          setSyncStatus('offline');

          const folder = localStorage.getItem('notes-folder');
          if (folder) await scanAndImportNewFiles(db, 'local', folder);
          return;
        }

        // Restore stored Supabase session from Tauri secure store
        log.info('[useNotes:init] reading Tauri secure store...');
        const stored = await window.tauriAPI.getSupabaseCredentials().catch((e: unknown) => {
          log.warn('[useNotes:init] getSupabaseCredentials failed:', e);
          return null;
        });
        if (!stored) {
          log.info('[useNotes:init] no stored credentials → unauthenticated');
          localStorage.removeItem('lama-user-id');
          localStorage.removeItem('lama-user-email');
          setSyncStatus('unauthenticated');
          return;
        }

        log.info('[useNotes:init] credentials found, userId:', stored.userId, 'email:', stored.email);

        // Wire up supabase-js client with the stored tokens
        await setSupabaseSession(stored.accessToken, stored.refreshToken);
        log.info('[useNotes:init] Supabase session set');
        setUserId(stored.userId);
        setUserEmail(stored.email);
        localStorage.setItem('lama-user-id', stored.userId);
        localStorage.setItem('lama-user-email', stored.email);

        // Start Electric shapes — real-time sync begins here
        if (!navigator.onLine) {
          log.info('[useNotes:init] offline → skipping Electric sync');
          setSyncStatus('offline');
        } else {
          log.info('[useNotes:init] online → starting Electric sync');
          setSyncStatus('synced');
        }
        await startElectricSync(stored.userId, stored.accessToken, (err) => {
          log.error('[useNotes] Electric sync error:', String(err));
          if (!cancelled) { setSyncStatus('error'); setSyncError(String(err)); }
        });
        log.info('[useNotes:init] Electric sync started');

        // Scan mirror folder for files added externally while the app was closed
        const mirrorFolder = localStorage.getItem('notes-folder');
        if (mirrorFolder) {
          log.info('[useNotes:init] scanning mirror folder for new files...');
          await scanAndImportNewFiles(db, stored.userId, mirrorFolder);
        }

        // Flush any writes that accumulated while offline
        if (navigator.onLine) {
          log.info('[useNotes:init] flushing offline queue...');
          await flushQueue(db);
          log.info('[useNotes:init] queue flushed');
        }
      } catch (err) {
        log.error('[useNotes:init] ERROR:', err);
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

  // ── File watcher — import new .md files added externally while app is open ─
  useEffect(() => {
    if (!userId || !currentFolder) return;

    // Start the Rust file watcher for the mirror folder
    window.tauriAPI.startWatch(currentFolder);

    // Subscribe to file-changed events and re-scan for new files.
    // Debounced so that copying many files at once triggers only one scan.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unlisten = window.tauriAPI.onFileChanged(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (!dbRef.current) return;
        await scanAndImportNewFiles(dbRef.current, userId, currentFolder);
        if (userId !== 'local' && navigator.onLine) {
          flushQueue(dbRef.current).catch((e: unknown) => log.error(String(e)));
        }
      }, 1500);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unlisten();
    };
  }, [userId, currentFolder]);

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

  // ── App Config — stable React state (not a live query) ───────────────────
  // Config is managed as plain React state to avoid Electric-driven re-renders.
  // Electric/PGlite changes are merged only when they're newer than our last write.
  const configQuery = useLiveQuery<{ metadata: string | AppMetadata; updated_at: string }>(
    userId
      ? `SELECT metadata, updated_at FROM app_config WHERE user_id = $1`
      : `SELECT '' AS metadata, '' AS updated_at WHERE 1=0`,
    userId ? [userId] : [],
  );

  const [metadata, setMetadataState] = useState<AppMetadata>({ folders: {}, pinnedNotes: [] });

  // Apply incoming config changes only when they're newer than our last local write.
  // This prevents Electric sync (confirming our own write, or old snapshots) from
  // causing visible flicker — only genuine remote changes (other device) come through.
  useEffect(() => {
    const row = configQuery?.rows?.[0];
    if (!row?.updated_at) return;
    const incomingAt = row.updated_at as string;
    // Skip if this is our own write echoing back (same or older timestamp)
    if (lastConfigWriteAt.current && incomingAt <= lastConfigWriteAt.current) return;
    // It's a remote change (or initial load) — apply it
    try {
      const m = row.metadata;
      const parsed = (typeof m === 'string' ? JSON.parse(m) : m) as AppMetadata;
      setMetadataState(parsed);
      metadataRef.current = parsed;
    } catch { /* ignore parse errors */ }
  }, [configQuery]);

  // Keep ref in sync for callback access without stale closures
  metadataRef.current = metadata;

  // Stable notes state — only re-renders when note IDs or content actually change.
  // Prevents Electric batch-sync events from causing multiple list re-renders.
  const [notes, setNotesState] = useState<Note[]>([]);
  const notesSignature = useRef<string>('');

  useEffect(() => {
    const rows = notesQuery?.rows ?? [];
    // Build a cheap signature to detect actual changes
    const sig = rows.map(r => `${r.id}:${r.updated_at}`).join('|');
    if (sig === notesSignature.current) return;
    notesSignature.current = sig;
    setNotesState(rows.map(rowToNote));
  }, [notesQuery]);

  const folders: string[] = (foldersQuery?.rows ?? [])
    .map(r => r.folder)
    .filter(Boolean);

  // Merge folders from notes + empty folders stored in folderOrder metadata.
  // Deduplicate by normalized name — folderOrder display name wins over the
  // lowercase name derived from note IDs (e.g. "Work" beats "work").
  const sortedFolders = useMemo(() => {
    const order = metadata.folderOrder ?? [];
    const orderNorm = order.map(f => normalizeStr(f));

    const seen = new Set<string>();
    const allFolders: string[] = [];

    for (const f of order) {
      const n = normalizeStr(f);
      if (!seen.has(n)) { seen.add(n); allFolders.push(f); }
    }
    for (const f of folders) {
      const n = normalizeStr(f);
      if (!seen.has(n)) { seen.add(n); allFolders.push(f); }
    }

    return allFolders.sort((a, b) => {
      const idxA = orderNorm.indexOf(normalizeStr(a));
      const idxB = orderNorm.indexOf(normalizeStr(b));
      if (idxA === -1 && idxB === -1) return a.localeCompare(b);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [metadata.folderOrder, folders]);

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
    if (syncStatus === 'error' || syncStatus === 'initialising' || syncStatus === 'unauthenticated') return;
    if (hasPending && navigator.onLine) {
      setSyncStatus('pending');
    } else {
      setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    }
  }, [hasPending]); // eslint-disable-line react-hooks/exhaustive-deps

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
        log.warn('[mirror] Failed to write', id, err);
      });
    });
  }, [notes, getNoteId]);

  // ── Core note write helper ────────────────────────────────────────────────

  // 5 MB soft limit — prevents unbounded queue entries and Supabase 413 errors
  const NOTE_SIZE_LIMIT = 5 * 1024 * 1024;

  const writeNote = useCallback(async (
    id: string,
    content: string,
    updatedAt: string,
    deleted = false,
  ) => {
    if (!userId || !dbRef.current) return;
    const db = dbRef.current;

    // Guard against oversized notes that would fail on Supabase (HTTP 413)
    if (!deleted && new Blob([content]).size > NOTE_SIZE_LIMIT) {
      log.warn(`[useNotes:writeNote] note ${id} exceeds 5MB size limit — write blocked`);
      throw new Error('Notiz ist zu groß (max. 5 MB). Bitte kürze den Inhalt.');
    }

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
      [id, userId, content, updatedAt, deleted],
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
      flushQueue(db).catch((e: unknown) => log.error(String(e)));
    }
  }, [userId]);

  // ── Core config write helper ──────────────────────────────────────────────

  const writeConfig = useCallback(async (newMetadata: AppMetadata) => {
    if (!userId || !dbRef.current) return;
    const db = dbRef.current;
    const updatedAt = new Date().toISOString();

    // Update local state immediately — no waiting for PGlite or Electric
    lastConfigWriteAt.current = updatedAt;
    setMetadataState(newMetadata);
    metadataRef.current = newMetadata;

    await db.query(
      /* sql */ `
      INSERT INTO app_config (user_id, metadata, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        metadata   = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
      `,
      [userId, JSON.stringify(newMetadata), updatedAt],
    );

    await enqueue(db, 'app_config', 'upsert', {
      user_id: userId,
      metadata: newMetadata,
      updated_at: updatedAt,
    });

    if (navigator.onLine) flushQueue(db).catch((e: unknown) => log.error(String(e)));
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

    // 1. Move notes first (old folder disappears, new folder appears in live query)
    const folderNotes = notes.filter(n => normalizeStr(n.folder) === normalizedOld);
    await Promise.all(folderNotes.map(async n => {
      const oldId = getNoteId(n);
      const newId = getPathId(n.filename, newName);
      await writeNote(oldId, n.content, updatedAt, true);
      await writeNote(newId, n.content, updatedAt, false);
    }));

    // 2. Update metadata after notes are moved
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

    // 3. Rename mirror folder
    const mirrorFolder = localStorage.getItem('notes-folder');
    if (mirrorFolder) {
      window.tauriAPI.renameFolder({ rootPath: mirrorFolder, oldName, newName }).catch(() => {});
    }

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
    // Use ref — always has latest metadata, no stale closure, no async read needed
    const current = metadataRef.current;
    const normalizedTarget = normalizeStr(folderName);
    const existingKey = Object.keys(current.folders ?? {}).find(k => normalizeStr(k) === normalizedTarget);
    const keyToUse = existingKey ?? folderName;
    const newMeta = { ...current, folders: { ...current.folders } };
    newMeta.folders[keyToUse] = { ...newMeta.folders[keyToUse], ...meta };
    await writeConfig(newMeta);
  }, [writeConfig]);

  const saveSettings = useCallback(async (settings: any) => {
    const current = metadataRef.current;
    await writeConfig({ ...current, settings: { ...current.settings, ...settings } });
  }, [writeConfig]);

  const isNotePinned = useCallback(
    (note: Note) => (metadata.pinnedNotes ?? []).includes(getNoteId(note)),
    [getNoteId, metadata.pinnedNotes],
  );

  // ── Auth ──────────────────────────────────────────────────────────────────

  /**
   * Migrates notes written under the 'local' user_id to the real Supabase userId.
   * Called after sign-in/sign-up when the user was previously in local-only mode.
   * The Electric conflict-resolution trigger (updated_at comparison) will handle
   * merging with any existing cloud notes once sync starts.
   */
  const migrateLocalNotes = useCallback(async (db: PGliteWithLive, realUserId: string) => {
    const { rows } = await db.query<{ id: string; content: string; updated_at: string }>(
      `SELECT id, content, updated_at FROM notes WHERE user_id = 'local' AND deleted = false`,
    );
    if (rows.length === 0) return;

    log.info(`[useNotes:migrateLocalNotes] migrating ${rows.length} local note(s) to`, realUserId);
    const updatedAt = new Date().toISOString();

    // Step 1: copy rows to the real userId in PGlite + enqueue for Supabase.
    // We do NOT delete the local rows yet — they stay as a safety backup until
    // the queue has been successfully flushed to Supabase (step 3).
    for (const row of rows) {
      await db.query(
        `INSERT INTO notes (id, user_id, content, updated_at, deleted)
         VALUES ($1, $2, $3, $4, false)
         ON CONFLICT (id, user_id) DO UPDATE SET
           content    = EXCLUDED.content,
           updated_at = EXCLUDED.updated_at
         WHERE CAST(EXCLUDED.updated_at AS timestamptz) >= CAST(notes.updated_at AS timestamptz)`,
        [row.id, realUserId, row.content, row.updated_at ?? updatedAt],
      );
      await enqueue(db, 'notes', 'upsert', {
        id: row.id,
        user_id: realUserId,
        content: row.content,
        updated_at: row.updated_at ?? updatedAt,
        deleted: false,
      });
    }

    // Step 2: attempt to flush to Supabase immediately if online.
    // If this fails (offline, token issue), the queue will retry later —
    // the local rows are still intact as backup.
    if (navigator.onLine) {
      try {
        await flushQueue(db);
        log.info('[useNotes:migrateLocalNotes] flush succeeded');
      } catch (e) {
        log.warn('[useNotes:migrateLocalNotes] flush failed — local rows kept as backup:', String(e));
        return; // Do not delete local rows if upload failed
      }
    }

    // Step 3: only now remove the temporary local-user rows.
    // If we're offline, skip deletion — they'll be cleaned up after next successful flush.
    if (navigator.onLine) {
      await db.query(`DELETE FROM notes WHERE user_id = 'local'`);
      log.info('[useNotes:migrateLocalNotes] local rows removed ✓');
    } else {
      log.info('[useNotes:migrateLocalNotes] offline — local rows kept until next flush');
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    log.info('[useNotes:signIn] signing in:', email);
    const result = await window.tauriAPI.supabaseSignIn(email, password);
    log.info('[useNotes:signIn] Tauri signIn ok, userId:', result.userId);
    const creds = await window.tauriAPI.getSupabaseCredentials();
    if (creds) {
      await setSupabaseSession(creds.accessToken, creds.refreshToken);
      log.info('[useNotes:signIn] Supabase session set');
      const db = await getDb();
      dbRef.current = db;
      // If coming from local-only mode, migrate notes to the real account first
      if (userId === 'local') {
        log.info('[useNotes:signIn] migrating local notes to', result.userId);
        await migrateLocalNotes(db, result.userId);
      }
      setUserId(result.userId);
      setUserEmail(result.email);
      localStorage.setItem('lama-user-id', result.userId);
      localStorage.setItem('lama-user-email', result.email);
      localStorage.removeItem('lama-mode');
      log.info('[useNotes:signIn] starting Electric sync...');
      await startElectricSync(result.userId, creds.accessToken, (err) => {
        log.error('[useNotes] Electric sync error:', String(err));
        setSyncStatus('error');
        setSyncError(String(err));
      });
      log.info('[useNotes:signIn] Electric sync started');
      setSyncStatus('synced');
      if (navigator.onLine) {
        log.info('[useNotes:signIn] flushing queue...');
        await flushQueue(db);
      }
      // If no folder is set yet, set up the default workspace so the app opens
      const existingFolder = localStorage.getItem('notes-folder');
      log.info('[useNotes:signIn] existing folder:', existingFolder);
      if (!existingFolder) {
        log.info('[useNotes:signIn] no folder set → creating default workspace');
        const docDir = await window.tauriAPI.getDocumentDir();
        const defaultPath = `${docDir}/Lama Notes`.replace(/\\/g, '/');
        await window.tauriAPI.createFolder(docDir, defaultPath);
        localStorage.setItem('notes-folder', defaultPath);
        setCurrentFolder(defaultPath);
        log.info('[useNotes:signIn] default workspace set:', defaultPath);
      }
    } else {
      log.warn('[useNotes:signIn] no creds returned after sign-in!');
    }
    return result;
  }, [userId, migrateLocalNotes]);

  const signUp = useCallback(async (email: string, password: string) => {
    log.info('[useNotes:signUp] signing up:', email);
    const result = await window.tauriAPI.supabaseSignUp(email, password);
    log.info('[useNotes:signUp] Tauri signUp ok, userId:', result.userId);
    const creds = await window.tauriAPI.getSupabaseCredentials();
    if (creds) {
      await setSupabaseSession(creds.accessToken, creds.refreshToken);
      const db = await getDb();
      dbRef.current = db;
      // If coming from local-only mode, migrate notes to the new account
      if (userId === 'local') {
        log.info('[useNotes:signUp] migrating local notes to', result.userId);
        await migrateLocalNotes(db, result.userId);
      }
      setUserId(result.userId);
      setUserEmail(result.email);
      localStorage.setItem('lama-user-id', result.userId);
      localStorage.setItem('lama-user-email', result.email);
      localStorage.removeItem('lama-mode');
      log.info('[useNotes:signUp] starting Electric sync...');
      await startElectricSync(result.userId, creds.accessToken, (err) => {
        log.error('[useNotes] Electric sync error:', String(err));
        setSyncStatus('error');
        setSyncError(String(err));
      });
      log.info('[useNotes:signUp] Electric sync started');
      setSyncStatus('synced');
      if (navigator.onLine) await flushQueue(db);
      // If no folder is set yet, set up the default workspace so the app opens
      const existingFolder = localStorage.getItem('notes-folder');
      if (!existingFolder) {
        log.info('[useNotes:signUp] no folder set → creating default workspace');
        const docDir = await window.tauriAPI.getDocumentDir();
        const defaultPath = `${docDir}/Lama Notes`.replace(/\\/g, '/');
        await window.tauriAPI.createFolder(docDir, defaultPath);
        localStorage.setItem('notes-folder', defaultPath);
        setCurrentFolder(defaultPath);
        log.info('[useNotes:signUp] default workspace set:', defaultPath);
      }
    } else {
      log.warn('[useNotes:signUp] no creds returned after sign-up!');
    }
    return result;
  }, [userId, migrateLocalNotes]);

  const signOut = useCallback(async () => {
    log.info('[useNotes:signOut] signing out...');
    await window.tauriAPI.supabaseSignOut();
    await clearSupabaseSession();
    stopElectricSync();
    setUserId(null);
    setUserEmail(null);
    localStorage.removeItem('lama-user-id');
    localStorage.removeItem('lama-user-email');
    localStorage.removeItem('lama-mode');
    setSyncStatus('unauthenticated');
    log.info('[useNotes:signOut] done — status: unauthenticated');
  }, []);

  // ── Workspace setup ───────────────────────────────────────────────────────

  const setupDefaultWorkspace = useCallback(async (updateState = true) => {
    const docDir = await window.tauriAPI.getDocumentDir();
    const defaultPath = `${docDir}/Lama Notes`.replace(/\\/g, '/');
    await window.tauriAPI.createFolder(docDir, defaultPath);
    if (updateState) {
      localStorage.setItem('notes-folder', defaultPath);
      setCurrentFolder(defaultPath);
    }
    return defaultPath;
  }, []);

  const selectFolder = useCallback(async () => {
    const folder = await window.tauriAPI.selectFolder();
    if (folder) {
      localStorage.setItem('notes-folder', folder);
      setCurrentFolder(folder);
    }
  }, []);

  /**
   * changeFolder — opens a folder picker, updates the mirror folder,
   * and scans + imports all .md files found in the new folder.
   * Used by the Settings modal "Change Location" button.
   */
  const changeFolder = useCallback(async () => {
    const folder = await window.tauriAPI.selectFolder();
    if (!folder) return;

    log.info('[useNotes:changeFolder] new folder selected:', folder);
    localStorage.setItem('notes-folder', folder);
    setCurrentFolder(folder);

    const db = dbRef.current ?? await getDb();
    dbRef.current = db;

    try {
      const scanned = await (window.tauriAPI as any).scanImportFolder(folder) as
        { relPath: string; content: string; updatedAt: string }[];
      log.info('[useNotes:changeFolder] scanned files:', scanned.length);

      for (const file of scanned) {
        const parts = file.relPath.replace(/\\/g, '/').split('/');
        const filename = parts.pop() ?? file.relPath;
        const fileFolder = parts.join('/');
        const id = getPathId(filename, fileFolder);
        const content = file.content.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart();
        const uid = userId ?? 'local';
        await db.query(
          `INSERT INTO notes (id, user_id, content, updated_at, deleted)
           VALUES ($1, $2, $3, $4, false)
           ON CONFLICT (id, user_id) DO NOTHING`,
          [id, uid, content, file.updatedAt],
        );
        if (uid !== 'local') {
          await enqueue(db, 'notes', 'upsert', {
            id, user_id: uid, content, updated_at: file.updatedAt, deleted: false,
          });
        }
      }

      if (userId && userId !== 'local' && navigator.onLine) {
        flushQueue(db).catch((e: unknown) => log.error(String(e)));
      }
      log.info('[useNotes:changeFolder] import done,', scanned.length, 'notes');
    } catch (e) {
      log.warn('[useNotes:changeFolder] scan/import error:', String(e));
    }
  }, [userId]);

  // Enter local-only mode without an account — let user pick a folder,
  // scan it for existing .md files, import them, then open the app offline.
  const goLocalOnly = useCallback(async () => {
    log.info('[useNotes:goLocalOnly] starting local-only flow...');
    const db = await getDb();
    dbRef.current = db;

    // Let the user pick a folder (or use Documents/Lama Notes as default on mobile)
    log.info('[useNotes:goLocalOnly] opening folder picker...');
    let folder = await window.tauriAPI.selectFolder();
    log.info('[useNotes:goLocalOnly] folder picker result:', folder);
    if (!folder) {
      // User cancelled — create default workspace instead
      log.info('[useNotes:goLocalOnly] no folder selected → using default');
      const docDir = await window.tauriAPI.getDocumentDir();
      folder = `${docDir}/Lama Notes`.replace(/\\/g, '/');
      await window.tauriAPI.createFolder(docDir, folder);
      log.info('[useNotes:goLocalOnly] default folder created:', folder);
    }

    localStorage.setItem('notes-folder', folder);
    localStorage.setItem('lama-mode', 'local');
    setCurrentFolder(folder);
    // Use a fixed local-only user ID so live queries and writes work without auth
    setUserId('local');
    log.info('[useNotes:goLocalOnly] folder set:', folder, '— scanning for .md files...');

    // Scan the selected folder recursively for existing .md files and import them
    try {
      const scanned = await (window.tauriAPI as any).scanImportFolder(folder) as
        { relPath: string; content: string; updatedAt: string }[];
      log.info('[useNotes:goLocalOnly] scanned files:', scanned.length);
      for (const file of scanned) {
        const parts = file.relPath.replace(/\\/g, '/').split('/');
        const filename = parts.pop() ?? file.relPath;
        const fileFolder = parts.join('/'); // e.g. "Work" or "" for root-level
        const id = getPathId(filename, fileFolder);
        const content = file.content.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart();
        log.info('[useNotes:goLocalOnly] importing:', id);
        await db.query(
          `INSERT INTO notes (id, user_id, content, updated_at, deleted)
           VALUES ($1, $2, $3, $4, false)
           ON CONFLICT (id, user_id) DO NOTHING`,
          [id, 'local', content, file.updatedAt],
        );
      }
    } catch (e) {
      log.warn('[useNotes:goLocalOnly] scan/import error (folder may be empty):', e);
    }

    setSyncStatus('offline');
    log.info('[useNotes:goLocalOnly] done — status: offline, userId: local');
  }, []);

  /**
   * importFolder — lets the user pick a local folder, scans all .md files,
   * and imports them into PGlite (+ enqueues for server sync).
   * Existing notes with newer timestamps are not overwritten.
   * Returns the number of imported notes.
   */
  const importFolder = useCallback(async (): Promise<number> => {
    if (!userId || !dbRef.current) return 0;

    const folder = await window.tauriAPI.selectFolder();
    if (!folder) return 0;

    const scanned = await (window.tauriAPI as any).scanImportFolder(folder);
    if (!scanned?.length) return 0;

    const db = dbRef.current;
    let imported = 0;

    // Use the selected folder's name as the target folder in the app
    const folderName = folder.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? '';

    for (const file of scanned as { relPath: string; content: string; updatedAt: string }[]) {
      const filename = file.relPath.replace(/\\/g, '/').split('/').pop() ?? file.relPath;
      const id = getPathId(filename, folderName);

      // Strip YAML frontmatter (--- ... ---) injected by the mirror writer
      const content = file.content.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart();

      await writeNote(id, content, file.updatedAt, false);
      imported++;
    }

    if (navigator.onLine) await flushQueue(db);
    return imported;
  }, [userId, writeNote]);

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
    currentFolder,

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
    changeFolder,
    goLocalOnly,
    importFolder,
    setupDefaultWorkspace,

    // Sync helpers
    triggerSync: async () => { if (dbRef.current) await flushQueue(dbRef.current); },
    resetSyncStatus: () => setSyncStatus(navigator.onLine ? 'synced' : 'offline'),
  };
}

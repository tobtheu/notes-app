import type { PGlite } from '@electric-sql/pglite';

/**
 * SQL schema for the local PGlite database.
 * This mirrors the Supabase Postgres schema exactly so Electric
 * can sync rows directly into these tables without transformation.
 */
export const DB_SCHEMA = /* sql */ `
  CREATE TABLE IF NOT EXISTS notes (
    id          TEXT        NOT NULL,
    user_id     TEXT        NOT NULL,
    content     TEXT        NOT NULL DEFAULT '',
    updated_at  TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    deleted     INTEGER     NOT NULL DEFAULT 0,
    created_at  TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (id, user_id)
  );

  CREATE INDEX IF NOT EXISTS notes_user_idx     ON notes(user_id);
  CREATE INDEX IF NOT EXISTS notes_updated_idx  ON notes(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS notes_deleted_idx  ON notes(user_id, deleted);

  CREATE TABLE IF NOT EXISTS app_config (
    user_id     TEXT        NOT NULL PRIMARY KEY,
    metadata    TEXT        NOT NULL DEFAULT '{}',
    updated_at  TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Pending writes: local changes not yet flushed to Supabase.
  -- Used for offline-first: written immediately, synced when online.
  CREATE TABLE IF NOT EXISTS pending_writes (
    id          TEXT        NOT NULL PRIMARY KEY,
    table_name  TEXT        NOT NULL,
    operation   TEXT        NOT NULL,  -- 'upsert' | 'delete'
    payload     TEXT        NOT NULL,  -- JSON
    created_at  TEXT        NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    attempts    INTEGER     NOT NULL DEFAULT 0
  );
`;

/**
 * Row shape returned by PGlite for the notes table.
 */
export interface NoteRow {
  id: string;
  user_id: string;
  content: string;
  updated_at: string;
  deleted: number;   // 0 | 1  (SQLite booleans)
  created_at: string;
}

/**
 * Row shape for app_config.
 */
export interface AppConfigRow {
  user_id: string;
  metadata: string; // JSON string
  updated_at: string;
}

/**
 * Pending write row.
 */
export interface PendingWriteRow {
  id: string;
  table_name: string;
  operation: string;
  payload: string;
  created_at: string;
  attempts: number;
}

/**
 * Initialise the PGlite schema (idempotent).
 */
export async function initSchema(db: PGlite): Promise<void> {
  await db.exec(DB_SCHEMA);
}

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
    updated_at  TEXT        NOT NULL DEFAULT (NOW()),
    deleted     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TEXT        NOT NULL DEFAULT (NOW()),
    PRIMARY KEY (id, user_id)
  );

  -- Migrate deleted column from INTEGER to BOOLEAN if needed
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'notes' AND column_name = 'deleted'
        AND data_type = 'integer'
    ) THEN
      ALTER TABLE notes ALTER COLUMN deleted DROP DEFAULT;
      ALTER TABLE notes ALTER COLUMN deleted TYPE BOOLEAN USING deleted::boolean;
      ALTER TABLE notes ALTER COLUMN deleted SET DEFAULT FALSE;
    END IF;
  END
  $$;

  -- Drop old rules that conflict with ON CONFLICT clauses
  DROP RULE IF EXISTS notes_upsert ON notes;
  DROP RULE IF EXISTS app_config_upsert ON app_config;

  CREATE INDEX IF NOT EXISTS notes_user_idx     ON notes(user_id);
  CREATE INDEX IF NOT EXISTS notes_updated_idx  ON notes(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS notes_deleted_idx  ON notes(user_id, deleted);

  CREATE TABLE IF NOT EXISTS app_config (
    user_id     TEXT        NOT NULL PRIMARY KEY,
    metadata    JSONB       NOT NULL DEFAULT '{}',
    updated_at  TEXT        NOT NULL DEFAULT (NOW())
  );

  -- Migrate metadata column from TEXT to JSONB if needed
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'app_config' AND column_name = 'metadata'
        AND data_type = 'text'
    ) THEN
      ALTER TABLE app_config ALTER COLUMN metadata DROP DEFAULT;
      ALTER TABLE app_config ALTER COLUMN metadata TYPE JSONB USING metadata::jsonb;
      ALTER TABLE app_config ALTER COLUMN metadata SET DEFAULT '{}';
    END IF;
  END
  $$;

  -- Trigger: make Electric's plain INSERT behave as upsert.
  -- pglite-sync uses plain INSERT for sync events; this converts it to
  -- UPDATE when the row already exists (from our optimistic local write).
  CREATE OR REPLACE FUNCTION notes_before_insert_fn()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
  BEGIN
    IF EXISTS (SELECT 1 FROM notes WHERE id = NEW.id AND user_id = NEW.user_id) THEN
      UPDATE notes SET
        content    = NEW.content,
        updated_at = NEW.updated_at,
        deleted    = NEW.deleted
      WHERE id = NEW.id AND user_id = NEW.user_id
        AND NEW.updated_at::timestamptz >= updated_at::timestamptz;
      RETURN NULL;
    END IF;
    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS notes_before_insert ON notes;
  CREATE TRIGGER notes_before_insert
    BEFORE INSERT ON notes
    FOR EACH ROW EXECUTE FUNCTION notes_before_insert_fn();

  CREATE OR REPLACE FUNCTION app_config_before_insert_fn()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
  BEGIN
    IF EXISTS (SELECT 1 FROM app_config WHERE user_id = NEW.user_id) THEN
      UPDATE app_config SET
        metadata   = NEW.metadata,
        updated_at = NEW.updated_at
      WHERE user_id = NEW.user_id
        AND NEW.updated_at::timestamptz >= updated_at::timestamptz;
      RETURN NULL;
    END IF;
    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS app_config_before_insert ON app_config;
  CREATE TRIGGER app_config_before_insert
    BEFORE INSERT ON app_config
    FOR EACH ROW EXECUTE FUNCTION app_config_before_insert_fn();

  CREATE OR REPLACE FUNCTION app_config_before_update_fn()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
  BEGIN
    IF NEW.updated_at::timestamptz < OLD.updated_at::timestamptz THEN
      RETURN NULL; -- Reject stale update
    END IF;
    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS app_config_before_update ON app_config;
  CREATE TRIGGER app_config_before_update
    BEFORE UPDATE ON app_config
    FOR EACH ROW EXECUTE FUNCTION app_config_before_update_fn();

  CREATE OR REPLACE FUNCTION notes_before_update_fn()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
  BEGIN
    IF NEW.updated_at::timestamptz < OLD.updated_at::timestamptz THEN
      RETURN NULL; -- Reject stale update
    END IF;
    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS notes_before_update ON notes;
  CREATE TRIGGER notes_before_update
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION notes_before_update_fn();

  -- Pending writes: local changes not yet flushed to Supabase.
  -- Used for offline-first: written immediately, synced when online.
  CREATE TABLE IF NOT EXISTS pending_writes (
    id          TEXT        NOT NULL PRIMARY KEY,
    table_name  TEXT        NOT NULL,
    operation   TEXT        NOT NULL,  -- 'upsert' | 'delete'
    payload     TEXT        NOT NULL,  -- JSON
    created_at  TEXT        NOT NULL DEFAULT (NOW()),
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
  deleted: boolean;
  created_at: string;
}

/**
 * Row shape for app_config.
 */
export interface AppConfigRow {
  user_id: string;
  metadata: string | object; // JSONB — PGlite returns parsed object
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

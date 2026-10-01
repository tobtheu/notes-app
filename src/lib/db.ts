import type { PGlite } from '@electric-sql/pglite';

/**
 * SQL schema for the local PGlite (WASM Postgres) database.
 * Mirrors the Supabase schema so Electric can sync rows directly.
 */
export const DB_SCHEMA = /* sql */ `
  CREATE TABLE IF NOT EXISTS notes (
    id          TEXT        NOT NULL,
    user_id     TEXT        NOT NULL,
    folder      TEXT        NOT NULL DEFAULT '',
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

  -- Add folder column if not exists
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'notes' AND column_name = 'folder'
    ) THEN
      ALTER TABLE notes ADD COLUMN folder TEXT NOT NULL DEFAULT '';
    END IF;
  END
  $$;

  -- Drop old rules that conflict with ON CONFLICT clauses
  DROP RULE IF EXISTS notes_upsert ON notes;
  DROP RULE IF EXISTS app_config_upsert ON app_config;

  CREATE INDEX IF NOT EXISTS notes_user_idx     ON notes(user_id);
  CREATE INDEX IF NOT EXISTS notes_folder_idx   ON notes(user_id, folder);
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
        folder     = NEW.folder,
        content    = NEW.content,
        updated_at = NEW.updated_at,
        deleted    = NEW.deleted
      WHERE id = NEW.id AND user_id = NEW.user_id
        AND CAST(NEW.updated_at AS timestamptz) >= CAST(updated_at AS timestamptz);
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
        AND CAST(NEW.updated_at AS timestamptz) >= CAST(updated_at AS timestamptz);
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
    IF CAST(NEW.updated_at AS timestamptz) < CAST(OLD.updated_at AS timestamptz) THEN
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
    IF CAST(NEW.updated_at AS timestamptz) < CAST(OLD.updated_at AS timestamptz) THEN
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
    id            TEXT        NOT NULL PRIMARY KEY,
    table_name    TEXT        NOT NULL,
    operation     TEXT        NOT NULL,  -- 'upsert' | 'delete'
    payload       TEXT        NOT NULL,  -- JSON
    created_at    TEXT        NOT NULL DEFAULT (NOW()),
    attempts      INTEGER     NOT NULL DEFAULT 0,
    next_retry_at TEXT        NOT NULL DEFAULT (NOW())
  );

  -- Add next_retry_at to existing installs that predate this column
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'pending_writes' AND column_name = 'next_retry_at'
    ) THEN
      ALTER TABLE pending_writes ADD COLUMN next_retry_at TEXT NOT NULL DEFAULT (NOW());
    END IF;
  END
  $$;
`;

/**
 * Row shape returned by PGlite for the notes table.
 */
export interface NoteRow {
  id: string;
  user_id: string;
  folder: string;
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
 * Migrates legacy path-based notes (containing '/' or ending with '.md') to canonical UUIDs and extracts folder.
 */
export async function migrateLegacyNotes(db: PGlite): Promise<void> {
  const legacyRows = await db.query<{ id: string; user_id: string; content: string; updated_at: string; deleted: boolean; folder?: string }>(
    `SELECT id, user_id, content, updated_at, deleted, folder FROM notes WHERE id LIKE '%.md' OR strpos(id, '/') > 0`
  );

  if (!legacyRows.rows.length) return;

  const idMap: Record<string, string> = {};

  for (const row of legacyRows.rows) {
    const lastSlash = row.id.lastIndexOf('/');
    const extractedFolder = lastSlash >= 0 ? row.id.slice(0, lastSlash) : (row.folder || '');
    const newId = crypto.randomUUID();
    idMap[row.id] = newId;

    await db.query(
      `INSERT INTO notes (id, user_id, folder, content, updated_at, deleted)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newId, row.user_id, extractedFolder, row.content, row.updated_at, row.deleted]
    );
    await db.query(
      `DELETE FROM notes WHERE id = $1 AND user_id = $2`,
      [row.id, row.user_id]
    );
  }

  // Remap pinnedNotes in app_config
  const configs = await db.query<{ user_id: string; metadata: any }>(
    `SELECT user_id, metadata FROM app_config`
  );

  for (const config of configs.rows) {
    const meta = typeof config.metadata === 'string' ? JSON.parse(config.metadata) : config.metadata;
    if (meta && Array.isArray(meta.pinnedNotes) && meta.pinnedNotes.length > 0) {
      let changed = false;
      const newPins = meta.pinnedNotes.map((p: string) => {
        if (idMap[p]) {
          changed = true;
          return idMap[p];
        }
        return p;
      });
      if (changed) {
        meta.pinnedNotes = newPins;
        await db.query(
          `UPDATE app_config SET metadata = $1 WHERE user_id = $2`,
          [JSON.stringify(meta), config.user_id]
        );
      }
    }
  }
}

/**
 * Initialise the PGlite schema (idempotent).
 */
export async function initSchema(db: PGlite): Promise<void> {
  await db.exec(DB_SCHEMA);
  await migrateLegacyNotes(db);
}

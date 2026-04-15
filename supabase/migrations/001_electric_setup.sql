-- ============================================================
-- Migration 001: ElectricSQL Setup
-- ============================================================
-- Prepares the Supabase Postgres schema for ElectricSQL sync.
-- Run this once against your Supabase project.
--
-- What this does:
--   1. Ensures the notes table has the correct schema
--   2. Ensures the app_config table has the correct schema
--   3. Enables Row Level Security (RLS) on both tables
--   4. Creates RLS policies so users only see their own data
--   5. Sets REPLICA IDENTITY FULL (required by Electric for CRDT resolution)
--   6. Creates a Postgres publication for Electric to consume
-- ============================================================

-- ------------------------------------------------------------
-- 1. NOTES TABLE
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notes (
    id          TEXT        NOT NULL,           -- Normalized path, e.g. "work/my-note.md"
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content     TEXT        NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, user_id)
);

-- Index for fast user-scoped queries
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON notes(user_id, updated_at DESC);

-- Electric requires REPLICA IDENTITY FULL to resolve per-column conflicts correctly.
-- Without this, only the primary key is included in the WAL stream.
ALTER TABLE notes REPLICA IDENTITY FULL;

-- ------------------------------------------------------------
-- 2. APP CONFIG TABLE (folders, pins, settings)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app_config (
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metadata    JSONB       NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id)
);

ALTER TABLE app_config REPLICA IDENTITY FULL;

-- ------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ------------------------------------------------------------

-- Notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'notes_select_own') THEN
        CREATE POLICY "notes_select_own" ON notes FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'notes_insert_own') THEN
        CREATE POLICY "notes_insert_own" ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'notes_update_own') THEN
        CREATE POLICY "notes_update_own" ON notes FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'notes_delete_own') THEN
        CREATE POLICY "notes_delete_own" ON notes FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- App Config
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_config' AND policyname = 'config_select_own') THEN
        CREATE POLICY "config_select_own" ON app_config FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_config' AND policyname = 'config_insert_own') THEN
        CREATE POLICY "config_insert_own" ON app_config FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_config' AND policyname = 'config_update_own') THEN
        CREATE POLICY "config_update_own" ON app_config FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_config' AND policyname = 'config_delete_own') THEN
        CREATE POLICY "config_delete_own" ON app_config FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ------------------------------------------------------------
-- 4. POSTGRES PUBLICATION FOR ELECTRIC
-- ------------------------------------------------------------
-- Electric consumes changes via logical replication.
-- This publication defines which tables Electric can sync.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'electric_publication'
    ) THEN
        CREATE PUBLICATION electric_publication FOR TABLE notes, app_config;
    END IF;
END
$$;

-- ------------------------------------------------------------
-- 5. ELECTRIC REPLICATION ROLE
-- ------------------------------------------------------------
-- Electric needs a dedicated role to connect to the replication slot.
-- Replace 'electric_password_here' with a strong password.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'electric_replication') THEN
        CREATE ROLE electric_replication WITH
            REPLICATION
            LOGIN
            PASSWORD 'electric_password_here';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO electric_replication;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO electric_replication;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO electric_replication;

-- ============================================================
-- Verification queries (run manually to confirm setup):
--
--   SELECT schemaname, tablename, rowsecurity
--     FROM pg_tables WHERE tablename IN ('notes', 'app_config');
--
--   SELECT pubname, puballtables FROM pg_publication;
--
--   SELECT rolname, rolreplication FROM pg_roles
--     WHERE rolname = 'electric_replication';
-- ============================================================

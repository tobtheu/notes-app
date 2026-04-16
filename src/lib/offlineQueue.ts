import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { supabase } from './supabaseClient';
import { setSupabaseSession } from './supabaseClient';
import type { AppMetadata } from '../types';
import { log } from './logger';

/**
 * Offline-first write queue.
 *
 * When the device is offline (or Supabase is unreachable), writes are
 * stored in the local `pending_writes` PGlite table and flushed to
 * Supabase as soon as connectivity is restored.
 *
 * Flow:
 *  1. App writes to PGlite immediately (optimistic, visible at once)
 *  2. App calls enqueue() to persist the intent in pending_writes
 *  3. flushQueue() attempts to apply all pending writes to Supabase
 *  4. Electric distributes the change to other devices
 *
 * Guarantees:
 *  - Only one flush runs at a time (serialized via _flushPromise)
 *  - Each Supabase request has a 15s AbortController timeout
 *  - Token is refreshed before each flush attempt if near expiry
 *  - Failed writes use exponential backoff (next_retry_at column)
 *  - Writes are abandoned after 10 failed attempts
 */

export interface NoteWritePayload {
  id: string;
  user_id: string;
  content: string;
  updated_at: string;
  deleted: boolean;
}

export interface ConfigWritePayload {
  user_id: string;
  metadata: AppMetadata;
  updated_at: string;
}

type WriteOperation = 'upsert';

// ── Serialization lock ────────────────────────────────────────────────────────
// Ensures only one flushQueue runs at a time, preventing race conditions where
// multiple concurrent flushes write stale data over each other.
let _flushPromise: Promise<number> | null = null;

// ── Token refresh ─────────────────────────────────────────────────────────────
// Refresh the Supabase access token before flushing if it's near expiry.
// Avoids 401 errors mid-flush when the user has been idle for ~1h.
async function ensureFreshToken(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const expiresAt = data.session?.expires_at; // unix seconds
    if (!expiresAt) return;
    const secondsLeft = expiresAt - Math.floor(Date.now() / 1000);
    // Refresh if less than 5 minutes remaining
    if (secondsLeft < 300) {
      log.info('[offlineQueue] token expiring soon, refreshing...');
      const refreshed = await window.tauriAPI.refreshSupabaseToken().catch(() => null);
      if (refreshed) {
        await setSupabaseSession(refreshed.accessToken, refreshed.refreshToken);
        log.info('[offlineQueue] token refreshed ✓');
      } else {
        log.warn('[offlineQueue] token refresh failed — proceeding with existing token');
      }
    }
  } catch (e) {
    log.warn('[offlineQueue] ensureFreshToken error:', String(e));
  }
}

// ── Request timeout ───────────────────────────────────────────────────────────
const REQUEST_TIMEOUT_MS = 15_000;

async function upsertWithTimeout(
  table: 'notes' | 'app_config',
  payload: NoteWritePayload | ConfigWritePayload,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const conflictCol = table === 'notes' ? 'id,user_id' : 'user_id';
    const { error } = await supabase
      .from(table)
      .upsert(payload, { onConflict: conflictCol })
      .abortSignal(controller.signal);
    if (error) throw new Error(error.message);
  } finally {
    clearTimeout(timer);
  }
}

// ── Exponential backoff ───────────────────────────────────────────────────────
// Delay in ms for attempt n: 5s, 10s, 20s, 40s, 80s, 160s, 300s (capped)
function backoffMs(attempts: number): number {
  return Math.min(5_000 * Math.pow(2, attempts), 300_000);
}

/**
 * Enqueue a write. Writes are deduplicated by id — if there's already
 * a pending write for the same row, it's replaced with the latest payload
 * and the retry counter is reset.
 */
export async function enqueue(
  db: PGliteWithLive,
  table: 'notes' | 'app_config',
  operation: WriteOperation,
  payload: NoteWritePayload | ConfigWritePayload,
): Promise<void> {
  const rowId = 'id' in payload ? payload.id : (payload as ConfigWritePayload).user_id;
  const writeId = `${table}:${rowId}`;

  await db.query(
    /* sql */ `
    INSERT INTO pending_writes (id, table_name, operation, payload, next_retry_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (id) DO UPDATE SET
      payload        = EXCLUDED.payload,
      attempts       = 0,
      next_retry_at  = NOW(),
      created_at     = NOW()
    `,
    [writeId, table, operation, JSON.stringify(payload)],
  );
}

/**
 * Flush all pending writes to Supabase.
 * Serialized — at most one flush runs at a time.
 * Returns the number of writes successfully flushed.
 */
export function flushQueue(db: PGliteWithLive): Promise<number> {
  if (_flushPromise) {
    // Chain onto the running flush so the caller gets a fresh result after it finishes
    _flushPromise = _flushPromise.then(() => _doFlush(db));
    return _flushPromise;
  }
  _flushPromise = _doFlush(db).finally(() => { _flushPromise = null; });
  return _flushPromise;
}

async function _doFlush(db: PGliteWithLive): Promise<number> {
  if (!navigator.onLine) return 0;

  // Refresh token before starting — avoids 401 mid-flush
  await ensureFreshToken();

  const { rows } = await db.query<{
    id: string;
    table_name: string;
    operation: string;
    payload: string;
    attempts: number;
    next_retry_at: string;
  }>(
    /* sql */ `
    SELECT * FROM pending_writes
    WHERE CAST(next_retry_at AS timestamptz) <= NOW()
    ORDER BY created_at ASC
    LIMIT 50
    `,
  );

  if (rows.length === 0) {
    log.info('[offlineQueue] flush — nothing due for retry');
    return 0;
  }

  log.info(`[offlineQueue] flushing ${rows.length} pending write(s)...`);
  let flushed = 0;

  for (const write of rows) {
    try {
      const payload = JSON.parse(write.payload);
      log.info(`[offlineQueue] writing ${write.id} (attempt ${write.attempts + 1})...`);

      await upsertWithTimeout(write.table_name as 'notes' | 'app_config', payload);

      await db.query(`DELETE FROM pending_writes WHERE id = $1`, [write.id]);
      flushed++;
      log.info(`[offlineQueue] ✓ flushed ${write.id}`);
    } catch (err) {
      const newAttempts = write.attempts + 1;
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error(`[offlineQueue] ✗ failed ${write.id} (attempt ${newAttempts}): ${errMsg}`);

      if (newAttempts >= 10) {
        await db.query(`DELETE FROM pending_writes WHERE id = $1`, [write.id]);
        log.error(`[offlineQueue] abandoned ${write.id} after 10 attempts`);
      } else {
        const nextRetry = new Date(Date.now() + backoffMs(newAttempts)).toISOString();
        await db.query(
          `UPDATE pending_writes SET attempts = $1, next_retry_at = $2 WHERE id = $3`,
          [newAttempts, nextRetry, write.id],
        );
        log.info(`[offlineQueue] will retry ${write.id} after ${Math.round(backoffMs(newAttempts) / 1000)}s`);
      }
    }
  }

  log.info(`[offlineQueue] flush done — ${flushed}/${rows.length} written`);
  return flushed;
}

import type { PGlite } from '@electric-sql/pglite';
import { supabase } from './supabaseClient';
import type { AppMetadata } from '../types';

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

interface PendingWrite {
  id: string;
  table_name: 'notes' | 'app_config';
  operation: WriteOperation;
  payload: string;
}

/**
 * Enqueue a write. Writes are deduplicated by id — if there's already
 * a pending write for the same row, it's replaced with the latest payload.
 */
export async function enqueue(
  db: PGlite,
  table: 'notes' | 'app_config',
  operation: WriteOperation,
  payload: NoteWritePayload | ConfigWritePayload,
): Promise<void> {
  const rowId = 'id' in payload ? payload.id : (payload as ConfigWritePayload).user_id;
  const writeId = `${table}:${rowId}`;

  await db.query(
    /* sql */ `
    INSERT INTO pending_writes (id, table_name, operation, payload)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (id) DO UPDATE SET
      payload    = EXCLUDED.payload,
      attempts   = 0,
      created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `,
    [writeId, table, operation, JSON.stringify(payload)],
  );
}

/**
 * Flush all pending writes to Supabase.
 * Called on: app start, network reconnect, and after every online write.
 * Returns the number of writes successfully flushed.
 */
export async function flushQueue(db: PGlite): Promise<number> {
  if (!navigator.onLine) return 0;

  const { rows } = await db.query<{
    id: string;
    table_name: string;
    operation: string;
    payload: string;
    attempts: number;
  }>(
    /* sql */ `SELECT * FROM pending_writes ORDER BY created_at ASC LIMIT 50`,
  );

  if (rows.length === 0) return 0;

  let flushed = 0;

  for (const write of rows) {
    try {
      const payload = JSON.parse(write.payload);

      if (write.table_name === 'notes') {
        const { error } = await supabase.from('notes').upsert(payload, {
          onConflict: 'id,user_id',
        });
        if (error) throw new Error(error.message);
      } else if (write.table_name === 'app_config') {
        const { error } = await supabase.from('app_config').upsert(payload, {
          onConflict: 'user_id',
        });
        if (error) throw new Error(error.message);
      }

      // Remove successfully flushed write
      await db.query(`DELETE FROM pending_writes WHERE id = $1`, [write.id]);
      flushed++;
    } catch (err) {
      // Increment attempt counter; give up after 10 failures
      const newAttempts = write.attempts + 1;
      if (newAttempts >= 10) {
        await db.query(`DELETE FROM pending_writes WHERE id = $1`, [write.id]);
        console.error(`[offlineQueue] Giving up on write ${write.id} after 10 attempts:`, err);
      } else {
        await db.query(
          `UPDATE pending_writes SET attempts = $1 WHERE id = $2`,
          [newAttempts, write.id],
        );
      }
    }
  }

  return flushed;
}

/**
 * Returns true if there are any pending (unsynced) writes.
 */
export async function hasPendingWrites(db: PGlite): Promise<boolean> {
  const { rows } = await db.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM pending_writes`,
  );
  return (rows[0]?.count ?? 0) > 0;
}

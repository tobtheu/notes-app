import { PGlite } from '@electric-sql/pglite';
import { electricSync } from '@electric-sql/pglite-sync';
import { live } from '@electric-sql/pglite-react';
import { initSchema } from './db';

const ELECTRIC_URL = import.meta.env.VITE_ELECTRIC_URL ?? 'http://localhost:5133';

/**
 * Singleton PGlite instance — shared across the entire app.
 * Uses OPFS for persistent storage (survives app restarts on all platforms).
 */
let _db: PGlite | null = null;
let _initPromise: Promise<PGlite> | null = null;
let _shapesStarted = false;

/**
 * Returns the initialised PGlite instance.
 * Safe to call multiple times — returns the same instance.
 */
export async function getDb(): Promise<PGlite> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const db = await PGlite.create('idb://lama-notes', {
      extensions: {
        electric: electricSync(),
        live,
      },
    });
    await initSchema(db);
    _db = db;
    return db;
  })();

  return _initPromise;
}

/**
 * Starts Electric shape subscriptions for a given user.
 * Call this once after sign-in. Idempotent — safe to call on hot-reload.
 */
export async function startElectricSync(userId: string, accessToken: string): Promise<void> {
  if (_shapesStarted) return;
  const db = await getDb();

  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  // Sync notes for this user
  await (db as any).electric.syncShapeToTable({
    shape: {
      url: `${ELECTRIC_URL}/v1/shape`,
      params: {
        table: 'notes',
        where: `user_id = '${userId}'`,
      },
      headers: authHeaders,
    },
    table: 'notes',
    primaryKey: ['id', 'user_id'],
    shapeKey: `notes-${userId}`,
  });

  // Sync app_config for this user
  await (db as any).electric.syncShapeToTable({
    shape: {
      url: `${ELECTRIC_URL}/v1/shape`,
      params: {
        table: 'app_config',
        where: `user_id = '${userId}'`,
      },
      headers: authHeaders,
    },
    table: 'app_config',
    primaryKey: ['user_id'],
    shapeKey: `config-${userId}`,
  });

  _shapesStarted = true;
}

/**
 * Stops and clears Electric sync (called on sign-out).
 */
export function stopElectricSync(): void {
  _shapesStarted = false;
}

export { ELECTRIC_URL };

import { PGlite } from '@electric-sql/pglite';
import { live, type PGliteWithLive } from '@electric-sql/pglite/live';
import { electricSync } from '@electric-sql/pglite-sync';
import { initSchema } from './db';
import { log } from './logger';

const ELECTRIC_URL = import.meta.env.VITE_ELECTRIC_URL ?? 'http://localhost:5133';

/**
 * Singleton PGlite instance — shared across the entire app.
 * Uses IndexedDB for persistent storage (survives app restarts on all platforms).
 */
let _db: PGliteWithLive | null = null;
let _initPromise: Promise<PGliteWithLive> | null = null;
let _shapesStarted = false;

// Handles returned by syncShapeToTable — needed to unsubscribe on sign-out.
// Without calling unsubscribe(), shapes continue writing into PGlite even after
// sign-out, which can leak data from one account into another session.
const _shapeHandles: Array<{ unsubscribe: () => void }> = [];

/**
 * Returns the initialised PGlite instance.
 * Safe to call multiple times — returns the same instance.
 */
export async function getDb(): Promise<PGliteWithLive> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const db = await PGlite.create('idb://lama-notes-v2', {
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
 *
 * @param onError  Called if a shape subscription encounters a fatal error.
 *                 Use this to set syncStatus = 'error' in the UI.
 */
export async function startElectricSync(
  userId: string,
  accessToken: string,
  onError?: (err: unknown) => void,
): Promise<void> {
  if (_shapesStarted) {
    log.info('[electric] syncShapes already started — skipping');
    return;
  }
  // Validate userId is a valid UUID to prevent injection in shape params
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('Invalid userId format');
  }
  const db = await getDb();

  log.info('[electric] starting shape sync — url:', ELECTRIC_URL, 'userId:', userId);

  const authHeaders = { 
    Authorization: `Bearer ${accessToken}`,
    'X-Lama-Secret': import.meta.env.VITE_LAMA_SECRET 
  };

  const handleError = (err: unknown) => {
    log.error('[electric] shape subscription error:', String(err));
    onError?.(err);
  };

  // Sync notes for this user
  log.info('[electric] subscribing to notes shape...');
  try {
    const notesHandle = await (db as any).electric.syncShapeToTable({
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
      onError: handleError,
    });
    if (notesHandle?.unsubscribe) _shapeHandles.push(notesHandle);
    log.info('[electric] notes shape subscribed ✓');
  } catch (err) {
    handleError(err);
    throw err;
  }

  // Sync app_config for this user
  log.info('[electric] subscribing to app_config shape...');
  try {
    const configHandle = await (db as any).electric.syncShapeToTable({
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
      onError: handleError,
    });
    if (configHandle?.unsubscribe) _shapeHandles.push(configHandle);
    log.info('[electric] app_config shape subscribed ✓');
  } catch (err) {
    handleError(err);
    throw err;
  }

  _shapesStarted = true;
  log.info('[electric] all shapes active ✓');
}

/**
 * Stops and clears Electric sync (called on sign-out).
 * Unsubscribes all active shape handles so they stop writing into PGlite.
 */
export function stopElectricSync(): void {
  log.info(`[electric] stopping ${_shapeHandles.length} shape subscription(s)...`);
  for (const handle of _shapeHandles) {
    try {
      handle.unsubscribe();
    } catch (e) {
      log.warn('[electric] error unsubscribing shape:', String(e));
    }
  }
  _shapeHandles.length = 0;
  _shapesStarted = false;
  log.info('[electric] all shapes stopped ✓');
}

export { ELECTRIC_URL };

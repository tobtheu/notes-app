import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { supabase } from './supabaseClient';
import { log } from './logger';

/**
 * Pulls all remote notes and app configuration directly from Supabase PostgREST
 * and populates the local PGlite database.
 */
export async function pullFromSupabase(
  db: PGliteWithLive,
  userId: string
): Promise<{ notesCount: number; configUpdated: boolean }> {
  if (!userId || userId === 'local' || !navigator.onLine) {
    return { notesCount: 0, configUpdated: false };
  }

  log.info('[syncSupabase:pull] fetching notes from Supabase for user:', userId);
  let notesCount = 0;
  let configUpdated = false;

  try {
    // 1. Fetch remote notes and config in parallel
    const [notesRes, configRes] = await Promise.all([
      supabase
        .from('notes')
        .select('id, user_id, content, updated_at, deleted')
        .eq('user_id', userId),
      supabase
        .from('app_config')
        .select('user_id, metadata, updated_at')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    if (notesRes.error) {
      log.error('[syncSupabase:pull] error fetching remote notes:', notesRes.error);
    }
    if (configRes.error) {
      log.error('[syncSupabase:pull] error fetching remote config:', configRes.error);
    }

    const remoteNotes = notesRes.data;
    const remoteConfig = configRes.data;

    const runInTx = typeof (db as any).transaction === 'function'
      ? (cb: (tx: any) => Promise<void>) => (db as any).transaction(cb)
      : (cb: (tx: any) => Promise<void>) => cb(db);

    await runInTx(async (tx: any) => {
      // Upsert all notes atomically in one transaction
      if (remoteNotes && remoteNotes.length > 0) {
        log.info(`[syncSupabase:pull] atomically applying ${remoteNotes.length} remote note(s)`);
        for (const row of remoteNotes) {
          await tx.query(
            `INSERT INTO notes (id, user_id, content, updated_at, deleted)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id, user_id) DO UPDATE SET
               content    = EXCLUDED.content,
               updated_at = EXCLUDED.updated_at,
               deleted    = EXCLUDED.deleted
             WHERE CAST(EXCLUDED.updated_at AS timestamptz) >= CAST(notes.updated_at AS timestamptz)`,
            [row.id, row.user_id, row.content, row.updated_at, row.deleted],
          );
          notesCount++;
        }
      }

      // Upsert app_config in the same atomic transaction
      if (remoteConfig) {
        const metadataStr = typeof remoteConfig.metadata === 'string'
          ? remoteConfig.metadata
          : JSON.stringify(remoteConfig.metadata);

        await tx.query(
          `INSERT INTO app_config (user_id, metadata, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id) DO UPDATE SET
             metadata   = EXCLUDED.metadata,
             updated_at = EXCLUDED.updated_at
           WHERE CAST(EXCLUDED.updated_at AS timestamptz) >= CAST(app_config.updated_at AS timestamptz)`,
          [remoteConfig.user_id, metadataStr, remoteConfig.updated_at],
        );
        configUpdated = true;
      }
    });
  } catch (err) {
    log.error('[syncSupabase:pull] pull failed:', err);
  }

  return { notesCount, configUpdated };
}

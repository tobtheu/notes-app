import { getDb } from '../lib/electric';

export function initGlobalHandlers() {
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      console.error('[window.onerror]', event.error || event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[unhandledrejection]', event.reason);
    });
    if (import.meta.env.DEV) {
      (window as any).dumpNotes = async () => {
        const { supabase } = await import('../lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Current Session User ID:', session?.user?.id);

        const db = await getDb();
        const { rows } = await db.query('SELECT id, user_id, folder, content, updated_at, deleted FROM notes');
        console.table(rows);
        return rows;
      };

      (window as any).deduplicateNotesNow = async () => {
        const { deduplicateNotes } = await import('../lib/deduplicateNotes');
        const db = await getDb();
        const userId = localStorage.getItem('lama-user-id') || 'local';
        console.log(`Running deduplicateNotesNow for user: ${userId}`);
        const res = await deduplicateNotes(db, userId);
        console.log('Deduplication result:', res);
        return res;
      };

      (window as any).backupDatabase = async () => {
        const db = await getDb();
        const notes = await db.query('SELECT * FROM notes');
        const config = await db.query('SELECT * FROM app_config');
        const pending = await db.query('SELECT * FROM pending_writes');
        const dump = {
          timestamp: new Date().toISOString(),
          notes: notes.rows,
          config: config.rows,
          pending: pending.rows,
        };
        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lama-notes-database-dump-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('Database backup downloaded successfully.');
        return dump;
      };
    }
  }
}

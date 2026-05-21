import { getDb } from '../lib/electric';

export function initGlobalHandlers() {
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      console.error('[window.onerror]', event.error || event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[unhandledrejection]', event.reason);
    });
    (window as any).dumpNotes = async () => {
      const { supabase } = await import('../lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current Session User ID:', session?.user?.id);

      const db = await getDb();
      const { rows } = await db.query('SELECT id, user_id, updated_at, deleted FROM notes');
      console.table(rows);
      return rows;
    };
  }
}

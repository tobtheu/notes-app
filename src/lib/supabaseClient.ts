import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

/**
 * Supabase JS client — used exclusively for writes to Postgres.
 * Reads go through PGlite (local SQLite synced by Electric).
 *
 * Auth tokens are injected via setSession() after sign-in
 * (tokens come from the Tauri Rust backend).
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,   // Session managed by Tauri store, not the JS client
    autoRefreshToken: false, // Token refresh handled by Tauri backend
  },
  global: {
    headers: { 'X-Lama-Secret': import.meta.env.VITE_LAMA_SECRET },
  },
});

/**
 * Inject an active session into the Supabase JS client so it can
 * make authenticated writes. Call this after sign-in or app start.
 */
export async function setSupabaseSession(accessToken: string, refreshToken: string): Promise<void> {
  await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
}

/**
 * Clear the active session (on sign-out).
 */
export async function clearSupabaseSession(): Promise<void> {
  await supabase.auth.signOut();
}

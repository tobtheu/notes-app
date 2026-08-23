import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const SUPABASE_URL = (envUrl && !envUrl.includes('46.225.11.148')) ? envUrl : 'https://api.lamanotes.de';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc3MDYwNDMzLCJleHAiOjIwOTI0MjA0MzN9.MfNPRgANFJG_PqejvzL269R4J-u7AaRBoNdEdGqaQJQ';
const LAMA_SECRET = (import.meta.env.VITE_LAMA_SECRET as string) || 'LamaNotes_Safe_30b9d5a4';

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
    headers: LAMA_SECRET 
      ? { 'X-Lama-Secret': LAMA_SECRET }
      : {},
  },
});

/**
 * Inject an active session into the Supabase JS client so it can
 * make authenticated writes. Call this after sign-in or app start.
 */
export async function setSupabaseSession(accessToken: string, refreshToken: string): Promise<void> {
  try {
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  } catch (e) {
    console.warn('[supabaseClient] setSession failed:', e);
  }
}

/**
 * Clear the active session (on sign-out).
 */
export async function clearSupabaseSession(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('[supabaseClient] signOut failed:', e);
  }
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { FEATURES } from '../config/features';

const SUPABASE_URL = FEATURES.SYNC ? ((import.meta.env.VITE_SUPABASE_URL as string) || '') : '';
const SUPABASE_ANON_KEY = FEATURES.SYNC ? ((import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '') : '';
const LAMA_SECRET = FEATURES.SYNC ? ((import.meta.env.VITE_LAMA_SECRET as string) || '') : '';

/**
 * Supabase JS client — initialized only when Cloud Sync is active and valid URL is configured.
 * For offline builds, provides a safe dummy/fallback client to prevent initialization errors.
 */
export const supabase: SupabaseClient = (FEATURES.SYNC && SUPABASE_URL && SUPABASE_ANON_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        global: {
            headers: LAMA_SECRET ? { 'X-Lama-Secret': LAMA_SECRET } : {},
        },
    })
    : createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

/**
 * Inject an active session into the Supabase JS client so it can
 * make authenticated writes. Call this after sign-in or app start.
 */
export async function setSupabaseSession(accessToken: string, refreshToken: string): Promise<void> {
    if (!FEATURES.SYNC || !SUPABASE_URL) return;
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
    if (!FEATURES.SYNC || !SUPABASE_URL) return;
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.warn('[supabaseClient] signOut failed:', e);
    }
}

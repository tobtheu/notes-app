import { useEffect } from 'react';
import type { SyncStatus } from '../types';
import { getDb, startElectricSync } from '../lib/electric';
import { setSupabaseSession, supabase } from '../lib/supabaseClient';
import { flushQueue } from '../lib/offlineQueue';
import { pullFromSupabase } from '../lib/syncSupabase';
import { log } from '../lib/logger';
import type { PGliteWithLive } from '@electric-sql/pglite/live';

interface UseNotesInitProps {
    dbRef: React.MutableRefObject<PGliteWithLive | null>;
    userId: string | null;
    setUserId: (id: string | null) => void;
    setUserEmail: (email: string | null) => void;
    setSyncStatus: React.Dispatch<React.SetStateAction<SyncStatus>>;
    setSyncError: (error: string | null) => void;
}

export function useNotesInit({
    dbRef,
    userId,
    setUserId,
    setUserEmail,
    setSyncStatus,
    setSyncError,
}: UseNotesInitProps) {
    // ── Initialise PGlite + restore session ──────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                log.info('[useNotes:init] start — localStorage:', {
                    'lama-mode': localStorage.getItem('lama-mode'),
                    'lama-user-id': localStorage.getItem('lama-user-id'),
                    'notes-folder': localStorage.getItem('notes-folder'),
                });

                const db = await getDb();
                log.info('[useNotes:init] PGlite ready');
                if (cancelled) return;
                dbRef.current = db;

                if (localStorage.getItem('lama-mode') === 'local') {
                    log.info('[useNotes:init] restoring local-only mode');
                    setUserId('local');
                    setSyncStatus('offline');
                    return;
                }

                log.info('[useNotes:init] reading Tauri secure store...');
                const stored = await window.tauriAPI.getSupabaseCredentials().catch((e: unknown) => {
                    log.warn('[useNotes:init] getSupabaseCredentials failed:', e);
                    return null;
                });

                if (!stored) {
                    log.info('[useNotes:init] no stored credentials → unauthenticated');
                    localStorage.removeItem('lama-user-id');
                    localStorage.removeItem('lama-user-email');
                    setSyncStatus('unauthenticated');
                    return;
                }

                log.info('[useNotes:init] credentials found, userId:', stored.userId, 'email:', stored.email);

                await setSupabaseSession(stored.accessToken, stored.refreshToken);
                log.info('[useNotes:init] Supabase session set');

                let tokenValid = true;
                let freshAccessToken = stored.accessToken;
                let freshRefreshToken = stored.refreshToken;

                try {
                    const { data } = await supabase.auth.getSession();
                    const expiresAt = data.session?.expires_at;
                    const secondsLeft = expiresAt ? expiresAt - Math.floor(Date.now() / 1000) : 0;

                    if (secondsLeft < 300) {
                        log.info('[useNotes:init] Token expired or expiring soon, refreshing...');
                        const refreshed = await window.tauriAPI.refreshSupabaseToken().catch(() => null);
                        if (refreshed) {
                            freshAccessToken = refreshed.accessToken;
                            freshRefreshToken = refreshed.refreshToken;
                            await setSupabaseSession(freshAccessToken, freshRefreshToken);
                            log.info('[useNotes:init] Token refreshed successfully');
                        } else {
                            log.error('[useNotes:init] Token refresh failed on startup - session is dead.');
                            tokenValid = false;
                        }
                    }
                } catch (e) {
                    log.warn('[useNotes:init] Error checking/refreshing token:', e);
                }

                if (!tokenValid) {
                    setUserId(stored.userId);
                    setUserEmail(stored.email);
                    localStorage.setItem('lama-user-id', stored.userId);
                    localStorage.setItem('lama-user-email', stored.email);
                    setSyncStatus('error');
                    setSyncError('session_expired');
                    return;
                }

                setUserId(stored.userId);
                setUserEmail(stored.email);
                localStorage.setItem('lama-user-id', stored.userId);
                localStorage.setItem('lama-user-email', stored.email);

                if (!navigator.onLine) {
                    log.info('[useNotes:init] offline → skipping Electric sync');
                    setSyncStatus('offline');
                } else {
                    log.info('[useNotes:init] online → starting Electric sync');
                    setSyncStatus('synced');
                }
                if (navigator.onLine && stored.userId) {
                    log.info('[useNotes:init] pulling remote notes from Supabase...');
                    await pullFromSupabase(db, stored.userId);
                }

                await startElectricSync(stored.userId, stored.accessToken, (err) => {
                    log.error('[useNotes] Electric sync error:', String(err));
                    if (!cancelled) { setSyncStatus('error'); setSyncError(String(err)); }
                });
                log.info('[useNotes:init] Electric sync started');

                if (navigator.onLine) {
                    log.info('[useNotes:init] flushing offline queue...');
                    await flushQueue(db);
                    log.info('[useNotes:init] queue flushed');
                }
            } catch (err) {
                log.error('[useNotes:init] ERROR:', err);
                if (!cancelled) {
                    setSyncError(String(err));
                    setSyncStatus('error');
                }
            }
        })();

        return () => { cancelled = true; };
    }, []);

    // ── Network reconnect → flush queue ──────────────────────────────────────
    useEffect(() => {
        const handleOnline = async () => {
            if (!dbRef.current || !userId) return;
            setSyncStatus('synced');
            await pullFromSupabase(dbRef.current, userId);
            await flushQueue(dbRef.current);
        };
        const handleOffline = () => setSyncStatus('offline');

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [userId]);
}

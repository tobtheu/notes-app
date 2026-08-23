import { useCallback } from 'react';
import type { SyncStatus } from '../types';
import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { getDb, startElectricSync, stopElectricSync } from '../lib/electric';
import { supabase, setSupabaseSession, clearSupabaseSession } from '../lib/supabaseClient';
import { enqueue, flushQueue } from '../lib/offlineQueue';
import { pullFromSupabase } from '../lib/syncSupabase';
import { log } from '../lib/logger';

interface UseNotesAuthProps {
    dbRef: React.MutableRefObject<PGliteWithLive | null>;
    userId: string | null;
    setUserId: (id: string | null) => void;
    setUserEmail: (email: string | null) => void;
    setSyncStatus: (status: SyncStatus) => void;
    setSyncError: (error: string | null) => void;
}

export function useNotesAuth({
    dbRef,
    userId,
    setUserId,
    setUserEmail,
    setSyncStatus,
    setSyncError,
}: UseNotesAuthProps) {
    
    const migrateLocalNotes = useCallback(async (db: PGliteWithLive, realUserId: string) => {
        const { rows } = await db.query<{ id: string; content: string; updated_at: string }>(
            `SELECT id, content, updated_at FROM notes WHERE user_id = 'local' AND deleted = false`,
        );
        if (rows.length === 0) return;

        log.info(`[useNotes:migrateLocalNotes] migrating ${rows.length} local note(s) to`, realUserId);
        const updatedAt = new Date().toISOString();

        for (const row of rows) {
            await db.query(
                `INSERT INTO notes (id, user_id, content, updated_at, deleted)
                 VALUES ($1, $2, $3, $4, false)
                 ON CONFLICT (id, user_id) DO UPDATE SET
                   content    = EXCLUDED.content,
                   updated_at = EXCLUDED.updated_at
                 WHERE CAST(EXCLUDED.updated_at AS timestamptz) >= CAST(notes.updated_at AS timestamptz)`,
                [row.id, realUserId, row.content, row.updated_at ?? updatedAt],
            );
            await enqueue(db, 'notes', 'upsert', {
                id: row.id,
                user_id: realUserId,
                content: row.content,
                updated_at: row.updated_at ?? updatedAt,
                deleted: false,
            });
        }

        if (navigator.onLine) {
            try {
                const MAX_FLUSH_ROUNDS = 50;
                for (let i = 0; i < MAX_FLUSH_ROUNDS; i++) {
                    const flushed = await flushQueue(db);
                    if (flushed === 0) break;
                }
                const { rows: remaining } = await db.query<{ count: number }>(
                    `SELECT COUNT(*)::int AS count FROM pending_writes`,
                );
                if ((remaining[0]?.count ?? 0) > 0) {
                    log.warn('[useNotes:migrateLocalNotes] queue not empty after flush — keeping local rows');
                    return;
                }
                log.info('[useNotes:migrateLocalNotes] flush succeeded');
            } catch (e) {
                log.warn('[useNotes:migrateLocalNotes] flush failed — local rows kept as backup:', String(e));
                return;
            }
        }

        if (navigator.onLine) {
            await db.query(`DELETE FROM notes WHERE user_id = 'local'`);
            log.info('[useNotes:migrateLocalNotes] local rows removed ✓');
        } else {
            log.info('[useNotes:migrateLocalNotes] offline — local rows kept until next flush');
        }
    }, []);

    const clearLocalData = useCallback(async (uid: string) => {
        const db = dbRef.current;
        if (!db) return;
        await db.query('DELETE FROM notes WHERE user_id = $1', [uid]);
        await db.query('DELETE FROM app_config WHERE user_id = $1', [uid]);
    }, [dbRef]);

    const signIn = useCallback(async (email: string, password: string) => {
        log.info('[useNotes:signIn] signing in:', email);
        const result = await window.tauriAPI.supabaseSignIn(email, password);
        log.info('[useNotes:signIn] Tauri signIn ok, userId:', result.userId);
        const creds = await window.tauriAPI.getSupabaseCredentials();
        if (creds) {
            await setSupabaseSession(creds.accessToken, creds.refreshToken);
            log.info('[useNotes:signIn] Supabase session set');
            const db = await getDb();
            dbRef.current = db;

            if (userId === 'local') {
                log.info('[useNotes:signIn] migrating local notes to', result.userId);
                await migrateLocalNotes(db, result.userId);
            }

            // Immediately fetch remote notes and config from Supabase into local PGlite
            log.info('[useNotes:signIn] pulling remote notes from Supabase...');
            await pullFromSupabase(db, result.userId);

            setUserId(result.userId);
            setUserEmail(result.email);
            localStorage.setItem('lama-user-id', result.userId);
            localStorage.setItem('lama-user-email', result.email);
            localStorage.removeItem('lama-mode');

            if (navigator.onLine) {
                log.info('[useNotes:signIn] flushing queue...');
                await flushQueue(db);
            }

            log.info('[useNotes:signIn] starting Electric sync...');
            await startElectricSync(result.userId, creds.accessToken, (err) => {
                log.error('[useNotes] Electric sync error:', String(err));
                setSyncStatus('error');
                setSyncError(String(err));
            });
            log.info('[useNotes:signIn] Electric sync started');
            setSyncStatus('synced');
        } else {
            log.warn('[useNotes:signIn] no creds returned after sign-in!');
        }
        return result;
    }, [userId, dbRef, migrateLocalNotes, setUserId, setUserEmail, setSyncStatus, setSyncError]);

    const signUp = useCallback(async (email: string, password: string) => {
        log.info('[useNotes:signUp] signing up:', email);
        const result = await window.tauriAPI.supabaseSignUp(email, password);
        log.info('[useNotes:signUp] Tauri signUp ok, userId:', result.userId);
        const creds = await window.tauriAPI.getSupabaseCredentials();
        if (creds) {
            await setSupabaseSession(creds.accessToken, creds.refreshToken);
            const db = await getDb();
            dbRef.current = db;

            if (userId === 'local') {
                log.info('[useNotes:signUp] migrating local notes to', result.userId);
                await migrateLocalNotes(db, result.userId);
            }

            // Immediately fetch remote notes and config from Supabase into local PGlite
            log.info('[useNotes:signUp] pulling remote notes from Supabase...');
            await pullFromSupabase(db, result.userId);

            setUserId(result.userId);
            setUserEmail(result.email);
            localStorage.setItem('lama-user-id', result.userId);
            localStorage.setItem('lama-user-email', result.email);
            localStorage.removeItem('lama-mode');

            if (navigator.onLine) await flushQueue(db);

            log.info('[useNotes:signUp] starting Electric sync...');
            await startElectricSync(result.userId, creds.accessToken, (err) => {
                log.error('[useNotes] Electric sync error:', String(err));
                setSyncStatus('error');
                setSyncError(String(err));
            });
            log.info('[useNotes:signUp] Electric sync started');
            setSyncStatus('synced');
        } else {
            log.warn('[useNotes:signUp] no creds returned after sign-up!');
        }
        return result;
    }, [userId, dbRef, migrateLocalNotes, setUserId, setUserEmail, setSyncStatus, setSyncError]);

    const signOut = useCallback(async (deleteLocal = false) => {
        log.info('[useNotes:signOut] signing out, deleteLocal:', deleteLocal);
        if (deleteLocal && userId) await clearLocalData(userId);
        await window.tauriAPI.supabaseSignOut();
        await clearSupabaseSession();
        stopElectricSync();
        setUserId(null);
        setUserEmail(null);
        localStorage.removeItem('lama-user-id');
        localStorage.removeItem('lama-user-email');
        localStorage.removeItem('lama-mode');
        localStorage.removeItem('lama-metadata');
        setSyncStatus('unauthenticated');
        log.info('[useNotes:signOut] done — status: unauthenticated');
    }, [userId, clearLocalData, setUserId, setUserEmail, setSyncStatus]);

    const deleteAccount = useCallback(async () => {
        const uid = userId;
        if (!uid) return;
        log.info('[useNotes:deleteAccount] deleting account for:', uid);
        await supabase.from('notes').delete().eq('user_id', uid);
        await supabase.from('app_config').delete().eq('user_id', uid);
        await supabase.rpc('delete_user_account');
        await clearLocalData(uid);
        await window.tauriAPI.supabaseSignOut();
        await clearSupabaseSession();
        stopElectricSync();
        setUserId(null);
        setUserEmail(null);
        localStorage.removeItem('lama-user-id');
        localStorage.removeItem('lama-user-email');
        localStorage.removeItem('lama-mode');
        localStorage.removeItem('lama-metadata');
        setSyncStatus('unauthenticated');
        log.info('[useNotes:deleteAccount] done');
    }, [userId, clearLocalData, setUserId, setUserEmail, setSyncStatus]);

    return {
        signIn,
        signUp,
        signOut,
        deleteAccount
    };
}

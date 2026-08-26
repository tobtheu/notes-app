import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from '@electric-sql/pglite-react';
import type { AppMetadata } from '../types';
import { sanitizeAppMetadata } from '../types';
import { enqueue, flushQueue } from '../lib/offlineQueue';
import { log } from '../lib/logger';
import type { PGliteWithLive } from '@electric-sql/pglite/live';

interface UseNotesConfigProps {
    dbRef: React.MutableRefObject<PGliteWithLive | null>;
    userId: string | null;
}

export function useNotesConfig({ dbRef, userId }: UseNotesConfigProps) {
    const lastConfigWriteAt = useRef<string | null>(null);
    const metadataRef = useRef<AppMetadata>({ folders: {}, pinnedNotes: [] });

    // ── App Config Live Query ────────────────────────────────────────────────
    const configQuery = useLiveQuery<{ metadata: string | AppMetadata; updated_at: string }>(
        userId
            ? `SELECT metadata, updated_at FROM app_config WHERE user_id = $1`
            : `SELECT '' AS metadata, '' AS updated_at WHERE 1=0`,
        userId ? [userId] : [],
    );

    const [metadata, setMetadataState] = useState<AppMetadata>(() => {
        try {
            const cached = localStorage.getItem('lama-metadata');
            return cached ? sanitizeAppMetadata(JSON.parse(cached)) : { folders: {}, pinnedNotes: [] };
        } catch {
            return { folders: {}, pinnedNotes: [] };
        }
    });

    // Reset metadata only when an active user changes to a DIFFERENT active user or signs out.
    const prevUserIdRef = useRef<string | null | undefined>(undefined);
    useEffect(() => {
        if (
            prevUserIdRef.current !== undefined &&
            prevUserIdRef.current !== null &&
            prevUserIdRef.current !== userId
        ) {
            setMetadataState({ folders: {}, pinnedNotes: [] });
            metadataRef.current = { folders: {}, pinnedNotes: [] };
            try { localStorage.removeItem('lama-metadata'); } catch { }
        }
        prevUserIdRef.current = userId;
    }, [userId]);

    const configRow = configQuery?.rows?.[0];
    const configUpdatedAt = configRow?.updated_at;
    const configMetadataRaw = configRow?.metadata;

    useEffect(() => {
        if (!configRow) return;
        const incomingAt = configRow.updated_at;
        // Skip if this is our own write echoing back (same or older timestamp)
        if (lastConfigWriteAt.current && incomingAt <= lastConfigWriteAt.current) return;
        // It's a remote change (or initial load) — apply it
        try {
            const m = configRow.metadata;
            const parsed = typeof m === 'string' ? JSON.parse(m) : m;
            const safeMetadata = sanitizeAppMetadata(parsed);
            setMetadataState(safeMetadata);
            metadataRef.current = safeMetadata;
            try { localStorage.setItem('lama-metadata', JSON.stringify(safeMetadata)); } catch { }
        } catch { /* ignore parse errors */ }
    }, [configUpdatedAt, configMetadataRaw]);

    // ── Core config write helper ──────────────────────────────────────────────
    const writeConfig = useCallback(async (newMetadata: AppMetadata) => {
        if (!userId || !dbRef.current) return;
        const db = dbRef.current;
        const updatedAt = new Date().toISOString();

        // Instant UI state update & local persistence
        setMetadataState(newMetadata);
        metadataRef.current = newMetadata;
        try { localStorage.setItem('lama-metadata', JSON.stringify(newMetadata)); } catch { }

        const existing = await db.query<{ updated_at: string }>(
            `SELECT updated_at FROM app_config WHERE user_id = $1`,
            [userId]
        );
        let finalUpdatedAt = updatedAt;
        if (existing.rows.length > 0) {
            const existingTime = new Date(existing.rows[0].updated_at).getTime();
            const localTime = new Date(updatedAt).getTime();
            if (existingTime >= localTime) {
                finalUpdatedAt = new Date(existingTime + 1).toISOString();
            }
        }

        lastConfigWriteAt.current = finalUpdatedAt;

        await db.query(
            /* sql */ `
      INSERT INTO app_config (user_id, metadata, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        metadata   = EXCLUDED.metadata,
        updated_at = EXCLUDED.updated_at
      `,
            [userId, JSON.stringify(newMetadata), finalUpdatedAt],
        );

        if (userId !== 'local') {
            await enqueue(db, 'app_config', 'upsert', {
                user_id: userId,
                metadata: newMetadata,
                updated_at: finalUpdatedAt,
            });

            if (navigator.onLine) flushQueue(db).catch((e: unknown) => log.error(String(e)));
        }
    }, [userId, dbRef]);

    return {
        metadata,
        metadataRef,
        writeConfig,
    };
}

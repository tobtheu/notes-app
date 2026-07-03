import { useCallback } from 'react';
import type { SyncStatus } from '../types';
import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { getDb } from '../lib/electric';
import { getPathId } from '../utils/path';
import { enqueue, flushQueue } from '../lib/offlineQueue';
import { scanAndImportNewFiles } from '../utils/scanAndImport';
import { log } from '../lib/logger';

interface UseNotesWorkspaceProps {
    dbRef: React.MutableRefObject<PGliteWithLive | null>;
    userId: string | null;
    setUserId: (id: string | null) => void;
    setCurrentFolder: (folder: string | null) => void;
    setSyncStatus: (status: SyncStatus) => void;
    writeNote: (id: string, content: string, updatedAt: string, deleted?: boolean) => Promise<void>;
}

export function useNotesWorkspace({
    dbRef,
    userId,
    setUserId,
    setCurrentFolder,
    setSyncStatus,
    writeNote
}: UseNotesWorkspaceProps) {

    const setupDefaultWorkspace = useCallback(async (updateState = true) => {
        const docDir = await window.tauriAPI.getDocumentDir();
        const defaultPath = `${docDir}/Lama Notes`.replace(/\\/g, '/');
        await window.tauriAPI.createFolder(docDir, defaultPath);
        if (updateState) {
            localStorage.setItem('notes-folder', defaultPath);
            setCurrentFolder(defaultPath);
        }
        return defaultPath;
    }, [setCurrentFolder]);

    const selectFolder = useCallback(async () => {
        const folder = await window.tauriAPI.selectFolder();
        if (folder) {
            localStorage.setItem('notes-folder', folder);
            setCurrentFolder(folder);
        }
    }, [setCurrentFolder]);

    const changeFolder = useCallback(async () => {
        const folder = await window.tauriAPI.selectFolder();
        if (!folder) return;

        log.info('[useNotes:changeFolder] new folder selected:', folder);
        localStorage.setItem('notes-folder', folder);
        setCurrentFolder(folder);

        const db = dbRef.current ?? await getDb();
        dbRef.current = db;

        try {
            const scanned = await (window.tauriAPI as any).scanImportFolder(folder) as
                { relPath: string; content: string; updatedAt: string }[];
            log.info('[useNotes:changeFolder] scanned files:', scanned.length);

            for (const file of scanned) {
                const parts = file.relPath.replace(/\\/g, '/').split('/');
                const filename = parts.pop() ?? file.relPath;
                const fileFolder = parts.join('/');
                const id = getPathId(filename, fileFolder);
                const content = file.content.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart();
                const uid = userId ?? 'local';
                await db.query(
                    `INSERT INTO notes (id, user_id, content, updated_at, deleted)
                     VALUES ($1, $2, $3, $4, false)
                     ON CONFLICT (id, user_id) DO NOTHING`,
                    [id, uid, content, file.updatedAt],
                );
                if (uid !== 'local') {
                    await enqueue(db, 'notes', 'upsert', {
                        id, user_id: uid, content, updated_at: file.updatedAt, deleted: false,
                    });
                }
            }

            if (userId && userId !== 'local' && navigator.onLine) {
                flushQueue(db).catch((e: unknown) => log.error(String(e)));
            }
            log.info('[useNotes:changeFolder] import done,', scanned.length, 'notes');
        } catch (e) {
            log.warn('[useNotes:changeFolder] scan/import error:', String(e));
        }
    }, [userId, dbRef, setCurrentFolder]);

    const goLocalOnly = useCallback(async () => {
        log.info('[useNotes:goLocalOnly] starting local-only flow...');
        const db = await getDb();
        dbRef.current = db;

        log.info('[useNotes:goLocalOnly] opening folder picker...');
        let folder = await window.tauriAPI.selectFolder();
        log.info('[useNotes:goLocalOnly] folder picker result:', folder);
        if (!folder) {
            log.info('[useNotes:goLocalOnly] no folder selected → using default');
            const docDir = await window.tauriAPI.getDocumentDir();
            folder = `${docDir}/Lama Notes`.replace(/\\/g, '/');
            await window.tauriAPI.createFolder(docDir, folder);
            log.info('[useNotes:goLocalOnly] default folder created:', folder);
        }

        localStorage.setItem('notes-folder', folder);
        localStorage.setItem('lama-mode', 'local');
        setCurrentFolder(folder);
        setUserId('local');
        log.info('[useNotes:goLocalOnly] folder set:', folder, '— scanning for .md files...');

        try {
            const scanned = await (window.tauriAPI as any).scanImportFolder(folder) as
                { relPath: string; content: string; updatedAt: string }[];
            log.info('[useNotes:goLocalOnly] scanned files:', scanned.length);
            for (const file of scanned) {
                const parts = file.relPath.replace(/\\/g, '/').split('/');
                const filename = parts.pop() ?? file.relPath;
                const fileFolder = parts.join('/');
                const id = getPathId(filename, fileFolder);
                const content = file.content.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart();
                log.info('[useNotes:goLocalOnly] importing:', id);
                await db.query(
                    `INSERT INTO notes (id, user_id, content, updated_at, deleted)
                     VALUES ($1, $2, $3, $4, false)
                     ON CONFLICT (id, user_id) DO NOTHING`,
                    [id, 'local', content, file.updatedAt],
                );
            }
        } catch (e) {
            log.warn('[useNotes:goLocalOnly] scan/import error (folder may be empty):', e);
        }

        setSyncStatus('offline');
        log.info('[useNotes:goLocalOnly] done — status: offline, userId: local');
    }, [dbRef, setCurrentFolder, setUserId, setSyncStatus]);

    const importFolder = useCallback(async (): Promise<number> => {
        if (!userId || !dbRef.current) return 0;

        const folder = await window.tauriAPI.selectFolder();
        if (!folder) return 0;

        const scanned = await (window.tauriAPI as any).scanImportFolder(folder);
        if (!scanned?.length) return 0;

        const db = dbRef.current;
        let imported = 0;

        const folderName = folder.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? '';

        for (const file of scanned as { relPath: string; content: string; updatedAt: string }[]) {
            const filename = file.relPath.replace(/\\/g, '/').split('/').pop() ?? file.relPath;
            const id = getPathId(filename, folderName);
            const content = file.content.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart();

            await writeNote(id, content, file.updatedAt, false);
            imported++;
        }

        if (navigator.onLine) await flushQueue(db);
        return imported;
    }, [userId, dbRef, writeNote]);

    return {
        setupDefaultWorkspace,
        selectFolder,
        changeFolder,
        goLocalOnly,
        importFolder
    };
}

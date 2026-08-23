import { useCallback } from 'react';
import type { SyncStatus, Note } from '../types';
import type { PGliteWithLive } from '@electric-sql/pglite/live';
import { getDb } from '../lib/electric';
import { getPathId } from '../utils/path';
import { enqueue, flushQueue } from '../lib/offlineQueue';
import { log } from '../lib/logger';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { exportNotesToDirectory } from '../utils/exportBackup';

export interface ImportProgress {
    stage: 'selecting' | 'scanning' | 'importing' | 'done';
    current: number;
    total: number;
    currentFile?: string;
}

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
        log.info('[useNotes:goLocalOnly] starting direct local-only flow without folder prompt...');
        const db = await getDb();
        dbRef.current = db;

        const docDir = await window.tauriAPI.getDocumentDir();
        const defaultPath = `${docDir}/Lama Notes`.replace(/\\/g, '/');
        await window.tauriAPI.createFolder(docDir, defaultPath);

        localStorage.setItem('notes-folder', defaultPath);
        localStorage.setItem('lama-mode', 'local');
        setCurrentFolder(defaultPath);
        setUserId('local');

        setSyncStatus('offline');
        log.info('[useNotes:goLocalOnly] done — instant offline local mode started');
    }, [dbRef, setCurrentFolder, setUserId, setSyncStatus]);

    const importFolder = useCallback(async (onProgress?: (progress: ImportProgress) => void): Promise<number> => {
        if (!userId || !dbRef.current) return 0;

        onProgress?.({ stage: 'selecting', current: 0, total: 0 });
        const folder = await window.tauriAPI.selectFolder();
        if (!folder) return 0;

        onProgress?.({ stage: 'scanning', current: 0, total: 0 });
        const scanned = await (window.tauriAPI as any).scanImportFolder(folder);
        if (!scanned?.length) {
            onProgress?.({ stage: 'done', current: 0, total: 0 });
            return 0;
        }

        const db = dbRef.current;
        let imported = 0;
        const total = scanned.length;
        const folderName = folder.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? '';

        onProgress?.({ stage: 'importing', current: 0, total });
        for (let i = 0; i < total; i++) {
            const file = (scanned as { relPath: string; content: string; updatedAt: string }[])[i];
            const filename = file.relPath.replace(/\\/g, '/').split('/').pop() ?? file.relPath;
            const id = getPathId(filename, folderName);
            const content = file.content.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart();

            await writeNote(id, content, file.updatedAt, false);
            imported++;
            onProgress?.({ stage: 'importing', current: imported, total, currentFile: filename });
        }

        if (navigator.onLine) await flushQueue(db);
        onProgress?.({ stage: 'done', current: imported, total });
        return imported;
    }, [userId, dbRef, writeNote]);

    const importFiles = useCallback(async (onProgress?: (progress: ImportProgress) => void): Promise<number> => {
        if (!userId || !dbRef.current) return 0;

        onProgress?.({ stage: 'selecting', current: 0, total: 0 });
        const selected = await open({
            multiple: true,
            directory: false,
            filters: [{ name: 'Markdown / Text', extensions: ['md', 'markdown', 'txt'] }]
        });
        if (!selected) return 0;

        const filePaths = Array.isArray(selected) ? selected : [selected];
        if (filePaths.length === 0) return 0;

        const db = dbRef.current;
        let imported = 0;
        const total = filePaths.length;

        onProgress?.({ stage: 'importing', current: 0, total });
        for (let i = 0; i < total; i++) {
            const filePath = filePaths[i];
            const filename = filePath.replace(/\\/g, '/').split('/').pop() || 'imported-note.md';
            try {
                const rawContent = await readTextFile(filePath);
                const id = getPathId(filename, '');
                const content = rawContent.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart();

                await writeNote(id, content, new Date().toISOString(), false);
                imported++;
                onProgress?.({ stage: 'importing', current: imported, total, currentFile: filename });
            } catch (err) {
                log.warn('[useNotes:importFiles] failed to read/import:', filePath, err);
            }
        }

        if (navigator.onLine) await flushQueue(db);
        onProgress?.({ stage: 'done', current: imported, total });
        return imported;
    }, [userId, dbRef, writeNote]);

    const exportBackup = useCallback(async (notesToExport: Note[]): Promise<number> => {
        const folder = await window.tauriAPI.selectFolder();
        if (!folder) return 0;
        return exportNotesToDirectory(notesToExport, folder);
    }, []);

    const resetDatabase = useCallback(async (): Promise<void> => {
        const db = dbRef.current ?? await getDb();
        if (db) {
            await db.query('DELETE FROM notes');
            await db.query('DELETE FROM app_config');
            await db.query('DELETE FROM pending_writes');
        }
        log.info('[useNotes:resetDatabase] local database tables cleared');
    }, [dbRef]);

    return {
        setupDefaultWorkspace,
        selectFolder,
        changeFolder,
        goLocalOnly,
        importFolder,
        importFiles,
        exportBackup,
        resetDatabase,
    };
}

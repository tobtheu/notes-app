import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { load } from '@tauri-apps/plugin-store';
import type { Note, AppMetadata, TauriAPI } from '../types';

let updateInstance: any = null;

/**
 * tauriAPI Implementation
 * Implements the TauriAPI interface using Tauri V2 core APIs and plugins.
 * This bridge allows the frontend to use a unified calling convention 
 * while the underlying implementation talks to the Rust backend.
 */
export const tauriAPI: TauriAPI = {
    /**
     * Filesystem Operations
     */
    selectFolder: async () => {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
            console.log('tauriAPI: Mobile detected, returning documentDir');
            return invoke<string>('get_document_dir');
        }

        const selected = await open({
            directory: true,
            multiple: false,
        });
        return selected as string | null;
    },
    getDocumentDir: () => invoke<string>('get_document_dir'),
    listNotes: (folderPath: string) => invoke<Note[]>('list_notes', { folderPath }),
    listFolders: (folderPath: string) => invoke<string[]>('list_folders', { folderPath }),
    saveNote: (data) => invoke<boolean>('save_note', data).then(() => true).catch(() => false),
    saveAsset: (rootPath, filename, contentBase64) => invoke<{ success: boolean, path?: string, error?: string }>('save_asset', { rootPath, filename, contentBase64 }),
    deleteNote: (data) => invoke<boolean>('delete_note', data).then(() => true).catch(() => false),
    renameNote: (data) => invoke<void>('rename_note', {
        rootPath: data.rootPath,
        oldFilename: data.oldFilename,
        newFilename: data.newFilename
    }).then(() => ({ success: true })).catch((e) => ({ success: false, error: e.toString() })),
    createFolder: (rootPath, folderPath) => invoke<boolean>('create_folder', { rootPath, folderPath }).then(() => true).catch(() => false),
    renameFolder: (data) => invoke<void>('rename_folder', data).then(() => ({ success: true })).catch((e: any) => ({ success: false, error: e.toString() })),
    deleteFolderRecursive: (rootPath, folderPath) => invoke<boolean>('delete_folder_recursive', { rootPath, folderPath }).then(() => true).catch(() => false),
    deleteFolderMoveContents: (data) => invoke<boolean>('delete_folder_move_contents', data).then(() => true).catch(() => false),

    /**
     * Metadata & Persistence
     * The .metadata file stores visual properties (icons, colors) for categories.
     */
    readMetadata: (rootPath) => invoke<AppMetadata>('read_metadata', { rootPath }),
    saveMetadata: (data) => invoke<boolean>('save_metadata', data).then(() => true).catch(() => false),

    exportPdf: async (htmlContent: string) => {
        try {
            // Standard web technique to print specific content: 
            // 1. Create a hidden iframe
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);

            // 2. Write the content to the iframe
            const doc = iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write(`
                    <html>
                        <head>
                            <title>Note Export</title>
                        </head>
                        <body>${htmlContent}</body>
                    </html>
                `);
                doc.close();

                // 3. Trigger print and cleanup
                // Wait for any potential layout/resource loading
                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();

                    // Cleanup after a delay (giving time for the print dialog to open)
                    setTimeout(() => {
                        document.body.removeChild(iframe);
                    }, 1000);
                }, 500);

                return true;
            }
            return false;
        } catch (e) {
            console.error('PDF Export failed:', e);
            return false;
        }
    },

    /**
     * Real-time Watching
     * Leverages the Rust 'notify' crate through a custom command to detect external changes.
     */
    startWatch: (folderPath: string) => invoke('start_watch', { folderPath }),
    onFileChanged: (callback) => {
        let unlisten: (() => void) | null = null;
        let isCancelled = false;
        listen('file-changed', (_event: any) => {
            // Re-triggering list calls on the frontend upon change
            callback({ type: 'change', path: '' });
        }).then((fn) => {
            if (isCancelled) {
                fn();
            } else {
                unlisten = fn;
            }
        });
        return () => {
            isCancelled = true;
            if (unlisten) unlisten();
        };
    },

    /**
     * Update Management
     * Integrates with @tauri-apps/plugin-updater for v2.
     * Communicates status back to the UI via CustomEvents on the window object.
     */
    getAppVersion: () => invoke<string>('get_app_version'),
    checkForUpdates: async () => {
        try {
            const update = await check();
            if (update) {
                updateInstance = update;
                window.dispatchEvent(new CustomEvent('tauri-update-status', {
                    detail: { type: 'available', version: update.version }
                }));
                return;
            } else {
                window.dispatchEvent(new CustomEvent('tauri-update-status', {
                    detail: { type: 'not-available' }
                }));
            }
        } catch (e) {
            console.error('Update check failed:', e);
            window.dispatchEvent(new CustomEvent('tauri-update-status', {
                detail: { type: 'error', error: e instanceof Error ? e.message : String(e) }
            }));
        }
    },
    downloadUpdate: async () => {
        if (!updateInstance) return;
        try {
            await updateInstance.downloadAndInstall((progress: any) => {
                if (progress.event === 'Started') {
                    window.dispatchEvent(new CustomEvent('tauri-update-status', {
                        detail: { type: 'downloading', progress: 0 }
                    }));
                } else if (progress.event === 'Progress') {
                    const percent = (progress.data.downloaded / progress.data.contentLength) * 100;
                    window.dispatchEvent(new CustomEvent('tauri-update-status', {
                        detail: { type: 'downloading', progress: percent }
                    }));
                } else if (progress.event === 'Finished') {
                    window.dispatchEvent(new CustomEvent('tauri-update-status', {
                        detail: { type: 'downloaded' }
                    }));
                }
            });
        } catch (e) {
            window.dispatchEvent(new CustomEvent('tauri-update-status', {
                detail: { type: 'error', error: e instanceof Error ? e.message : String(e) }
            }));
        }
    },
    quitAndInstall: async () => {
        await relaunch();
    },
    onUpdateStatus: (callback) => {
        const handler = (event: any) => callback(event.detail);
        window.addEventListener('tauri-update-status', handler);
        return () => window.removeEventListener('tauri-update-status', handler);
    },

    /**
     * GitHub Synchronization Setup (via Store and Rust Command)
     */
    connectGithub: (token, folderPath) => invoke<string>('connect_github', { token, folderPath })
        .then((username) => ({ success: true, username }))
        .catch((e: any) => ({ success: false, error: e.toString() })),
    startGithubOAuth: () => invoke<{
        deviceCode: string;
        userCode: string;
        verificationUri: string;
        interval: number;
        expiresIn: number;
    }>('start_github_oauth'),
    completeGithubOAuth: (deviceCode, interval, folderPath) =>
        invoke<string>('complete_github_oauth', { deviceCode, interval, folderPath }),
    syncNow: (folderPath) => invoke<{
        hadChanges: boolean;
        hadConflicts: boolean;
        conflictPairs: { original: string; conflictCopy: string }[];
        pushSucceeded: boolean;
    }>('sync_now', { folderPath }),
    getGithubToken: async () => {
        try {
            const store = await load('settings.json');
            return await store.get<{ token: string, username: string }>('github-sync') || null;
        } catch { return null; }
    },
    saveGithubToken: async (token, username) => {
        try {
            const store = await load('settings.json');
            await store.set('github-sync', { token, username });
            await store.save();
            return true;
        } catch { return false; }
    },
    disconnectGithub: async () => {
        try {
            const store = await load('settings.json');
            await store.delete('github-sync');
            await store.save();
            return true;
        } catch { return false; }
    },
    clearGithubCredentials: () => invoke<void>('clear_github_credentials')
};

// Attach to window globally
if (typeof window !== 'undefined') {
    (window as any).tauriAPI = tauriAPI;
}

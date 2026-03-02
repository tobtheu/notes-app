import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
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
        const selected = await open({
            directory: true,
            multiple: false,
        });
        return selected as string | null;
    },
    listNotes: (folderPath: string) => invoke<Note[]>('list_notes', { folderPath }),
    listFolders: (folderPath: string) => invoke<string[]>('list_folders', { folderPath }),
    saveNote: (data) => invoke<boolean>('save_note', data).then(() => true).catch(() => false),
    deleteNote: (data) => invoke<boolean>('delete_note', data).then(() => true).catch(() => false),
    renameNote: (data) => invoke<void>('rename_note', {
        folderPath: data.folderPath,
        oldFilename: data.oldFilename,
        newFilename: data.newFilename
    }).then(() => ({ success: true })).catch((e) => ({ success: false, error: e.toString() })),
    createFolder: (folderPath) => invoke<boolean>('create_folder', { folderPath }).then(() => true).catch(() => false),
    renameFolder: (data) => invoke<void>('rename_folder', data).then(() => ({ success: true })).catch((e: any) => ({ success: false, error: e.toString() })),
    deleteFolderRecursive: (folderPath) => invoke<boolean>('delete_folder_recursive', { folderPath }).then(() => true).catch(() => false),
    deleteFolderMoveContents: (data) => invoke<boolean>('delete_folder_move_contents', data).then(() => true).catch(() => false),

    /**
     * Metadata & Persistence
     * The .metadata file stores visual properties (icons, colors) for categories.
     */
    readMetadata: (rootPath) => invoke<AppMetadata>('read_metadata', { rootPath }),
    saveMetadata: (data) => invoke<boolean>('save_metadata', data).then(() => true).catch(() => false),

    exportPdf: (_html) => Promise.resolve(false), // Placeholder: PDF logic is usually handled via system print

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
    }
};

// Attach to window globally
if (typeof window !== 'undefined') {
    (window as any).tauriAPI = tauriAPI;
}

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import type { Note, AppMetadata, ElectronAPI } from '../types';

let updateInstance: any = null;

export const tauriAPI: ElectronAPI = {
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
    readMetadata: (rootPath) => invoke<AppMetadata>('read_metadata', { rootPath }),
    saveMetadata: (data) => invoke<boolean>('save_metadata', data).then(() => true).catch(() => false),
    exportPdf: (_html) => Promise.resolve(false), // TODO: Implement PDF export
    startWatch: (folderPath: string) => invoke('start_watch', { folderPath }),
    onFileChanged: (callback) => {
        let unlisten: (() => void) | null = null;
        listen('file-changed', (_event: any) => {
            callback({ type: 'change', path: '' }); // Simplified event for now
        }).then((fn) => {
            unlisten = fn;
        });
        return () => {
            if (unlisten) unlisten();
        };
    },
    getAppVersion: () => invoke<string>('get_app_version'),
    checkForUpdates: async () => {
        try {
            const update = await check();
            if (update) {
                updateInstance = update;
                // Emit event for App.tsx to show UpdateModal
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
                // If it's a progress event, we need a way to notify the UI
                // We'll rely on the listener registered via onUpdateStatus
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

        // Also do an initial check to trigger the process if needed? 
        // No, keep it passive for the listener.

        // Return unsubscribe
        return () => window.removeEventListener('tauri-update-status', handler);
    }
};

// For backward compatibility and globally making it available (optional, but avoids too many changes)
if (typeof window !== 'undefined') {
    (window as any).electronAPI = tauriAPI;
}

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import type { TauriAPI } from '../types';

let updateInstance: Awaited<ReturnType<typeof import('@tauri-apps/plugin-updater').check>> | null = null;

/**
 * tauriAPI Implementation
 * Implements the TauriAPI interface using Tauri V2 core APIs and plugins.
 */
export const tauriAPI: TauriAPI = {
    // Workspace
    selectFolder: async () => {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            return invoke<string>('get_document_dir');
        }
        const selected = await open({ directory: true, multiple: false });
        return selected as string | null;
    },
    getDocumentDir: () => invoke<string>('get_document_dir'),

    // File mirror
    writeMirrorFile: (payload) => invoke<void>('write_mirror_file', { payload }),
    deleteMirrorFile: (payload) => invoke<void>('delete_mirror_file', { payload }),
    scanImportFolder: (folderPath: string) =>
        invoke<{ relPath: string; content: string; updatedAt: string }[]>('scan_import_folder', { folderPath }),

    // Folder operations
    listFolders: (folderPath: string) => invoke<string[]>('list_folders', { folderPath }),
    createFolder: (rootPath: string, folderPath: string) =>
        invoke<boolean>('create_folder', { rootPath, folderPath }).then(() => true).catch(() => false),
    renameFolder: (data) =>
        invoke<void>('rename_folder', data)
            .then(() => ({ success: true }))
            .catch((e: Error) => ({ success: false, error: e.toString() })),
    deleteFolderRecursive: (rootPath: string, folderPath: string) =>
        invoke<boolean>('delete_folder_recursive', { rootPath, folderPath }).then(() => true).catch(() => false),
    deleteFolderMoveContents: (data) =>
        invoke<boolean>('delete_folder_move_contents', data).then(() => true).catch(() => false),

    // Assets
    saveAsset: (rootPath: string, filename: string, contentBase64: string) =>
        invoke<{ success: boolean; path?: string; error?: string }>('save_asset', { rootPath, filename, contentBase64 }),

    // App info
    getAppVersion: () => invoke<string>('get_app_version'),

    // File watcher
    startWatch: (folderPath: string) => invoke('start_watch', { folderPath }),
    onFileChanged: (callback) => {
        let unlisten: (() => void) | null = null;
        let isCancelled = false;
        listen('file-changed', () => {
            callback({ type: 'change', path: '' });
        }).then((fn) => {
            if (isCancelled) { fn(); } else { unlisten = fn; }
        });
        return () => { isCancelled = true; if (unlisten) unlisten(); };
    },

    // PDF export
    exportPdf: async (htmlContent: string): Promise<void> => {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(`<html><head><title>Note Export</title></head><body>${htmlContent}</body></html>`);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => document.body.removeChild(iframe), 1000);
            }, 500);
        }
    },

    // Auto-updater
    checkForUpdates: async () => {
        try {
            const { check } = await import('@tauri-apps/plugin-updater');
            const update = await check();
            if (update) {
                updateInstance = update;
                window.dispatchEvent(new CustomEvent('tauri-update-status', {
                    detail: { type: 'available', version: update.version }
                }));
            } else {
                window.dispatchEvent(new CustomEvent('tauri-update-status', {
                    detail: { type: 'not-available' }
                }));
            }
        } catch (e) {
            window.dispatchEvent(new CustomEvent('tauri-update-status', {
                detail: { type: 'error', error: e instanceof Error ? e.message : String(e) }
            }));
        }
    },
    downloadUpdate: async () => {
        if (!updateInstance) return;
        try {
            await updateInstance.downloadAndInstall((progress: { event: string; data?: { downloaded: number; contentLength: number } }) => {
                if (progress.event === 'Started') {
                    window.dispatchEvent(new CustomEvent('tauri-update-status', { detail: { type: 'downloading', progress: 0 } }));
                } else if (progress.event === 'Progress' && progress.data) {
                    const percent = (progress.data.downloaded / progress.data.contentLength) * 100;
                    window.dispatchEvent(new CustomEvent('tauri-update-status', { detail: { type: 'downloading', progress: percent } }));
                } else if (progress.event === 'Finished') {
                    window.dispatchEvent(new CustomEvent('tauri-update-status', { detail: { type: 'downloaded' } }));
                }
            });
        } catch (e) {
            window.dispatchEvent(new CustomEvent('tauri-update-status', {
                detail: { type: 'error', error: e instanceof Error ? e.message : String(e) }
            }));
        }
    },
    quitAndInstall: async () => {
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
    },
    onUpdateStatus: (callback) => {
        const handler = (event: Event) => callback((event as CustomEvent).detail);
        window.addEventListener('tauri-update-status', handler);
        return () => window.removeEventListener('tauri-update-status', handler);
    },

    // Auth
    supabaseSignIn: (email: string, password: string) =>
        invoke<{ userId: string; email: string }>('supabase_sign_in', { email, password }),
    supabaseSignUp: (email: string, password: string) =>
        invoke<{ userId: string; email: string }>('supabase_sign_up', { email, password }),
    supabaseSignOut: () => invoke<void>('supabase_sign_out'),
    getSupabaseUser: () => invoke<{ userId: string; email: string } | null>('get_supabase_user'),
    getSupabaseCredentials: () =>
        invoke<{ userId: string; email: string; accessToken: string; refreshToken: string } | null>('get_supabase_credentials'),
    refreshSupabaseToken: () =>
        invoke<{ userId: string; email: string; accessToken: string; refreshToken: string }>('refresh_supabase_token'),

    // Legacy GitHub (kept for existing users)
    clearGithubCredentials: () => invoke<void>('clear_github_credentials'),
};

// Attach to window globally
if (typeof window !== 'undefined') {
    (window as any).tauriAPI = tauriAPI;
}

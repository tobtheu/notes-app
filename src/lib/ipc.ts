import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import type { Note, AppMetadata, ElectronAPI } from '../types';

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
    renameFolder: (data) => invoke<void>('rename_folder', data).then(() => ({ success: true })).catch((e) => ({ success: false, error: e.toString() })),
    deleteFolderRecursive: (folderPath) => invoke<boolean>('delete_folder_recursive', { folderPath }).then(() => true).catch(() => false),
    deleteFolderMoveContents: (data) => invoke<boolean>('delete_folder_move_contents', data).then(() => true).catch(() => false),
    readMetadata: (rootPath) => invoke<AppMetadata>('read_metadata', { rootPath }),
    saveMetadata: (data) => invoke<boolean>('save_metadata', data).then(() => true).catch(() => false),
    exportPdf: (_html) => Promise.resolve(false), // TODO: Implement PDF export
    startWatch: (folderPath: string) => invoke('start_watch', { folderPath }),
    onFileChanged: (callback) => {
        let unlisten: (() => void) | null = null;
        listen('file-changed', (_event) => {
            callback({ type: 'change', path: '' }); // Simplified event for now
        }).then((fn) => {
            unlisten = fn;
        });
        return () => {
            if (unlisten) unlisten();
        };
    },
    getAppVersion: () => invoke<string>('get_app_version'),
    checkForUpdates: () => Promise.resolve(), // Tauri has its own updater logic
    downloadUpdate: () => Promise.resolve(),
    quitAndInstall: () => Promise.resolve(),
    onUpdateStatus: (_callback) => () => { }
};

// For backward compatibility and globally making it available (optional, but avoids too many changes)
if (typeof window !== 'undefined') {
    (window as any).electronAPI = tauriAPI;
}

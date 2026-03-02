/**
 * Note Interface
 * Represents a single markdown file in the filesystem.
 */
export interface Note {
    filename: string;
    folder: string; // Relative path from the root storage directory
    content: string;
    updatedAt: string;
}

/**
 * FolderMetadata Interface
 * Configurable visual properties for a folder/category.
 */
export interface FolderMetadata {
    icon?: string;
    color?: string;
}

/**
 * AppMetadata Interface
 * The central configuration object persisted as '.metadata' in the root folder.
 * Synchronizes layout and visuals across devices.
 */
export interface AppMetadata {
    folders: Record<string, FolderMetadata>; // Key is the folder path
    pinnedNotes: string[];
    folderOrder?: string[];
    settings?: any; // Contains both synced settings (like accent color) and local-only settings
}

/**
 * TauriAPI Interface
 * A bridge naming convention. In this Tauri V2 project, 
 * this interface defines all IPC calls to the Rust backend.
 * Access via `window.tauriAPI`.
 */
export interface TauriAPI {
    selectFolder: () => Promise<string | null>;
    listNotes: (folderPath: string) => Promise<Note[]>;
    listFolders: (folderPath: string) => Promise<string[]>;
    saveNote: (data: { folderPath: string; filename: string; content: string }) => Promise<boolean>;
    deleteNote: (data: { folderPath: string; filename: string }) => Promise<boolean>;
    renameNote: (data: { folderPath: string; oldFilename: string; newFilename: string }) => Promise<{ success: boolean; error?: string }>;
    createFolder: (folderPath: string) => Promise<boolean>;
    renameFolder: (data: { rootPath: string; oldName: string; newName: string }) => Promise<{ success: boolean; error?: string }>;
    deleteFolderRecursive: (folderPath: string) => Promise<boolean>;
    deleteFolderMoveContents: (data: { folderPath: string; rootPath: string }) => Promise<boolean>;
    readMetadata: (rootPath: string) => Promise<AppMetadata>;
    saveMetadata: (data: { rootPath: string; metadata: AppMetadata }) => Promise<boolean>;
    exportPdf: (html: string) => Promise<boolean>;
    startWatch: (folderPath: string) => void;
    onFileChanged: (callback: (data: { type: 'add' | 'change' | 'unlink'; path: string }) => void) => () => void;
    getAppVersion: () => Promise<string>;
    checkForUpdates: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    quitAndInstall: () => Promise<void>;
    onUpdateStatus: (callback: (status: {
        type: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
        progress?: number;
        error?: string;
        version?: string;
    }) => void) => () => void;
}

declare global {
    interface Window {
        tauriAPI: TauriAPI;
    }
}

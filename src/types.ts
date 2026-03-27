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

export interface ConflictPair {
    original: string;    // Relative path of the local (winning) file
    conflictCopy: string; // Relative path of the newly created conflict copy
}

/**
 * TauriAPI Interface
 * A bridge naming convention. In this Tauri V2 project, 
 * this interface defines all IPC calls to the Rust backend.
 * Access via `window.tauriAPI`.
 */
export interface TauriAPI {
    selectFolder: () => Promise<string | null>;
    getDocumentDir: () => Promise<string>;
    listNotes: (folderPath: string) => Promise<Note[]>;
    listFolders: (folderPath: string) => Promise<string[]>;
    saveNote: (data: { rootPath: string; folderPath: string; filename: string; content: string }) => Promise<boolean>;
    saveAsset: (rootPath: string, filename: string, contentBase64: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    deleteNote: (data: { rootPath: string; folderPath: string; filename: string }) => Promise<boolean>;
    renameNote: (data: { rootPath: string; oldFilename: string; newFilename: string }) => Promise<{ success: boolean; error?: string }>;
    createFolder: (rootPath: string, folderPath: string) => Promise<boolean>;
    renameFolder: (data: { rootPath: string; oldName: string; newName: string }) => Promise<{ success: boolean; error?: string }>;
    deleteFolderRecursive: (rootPath: string, folderPath: string) => Promise<boolean>;
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
    clearGithubCredentials: () => Promise<void>;
    connectGithub: (token: string, folderPath: string) => Promise<{ success: boolean; username?: string; error?: string }>;
    syncNow: (folderPath: string) => Promise<{ hadChanges: boolean; hadConflicts: boolean; conflictPairs: ConflictPair[]; pushSucceeded: boolean }>;
    startGithubOAuth: () => Promise<{ deviceCode: string; userCode: string; verificationUri: string; interval: number; expiresIn: number }>;
    completeGithubOAuth: (deviceCode: string, interval: number, folderPath: string) => Promise<string>;
    getGithubToken: () => Promise<{ token: string, username: string } | null>;
    saveGithubToken: (token: string, username: string) => Promise<boolean>;
    disconnectGithub: () => Promise<boolean>;
    supabaseSignIn: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    supabaseSignUp: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    supabaseSignOut: () => Promise<void>;
    getSupabaseUser: () => Promise<{ userId: string; email: string } | null>;
    resetSyncState: (folderPath: string) => Promise<void>;
}

declare global {
    interface Window {
        tauriAPI: TauriAPI;
        __TAURI_INTERNALS__?: {
            metadata?: {
                platform?: string;
            };
        };
    }
}

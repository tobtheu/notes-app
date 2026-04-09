/**
 * Note Interface
 * Represents a single note. The canonical store is now PGlite (local SQLite)
 * synced by ElectricSQL. The .md files on disk are a read-only mirror.
 */
export interface Note {
    filename: string;
    folder: string;
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
 * Stored in PGlite `app_config` table and synced to Supabase.
 */
export interface AppMetadata {
    folders: Record<string, FolderMetadata>;
    pinnedNotes: string[];
    folderOrder?: string[];
    settings?: any;
}

/**
 * Supabase credentials returned to the frontend.
 * Used to initialise supabase-js and ElectricSQL auth.
 */
export interface SupabaseCredentialsResult {
    userId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
}

/**
 * TauriAPI Interface
 * All IPC calls to the Rust backend via window.tauriAPI.
 *
 * Removed (handled by ElectricSQL now):
 *   - syncNow, resetSyncState, listNotes, saveNote, deleteNote, renameNote
 *   - readMetadata, saveMetadata (now in PGlite)
 *   - startGithubOAuth, completeGithubOAuth, connectGithub, getGithubToken,
 *     saveGithubToken, disconnectGithub (legacy desktop only)
 *
 * Added:
 *   - writeMirrorFile, deleteMirrorFile (file mirror for .md files)
 *   - getSupabaseCredentials, refreshSupabaseToken (for Electric auth)
 */
export interface TauriAPI {
    // Workspace
    selectFolder: () => Promise<string | null>;
    getDocumentDir: () => Promise<string>;

    // File mirror (write-only, Electric is the canonical source)
    writeMirrorFile: (payload: { mirrorFolder: string; note: Note }) => Promise<void>;
    deleteMirrorFile: (payload: { mirrorFolder: string; noteId: string }) => Promise<void>;

    // Folder operations (still filesystem-backed for the mirror)
    listFolders: (folderPath: string) => Promise<string[]>;
    createFolder: (rootPath: string, folderPath: string) => Promise<boolean>;
    renameFolder: (data: { rootPath: string; oldName: string; newName: string }) => Promise<{ success: boolean; error?: string }>;
    deleteFolderRecursive: (rootPath: string, folderPath: string) => Promise<boolean>;
    deleteFolderMoveContents: (data: { folderPath: string; rootPath: string }) => Promise<boolean>;

    // Assets
    saveAsset: (rootPath: string, filename: string, contentBase64: string) => Promise<{ success: boolean; path?: string; error?: string }>;

    // App info
    getAppVersion: () => Promise<string>;

    // File watcher (fires events when mirror files change externally)
    startWatch: (folderPath: string) => void;
    onFileChanged: (callback: (data: { type: 'add' | 'change' | 'unlink'; path: string }) => void) => () => void;

    // Auto-updater (desktop only)
    checkForUpdates: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    quitAndInstall: () => Promise<void>;
    onUpdateStatus: (callback: (status: {
        type: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
        progress?: number;
        error?: string;
        version?: string;
    }) => void) => () => void;

    // Auth (Supabase — managed by Rust backend, tokens stored in secure store)
    supabaseSignIn: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    supabaseSignUp: (email: string, password: string) => Promise<{ userId: string; email: string }>;
    supabaseSignOut: () => Promise<void>;
    getSupabaseUser: () => Promise<{ userId: string; email: string } | null>;
    getSupabaseCredentials: () => Promise<SupabaseCredentialsResult | null>;
    refreshSupabaseToken: () => Promise<SupabaseCredentialsResult>;

    // Legacy GitHub (desktop only, kept for existing users)
    clearGithubCredentials: () => Promise<void>;
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

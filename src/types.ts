export interface Note {
    filename: string;
    folder: string; // Relative path from root
    content: string;
    updatedAt: string;
}

export interface FolderMetadata {
    icon?: string;
    color?: string;
}

export interface AppMetadata {
    folders: Record<string, FolderMetadata>;
    pinnedNotes: string[];
    folderOrder?: string[];
    settings?: any;
}

export interface ElectronAPI {
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
        electronAPI: ElectronAPI;
    }
}

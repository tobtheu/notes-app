export interface Note {
    filename: string;
    content: string;
    updatedAt: string;
}

export interface ElectronAPI {
    selectFolder: () => Promise<string | null>;
    listNotes: (folderPath: string) => Promise<Note[]>;
    saveNote: (data: { folderPath: string; filename: string; content: string }) => Promise<boolean>;
    deleteNote: (data: { folderPath: string; filename: string }) => Promise<boolean>;
    createFolder: (folderPath: string) => Promise<boolean>;
    exportPdf: (html: string) => Promise<boolean>;
    startWatch: (folderPath: string) => void;
    onFileChanged: (callback: (data: { type: 'add' | 'change' | 'unlink'; path: string }) => void) => () => void;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

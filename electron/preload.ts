import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    listNotes: (folderPath: string) => ipcRenderer.invoke('list-notes', folderPath),
    listFolders: (folderPath: string) => ipcRenderer.invoke('list-folders', folderPath),
    saveNote: (data: { folderPath: string; filename: string; content: string }) =>
        ipcRenderer.invoke('save-note', data),
    deleteNote: (data: { folderPath: string; filename: string }) =>
        ipcRenderer.invoke('delete-note', data),
    renameNote: (data: { folderPath: string; oldFilename: string; newFilename: string }) =>
        ipcRenderer.invoke('rename-note', data),
    createFolder: (folderPath: string) => ipcRenderer.invoke('create-folder', folderPath),
    renameFolder: (data: { rootPath: string; oldName: string; newName: string }) =>
        ipcRenderer.invoke('rename-folder', data),
    deleteFolderRecursive: (folderPath: string) => ipcRenderer.invoke('delete-folder-recursive', folderPath),
    deleteFolderMoveContents: (data: { folderPath: string; rootPath: string }) =>
        ipcRenderer.invoke('delete-folder-move-contents', data),
    readMetadata: (rootPath: string) => ipcRenderer.invoke('read-metadata', rootPath),
    saveMetadata: (data: { rootPath: string; metadata: any }) =>
        ipcRenderer.invoke('save-metadata', data),
    exportPdf: (html: string) => ipcRenderer.invoke('export-pdf', html),
    startWatch: (folderPath: string) => ipcRenderer.send('start-watch', folderPath),
    onFileChanged: (callback: (data: any) => void) => {
        const subscription = (_: any, data: any) => callback(data);
        ipcRenderer.on('file-changed', subscription);
        return () => {
            ipcRenderer.removeListener('file-changed', subscription);
        };
    }
});

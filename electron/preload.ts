import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    listNotes: (folderPath: string) => ipcRenderer.invoke('list-notes', folderPath),
    saveNote: (data: { folderPath: string; filename: string; content: string }) =>
        ipcRenderer.invoke('save-note', data),
    deleteNote: (data: { folderPath: string; filename: string }) =>
        ipcRenderer.invoke('delete-note', data),
    createFolder: (folderPath: string) => ipcRenderer.invoke('create-folder', folderPath),
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

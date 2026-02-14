"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => electron_1.ipcRenderer.invoke('select-folder'),
    listNotes: (folderPath) => electron_1.ipcRenderer.invoke('list-notes', folderPath),
    saveNote: (data) => electron_1.ipcRenderer.invoke('save-note', data),
    deleteNote: (data) => electron_1.ipcRenderer.invoke('delete-note', data),
    createFolder: (folderPath) => electron_1.ipcRenderer.invoke('create-folder', folderPath),
    exportPdf: (html) => electron_1.ipcRenderer.invoke('export-pdf', html),
    startWatch: (folderPath) => electron_1.ipcRenderer.send('start-watch', folderPath),
    onFileChanged: (callback) => {
        const subscription = (_, data) => callback(data);
        electron_1.ipcRenderer.on('file-changed', subscription);
        return () => {
            electron_1.ipcRenderer.removeListener('file-changed', subscription);
        };
    }
});

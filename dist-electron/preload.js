"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => electron_1.ipcRenderer.invoke('select-folder'),
    listNotes: (folderPath) => electron_1.ipcRenderer.invoke('list-notes', folderPath),
    listFolders: (folderPath) => electron_1.ipcRenderer.invoke('list-folders', folderPath),
    saveNote: (data) => electron_1.ipcRenderer.invoke('save-note', data),
    deleteNote: (data) => electron_1.ipcRenderer.invoke('delete-note', data),
    renameNote: (data) => electron_1.ipcRenderer.invoke('rename-note', data),
    createFolder: (folderPath) => electron_1.ipcRenderer.invoke('create-folder', folderPath),
    renameFolder: (data) => electron_1.ipcRenderer.invoke('rename-folder', data),
    deleteFolderRecursive: (folderPath) => electron_1.ipcRenderer.invoke('delete-folder-recursive', folderPath),
    deleteFolderMoveContents: (data) => electron_1.ipcRenderer.invoke('delete-folder-move-contents', data),
    readMetadata: (rootPath) => electron_1.ipcRenderer.invoke('read-metadata', rootPath),
    saveMetadata: (data) => electron_1.ipcRenderer.invoke('save-metadata', data),
    exportPdf: (html) => electron_1.ipcRenderer.invoke('export-pdf', html),
    startWatch: (folderPath) => electron_1.ipcRenderer.send('start-watch', folderPath),
    onFileChanged: (callback) => {
        const subscription = (_, data) => callback(data);
        electron_1.ipcRenderer.on('file-changed', subscription);
        return () => {
            electron_1.ipcRenderer.removeListener('file-changed', subscription);
        };
    },
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    checkForUpdates: () => electron_1.ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => electron_1.ipcRenderer.invoke('download-update'),
    quitAndInstall: () => electron_1.ipcRenderer.invoke('quit-and-install'),
    onUpdateStatus: (callback) => {
        const subscription = (_, data) => callback(data);
        electron_1.ipcRenderer.on('update-status', subscription);
        return () => {
            electron_1.ipcRenderer.removeListener('update-status', subscription);
        };
    }
});

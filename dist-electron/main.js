"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const chokidar_1 = require("chokidar");
let mainWindow = null;
let watcher = null;
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    electron_1.app.quit();
}
const createWindow = () => {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
};
electron_1.app.on('ready', createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
// --- IPC Handlers for File System ---
electron_1.ipcMain.handle('select-folder', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('IPC: select-folder called');
    try {
        const result = yield electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
        });
        console.log('Dialog result:', result);
        if (result.canceled)
            return null;
        return result.filePaths[0];
    }
    catch (err) {
        console.error('Dialog error:', err);
        throw err;
    }
}));
electron_1.ipcMain.handle('list-notes', (_, folderPath) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const files = yield fs_extra_1.default.readdir(folderPath);
        const notes = yield Promise.all(files
            .filter((file) => file.endsWith('.md'))
            .map((file) => __awaiter(void 0, void 0, void 0, function* () {
            const content = yield fs_extra_1.default.readFile(path_1.default.join(folderPath, file), 'utf-8');
            const stats = yield fs_extra_1.default.stat(path_1.default.join(folderPath, file));
            return {
                filename: file,
                content,
                updatedAt: stats.mtime.toISOString(),
            };
        })));
        return notes;
    }
    catch (error) {
        console.error('Error listing notes:', error);
        return [];
    }
}));
electron_1.ipcMain.handle('save-note', (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { folderPath, filename, content }) {
    try {
        yield fs_extra_1.default.writeFile(path_1.default.join(folderPath, filename), content, 'utf-8');
        return true;
    }
    catch (error) {
        console.error('Error saving note:', error);
        return false;
    }
}));
electron_1.ipcMain.handle('delete-note', (_1, _a) => __awaiter(void 0, [_1, _a], void 0, function* (_, { folderPath, filename }) {
    try {
        yield fs_extra_1.default.remove(path_1.default.join(folderPath, filename));
        return true;
    }
    catch (error) {
        console.error('Error deleting note:', error);
        return false;
    }
}));
electron_1.ipcMain.handle('create-folder', (_, folderPath) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield fs_extra_1.default.ensureDir(folderPath);
        return true;
    }
    catch (error) {
        console.error('Error creating folder:', error);
        return false;
    }
}));
electron_1.ipcMain.handle('export-pdf', (_, html) => __awaiter(void 0, void 0, void 0, function* () {
    const pdfWindow = new electron_1.BrowserWindow({ show: false });
    try {
        yield pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        const pdfData = yield pdfWindow.webContents.printToPDF({});
        const { filePath } = yield electron_1.dialog.showSaveDialog(mainWindow, {
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });
        if (filePath) {
            yield fs_extra_1.default.writeFile(filePath, pdfData);
            return true;
        }
        return false;
    }
    catch (error) {
        console.error('Error exporting PDF:', error);
        return false;
    }
    finally {
        pdfWindow.close();
    }
}));
// Watcher Logic
electron_1.ipcMain.on('start-watch', (_, folderPath) => {
    if (watcher) {
        watcher.close();
    }
    watcher = (0, chokidar_1.watch)(folderPath, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
        depth: 0 // simple for now, maybe increase if subfolders needed
    });
    watcher
        .on('add', (path) => {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('file-changed', { type: 'add', path });
    })
        .on('change', (path) => {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('file-changed', { type: 'change', path });
    })
        .on('unlink', (path) => {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('file-changed', { type: 'unlink', path });
    });
});

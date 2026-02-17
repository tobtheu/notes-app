"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const chokidar_1 = require("chokidar");
let mainWindow = null;
let watcher = null;
const createWindow = () => {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
};
electron_1.app.whenReady().then(createWindow);
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
// Helper for recursive file listing
function getFilesRecursively(dir) {
    return __awaiter(this, void 0, void 0, function* () {
        const dirents = yield fs.readdir(dir, { withFileTypes: true });
        const files = yield Promise.all(dirents.map((dirent) => {
            const res = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? getFilesRecursively(res) : Promise.resolve([res]);
        }));
        return Array.prototype.concat(...files);
    });
}
// Helper for recursive directory listing
function getDirectoriesRecursively(dir, baseDir) {
    return __awaiter(this, void 0, void 0, function* () {
        const dirents = yield fs.readdir(dir, { withFileTypes: true });
        const dirs = yield Promise.all(dirents.map((dirent) => __awaiter(this, void 0, void 0, function* () {
            if (dirent.isDirectory() && !dirent.name.startsWith('.')) {
                const fullPath = path.resolve(dir, dirent.name);
                const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
                const subDirs = yield getDirectoriesRecursively(fullPath, baseDir);
                return [relativePath, ...subDirs];
            }
            return [];
        })));
        return Array.prototype.concat(...dirs);
    });
}
// IPC Handlers
electron_1.ipcMain.handle('select-folder', () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
}));
electron_1.ipcMain.handle('list-notes', (_event, folderPath) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const files = yield getFilesRecursively(folderPath);
        return Promise.all(files
            .filter((file) => file.endsWith('.md'))
            .map((file) => __awaiter(void 0, void 0, void 0, function* () {
            const content = yield fs.readFile(file, 'utf-8');
            const stats = yield fs.stat(file);
            const relativePath = path.relative(folderPath, file);
            const dirname = path.dirname(relativePath).replace(/\\/g, '/');
            return {
                filename: path.basename(file),
                folder: dirname === '.' ? '' : dirname,
                content,
                updatedAt: stats.mtime.toISOString(),
            };
        })));
    }
    catch (error) {
        console.error('Error listing notes:', error);
        return [];
    }
}));
electron_1.ipcMain.handle('list-folders', (_event, folderPath) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const files = yield fs.readdir(folderPath, { withFileTypes: true });
        return files
            .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
            .map((d) => d.name);
    }
    catch (error) {
        console.error('Error listing folders:', error);
        return [];
    }
}));
electron_1.ipcMain.handle('save-note', (_event_1, _a) => __awaiter(void 0, [_event_1, _a], void 0, function* (_event, { folderPath, filename, content }) {
    // folderPath here might be the absolute path to the folder, or root + relative
    // Let's assume the caller provides the full absolute path to the directory where the file lives
    yield fs.ensureDir(folderPath);
    yield fs.writeFile(path.join(folderPath, filename), content, 'utf-8');
    return true;
}));
electron_1.ipcMain.handle('delete-note', (_event_1, _a) => __awaiter(void 0, [_event_1, _a], void 0, function* (_event, { folderPath, filename }) {
    yield fs.remove(path.join(folderPath, filename));
    return true;
}));
electron_1.ipcMain.handle('rename-note', (_event_1, _a) => __awaiter(void 0, [_event_1, _a], void 0, function* (_event, { folderPath, oldFilename, newFilename }) {
    try {
        const oldPath = path.join(folderPath, oldFilename);
        const newPath = path.join(folderPath, newFilename);
        // Special handling for case-only changes on Windows
        if (oldPath.toLowerCase() === newPath.toLowerCase() && oldPath !== newPath) {
            const tempPath = `${oldPath}.tmp`;
            yield fs.rename(oldPath, tempPath);
            yield fs.rename(tempPath, newPath);
        }
        else {
            yield fs.rename(oldPath, newPath);
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error renaming note:', error);
        return { success: false, error: error.message };
    }
}));
electron_1.ipcMain.handle('rename-folder', (_event_1, _a) => __awaiter(void 0, [_event_1, _a], void 0, function* (_event, { rootPath, oldName, newName }) {
    try {
        const oldPath = path.join(rootPath, oldName);
        const newPath = path.join(rootPath, newName);
        if (oldPath.toLowerCase() === newPath.toLowerCase() && oldPath !== newPath) {
            const tempPath = `${oldPath}.tmp_dir`;
            yield fs.rename(oldPath, tempPath);
            yield fs.rename(tempPath, newPath);
        }
        else {
            yield fs.rename(oldPath, newPath);
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error renaming folder:', error);
        return { success: false, error: error.message };
    }
}));
electron_1.ipcMain.handle('read-metadata', (_event, rootPath) => __awaiter(void 0, void 0, void 0, function* () {
    const metaPath = path.join(rootPath, '.notizapp-metadata.json');
    try {
        if (yield fs.pathExists(metaPath)) {
            const content = yield fs.readJson(metaPath);
            return content;
        }
    }
    catch (error) {
        console.error('Error reading metadata:', error);
    }
    return { folders: {} };
}));
electron_1.ipcMain.handle('save-metadata', (_event_1, _a) => __awaiter(void 0, [_event_1, _a], void 0, function* (_event, { rootPath, metadata }) {
    const metaPath = path.join(rootPath, '.notizapp-metadata.json');
    try {
        yield fs.writeJson(metaPath, metadata, { spaces: 2 });
        return true;
    }
    catch (error) {
        console.error('Error saving metadata:', error);
        return false;
    }
}));
electron_1.ipcMain.handle('create-folder', (_event, folderPath) => __awaiter(void 0, void 0, void 0, function* () {
    yield fs.ensureDir(folderPath);
    return true;
}));
electron_1.ipcMain.handle('export-pdf', (_event, html) => __awaiter(void 0, void 0, void 0, function* () {
    const pdfWindow = new electron_1.BrowserWindow({ show: false });
    yield pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfData = yield pdfWindow.webContents.printToPDF({});
    const { filePath } = yield electron_1.dialog.showSaveDialog(mainWindow, {
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (filePath) {
        yield fs.writeFile(filePath, pdfData);
        pdfWindow.close();
        return true;
    }
    pdfWindow.close();
    return false;
}));
electron_1.ipcMain.handle('delete-folder-recursive', (_event, folderPath) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield fs.remove(folderPath);
        return true;
    }
    catch (error) {
        console.error('Error deleting folder recursively:', error);
        return false;
    }
}));
electron_1.ipcMain.handle('delete-folder-move-contents', (_event_1, _a) => __awaiter(void 0, [_event_1, _a], void 0, function* (_event, { folderPath, rootPath }) {
    try {
        const files = yield getFilesRecursively(folderPath);
        for (const file of files) {
            if (file.endsWith('.md')) {
                const basename = path.basename(file);
                let targetPath = path.join(rootPath, basename);
                // Handle collisions in root
                let counter = 1;
                while (yield fs.pathExists(targetPath)) {
                    const ext = path.extname(basename);
                    const name = path.basename(basename, ext);
                    targetPath = path.join(rootPath, `${name}_${counter}${ext}`);
                    counter++;
                }
                yield fs.move(file, targetPath);
            }
        }
        // After moving files, delete the empty folder tree
        yield fs.remove(folderPath);
        return true;
    }
    catch (error) {
        console.error('Error moving contents and deleting folder:', error);
        return false;
    }
}));
electron_1.ipcMain.on('start-watch', (_event, folderPath) => {
    if (watcher)
        watcher.close();
    // Recursive watch is default for chokidar
    watcher = (0, chokidar_1.watch)(folderPath, { ignored: /(^|[\/\\])\../, persistent: true, ignoreInitial: true });
    watcher.on('all', (event, filePath) => {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('file-changed', { type: event, path: filePath });
    });
});

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs-extra';
import { watch } from 'chokidar';

let mainWindow: BrowserWindow | null = null;
let watcher: any = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
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
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      require('electron').shell.openExternal(url);
    }
    return { action: 'deny' };
  });
};

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Helper for recursive file listing
async function getFilesRecursively(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFilesRecursively(res) : Promise.resolve([res]);
    })
  );
  return Array.prototype.concat(...files);
}

// Helper for recursive directory listing
async function getDirectoriesRecursively(dir: string, baseDir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const dirs = await Promise.all(
    dirents.map(async (dirent) => {
      if (dirent.isDirectory() && !dirent.name.startsWith('.')) {
        const fullPath = path.resolve(dir, dirent.name);
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        const subDirs = await getDirectoriesRecursively(fullPath, baseDir);
        return [relativePath, ...subDirs];
      }
      return [];
    })
  );
  return Array.prototype.concat(...dirs);
}

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('list-notes', async (_event, folderPath: string) => {
  try {
    const files = await getFilesRecursively(folderPath);
    return Promise.all(
      files
        .filter((file) => file.endsWith('.md'))
        .map(async (file) => {
          const content = await fs.readFile(file, 'utf-8');
          const stats = await fs.stat(file);
          const relativePath = path.relative(folderPath, file);
          const dirname = path.dirname(relativePath).replace(/\\/g, '/');
          return {
            filename: path.basename(file),
            folder: dirname === '.' ? '' : dirname,
            content,
            updatedAt: stats.mtime.toISOString(),
          };
        })
    );
  } catch (error) {
    console.error('Error listing notes:', error);
    return [];
  }
});

ipcMain.handle('list-folders', async (_event, folderPath: string) => {
  try {
    const files = await fs.readdir(folderPath, { withFileTypes: true });
    return files
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name);
  } catch (error) {
    console.error('Error listing folders:', error);
    return [];
  }
});

ipcMain.handle('save-note', async (_event, { folderPath, filename, content }) => {
  // folderPath here might be the absolute path to the folder, or root + relative
  // Let's assume the caller provides the full absolute path to the directory where the file lives
  await fs.ensureDir(folderPath);
  await fs.writeFile(path.join(folderPath, filename), content, 'utf-8');
  return true;
});

ipcMain.handle('delete-note', async (_event, { folderPath, filename }) => {
  await fs.remove(path.join(folderPath, filename));
  return true;
});

ipcMain.handle('rename-note', async (_event, { folderPath, oldFilename, newFilename }) => {
  try {
    const oldPath = path.join(folderPath, oldFilename);
    const newPath = path.join(folderPath, newFilename);

    // Special handling for case-only changes on Windows
    if (oldPath.toLowerCase() === newPath.toLowerCase() && oldPath !== newPath) {
      const tempPath = `${oldPath}.tmp`;
      await fs.rename(oldPath, tempPath);
      await fs.rename(tempPath, newPath);
    } else {
      await fs.rename(oldPath, newPath);
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error renaming note:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rename-folder', async (_event, { rootPath, oldName, newName }) => {
  try {
    const oldPath = path.join(rootPath, oldName);
    const newPath = path.join(rootPath, newName);

    if (oldPath.toLowerCase() === newPath.toLowerCase() && oldPath !== newPath) {
      const tempPath = `${oldPath}.tmp_dir`;
      await fs.rename(oldPath, tempPath);
      await fs.rename(tempPath, newPath);
    } else {
      await fs.rename(oldPath, newPath);
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error renaming folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-metadata', async (_event, rootPath: string) => {
  const metaPath = path.join(rootPath, '.notizapp-metadata.json');
  try {
    if (await fs.pathExists(metaPath)) {
      const content = await fs.readJson(metaPath);
      return content;
    }
  } catch (error) {
    console.error('Error reading metadata:', error);
  }
  return { folders: {} };
});

ipcMain.handle('save-metadata', async (_event, { rootPath, metadata }) => {
  const metaPath = path.join(rootPath, '.notizapp-metadata.json');
  try {
    await fs.writeJson(metaPath, metadata, { spaces: 2 });
    return true;
  } catch (error) {
    console.error('Error saving metadata:', error);
    return false;
  }
});

ipcMain.handle('create-folder', async (_event, folderPath: string) => {
  await fs.ensureDir(folderPath);
  return true;
});

ipcMain.handle('export-pdf', async (_event, html: string) => {
  const pdfWindow = new BrowserWindow({ show: false });
  await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdfData = await pdfWindow.webContents.printToPDF({});
  const { filePath } = await dialog.showSaveDialog(mainWindow!, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (filePath) {
    await fs.writeFile(filePath, pdfData);
    pdfWindow.close();
    return true;
  }
  pdfWindow.close();
  return false;
});

ipcMain.handle('delete-folder-recursive', async (_event, folderPath: string) => {
  try {
    await fs.remove(folderPath);
    return true;
  } catch (error) {
    console.error('Error deleting folder recursively:', error);
    return false;
  }
});

ipcMain.handle('delete-folder-move-contents', async (_event, { folderPath, rootPath }) => {
  try {
    const files = await getFilesRecursively(folderPath);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const basename = path.basename(file);
        let targetPath = path.join(rootPath, basename);

        // Handle collisions in root
        let counter = 1;
        while (await fs.pathExists(targetPath)) {
          const ext = path.extname(basename);
          const name = path.basename(basename, ext);
          targetPath = path.join(rootPath, `${name}_${counter}${ext}`);
          counter++;
        }

        await fs.move(file, targetPath);
      }
    }
    // After moving files, delete the empty folder tree
    await fs.remove(folderPath);
    return true;
  } catch (error) {
    console.error('Error moving contents and deleting folder:', error);
    return false;
  }
});

ipcMain.on('start-watch', (_event, folderPath: string) => {
  if (watcher) watcher.close();
  // Recursive watch is default for chokidar
  watcher = watch(folderPath, { ignored: /(^|[\/\\])\../, persistent: true, ignoreInitial: true });
  watcher.on('all', (event: string, filePath: string) => {
    mainWindow?.webContents.send('file-changed', { type: event, path: filePath });
  });
});

// Auto-updater configuration and handlers
autoUpdater.autoDownload = false;

autoUpdater.on('checking-for-update', () => {
  mainWindow?.webContents.send('update-status', { type: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update-status', { type: 'available', version: info.version });
});

autoUpdater.on('update-not-available', () => {
  mainWindow?.webContents.send('update-status', { type: 'not-available' });
});

autoUpdater.on('download-progress', (progressObj) => {
  mainWindow?.webContents.send('update-status', { type: 'downloading', progress: progressObj.percent });
});

autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update-status', { type: 'downloaded' });
});

autoUpdater.on('error', (err) => {
  mainWindow?.webContents.send('update-status', { type: 'error', error: err.message });
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', () => {
  autoUpdater.checkForUpdatesAndNotify();
});

ipcMain.handle('download-update', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.handle('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import { watch, FSWatcher } from 'chokidar';

let mainWindow: BrowserWindow | null = null;
let watcher: FSWatcher | null = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

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
};

app.on('ready', createWindow);

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

// --- IPC Handlers for File System ---

ipcMain.handle('select-folder', async () => {
  console.log('IPC: select-folder called');
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    });
    console.log('Dialog result:', result);
    if (result.canceled) return null;
    return result.filePaths[0];
  } catch (err) {
    console.error('Dialog error:', err);
    throw err;
  }
});

ipcMain.handle('list-notes', async (_, folderPath: string) => {
  try {
    const files = await fs.readdir(folderPath);
    const notes = await Promise.all(
      files
        .filter((file: string) => file.endsWith('.md'))
        .map(async (file: string) => {
          const content = await fs.readFile(path.join(folderPath, file), 'utf-8');
          const stats = await fs.stat(path.join(folderPath, file));
          return {
            filename: file,
            content,
            updatedAt: stats.mtime.toISOString(),
          };
        })
    );
    return notes;
  } catch (error) {
    console.error('Error listing notes:', error);
    return [];
  }
});

ipcMain.handle('save-note', async (_, { folderPath, filename, content }) => {
  try {
    await fs.writeFile(path.join(folderPath, filename), content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Error saving note:', error);
    return false;
  }
});

ipcMain.handle('delete-note', async (_, { folderPath, filename }) => {
  try {
    await fs.remove(path.join(folderPath, filename));
    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    return false;
  }
});

ipcMain.handle('create-folder', async (_, folderPath: string) => {
  try {
    await fs.ensureDir(folderPath);
    return true;
  } catch (error) {
    console.error('Error creating folder:', error);
    return false;
  }
});

ipcMain.handle('export-pdf', async (_, html: string) => {
  const pdfWindow = new BrowserWindow({ show: false });
  try {
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfData = await pdfWindow.webContents.printToPDF({});

    const { filePath } = await dialog.showSaveDialog(mainWindow!, {
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (filePath) {
      await fs.writeFile(filePath, pdfData);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error exporting PDF:', error);
    return false;
  } finally {
    pdfWindow.close();
  }
});


// Watcher Logic
ipcMain.on('start-watch', (_, folderPath: string) => {
  if (watcher) {
    watcher.close();
  }

  watcher = watch(folderPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    depth: 0 // simple for now, maybe increase if subfolders needed
  });

  watcher
    .on('add', (path: string) => {
      mainWindow?.webContents.send('file-changed', { type: 'add', path });
    })
    .on('change', (path: string) => {
      mainWindow?.webContents.send('file-changed', { type: 'change', path });
    })
    .on('unlink', (path: string) => {
      mainWindow?.webContents.send('file-changed', { type: 'unlink', path });
    });
});

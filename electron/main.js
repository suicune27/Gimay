import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import isDev from 'electron-is-dev';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#050505',
    show: false, // Don't show until ready-to-show to avoid black flickers
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Temporarily disable to bypass "Not allowed to load local resource"
    },
  });

  if (isDev) {
    // Development mode: load from the dev server
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    // Production mode: load the built index.html
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    win.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
    });
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Page failed to load: ${validatedURL} (${errorCode} - ${errorDescription})`);
  });
}

// Security: Handle specific protocol issues
app.whenReady().then(() => {
  createWindow();
});

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

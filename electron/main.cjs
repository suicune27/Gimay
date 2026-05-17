const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0A0A0A',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    // Robust path resolution for production
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('Attempting to load index.html from:', indexPath);
    win.loadFile(indexPath).catch((err) => {
      console.error('Failed to load index.html:', err);
    });
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('did-fail-load:', errorCode, errorDescription);
    });
  }
}

app.whenReady().then(createWindow);

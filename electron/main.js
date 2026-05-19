import { app, BrowserWindow, ipcMain, session, Notification, Tray, Menu } from 'electron';
import path from 'path';
import fs from 'fs';

let mainWindow = null;
let tray = null;
const stateFilePath = path.join(app.getPath('userData'), 'window-state.json');
const logsDirPath = path.join(app.getPath('userData'), 'logs');

// Ensure log directories exist
if (!fs.existsSync(logsDirPath)) {
  fs.mkdirSync(logsDirPath, { recursive: true });
}

// Exception Logging helper
function logException(error) {
  const logFile = path.join(logsDirPath, 'crash.log');
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${error.stack || error}\n\n`;
  fs.appendFileSync(logFile, logMessage);
  console.error('[Electron Runtime Error]', error);
}

process.on('uncaughtException', logException);
process.on('unhandledRejection', logException);

// Load previous window dimensions
function loadWindowState() {
  try {
    if (fs.existsSync(stateFilePath)) {
      const data = fs.readFileSync(stateFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load window state:', e);
  }
  return { width: 1280, height: 800, x: undefined, y: undefined };
}

// Save window state
function saveWindowState() {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    fs.writeFileSync(stateFilePath, JSON.stringify(bounds), 'utf-8');
  } catch (e) {
    console.error('Failed to save window state:', e);
  }
}

function createWindow() {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Keep standard OS frame (can be set to false for borderless)
    show: false,
    icon: path.join(app.getAppPath(), "build/gimay.ico"),
    webPreferences: {
      preload: path.join(app.getAppPath(), 'electron/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.NODE_ENV === 'development') {
    const getDynamicPort = () => {
      try {
        const portFilePath = path.join(app.getAppPath(), '.port.tmp');
        if (fs.existsSync(portFilePath)) {
          return parseInt(fs.readFileSync(portFilePath, 'utf-8').trim(), 10);
        }
      } catch (e) {
        console.error('Error reading port file:', e);
      }
      return 3000;
    };

    const loadWithRetry = () => {
      const activePort = getDynamicPort();
      const devUrl = `http://localhost:${activePort}`;
      console.log(`[Electron Main] Loading development URL: ${devUrl}`);

      mainWindow.loadURL(devUrl).catch((err) => {
        console.log(`[Electron Main] Dev server not ready yet, retrying in 250ms...`);
        setTimeout(loadWithRetry, 250);
      });
    };

    loadWithRetry();
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }

  mainWindow.on('close', () => {
    saveWindowState();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    let trayIconPath = path.join(app.getAppPath(), 'public/favicon.ico');
    if (!fs.existsSync(trayIconPath)) {
      trayIconPath = path.join(app.getAppPath(), 'dist/favicon.ico');
    }

    if (fs.existsSync(trayIconPath)) {
      tray = new Tray(trayIconPath);
    } else {
      console.log('[Electron Tray] Favicon icon not found, skipping tray creation.');
      return;
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Restore Application', click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createWindow();
          }
        }
      },
      { label: 'Check for Updates', click: () => checkForUpdates() },
      { type: 'separator' },
      {
        label: 'Quit Gimay', click: () => {
          saveWindowState();
          app.quit();
        }
      }
    ]);

    tray.setToolTip('Gimay API Engine');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.log('[Electron Tray] Failed to initialize tray system menu:', err.message);
  }
}

async function checkForUpdates() {
  console.log('[Electron Auto-Updater] Invoking updates scan...');
  try {
    const { autoUpdater } = await import('electron-updater');

    // Prevent memory leaks by removing previously registered listeners from the singleton
    autoUpdater.removeAllListeners('update-available');
    autoUpdater.removeAllListeners('update-downloaded');
    autoUpdater.removeAllListeners('error');

    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update-available', info);
      new Notification({
        title: 'Update Available',
        body: `Version ${info.version} is ready to download.`
      }).show();
    });

    autoUpdater.on('update-downloaded', (info) => {
      mainWindow?.webContents.send('update-downloaded', info);
    });

    autoUpdater.on('error', (err) => {
      mainWindow?.webContents.send('update-error', err.message);
    });

    await autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    console.log('[Electron Main Update Mock] Dev-mock update verification triggered');
    mainWindow?.webContents.send('update-error', 'Offline / local server environment');
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();

  // IPC channel to resolve OS proxy for a specific URL
  ipcMain.handle('resolve-proxy', async (event, url) => {
    try {
      return await session.defaultSession.resolveProxy(url);
    } catch (e) {
      console.error('[Electron Main] Proxy resolution error:', e);
      return 'DIRECT';
    }
  });

  // IPC channel to set/update application session proxy
  ipcMain.on('update-proxy-settings', async (event, proxySettings) => {
    try {
      await configureSessionProxy(proxySettings);
    } catch (e) {
      console.error('[Electron Main] Proxy update error:', e);
    }
  });

  // Safe Store management handlers
  const storeFilePath = path.join(app.getPath('userData'), 'app-store.json');
  ipcMain.handle('store-get', (event, key) => {
    try {
      if (fs.existsSync(storeFilePath)) {
        const data = JSON.parse(fs.readFileSync(storeFilePath, 'utf-8'));
        return data[key];
      }
    } catch (e) {
      console.error('Failed to read from local config store:', e);
    }
    return null;
  });

  ipcMain.on('store-set', (event, key, val) => {
    try {
      let data = {};
      if (fs.existsSync(storeFilePath)) {
        data = JSON.parse(fs.readFileSync(storeFilePath, 'utf-8'));
      }
      data[key] = val;
      fs.writeFileSync(storeFilePath, JSON.stringify(data), 'utf-8');
    } catch (e) {
      console.error('Failed to write to local config store:', e);
    }
  });

  // Custom Titlebar IPC events listeners
  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });

  // Native Notification bridge
  ipcMain.on('show-notification', (event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  ipcMain.on('check-for-updates', () => {
    checkForUpdates();
  });

  ipcMain.on('restart-app', () => {
    try {
      app.relaunch();
      app.exit(0);
    } catch (e) {
      console.error('Failed to relaunch app:', e);
    }
  });
});

async function configureSessionProxy(settings) {
  if (!settings || settings.mode === 'disabled' || !settings.enabled) {
    console.log('[Electron Main Proxy] Setting proxy mode to DIRECT');
    await session.defaultSession.setProxy({ mode: 'direct' });
    return;
  }

  if (settings.mode === 'auto' || settings.useSystemProxy) {
    console.log('[Electron Main Proxy] Syncing proxy settings with OS native configuration');
    await session.defaultSession.setProxy({ mode: 'system' });
    return;
  }

  if (settings.mode === 'pac') {
    console.log('[Electron Main Proxy] Applying PAC script URL:', settings.pacUrl);
    await session.defaultSession.setProxy({
      pacScript: settings.pacUrl,
    });
    return;
  }

  if (settings.mode === 'manual') {
    const rules = [];
    if (settings.httpProxy) rules.push(`http=${settings.httpProxy}`);
    if (settings.httpsProxy) rules.push(`https=${settings.httpsProxy}`);
    if (settings.socksProxy) rules.push(`socks=${settings.socksProxy}`);

    const proxyRules = rules.join(';');
    console.log('[Electron Main Proxy] Configuring manual rules:', proxyRules);

    await session.defaultSession.setProxy({
      proxyRules,
      proxyBypassRules: settings.bypassList || '',
    });
  }
}

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

import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

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

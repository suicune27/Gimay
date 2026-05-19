const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  
  // Window Controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  
  // Proxy Resolution & Controls
  resolveProxy: (url) => ipcRenderer.invoke('resolve-proxy', url),
  updateProxy: (settings) => ipcRenderer.send('update-proxy-settings', settings),
  runNetworkDiagnostics: (url) => ipcRenderer.invoke('run-network-diagnostics', url),
  
  // Persistent Storage Helper
  getStoreValue: (key) => ipcRenderer.invoke('store-get', key),
  setStoreValue: (key, val) => ipcRenderer.send('store-set', key, val),
  
  // Native Notifications
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
  
  // System Updates Channel
  onUpdateAvailable: (callback) => {
    const listener = (_, info) => callback(info);
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },
  onUpdateDownloaded: (callback) => {
    const listener = (_, info) => callback(info);
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },
  onUpdateError: (callback) => {
    const listener = (_, err) => callback(err);
    ipcRenderer.on('update-error', listener);
    return () => ipcRenderer.removeListener('update-error', listener);
  },
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  restartApp: () => ipcRenderer.send('restart-app')
});

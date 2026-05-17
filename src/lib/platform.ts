export const isElectron = (): boolean => {
  // Check user agent
  if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron')) {
    return true;
  }
  
  // Check for process.versions.electron
  if (typeof window !== 'undefined' && (window as any).process?.versions?.electron) {
    return true;
  }

  // Check for window.ipcRenderer
  if (typeof window !== 'undefined' && (window as any).ipcRenderer) {
    return true;
  }

  return false;
};

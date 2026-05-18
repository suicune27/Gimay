import { isElectron } from '../lib/platform';

export class ProxyService {
  private static cache = new Map<string, { proxy: string; timestamp: number }>();
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

  /**
   * Resolves the proxy configuration for a given URL.
   * On Web, it relies completely on the browser stack.
   * On Electron, it resolves the proxy dynamically through the main process session.
   */
  static async resolveProxy(url: string): Promise<string> {
    if (!isElectron()) {
      return 'DIRECT (Native Browser Stack)';
    }

    try {
      const parsed = new URL(url);
      const hostKey = parsed.host;

      // Check resolved proxy cache
      const cached = this.cache.get(hostKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.proxy;
      }

      const ipc = (window as any).ipcRenderer;
      if (ipc) {
        const proxyStr = await ipc.invoke('resolve-proxy', url);
        this.cache.set(hostKey, { proxy: proxyStr, timestamp: Date.now() });
        return proxyStr;
      }
    } catch (e) {
      console.warn('[ProxyService] Dynamic proxy resolution fallback to DIRECT:', e);
    }

    return 'DIRECT';
  }

  /**
   * Syncs proxy settings configuration with the Electron main process session.
   */
  static syncSettings(proxySettings: any) {
    if (!isElectron()) return;
    try {
      const ipc = (window as any).ipcRenderer;
      if (ipc) {
        ipc.send('update-proxy-settings', proxySettings);
      }
    } catch (e) {
      console.error('[ProxyService] Failed to sync proxy settings to main process:', e);
    }
  }
}

import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'putman-secure-config-v1'; // Should be derived from user password in production

export class SecureConfigStorage {
  /**
   * Save encrypted Supabase credentials to local storage
   */
  static saveSupabaseConfig(url: string, anonKey: string): void {
    const config = { url, anonKey };
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(config),
      ENCRYPTION_KEY
    ).toString();
    
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('putman-supabase-config-encrypted', encrypted);
    } else if (typeof window !== 'undefined' && (window as any).indexedDB) {
      // Fallback for environments without localStorage
      this.saveToIndexedDB('putman-config', 'supabase', encrypted);
    }
  }

  /**
   * Retrieve and decrypt Supabase credentials
   */
  static getSupabaseConfig(): { url: string; anonKey: string } | null {
    try {
      let encrypted: string | null = null;

      if (typeof localStorage !== 'undefined') {
        encrypted = localStorage.getItem('putman-supabase-config-encrypted');
      }
      // Note: IndexedDB retrieval requires async, so we only use localStorage for sync access

      if (!encrypted) return null;

      const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY).toString(
        CryptoJS.enc.Utf8
      );
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to decrypt Supabase config:', error);
      return null;
    }
  }

  /**
   * Save workspace metadata
   */
  static saveWorkspaceMetadata(data: {
    workspaceId: string;
    teamId?: string;
    userId: string;
    setupMode: 'create' | 'join';
  }): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('putman-workspace-metadata', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Failed to save workspace metadata:', error);
    }
  }

  /**
   * Get workspace metadata
   */
  static getWorkspaceMetadata(): {
    workspaceId: string;
    teamId?: string;
    userId: string;
    setupMode: 'create' | 'join';
  } | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const data = localStorage.getItem('putman-workspace-metadata');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to retrieve workspace metadata:', error);
      return null;
    }
  }

  /**
   * Clear all configuration
   */
  static clearConfiguration(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('putman-supabase-config-encrypted');
      localStorage.removeItem('putman-workspace-metadata');
    }
  }

  /**
   * Backup configuration for export
   */
  static exportConfiguration(): string {
    const config = this.getSupabaseConfig();
    const metadata = this.getWorkspaceMetadata();
    
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      config,
      metadata,
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Import and restore configuration
   */
  static importConfiguration(backupJson: string): boolean {
    try {
      const backup = JSON.parse(backupJson);
      
      if (backup.version !== '1.0') {
        console.error('Unsupported backup version');
        return false;
      }

      if (backup.config) {
        this.saveSupabaseConfig(backup.config.url, backup.config.anonKey);
      }

      if (backup.metadata) {
        this.saveWorkspaceMetadata(backup.metadata);
      }

      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }

  /**
   * Retrieve from IndexedDB (async)
   */
  private static async getFromIndexedDB(
    dbName: string,
    storeName: string
  ): Promise<{ url: string; anonKey: string } | null> {
    return new Promise((resolve, reject) => {
      const request = (window as any).indexedDB.open(dbName, 1);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'key' });
        }
      };

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const getRequest = store.get('config');

        getRequest.onsuccess = () => {
          if (getRequest.result) {
            try {
              const encrypted = getRequest.result.value;
              const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY).toString(
                CryptoJS.enc.Utf8
              );
              resolve(JSON.parse(decrypted));
            } catch (error) {
              console.error('Failed to decrypt from IndexedDB:', error);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };

        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  /**
   * Save to IndexedDB (async fallback)
   */
  private static async saveToIndexedDB(
    dbName: string,
    storeName: string,
    data: any
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = (window as any).indexedDB.open(dbName, 1);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'key' });
        }
      };

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put({ key: 'config', value: data });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  }
}

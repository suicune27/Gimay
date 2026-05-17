import { PersistenceService } from './PersistenceService';
import { useStore } from '../store/useStore';

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'pending' | 'offline';
type ResourceType = 'request' | 'collection' | 'environment' | 'workspace' | 'profile';

interface PendingChange {
  type: ResourceType;
  id: string;
  data: any;
  timestamp: number;
}

class SyncManager {
  private queue: Map<string, PendingChange> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private statusListeners: Set<(status: SyncStatus) => void> = new Set();
  private currentStatus: SyncStatus = 'idle';
  private DEBOUNCE_MS = 5000;
  private MAX_RETRIES = 5;
  private processingKeys: Set<string> = new Set();
  private processingPromises: Map<string, Promise<void>> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', (e) => {
        if (this.queue.size > 0) {
          this.flushAll();
        }
      });

      window.addEventListener('online', () => this.handleConnectivityChange(true));
      window.addEventListener('offline', () => this.handleConnectivityChange(false));
      
      // Init offline state
      setTimeout(() => {
        try {
          this.handleConnectivityChange(window.navigator.onLine);
        } catch (e) {
          console.warn('SyncManager: Delayed initialization failed, will retry on next check.', e);
        }
      }, 0);
    }
  }

  private handleConnectivityChange(isOnline: boolean) {
    useStore.getState().updateSyncMetadata({ isOffline: !isOnline });
    if (isOnline) {
      if (this.queue.size > 0) {
        this.flushAll();
      } else {
        this.setStatus(this.queue.size > 0 ? 'pending' : 'idle');
      }
    } else {
      this.setStatus('offline');
    }
  }

  public isPending(id: string): boolean {
    return Array.from(this.queue.values()).some(change => change.id === id);
  }

  private updatePendingIds() {
    const ids = new Set(Array.from(this.queue.values()).map(c => c.id));
    useStore.getState().setPendingSyncIds(ids);
  }

  onStatusChange(listener: (status: SyncStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: SyncStatus) {
    this.currentStatus = status;
    this.statusListeners.forEach(l => l(status));
    useStore.getState().setSyncStatus(status);
  }

  public enqueue(type: ResourceType, id: string, data: any) {
    const key = `${type}:${id}`;
    
    // Merge updates if already in queue
    const existing = this.queue.get(key);
    this.queue.set(key, {
      type,
      id,
      data: existing ? { ...existing.data, ...data } : data,
      timestamp: Date.now()
    });

    this.updatePendingIds();
    useStore.getState().updateSyncMetadata({ lastSaved: Date.now() });

    const state = useStore.getState();
    const autoSave = state.settings.general.autoSave;

    if (!state.syncMetadata.isOffline) {
      if (autoSave) {
        this.setStatus('saving');
      } else {
        if (this.currentStatus !== 'saving' && this.currentStatus !== 'error') {
          this.setStatus('pending');
        }
      }

      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key)!);
      }

      if (autoSave) {
        const timer = setTimeout(() => {
          this.syncResource(key);
        }, this.DEBOUNCE_MS);
        this.timers.set(key, timer);
      }
    } else {
      this.setStatus('offline');
    }
  }

  private async syncResource(key: string, retryCount = 0): Promise<void> {
    // If this specific resource is already syncing, wait for the existing promise
    if (this.processingPromises.has(key) && retryCount === 0) {
      return this.processingPromises.get(key);
    }

    const change = this.queue.get(key);
    if (!change) {
      this.checkCompletion();
      return;
    }

    if (useStore.getState().syncMetadata.isOffline) {
      this.setStatus('offline');
      return;
    }

    const syncPromise = (async () => {
      try {
        this.processingKeys.add(key);
        this.timers.delete(key);
        
        switch (change.type) {
          case 'request':
            await PersistenceService.saveRequest(change.data);
            break;
          case 'collection':
            await PersistenceService.updateCollection(change.id, change.data);
            break;
          case 'environment':
            await PersistenceService.updateEnvironment(change.id, change.data);
            break;
          case 'workspace':
            await PersistenceService.updateWorkspace(change.id, change.data);
            break;
          case 'profile':
            await PersistenceService.updateProfile(change.id, change.data);
            break;
        }

        this.queue.delete(key);
        this.updatePendingIds();
        useStore.getState().updateSyncMetadata({ 
          lastSynced: Date.now(),
          retryCount: 0 
        });
        
      } catch (error) {
        console.error(`Sync failed for ${key}:`, error);
        
        if (retryCount < this.MAX_RETRIES) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`Retrying in ${delay}ms... (Attempt ${retryCount + 1})`);
          useStore.getState().updateSyncMetadata({ retryCount: retryCount + 1 });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.syncResource(key, retryCount + 1);
        } else {
          console.error(`Sync FATAL failure for ${key} after ${this.MAX_RETRIES} retries:`, error);
          this.setStatus('error');
          throw error;
        }
      } finally {
        this.processingKeys.delete(key);
        this.processingPromises.delete(key);
        this.checkCompletion();
      }
    })();

    this.processingPromises.set(key, syncPromise);
    return syncPromise;
  }

  private checkCompletion() {
    if (this.queue.size === 0 && this.processingKeys.size === 0) {
      this.setStatus('saved');
      setTimeout(() => {
        if (this.queue.size === 0 && this.processingKeys.size === 0) {
          this.setStatus('idle');
        }
      }, 2000);
    }
  }

  public async flushAll() {
    if (useStore.getState().syncMetadata.isOffline) return;
    
    this.setStatus('saving');
    const keys = Array.from(this.queue.keys());
    const promises = keys.map(key => this.syncResource(key));
    await Promise.all(promises);
    
    // Final check for status
    this.checkCompletion();
  }

  public triggerSync(type: ResourceType, id: string) {
    const key = `${type}:${id}`;
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }
    
    this.setStatus('saving');
    return this.syncResource(key);
  }

  public cancelSync(type: ResourceType, id: string) {
    const key = `${type}:${id}`;
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
    }
    this.queue.delete(key);
    this.updatePendingIds();
    if (this.queue.size === 0) this.setStatus('idle');
  }

  public forcePushAll() {
    return this.flushAll();
  }

  public getStatus() {
    return this.currentStatus;
  }
}

export const syncManager = new SyncManager();

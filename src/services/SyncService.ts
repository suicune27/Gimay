import { PersistenceService } from './PersistenceService';
import { useStore } from '../store/useStore';

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'pending' | 'offline';
type ResourceType = 'request' | 'collection' | 'environment' | 'workspace' | 'profile' | 'folder';

interface PendingChange {
  type: ResourceType;
  action: 'create' | 'update' | 'delete';
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
  private MAX_PERSISTED_QUEUE_BYTES = 2 * 1024 * 1024;

  private sanitizeQueueData(type: ResourceType, data: any): any {
    if (!data || typeof data !== 'object') return data;

    const compact: any = { ...data };

    // Drop heavy runtime-only payloads that should never be persisted in offline queue.
    delete compact.response;
    delete compact.lastResponse;
    delete compact.consoleLogs;
    delete compact.testResults;
    delete compact.request_data;
    delete compact.response_data;
    delete compact.logs;
    delete compact.errors;

    // Shrink high-risk large text fields.
    if (typeof compact.pre_request_script === 'string' && compact.pre_request_script.length > 4096) {
      compact.pre_request_script = compact.pre_request_script.slice(0, 4096);
    }
    if (typeof compact.test_script === 'string' && compact.test_script.length > 4096) {
      compact.test_script = compact.test_script.slice(0, 4096);
    }

    // Request body can be very large; keep a compact preview in queue.
    if (type === 'request') {
      if (typeof compact.body === 'string' && compact.body.length > 4096) {
        compact.body = compact.body.slice(0, 4096);
      } else if (compact.body && typeof compact.body === 'object' && typeof compact.body.content === 'string' && compact.body.content.length > 4096) {
        compact.body = { ...compact.body, content: compact.body.content.slice(0, 4096) };
      }
    }

    return compact;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. Load persisted queue from localStorage
      try {
        const savedQueue = localStorage.getItem('gimay-offline-sync-queue');
        if (savedQueue) {
          const parsed = JSON.parse(savedQueue);
          if (Array.isArray(parsed)) {
            parsed.forEach(([key, change]: [string, PendingChange]) => {
              this.queue.set(key, change);
            });
            console.log(`[SyncManager] Restored ${this.queue.size} pending offline actions.`);
            // Guard against useStore not being initialized yet (circular dependency: SyncService -> useStore -> PersistenceService -> SyncService)
            try {
              this.updatePendingIds();
            } catch (err) {
              console.warn('[SyncManager] Cannot access store during initialization, deferring pending ID sync:', err);
              setTimeout(() => {
                try { this.updatePendingIds(); } catch (e) {
                  console.warn('[SyncManager] Deferred updatePendingIds also failed:', e);
                }
              }, 0);
            }
          }
        }
      } catch (err) {
        console.error('[SyncManager] Failed to restore offline sync queue:', err);
      }

      window.addEventListener('beforeunload', (e) => {
        if (this.queue.size > 0 && !useStore.getState().syncMetadata.isOffline) {
          this.flushAll();
        }
      });

      window.addEventListener('online', () => this.handleConnectivityChange(true));
      window.addEventListener('offline', () => this.handleConnectivityChange(false));
      
      // Init offline state — do NOT flush stale queue items on startup.
      // The persisted queue from a previous session may contain stale update
      // entries that would overwrite newer data on the server. We only sync
      // entries that are explicitly created during the current session.
      setTimeout(() => {
        try {
          const isOnline = window.navigator.onLine;
          useStore.getState().updateSyncMetadata({ isOffline: !isOnline });
          this.setStatus(isOnline ? 'idle' : 'offline');
        } catch (e) {
          console.warn('SyncManager: Delayed initialization failed.', e);
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

  private persistQueue() {
    if (typeof window !== 'undefined') {
      try {
        let entries = Array.from(this.queue.entries());
        let serialized = JSON.stringify(entries);

        if (serialized.length > this.MAX_PERSISTED_QUEUE_BYTES) {
          // Keep newest changes if queue payload is too large for localStorage budget.
          entries = entries
            .sort((a, b) => (a[1]?.timestamp || 0) - (b[1]?.timestamp || 0))
            .slice(Math.floor(entries.length / 2));
          this.queue = new Map(entries);
          this.updatePendingIds();
          serialized = JSON.stringify(entries);
        }

        localStorage.setItem('gimay-offline-sync-queue', serialized);
      } catch (err) {
        console.error('[SyncManager] Failed to persist offline queue:', err);
      }
    }
  }

  onStatusChange(listener: (status: SyncStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  public setStatus(status: SyncStatus) {
    this.currentStatus = status;
    this.statusListeners.forEach(l => l(status));
    useStore.getState().setSyncStatus(status);
  }

  public enqueueAction(type: ResourceType, action: 'create' | 'update' | 'delete', id: string, data: any) {
    const key = `${type}:${action}:${id}`;
    
    // For updates, check if there is an existing 'create' in the queue for this same temporary ID
    // If so, we merge the updates directly into the pending creation data!
    // This must happen BEFORE the offline-ID guard so edits to offline-created items
    // are captured in the CREATE payload rather than silently dropped.
    if (action === 'update') {
      const createKey = `${type}:create:${id}`;
      const existingCreate = this.queue.get(createKey);
      if (existingCreate) {
        existingCreate.data = { ...existingCreate.data, ...data };
        existingCreate.timestamp = Date.now();
        this.persistQueue();
        return;
      }
    }

    // For deletes, check if there is a pending 'create' for this same temporary ID.
    // If so, cancel the create rather than silently dropping the delete — otherwise
    // the item will reappear when the pending create sync completes.
    if (action === 'delete') {
      const createKey = `${type}:create:${id}`;
      const existingCreate = this.queue.get(createKey);
      if (existingCreate) {
        this.queue.delete(createKey);
        this.updatePendingIds();
        this.persistQueue();
        return;
      }
      // Also cancel any pending update for this ID
      const updateKey = `${type}:update:${id}`;
      if (this.queue.has(updateKey)) {
        this.queue.delete(updateKey);
      }
    }

    // Block standalone non-CREATE/UPDATE actions for offline-temporary IDs.
    // offline-* IDs are placeholders that will be remapped once the CREATE
    // sync succeeds. Trying to UPDATE/DELETE them in Supabase will 400 since
    // they don't exist there. CREATE actions must still go through.
    // NOTE: This guard runs AFTER the merge logic above so edits to offline-
    // created items are still captured in the CREATE payload.
    if (id.startsWith('offline-') && action !== 'create') {
      return;
    }

    const existing = this.queue.get(key);
    const compactData = this.sanitizeQueueData(type, existing ? { ...existing.data, ...data } : data);

    this.queue.set(key, {
      type,
      action,
      id,
      data: compactData,
      timestamp: Date.now()
    });

    this.updatePendingIds();
    this.persistQueue();
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

  public enqueue(type: ResourceType, id: string, data: any) {
    // Preserve old enqueue interface, map to update action
    this.enqueueAction(type, 'update', id, data);
  }

  private async syncResource(key: string, retryCount = 0): Promise<void> {
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
        
        switch (change.action) {
          case 'create':
            switch (change.type) {
              case 'collection':
                const createdCol = await PersistenceService.createCollectionOnline(change.data.workspace_id, change.data.user_id, change.data.name);
                this.remapId(change.id, createdCol.id, 'collection');
                break;
              case 'folder':
                const createdFolder = await PersistenceService.createFolderOnline(change.data.name, change.data.collection_id, change.data.user_id, change.data.parent_id, change.data.workspace_id);
                this.remapId(change.id, createdFolder.id, 'folder');
                break;
              case 'request':
                const createdReq = await PersistenceService.createRequestOnline(change.data);
                this.remapId(change.id, createdReq.id, 'request');
                break;
              case 'environment':
                const createdEnv = await PersistenceService.createEnvironmentOnline(change.data.workspace_id, change.data.user_id, change.data.name, change.data.variables, change.data.is_global, change.data.pre_request_script, change.data.test_script, change.data.documentation);
                this.remapId(change.id, createdEnv.id, 'environment');
                break;
              case 'workspace':
                const createdWS = await PersistenceService.createWorkspaceOnline(change.data.name, change.data.user_id, change.data.team_id);
                this.remapId(change.id, createdWS.id, 'workspace');
                break;
            }
            break;

          case 'update':
            switch (change.type) {
              case 'request':
                await PersistenceService.saveRequestOnline(change.data);
                break;
              case 'collection':
                await PersistenceService.updateCollectionOnline(change.id, change.data);
                break;
              case 'environment':
                await PersistenceService.updateEnvironmentOnline(change.id, change.data);
                break;
              case 'workspace':
                await PersistenceService.updateWorkspaceOnline(change.id, change.data);
                break;
              case 'profile':
                await PersistenceService.updateProfileOnline(change.id, change.data);
                break;
              case 'folder':
                await PersistenceService.updateFolderOnline(change.id, change.data);
                break;
            }
            break;

          case 'delete':
            switch (change.type) {
              case 'collection':
                await PersistenceService.deleteCollectionOnline(change.id);
                break;
              case 'folder':
                await PersistenceService.deleteFolderOnline(change.id);
                break;
              case 'request':
                await PersistenceService.deleteRequestOnline(change.id);
                break;
              case 'environment':
                await PersistenceService.deleteEnvironmentOnline(change.id);
                break;
              case 'workspace':
                await PersistenceService.deleteWorkspaceOnline(change.id);
                break;
            }
            break;
        }

        this.queue.delete(key);
        this.updatePendingIds();
        this.persistQueue();
        useStore.getState().updateSyncMetadata({ 
          lastSynced: Date.now(),
          retryCount: 0 
        });
        
      } catch (error: any) {
        console.error(`Sync failed for ${key}:`, error);
        
        // Handle immediate offline transitions resiliently
        const isNetworkError = !window.navigator.onLine || 
          error.message?.includes('Network Error') || 
          error.message?.includes('Failed to fetch') || 
          error.message?.includes('timeout') ||
          error.code === 'ECONNABORTED' ||
          error.status === 0;

        if (isNetworkError) {
          console.warn(`[SyncManager] Connection cut detected during active sync for ${key}. Safe-buffering locally.`);
          this.handleConnectivityChange(false);
          return;
        }
        
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

  private remapId(tempId: string, realId: string, type: 'collection' | 'folder' | 'request' | 'environment' | 'workspace') {
    console.log(`[SyncManager] Remapping ${type} ID from temporary ${tempId} to real ${realId}`);
    const state = useStore.getState();

    // Guard: if the realId already exists in the store (from a Realtime fetch that
    // arrived before remapId ran), remove the tempId entry silently instead of
    // duplicating the realId. This fixes the race condition where Realtime triggers
    // fetchCollections between the Supabase INSERT and the remapId call.
    const alreadyExists = (() => {
      switch (type) {
        case 'collection':
          return state.collections.some(c => c.id === realId);
        case 'folder': {
          const allFolders = (node: any): any[] => [
            ...(node.folders || []),
            ...(node.folders || []).flatMap(allFolders)
          ];
          return state.collections.some(c => allFolders(c).some((f: any) => f.id === realId));
        }
        case 'request': {
          const allReqs = (node: any): any[] => [
            ...(node.requests || []),
            ...(node.folders || []).flatMap(allReqs)
          ];
          return state.collections.some(c => allReqs(c).some((r: any) => r.id === realId));
        }
        case 'environment':
          return state.environments.some(e => e.id === realId);
        case 'workspace':
          return state.workspaces.some(w => w.id === realId);
        default:
          return false;
      }
    })();

    if (alreadyExists) {
      // Remove the tempId item from the store (the realId item is already there)
      switch (type) {
        case 'collection':
          state.setCollections(state.collections.filter((c: any) => c.id !== tempId));
          break;
        case 'folder': {
          const removeFolder = (folders: any[]): any[] =>
            folders.filter(f => f.id !== tempId).map(f => f.folders ? { ...f, folders: removeFolder(f.folders) } : f);
          state.setCollections(state.collections.map((c: any) => ({ ...c, folders: removeFolder(c.folders || []) })));
          break;
        }
        case 'request': {
          const removeReq = (folders: any[]): any[] =>
            folders.map(f => ({
              ...f,
              requests: (f.requests || []).filter((r: any) => r.id !== tempId),
              folders: f.folders ? removeReq(f.folders) : undefined
            }));
          state.setCollections(state.collections.map((c: any) => ({
            ...c,
            requests: (c.requests || []).filter((r: any) => r.id !== tempId),
            folders: removeReq(c.folders || [])
          })));
          break;
        }
        case 'environment':
          state.setEnvironments(state.environments.filter((e: any) => e.id !== tempId));
          break;
        case 'workspace':
          state.setWorkspaces(state.workspaces.filter((w: any) => w.id !== tempId));
          break;
      }
      // Clean up open tabs
      const cleanTabs = state.openTabs.filter(t => t.id !== tempId);
      if (cleanTabs.length !== state.openTabs.length) {
        state.setUserTabs(cleanTabs);
        if (state.activeTabId === tempId) {
          state.setActiveTab(cleanTabs.length > 0 ? cleanTabs[cleanTabs.length - 1].id : null);
        }
      }
      console.log(`[SyncManager] realId ${realId} already exists in store (from Realtime fetch). Removed tempId ${tempId} instead of remapping.`);
      return;
    }

    // 1. Update active tab ID if active
    if (state.activeTabId === tempId) {
      state.setActiveTab(realId);
    }

    // 2. Update open tabs
    const newTabs = state.openTabs.map(t => {
      if (t.id === tempId) {
        return { ...t, id: realId } as any;
      }
      if ('collection_id' in t && t.collection_id === tempId) {
        return { ...t, collection_id: realId } as any;
      }
      if ('folder_id' in t && t.folder_id === tempId) {
        return { ...t, folder_id: realId } as any;
      }
      return t;
    });
    state.setUserTabs(newTabs);

    // 3. Update tree nodes
    if (type === 'collection') {
      const newCollections = state.collections.map(c => {
        if (c.id === tempId) return { ...c, id: realId };
        return c;
      });
      state.setCollections(newCollections);
    } else if (type === 'folder') {
      const updateFolders = (folders: any[]): any[] => {
        return folders.map(f => {
          if (f.id === tempId) return { ...f, id: realId };
          if (f.folders) return { ...f, folders: updateFolders(f.folders) };
          return f;
        });
      };
      const newCollections = state.collections.map(c => ({
        ...c,
        folders: c.folders ? updateFolders(c.folders) : []
      }));
      state.setCollections(newCollections);
    } else if (type === 'request') {
      const updateFolders = (folders: any[]): any[] => {
        return folders.map(f => {
          if (f.requests) {
            f.requests = f.requests.map((r: any) => r.id === tempId ? { ...r, id: realId } : r);
          }
          if (f.folders) {
            f.folders = updateFolders(f.folders);
          }
          return f;
        });
      };
      const newCollections = state.collections.map(c => {
        const rootRequests = (c.requests || []).map(r => r.id === tempId ? { ...r, id: realId } : r);
        const subFolders = c.folders ? updateFolders(c.folders) : [];
        return { ...c, requests: rootRequests, folders: subFolders };
      });
      state.setCollections(newCollections);
    } else if (type === 'environment') {
      const newEnvironments = state.environments.map(e => e.id === tempId ? { ...e, id: realId } : e);
      state.setEnvironments(newEnvironments);
      if (state.activeEnvId === tempId) {
        state.setActiveEnvId(realId);
      }
    } else if (type === 'workspace') {
      const newWorkspaces = state.workspaces.map(w => w.id === tempId ? { ...w, id: realId } : w);
      state.setWorkspaces(newWorkspaces);
      if (state.activeWorkspaceId === tempId) {
        state.setActiveWorkspaceId(realId);
      }
    }

    // 4. Update subsequent enqueued items in queue
    const entries = Array.from(this.queue.entries());
    for (const [key, change] of entries) {
      if (change.id === tempId && change.type === type) {
        this.queue.delete(key);
        const newKey = `${type}:${change.action}:${realId}`;
        this.queue.set(newKey, { ...change, id: realId });
      }
      
      // Update relational IDs in parent relations of children
      if (change.type === 'request' && type === 'collection' && change.data.collection_id === tempId) {
        change.data.collection_id = realId;
      }
      if (change.type === 'request' && type === 'folder' && change.data.folder_id === tempId) {
        change.data.folder_id = realId;
      }
      if (change.type === 'folder' && type === 'collection' && change.data.collection_id === tempId) {
        change.data.collection_id = realId;
      }
      if (change.type === 'folder' && type === 'folder' && change.data.parent_id === tempId) {
        change.data.parent_id = realId;
      }
    }
    this.persistQueue();
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
    
    this.checkCompletion();
  }

  public triggerSync(type: ResourceType, id: string) {
    const key = `${type}:update:${id}`;
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }
    
    this.setStatus('saving');
    return this.syncResource(key);
  }

  public cancelSync(type: ResourceType, id: string) {
    const key = `${type}:update:${id}`;
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
      this.timers.delete(key);
    }
    this.queue.delete(key);
    this.updatePendingIds();
    this.persistQueue();
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

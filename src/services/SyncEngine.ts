import { localDB, enqueueSync, dequeueSync, getPendingSyncItems, countPendingSyncs, DEVICE_ID, stampSyncFields, type SyncQueueItem } from './LocalDB';
import { networkDetector } from './NetworkDetector';
import { PersistenceService } from './PersistenceService';
import type { SyncStatus } from '../types';

type SyncEventCallback = (event: SyncEvent) => void;

export interface SyncEvent {
  type: 'sync-started' | 'sync-complete' | 'sync-error' | 'sync-progress' | 'conflict-detected' | 'pending-changes';
  message?: string;
  total?: number;
  completed?: number;
  failed?: number;
  conflictItem?: any;
}

class SyncEngine {
  private listeners: Set<SyncEventCallback> = new Set();
  private _isSyncing = false;
  private _pendingCount = 0;
  private _lastSyncResult: 'success' | 'error' | 'idle' = 'idle';
  private MAX_RETRIES = 5;
  private INITIAL_BACKOFF_MS = 1000;
  private unlisten: (() => void) | null = null;
  private _status: 'idle' | 'syncing' | 'error' | 'offline' = 'idle';

  get isSyncing(): boolean {
    return this._isSyncing;
  }

  get pendingCount(): number {
    return this._pendingCount;
  }

  get status(): string {
    return this._status;
  }

  get lastSyncResult(): string {
    return this._lastSyncResult;
  }

  async init(): Promise<void> {
    // Listen for network changes — just update status, don't auto-sync
    this.unlisten = networkDetector.onConnectionChange(async (isOnline) => {
      if (isOnline) {
        const count = await this.refreshPendingCount();
        if (count > 0) {
          this.emit({ type: 'pending-changes', message: `${count} offline changes pending sync`, total: count });
          // No auto-sync — user clicks the manual sync button instead
        }
      } else {
        this._status = 'offline';
      }
    });

    // Initial pending count check
    await this.refreshPendingCount();
  }

  destroy(): void {
    if (this.unlisten) {
      this.unlisten();
      this.unlisten = null;
    }
    this.listeners.clear();
  }

  onEvent(callback: SyncEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(event: SyncEvent): void {
    this.listeners.forEach(cb => {
      try { cb(event); } catch (err) { console.error('[SyncEngine] Listener error:', err); }
    });
  }

  async refreshPendingCount(): Promise<number> {
    this._pendingCount = await countPendingSyncs();
    return this._pendingCount;
  }

  async triggerSync(): Promise<void> {
    if (this._isSyncing) {
      console.log('[SyncEngine] Already syncing, skipping trigger.');
      return;
    }
    if (!networkDetector.isOnline) {
      console.log('[SyncEngine] Offline, cannot sync.');
      return;
    }
    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    this._isSyncing = true;
    this._status = 'syncing';
    this.emit({ type: 'sync-started' });

    let completed = 0;
    let failed = 0;

    try {
      const items = await getPendingSyncItems();
      const total = items.length;

      if (total === 0) {
        this._isSyncing = false;
        this._status = 'idle';
        this._lastSyncResult = 'success';
        this.emit({ type: 'sync-complete', completed: 0, failed: 0, total: 0 });
        return;
      }

      this.emit({ type: 'sync-progress', total, completed: 0, failed: 0 });

      for (const item of items) {
        if (!networkDetector.isOnline) {
          console.log('[SyncEngine] Connection lost during sync. Stopping.');
          break;
        }

        // Skip items that were created offline with non-UUID references — they can't be synced to Supabase
        if (this.isOfflineItem(item)) {
          console.log(`[SyncEngine] Skipping offline item ${item.type}:${item.entityId} — marked as local_only`);
          await localDB.syncQueue.delete(item.id);
          // Update the entity in its table to local_only so it stays in LocalDB
          try {
            const table = this.getTableForType(item.type);
            if (table) {
              const record = await table.get(item.entityId);
              if (record) {
                await table.update(item.entityId, { syncStatus: 'local_only' } as any);
              }
            }
          } catch {}
          continue;
        }

        try {
          await this.syncItem(item);
          await dequeueSync(item.id);
          completed++;
          this.emit({ type: 'sync-progress', total, completed, failed });
        } catch (err: any) {
          failed++;
          const isNetworkError = this.isNetworkError(err);

          if (isNetworkError) {
            console.warn(`[SyncEngine] Network error during sync of ${item.id}, pausing.`);
            break; // Stop processing, will retry on next cycle
          }

          if (item.retryCount < this.MAX_RETRIES) {
            const backoffMs = this.INITIAL_BACKOFF_MS * Math.pow(2, item.retryCount);
            await localDB.syncQueue.update(item.id, {
              retryCount: item.retryCount + 1,
              lastError: err.message || String(err),
            });
            console.warn(`[SyncEngine] Sync failed for ${item.id}, retry ${item.retryCount + 1}/${this.MAX_RETRIES} in ${backoffMs}ms:`, err.message);
          } else {
            console.error(`[SyncEngine] Sync permanently failed for ${item.id} after ${this.MAX_RETRIES} retries:`, err);
            // Mark as conflict for user review
            await this.markConflict(item);
            await dequeueSync(item.id);
            this.emit({ type: 'conflict-detected', conflictItem: item, message: `Sync failed for ${item.type}: ${err.message}` });
          }
        }
      }

      await this.refreshPendingCount();
      
      if (completed > 0) {
        this._lastSyncResult = 'success';
        this.emit({ type: 'sync-complete', completed, failed, total });
      }
    } catch (err) {
      console.error('[SyncEngine] Sync process error:', err);
      this._lastSyncResult = 'error';
      this.emit({ type: 'sync-error', message: String(err) });
    } finally {
      this._isSyncing = false;
      this._status = this._pendingCount > 0 ? (failed > 0 ? 'error' : 'idle') : 'idle';
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    // Handle deletions first
    if (item.action === 'delete') {
      await this.syncDelete(item);
      return;
    }

    // For creates and updates, use the entity-specific sync methods
    switch (item.type) {
      case 'request':
        await this.syncRequest(item);
        break;
      case 'collection':
        await this.syncCollection(item);
        break;
      case 'folder':
        await this.syncFolder(item);
        break;
      case 'environment':
        await this.syncEnvironment(item);
        break;
      case 'workspace':
        await this.syncWorkspace(item);
        break;
      case 'profile':
        await this.syncProfile(item);
        break;
      case 'script':
        await this.syncScript(item);
        break;
      case 'history':
        await this.syncHistory(item);
        break;
      default:
        throw new Error(`Unknown sync type: ${item.type}`);
    }
  }

  private async syncDelete(item: SyncQueueItem): Promise<void> {
    const { entityType, onlineDelete } = this.getOnlineDelete(item.type);
    if (onlineDelete) {
      try {
        await onlineDelete(entityType, item.entityId);
      } catch (err: any) {
        // If 404, the entity is already gone from server — that's fine
        if (err?.status === 404 || err?.code === 'PGRST116' || String(err?.message || '').includes('not found')) {
          return;
        }
        throw err;
      }
    }
  }

  private async syncRequest(item: SyncQueueItem): Promise<void> {
    const data = item.data;
    if (item.action === 'create') {
      // If the entity was created offline with a temp ID, we need to remap
      const created = await PersistenceService.createRequestOnline(data);
      await this.remapId('request', item.entityId, created.id);
    } else {
      await PersistenceService.updateRequestOnline(item.entityId, data);
    }
  }

  private async syncCollection(item: SyncQueueItem): Promise<void> {
    const data = item.data;
    if (item.action === 'create') {
      const created = await PersistenceService.createCollectionOnline(data.workspace_id, data.user_id, data.name);
      await this.remapId('collection', item.entityId, created.id);
    } else {
      await PersistenceService.updateCollectionOnline(item.entityId, data);
    }
  }

  private async syncFolder(item: SyncQueueItem): Promise<void> {
    const data = item.data;
    if (item.action === 'create') {
      const created = await PersistenceService.createFolderOnline(data.name, data.collection_id, data.user_id, data.parent_id, data.workspace_id);
      await this.remapId('folder', item.entityId, created.id);
    } else {
      await PersistenceService.updateFolderOnline(item.entityId, data);
    }
  }

  private async syncEnvironment(item: SyncQueueItem): Promise<void> {
    const data = item.data;
    if (item.action === 'create') {
      const created = await PersistenceService.createEnvironmentOnline(data.workspace_id, data.user_id, data.name, data.variables, data.is_global, data.pre_request_script, data.test_script, data.documentation);
      await this.remapId('environment', item.entityId, created.id);
    } else {
      await PersistenceService.updateEnvironmentOnline(item.entityId, data);
    }
  }

  private async syncWorkspace(item: SyncQueueItem): Promise<void> {
    const data = item.data;
    if (item.action === 'create') {
      const created = await PersistenceService.createWorkspaceOnline(data.name, data.user_id, data.team_id);
      await this.remapId('workspace', item.entityId, created.id);
    } else {
      await PersistenceService.updateWorkspaceOnline(item.entityId, data);
    }
  }

  private async syncProfile(item: SyncQueueItem): Promise<void> {
    await PersistenceService.updateProfileOnline(item.entityId, item.data);
  }

  private async syncScript(item: SyncQueueItem): Promise<void> {
    // Scripts use the same pattern
    if (item.action === 'create') {
      const created = await PersistenceService.createScript(item.data);
      await this.remapId('script', item.entityId, created.id);
    } else {
      await PersistenceService.updateScript(item.entityId, item.data);
    }
  }

  private async syncHistory(item: SyncQueueItem): Promise<void> {
    // History is write-only, just create on server
    await PersistenceService.saveHistory(item.data);
  }

  private getOnlineDelete(type: string): { entityType: string; onlineDelete: ((type: string, id: string) => Promise<void>) | null } {
    const map: Record<string, string> = {
      'request': 'request',
      'collection': 'collection',
      'folder': 'folder',
      'environment': 'environment',
      'workspace': 'workspace',
    };
    return {
      entityType: map[type] || type,
      onlineDelete: async (t, id) => {
        switch (t) {
          case 'request': await PersistenceService.deleteRequestOnline(id); break;
          case 'collection': await PersistenceService.deleteCollectionOnline(id); break;
          case 'folder': await PersistenceService.deleteFolderOnline(id); break;
          case 'environment': await PersistenceService.deleteEnvironmentOnline(id); break;
          case 'workspace': await PersistenceService.deleteWorkspaceOnline(id); break;
        }
      },
    };
  }

  private async remapId(type: string, tempId: string, realId: string): Promise<void> {
    console.log(`[SyncEngine] Remapping ${type} ID: ${tempId} -> ${realId}`);
    // Import dynamically to avoid circular deps
    const { useStore } = await import('../store/useStore');
    const state = useStore.getState();

    // Guard: if the realId already exists in the store (from a Realtime fetch that
    // arrived before remapId ran), remove the tempId entry silently instead of
    // duplicating the realId.
    const alreadyExists = (() => {
      switch (type) {
        case 'request': {
          const allReqs = (node: any): any[] => [
            ...(node.requests || []),
            ...(node.folders || []).flatMap(allReqs)
          ];
          return state.collections.some(c => allReqs(c).some((r: any) => r.id === realId));
        }
        case 'collection':
          return state.collections.some(c => c.id === realId);
        case 'folder': {
          const allFolders = (node: any): any[] => [
            ...(node.folders || []),
            ...(node.folders || []).flatMap(allFolders)
          ];
          return state.collections.some(c => allFolders(c).some((f: any) => f.id === realId));
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
      // Remove the tempId item — the realId is already in the store from Realtime
      switch (type) {
        case 'request':
          state.setCollections(state.collections.map((c: any) => ({
            ...c,
            requests: (c.requests || []).filter((r: any) => r.id !== tempId),
            folders: (c.folders || []).map((f: any) => ({
              ...f,
              requests: (f.requests || []).filter((r: any) => r.id !== tempId),
              folders: f.folders ? (f.folders as any[]).filter((s: any) => s.id !== tempId) : undefined
            }))
          })));
          break;
        case 'collection':
          state.setCollections(state.collections.filter((c: any) => c.id !== tempId));
          break;
        case 'folder': {
          const removeFolder = (folders: any[]): any[] =>
            folders.filter(f => f.id !== tempId).map(f => f.folders ? { ...f, folders: removeFolder(f.folders) } : f);
          state.setCollections(state.collections.map((c: any) => ({ ...c, folders: removeFolder(c.folders || []) })));
          break;
        }
        case 'environment':
          state.setEnvironments(state.environments.filter((e: any) => e.id !== tempId));
          break;
        case 'workspace':
          state.setWorkspaces(state.workspaces.filter((w: any) => w.id !== tempId));
          break;
      }
      // Clean up tabs
      const cleanTabs = state.openTabs.filter(t => t.id !== tempId);
      if (cleanTabs.length !== state.openTabs.length) {
        state.setUserTabs(cleanTabs);
        if (state.activeTabId === tempId) {
          state.setActiveTab(cleanTabs.length > 0 ? cleanTabs[cleanTabs.length - 1].id : null);
        }
      }
      console.log(`[SyncEngine] realId ${realId} already exists. Removed tempId ${tempId} instead.`);
      return;
    }

    // Update in store
    switch (type) {
      case 'request': {
        state.updateRequest(realId, { id: realId } as any);
        // Also update in collections tree
        const updateTree = (nodes: any[]): any[] => {
          return nodes.map(n => {
            if (n.id === tempId) return { ...n, id: realId };
            const result: any = { ...n };
            if (n.folders) {
              result.folders = updateTree(n.folders);
            }
            if (n.requests) {
              result.requests = n.requests.map((r: any) => r.id === tempId ? { ...r, id: realId } : r);
            }
            return result;
          });
        };
        // We need to also update the localDB record
        const existingReq = await localDB.requests.get(realId);
        if (!existingReq) {
          const oldReq = await localDB.requests.get(tempId);
          if (oldReq) {
            await localDB.requests.delete(tempId);
            await localDB.requests.put({ ...oldReq, id: realId });
          }
        }
        break;
      }
      case 'collection': {
        state.setCollections(state.collections.map((c: any) => c.id === tempId ? { ...c, id: realId } : c));
        const oldCol = await localDB.collections.get(tempId);
        if (oldCol) {
          await localDB.collections.delete(tempId);
          await localDB.collections.put({ ...oldCol, id: realId });
        }
        break;
      }
      case 'folder': {
        const updateFolders = (folders: any[]): any[] => folders.map((f: any) => {
          if (f.id === tempId) return { ...f, id: realId };
          if (f.folders) return { ...f, folders: updateFolders(f.folders) };
          return f;
        });
        state.setCollections(state.collections.map((c: any) => ({
          ...c,
          folders: c.folders ? updateFolders(c.folders) : [],
        })));
        const oldFolder = await localDB.folders.get(tempId);
        if (oldFolder) {
          await localDB.folders.delete(tempId);
          await localDB.folders.put({ ...oldFolder, id: realId });
        }
        break;
      }
      case 'environment': {
        state.setEnvironments(state.environments.map((e: any) => e.id === tempId ? { ...e, id: realId } : e));
        if (state.activeEnvId === tempId) state.setActiveEnvId(realId);
        const oldEnv = await localDB.environments.get(tempId);
        if (oldEnv) {
          await localDB.environments.delete(tempId);
          await localDB.environments.put({ ...oldEnv, id: realId });
        }
        break;
      }
      case 'workspace': {
        state.setWorkspaces(state.workspaces.map((w: any) => w.id === tempId ? { ...w, id: realId } : w));
        if (state.activeWorkspaceId === tempId) state.setActiveWorkspaceId(realId);
        const oldWs = await localDB.workspaces.get(tempId);
        if (oldWs) {
          await localDB.workspaces.delete(tempId);
          await localDB.workspaces.put({ ...oldWs, id: realId });
        }
        break;
      }
    }

    // Update any subsequent queue items that reference this temp ID
    const queue = await localDB.syncQueue.toArray();
    for (const qi of queue) {
      let updated = false;
      if (qi.data?.collection_id === tempId) { qi.data.collection_id = realId; updated = true; }
      if (qi.data?.folder_id === tempId) { qi.data.folder_id = realId; updated = true; }
      if (qi.data?.workspace_id === tempId) { qi.data.workspace_id = realId; updated = true; }
      if (qi.data?.parent_id === tempId) { qi.data.parent_id = realId; updated = true; }
      if (qi.data?.user_id === tempId) { /* skip, user IDs don't get remapped */ }
      if (updated) {
        await localDB.syncQueue.put(qi);
      }
    }
  }

  private async markConflict(item: SyncQueueItem): Promise<void> {
    // Update the entity in localDB to 'conflict' status
    try {
      const table = this.getTableForType(item.type);
      if (table) {
        const record = await table.get(item.entityId);
        if (record) {
          await table.update(item.entityId, { syncStatus: 'conflict' as SyncStatus, lastError: item.lastError } as any);
        }
      }
    } catch (err) {
      console.error('[SyncEngine] Failed to mark conflict:', err);
    }
  }

  private getTableForType(type: string) {
    const map: Record<string, any> = {
      request: localDB.requests,
      collection: localDB.collections,
      folder: localDB.folders,
      environment: localDB.environments,
      workspace: localDB.workspaces,
      profile: localDB.profiles,
      script: localDB.scripts,
      history: localDB.history,
    };
    return map[type] || null;
  }

  /** Check if an ID is a proper UUID (not an offline placeholder like 'offline-user-id' or 'offline-ws') */
  private isValidUuid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  /** Check if a sync queue item was created with offline-only references that can't be synced to Supabase */
  private isOfflineItem(item: SyncQueueItem): boolean {
    const data = item.data;
    if (!data) return false;
    // User IDs that aren't valid UUIDs can't be sent to Supabase
    if (data.user_id && typeof data.user_id === 'string' && !this.isValidUuid(data.user_id)) return true;
    // Workspace IDs that aren't valid UUIDs can't be sent to Supabase
    if (data.workspace_id && typeof data.workspace_id === 'string' && !this.isValidUuid(data.workspace_id)) return true;
    // The entity ID itself could be an offline placeholder
    if (!this.isValidUuid(item.entityId)) return true;
    return false;
  }

  private isNetworkError(err: any): boolean {
    if (!navigator.onLine) return true;
    const msg = String(err?.message || '').toLowerCase();
    return msg.includes('network error') ||
      msg.includes('failed to fetch') ||
      msg.includes('timeout') ||
      err?.code === 'ECONNABORTED' ||
      err?.status === 0 ||
      err?.status === 429; // Rate limit
  }

  async forceSyncAll(): Promise<{ completed: number; failed: number }> {
    await this.refreshPendingCount();
    await this.processQueue();
    return { completed: this._pendingCount - await countPendingSyncs(), failed: 0 };
  }
}

export const syncEngine = new SyncEngine();

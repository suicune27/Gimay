import { localDB, enqueueSync, DEVICE_ID } from './LocalDB';
import { PersistenceService } from './PersistenceService';
import { useStore } from '../store/useStore';
import type { SyncStatus } from '../types';

export interface ConflictItem {
  entityType: string;
  id: string;
  name: string;
  lastError: string;
  localUpdatedAt: string;
  tableName: string;
}

const LABEL_MAP: Record<string, string> = {
  request: 'Request',
  collection: 'Collection',
  folder: 'Folder',
  environment: 'Environment',
  workspace: 'Workspace',
  profile: 'Profile',
  script: 'Script',
  history: 'History',
};

const TABLE_MAP: Record<string, any> = {
  request: localDB.requests,
  collection: localDB.collections,
  folder: localDB.folders,
  environment: localDB.environments,
  workspace: localDB.workspaces,
  profile: localDB.profiles,
  script: localDB.scripts,
  history: localDB.history,
};

/**
 * Count all entities with 'conflict' syncStatus across all tables.
 */
export async function getConflictCount(): Promise<number> {
  let total = 0;
  for (const table of Object.values(TABLE_MAP)) {
    total += await table.where('syncStatus').equals('conflict' as SyncStatus).count();
  }
  return total;
}

/**
 * Gather all conflict items with display information.
 */
export async function getConflicts(): Promise<ConflictItem[]> {
  const items: ConflictItem[] = [];

  for (const [entityType, table] of Object.entries(TABLE_MAP)) {
    const records = await table
      .where('syncStatus')
      .equals('conflict' as SyncStatus)
      .toArray() as any[];

    for (const rec of records) {
      items.push({
        entityType,
        id: rec.id,
        name: rec.name || rec.request_name || rec.email || entityType,
        lastError: rec.lastError || 'Unknown sync error',
        localUpdatedAt: rec.updated_at || rec.created_at || '',
        tableName: LABEL_MAP[entityType] || entityType,
      });
    }
  }

  return items.sort((a, b) => b.localUpdatedAt.localeCompare(a.localUpdatedAt));
}

/**
 * Resolve a conflict by keeping the local version.
 * Marks as pending_sync and re-queues the item for sync.
 */
export async function resolveKeepLocal(entityType: string, id: string): Promise<void> {
  const table = TABLE_MAP[entityType];
  if (!table) return;

  await table.update(id, {
    syncStatus: 'pending_sync' as SyncStatus,
  });

  // Re-fetch the record and enqueue for sync
  const record = await table.get(id);
  if (record) {
    await enqueueSync(entityType as any, 'update', id, record);
  }

  // Update store if applicable
  updateStoreState(entityType, id, { syncStatus: 'pending_sync' as SyncStatus });
}

/**
 * Resolve a conflict by replacing local with the cloud/server version.
 * Fetches from Supabase and overwrites local.
 */
export async function resolveUseCloud(entityType: string, id: string): Promise<void> {
  const table = TABLE_MAP[entityType];
  if (!table) return;

  try {
    const serverRecord = await fetchFromServer(entityType, id);
    if (serverRecord) {
      const stamped = {
        ...serverRecord,
        syncStatus: 'synced' as SyncStatus,
        device_id: DEVICE_ID,
        version: (serverRecord.version || 0) + 1,
      };
      await table.put(stamped);
      updateStoreState(entityType, id, stamped);
    }
  } catch (err) {
    console.error(`[ConflictResolver] Failed to fetch cloud version for ${entityType}:${id}:`, err);
    throw new Error(`Could not fetch cloud version: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Resolve a conflict by discarding the local version entirely.
 */
export async function resolveDiscardLocal(entityType: string, id: string): Promise<void> {
  const table = TABLE_MAP[entityType];
  if (!table) return;

  await table.delete(id);
  updateStoreState(entityType, id, null, true);
}

/**
 * Helper: fetch a record from Supabase by type and id.
 */
async function fetchFromServer(entityType: string, id: string): Promise<any | null> {
  const { supabase } = await import('../lib/supabase');

  const tableNameMap: Record<string, string> = {
    request: 'requests',
    collection: 'collections',
    folder: 'folders',
    environment: 'environments',
    workspace: 'workspaces',
    profile: 'profiles',
    script: 'scripts',
    history: 'history',
  };

  const dbTable = tableNameMap[entityType];
  if (!dbTable) return null;

  const { data } = await supabase
    .from(dbTable)
    .select('*')
    .eq('id', id)
    .single();

  return data;
}

/**
 * Helper: update Zustand store after resolution.
 */
function updateStoreState(entityType: string, id: string, updates: any, isDelete = false): void {
  const state = useStore.getState();

  switch (entityType) {
    case 'request':
      if (isDelete) {
        state.deleteRequestState(id);
      } else {
        state.updateRequest(id, updates);
      }
      break;
    case 'collection':
      if (!isDelete) {
        state.setCollections(state.collections.map((c: any) =>
          c.id === id ? { ...c, ...updates } : c
        ));
      } else {
        state.setCollections(state.collections.filter((c: any) => c.id !== id));
      }
      break;
    case 'environment':
      if (!isDelete) {
        state.setEnvironments(state.environments.map((e: any) =>
          e.id === id ? { ...e, ...updates } : e
        ));
      } else {
        state.setEnvironments(state.environments.filter((e: any) => e.id !== id));
      }
      break;
    case 'workspace':
      if (!isDelete) {
        state.setWorkspaces(state.workspaces.map((w: any) =>
          w.id === id ? { ...w, ...updates } : w
        ));
      } else {
        state.setWorkspaces(state.workspaces.filter((w: any) => w.id !== id));
      }
      break;
  }
}

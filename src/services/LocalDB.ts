import Dexie, { type Table } from 'dexie';
import type { 
  RequestData, Collection, Folder, Environment, Workspace, 
  HistoryEntry, Script, ScriptExecutionLog, Profile, Team,
  SyncStatus 
} from '../types';

export function generateDeviceId(): string {
  let id = localStorage.getItem('gimay-device-id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
    localStorage.setItem('gimay-device-id', id);
  }
  return id;
}

export const DEVICE_ID = generateDeviceId();

export interface SyncQueueItem {
  id: string;
  type: 'request' | 'collection' | 'folder' | 'environment' | 'workspace' | 'profile' | 'script' | 'history';
  action: 'create' | 'update' | 'delete';
  entityId: string;
  data: any;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

// Use a fresh database name to avoid any stale schema from prior dev HMR cycles.
// We also clean up the legacy database on first init.
// Use a fresh database name to avoid any stale IndexedDB artifacts from
// prior dev HMR cycles. Earlier iterations created 'GimayLocalDB' at
// various versions with different schemas, so we use a new name and
// clean up the old ones.
const SCHEMA_VERSION = 2;
const DB_NAME = 'GimayLocalDB_v3';
const LEGACY_DB_NAME = 'GimayLocalDB';
const LEGACY_DB_NAME_V2 = 'GimayLocalDB_v2';

// ---------------------------------------------------------------------------
// Typed Dexie subclass
// ---------------------------------------------------------------------------
export class GimayLocalDB extends Dexie {
  requests!: Table<RequestData, string>;
  collections!: Table<Collection, string>;
  folders!: Table<Folder, string>;
  environments!: Table<Environment, string>;
  workspaces!: Table<Workspace, string>;
  history!: Table<HistoryEntry, string>;
  scripts!: Table<Script, string>;
  scriptLogs!: Table<ScriptExecutionLog, string>;
  profiles!: Table<Profile, string>;
  teams!: Table<Team, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super(DB_NAME);

    this.version(SCHEMA_VERSION).stores({
      requests: 'id, workspace_id, collection_id, folder_id, user_id, syncStatus, updated_at',
      collections: 'id, workspace_id, user_id, syncStatus, updated_at',
      folders: 'id, collection_id, user_id, parent_id, syncStatus',
      environments: 'id, workspace_id, user_id, syncStatus, updated_at',
      workspaces: 'id, user_id, syncStatus',
      history: 'id, workspace_id, user_id, syncStatus, created_at',
      scripts: 'id, workspace_id, user_id, syncStatus',
      scriptLogs: 'id, workspace_id, user_id',
      profiles: 'id, syncStatus',
      teams: 'id, user_id, syncStatus',
      syncQueue: 'id, type, action, timestamp, retryCount',
    });

    this.requests = this.table('requests');
    this.collections = this.table('collections');
    this.folders = this.table('folders');
    this.environments = this.table('environments');
    this.workspaces = this.table('workspaces');
    this.history = this.table('history');
    this.scripts = this.table('scripts');
    this.scriptLogs = this.table('scriptLogs');
    this.profiles = this.table('profiles');
    this.teams = this.table('teams');
    this.syncQueue = this.table('syncQueue');
  }
}

// ---------------------------------------------------------------------------
// Singleton — use a fresh database name to sidestep stale IndexedDB schemas
// from prior dev HMR cycles.  Dexie handles the async database open
// internally: construction + version() just register the schema, and the
// actual IndexedDB open happens lazily on the first table operation.
// ---------------------------------------------------------------------------

const db = new GimayLocalDB();

// Fire-and-forget cleanup of legacy databases (no longer needed).
[LEGACY_DB_NAME, LEGACY_DB_NAME_V2].forEach(name => {
  if (typeof indexedDB !== 'undefined') {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => console.log(`[LocalDB] Cleaned up legacy database "${name}"`);
      req.onerror = () => {};
    } catch {}
  }
});

// Eagerly open so Dexie surfaces any schema errors immediately.
db.open().then(() => {
  console.log(`[LocalDB] Database opened successfully as "${DB_NAME}" v${SCHEMA_VERSION}`);
  // Expose full state for debugging
  if (typeof window !== 'undefined') {
    (window as any).__LOCALDB_DB__ = db;
  }
}).catch((err: any) => {
  console.error(`[LocalDB] open() failed:`, {
    name: err?.name,
    message: err?.message,
    stack: err?.stack,
    err,
  });
  if (typeof window !== 'undefined') {
    (window as any).__LOCALDB_ERR__ = err;
  }
});

export function getDb(): GimayLocalDB {
  return db;
}

export const localDB = db;

// Debug hook
if (typeof window !== 'undefined') {
  (window as any).__LOCALDB__ = { db, version: SCHEMA_VERSION };
}

// ---------------------------------------------------------------------------
// Helper: Stamp sync fields on records
// ---------------------------------------------------------------------------
export function stampSyncFields<T extends Record<string, any>>(
  record: T,
  syncStatus: SyncStatus = 'local_only'
): T & { syncStatus: SyncStatus; device_id: string; version: number } {
  return {
    ...record,
    syncStatus,
    device_id: DEVICE_ID,
    version: ((record as any).version || 0) + 1,
  };
}

// --- Helper: Mark for deletion ---
export function stampDeleted<T extends { deleted_at?: string | null; syncStatus?: SyncStatus }>(
  record: T
): T {
  return {
    ...record,
    deleted_at: new Date().toISOString(),
    syncStatus: 'pending_sync' as SyncStatus,
  };
}

// --- Enqueue sync operations ---
export async function enqueueSync(
  type: SyncQueueItem['type'],
  action: SyncQueueItem['action'],
  entityId: string,
  data: any
): Promise<void> {
  const q = db.syncQueue;

  if (action === 'delete') {
    const createKey = `${type}:create:${entityId}`;
    const existingCreate = await q.get(createKey);
    if (existingCreate) {
      console.log(`[LocalDB] Delete cancels pending create for ${type}:${entityId}`);
      await q.delete(createKey);
      return;
    }
    const updateKey = `${type}:update:${entityId}`;
    const existingUpdate = await q.get(updateKey);
    if (existingUpdate) {
      await q.delete(updateKey);
    }
  }

  if (action === 'update') {
    const createKey = `${type}:create:${entityId}`;
    const existingCreate = await q.get(createKey);
    if (existingCreate) {
      existingCreate.data = { ...existingCreate.data, ...data };
      existingCreate.timestamp = Date.now();
      await q.put(existingCreate);
      return;
    }
  }

  const queueId = `${type}:${action}:${entityId}`;
  const existing = await q.get(queueId);
  if (existing) {
    if (action === 'update' && existing.action === 'update') {
      await q.update(queueId, {
        data: { ...existing.data, ...data },
        timestamp: Date.now(),
      });
      return;
    }
    await q.update(queueId, { timestamp: Date.now() });
    return;
  }

  await q.put({
    id: queueId,
    type,
    action,
    entityId,
    data,
    timestamp: Date.now(),
    retryCount: 0,
  });
}

// --- Remove from sync queue ---
export async function dequeueSync(queueId: string): Promise<void> {
  await db.syncQueue.delete(queueId);
}

// --- Get pending sync items ordered by timestamp ---
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue.where('timestamp').above(0).sortBy('timestamp');
}

// --- Count pending sync items ---
export async function countPendingSyncs(): Promise<number> {
  return db.syncQueue.count();
}

// --- Bulk upsert to local DB with sync status ---
export async function bulkUpsert<T extends { id: string }>(
  table: Table<T, string>,
  items: T[]
): Promise<void> {
  await table.bulkPut(items);
}

// --- Get items needing sync ---
export async function getItemsBySyncStatus<T>(
  table: Table<T, string>,
  statuses: SyncStatus[]
): Promise<T[]> {
  return table
    .where('syncStatus')
    .anyOf(statuses)
    .toArray() as Promise<T[]>;
}

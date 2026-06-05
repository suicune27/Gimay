import { supabase } from '../../lib/supabase';
import { Collection } from '../../types';
import { runResilientAction, getStore, isOffline } from './CorePersistence';
import { createFolder, createFolderOnline } from './FolderPersistence';
import { createRequest } from './RequestPersistence';

export async function createCollection(workspaceId: string, userId: string, name: string = 'New Collection') {
  return runResilientAction(
    () => createCollectionOnline(workspaceId, userId, name),
    () => {
      const mockCollection: Collection = {
        id: `offline-${Math.random().toString(36).substr(2, 9)}`,
        name, workspace_id: workspaceId, user_id: userId,
        folders: [], requests: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        visibility: 'private', permission: 'owner' as any,
        variables: [], auth: { type: 'inherit' }
      };
      const state = getStore().getState();
      state.setCollections([...state.collections, mockCollection]);
      return mockCollection;
    },
    (mockCollection) => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('collection', 'create', mockCollection.id, mockCollection);
    }
  );
}

export async function createCollectionOnline(workspaceId: string, userId: string, name: string) {
  const { data: collection, error } = await supabase
    .from('collections').insert([{ name, workspace_id: workspaceId, user_id: userId }]).select().maybeSingle();
  if (error) throw error;
  return collection as Collection;
}

export async function updateCollection(id: string, updates: Partial<Collection>) {
  return runResilientAction(
    () => updateCollectionOnline(id, updates),
    () => {
      const state = getStore().getState();
      state.setCollections(state.collections.map((c: any) => c.id === id ? { ...c, ...updates } : c));
      return { id, ...updates } as Collection;
    },
    () => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('collection', 'update', id, updates);
    }
  );
}

export async function updateCollectionOnline(id: string, updates: Partial<Collection>) {
  let { data, error } = await supabase
    .from('collections').update(updates).eq('id', id).select().maybeSingle();

  if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
    const sanitizedUpdates = { ...updates } as any;
    ['team_id', 'visibility', 'permission', 'pre_request_script', 'test_script',
     'workspace_id', 'updated_at', 'variables', 'auth', 'documentation'
    ].forEach(col => delete sanitizedUpdates[col]);

    const fallback = await supabase
      .from('collections').update(sanitizedUpdates).eq('id', id).select().maybeSingle();
    data = fallback.data; error = fallback.error;
  }

  if (error) throw error;
  return data as Collection;
}

export async function deleteCollection(id: string) {
  return runResilientAction(
    () => deleteCollectionOnline(id),
    () => {
      const state = getStore().getState();
      state.setCollections(state.collections.filter((c: any) => c.id !== id));
      return id;
    },
    () => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('collection', 'delete', id, null);
    }
  );
}

export async function deleteCollectionOnline(id: string) {
  const { error } = await supabase.from('collections').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateCollection(collectionId: string, userId: string, workspaceId: string) {
  if (isOffline()) {
    const state = getStore().getState();
    const original = state.collections.find((c: any) => c.id === collectionId);
    if (!original) throw new Error('Original collection not found offline.');

    const newCol = await createCollection(workspaceId, userId, `${original.name} (Copy)`);

    const duplicateFolder = async (oldFolder: any, parentId?: string) => {
      const nf = await createFolder(oldFolder.name, newCol.id, userId, parentId, workspaceId);
      const children = (original.folders || []).filter((f: any) => f.parent_id === oldFolder.id);
      for (const child of children) await duplicateFolder(child, nf.id);
      for (const r of (oldFolder.requests || [])) {
        await createRequest({ ...r, name: r.name, collection_id: newCol.id, folder_id: nf.id, workspace_id: workspaceId, user_id: userId });
      }
    };
    for (const f of (original.folders || []).filter((f: any) => !f.parent_id)) await duplicateFolder(f);
    for (const r of (original.requests || [])) {
      await createRequest({ ...r, name: r.name, collection_id: newCol.id, folder_id: null as any, workspace_id: workspaceId, user_id: userId });
    }
    return newCol;
  }

  const { data: collection, error: colError } = await supabase
    .from('collections').select('*, folders(*), requests(*)').eq('id', collectionId).single();
  if (colError || !collection) throw colError || new Error('Collection lookup failed.');

  const newCol = await createCollection(workspaceId, userId, `${collection.name} (Copy)`);
  const folderMap: Record<string, string> = {};
  const folders = collection.folders || [];

  const duplicateFolder = async (oldFolder: any, parentId?: string) => {
    const { id: oldId, created_at, updated_at, ...folderData } = oldFolder;
    const nf = await createFolderOnline(folderData.name, newCol.id, userId, parentId, workspaceId);
    folderMap[oldId] = nf.id;
    for (const child of folders.filter((f: any) => f.parent_id === oldId)) await duplicateFolder(child, nf.id);
  };
  for (const f of folders.filter((f: any) => !f.parent_id)) await duplicateFolder(f);

  for (const r of (collection.requests || [])) {
    const { id, created_at, updated_at, ...requestData } = r;
    await createRequest({ ...requestData, name: requestData.name, collection_id: newCol.id, folder_id: requestData.folder_id ? folderMap[requestData.folder_id] : undefined, workspace_id: workspaceId, user_id: userId, bodyType: requestData.body_type });
  }
  return newCol;
}

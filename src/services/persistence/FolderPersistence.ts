import { supabase } from '../../lib/supabase';
import { Folder } from '../../types';
import { runResilientAction, getStore, isOffline } from './CorePersistence';
import { createRequest } from './RequestPersistence';

export async function createFolder(name: string, collectionId: string, userId: string, parentId?: string, workspaceId?: string) {
  return runResilientAction(
    () => createFolderOnline(name, collectionId, userId, parentId, workspaceId),
    () => {
      const mockFolder: Folder = {
        id: `offline-${Math.random().toString(36).substr(2, 9)}`,
        name, collection_id: collectionId, user_id: userId, parent_id: parentId || null,
        auth: { type: 'inherit' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as any;
      const state = getStore().getState();
      state.setCollections(state.collections.map((c: any) =>
        c.id !== collectionId ? c : { ...c, folders: [...(c.folders || []), mockFolder] }
      ));
      return mockFolder;
    },
    (mockFolder) => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('folder', 'create', mockFolder.id, mockFolder);
    }
  );
}

export async function createFolderOnline(name: string, collectionId: string, userId: string, parentId?: string, workspaceId?: string) {
  const payload: any = { name, collection_id: collectionId, user_id: userId, parent_id: parentId, auth: { type: 'inherit' } };
  if (workspaceId) payload.workspace_id = workspaceId;

  let { data, error } = await supabase
    .from('folders').insert([payload]).select().maybeSingle();

  if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
    delete payload.workspace_id;
    const fallback = await supabase.from('folders').insert([payload]).select().maybeSingle();
    data = fallback.data; error = fallback.error;
  }
  if (error) throw error;
  return data as Folder;
}

export async function updateFolder(id: string, updates: Partial<Folder>) {
  return runResilientAction(
    () => updateFolderOnline(id, updates),
    () => {
      const state = getStore().getState();
      const updateFolderInTree = (folders: any[]): any[] =>
        folders.map(f => f.id === id ? { ...f, ...updates } : f.folders ? { ...f, folders: updateFolderInTree(f.folders) } : f);
      state.setCollections(state.collections.map((c: any) => ({
        ...c, folders: c.folders ? updateFolderInTree(c.folders) : []
      })));
      return { id, ...updates } as Folder;
    },
    () => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('folder', 'update', id, updates);
    }
  );
}

export async function updateFolderOnline(id: string, updates: Partial<Folder>) {
  let { data, error } = await supabase
    .from('folders').update(updates).eq('id', id).select().maybeSingle();

  if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
    const sanitizedUpdates = { ...updates } as any;
    delete sanitizedUpdates.workspace_id; delete sanitizedUpdates.user_id;
    const fallback = await supabase.from('folders').update(sanitizedUpdates).eq('id', id).select().maybeSingle();
    data = fallback.data; error = fallback.error;
  }
  if (error) throw error;
  return data as Folder;
}

export async function deleteFolder(id: string) {
  return runResilientAction(
    () => deleteFolderOnline(id),
    () => {
      const state = getStore().getState();
      const deleteFolderInTree = (folders: any[]): any[] =>
        folders.filter(f => f.id !== id).map(f => f.folders ? { ...f, folders: deleteFolderInTree(f.folders) } : f);
      state.setCollections(state.collections.map((c: any) => ({
        ...c, folders: c.folders ? deleteFolderInTree(c.folders) : []
      })));
      return id;
    },
    () => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('folder', 'delete', id, null);
    }
  );
}

export async function deleteFolderOnline(id: string) {
  const { error } = await supabase.from('folders').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateFolder(folderId: string, collectionId: string, userId: string, parentId?: string, workspaceId?: string) {
  if (isOffline()) {
    const state = getStore().getState();
    const findFolder = (folders: any[]): any => {
      for (const f of folders) {
        if (f.id === folderId) return f;
        if (f.folders) { const found = findFolder(f.folders); if (found) return found; }
      }
      return null;
    };
    let folder: any = null;
    for (const c of state.collections) { folder = findFolder(c.folders || []); if (folder) break; }
    if (!folder) throw new Error('Folder lookup failed offline.');

    const duplicated = await createFolder(`${folder.name} (Copy)`, collectionId, userId, parentId, workspaceId);
    for (const sub of (folder.folders || [])) await duplicateFolder(sub.id, collectionId, userId, duplicated.id, workspaceId);
    for (const r of (folder.requests || [])) {
      await createRequest({ ...r, name: r.name, collection_id: collectionId, folder_id: duplicated.id, workspace_id: workspaceId || r.workspace_id, user_id: userId });
    }
    return duplicated;
  }

  const { data: folder, error: folderError } = await supabase
    .from('folders').select('*').eq('id', folderId).single();
  if (folderError || !folder) throw folderError || new Error('Folder lookup failed.');

  const duplicated = await createFolder(`${folder.name} (Copy)`, collectionId, userId, parentId, workspaceId);

  const { data: subfolders } = await supabase.from('folders').select('*').eq('parent_id', folderId);
  if (subfolders) for (const sub of subfolders) await duplicateFolder(sub.id, collectionId, userId, duplicated.id, workspaceId);

  const { data: requests } = await supabase.from('requests').select('*').eq('folder_id', folderId);
  if (requests) {
    for (const r of requests) {
      const { id, created_at, updated_at, ...requestData } = r;
      await createRequest({ ...requestData, name: requestData.name, collection_id: collectionId, folder_id: duplicated.id, workspace_id: workspaceId || r.workspace_id, user_id: userId, bodyType: requestData.body_type });
    }
  }
  return duplicated;
}

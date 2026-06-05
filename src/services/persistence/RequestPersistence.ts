import { supabase } from '../../lib/supabase';
import { RequestData, KeyValue } from '../../types';
import { runResilientAction, getStore, isOffline } from './CorePersistence';

export async function createRequest(data: Partial<RequestData>) {
  return runResilientAction(
    () => createRequestOnline(data),
    () => {
      const mockRequest: any = {
        id: `offline-${Math.random().toString(36).substr(2, 9)}`,
        name: data.name || 'New Request',
        method: data.method || 'GET',
        url: data.url || '',
        headers: data.headers || [] as KeyValue[],
        params: data.params || [] as KeyValue[],
        body: data.body || '',
        body_type: (data as any).body_type || data.bodyType || 'none',
        collection_id: data.collection_id || '',
        folder_id: data.folder_id || null,
        workspace_id: data.workspace_id || '',
        user_id: data.user_id || '',
        auth: data.auth || { type: 'inherit' },
        settings: data.settings || { followRedirects: true, maxRedirects: 10, timeout: 30000 },
        pre_request_script: data.pre_request_script || '',
        test_script: data.test_script || '',
        sort_order: (data as any).sort_order || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
        type: (data as any).type || 'http',
        bodyType: (data as any).body_type || data.bodyType || 'none'
      };
      const state = getStore().getState();
      state.addRequest(mockRequest);
      return mockRequest;
    },
    (mockRequest) => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('request', 'create', mockRequest.id, mockRequest);
    }
  );
}

export async function createRequestOnline(data: Partial<RequestData>) {
  const insertData: any = {
    name: data.name, method: data.method, url: data.url,
    headers: data.headers || [], params: data.params || [],
    body: data.body,    body_type: (data as any).body_type || data.bodyType || 'none',
    collection_id: data.collection_id, folder_id: data.folder_id,
    workspace_id: data.workspace_id, user_id: data.user_id,
    auth: data.auth, settings: data.settings,
    pre_request_script: data.pre_request_script || '',
    test_script: data.test_script || '',
    sort_order: (data as any).sort_order || 0,
    type: (data as any).type || 'http'
  };

  let { data: request, error } = await supabase
    .from('requests').insert([insertData]).select().single();

  if (error && String(error.message || '').toLowerCase().includes('column')) {
    delete insertData.pre_request_script; delete insertData.test_script;
    delete insertData.settings; delete insertData.auth; delete insertData.type;
    delete insertData.workspace_id; delete insertData.body_type;

    const fallback = await supabase.from('requests').insert([insertData]).select().single();
    request = fallback.data; error = fallback.error;
  }

  if (error) throw error;
  return { ...request, bodyType: request.body_type, body: request.body } as RequestData;
}

export async function saveRequest(id: string, data: Partial<RequestData>) {
  return runResilientAction(
    () => saveRequestOnline(id, data),
    () => {
      const state = getStore().getState();
      state.updateRequestState(id, data);
      return { id, ...data } as RequestData;
    },
    () => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('request', 'update', id, data);
    }
  );
}

export async function saveRequestOnline(data: Partial<RequestData>): Promise<RequestData>;
export async function saveRequestOnline(id: string, data: Partial<RequestData>): Promise<RequestData>;
export async function saveRequestOnline(idOrData: string | Partial<RequestData>, data?: Partial<RequestData>) {
  let id: string;
  if (typeof idOrData === 'string') {
    id = idOrData;
  } else {
    data = idOrData;
    // Fallback: extract id from data if available (for SyncService compat)
    id = (data as any).id || '';
  }
  const updates = data!;
  const dbUpdates: any = { ...data };
  delete dbUpdates.bodyType;
  if (dbUpdates.body && typeof dbUpdates.body === 'object') dbUpdates.body = JSON.stringify(dbUpdates.body);

  let { data: result, error } = await supabase
    .from('requests').update({ ...dbUpdates }).eq('id', id).select().single();

  if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
    const safeUpdates = { ...dbUpdates };
    ['pre_request_script', 'test_script', 'settings', 'type', 'auth', 'workspace_id', 'body_type', 'updated_at', 'is_deleted']
      .forEach(col => delete safeUpdates[col]);

    const fallback = await supabase.from('requests').update(safeUpdates).eq('id', id).select().single();
    result = fallback.data; error = fallback.error;
  }

  if (error) throw error;
  return { ...result, bodyType: result.body_type, body: result.body } as RequestData;
}

export async function deleteRequest(id: string) {
  return runResilientAction(
    () => deleteRequestOnline(id),
    () => {
      const state = getStore().getState();
      state.deleteRequestState(id);
      return id;
    },
    () => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('request', 'delete', id, null);
    }
  );
}

export async function deleteRequestOnline(id: string) {
  const { error } = await supabase.from('requests').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateRequest(originalId: string, overrides: Partial<RequestData> = {}) {
  if (isOffline()) {
    const state = getStore().getState();
    const findReq = (nodes: any[]): RequestData | null => {
      for (const n of nodes) {
        if (n.id === originalId) return n;
        if (n.folders) { const found = findReq(n.folders); if (found) return found; }
        if (n.requests) { const found = n.requests.find((r: any) => r.id === originalId); if (found) return found; }
      }
      return null;
    };
    const original = findReq(state.collections);
    if (!original) throw new Error('Original request not found offline.');
    return createRequest({ ...original, name: `${original.name} (Copy)`, ...overrides });
  }

  const { data: original, error: fetchError } = await supabase
    .from('requests').select('*').eq('id', originalId).single();
  if (fetchError || !original) throw new Error('Original request not found.');

  const { id, created_at, updated_at, ...cloneData } = original;
  const { data: inserted, error: insertError } = await supabase
    .from('requests').insert([{ ...cloneData, name: `${cloneData.name} (Copy)`, ...overrides }]).select().single();
  if (insertError) throw insertError;
  return { ...inserted, bodyType: inserted.body_type, body: inserted.body } as RequestData;
}

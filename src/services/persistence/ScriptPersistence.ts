import { supabase } from '../../lib/supabase';
import { ScriptExecutionLog } from '../../types';
import { isOffline } from './CorePersistence';

export async function createScriptLog(log: Partial<ScriptExecutionLog>) {
  if (isOffline()) return null;
  try {
    const { data, error } = await supabase.from('script_execution_logs').insert([log]).select().single();
    if (error) throw error;
    return data;
  } catch { return null; }
}

export async function fetchScripts(workspaceId: string) {
  if (isOffline()) return [];
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId || '');
    if (!isUuid) return [];
    const { data, error } = await supabase.from('scripts').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch { return []; }
}

export async function fetchScriptFolders(workspaceId: string) {
  if (isOffline()) return [];
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId || '');
    if (!isUuid) return [];
    let { data, error } = await supabase.from('folders').select('*').eq('workspace_id', workspaceId).is('parent_id', null);
    if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
      const fallback = await supabase.from('folders').select('*').is('parent_id', null);
      data = fallback.data; error = fallback.error;
    }
    if (error) throw error;
    return data || [];
  } catch { return []; }
}

export async function createScript(data: any) {
  if (isOffline()) return { id: `offline-${Math.random().toString(36).substr(2, 9)}`, ...data, created_at: new Date().toISOString() };
  const { data: script, error } = await supabase.from('scripts').insert([data]).select().single();
  if (error) throw error;
  return script;
}

export async function updateScript(id: string, updates: any) {
  if (isOffline()) return { id, ...updates };
  const { data, error } = await supabase.from('scripts').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteScript(id: string) {
  if (isOffline()) return;
  const { error } = await supabase.from('scripts').delete().eq('id', id);
  if (error) throw error;
}

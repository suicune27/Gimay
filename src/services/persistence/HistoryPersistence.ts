import { supabase } from '../../lib/supabase';
import { isOffline, getStore } from './CorePersistence';

export async function saveHistory(entry: any) {
  if (isOffline()) {
    const state = getStore().getState();
    state.setHistory([entry, ...state.history].slice(0, 100));
    return;
  }

  let { error } = await supabase.from('history').insert([entry]);
  if (error && String(error.message || '').toLowerCase().includes('column')) {
    const safeEntry = { ...entry };
    delete safeEntry.workspace_id; delete safeEntry.request_name; delete safeEntry.request_data;
    delete safeEntry.time; delete safeEntry.size;
    const fallback = await supabase.from('history').insert([safeEntry]);
    error = fallback.error;
  }
  if (error) console.error('History Save Error:', error.message);
}

export async function deleteHistory(id: string) {
  if (isOffline()) {
    const state = getStore().getState();
    state.setHistory(state.history.filter((h: any) => h.id !== id));
    return;
  }
  const { error } = await supabase.from('history').delete().eq('id', id);
  if (error) throw error;
}

export async function clearHistory(workspaceId: string, userId: string) {
  if (isOffline()) {
    const state = getStore().getState();
    state.setHistory([]);
    return;
  }
  const { error } = await supabase.from('history').delete().match({ workspace_id: workspaceId, user_id: userId });
  if (error) throw error;
}

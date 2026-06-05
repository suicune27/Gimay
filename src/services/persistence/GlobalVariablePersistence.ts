import { supabase } from '../../lib/supabase';
import { isOffline, getStore } from './CorePersistence';

export async function saveGlobalVariables(userId: string, variables: any[]) {
  if (isOffline()) return;
  try { await supabase.from('global_variables').upsert({ user_id: userId, variables, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }); } catch {}
}

export async function getGlobalVariables(userId: string) {
  if (isOffline()) return getStore()?.getState()?.globalVariables || [];
  try {
    const { data, error } = await supabase.from('global_variables').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data?.variables || [];
  } catch { return getStore()?.getState()?.globalVariables || []; }
}

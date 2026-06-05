import { supabase } from '../../lib/supabase';
import { isOffline, getStore } from './CorePersistence';

export async function syncUserTabs(userId: string, tabs: any[], activeTabId: string | null) {
  if (isOffline()) return null;
  try {
    const { data, error } = await supabase
      .from('user_tabs').upsert({ user_id: userId, tabs, active_tab_id: activeTabId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select().single();
    if (error) throw error;
    return data;
  } catch { return null; }
}

export async function getUserTabs(userId: string) {
  if (isOffline()) return { tabs: getStore()?.getState()?.openTabs || [], active_tab_id: getStore()?.getState()?.activeTabId || null };
  try {
    const { data, error } = await supabase.from('user_tabs').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  } catch { return null; }
}

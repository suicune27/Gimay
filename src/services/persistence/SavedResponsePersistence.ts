import { supabase } from '../../lib/supabase';
import { runResilientAction, isOffline, getStore } from './CorePersistence';

export async function createSavedResponse(requestId: string, userId: string, response: any) {
  if (isOffline()) return null;
  try {
    const { data, error } = await supabase.from('saved_responses').insert([{
      request_id: requestId, user_id: userId, name: response.name || 'New Response',
      status: response.status, body: response.body, headers: response.headers
    }]).select().single();
    if (error) throw error;
    return data;
  } catch { return null; }
}

export async function getSavedResponses(requestId: string) {
  if (isOffline()) return [];
  try {
    const { data, error } = await supabase
      .from('saved_responses').select('*').eq('request_id', requestId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch { return []; }
}

export async function deleteSavedResponse(id: string) {
  if (isOffline()) return;
  try { await supabase.from('saved_responses').delete().eq('id', id); } catch {}
}

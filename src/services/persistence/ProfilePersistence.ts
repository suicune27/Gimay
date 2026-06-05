import { supabase } from '../../lib/supabase';
import { Profile } from '../../types';
import { runResilientAction, isOffline, getStore } from './CorePersistence';

export async function updateProfilePreferences(userId: string, preferences: Profile['preferences']) {
  return runResilientAction(
    () => updateProfileOnline(userId, { preferences }),
    () => {
      const state = getStore().getState();
      if (state.profile) state.setProfile({ ...state.profile, preferences });
      return { preferences };
    },
    () => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('profile', 'update', userId, { preferences });
    }
  );
}

export async function updateProfileOnline(id: string, updates: Partial<Profile> | any) {
  let { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single();
  if (error && String(error.message || '').toLowerCase().includes('column')) {
    const safeUpdates = { ...updates };
    delete safeUpdates.preferences; delete safeUpdates.updated_at;
    const fallback = await supabase.from('profiles').update(safeUpdates).eq('id', id).select().single();
    data = fallback.data; error = fallback.error;
  }
  if (error) throw error;
  return data as Profile;
}

import { supabase, globalSupabase } from '../../lib/supabase';
import { Workspace } from '../../types';
import { runResilientAction, getStore } from './CorePersistence';

export async function createWorkspace(name: string, userId: string, teamId?: string) {
  return runResilientAction(
    () => createWorkspaceOnline(name, userId, teamId),
    () => {
      const mockWS: Workspace = {
        id: `offline-${Math.random().toString(36).substr(2, 9)}`,
        name, user_id: userId,
        visibility: teamId ? 'team' : 'private',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as any;
      const state = getStore().getState();
      state.setWorkspaces([...state.workspaces, mockWS]);
      return mockWS;
    },
    (mockWS) => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('workspace', 'create', mockWS.id, { name, userId, teamId });
    }
  );
}

export async function createWorkspaceOnline(name: string, userId: string, teamId?: string) {
  const payload: any = { name, user_id: userId, visibility: teamId ? 'team' : 'private' };
  if (teamId) payload.team_id = teamId;
  const client = teamId ? globalSupabase : supabase;

  let { data, error } = await client
    .from('workspaces').insert([payload]).select().maybeSingle();

  if (error && String(error.message || '').toLowerCase().includes('column')) {
    const fallback = await client
      .from('workspaces').insert({ name, user_id: userId }).select().maybeSingle();
    data = fallback.data; error = fallback.error;
  }

  if (error) throw error;
  return data as Workspace;
}

export async function updateWorkspace(id: string, updates: Partial<Workspace>) {
  return runResilientAction(
    () => updateWorkspaceOnline(id, updates),
    () => {
      const state = getStore().getState();
      state.setWorkspaces(state.workspaces.map((w: any) => w.id === id ? { ...w, ...updates } : w));
      return { id, ...updates } as Workspace;
    },
    () => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('workspace', 'update', id, updates);
    }
  );
}

export async function updateWorkspaceOnline(id: string, updates: Partial<Workspace>) {
  const { data, error } = await supabase
    .from('workspaces').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Workspace;
}

export async function deleteWorkspace(id: string) {
  return runResilientAction(
    () => deleteWorkspaceOnline(id),
    () => {
      const state = getStore().getState();
      state.setWorkspaces(state.workspaces.filter((w: any) => w.id !== id));
      return id;
    },
    () => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('workspace', 'delete', id, null);
    }
  );
}

export async function deleteWorkspaceOnline(id: string) {
  const { error } = await supabase.from('workspaces').delete().eq('id', id);
  if (error) throw error;
}

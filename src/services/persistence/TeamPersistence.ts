import { supabase, globalSupabase } from '../../lib/supabase';
import { runResilientAction, getStore, isOffline } from './CorePersistence';

export async function createTeam(name: string, ownerId: string) {
  if (isOffline()) {
    const mockTeam = { id: `offline-${Math.random().toString(36).substr(2, 9)}`, name, created_at: new Date().toISOString() };
    const state = getStore().getState();
    state.setTeams([...state.teams, mockTeam]);
    const { syncManager } = require('../SyncService');
    syncManager.enqueueAction('team', 'create', mockTeam.id, { name, ownerId });
    return mockTeam;
  }
  return createTeamOnline(name, ownerId);
}

export async function createTeamOnline(name: string, ownerId: string) {
  const { data: team, error } = await supabase
    .rpc('create_team', { team_name: name, owner_id: ownerId } as any);

  if (error || !team) {
    const fallbackInsert = await supabase.from('teams').insert([{ name }]).select().single();
    if (fallbackInsert.error) throw fallbackInsert.error;

    const teamId = fallbackInsert.data.id;
    const memberInsert = await supabase.from('team_members').insert([{ team_id: teamId, user_id: ownerId, role: 'admin' }]).select().single();
    if (memberInsert.error) throw memberInsert.error;
    return { ...fallbackInsert.data, member: memberInsert.data };
  }
  return team;
}

export async function addTeamMember(teamId: string, identifier: string) {
  if (isOffline()) throw new Error('Cannot add team members while offline.');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  if (!isUuid) {
    const { data: profile } = await globalSupabase
      .from('profiles').select('id').or(`email.eq.${identifier},username.eq.${identifier}`).maybeSingle();
    if (!profile) throw new Error('User not found.');
    identifier = profile.id;
  }
  const { data, error } = await supabase
    .from('team_members').insert([{ team_id: teamId, user_id: identifier, role: 'member' }])
    .select('*, profiles(email, full_name, username)').single();
  if (error) throw error;
  return data;
}

export async function updateTeamMemberRole(teamId: string, userId: string, role: string) {
  if (isOffline()) throw new Error('Cannot update roles while offline.');
  const { data, error } = await supabase
    .from('team_members').update({ role }).match({ team_id: teamId, user_id: userId }).select().single();
  if (error) throw error;
  return data;
}

export async function removeTeamMember(teamId: string, userId: string) {
  if (isOffline()) throw new Error('Cannot remove team members while offline.');
  const { error } = await supabase.from('team_members').delete().match({ team_id: teamId, user_id: userId });
  if (error) throw error;
}

export async function fetchUserTeams(userId: string) {
  if (isOffline()) return getStore()?.getState()?.teams || [];
  try {
    let { data, error } = await globalSupabase
      .from('teams').select('*, team_members!inner(*, profiles(email, full_name, username))')
      .eq('team_members.user_id', userId).order('created_at', { ascending: false });

    if (error && String(error.message || '').match(/profiles|relation|schema cache/i)) {
      const fallback = await globalSupabase
        .from('teams').select('*, team_members!inner(*)').eq('team_members.user_id', userId).order('created_at', { ascending: false });
      data = fallback.data; error = fallback.error;
    }
    if (error) throw error;
    return data || [];
  } catch { return getStore()?.getState()?.teams || []; }
}

export async function fetchWorkspacesByTeam(teamId: string) {
  if (isOffline()) return [];
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId || '');
    if (!isUuid) return [];
    const { data, error } = await globalSupabase.from('workspaces').select('*').eq('team_id', teamId);
    if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) return [];
    if (error) throw error;
    return data || [];
  } catch { return []; }
}

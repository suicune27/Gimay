import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { PersistenceService } from '../services/PersistenceService';
import { RequestUtils } from '../utils/RequestUtils';

export const useDataSync = () => {
  const store = useStore();

  const fetchWorkspaces = async (userId: string) => {
    // Fetch workspaces where user is owner OR member via RLS policies
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Workspaces Fetch Error:', error);
      return;
    }

    if (data) {
      store.setWorkspaces(data);
      
      const isValidActiveWorkspace = data.some(w => w.id === store.activeWorkspaceId);

      if (data.length === 0) {
        // Create initial personal workspace
        let { data: newWs, error: createError } = await supabase
          .from('workspaces')
          .insert([{ name: 'Personal Workspace', user_id: userId, visibility: 'private' }])
          .select()
          .maybeSingle();
        
        if (createError && String(createError.message || '').toLowerCase().includes('column')) {
          console.warn('[Sync] Falling back to non-visibility workspace creation.');
          const fallback = await supabase
            .from('workspaces')
            .insert([{ name: 'Personal Workspace', user_id: userId }])
            .select()
            .maybeSingle();
          newWs = fallback.data;
        }
        
        if (newWs) {
           store.setWorkspaces([newWs]);
           store.setActiveWorkspaceId(newWs.id);
        }
      } else if (!store.activeWorkspaceId || !isValidActiveWorkspace) {
        const lastId = store.profile?.preferences?.last_workspace_id;
        const workspaceToSelect = data.find(w => w.id === lastId) || data[0];
        store.setActiveWorkspaceId(workspaceToSelect.id);
      }
    }
  };

  const fetchCollections = async (workspaceId: string) => {
    if (!workspaceId) return;
    try {
      const teamIds = (store.teams || []).map(t => t.id);
      
      const tryFetch = async (useCollaborators: boolean, useTeamId: boolean, useRequests: boolean = true, useFolders: boolean = true) => {
        let relations = [];
        if (useRequests) relations.push('requests(*)');
        if (useFolders) relations.push('folders(*)');
        if (useCollaborators) relations.push('collection_collaborators(*)');

        const selectStr = relations.length > 0 ? `*, ${relations.join(', ')}` : '*';

        let query = supabase.from('collections').select(selectStr);
        
        if (useTeamId && teamIds.length > 0) {
          return query
            .or(`workspace_id.eq.${workspaceId},team_id.in.(${teamIds.join(',')})`)
            .order('created_at', { ascending: false });
        } else {
          return query
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false });
        }
      };

      let result = await tryFetch(true, true);
      
      // Multi-layer fallback for database inconsistencies
      if (result.error) {
        const msg = String(result.error.message || '').toLowerCase();
        const code = result.error.code;
        
        const isRelError = code === 'PGRST200' || msg.includes('relationship') || msg.includes('foreign key');
        const isColError = code === 'PGRST204' || code === '42703' || msg.includes('column') || msg.includes('not exist');
        
        if (isRelError || isColError) {
          console.warn('[Sync] Collection fetch failed due to schema mismatch. Attempting recovery...', { code, msg });
          
          // Try without collaborators first
          result = await tryFetch(false, true);
          
          if (result.error) {
            // Try without team_id
            result = await tryFetch(false, false);
            
            if (result.error) {
              // Extreme fallback: No relations at all
              console.error('[Sync] Collection fetch critical failure. Stripping all relations.');
              result = await tryFetch(false, false, false, false);
            }
          }
        }
      }

      const { data, error } = result;
      if (error) throw error;
 
       const mappedData = (data || []).map((col: any) => {
        type RequestRow = { id: string; folder_id?: string | null; body_type?: string } & Record<string, any>;
        type FolderRow = { id: string; parent_id?: string | null } & Record<string, any>;

        const allRequests = (col.requests || []).map((req: any) => RequestUtils.normalizeRequest(req));
        
        const allFolders: FolderRow[] = col.folders || [];

        const buildTree = (parentId: string | null = null): any[] => {
          return allFolders
            .filter((f) => (parentId === null ? !f.parent_id : f.parent_id === parentId))
            .map((folder) => ({
              ...folder,
              folders: buildTree(folder.id),
              requests: allRequests.filter((r) => r.folder_id === folder.id)
            }));
        };

        return {
          ...col,
          collaborators: col.collection_collaborators || [],
          folders: buildTree(),
          requests: allRequests.filter(r => !r.folder_id)
        };
      });

      store.setCollections(mappedData);
    } catch (err) {
      console.error('Collections Sync Error:', err);
    }
  };

  const fetchEnvironments = async (workspaceId: string) => {
    const { data, error } = await supabase
      .from('environments')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    
    if (data) store.setEnvironments(data);
  };

  const fetchUserTabs = async () => {
    if (!store.profile?.id) return;
    try {
      const data = await PersistenceService.getUserTabs(store.profile.id);
      if (data) {
        store.setUserTabs(data.tabs || []);
        store.setActiveTab(data.active_tab_id || null);
      }
    } catch (e) {
      console.error('User tabs fetch error:', e);
    }
  };

  const fetchSavedResponses = async (requestId: string) => {
    try {
      const responses = await PersistenceService.getSavedResponses(requestId);
      // TODO: Store responses in store if needed
    } catch (e) {
      console.error('Saved responses fetch error:', e);
    }
  };

  const fetchHistory = async (workspaceId: string) => {
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) (store as any).setHistory?.(data);
  };

  const fetchTeams = async (userId: string) => {
    if (!userId) return;
    let { data, error } = await supabase
      .from('teams')
      .select('*, team_members!inner(*, profiles(email, full_name, username))')
      .eq('team_members.user_id', userId)
      .order('created_at', { ascending: false });

    if (error && String(error.message || '').match(/profiles|relation|schema cache/i)) {
      const fallback = await supabase
        .from('teams')
        .select('*, team_members!inner(*)')
        .eq('team_members.user_id', userId)
        .order('created_at', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (data) (store as any).setTeams?.(data);

    // Fetch Globals
    const globals = await PersistenceService.getGlobalVariables(userId);
    if (globals) (store as any).setGlobalVariables?.(globals);
  };

  // Setup Realtime subscriptions
  useEffect(() => {
    if (!store.activeWorkspaceId) return;

    const channelId = `sync-${store.activeWorkspaceId}-${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId);

    channel
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'requests'
      }, () => fetchCollections(store.activeWorkspaceId!))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'collections'
      }, () => fetchCollections(store.activeWorkspaceId!))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'folders'
      }, () => fetchCollections(store.activeWorkspaceId!))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'history',
        filter: `workspace_id=eq.${store.activeWorkspaceId}` 
      }, () => fetchHistory(store.activeWorkspaceId!))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'environments',
        filter: `workspace_id=eq.${store.activeWorkspaceId}` 
      }, () => fetchEnvironments(store.activeWorkspaceId!))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'workspaces'
      }, () => fetchWorkspaces(store.profile?.id || ''))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teams'
      }, () => fetchTeams(store.profile?.id || ''))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'saved_responses'
      }, () => {
        // Optionally refetch saved responses for active request
        const activeRequestId = store.openTabs.find(t => t.id === store.activeTabId)?.id;
        if (activeRequestId) fetchSavedResponses(activeRequestId);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_members'
      }, () => fetchTeams(store.profile?.id || ''))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collection_collaborators'
      }, () => fetchCollections(store.activeWorkspaceId!))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to channel: ${channelId}`);
        }
      });

    // Initial fetches
    fetchCollections(store.activeWorkspaceId);
    fetchEnvironments(store.activeWorkspaceId);
    fetchHistory(store.activeWorkspaceId);
    fetchUserTabs();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [store.activeWorkspaceId, (store.teams || []).length]);

  return {
    fetchWorkspaces,
    fetchCollections,
    fetchEnvironments,
    fetchHistory,
    fetchTeams
  };
};

import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { PersistenceService } from '../services/PersistenceService';
import { RequestUtils } from '../utils/RequestUtils';
import { useScriptStore } from '../store/scriptStore';

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
      } else if (!store.activeWorkspaceId) {
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
      
      const tryFetch = async (useCollaborators: boolean, useTeamId: boolean) => {
        let selectStr = `
          *,
          requests(*),
          folders(*)
        `;
        if (useCollaborators) {
          selectStr += ',\n          collection_collaborators(*)';
        }

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
      
      // Fallback 1: Missing collaborators relationship or team_id column
      if (result.error) {
        const msg = String(result.error.message || '').toLowerCase();
        const isCollaboratorError = msg.includes('collection_collaborators') || result.error.code === 'PGRST200';
        const isTeamIdError = msg.includes('team_id') || result.error.code === 'PGRST204' || result.error.code === '42703';

        if (isCollaboratorError && isTeamIdError) {
          result = await tryFetch(false, false);
        } else if (isCollaboratorError) {
          result = await tryFetch(false, true);
        } else if (isTeamIdError) {
          result = await tryFetch(true, false);
        }

        // Final standalone fallback
        if (result.error) {
          result = await tryFetch(false, false);
        }
      }

      let data = result.data;
      let error = result.error;

      // Ultimate Fallback: If PostgREST relationship query fails due to stale schema cache (e.g. PGRST200 / relationship mismatch)
      if (error && (error.code === 'PGRST200' || String(error.message || '').toLowerCase().includes('relationship'))) {
        console.warn('[Sync] PostgREST schema cache relationship mismatch detected. Switching to resilient parallel query mode...');
        
        let colsQuery = supabase.from('collections').select('*');
        if (teamIds.length > 0) {
          colsQuery = colsQuery.or(`workspace_id.eq.${workspaceId},team_id.in.(${teamIds.join(',')})`);
        } else {
          colsQuery = colsQuery.eq('workspace_id', workspaceId);
        }
        const { data: cols, error: colsErr } = await colsQuery.order('created_at', { ascending: false });
        
        if (colsErr) throw colsErr;

        if (cols && cols.length > 0) {
          const colIds = cols.map(c => c.id);
          
          const fetchCollabs = async () => {
            try {
              const { data: cData } = await supabase.from('collection_collaborators').select('*').in('collection_id', colIds);
              return { data: cData || [], error: null };
            } catch (e) {
              return { data: [], error: null };
            }
          };

          const [reqsRes, foldersRes, collabRes] = await Promise.all([
            supabase.from('requests').select('*').eq('workspace_id', workspaceId),
            supabase.from('folders').select('*').in('collection_id', colIds),
            fetchCollabs()
          ]);

          const reqs = reqsRes.data || [];
          const folders = foldersRes.data || [];
          const collabs = collabRes.data || [];

          data = cols.map(col => ({
            ...col,
            requests: reqs.filter((r: any) => r.collection_id === col.id),
            folders: folders.filter((f: any) => f.collection_id === col.id),
            collection_collaborators: collabs.filter((c: any) => c.collection_id === col.id)
          })) as any;
          error = null;
        } else {
          data = [];
          error = null;
        }
      }

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

  const fetchScripts = async (workspaceId: string) => {
    try {
      const loadedScripts = await PersistenceService.fetchScripts(workspaceId);
      useScriptStore.getState().setScripts(loadedScripts);
    } catch (e) {
      console.error('Failed to sync scripts:', e);
    }
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
        table: 'scripts',
        filter: `workspace_id=eq.${store.activeWorkspaceId}` 
      }, () => fetchScripts(store.activeWorkspaceId!))
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
    fetchScripts(store.activeWorkspaceId);
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

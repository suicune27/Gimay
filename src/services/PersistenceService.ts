import { supabase, globalSupabase } from '../lib/supabase';
import { RequestData, Collection, Environment, Workspace, Folder, Profile, KeyValue, ScriptExecutionLog } from '../types';
import { isElectron } from '../lib/platform';

export class PersistenceService {
  private static store: any = null;

  static registerStore(store: any) {
    this.store = store;
  }

  private static isOffline(): boolean {
    if (typeof window !== 'undefined' && !window.navigator.onLine) return true;
    return this.store?.getState()?.syncMetadata?.isOffline ?? false;
  }

  private static setOffline(offline: boolean) {
    if (this.store) {
      this.store.getState().updateSyncMetadata({ isOffline: offline });
      const { syncManager } = require('./SyncService');
      syncManager.setStatus(offline ? 'offline' : 'idle');
    }
  }

  private static async runResilientAction<T>(
    onlineAction: () => Promise<T>,
    offlineAction: () => T,
    enqueueAction: (offlineResult: T) => void
  ): Promise<T> {
    // If running in Desktop/Electron, we ALWAYS prioritize offline-first!
    // This executes mutations locally with 0ms latency to maximize speed and stability,
    // and registers syncing as a background, non-blocking queue action.
    if (isElectron() || this.isOffline()) {
      console.log('[PersistenceService] Offline-First Priority Active (Desktop/Local Mode). Execution local-first.');
      const result = offlineAction();
      try {
        enqueueAction(result);
      } catch (syncErr) {
        console.warn('[PersistenceService] Async sync enqueuing failed:', syncErr);
      }
      return result;
    }

    try {
      return await onlineAction();
    } catch (err: any) {
      const isNetworkError = err.message?.includes('Network Error') || 
        err.message?.includes('Failed to fetch') || 
        err.message?.includes('timeout') ||
        err.code === 'ECONNABORTED' ||
        err.status === 0;

      if (isNetworkError) {
        console.warn('[PersistenceService] Database write request timed out or was cut off. Transitioning to local cache buffer.');
        this.setOffline(true);
        const result = offlineAction();
        enqueueAction(result);
        return result;
      }
      throw err;
    }
  }

  // --- Workspace Actions ---
  static async createWorkspace(name: string, userId: string, teamId?: string) {
    return this.runResilientAction(
      () => this.createWorkspaceOnline(name, userId, teamId),
      () => {
        const mockWS: Workspace = {
          id: 'offline-' + Math.random().toString(36).substr(2, 9),
          name,
          user_id: userId,
          visibility: teamId ? 'team' : 'private',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as any;
        const state = this.store.getState();
        state.setWorkspaces([...state.workspaces, mockWS]);
        return mockWS;
      },
      (mockWS) => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('workspace', 'create', mockWS.id, { name, userId, teamId });
      }
    );
  }

  static async createWorkspaceOnline(name: string, userId: string, teamId?: string) {
    const payload: any = { 
      name, 
      user_id: userId, 
      visibility: teamId ? 'team' : 'private' 
    };

    if (teamId) {
      payload.team_id = teamId;
    }

    const client = teamId ? globalSupabase : supabase;

    let { data, error } = await client
      .from('workspaces')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      const fallbackPayload = { name, user_id: userId };
      const fallback = await client
        .from('workspaces')
        .insert([fallbackPayload])
        .select()
        .maybeSingle();
        
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data as Workspace;
  }

  static async updateWorkspace(id: string, updates: Partial<Workspace>) {
    return this.runResilientAction(
      () => this.updateWorkspaceOnline(id, updates),
      () => {
        const state = this.store.getState();
        state.setWorkspaces(state.workspaces.map((w: any) => w.id === id ? { ...w, ...updates } : w));
        return { id, ...updates } as Workspace;
      },
      () => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('workspace', 'update', id, updates);
      }
    );
  }

  static async updateWorkspaceOnline(id: string, updates: Partial<Workspace>) {
    const { data, error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Workspace;
  }

  static async deleteWorkspace(id: string) {
    return this.runResilientAction(
      () => this.deleteWorkspaceOnline(id),
      () => {
        const state = this.store.getState();
        state.setWorkspaces(state.workspaces.filter((w: any) => w.id !== id));
        return id;
      },
      () => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('workspace', 'delete', id, null);
      }
    );
  }

  static async deleteWorkspaceOnline(id: string) {
    const { error } = await supabase.from('workspaces').delete().eq('id', id);
    if (error) throw error;
  }

  // --- Collection Actions ---
  static async createCollection(workspaceId: string, userId: string, name: string = 'New Collection') {
    return this.runResilientAction(
      () => this.createCollectionOnline(workspaceId, userId, name),
      () => {
        const mockCollection: Collection = {
          id: 'offline-' + Math.random().toString(36).substr(2, 9),
          name,
          workspace_id: workspaceId,
          user_id: userId,
          folders: [],
          requests: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          visibility: 'private',
          permission: 'owner' as any,
          variables: [],
          auth: { type: 'inherit' }
        };
        const state = this.store.getState();
        state.setCollections([...state.collections, mockCollection]);
        return mockCollection;
      },
      (mockCollection) => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('collection', 'create', mockCollection.id, mockCollection);
      }
    );
  }

  static async createCollectionOnline(workspaceId: string, userId: string, name: string) {
    const { data: collection, error } = await supabase
      .from('collections')
      .insert([{ name, workspace_id: workspaceId, user_id: userId }])
      .select()
      .maybeSingle();

    if (error) throw error;
    return collection as Collection;
  }

  static async updateCollection(id: string, updates: Partial<Collection>) {
    return this.runResilientAction(
      () => this.updateCollectionOnline(id, updates),
      () => {
        const state = this.store.getState();
        state.setCollections(state.collections.map((c: any) => c.id === id ? { ...c, ...updates } : c));
        return { id, ...updates } as Collection;
      },
      () => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('collection', 'update', id, updates);
      }
    );
  }

  static async updateCollectionOnline(id: string, updates: Partial<Collection>) {
    let { data, error } = await supabase
      .from('collections')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
      const sanitizedUpdates = { ...updates } as any;
      const problematicColumns = [
        'team_id', 'visibility', 'permission', 'pre_request_script', 
        'test_script', 'workspace_id', 'updated_at', 'variables', 'auth', 'documentation'
      ];
      problematicColumns.forEach(col => {
        delete sanitizedUpdates[col];
      });

      const fallback = await supabase
        .from('collections')
        .update(sanitizedUpdates)
        .eq('id', id)
        .select()
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data as Collection;
  }

  static async deleteCollection(id: string) {
    return this.runResilientAction(
      () => this.deleteCollectionOnline(id),
      () => {
        const state = this.store.getState();
        state.setCollections(state.collections.filter((c: any) => c.id !== id));
        return id;
      },
      () => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('collection', 'delete', id, null);
      }
    );
  }

  static async deleteCollectionOnline(id: string) {
    const { error } = await supabase.from('collections').delete().eq('id', id);
    if (error) throw error;
  }

  static async duplicateCollection(collectionId: string, userId: string, workspaceId: string) {
    if (this.isOffline()) {
      const state = this.store.getState();
      const original = state.collections.find((c: any) => c.id === collectionId);
      if (!original) throw new Error('Original collection not found offline.');
      
      const newCol = await this.createCollection(workspaceId, userId, `${original.name} (Copy)`);
      
      const duplicateFolder = async (oldFolder: any, parentId?: string) => {
        const nf = await this.createFolder(oldFolder.name, newCol.id, userId, parentId, workspaceId);
        const children = (original.folders || []).filter((f: any) => f.parent_id === oldFolder.id);
        for (const child of children) {
          await duplicateFolder(child, nf.id);
        }
        
        const requests = (oldFolder.requests || []);
        for (const r of requests) {
          await this.createRequest({
            ...r,
            name: r.name,
            collection_id: newCol.id,
            folder_id: nf.id,
            workspace_id: workspaceId,
            user_id: userId
          });
        }
      };

      const rootFolders = (original.folders || []).filter((f: any) => !f.parent_id);
      for (const f of rootFolders) {
        await duplicateFolder(f);
      }

      const rootRequests = (original.requests || []);
      for (const r of rootRequests) {
        await this.createRequest({
          ...r,
          name: r.name,
          collection_id: newCol.id,
          folder_id: null as any,
          workspace_id: workspaceId,
          user_id: userId
        });
      }
      return newCol;
    }

    // Online duplication flow
    const { data: collection, error: colError } = await supabase
      .from('collections')
      .select('*, folders(*), requests(*)')
      .eq('id', collectionId)
      .single();

    if (colError || !collection) throw colError || new Error('Collection lookup failed.');

    const newCol = await this.createCollection(workspaceId, userId, `${collection.name} (Copy)`);
    const folderMap: Record<string, string> = {};
    const folders = collection.folders || [];

    const duplicateFolder = async (oldFolder: any, parentId?: string) => {
      const { id: oldId, created_at, updated_at, ...folderData } = oldFolder;
      const nf = await this.createFolder(
        folderData.name,
        newCol.id,
        userId,
        parentId,
        workspaceId
      );
      folderMap[oldId] = nf.id;

      const children = folders.filter((f: any) => f.parent_id === oldId);
      for (const child of children) {
        await duplicateFolder(child, nf.id);
      }
    };

    for (const f of folders.filter((f: any) => !f.parent_id)) {
      await duplicateFolder(f);
    }

    const requests = collection.requests || [];
    for (const r of requests) {
      const { id, created_at, updated_at, ...requestData } = r;
      const newFolderId = requestData.folder_id ? folderMap[requestData.folder_id] : undefined;
      
      await this.createRequest({
        ...requestData,
        name: requestData.name,
        collection_id: newCol.id,
        folder_id: newFolderId,
        workspace_id: workspaceId,
        user_id: userId,
        bodyType: requestData.body_type
      });
    }

    return newCol;
  }

  // --- Folder Actions ---
  static async createFolder(name: string, collectionId: string, userId: string, parentId?: string, workspaceId?: string) {
    return this.runResilientAction(
      () => this.createFolderOnline(name, collectionId, userId, parentId, workspaceId),
      () => {
        const mockFolder: Folder = {
          id: 'offline-' + Math.random().toString(36).substr(2, 9),
          name,
          collection_id: collectionId,
          user_id: userId,
          parent_id: parentId || null,
          auth: { type: 'inherit' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } as any;
        const state = this.store.getState();
        const newCollections = state.collections.map((c: any) => {
          if (c.id !== collectionId) return c;
          return { ...c, folders: [...(c.folders || []), mockFolder] };
        });
        state.setCollections(newCollections);
        return mockFolder;
      },
      (mockFolder) => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('folder', 'create', mockFolder.id, mockFolder);
      }
    );
  }

  static async createFolderOnline(name: string, collectionId: string, userId: string, parentId?: string, workspaceId?: string) {
    const payload: any = { 
      name, 
      collection_id: collectionId, 
      user_id: userId, 
      parent_id: parentId, 
      auth: { type: 'inherit' } 
    };

    if (workspaceId) {
      payload.workspace_id = workspaceId;
    }

    let { data, error } = await supabase
      .from('folders')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
      delete payload.workspace_id;
      const fallback = await supabase
        .from('folders')
        .insert([payload])
        .select()
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data as Folder;
  }

  static async updateFolder(id: string, updates: Partial<Folder>) {
    return this.runResilientAction(
      () => this.updateFolderOnline(id, updates),
      () => {
        const state = this.store.getState();
        const updateFolderInTree = (folders: any[]): any[] => {
          return folders.map(f => {
            if (f.id === id) return { ...f, ...updates };
            if (f.folders) return { ...f, folders: updateFolderInTree(f.folders) };
            return f;
          });
        };
        const newCollections = state.collections.map((c: any) => ({
          ...c,
          folders: c.folders ? updateFolderInTree(c.folders) : []
        }));
        state.setCollections(newCollections);
        return { id, ...updates } as Folder;
      },
      () => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('folder', 'update', id, updates);
      }
    );
  }

  static async updateFolderOnline(id: string, updates: Partial<Folder>) {
    let { data, error } = await supabase
      .from('folders')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
      const sanitizedUpdates = { ...updates } as any;
      delete sanitizedUpdates.workspace_id;
      delete sanitizedUpdates.user_id;

      const fallback = await supabase
        .from('folders')
        .update(sanitizedUpdates)
        .eq('id', id)
        .select()
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data as Folder;
  }

  static async deleteFolder(id: string) {
    return this.runResilientAction(
      () => this.deleteFolderOnline(id),
      () => {
        const state = this.store.getState();
        const deleteFolderInTree = (folders: any[]): any[] => {
          return folders.filter(f => f.id !== id).map(f => {
            if (f.folders) return { ...f, folders: deleteFolderInTree(f.folders) };
            return f;
          });
        };
        const newCollections = state.collections.map((c: any) => ({
          ...c,
          folders: c.folders ? deleteFolderInTree(c.folders) : []
        }));
        state.setCollections(newCollections);
        return id;
      },
      () => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('folder', 'delete', id, null);
      }
    );
  }

  static async deleteFolderOnline(id: string) {
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (error) throw error;
  }

  static async duplicateFolder(folderId: string, collectionId: string, userId: string, parentId?: string, workspaceId?: string) {
    if (this.isOffline()) {
      const state = this.store.getState();
      const findFolder = (folders: any[]): any => {
        for (const f of folders) {
          if (f.id === folderId) return f;
          if (f.folders) {
            const found = findFolder(f.folders);
            if (found) return found;
          }
        }
        return null;
      };
      
      let folder: any = null;
      for (const c of state.collections) {
        folder = findFolder(c.folders || []);
        if (folder) break;
      }
      if (!folder) throw new Error('Folder lookup failed offline.');

      const duplicated = await this.createFolder(`${folder.name} (Copy)`, collectionId, userId, parentId, workspaceId);

      const subfolders = folder.folders || [];
      for (const sub of subfolders) {
        await this.duplicateFolder(sub.id, collectionId, userId, duplicated.id, workspaceId);
      }

      const requests = folder.requests || [];
      for (const r of requests) {
        await this.createRequest({
          ...r,
          name: r.name,
          collection_id: collectionId,
          folder_id: duplicated.id,
          workspace_id: workspaceId || r.workspace_id,
          user_id: userId
        });
      }
      return duplicated;
    }

    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .single();
    if (folderError || !folder) throw folderError || new Error('Folder lookup failed.');

    const duplicated = await this.createFolder(`${folder.name} (Copy)`, collectionId, userId, parentId, workspaceId);

    const { data: subfolders } = await supabase
      .from('folders')
      .select('*')
      .eq('parent_id', folderId);
    
    if (subfolders) {
      for (const sub of subfolders) {
        await this.duplicateFolder(sub.id, collectionId, userId, duplicated.id, workspaceId);
      }
    }

    const { data: requests } = await supabase
      .from('requests')
      .select('*')
      .eq('folder_id', folderId);

    if (requests) {
      for (const r of requests) {
        const { id, created_at, updated_at, ...requestData } = r;
        await this.createRequest({
          ...requestData,
          name: requestData.name,
          collection_id: collectionId,
          folder_id: duplicated.id,
          workspace_id: workspaceId || r.workspace_id,
          user_id: userId,
          bodyType: requestData.body_type
        });
      }
    }
    return duplicated;
  }

  // --- Team Actions ---
  static async createTeam(name: string, ownerId: string) {
    if (this.isOffline()) {
      const mockTeam = {
        id: 'offline-' + Math.random().toString(36).substr(2, 9),
        name,
        created_at: new Date().toISOString()
      };
      const state = this.store.getState();
      state.setTeams([...state.teams, mockTeam]);
      return mockTeam;
    }

    console.group(`[PersistenceService] createTeam("${name}")`);
    const normalizedName = name.trim();
    if (!normalizedName) {
      console.groupEnd();
      throw new Error('Team name is required.');
    }

    const { data: existingTeam, error: checkError } = await globalSupabase
      .from('teams')
      .select('id, name')
      .ilike('name', normalizedName)
      .limit(1);

    if (checkError) {
      console.groupEnd();
      throw checkError;
    }

    if (existingTeam && existingTeam.length > 0) {
      console.groupEnd();
      throw new Error('A team with this name already exists.');
    }

    const { data: team, error: teamError } = await globalSupabase
      .from('teams')
      .insert([{ name: normalizedName }])
      .select()
      .single();

    if (teamError) {
      console.groupEnd();
      throw teamError;
    }

    const { error: memberError } = await globalSupabase
      .from('team_members')
      .insert([{ team_id: team.id, user_id: ownerId, role: 'admin' }]);

    if (memberError) {
      await globalSupabase.from('teams').delete().eq('id', team.id);
      console.groupEnd();
      throw memberError;
    }

    try {
      await this.createWorkspace('General', ownerId, team.id);
    } catch (wsError) {
      console.error('Default workspace creation failed (non-blocking for team):', wsError);
    }

    console.groupEnd();
    return team;
  }

  static async addTeamMember(teamId: string, userEmail: string, role: 'viewer' | 'editor' | 'admin' = 'viewer') {
    if (this.isOffline()) return;

    const identifier = userEmail.trim();
    const { data: profile, error: profileError } = await globalSupabase
      .from('profiles')
      .select('id, email, username, full_name')
      .or(`email.eq.${identifier},username.eq.${identifier},full_name.eq.${identifier}`)
      .limit(1)
      .maybeSingle();

    if (profileError || !profile) throw new Error('User not found in system.');

    let dbRole = role;
    if (role === 'viewer' || role === 'editor') {
      dbRole = 'member' as any;
    }

    const { error } = await globalSupabase
      .from('team_members')
      .insert([{ team_id: teamId, user_id: profile.id, role: dbRole }]);

    if (error) {
      if (String(error.message || '').toLowerCase().includes('role')) {
        const { error: fallbackError } = await globalSupabase
          .from('team_members')
          .insert([{ team_id: teamId, user_id: profile.id }]);
        if (fallbackError) throw fallbackError;
      } else {
        throw error;
      }
    }
  }

  static async updateTeamMemberRole(teamId: string, userId: string, role: 'viewer' | 'editor' | 'admin') {
    if (this.isOffline()) return;
    const { error } = await globalSupabase
      .from('team_members')
      .update({ role })
      .match({ team_id: teamId, user_id: userId });

    if (error) throw error;
  }

  static async removeTeamMember(teamId: string, userId: string) {
    if (this.isOffline()) return;
    const { error } = await globalSupabase
      .from('team_members')
      .delete()
      .match({ team_id: teamId, user_id: userId });

    if (error) throw error;
  }

  // --- Request Actions ---
  static async saveRequest(request: RequestData) {
    if (request.id.startsWith('temp-') || request.id.startsWith('history-')) return;
    return this.updateRequest(request.id, request);
  }

  static async saveRequestOnline(request: RequestData) {
    const bodyToSave = typeof request.body === 'object' 
      ? JSON.stringify(request.body) 
      : request.body;

    const updates = {
      name: request.name,
      method: request.method,
      url: request.url,
      headers: request.headers,
      params: request.params,
      body: bodyToSave,
      body_type: request.bodyType || (request as any).body_type,
      auth: request.auth,
      pre_request_script: request.pre_request_script,
      test_script: request.test_script,
      settings: request.settings,
      workspace_id: request.workspace_id,
      collection_id: request.collection_id,
      folder_id: request.folder_id
    };

    let { error } = await supabase
      .from('requests')
      .update(updates)
      .eq('id', request.id);

    if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
      const safeUpdates = { ...updates } as any;
      const problematicColumns = [
        'pre_request_script', 'test_script', 'settings', 'type', 
        'auth', 'workspace_id', 'body_type', 'updated_at', 'is_deleted'
      ];
      problematicColumns.forEach(col => {
        delete safeUpdates[col];
      });

      const fallback = await supabase
        .from('requests')
        .update(safeUpdates)
        .eq('id', request.id);
      error = fallback.error;
    }

    if (error) throw error;
  }

  static async createRequest(data: Partial<RequestData>) {
    return this.runResilientAction(
      () => this.createRequestOnline(data),
      () => {
        const mockRequest: RequestData = {
          id: 'offline-' + Math.random().toString(36).substr(2, 9),
          name: data.name || 'New Request',
          method: (data.method as any) || 'GET',
          url: data.url || 'https://api.example.com',
          headers: data.headers || [],
          params: data.params || [],
          body: data.body || '',
          bodyType: data.bodyType || 'none',
          auth: data.auth || { type: 'inherit' },
          collection_id: data.collection_id!,
          folder_id: data.folder_id || null,
          workspace_id: data.workspace_id!,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: data.user_id || '',
          type: 'rest'
        };
        const state = this.store.getState();
        state.addRequest(mockRequest);
        return mockRequest;
      },
      (mockRequest) => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('request', 'create', mockRequest.id, mockRequest);
      }
    );
  }

  static async createRequestOnline(data: Partial<RequestData>) {
    const bodyToSave = typeof data.body === 'object' 
      ? JSON.stringify(data.body) 
      : data.body;

    const mappedData = {
      ...data,
      body: bodyToSave,
      body_type: data.bodyType,
    };
    delete (mappedData as any).bodyType;

    let { data: request, error } = await supabase
      .from('requests')
      .insert([mappedData])
      .select()
      .single();

    if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
      const safeData = { ...mappedData } as any;
      const problematicColumns = [
        'pre_request_script', 'test_script', 'settings', 'type', 
        'auth', 'workspace_id', 'body_type', 'updated_at', 'is_deleted'
      ];
      problematicColumns.forEach(col => delete safeData[col]);

      const fallback = await supabase
        .from('requests')
        .insert([safeData])
        .select()
        .single();
      request = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return {
      ...request,
      bodyType: request.body_type,
      body: request.body
    } as RequestData;
  }

  static async updateRequest(id: string, updates: Partial<RequestData>) {
    return this.runResilientAction(
      () => this.updateRequestOnline(id, updates),
      () => {
        const state = this.store.getState();
        state.updateRequest(id, updates);
        return { id, ...updates } as RequestData;
      },
      () => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('request', 'update', id, updates);
      }
    );
  }

  static async updateRequestOnline(id: string, updates: Partial<RequestData>) {
    const dbUpdates = { ...updates } as any;
    
    if (dbUpdates.bodyType) {
      dbUpdates.body_type = dbUpdates.bodyType;
      delete dbUpdates.bodyType;
    }

    if (dbUpdates.body && typeof dbUpdates.body === 'object') {
      dbUpdates.body = JSON.stringify(dbUpdates.body);
    }

    let { data, error } = await supabase
      .from('requests')
      .update({ ...dbUpdates })
      .eq('id', id)
      .select()
      .single();

    if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
      const safeUpdates = { ...dbUpdates };
      const problematicColumns = [
        'pre_request_script', 'test_script', 'settings', 'type', 
        'auth', 'workspace_id', 'body_type', 'updated_at', 'is_deleted'
      ];
      problematicColumns.forEach(col => delete safeUpdates[col]);

      const fallback = await supabase
        .from('requests')
        .update(safeUpdates)
        .eq('id', id)
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return {
      ...data,
      bodyType: data.body_type,
      body: data.body
    } as RequestData;
  }

  static async deleteRequest(id: string) {
    return this.runResilientAction(
      () => this.deleteRequestOnline(id),
      () => {
        const state = this.store.getState();
        state.deleteRequestState(id);
        return id;
      },
      () => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('request', 'delete', id, null);
      }
    );
  }

  static async deleteRequestOnline(id: string) {
    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async duplicateRequest(originalId: string, overrides: Partial<RequestData> = {}) {
    if (this.isOffline()) {
      const state = this.store.getState();
      
      const findReq = (nodes: any[]): RequestData | null => {
        for (const n of nodes) {
          if (n.id === originalId) return n;
          if (n.folders) {
            const found = findReq(n.folders);
            if (found) return found;
          }
          if (n.requests) {
            const found = n.requests.find((r: any) => r.id === originalId);
            if (found) return found;
          }
        }
        return null;
      };

      const original = findReq(state.collections);
      if (!original) throw new Error('Original request not found offline.');

      const newRequest = await this.createRequest({
        ...original,
        name: `${original.name} (Copy)`,
        ...overrides
      });
      return newRequest;
    }

    const { data: original, error: fetchError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', originalId)
      .single();

    if (fetchError || !original) throw new Error('Original request not found.');

    const { id, created_at, updated_at, ...cloneData } = original;
    const newRequest = {
      ...cloneData,
      name: `${cloneData.name} (Copy)`,
      ...overrides
    };

    const { data: inserted, error: insertError } = await supabase
      .from('requests')
      .insert([newRequest])
      .select()
      .single();

    if (insertError) throw insertError;

    return {
      ...inserted,
      bodyType: inserted.body_type,
      body: inserted.body
    } as RequestData;
  }

  static async saveHistory(entry: any) {
    if (this.isOffline()) {
      const state = this.store.getState();
      state.setHistory([entry, ...state.history].slice(0, 100));
      return;
    }

    let { error } = await supabase
      .from('history')
      .insert([entry]);
      
    if (error && String(error.message || '').toLowerCase().includes('column')) {
      const safeEntry = { ...entry };
      delete safeEntry.workspace_id;
      delete safeEntry.request_name;
      delete safeEntry.request_data;
      delete safeEntry.time;
      delete safeEntry.size;
      
      const fallback = await supabase.from('history').insert([safeEntry]);
      error = fallback.error;
    }

    if (error) console.error('History Save Error:', error.message);
  }

  static async deleteHistory(id: string) {
    if (this.isOffline()) {
      const state = this.store.getState();
      state.setHistory(state.history.filter((h: any) => h.id !== id));
      return;
    }
    const { error } = await supabase.from('history').delete().eq('id', id);
    if (error) throw error;
  }

  static async clearHistory(workspaceId: string, userId: string) {
    if (this.isOffline()) {
      const state = this.store.getState();
      state.setHistory([]);
      return;
    }
    const { error } = await supabase
      .from('history')
      .delete()
      .match({ workspace_id: workspaceId, user_id: userId });
    if (error) throw error;
  }

  // --- Environment Actions ---
  static async createEnvironment(workspaceId: string, userId: string, name: string, variables: KeyValue[] = [], isGlobal: boolean = false, preRequestScript = '', testScript = '', documentation = '') {
    return this.runResilientAction(
      () => this.createEnvironmentOnline(workspaceId, userId, name, variables, isGlobal, preRequestScript, testScript, documentation),
      () => {
        const mockEnv: Environment = {
          id: 'offline-' + Math.random().toString(36).substr(2, 9),
          workspace_id: workspaceId,
          user_id: userId,
          name,
          variables,
          is_global: isGlobal,
          pre_request_script: preRequestScript || '',
          test_script: testScript || '',
          documentation: documentation || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const state = this.store.getState();
        state.setEnvironments([...state.environments, mockEnv]);
        return mockEnv;
      },
      (mockEnv) => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('environment', 'create', mockEnv.id, mockEnv);
      }
    );
  }

  static async createEnvironmentOnline(workspaceId: string, userId: string, name: string, variables: KeyValue[] = [], isGlobal: boolean = false, preRequestScript = '', testScript = '', documentation = '') {
    let insertData: any = {
      name,
      workspace_id: workspaceId,
      user_id: userId,
      variables,
      is_global: isGlobal,
      pre_request_script: preRequestScript,
      test_script: testScript,
      documentation
    };

    let { data, error } = await supabase
      .from('environments')
      .insert([insertData])
      .select()
      .single();

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      delete insertData.pre_request_script;
      delete insertData.test_script;
      delete insertData.documentation;
      delete insertData.is_global;

      const fallback = await supabase
        .from('environments')
        .insert([insertData])
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data as Environment;
  }

  static async updateEnvironment(id: string, updates: Partial<Environment>) {
    return this.runResilientAction(
      () => this.updateEnvironmentOnline(id, updates),
      () => {
        const state = this.store.getState();
        state.setEnvironments(state.environments.map((e: any) => e.id === id ? { ...e, ...updates } : e));
        return { id, ...updates } as Environment;
      },
      () => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('environment', 'update', id, updates);
      }
    );
  }

  static async updateEnvironmentOnline(id: string, updates: Partial<Environment>) {
    let { data, error } = await supabase
      .from('environments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      const sanitizedUpdates = { ...updates } as any;
      delete sanitizedUpdates.pre_request_script;
      delete sanitizedUpdates.test_script;
      delete sanitizedUpdates.documentation;

      const fallback = await supabase
        .from('environments')
        .update(sanitizedUpdates)
        .eq('id', id)
        .select()
        .single();

      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data as Environment;
  }

  static async deleteEnvironment(id: string) {
    return this.runResilientAction(
      () => this.deleteEnvironmentOnline(id),
      () => {
        const state = this.store.getState();
        state.setEnvironments(state.environments.filter((e: any) => e.id !== id));
        return id;
      },
      () => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('environment', 'delete', id, null);
      }
    );
  }

  static async deleteEnvironmentOnline(id: string) {
    const { error } = await supabase.from('environments').delete().eq('id', id);
    if (error) throw error;
  }

  static async updateProfilePreferences(userId: string, preferences: Profile['preferences']) {
    return this.runResilientAction(
      () => this.updateProfileOnline(userId, { preferences }),
      () => {
        const state = this.store.getState();
        if (state.profile) {
          state.setProfile({ ...state.profile, preferences });
        }
        return { preferences };
      },
      () => {
        const { syncManager } = require('./SyncService');
        syncManager.enqueueAction('profile', 'update', userId, { preferences });
      }
    );
  }

  static async updateProfileOnline(id: string, updates: Partial<Profile> | any) {
    let { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      const safeUpdates = { ...updates };
      delete safeUpdates.preferences;
      delete safeUpdates.updated_at;

      const fallback = await supabase
        .from('profiles')
        .update(safeUpdates)
        .eq('id', id)
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data as Profile;
  }

  // --- Saved Responses Resiliency ---
  static async createSavedResponse(requestId: string, userId: string, response: any) {
    if (this.isOffline()) return null;
    try {
      const { data, error } = await supabase
        .from('saved_responses')
        .insert([{
          request_id: requestId,
          user_id: userId,
          name: response.name || 'New Response',
          status: response.status,
          body: response.body,
          headers: response.headers
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  }

  static async getSavedResponses(requestId: string) {
    if (this.isOffline()) return [];
    try {
      const { data, error } = await supabase
        .from('saved_responses')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });
  
      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    }
  }

  static async deleteSavedResponse(id: string) {
    if (this.isOffline()) return;
    try {
      const { error } = await supabase.from('saved_responses').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {}
  }

  // --- Collaborator Resiliency ---
  static async inviteCollectionCollaborator(collectionId: string, identifier: string, role: 'viewer' | 'editor' | 'admin', invitedBy: string) {
    if (this.isOffline()) throw new Error('Collaborator operations require a network connection.');
    const query = identifier.trim();
    const { data: profile, error: profileError } = await globalSupabase
      .from('profiles')
      .select('id, email, username, full_name')
      .or(`email.eq.${query},username.eq.${query},full_name.eq.${query}`)
      .limit(1)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error('No registered user found for that email or username.');
    }

    const { data, error } = await supabase
      .from('collection_collaborators')
      .upsert({
        collection_id: collectionId,
        user_id: profile.id,
        invited_by: invitedBy,
        role,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'collection_id,user_id' })
      .select('*, profiles(email, full_name, username)')
      .single();

    if (error) throw error;
    return data;
  }

  static async updateCollectionCollaboratorRole(collectionId: string, userId: string, role: 'viewer' | 'editor' | 'admin') {
    if (this.isOffline()) throw new Error('Collaborator operations require a network connection.');
    const { data, error } = await supabase
      .from('collection_collaborators')
      .update({ role, updated_at: new Date().toISOString() })
      .match({ collection_id: collectionId, user_id: userId })
      .select('*, profiles(email, full_name, username)')
      .single();

    if (error) throw error;
    return data;
  }

  static async removeCollectionCollaborator(collectionId: string, userId: string) {
    if (this.isOffline()) throw new Error('Collaborator operations require a network connection.');
    const { error } = await supabase
      .from('collection_collaborators')
      .delete()
      .match({ collection_id: collectionId, user_id: userId });

    if (error) throw error;
  }

  // --- User Tabs Resiliency ---
  static async syncUserTabs(userId: string, tabs: any[], activeTabId: string | null) {
    if (this.isOffline()) return null;
    try {
      const { data, error } = await supabase
        .from('user_tabs')
        .upsert({
          user_id: userId,
          tabs,
          active_tab_id: activeTabId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  }

  static async getUserTabs(userId: string) {
    if (this.isOffline()) {
      return { tabs: this.store?.getState()?.openTabs || [], active_tab_id: this.store?.getState()?.activeTabId || null };
    }
    try {
      const { data, error } = await supabase
        .from('user_tabs')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  }

  // --- Workspace & Teams Resiliency ---
  static async fetchUserTeams(userId: string) {
    if (this.isOffline()) return this.store?.getState()?.teams || [];
    try {
      let { data, error } = await globalSupabase
        .from('teams')
        .select('*, team_members!inner(*, profiles(email, full_name, username))')
        .eq('team_members.user_id', userId)
        .order('created_at', { ascending: false });

      if (error && String(error.message || '').match(/profiles|relation|schema cache/i)) {
        const fallback = await globalSupabase
          .from('teams')
          .select('*, team_members!inner(*)')
          .eq('team_members.user_id', userId)
          .order('created_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      return data || [];
    } catch (e) {
      return this.store?.getState()?.teams || [];
    }
  }

  static async fetchWorkspacesByTeam(teamId: string) {
    if (this.isOffline()) return [];
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId || '');
      if (!isUuid) return [];

      let { data, error } = await globalSupabase
        .from('workspaces')
        .select('*')
        .eq('team_id', teamId);
      
      if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
        return [];
      }

      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    }
  }

  // --- Global Variables Resiliency ---
  static async saveGlobalVariables(userId: string, variables: KeyValue[]) {
    if (this.isOffline()) return;
    try {
      const { error } = await supabase
        .from('global_variables')
        .upsert({ user_id: userId, variables, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
    } catch (e) {}
  }

  static async getGlobalVariables(userId: string) {
    if (this.isOffline()) return this.store?.getState()?.globalVariables || [];
    try {
      const { data, error } = await supabase
        .from('global_variables')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.variables || [];
    } catch (e) {
      return this.store?.getState()?.globalVariables || [];
    }
  }

  // --- Script Logs Resiliency ---
  static async createScriptLog(log: Partial<ScriptExecutionLog>) {
    if (this.isOffline()) return null;
    try {
      const { data, error } = await supabase
        .from('script_execution_logs')
        .insert([log])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  }

  static async fetchScripts(workspaceId: string) {
    if (this.isOffline()) return [];
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId || '');
      if (!isUuid) return [];
      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    }
  }

  static async fetchScriptFolders(workspaceId: string) {
    if (this.isOffline()) return [];
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspaceId || '');
      if (!isUuid) return [];
      let { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('workspace_id', workspaceId)
        .is('parent_id', null);

      if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
        const fallback = await supabase
          .from('folders')
          .select('*')
          .is('parent_id', null);
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      return data || [];
    } catch (e) {
      return [];
    }
  }

  static async createScript(data: any) {
    if (this.isOffline()) {
      const mockScript = {
        id: 'offline-' + Math.random().toString(36).substr(2, 9),
        ...data,
        created_at: new Date().toISOString()
      };
      return mockScript;
    }
    const { data: script, error } = await supabase
      .from('scripts')
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return script;
  }

  static async updateScript(id: string, updates: any) {
    if (this.isOffline()) {
      return { id, ...updates };
    }
    const { data, error } = await supabase
      .from('scripts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async deleteScript(id: string) {
    if (this.isOffline()) return;
    const { error } = await supabase.from('scripts').delete().eq('id', id);
    if (error) throw error;
  }
}

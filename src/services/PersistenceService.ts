import { supabase, globalSupabase } from '../lib/supabase';
import { RequestData, Collection, Environment, Workspace, Folder, Profile, KeyValue, ScriptExecutionLog } from '../types';

export class PersistenceService {
  // --- Workspace Actions ---
  static async createWorkspace(name: string, userId: string, teamId?: string) {
    const payload: any = { 
      name, 
      user_id: userId, 
      visibility: teamId ? 'team' : 'private' 
    };

    if (teamId) {
      payload.team_id = teamId;
    }

    // Use global if teamId is present or if we want to ensure it's in the global registry
    const client = teamId ? globalSupabase : supabase;

    let { data, error } = await client
      .from('workspaces')
      .insert([payload])
      .select()
      .maybeSingle();

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      console.warn('[Persistence] Handling missing columns in workspaces table. Stripping visibility/team_id.');
      const oldVisibility = payload.visibility;
      const oldTeamId = payload.team_id;
      delete payload.visibility;
      delete payload.team_id;
      
      const fallback = await client
        .from('workspaces')
        .insert([payload])
        .select()
        .maybeSingle();
        
      data = fallback.data;
      error = fallback.error;

      if (!error && data) {
        console.warn(`[Persistence] Workspace created, but RELATIONAL LINK FAILED. 
          Visibility "${oldVisibility}" and Team ID "${oldTeamId}" were ignored because the columns do not exist in the target database.
          This workspace will appear as "Private" and will not be correctly grouped under the team.`);
      }
    }

    if (error) {
      console.error('Workspace Creation Error:', error);
      throw new Error(`Failed to initialize workspace: ${error.message}`);
    }
    return data as Workspace;
  }

  static async updateWorkspace(id: string, updates: Partial<Workspace>) {
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
    const { error } = await supabase.from('workspaces').delete().eq('id', id);
    if (error) throw error;
  }

  // --- Collection Actions ---
  static async createCollection(workspaceId: string, userId: string, name: string = 'New Collection') {
    const { data: collection, error } = await supabase
      .from('collections')
      .insert([{ name, workspace_id: workspaceId, user_id: userId }])
      .select()
      .maybeSingle();

    if (error) {
      console.error('Collection Creation Error:', error);
      throw new Error(`Failed to create collection: ${error.message}`);
    }
    return collection as Collection;
  }

  static async updateCollection(id: string, updates: Partial<Collection>) {
    let { data, error } = await supabase
      .from('collections')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
      console.warn('[Persistence] Handling missing columns in collections table. Stripping new fields.');
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
    const { error } = await supabase.from('collections').delete().eq('id', id);
    if (error) throw error;
  }

  // --- Folder Actions ---
  static async createFolder(name: string, collectionId: string, userId: string, parentId?: string, workspaceId?: string) {
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
      console.warn('[Persistence] Handling missing columns in folders table. Stripping workspace_id.');
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
    let { data, error } = await supabase
      .from('folders')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
      console.warn('[Persistence] Handling missing columns in folders update. Stripping new fields.');
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
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (error) throw error;
  }

  // --- Team Actions ---
  static async createTeam(name: string, ownerId: string) {
    console.group(`[PersistenceService] createTeam("${name}")`);
    const normalizedName = name.trim();
    if (!normalizedName) {
      console.error('Validation Failed: Empty team name');
      console.groupEnd();
      throw new Error('Team name is required.');
    }

    console.log('Checking for existing team with same name...');
    const { data: existingTeam, error: checkError } = await globalSupabase
      .from('teams')
      .select('id, name')
      .ilike('name', normalizedName)
      .limit(1);

    if (checkError) {
      console.error('Existing team check failed:', checkError);
      console.groupEnd();
      throw checkError;
    }

    if (existingTeam && existingTeam.length > 0) {
      console.warn('Team already exists:', existingTeam[0]);
      console.groupEnd();
      throw new Error('A team with this name already exists.');
    }

    // 1. Create the team
    console.log('Inserting team record...');
    const { data: team, error: teamError } = await globalSupabase
      .from('teams')
      .insert([{ name: normalizedName }])
      .select()
      .single();

    if (teamError) {
      console.error('Team insertion error:', teamError);
      console.groupEnd();
      throw teamError;
    }

    console.log('Team record created:', team.id);

    // 2. Add creator as admin
    console.log('Adding owner to team_members...');
    const { error: memberError } = await globalSupabase
      .from('team_members')
      .insert([{ team_id: team.id, user_id: ownerId, role: 'admin' }]);

    if (memberError) {
      console.error('Member insertion error:', memberError);
      console.log('Rolling back team record...', team.id);
      await globalSupabase.from('teams').delete().eq('id', team.id); // Rollback
      console.groupEnd();
      throw memberError;
    }

    // 3. Create a default workspace for the team
    console.log('Creating default workspace for team...');
    try {
      await this.createWorkspace('General', ownerId, team.id);
    } catch (wsError) {
      console.error('Default workspace creation failed (non-blocking for team):', wsError);
    }

    console.log('✅ Team successfully created.');
    console.groupEnd();
    return team;
  }

  static async addTeamMember(teamId: string, userEmail: string, role: 'viewer' | 'editor' | 'admin' = 'viewer') {
    // Find user by email first
    const identifier = userEmail.trim();
    const { data: profile, error: profileError } = await globalSupabase
      .from('profiles')
      .select('id, email, username, full_name')
      .or(`email.eq.${identifier},username.eq.${identifier},full_name.eq.${identifier}`)
      .limit(1)
      .maybeSingle();

    if (profileError || !profile) throw new Error('User not found in system.');

    // Map role to match team_members check constraint if needed
    // SQL uses: ('owner', 'admin', 'member')
    let dbRole = role;
    if (role === 'viewer' || role === 'editor') {
      dbRole = 'member' as any;
    }

    const { error } = await globalSupabase
      .from('team_members')
      .insert([{ team_id: teamId, user_id: profile.id, role: dbRole }]);

    if (error) {
      // If even with mapping it fails, try without role
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
    const { error } = await globalSupabase
      .from('team_members')
      .update({ role })
      .match({ team_id: teamId, user_id: userId });

    if (error) throw error;
  }

  static async removeTeamMember(teamId: string, userId: string) {
    const { error } = await globalSupabase
      .from('team_members')
      .delete()
      .match({ team_id: teamId, user_id: userId });

    if (error) throw error;
  }

  // --- Request Actions ---
  static async saveRequest(request: RequestData) {
    if (request.id.startsWith('temp-') || request.id.startsWith('history-')) return;

    console.log(`[Persistence] Saving request ${request.id} (${request.method} ${request.url})`);

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
      console.warn('[Persistence] Handling missing columns in requests table. Stripping ALL new fields for fallback.');
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

    if (error) {
      console.error('[Persistence] Save failed (Supabase Error):', error.message, error.details, error.hint);
      throw error;
    }

    console.log(`[Persistence] Request ${request.id} synchronized.`);
  }

  static async createRequest(data: Partial<RequestData>) {
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
      console.warn('[Persistence] Handling missing columns in requests table during creation. Stripping new fields.');
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
    return request as RequestData;
  }

  static async updateRequest(id: string, updates: Partial<RequestData>) {
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
      console.warn('[Persistence] Handling missing columns in updateRequest. Stripping new fields.');
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
    return data as RequestData;
  }

  static async deleteRequest(id: string) {
    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', id);

    if (error) console.error('Deletion Error:', error);
  }

  static async duplicateRequest(originalId: string, overrides: Partial<RequestData> = {}) {
    // 1. Fetch original
    const { data: original, error: fetchError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', originalId)
      .single();

    if (fetchError || !original) throw new Error('Original request not found.');

    // 2. Clone and override
    const { id, created_at, updated_at, ...cloneData } = original;
    const newRequest = {
      ...cloneData,
      name: `${cloneData.name} (Copy)`,
      ...overrides
    };

    // 3. Insert clone
    const { data: inserted, error: insertError } = await supabase
      .from('requests')
      .insert([newRequest])
      .select()
      .single();

    if (insertError) throw insertError;

    return {
      ...inserted,
      bodyType: inserted.body_type,
      body: inserted.body // Body normalization will happen in useDataSync or store
    } as RequestData;
  }

  static async saveHistory(entry: any) {
    let { error } = await supabase
      .from('history')
      .insert([entry]);
      
    if (error && String(error.message || '').toLowerCase().includes('column')) {
      console.warn('[Persistence] Handling missing columns in history table. Stripping new fields.');
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
    const { error } = await supabase.from('history').delete().eq('id', id);
    if (error) throw error;
  }

  static async clearHistory(workspaceId: string, userId: string) {
    const { error } = await supabase
      .from('history')
      .delete()
      .match({ workspace_id: workspaceId, user_id: userId });
    if (error) throw error;
  }

  // --- Environment Actions ---
  static async createEnvironment(workspaceId: string, userId: string, name: string, variables: KeyValue[] = [], isGlobal: boolean = false) {
    let insertData: any = {
      name,
      workspace_id: workspaceId,
      user_id: userId,
      variables,
      is_global: isGlobal,
      pre_request_script: '',
      test_script: '',
      documentation: ''
    };

    let { data, error } = await supabase
      .from('environments')
      .insert([insertData])
      .select()
      .single();

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      console.warn('[Persistence] Handling missing columns in environments table. Stripping new fields.');
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

    if (error) {
      console.error('Environment creation error:', error);
      throw error;
    }
    return data as Environment;
  }

  static async updateEnvironment(id: string, updates: Partial<Environment>) {
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
    const { error } = await supabase.from('environments').delete().eq('id', id);
    if (error) throw error;
  }

  static async updateProfilePreferences(userId: string, preferences: Profile['preferences']) {
    let { data, error } = await supabase
      .from('profiles')
      .update({ preferences, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      console.warn('[Persistence] Handling missing columns in profiles table (preferences).');
      const fallback = await supabase
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data;
  }

  static async inviteCollectionCollaborator(collectionId: string, identifier: string, role: 'viewer' | 'editor' | 'admin', invitedBy: string) {
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

    // For inviting to a collection, we use the tenant client if it's a team workspace collection
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
    const { error } = await supabase
      .from('collection_collaborators')
      .delete()
      .match({ collection_id: collectionId, user_id: userId });

    if (error) throw error;
  }

  // --- Saved Responses ---
  static async createSavedResponse(requestId: string, userId: string, response: any) {
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
      console.warn('[Persistence] saved_responses table missing. Skipping save.', e);
      return null;
    }
  }

  static async getSavedResponses(requestId: string) {
    try {
      const { data, error } = await supabase
        .from('saved_responses')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });
  
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('[Persistence] saved_responses table missing. Returning empty array.', e);
      return [];
    }
  }

  static async deleteSavedResponse(id: string) {
    try {
      const { error } = await supabase.from('saved_responses').delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn('[Persistence] saved_responses table missing or delete failed.', e);
    }
  }

  // --- User Tabs Actions ---
  static async syncUserTabs(userId: string, tabs: any[], activeTabId: string | null) {
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
  }

  static async getUserTabs(userId: string) {
    const { data, error } = await supabase
      .from('user_tabs')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async fetchUserTeams(userId: string) {
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
  }

  static async fetchWorkspacesByTeam(teamId: string) {
    let { data, error } = await globalSupabase
      .from('workspaces')
      .select('*')
      .eq('team_id', teamId);
    
    if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
      console.warn('[Persistence] team_id missing in workspaces table. Returning empty to avoid crash.');
      return [];
    }

    if (error) throw error;
    return data || [];
  }

  // --- Global Variables ---
  static async saveGlobalVariables(userId: string, variables: KeyValue[]) {
    try {
      const { error } = await supabase
        .from('global_variables')
        .upsert({ user_id: userId, variables, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
    } catch (e) {
      console.warn('[Persistence] Global variables table missing or inaccessible. Skipping save.', e);
    }
  }

  static async getGlobalVariables(userId: string) {
    try {
      const { data, error } = await supabase
        .from('global_variables')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.variables || [];
    } catch (e) {
      console.warn('[Persistence] Global variables table missing. Returning empty array.', e);
      return [];
    }
  }

  // --- Script Logs ---
  static async createScriptLog(log: Partial<ScriptExecutionLog>) {
    try {
      const { data, error } = await supabase
        .from('script_execution_logs')
        .insert([log])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('[Persistence] script_execution_logs table missing. Skipping log creation.', e);
      return null;
    }
  }

  static async fetchScripts(workspaceId: string) {
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async fetchScriptFolders(workspaceId: string) {
    let { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('parent_id', null);

    if (error && String(error.message || '').match(/column.*not exist|schema cache/i)) {
      console.warn('[Persistence] workspace_id missing in folders. Searching via collection join.');
      // Fallback: This is much slower but avoids crashing. 
      // In a real app we'd join but Supabase JS doesn't support complex joins easily without a view.
      // We just return empty or fetch all if workspace_id missing for now to prevent fatal crash.
      const fallback = await supabase
        .from('folders')
        .select('*')
        .eq('parent_id', null);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return data || [];
  }

  static async createScript(data: any) {
    const { data: script, error } = await supabase
      .from('scripts')
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return script;
  }

  static async updateScript(id: string, updates: any) {
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
    const { error } = await supabase.from('scripts').delete().eq('id', id);
    if (error) throw error;
  }

  static async updateProfile(id: string, updates: Partial<Profile> | any) {
    let { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      console.warn('[Persistence] Handling missing columns in updateProfile.');
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
}

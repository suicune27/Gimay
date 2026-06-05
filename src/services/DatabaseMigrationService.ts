import { createClient } from '@supabase/supabase-js';
import { globalSupabase } from '../lib/supabase';
import { ensureDatabaseSchema } from './ensureDatabaseSchema';

export type MigrationProgress = {
  step: 'idle' | 'schema' | 'fetching' | 'injecting' | 'complete' | 'failed';
  message: string;
  percent: number;
};

export class DatabaseMigrationService {
  static async migrate(
    targetUrl: string,
    targetServiceKey: string,
    currentUserId: string,
    onProgress: (prog: MigrationProgress) => void
  ) {
    try {
      // Step 1: Ensure target database schema
      onProgress({ step: 'schema', message: 'Assuring schema on target database...', percent: 10 });
      const schemaResult = await ensureDatabaseSchema(targetUrl, targetServiceKey, (label, pct) => {
        onProgress({ step: 'schema', message: `Target Schema: ${label}`, percent: 10 + Math.round(pct * 0.3) });
      });

      if (!schemaResult.success) {
        throw new Error(schemaResult.error || 'Failed to establish schema on target database.');
      }

      onProgress({ step: 'fetching', message: 'Establishing target client link...', percent: 40 });
      const targetClient = createClient(targetUrl, targetServiceKey);
      
      // Step 2: Fetch all source records
      onProgress({ step: 'fetching', message: 'Harvesting source records from current database...', percent: 45 });
      
      // A. Profile
      const { data: profile } = await globalSupabase.from('profiles').select('*').eq('id', currentUserId).single();
      
      // B. Team Memberships
      const { data: memberships } = await globalSupabase.from('team_members').select('*').eq('user_id', currentUserId);
      const teamIds = memberships?.map(m => m.team_id) || [];
      
      // C. Teams
      let teams: any[] = [];
      if (teamIds.length > 0) {
        const { data: fetchedTeams } = await globalSupabase.from('teams').select('*').in('id', teamIds);
        teams = fetchedTeams || [];
      }
      
      // D. Workspaces
      let workspaces: any[] = [];
      
      // Personal workspaces
      const { data: personalWorkspaces } = await globalSupabase.from('workspaces').select('*').eq('user_id', currentUserId);
      if (personalWorkspaces) workspaces.push(...personalWorkspaces);
      
      // Team workspaces
      if (teamIds.length > 0) {
        const { data: teamWorkspaces } = await globalSupabase.from('workspaces').select('*').in('team_id', teamIds);
        if (teamWorkspaces) {
          teamWorkspaces.forEach(tw => {
            if (!workspaces.some(w => w.id === tw.id)) workspaces.push(tw);
          });
        }
      }
      
      const workspaceIds = workspaces.map(w => w.id);
      
      // E. Collections
      let collections: any[] = [];
      if (workspaceIds.length > 0) {
        const { data: fetchedCollections } = await globalSupabase.from('collections').select('*').in('workspace_id', workspaceIds);
        collections = fetchedCollections || [];
      }
      
      const collectionIds = collections.map(c => c.id);
      
      // H. Environments
      let environments: any[] = [];
      if (workspaceIds.length > 0) {
        const { data: fetchedEnvironments } = await globalSupabase.from('environments').select('*').in('workspace_id', workspaceIds);
        environments = fetchedEnvironments || [];
      }
      
      // I. Scripts
      let scripts: any[] = [];
      if (workspaceIds.length > 0) {
        const { data: fetchedScripts } = await globalSupabase.from('scripts').select('*').in('workspace_id', workspaceIds);
        scripts = fetchedScripts || [];
      }

      // F. Folders
      let folders: any[] = [];
      if (collectionIds.length > 0) {
        const { data: fetchedFolders } = await globalSupabase.from('folders').select('*').in('collection_id', collectionIds);
        folders = fetchedFolders || [];
      }
      
      // G. Requests
      let requests: any[] = [];
      if (collectionIds.length > 0) {
        const { data: fetchedRequests } = await globalSupabase.from('requests').select('*').in('collection_id', collectionIds);
        requests = fetchedRequests || [];
      }

      onProgress({ step: 'injecting', message: 'Injecting records into target schema...', percent: 60 });

      // Step 3: Inject records to the target
      // Standard order to prevent foreign key constraint issues:
      // 1. profiles
      // 2. teams
      // 3. team_members
      // 4. workspaces
      // 5. collections
      // 6. folders
      // 7. requests
      // 8. environments
      // 9. scripts

      if (profile) {
        onProgress({ step: 'injecting', message: 'Upserting profile info...', percent: 65 });
        const { error } = await targetClient.from('profiles').upsert(profile);
        if (error) throw new Error(`Profile insert failed: ${error.message}`);
      }

      if (teams.length > 0) {
        onProgress({ step: 'injecting', message: 'Upserting teams configuration...', percent: 70 });
        const { error } = await targetClient.from('teams').upsert(teams);
        if (error) throw new Error(`Teams insert failed: ${error.message}`);
      }

      if (memberships && memberships.length > 0) {
        onProgress({ step: 'injecting', message: 'Upserting member rosters...', percent: 75 });
        const { error } = await targetClient.from('team_members').upsert(memberships);
        if (error) throw new Error(`Members insert failed: ${error.message}`);
      }

      if (workspaces.length > 0) {
        onProgress({ step: 'injecting', message: 'Upserting workspaces...', percent: 80 });
        const { error } = await targetClient.from('workspaces').upsert(workspaces);
        if (error) throw new Error(`Workspaces insert failed: ${error.message}`);
      }

      if (collections.length > 0) {
        onProgress({ step: 'injecting', message: 'Upserting collections...', percent: 85 });
        const { error } = await targetClient.from('collections').upsert(collections);
        if (error) throw new Error(`Collections insert failed: ${error.message}`);
      }

      if (folders.length > 0) {
        onProgress({ step: 'injecting', message: 'Upserting folders structure...', percent: 90 });
        const { error } = await targetClient.from('folders').upsert(folders);
        if (error) throw new Error(`Folders insert failed: ${error.message}`);
      }

      if (requests.length > 0) {
        onProgress({ step: 'injecting', message: 'Upserting API requests...', percent: 92 });
        const { error } = await targetClient.from('requests').upsert(requests);
        if (error) throw new Error(`Requests insert failed: ${error.message}`);
      }

      if (environments.length > 0) {
        onProgress({ step: 'injecting', message: 'Upserting active environments...', percent: 95 });
        const { error } = await targetClient.from('environments').upsert(environments);
        if (error) throw new Error(`Environments insert failed: ${error.message}`);
      }

      if (scripts.length > 0) {
        onProgress({ step: 'injecting', message: 'Upserting Custom scripts...', percent: 98 });
        const { error } = await targetClient.from('scripts').upsert(scripts);
        if (error) throw new Error(`Scripts insert failed: ${error.message}`);
      }

      onProgress({ step: 'complete', message: 'Database migration transaction completed successfully!', percent: 100 });
    } catch (e: any) {
      onProgress({ step: 'failed', message: e.message || 'Migration failed due to target database error.', percent: 0 });
      throw e;
    }
  }
}

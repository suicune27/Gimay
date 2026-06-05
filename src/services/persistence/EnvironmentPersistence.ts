import { supabase } from '../../lib/supabase';
import { Environment, KeyValue } from '../../types';
import { runResilientAction, getStore } from './CorePersistence';

export async function createEnvironment(workspaceId: string, userId: string, name: string, variables: KeyValue[] = [], isGlobal: boolean = false, preRequestScript = '', testScript = '', documentation = '') {
  return runResilientAction(
    () => createEnvironmentOnline(workspaceId, userId, name, variables, isGlobal, preRequestScript, testScript, documentation),
    () => {
      const mockEnv: Environment = {
        id: `offline-${Math.random().toString(36).substr(2, 9)}`,
        workspace_id: workspaceId, user_id: userId, name, variables,
        is_global: isGlobal, pre_request_script: preRequestScript || '',
        test_script: testScript || '', documentation: documentation || '',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      };
      const state = getStore().getState();
      state.setEnvironments([...state.environments, mockEnv]);
      return mockEnv;
    },
    (mockEnv) => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('environment', 'create', mockEnv.id, mockEnv);
    }
  );
}

export async function createEnvironmentOnline(workspaceId: string, userId: string, name: string, variables: KeyValue[] = [], isGlobal: boolean = false, preRequestScript = '', testScript = '', documentation = '') {
  const insertData: any = { name, workspace_id: workspaceId, user_id: userId, variables, is_global: isGlobal, pre_request_script: preRequestScript, test_script: testScript, documentation };

  let { data, error } = await supabase.from('environments').insert([insertData]).select().single();

  if (error && String(error.message || '').toLowerCase().includes('column')) {
    delete insertData.pre_request_script; delete insertData.test_script;
    delete insertData.documentation; delete insertData.is_global;
    const fallback = await supabase.from('environments').insert([insertData]).select().single();
    data = fallback.data; error = fallback.error;
  }
  if (error) throw error;
  return data as Environment;
}

export async function updateEnvironment(id: string, updates: Partial<Environment>) {
  return runResilientAction(
    () => updateEnvironmentOnline(id, updates),
    () => {
      const state = getStore().getState();
      state.setEnvironments(state.environments.map((e: any) => e.id === id ? { ...e, ...updates } : e));
      return { id, ...updates } as Environment;
    },
    () => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('environment', 'update', id, updates);
    }
  );
}

export async function updateEnvironmentOnline(id: string, updates: Partial<Environment>) {
  let { data, error } = await supabase.from('environments').update(updates).eq('id', id).select().single();

  if (error && String(error.message || '').toLowerCase().includes('column')) {
    const sanitizedUpdates = { ...updates } as any;
    delete sanitizedUpdates.pre_request_script; delete sanitizedUpdates.test_script; delete sanitizedUpdates.documentation;
    const fallback = await supabase.from('environments').update(sanitizedUpdates).eq('id', id).select().single();
    data = fallback.data; error = fallback.error;
  }
  if (error) throw error;
  return data as Environment;
}

export async function deleteEnvironment(id: string) {
  return runResilientAction(
    () => deleteEnvironmentOnline(id),
    () => {
      const state = getStore().getState();
      state.setEnvironments(state.environments.filter((e: any) => e.id !== id));
      return id;
    },
    () => {
      const { syncManager } = require('../SyncService');
      syncManager.enqueueAction('environment', 'delete', id, null);
    }
  );
}

export async function deleteEnvironmentOnline(id: string) {
  const { error } = await supabase.from('environments').delete().eq('id', id);
  if (error) throw error;
}

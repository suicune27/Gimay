import { supabase } from '../lib/supabase';
import { ScriptCategory, ScriptTemplate } from '../types';
import { defaultScriptCategories, defaultScripts } from '../lib/defaultScripts';

export class ScriptLibraryService {
  static async fetchCategories(): Promise<ScriptCategory[]> {
    const { data, error } = await supabase
      .from('script_categories')
      .select('*')
      .order('name');
      
    if (error) {
      console.warn('Failed to fetch script categories:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      const seeded = await this.seedBuiltInScripts();
      if (seeded) {
        const { data: newData } = await supabase
          .from('script_categories')
          .select('*')
          .order('name');
        return newData || [];
      }
    }
    
    return data || [];
  }

  static async fetchTemplates(): Promise<ScriptTemplate[]> {
    const { data, error } = await supabase
      .from('script_library')
      .select('*, categories(*)')
      .order('is_builtin', { ascending: false })
      .order('name');
    if (error) throw error;
    return data || [];
  }

  static async toggleFavorite(scriptId: string, userId: string, isFavorite: boolean) {
    if (isFavorite) {
      const { error } = await supabase.from('script_favorites').insert([{ script_id: scriptId, user_id: userId }]);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('script_favorites').delete().match({ script_id: scriptId, user_id: userId });
      if (error) throw error;
    }
  }

  static async fetchFavorites(userId: string): Promise<string[]> {
    const { data, error } = await supabase.from('script_favorites').select('script_id').eq('user_id', userId);
    if (error) throw error;
    return data.map(d => d.script_id);
  }

  static async logExecution(logData: {
    request_id?: string;
    workspace_id?: string;
    user_id: string;
    logs: any[];
    errors: any[];
    duration: number;
    variables_changed: Record<string, any>;
  }) {
    const compactLogs = (logData.logs || []).slice(-100).map((l: any) => ({
      level: l?.level || 'info',
      args: Array.isArray(l?.args)
        ? l.args.map((a: any) => (typeof a === 'string' ? a.slice(0, 2048) : String(a).slice(0, 2048))).slice(0, 5)
        : [String(l?.message || '').slice(0, 2048)],
      timestamp: l?.timestamp || new Date().toISOString()
    }));

    const compactErrors = (logData.errors || []).slice(-100).map((e: any) => ({
      level: e?.level || 'error',
      args: Array.isArray(e?.args)
        ? e.args.map((a: any) => (typeof a === 'string' ? a.slice(0, 2048) : String(a).slice(0, 2048))).slice(0, 5)
        : [String(e?.message || '').slice(0, 2048)],
      timestamp: e?.timestamp || new Date().toISOString()
    }));

    const safeData = {
      ...logData,
      logs: compactLogs,
      errors: compactErrors,
      variables_changed: logData.variables_changed || {}
    };

    const { error } = await supabase.from('script_execution_logs').insert([safeData]);
    if (error) console.error('Error saving execution log:', error);
  }

  static async seedBuiltInScripts(): Promise<boolean> {
    try {
      // Insert categories
      const { data: cats, error: catError } = await supabase
        .from('script_categories')
        .insert(defaultScriptCategories)
        .select();
      
      if (catError) {
        console.warn('Skipping script seed (likely insufficient permissions):', catError.message);
        return false;
      }
      if (!cats) return false;

      // Map categories to get IDs
      const catMap = cats.reduce((acc: Record<string, string>, cat) => {
        acc[cat.name] = cat.id;
        return acc;
      }, {});

      const scriptsToInsert = defaultScripts.map(script => ({
        name: script.name,
        description: script.description,
        content: script.content,
        category_id: catMap[script.categoryName],
        variables_used: script.variables_used,
        version: script.version,
        is_builtin: true,
        tags: script.tags
      }));

      const { error: scriptError } = await supabase.from('script_library').insert(scriptsToInsert);
      if (scriptError) {
        console.warn('Failed to seed script library:', scriptError.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Exception during script seeding:', err);
      return false;
    }
  }
}

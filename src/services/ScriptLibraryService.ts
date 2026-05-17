import { supabase } from '../lib/supabase';
import { ScriptCategory, ScriptTemplate } from '../types';
import { defaultScriptCategories, defaultScripts } from '../lib/defaultScripts';

export class ScriptLibraryService {
  static async fetchCategories(): Promise<ScriptCategory[]> {
    const { data, error } = await supabase
      .from('script_categories')
      .select('*')
      .order('name');
    if (error) throw error;
    
    if (!data || data.length === 0) {
      await this.seedBuiltInScripts();
      return this.fetchCategories();
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
    const { error } = await supabase.from('script_execution_logs').insert([logData]);
    if (error) console.error('Error saving execution log:', error);
  }

  static async seedBuiltInScripts() {
    // Insert categories
    const { data: cats, error: catError } = await supabase
      .from('script_categories')
      .insert(defaultScriptCategories)
      .select();
    
    if (catError || !cats) return;

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

    await supabase.from('script_library').insert(scriptsToInsert);
  }
}

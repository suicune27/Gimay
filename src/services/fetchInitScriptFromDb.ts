import { createClient } from '@supabase/supabase-js';

/**
 * Fetch the latest initialization script from the init_scripts table in Supabase.
 * @param supabaseUrl Supabase project URL
 * @param anonKey Supabase anon or service key
 * @returns Promise<{ script: string | null; error?: string }>
 */
export async function fetchInitScriptFromDb(
  supabaseUrl: string,
  anonKey: string
): Promise<{ script: string | null; error?: string }> {
  try {
    const client = createClient(supabaseUrl, anonKey);
    const { data, error } = await client
      .from('init_scripts')
      .select('script')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return { script: null, error: error.message };
    }
    return { script: data?.script || null };
  } catch (err: any) {
    return { script: null, error: err.message };
  }
}

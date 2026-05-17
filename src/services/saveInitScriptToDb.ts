import { createClient } from '@supabase/supabase-js';

/**
 * Save the initialization script to the Supabase database for auditing/reference.
 * @param supabaseUrl Supabase project URL
 * @param serviceKey Supabase service role key
 * @param script The SQL script to save
 * @param userId The user who triggered the save
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function saveInitScriptToDb(
  supabaseUrl: string,
  serviceKey: string,
  script: string,
  userId: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createClient(supabaseUrl, serviceKey);
    const { error } = await client.from('init_scripts').insert([
      {
        script,
        created_by: userId,
        created_at: new Date().toISOString(),
      },
    ]);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

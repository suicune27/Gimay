import { createClient } from '@supabase/supabase-js';
import { SecureConfigStorage } from './SecureConfigStorage';

export function getSupabaseConfig() {
  const envUrl = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL
    ? (import.meta as any).env.VITE_SUPABASE_URL
    : process.env.VITE_SUPABASE_URL;

  const envAnonKey = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
    ? (import.meta as any).env.VITE_SUPABASE_ANON_KEY
    : process.env.VITE_SUPABASE_ANON_KEY;

  const storedConfig = SecureConfigStorage.getSupabaseConfig();

  return {
    url: envUrl || storedConfig?.url || null,
    anonKey: envAnonKey || storedConfig?.anonKey || null,
  };
}

// Create a client that always uses current config
function createSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  const supabaseUrl = url || 'https://placeholder-project.supabase.co';
  const supabaseAnonKey = anonKey || 'placeholder-anon-key';
  return createClient(supabaseUrl, supabaseAnonKey);
}

export let supabase = createSupabaseClient();
export const isSupabaseConfigured = () => {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.anonKey);
};

export function refreshSupabaseClient() {
  supabase = createSupabaseClient();
  return supabase;
}

// Export a function to get a fresh client with current config
export function getSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error('Supabase not configured');
  }
  return createClient(url, anonKey);
}

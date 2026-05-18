import { createClient } from '@supabase/supabase-js';
import { SecureConfigStorage } from './SecureConfigStorage';

export function getGlobalSupabaseConfig() {
  const envUrl = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL
    ? (import.meta as any).env.VITE_SUPABASE_URL
    : process.env.VITE_SUPABASE_URL;

  const envAnonKey = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
    ? (import.meta as any).env.VITE_SUPABASE_ANON_KEY
    : process.env.VITE_SUPABASE_ANON_KEY;

  return {
    url: envUrl || null,
    anonKey: envAnonKey || null,
  };
}

export function getTenantSupabaseConfig() {
  return SecureConfigStorage.getSupabaseConfig();
}

const CLIENT_CACHE: Record<string, any> = {};

function getCachedClient(url: string, anonKey: string) {
  const key = `${url}_${anonKey}`;
  if (!CLIENT_CACHE[key]) {
    CLIENT_CACHE[key] = createClient(url, anonKey);
    (CLIENT_CACHE[key] as any).config = { url, anonKey };
  }
  return CLIENT_CACHE[key];
}

// Global client: Only uses environment variables
export const globalSupabase = (() => {
  const config = getGlobalSupabaseConfig();
  return getCachedClient(
    config.url || 'https://placeholder-project.supabase.co',
    config.anonKey || 'placeholder-anon-key'
  );
})();

export function getSupabaseConfig() {
  const global = getGlobalSupabaseConfig();
  const tenant = getTenantSupabaseConfig();

  // If we have tenant config, it takes priority for the general client
  return {
    url: tenant?.url || global.url || null,
    anonKey: tenant?.anonKey || global.anonKey || null,
  };
}

// Create a client that always uses current config (tenant preferred)
function createSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  return getCachedClient(
    url || 'https://placeholder-project.supabase.co',
    anonKey || 'placeholder-anon-key'
  );
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

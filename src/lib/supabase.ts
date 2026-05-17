import { createClient } from '@supabase/supabase-js';
import { SecureConfigStorage } from './SecureConfigStorage';

const envUrl = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL
  ? (import.meta as any).env.VITE_SUPABASE_URL
  : process.env.VITE_SUPABASE_URL;

const envAnonKey = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
  ? (import.meta as any).env.VITE_SUPABASE_ANON_KEY
  : process.env.VITE_SUPABASE_ANON_KEY;

// Global window.fetch interceptor to catch ALL Supabase clients (both global and dynamically created)
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async function (input: any, init: any) {
    let url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input && typeof input.url === 'string') {
      url = input.url;
    } else if (input && typeof input.toString === 'function') {
      url = input.toString();
    }

    // Intercept requests to Tenant Database (any Supabase URL that doesn't match the Env central URL)
    if (url && url.includes('.supabase.co') && envUrl && !url.includes(envUrl)) {
      const config = getSupabaseConfig();
      if (config.anonKey) {
        // Clean headers in input (if it is a Request object)
        if (input && typeof input === 'object' && input.headers) {
          try {
            cleanHeaders(input.headers, config.anonKey);
          } catch (e) {
            // Reconstruct the Request object with modified headers in init if input.headers is read-only
            try {
              const newHeaders = new Headers(input.headers);
              cleanHeaders(newHeaders, config.anonKey);
              input = new Request(input, { headers: newHeaders });
            } catch (innerErr) {
              console.warn('[Fetch Interceptor] Failed to reconstruct Request object:', innerErr);
            }
          }
        }

        // Clean headers in init options
        if (!init) {
          init = { headers: {} };
        } else if (!init.headers) {
          init.headers = {};
        }
        cleanHeaders(init.headers, config.anonKey);
      }
    }

    return originalFetch.call(this, input, init);
  };
}

export const envSupabase = createClient(
  envUrl || 'https://placeholder-project.supabase.co',
  envAnonKey || 'placeholder-anon-key'
);

export function getSupabaseConfig() {
  const storedConfig = SecureConfigStorage.getSupabaseConfig();

  return {
    url: storedConfig?.url || envUrl || null,
    anonKey: storedConfig?.anonKey || envAnonKey || null,
  };
}

// Decorates a Supabase client so that Auth and Profile operations are routed to the central env database
function decorateSupabaseClient(client: any) {
  Object.defineProperty(client, 'auth', {
    get: () => envSupabase.auth,
    configurable: true
  });

  const originalFrom = client.from;
  client.from = function (relation: string) {
    if (relation === 'profiles' || relation === 'global_variables') {
      return envSupabase.from(relation);
    }
    return originalFrom.apply(this, arguments as any);
  };

  return client;
}

function cleanHeaders(headers: any, targetAnonKey: string) {
  if (!headers) return;
  
  if (typeof headers.get === 'function' && typeof headers.set === 'function') {
    // Web standard Headers object
    headers.set('Authorization', `Bearer ${targetAnonKey}`);
    headers.set('apikey', targetAnonKey);
  } else if (Array.isArray(headers)) {
    // Array of [key, value] pairs
    let hasAuth = false;
    let hasApikey = false;
    for (let i = 0; i < headers.length; i++) {
      const pair = headers[i];
      if (pair && pair[0]) {
        const keyLower = String(pair[0]).toLowerCase();
        if (keyLower === 'authorization') {
          pair[1] = `Bearer ${targetAnonKey}`;
          hasAuth = true;
        } else if (keyLower === 'apikey') {
          pair[1] = targetAnonKey;
          hasApikey = true;
        }
      }
    }
    if (!hasAuth) headers.push(['Authorization', `Bearer ${targetAnonKey}`]);
    if (!hasApikey) headers.push(['apikey', targetAnonKey]);
  } else if (typeof headers === 'object') {
    // Plain JavaScript object
    const keys = Object.keys(headers);
    for (const key of keys) {
      const keyLower = key.toLowerCase();
      if (keyLower === 'authorization' || keyLower === 'apikey') {
        delete headers[key];
      }
    }
    headers['Authorization'] = `Bearer ${targetAnonKey}`;
    headers['apikey'] = targetAnonKey;
  }
}


// Create a client that always uses current config
function createSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  const supabaseUrl = url || 'https://placeholder-project.supabase.co';
  const supabaseAnonKey = anonKey || 'placeholder-anon-key';
  
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    },
    global: {
      fetch: (input: any, init: any) => {
        if (init && init.headers) {
          cleanHeaders(init.headers, supabaseAnonKey);
        }
        return fetch(input, init);
      }
    }
  });
  
  return decorateSupabaseClient(client);
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
  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false
    },
    global: {
      fetch: (input: any, init: any) => {
        if (init && init.headers) {
          cleanHeaders(init.headers, anonKey);
        }
        return fetch(input, init);
      }
    }
  });
  return decorateSupabaseClient(client);
}

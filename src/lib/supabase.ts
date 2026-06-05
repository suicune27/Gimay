import { createClient } from '@supabase/supabase-js';
import { SecureConfigStorage } from './SecureConfigStorage';
import { toast } from 'sonner';

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

let isRestoringSchema = false;

export function checkAndTriggerSchemaUpdate() {
  if (isRestoringSchema) return;
  
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) return;
  
  isRestoringSchema = true;
  toast.warning('Database schema mismatch detected. Triggering self-repair update...', {
    duration: 6000,
    id: 'db-schema-repair'
  });

  import('../services/ensureDatabaseSchema').then(({ ensureDatabaseSchema }) => {
    ensureDatabaseSchema(config.url!, config.anonKey!).then((res) => {
      isRestoringSchema = false;
      if (res.success) {
        toast.success('Database constraints and schema successfully updated and restored!', {
          duration: 5000,
          id: 'db-schema-repair'
        });
      } else {
        toast.error(`Database schema repair halted: ${res.error}`, {
          duration: 8000,
          id: 'db-schema-repair'
        });
      }
    }).catch(err => {
      isRestoringSchema = false;
      toast.error(`Database schema update error: ${err.message || err}`, {
        id: 'db-schema-repair'
      });
    });
  }).catch(err => {
    isRestoringSchema = false;
    toast.error(`Auto-update module load failed: ${err.message || err}`, {
      id: 'db-schema-repair'
    });
  });
}

function wrapWithQueryErrorInterceptors(client: any): any {
  if (!client) return client;
  if (client.__is_wrapped__) return client;

  const handler = {
    get(target: any, prop: string | symbol, receiver: any) {
      const val = Reflect.get(target, prop, receiver);
      if (prop === '__is_wrapped__') return true;

      if (typeof val === 'function') {
        return function (...args: any[]) {
          const result = val.apply(target, args);
          
          if (result && typeof result.then === 'function') {
            const originalThen = result.then;
            result.then = function (onfulfilled: any, onrejected: any) {
              return originalThen.call(this, (res: any) => {
                if (res && res.error) {
                  const errCode = res.error.code;
                  const errMsg = String(res.error.message || '').toLowerCase();
                  
                  const isSchemaError = 
                    errCode === '42P01' || 
                    errCode === '42703' || 
                    errCode === 'PGRST204' ||
                    errCode === 'PGRST302' ||
                    errMsg.includes('does not exist') || 
                    errMsg.includes('not found') || 
                    errMsg.includes('relation');
                  
                  if (isSchemaError) {
                    console.warn(`[Supabase Auto-Repair] Schema/relation error intercepted: ${res.error.message}`);
                    checkAndTriggerSchemaUpdate();
                  }
                }
                if (onfulfilled) {
                  return onfulfilled(res);
                }
                return res;
              }, (err: any) => {
                if (onrejected) {
                  return onrejected(err);
                }
                throw err;
              });
            };
          }
          return result;
        };
      }
      return val;
    }
  };

  return new Proxy(client, handler);
}

const CLIENT_CACHE: Record<string, any> = {};

function getCachedClient(url: string, anonKey: string) {
  const key = `${url}_${anonKey}`;
  if (!CLIENT_CACHE[key]) {
    const rawClient = createClient(url, anonKey);
    CLIENT_CACHE[key] = wrapWithQueryErrorInterceptors(rawClient);
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

  // If global environment variables are defined, they MUST take precedence over cached local storage
  // configurations to prevent lockouts and stale DB reference errors when credentials or projects shift.
  const hasGlobal = Boolean(global.url && global.anonKey);
  const config = {
    url: hasGlobal ? global.url : (tenant?.url || global.url || null),
    anonKey: hasGlobal ? global.anonKey : (tenant?.anonKey || global.anonKey || null),
  };

  console.log('[SUPABASE CLIENT CONFIG]', {
    source: hasGlobal ? 'Global Env' : (tenant ? 'Tenant LocalStorage' : 'Global Env'),
    url: config.url,
    anonKey: config.anonKey ? '***' + config.anonKey.slice(-6) : null
  });

  return config;
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
  const rawClient = createClient(url, anonKey);
  return wrapWithQueryErrorInterceptors(rawClient);
}

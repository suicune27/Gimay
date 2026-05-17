import CryptoJS from 'crypto-js';
import axios from 'axios';
import { useScriptStore } from '../store/scriptStore';
import { useStore } from '../store/useStore';

export class ScriptEngine {
  static async execute(code: string) {
    const { addLog, setConsoleOpen } = useScriptStore.getState();
    const { environments, activeEnvId } = useStore.getState();

    setConsoleOpen(true);
    addLog({ level: 'info', message: 'Execution started...' });

    const activeEnv = environments.find(e => e.id === activeEnvId);
    const envVars = [...(activeEnv?.variables || [])];

    const putmanConsole = {
      log: (...args: any[]) => {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
        addLog({ level: 'info', message: msg });
      },
      success: (msg: string) => addLog({ level: 'success', message: msg }),
      error: (msg: string) => addLog({ level: 'error', message: msg }),
      warn: (msg: string) => addLog({ level: 'warn', message: msg })
    };

    const putmanContext: any = {
      request: Object.assign(
        async (opts: any) => {
          try {
            addLog({ level: 'info', message: `Sending ${opts.method || 'GET'} request to ${opts.url}...` });
            const { RequestService } = await import('./RequestService');
            const requestOpts = typeof opts === 'string' ? { url: opts, method: 'GET' } : { ...opts };
            if (requestOpts.data !== undefined && requestOpts.body === undefined) {
              requestOpts.body = requestOpts.data;
              requestOpts.bodyType = requestOpts.bodyType || 'raw';
            }
            if (typeof requestOpts.body === 'string' && !requestOpts.bodyType) {
              requestOpts.bodyType = 'raw';
            }
            const response = await RequestService.execute(
              requestOpts as any,
              { variables: {} } as any
            );
            addLog({ level: 'success', message: `Request returned ${response.status} ${response.statusText}` });
            return {
              status: response.status,
              statusText: response.statusText,
              data: response.body,
              headers: response.headers
            };
          } catch (e: any) {
            addLog({ level: 'error', message: `Request Error: ${e.message}` });
            throw e;
          }
        },
        {
          headers: {},
          method: 'GET',
          body: null
        }
      ),
      sendRequest: async (opts: any) => putmanContext.request(opts),
      import: async (identifier: string) => {
        const allScripts = useScriptStore.getState().scripts;
        const target = allScripts.find(s => s.id === identifier || s.name === identifier);
        if (!target) {
          addLog({ level: 'error', message: `Import failed: Script "${identifier}" not found.` });
          throw new Error(`Script "${identifier}" not found.`);
        }
        addLog({ level: 'info', message: `Importing script: ${target.name}` });
        return async () => {
          addLog({ level: 'info', message: `Executing imported script: ${target.name}...` });
          const nestedFn = new Function('pm', 'putman', 'gmy', 'gimay', 'console', `return (async () => { ${target.content} })()`);
          const result = await nestedFn(putmanContext, putmanContext, putmanContext, putmanContext, putmanConsole);
          addLog({ level: 'info', message: `Imported script ${target.name} execution completed.` });
          return result;
        };
      },
      get: async (url: string) => putmanContext.request({ url, method: 'GET' }),
      post: async (url: string, body: any) => putmanContext.request({ url, method: 'POST', data: body }),
      env: {
        get: (key: string) => {
          const v = envVars.find(it => it.key === key);
          return v ? v.value : undefined;
        },
        set: (key: string, value: string) => {
          const name = activeEnv?.name || 'Global';
          addLog({ level: 'info', message: `[${name}] Setting ${key} = ${value}` });
          
          const index = envVars.findIndex(v => v.key === key);
          if (index !== -1) {
            envVars[index] = { ...envVars[index], value };
          } else {
            envVars.push({ 
              id: Math.random().toString(36).substr(2, 9),
              key, 
              value, 
              type: 'string', 
              enabled: true,
              active: true 
            });
          }
          
          if (activeEnvId) {
            // Use a fresh array reference to ensure Zustand triggers re-render
            useStore.getState().updateEnvironment(activeEnvId, { variables: [...envVars] });
          } else {
            // If no active env, update global variables as a fallback
            const globals = [...useStore.getState().globalVariables];
            const gIdx = globals.findIndex(v => v.key === key);
            if (gIdx !== -1) {
              globals[gIdx] = { ...globals[gIdx], value };
            } else {
              globals.push({ 
                id: Math.random().toString(36).substr(2, 9),
                key, 
                value, 
                active: true 
              });
            }
            useStore.getState().setGlobalVariables(globals);
          }
        }
      },
      crypto: CryptoJS,
      console: putmanConsole,
      test: {
        expect: (val: any) => ({
          toBe: (expected: any) => {
            const pass = val === expected;
            addLog({
              level: pass ? 'success' : 'error',
              message: `Test ${pass ? 'PASSED' : 'FAILED'}: expected ${expected}, got ${val}`
            });
            return pass;
          }
        })
      }
    };

    try {
      const fn = new Function('pm', 'putman', 'gmy', 'gimay', 'console', `
        return (async () => {
          ${code}
        })();
      `);

      await fn(putmanContext, putmanContext, putmanContext, putmanContext, putmanConsole);
      addLog({ level: 'success', message: 'Execution completed successfully.' });
    } catch (e: any) {
      addLog({ level: 'error', message: `Execution runtime error: ${e.message}` });
      console.error(e);
    }
  }
}

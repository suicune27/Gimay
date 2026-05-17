import { RequestData, ResponseData } from '../types';
import { useScriptStore } from '../store/scriptStore';
import { useStore } from '../store/useStore';
import CryptoJS from 'crypto-js';
import axios from 'axios';

export class ScriptService {
  private static resolveImports(
    scriptText: string, 
    pm: any, 
    consoleMock: any, 
    visited: Set<string> = new Set()
  ): { strippedBody: string; params: string[]; args: any[] } {
    const importRegex = /import\s+(\w+)\s+from\s+(?:\(\s*['"]([^'"]+)['"]\s*\)|['"]([^'"]+)['"])/g;
    const importParams: string[] = [];
    const importArgs: any[] = [];
    
    // Lazy get scripts from Zustand store
    const libraryScripts = useScriptStore.getState().scripts || [];
    
    const strippedScript = scriptText.replace(importRegex, (match, varName, name1, name2) => {
      const scriptName = (name1 || name2).trim();
      importParams.push(varName);
      
      if (visited.has(scriptName.toLowerCase())) {
        consoleMock.error(`Import Error: Circular dependency detected for library script "${scriptName}".`);
        importArgs.push({});
        return '';
      }
      
      const libScript = libraryScripts.find(
        s => s.name.trim().toLowerCase() === scriptName.toLowerCase()
      );
      
      if (!libScript) {
        consoleMock.warn(`Import Warning: Library script "${scriptName}" not found.`);
        importArgs.push({});
        return '';
      }
      
      const newVisited = new Set(visited);
      newVisited.add(scriptName.toLowerCase());
      
      try {
        const exports: any = {};
        const module: any = { exports };
        
        const { strippedBody, params, args } = this.resolveImports(libScript.content, pm, consoleMock, newVisited);
        
        // Auto-export all top-level declarations to make user libraries state-of-the-art and easy to use
        const autoExports: string[] = [];
        const topLevelRegex = /(?:^|[\s;{}])(?:export\s+)?(?:async\s+)?function\s*\*?\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:^|[\s;{}])(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
        let match;
        const seenNames = new Set<string>();
        while ((match = topLevelRegex.exec(libScript.content)) !== null) {
          const name = match[1] || match[2];
          if (name && !seenNames.has(name) && name !== 'exports' && name !== 'module') {
            seenNames.add(name);
            autoExports.push(`
              if (typeof ${name} !== 'undefined') {
                if (!exports.${name}) exports.${name} = ${name};
                if (module.exports && !module.exports.${name}) module.exports.${name} = ${name};
              }
            `);
          }
        }
        const bodyWithAutoExports = strippedBody + '\n' + autoExports.join('\n');
        
        const libFn = new Function('pm', 'gmy', 'gimay', 'console', 'exports', 'module', 'CryptoJS', ...params, bodyWithAutoExports);
        const result = libFn(pm, pm, pm, consoleMock, exports, module, CryptoJS, ...args);
        
        const exportsResult = result !== undefined ? result : (module.exports !== exports ? module.exports : exports);
        importArgs.push(exportsResult);
      } catch (e: any) {
        consoleMock.error(`Import Error: Failed to execute library script "${scriptName}": ${e.message}`);
        importArgs.push({});
      }
      
      return '';
    });
    
    return {
      strippedBody: strippedScript,
      params: importParams,
      args: importArgs
    };
  }

  private static buildPmObject(request: any, context: any, response: ResponseData | null = null) {
    const pm: any = {
      _asyncTasks: [] as Promise<any>[],
      request: {
        url: request.url,
        method: request.method,
        headers: {
          get: (key: string) => {
            if (Array.isArray(request.headers)) {
              const found = request.headers.find(
                (h: any) => h && h.enabled !== false && String(h.key).toLowerCase() === String(key).toLowerCase()
              );
              return found ? found.value : undefined;
            } else if (request.headers && typeof request.headers === 'object') {
              const entry = Object.entries(request.headers).find(([k]) => k.toLowerCase() === key.toLowerCase());
              return entry ? entry[1] : undefined;
            }
            return undefined;
          }
        },
        body: {
          get raw() {
            if (request.body && typeof request.body === 'object') {
              return request.body.raw || '';
            }
            return typeof request.body === 'string' ? request.body : '';
          }
        }
      },
      environment: {
        get: (key: string) => context.variables?.[key],
        set: (key: string, value: any) => {
          if (context.variables) context.variables[key] = value;
          const store = useStore.getState();
          const activeEnv = store.environments.find(e => e.id === store.activeEnvId);
          if (activeEnv) {
            const envVars = [...activeEnv.variables];
            const idx = envVars.findIndex(v => v.key === key);
            if (idx !== -1) {
              envVars[idx] = { ...envVars[idx], value: String(value) };
            } else {
              envVars.push({
                id: Math.random().toString(36).substr(2, 9),
                key,
                value: String(value),
                type: 'string',
                enabled: true,
                active: true
              });
            }
            store.updateEnvironment(activeEnv.id, { variables: envVars });
          } else {
            const globals = [...store.globalVariables];
            const idx = globals.findIndex(v => v.key === key);
            if (idx !== -1) {
              globals[idx] = { ...globals[idx], value: String(value) };
            } else {
              globals.push({
                id: Math.random().toString(36).substr(2, 9),
                key,
                value: String(value),
                active: true
              });
            }
            store.setGlobalVariables(globals);
          }
        }
      },
      globals: {
        get: (key: string) => context.variables?.[key],
        set: (key: string, value: any) => pm.environment.set(key, value)
      },
      variables: {
        get: (key: string) => context.variables?.[key],
        set: (key: string, value: any) => pm.environment.set(key, value)
      },
      sendRequest: (reqOpt: any, callback: (err: any, res: any) => void) => {
        let options: any = {};
        if (typeof reqOpt === 'string') {
          options = { url: reqOpt, method: 'GET' };
        } else {
          options = { ...reqOpt };
        }
        
        const headers: Record<string, string> = {};
        if (options.header) {
          if (Array.isArray(options.header)) {
            options.header.forEach((h: any) => {
              if (h && h.key) headers[h.key] = h.value;
            });
          } else if (typeof options.header === 'object') {
            Object.assign(headers, options.header);
          }
        }
        if (options.headers) {
          if (Array.isArray(options.headers)) {
            options.headers.forEach((h: any) => {
              if (h && h.key) headers[h.key] = h.value;
            });
          } else if (typeof options.headers === 'object') {
            Object.assign(headers, options.headers);
          }
        }

        let data: any = undefined;
        if (options.body) {
          if (options.body.mode === 'urlencoded') {
            const params = new URLSearchParams();
            const list = options.body.urlencoded || [];
            list.forEach((item: any) => {
              if (item && item.key) params.append(item.key, item.value);
            });
            data = params.toString();
            if (!headers['Content-Type'] && !headers['content-type']) {
              headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
          } else if (options.body.mode === 'raw') {
            data = options.body.raw;
          } else if (typeof options.body === 'string') {
            data = options.body;
          }
        }

        const requestPromise = axios({
          url: options.url,
          method: options.method || 'GET',
          headers,
          data
        })
        .then((response) => {
          const resMock = {
            code: response.status,
            status: response.statusText,
            headers: {
              get: (key: string) => response.headers[key] || response.headers[key.toLowerCase()]
            },
            json: () => response.data,
            toString: () => typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data)
          };
          try { callback(null, resMock); } catch (e) { /* ignore */ }
        })
        .catch((error) => {
          if (error.response) {
            const resMock = {
              code: error.response.status,
              status: error.response.statusText,
              headers: {
                get: (key: string) => error.response.headers[key] || error.response.headers[key.toLowerCase()]
              },
              json: () => error.response.data,
              toString: () => typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : String(error.response.data)
            };
            try { callback(null, resMock); } catch (e) { /* ignore */ }
          } else {
            try { callback(error, null); } catch (e) { /* ignore */ }
          }
        });
        if (pm._asyncTasks) {
          pm._asyncTasks.push(requestPromise);
        }
      }
    };

    if (response) {
      pm.response = {
        code: response.status,
        status: response.statusText,
        headers: {
          get: (key: string) => response.headers[key] || response.headers[key.toLowerCase()]
        },
        responseTime: response.time,
        responseSize: response.size,
        json: () => {
           try {
             return typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
           } catch {
             return null;
           }
        }
      };
    }

    return pm;
  }

  static async executePreRequest(scripts: string | string[], request: any, context: any) {
    const scriptsToRun = Array.isArray(scripts) ? scripts : [scripts].filter(Boolean);
    const logs: { level: 'log' | 'info' | 'warn' | 'error'; args: any[]; timestamp: string }[] = [];

    const pm = this.buildPmObject(request, context);

    const consoleMock = {
      log: (...args: any[]) => logs.push({ level: 'log', args, timestamp: new Date().toISOString() }),
      info: (...args: any[]) => logs.push({ level: 'info', args, timestamp: new Date().toISOString() }),
      warn: (...args: any[]) => logs.push({ level: 'warn', args, timestamp: new Date().toISOString() }),
      error: (...args: any[]) => logs.push({ level: 'error', args, timestamp: new Date().toISOString() }),
    };

    for (const script of scriptsToRun) {
      if (!script) continue;
      try {
        const { strippedBody, params, args } = this.resolveImports(script, pm, consoleMock);
        const fn = new Function('pm', 'gmy', 'gimay', 'console', 'CryptoJS', ...params, strippedBody);
        fn(pm, pm, pm, consoleMock, CryptoJS, ...args);
        
        if (pm._asyncTasks) {
          let i = 0;
          while (i < pm._asyncTasks.length) {
            await pm._asyncTasks[i];
            i++;
          }
        }
      } catch (error: any) {
        consoleMock.error('Pre-request Script Error:', error.message);
      }
    }

    return { request, logs };
  }

  static async executeTests(scripts: string | string[], response: ResponseData, request: any, context: any) {
    const scriptsToRun = Array.isArray(scripts) ? scripts : [scripts].filter(Boolean);
    const results: { name: string; status: 'pass' | 'fail'; message?: string }[] = [];
    const logs: { level: 'log' | 'info' | 'warn' | 'error'; args: any[]; timestamp: string }[] = [];

    const pm = this.buildPmObject(request, context, response);

    pm.test = (name: string, fn: () => void) => {
      try {
        fn();
        results.push({ name, status: 'pass' });
      } catch (error: any) {
        results.push({ name, status: 'fail', message: error.message });
      }
    };

    pm.expect = (val: any) => {
      const assertion: any = {
        to: {
          equal: (expected: any) => {
            if (val !== expected) throw new Error(`Expected ${JSON.stringify(val)} to equal ${JSON.stringify(expected)}`);
            return assertion;
          },
          not: {
            equal: (expected: any) => {
              if (val === expected) throw new Error(`Expected ${JSON.stringify(val)} NOT to equal ${JSON.stringify(expected)}`);
              return assertion;
            },
            include: (item: any) => {
              if (Array.isArray(val) || typeof val === 'string') {
                 if (val.includes(item)) throw new Error(`Expected ${JSON.stringify(val)} NOT to include ${JSON.stringify(item)}`);
              }
              return assertion;
            }
          },
          be: {
            a: (type: string) => {
              if (typeof val !== type) throw new Error(`Expected value to be a ${type}, but got ${typeof val}`);
              return assertion;
            },
            an: (type: string) => assertion.to.be.a(type),
            below: (limit: number) => {
              if (val >= limit) throw new Error(`Expected ${val} to be below ${limit}`);
              return assertion;
            },
            above: (limit: number) => {
              if (val <= limit) throw new Error(`Expected ${val} to be above ${limit}`);
              return assertion;
            },
            true: () => {
              if (val !== true) throw new Error(`Expected ${val} to be true`);
              return assertion;
            },
            false: () => {
              if (val !== false) throw new Error(`Expected ${val} to be false`);
              return assertion;
            },
            null: () => {
              if (val !== null) throw new Error(`Expected ${val} to be null`);
              return assertion;
            }
          },
          include: (item: any) => {
            if (Array.isArray(val) || typeof val === 'string') {
              if (!val.includes(item)) throw new Error(`Expected ${JSON.stringify(val)} to include ${JSON.stringify(item)}`);
            } else if (val && typeof val === 'object') {
              if (!Object.keys(val).includes(item)) throw new Error(`Expected object to include key ${item}`);
            } else {
              throw new Error("Target is not include-compatible");
            }
            return assertion;
          },
          have: {
            property: (prop: string) => {
              if (!val || typeof val !== 'object' || !(prop in val)) {
                throw new Error(`Expected object to have property "${prop}"`);
              }
              return assertion;
            },
            status: (code: number) => {
              if (pm.response.code !== code) throw new Error(`Expected status ${code} but got ${pm.response.code}`);
              return assertion;
            }
          }
        }
      };
      return assertion;
    };

    const consoleMock = {
      log: (...args: any[]) => logs.push({ level: 'log', args, timestamp: new Date().toISOString() }),
      info: (...args: any[]) => logs.push({ level: 'info', args, timestamp: new Date().toISOString() }),
      warn: (...args: any[]) => logs.push({ level: 'warn', args, timestamp: new Date().toISOString() }),
      error: (...args: any[]) => logs.push({ level: 'error', args, timestamp: new Date().toISOString() }),
    };

    for (const script of scriptsToRun) {
      if (!script) continue;
      try {
        const { strippedBody, params, args } = this.resolveImports(script, pm, consoleMock);
        const fn = new Function('pm', 'gmy', 'gimay', 'console', 'CryptoJS', ...params, strippedBody);
        fn(pm, pm, pm, consoleMock, CryptoJS, ...args);

        if (pm._asyncTasks) {
          let i = 0;
          while (i < pm._asyncTasks.length) {
            await pm._asyncTasks[i];
            i++;
          }
        }
      } catch (error: any) {
        consoleMock.error('Test Script Error:', error.message);
      }
    }

    return { results, logs };
  }
}

import { RequestService } from './RequestService';
import { useScriptStore } from '../store/scriptStore';
import { useStore } from '../store/useStore';

export interface SandboxContext {
  variables: Record<string, any>;
  environmentVariables?: Record<string, any>;
  request?: {
    method: string;
    url: string;
    headers: any;
    body?: any;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    time: number;
    size: number;
    body: any;
  };
}

export interface SandboxResult {
  logs: Array<{ level: 'log' | 'info' | 'warn' | 'error' | 'success'; message: string; timestamp?: string }>;
  testResults: Array<{ name: string; status: 'pass' | 'fail'; message?: string }>;
  changedVariables: Record<string, any>;
  changedEnvironment?: Record<string, any>;
  changedRequest?: {
    method?: string;
    url?: string;
    headers?: Array<{ key: string; value: string; active?: boolean }>;
    body?: any;
  };
  error?: string;
}

const WORKER_SOURCE = `
  try {
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js');
  } catch (e) {
    // Fail silently if offline or blocked
  }

  let logs = [];
  let testResults = [];
  let changedVariables = {};
  let changedEnvironment = {};
  
  const consoleMock = {
    log: (...args) => {
      logs.push({ level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    },
    info: (...args) => {
      logs.push({ level: 'info', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    },
    warn: (...args) => {
      logs.push({ level: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    },
    error: (...args) => {
      logs.push({ level: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    }
  };

  self.onmessage = async (e) => {
    if (e.data && e.data.type === 'coordination_response') {
      return;
    }
    const { code, context } = e.data;
    if (!context) return;
    
    // Setup variables maps
    const vars = { ...context.variables || {} };
    const envVars = { ...context.environmentVariables || {} };
    
    const variableStore = {
      get: (key) => vars[key],
      set: (key, value) => {
        vars[key] = value;
        changedVariables[key] = value;
      },
      has: (key) => key in vars,
      unset: (key) => {
        delete vars[key];
        changedVariables[key] = null;
      },
      clear: () => {
        for (const k in vars) {
          changedVariables[k] = null;
        }
        Object.keys(vars).forEach(k => delete vars[k]);
      }
    };

    const environmentStore = {
      get: (key) => envVars[key],
      set: (key, value) => {
        envVars[key] = value;
        changedEnvironment[key] = value;
        vars[key] = value; // Sync to standard vars for active inline resolution inside scripts
      },
      has: (key) => key in envVars,
      unset: (key) => {
        delete envVars[key];
        changedEnvironment[key] = null;
        delete vars[key];
      },
      clear: () => {
        for (const k in envVars) {
          changedEnvironment[k] = null;
          delete vars[k];
        }
        Object.keys(envVars).forEach(k => delete envVars[k]);
      }
    };
    
    // coordination map for async requests
    let activeAsyncRequests = 0;
    let messageId = 0;
    const pendingResolvers = new Map();
    
    const sendToMain = (action, data) => {
      return new Promise((resolve, reject) => {
        const id = messageId++;
        pendingResolvers.set(id, { resolve, reject });
        self.postMessage({ type: 'coordination', action, id, data });
      });
    };
    
    self.addEventListener('message', (event) => {
      const { type, id, data, error } = event.data;
      if (type === 'coordination_response') {
        const resolver = pendingResolvers.get(id);
        if (resolver) {
          pendingResolvers.delete(id);
          if (error) resolver.reject(new Error(error));
          else resolver.resolve(data);
        }
      }
    });

    // Add request context properties to request function
    const requestHeaders = context.request?.headers || [];
    const headersMap = new Map();
    if (Array.isArray(requestHeaders)) {
      requestHeaders.forEach(h => {
        if (h && typeof h === 'object' && h.active !== false) {
          headersMap.set((h.key || '').toLowerCase(), h.value || '');
        }
      });
    } else if (requestHeaders && typeof requestHeaders === 'object') {
      Object.entries(requestHeaders).forEach(([k, v]) => {
        headersMap.set(k.toLowerCase(), String(v || ''));
      });
    }

    const requestFunc = async (opts) => {
      return await sendToMain('request', opts);
    };
    requestFunc.method = context.request?.method || 'GET';
    requestFunc.url = context.request?.url || '';
    requestFunc.body = {
      raw: typeof context.request?.body === 'object' ? JSON.stringify(context.request?.body) : String(context.request?.body || '')
    };
    requestFunc.headers = {
      get: (key) => headersMap.get(String(key || '').toLowerCase()) || '',
      add: (headerObj) => {
        if (headerObj && headerObj.key) {
           headersMap.set(String(headerObj.key).toLowerCase(), String(headerObj.value || ''));
        }
      },
      remove: (key) => {
        if (key) {
           headersMap.delete(String(key).toLowerCase());
        }
      },
      upsert: (headerObj) => {
        if (headerObj && headerObj.key) {
           headersMap.set(String(headerObj.key).toLowerCase(), String(headerObj.value || ''));
        }
      }
    };

    const gmy = {
      environment: environmentStore,
      collectionVariables: variableStore,
      globals: variableStore,
      variables: variableStore,
      request: requestFunc,
      sendRequest: (opts, callback) => {
        activeAsyncRequests++;
        sendToMain('request', opts)
          .then((res) => {
            const compatResponse = {
              code: res.status,
              status: res.statusText,
              headers: {
                get: (key) => res.headers?.[key] || res.headers?.[key.toLowerCase()]
              },
              json: () => {
                try {
                  return typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
                } catch (e) {
                  return null;
                }
              },
              text: () => typeof res.body === 'object' ? JSON.stringify(res.body) : String(res.body),
              toString: () => typeof res.body === 'object' ? JSON.stringify(res.body) : String(res.body)
            };
            try {
              if (callback) callback(null, compatResponse);
            } catch (err) {
              consoleMock.error("Callback error: " + err.message);
            } finally {
              activeAsyncRequests--;
            }
          })
          .catch((err) => {
            try {
              if (callback) callback(err, null);
            } catch (cbErr) {
              consoleMock.error("Callback error: " + cbErr.message);
            } finally {
              activeAsyncRequests--;
            }
          });
      },
      import: async (identifier) => {
        const scriptContent = await sendToMain('import', identifier);
        return async () => {
          await eval("(async () => {" + scriptContent + "})()");
        };
      },
      response: {
        code: context.response?.status,
        status: context.response?.statusText,
        headers: {
          get: (key) => context.response?.headers?.[key] || context.response?.headers?.[key.toLowerCase()]
        },
        responseTime: context.response?.time,
        responseSize: context.response?.size,
        json: () => {
          try {
            return typeof context.response?.body === 'string' ? JSON.parse(context.response?.body) : context.response?.body;
          } catch (e) {
            return null;
          }
        }
      },
      test: (name, fn) => {
        try {
          const res = fn();
          if (res instanceof Promise) {
            testResults.push(res.then(() => ({ name, status: 'pass' })).catch(err => ({ name, status: 'fail', message: err.message })));
          } else {
            testResults.push({ name, status: 'pass' });
          }
        } catch (error) {
          testResults.push({ name, status: 'fail', message: error.message });
        }
      },
      expect: (val) => {
        const assertion = {
          to: {
            equal: (expected) => {
              if (val !== expected) throw new Error("Expected " + JSON.stringify(val) + " to equal " + JSON.stringify(expected));
              return assertion;
            },
            not: {
              equal: (expected) => {
                if (val === expected) throw new Error("Expected " + JSON.stringify(val) + " NOT to equal " + JSON.stringify(expected));
                return assertion;
              },
              include: (item) => {
                if ((Array.isArray(val) || typeof val === 'string') && val.includes(item)) {
                  throw new Error("Expected " + JSON.stringify(val) + " NOT to include " + JSON.stringify(item));
                }
                return assertion;
              }
            },
            be: {
              a: (type) => {
                if (typeof val !== type) throw new Error("Expected value to be a " + type + ", but got " + typeof val);
                return assertion;
              },
              an: (type) => assertion.to.be.a(type),
              below: (limit) => {
                if (val >= limit) throw new Error("Expected " + val + " to be below " + limit);
                return assertion;
              },
              above: (limit) => {
                if (val <= limit) throw new Error("Expected " + val + " to be above " + limit);
                return assertion;
              },
              true: () => {
                if (val !== true) throw new Error("Expected " + val + " to be true");
                return assertion;
              },
              false: () => {
                if (val !== false) throw new Error("Expected " + val + " to be false");
                return assertion;
              },
              null: () => {
                if (val !== null) throw new Error("Expected " + val + " to be null");
                return assertion;
              }
            },
            include: (item) => {
              if (Array.isArray(val) || typeof val === 'string') {
                if (!val.includes(item)) throw new Error("Expected " + JSON.stringify(val) + " to include " + JSON.stringify(item));
              } else if (val && typeof val === 'object') {
                if (!Object.keys(val).includes(item)) throw new Error("Expected object to include key " + item);
              } else {
                throw new Error("Target is not include-compatible");
              }
              return assertion;
            },
            have: {
              property: (prop) => {
                if (!val || typeof val !== 'object' || !(prop in val)) {
                  throw new Error("Expected object to have property \\"" + prop + "\\"");
                }
                return assertion;
              },
              status: (code) => {
                if (gmy.response.code !== code) throw new Error("Expected status " + code + " but got " + gmy.response.code);
                return assertion;
              }
            }
          }
        };
        return assertion;
      }
    };
    
    // Compat aliases
    const pm = gmy;
    const gimay = gmy;
    const putman = gmy;
    const console = consoleMock;
    
    class Script {
      constructor(name) {
        this.name = name;
      }
      async Run() {
        const scriptContent = await sendToMain('import', this.name);
        let processedContent = scriptContent || '';
        processedContent = processedContent.replace(/new\\s*\\(\\s*(['"\`])(.*?)\\1\\s*\\)/g, 'new Script("$2")');
        await eval("(async () => {" + processedContent + "})()");
      }
    }
    
    try {
      let processedCode = code || '';
      processedCode = processedCode.replace(/new\\s*\\(\\s*(['"\`])(.*?)\\1\\s*\\)/g, 'new Script("$2")');
      const asyncScript = \`(async () => {
        \${processedCode}
      })()\`;
      
      await eval(asyncScript);
      
      // Wait for any async callbacks or pending gmy.sendRequest calls
      let waitTime = 0;
      while (activeAsyncRequests > 0 && waitTime < 10000) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        waitTime += 50;
      }
      
      // Resolve any async tests
      const resolvedTests = [];
      for (const t of testResults) {
        if (t instanceof Promise) {
          resolvedTests.push(await t);
        } else {
          resolvedTests.push(t);
        }
      }
      
      self.postMessage({
        type: 'result',
        logs,
        testResults: resolvedTests,
        changedVariables,
        changedEnvironment,
        changedRequest: {
          method: requestFunc.method,
          url: requestFunc.url,
          body: requestFunc.body.raw,
          headers: Array.from(headersMap.entries()).map(([k, v]) => ({ key: k, value: v, active: true }))
        }
      });
    } catch (e) {
      logs.push({ level: 'error', message: e.message });
      self.postMessage({
        type: 'result',
        logs,
        testResults: [],
        changedVariables,
        changedEnvironment,
        changedRequest: {
          method: requestFunc.method,
          url: requestFunc.url,
          body: requestFunc.body.raw,
          headers: Array.from(headersMap.entries()).map(([k, v]) => ({ key: k, value: v, active: true }))
        },
        error: e.message
      });
    }
  };
`;

let cachedWorkerUrl: string | null = null;

export class SandboxRunner {
  static run(code: string, context: SandboxContext, timeoutMs = 5000): Promise<SandboxResult> {
    return new Promise((resolve) => {
      // Cache the worker blob URL to avoid multiple URL allocations and prevent severe memory leaks
      if (!cachedWorkerUrl) {
        const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
        cachedWorkerUrl = URL.createObjectURL(blob);
      }
      const worker = new Worker(cachedWorkerUrl);
      
      let resolved = false;
      
      // 2. Set up timeout safety
      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        worker.terminate();
        resolve({
          logs: [{ level: 'error', message: `Execution timed out after ${timeoutMs}ms.` }],
          testResults: [],
          changedVariables: {},
          error: `Timeout: Execution exceeded ${timeoutMs}ms limit.`
        });
      }, timeoutMs);
      
      const cleanUp = () => {
        clearTimeout(timer);
        worker.terminate();
      };

      // 3. Set up communication channel
      worker.onmessage = async (e) => {
        const { type, action, id, data, logs, testResults, changedVariables, changedEnvironment, changedRequest, error } = e.data;
        
        if (type === 'coordination') {
          if (action === 'request') {
            try {
              const requestOpts = typeof data === 'string' ? { url: data, method: 'GET' } : { ...data };
              
              // 1. Postman compatibility: map singular 'header' object to 'headers' array
              if (requestOpts.header && typeof requestOpts.header === 'object') {
                requestOpts.headers = Object.entries(requestOpts.header).map(([key, value]) => ({
                  key,
                  value: String(value),
                  active: true
                }));
              }
              
              // 2. Postman compatibility: map body.mode or body.type to flat bodyType
              if (requestOpts.body && typeof requestOpts.body === 'object') {
                const mode = requestOpts.body.mode || requestOpts.body.type || 'raw';
                requestOpts.bodyType = mode;
                
                // Ensure items are active by default unless explicitly disabled
                if (mode === 'urlencoded' && Array.isArray(requestOpts.body.urlencoded)) {
                  requestOpts.body.urlencoded = requestOpts.body.urlencoded.map((item: any) => ({
                    ...item,
                    active: item.active !== false
                  }));
                }
                if (mode === 'form-data' && Array.isArray(requestOpts.body.formData)) {
                  requestOpts.body.formData = requestOpts.body.formData.map((item: any) => ({
                    ...item,
                    active: item.active !== false
                  }));
                }
              }

              if (requestOpts.data !== undefined && requestOpts.body === undefined) {
                requestOpts.body = requestOpts.data;
                requestOpts.bodyType = requestOpts.bodyType || 'raw';
              }
              if (typeof requestOpts.body === 'string' && !requestOpts.bodyType) {
                requestOpts.bodyType = 'raw';
              }
              const state = useStore.getState();
              const response = await RequestService.execute(
                requestOpts as any,
                {
                  collections: state.collections || [],
                  environments: state.environments || [],
                  activeEnvId: state.activeEnvId,
                  variables: {}
                } as any
              );
              worker.postMessage({
                type: 'coordination_response',
                id,
                data: {
                  status: response.status,
                  statusText: response.statusText,
                  body: response.body,
                  headers: response.headers
                }
              });
            } catch (err: any) {
              worker.postMessage({
                type: 'coordination_response',
                id,
                error: err.message
              });
            }
          } else if (action === 'import') {
            try {
              const allScripts = useScriptStore.getState().scripts;
              const target = allScripts.find(s => s.id === data || s.name === data);
              if (!target) {
                worker.postMessage({
                  type: 'coordination_response',
                  id,
                  error: `Script "${data}" not found.`
                });
              } else {
                worker.postMessage({
                  type: 'coordination_response',
                  id,
                  data: target.content
                });
              }
            } catch (err: any) {
              worker.postMessage({
                type: 'coordination_response',
                id,
                error: err.message
              });
            }
          }
        } else if (type === 'result') {
          if (resolved) return;
          resolved = true;
          cleanUp();
          resolve({
            logs: logs || [],
            testResults: testResults || [],
            changedVariables: changedVariables || {},
            changedEnvironment: changedEnvironment || {},
            changedRequest,
            error
          });
        }
      };

      // 4. Start execution
      worker.postMessage({
        code,
        context
      });
    });
  }
}

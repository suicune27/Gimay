import { RequestService } from './RequestService';
import { useScriptStore } from '../store/scriptStore';
import { useStore } from '../store/useStore';
import CryptoJS from 'crypto-js';

export interface SandboxContext {
  variables: Record<string, any>;
  environmentVariables?: Record<string, any>;
  signal?: AbortSignal;
  captureLogs?: boolean;
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
  
  let shouldCaptureLogs = true;

  const consoleMock = {
    log: (...args) => {
      if (!shouldCaptureLogs) return;
      logs.push({ level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    },
    info: (...args) => {
      if (!shouldCaptureLogs) return;
      logs.push({ level: 'info', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    },
    warn: (...args) => {
      if (!shouldCaptureLogs) return;
      logs.push({ level: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    },
    error: (...args) => {
      if (!shouldCaptureLogs) return;
      logs.push({ level: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
    }
  };

  let currentScriptState = null;

  self.onmessage = async (e) => {
    if (!e.data) return;
    let { type, code, context, id, data, error, runtimeId } = e.data;
    
    if (type === 'coordination_response') {
      const respRuntimeId = e.data.runtimeId;
      if (respRuntimeId && currentScriptState && currentScriptState.activeRuntimeId !== respRuntimeId) {
        return; // Ignore stale responses
      }
      if (currentScriptState) {
        currentScriptState.handleCoordination(id, data, error);
      }
      return;
    }
    
    if (type === 'ping') {
      self.postMessage({ type: 'pong' });
      return;
    }

    if (!context) return;
    
    // Reset global state for this execution run
    logs = [];
    testResults = [];
    changedVariables = {};
    changedEnvironment = {};
    
    shouldCaptureLogs = context.captureLogs !== false;

    // Setup variables maps
    let vars = { ...context.variables || {} };
    let envVars = { ...context.environmentVariables || {} };
    
    let variableStore = {
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

    let environmentStore = {
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
    let pendingResolvers = new Map();
    
    let sendToMain = (action, actionData) => {
      return new Promise((resolve, reject) => {
        const msgId = messageId++;
        pendingResolvers.set(msgId, { resolve, reject });
        self.postMessage({ type: 'coordination', action, id: msgId, data: actionData, runtimeId });
      });
    };
    
    currentScriptState = {
      activeRuntimeId: runtimeId,
      handleCoordination: (msgId, msgData, msgError) => {
        const resolver = pendingResolvers.get(msgId);
        if (resolver) {
          pendingResolvers.delete(msgId);
          if (msgError) resolver.reject(new Error(msgError));
          else resolver.resolve(msgData);
        }
      }
    };

    // Add request context properties to request function
    let requestHeaders = context.request?.headers || [];
    let headersMap = new Map();
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

    let requestFunc = async (opts) => {
      return await sendToMain('request', opts);
    };
    requestFunc.method = context.request?.method || 'GET';
    requestFunc.url = context.request?.url || '';
    const requestBody = context.request?.body;
    requestFunc.body = {
      // Avoid serializing the entire RequestBody object. Only expose the raw content to scripts.
      raw: typeof requestBody === 'object' && requestBody !== null
        ? String((requestBody as any).content || '')
        : String(requestBody || '')
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

    let gmy = {
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
    let pm = gmy;
    let gimay = gmy;
    let putman = gmy;
    let console = consoleMock;
    
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
        runtimeId,
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
        runtimeId,
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
    } finally {
      currentScriptState = null;
      logs = [];
      testResults = [];
      changedVariables = {};
      changedEnvironment = {};
      if (pendingResolvers) {
        pendingResolvers.clear();
        pendingResolvers = null;
      }
      vars = null;
      envVars = null;
      variableStore = null;
      environmentStore = null;
      sendToMain = null;
      requestHeaders = null;
      if (headersMap) {
        headersMap.clear();
        headersMap = null;
      }
      requestFunc = null;
      gmy = null;
      pm = null;
      gimay = null;
      putman = null;
      console = null;
      context = null;
    }
  };
`;

let cachedWorkerUrl: string | null = null;

class WorkerPool {
  private static pool: Worker[] = [];
  private static active: Set<Worker> = new Set();
  private static MAX_POOL_SIZE = 8;

  static acquire(): Worker {
    let worker: Worker;
    if (this.pool.length > 0) {
      worker = this.pool.pop()!;
      (worker as any).useCount = ((worker as any).useCount || 0) + 1;
    } else {
      if (!cachedWorkerUrl) {
        const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
        cachedWorkerUrl = URL.createObjectURL(blob);
      }
      worker = new Worker(cachedWorkerUrl);
      (worker as any).useCount = 1;
    }
    this.active.add(worker);
    return worker;
  }

  static release(worker: Worker) {
    this.active.delete(worker);
    delete (worker as any).onTerminate;
    worker.onerror = null;
    worker.onmessage = null;
    
    const count = (worker as any).useCount || 0;
    // Limit reuse to 100 executions to prevent long-term V8 eval code cache leaks in Web Workers
    if (count < 100 && this.pool.length < this.MAX_POOL_SIZE) {
      this.pool.push(worker);
    } else {
      try {
        worker.terminate();
      } catch {}
    }
  }

  static terminateWorker(worker: Worker) {
    this.active.delete(worker);
    delete (worker as any).onTerminate;
    worker.onerror = null;
    worker.onmessage = null;
    try {
      worker.terminate();
    } catch {}
  }

  static clear() {
    // Preserve idle pool workers across run boundaries — terminating them and creating fresh ones
    // causes a double-heap window (old workers not yet GC'd + new workers allocated) that triggers OOM
    // on run 2. Pool workers have no onmessage handler and consume negligible memory while idle.
    // Only terminate ACTIVE workers (in-flight script executions) so their SandboxRunner promises resolve.
    const activeCopy = Array.from(this.active);
    activeCopy.forEach(worker => {
      if (typeof (worker as any).onTerminate === 'function') {
        try {
          (worker as any).onTerminate();
        } catch {}
      } else {
        try {
          worker.terminate();
        } catch {}
      }
    });
    this.active.clear();

    // To prevent substantial slowdown and parser/JIT bytecode compilation misses on subsequent runs,
    // we preserve cachedWorkerUrl and do not revoke it here. This allows the compiled
    // worker instance cache to survive across test runs for instantaneous startup.
  }
}

export class SandboxRunner {
  static clearWorkerPool() {
    WorkerPool.clear();
  }

  static async runInThread(code: string, context: SandboxContext, timeoutMs = 5000): Promise<SandboxResult> {
    return new Promise<SandboxResult>(async (resolve) => {
      let resolved = false;
      let timer: any = null;

      const logs: Array<{ level: 'log' | 'info' | 'warn' | 'error' | 'success'; message: string; timestamp?: string }> = [];
      const testResults: any[] = [];
      const changedVariables: Record<string, any> = {};
      const changedEnvironment: Record<string, any> = {};

      const shouldCaptureLogs = context.captureLogs !== false;

      const consoleMock = {
        log: (...args: any[]) => {
          if (!shouldCaptureLogs) return;
          logs.push({ level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
        },
        info: (...args: any[]) => {
          if (!shouldCaptureLogs) return;
          logs.push({ level: 'info', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
        },
        warn: (...args: any[]) => {
          if (!shouldCaptureLogs) return;
          logs.push({ level: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
        },
        error: (...args: any[]) => {
          if (!shouldCaptureLogs) return;
          logs.push({ level: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') });
        }
      };

      const cleanUpAndResolve = (result: SandboxResult) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(result);
      };

      timer = setTimeout(() => {
        cleanUpAndResolve({
          logs: [...logs, { level: 'error', message: `Execution timed out after ${timeoutMs}ms.` }],
          testResults: [],
          changedVariables: {},
          error: `Timeout: Execution exceeded ${timeoutMs}ms limit.`
        });
      }, timeoutMs);

      try {
        const vars = { ...context.variables || {} };
        const envVars = { ...context.environmentVariables || {} };

        const variableStore = {
          get: (key: string) => vars[key],
          set: (key: string, value: any) => {
            vars[key] = value;
            changedVariables[key] = value;
          },
          has: (key: string) => key in vars,
          unset: (key: string) => {
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
          get: (key: string) => envVars[key],
          set: (key: string, value: any) => {
            envVars[key] = value;
            changedEnvironment[key] = value;
            vars[key] = value;
          },
          has: (key: string) => key in envVars,
          unset: (key: string) => {
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

        const requestHeaders = context.request?.headers || [];
        const headersMap = new Map<string, string>();
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

        let activeAsyncRequests = 0;

        const requestFunc: any = async (opts: any) => {
          return await RequestService.execute(opts, {
            collections: useStore.getState().collections || [],
            environments: useStore.getState().environments || [],
            activeEnvId: useStore.getState().activeEnvId,
            variables: {}
          } as any);
        };

        requestFunc.method = context.request?.method || 'GET';
        requestFunc.url = context.request?.url || '';
        const requestBody = context.request?.body;
        requestFunc.body = {
          // Avoid serializing the entire RequestBody object. Only expose the raw content to scripts.
          raw: typeof requestBody === 'object' && requestBody !== null
            ? String((requestBody as any).content || '')
            : String(requestBody || '')
        };
        requestFunc.headers = {
          get: (key: string) => headersMap.get(String(key || '').toLowerCase()) || '',
          add: (headerObj: any) => {
            if (headerObj && headerObj.key) {
               headersMap.set(String(headerObj.key).toLowerCase(), String(headerObj.value || ''));
            }
          },
          remove: (key: string) => {
            if (key) {
               headersMap.delete(String(key).toLowerCase());
            }
          },
          upsert: (headerObj: any) => {
            if (headerObj && headerObj.key) {
               headersMap.set(String(headerObj.key).toLowerCase(), String(headerObj.value || ''));
            }
          }
        };

        const gmy: any = {
          environment: environmentStore,
          collectionVariables: variableStore,
          globals: variableStore,
          variables: variableStore,
          request: requestFunc,
          sendRequest: (opts: any, callback: any) => {
            activeAsyncRequests++;
            const requestOpts = typeof opts === 'string' ? { url: opts, method: 'GET' } : { ...opts };
            RequestService.execute(requestOpts as any, {
              collections: useStore.getState().collections || [],
              environments: useStore.getState().environments || [],
              activeEnvId: useStore.getState().activeEnvId,
              variables: {}
            } as any)
            .then((res: any) => {
              const compatResponse = {
                code: res.status,
                status: res.statusText,
                headers: {
                  get: (key: string) => res.headers?.[key] || res.headers?.[key.toLowerCase()]
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
              } catch (err: any) {
                consoleMock.error("Callback error: " + err.message);
              } finally {
                activeAsyncRequests--;
              }
            })
            .catch((err: any) => {
              try {
                if (callback) callback(err, null);
              } catch (cbErr: any) {
                consoleMock.error("Callback error: " + cbErr.message);
              } finally {
                activeAsyncRequests--;
              }
            });
          },
          import: async (identifier: string) => {
            const allScripts = useScriptStore.getState().scripts;
            const target = allScripts.find(s => s.id === identifier || s.name === identifier);
            if (!target) {
              throw new Error(`Script "${identifier}" not found.`);
            }
            return async () => {
              let processedContent = target.content || '';
              processedContent = processedContent.replace(/new\s*\(\s*(['"`])(.*?)\1\s*\)/g, 'new Script("$2")');
              const fn = new Function('gmy', 'pm', 'gimay', 'putman', 'console', 'Script', 'CryptoJS', `
                return (async () => {
                  ${processedContent}
                })();
              `);
              await fn(gmy, pm, gimay, putman, consoleMock, Script, typeof CryptoJS !== 'undefined' ? CryptoJS : undefined);
            };
          },
          response: {
            code: context.response?.status,
            status: context.response?.statusText,
            headers: {
              get: (key: string) => context.response?.headers?.[key] || context.response?.headers?.[key.toLowerCase()]
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
          test: (name: string, fn: any) => {
            try {
              const res = fn();
              if (res instanceof Promise) {
                testResults.push(res.then(() => ({ name, status: 'pass' })).catch(err => ({ name, status: 'fail', message: err.message })));
              } else {
                testResults.push({ name, status: 'pass' });
              }
            } catch (error: any) {
              testResults.push({ name, status: 'fail', message: error.message });
            }
          },
          expect: (val: any) => {
            const assertion: any = {
              to: {
                equal: (expected: any) => {
                  if (val !== expected) throw new Error("Expected " + JSON.stringify(val) + " to equal " + JSON.stringify(expected));
                  return assertion;
                },
                not: {
                  equal: (expected: any) => {
                    if (val === expected) throw new Error("Expected " + JSON.stringify(val) + " NOT to equal " + JSON.stringify(expected));
                    return assertion;
                  },
                  include: (item: any) => {
                    if ((Array.isArray(val) || typeof val === 'string') && val.includes(item)) {
                      throw new Error("Expected " + JSON.stringify(val) + " NOT to include " + JSON.stringify(item));
                    }
                    return assertion;
                  }
                },
                be: {
                  a: (type: string) => {
                    if (typeof val !== type) throw new Error("Expected value to be a " + type + ", but got " + typeof val);
                    return assertion;
                  },
                  an: (type: string) => assertion.to.be.a(type),
                  below: (limit: number) => {
                    if (val >= limit) throw new Error("Expected " + val + " to be below " + limit);
                    return assertion;
                  },
                  above: (limit: number) => {
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
                include: (item: any) => {
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
                  property: (prop: string) => {
                    if (!val || typeof val !== 'object' || !(prop in val)) {
                      throw new Error("Expected object to have property \"" + prop + "\"");
                    }
                    return assertion;
                  },
                  status: (code: number) => {
                    if (gmy.response.code !== code) throw new Error("Expected status " + code + " but got " + gmy.response.code);
                    return assertion;
                  }
                }
              }
            };
            return assertion;
          }
        };

        const pm = gmy;
        const gimay = gmy;
        const putman = gmy;
        const console = consoleMock;

        class Script {
          public name: string;
          constructor(name: string) {
            this.name = name;
          }
          async Run() {
            const allScripts = useScriptStore.getState().scripts;
            const target = allScripts.find(s => s.id === this.name || s.name === this.name);
            if (!target) throw new Error(`Script "${this.name}" not found.`);
            let processedContent = target.content || '';
            processedContent = processedContent.replace(/new\s*\(\s*(['"`])(.*?)\1\s*\)/g, 'new Script("$2")');
            
            const fn = new Function('gmy', 'pm', 'gimay', 'putman', 'console', 'Script', 'CryptoJS', `
              return (async () => {
                ${processedContent}
              })();
            `);
            await fn(gmy, pm, gimay, putman, consoleMock, Script, typeof CryptoJS !== 'undefined' ? CryptoJS : undefined);
          }
        }

        let processedCode = code || '';
        processedCode = processedCode.replace(/new\s*\(\s*(['"`])(.*?)\1\s*\)/g, 'new Script("$2")');
        
        const fn = new Function('gmy', 'pm', 'gimay', 'putman', 'console', 'Script', 'CryptoJS', `
          return (async () => {
            ${processedCode}
          })();
        `);

        await fn(gmy, pm, gimay, putman, consoleMock, Script, typeof CryptoJS !== 'undefined' ? CryptoJS : undefined);

        // Wait for any async callbacks or pending gmy.sendRequest calls
        let waitTime = 0;
        while (activeAsyncRequests > 0 && waitTime < timeoutMs) {
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

        cleanUpAndResolve({
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

      } catch (e: any) {
        logs.push({ level: 'error', message: e.message });
        cleanUpAndResolve({
          logs,
          testResults: [],
          changedVariables,
          changedEnvironment,
          error: e.message
        });
      }
    });
  }

  static run(code: string, context: SandboxContext, timeoutMs = 5000, useWorker = false): Promise<SandboxResult> {
    if (!useWorker) {
      return this.runInThread(code, context, timeoutMs);
    }
    return new Promise<SandboxResult>((resolve) => {
      const worker = WorkerPool.acquire();
      const runtimeId = Math.random().toString(36).substring(2, 15);
      (worker as any).activeRuntimeId = runtimeId;
      
      let resolved = false;
      let timer: any = null;

      const onAbort = () => {
        cleanUpAndResolve({
          logs: [{ level: 'error', message: 'Execution aborted by user.' }],
          testResults: [],
          changedVariables: {},
          error: 'Aborted: Execution aborted by user.'
        }, true);
      };

      const cleanUpAndResolve = (result: SandboxResult, forceTerminate = false) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        delete (worker as any).onTerminate;
        
        if (context.signal) {
          context.signal.removeEventListener('abort', onAbort);
        }
        
        if (forceTerminate) {
          WorkerPool.terminateWorker(worker);
        } else {
          WorkerPool.release(worker);
        }
        resolve(result);
      };

      if (context.signal) {
        if (context.signal.aborted) {
          onAbort();
          return;
        }
        context.signal.addEventListener('abort', onAbort);
      }

      (worker as any).onTerminate = () => {
        cleanUpAndResolve({
          logs: [{ level: 'error', message: 'Sandbox Worker terminated during memory tuning or abort.' }],
          testResults: [],
          changedVariables: {},
          error: 'Execution terminated'
        }, true);
      };

      // Set up timeout safety
      timer = setTimeout(() => {
        cleanUpAndResolve({
          logs: [{ level: 'error', message: `Execution timed out after ${timeoutMs}ms.` }],
          testResults: [],
          changedVariables: {},
          error: `Timeout: Execution exceeded ${timeoutMs}ms limit.`
        }, true);
      }, timeoutMs);

      const safePostMessage = (msg: any) => {
        try {
          worker.postMessage(msg);
        } catch (postErr) {
          console.warn('[SandboxRunner] safePostMessage discarded message. Worker might be terminated.', postErr);
        }
      };

      // Register error handler
      worker.onerror = (errEvent) => {
        cleanUpAndResolve({
          logs: [{ level: 'error', message: `Sandbox Worker Error: ${errEvent.message || 'Unknown'}` }],
          testResults: [],
          changedVariables: {},
          error: errEvent.message || 'Worker runtime error'
        }, true);
      };

      // Set up communication channel
      worker.onmessage = async (e) => {
        const { type, action, id, data, logs, testResults, changedVariables, changedEnvironment, changedRequest, error, runtimeId: msgRuntimeId } = e.data;
        
        // Isolate stale execution events to prevent race-condition pollution of current run or subsequent suites
        if (msgRuntimeId && msgRuntimeId !== runtimeId) {
          return;
        }
        
        if (type === 'coordination') {
          if (action === 'request') {
            try {
              const requestOpts = typeof data === 'string' ? { url: data, method: 'GET' } : { ...data };
              
              if (requestOpts.header && typeof requestOpts.header === 'object') {
                requestOpts.headers = Object.entries(requestOpts.header).map(([key, value]) => ({
                  key,
                  value: String(value),
                  active: true
                }));
              }
              
              if (requestOpts.body && typeof requestOpts.body === 'object') {
                const mode = requestOpts.body.mode || requestOpts.body.type || 'raw';
                requestOpts.bodyType = mode;
                
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
                  variables: {},
                  signal: context.signal
                } as any
              );
              
              // Validate that worker is still dedicated to this run session before posting back response
              if ((worker as any).activeRuntimeId !== runtimeId) {
                return;
              }
              safePostMessage({
                type: 'coordination_response',
                id,
                runtimeId,
                data: {
                  status: response.status,
                  statusText: response.statusText,
                  body: response.body,
                  headers: response.headers
                }
              });
            } catch (err: any) {
              if ((worker as any).activeRuntimeId !== runtimeId) {
                return;
              }
              safePostMessage({
                type: 'coordination_response',
                id,
                runtimeId,
                error: err.message
              });
            }
          } else if (action === 'import') {
            try {
              const allScripts = useScriptStore.getState().scripts;
              const target = allScripts.find(s => s.id === data || s.name === data);
              if ((worker as any).activeRuntimeId !== runtimeId) {
                return;
              }
              if (!target) {
                safePostMessage({
                  type: 'coordination_response',
                  id,
                  runtimeId,
                  error: `Script "${data}" not found.`
                });
              } else {
                safePostMessage({
                  type: 'coordination_response',
                  id,
                  runtimeId,
                  data: target.content
                });
              }
            } catch (err: any) {
              if ((worker as any).activeRuntimeId !== runtimeId) {
                return;
              }
              safePostMessage({
                type: 'coordination_response',
                id,
                runtimeId,
                error: err.message
              });
            }
          }
        } else if (type === 'result') {
          cleanUpAndResolve({
            logs: logs || [],
            testResults: testResults || [],
            changedVariables: changedVariables || {},
            changedEnvironment: changedEnvironment || {},
            changedRequest,
            error
          }, false);
        }
      };

      // Start execution with session run runtimeId
      safePostMessage({
        code,
        context: {
          ...context,
          signal: undefined
        },
        runtimeId
      });
    });
  }
}

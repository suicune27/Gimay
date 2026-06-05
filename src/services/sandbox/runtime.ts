import { RequestService } from '../RequestService';
import { useScriptStore } from '../../store/scriptStore';
import { useStore } from '../../store/useStore';
import CryptoJS from 'crypto-js';
import type { SandboxContext, SandboxResult, LogEntry, TestEntry } from './types';

export function createConsoleMock(logs: LogEntry[]) {
  return {
    log: (...args: any[]) => { logs.push({ level: 'log', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }); },
    info: (...args: any[]) => { logs.push({ level: 'info', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }); },
    warn: (...args: any[]) => { logs.push({ level: 'warn', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }); },
    error: (...args: any[]) => { logs.push({ level: 'error', message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }); }
  };
}

export function createVariableStore(vars: Record<string, any>, changedVariables: Record<string, any>) {
  return {
    get: (key: string) => vars[key],
    set: (key: string, value: any) => { vars[key] = value; changedVariables[key] = value; },
    has: (key: string) => key in vars,
    unset: (key: string) => { delete vars[key]; changedVariables[key] = null; },
    clear: () => {
      for (const k in vars) { changedVariables[k] = null; }
      Object.keys(vars).forEach(k => delete vars[k]);
    }
  };
}

export function createEnvironmentStore(vars: Record<string, any>, envVars: Record<string, any>, changedEnvironment: Record<string, any>) {
  return {
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
      for (const k in envVars) { changedEnvironment[k] = null; delete vars[k]; }
      Object.keys(envVars).forEach(k => delete envVars[k]);
    }
  };
}

export function buildHeadersMap(requestHeaders: any): Map<string, string> {
  const headersMap = new Map<string, string>();
  if (Array.isArray(requestHeaders)) {
    requestHeaders.forEach((h: any) => {
      if (h && typeof h === 'object' && h.active !== false) {
        headersMap.set((h.key || '').toLowerCase(), h.value || '');
      }
    });
  } else if (requestHeaders && typeof requestHeaders === 'object') {
    Object.entries(requestHeaders).forEach(([k, v]) => {
      headersMap.set(k.toLowerCase(), String(v || ''));
    });
  }
  return headersMap;
}

export function createRequestFunction(context: SandboxContext, headersMap: Map<string, string>) {
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
  requestFunc.body = {
    raw: typeof context.request?.body === 'object' ? JSON.stringify(context.request?.body) : String(context.request?.body || '')
  };
  requestFunc.headers = {
    get: (key: string) => headersMap.get(String(key || '').toLowerCase()) || '',
    add: (headerObj: any) => { if (headerObj && headerObj.key) headersMap.set(String(headerObj.key).toLowerCase(), String(headerObj.value || '')); },
    remove: (key: string) => { if (key) headersMap.delete(String(key).toLowerCase()); },
    upsert: (headerObj: any) => { if (headerObj && headerObj.key) headersMap.set(String(headerObj.key).toLowerCase(), String(headerObj.value || '')); }
  };

  return requestFunc;
}

export function createGmyObject(
  context: SandboxContext,
  requestFunc: any,
  headersMap: Map<string, string>,
  variableStore: any,
  environmentStore: any,
  logs: LogEntry[],
  testResults: any[],
  activeAsyncRequests: { current: number },
  consoleMock: any,
  ScriptClass: any
) {
  const gmy: any = {
    environment: environmentStore,
    collectionVariables: variableStore,
    globals: variableStore,
    variables: variableStore,
    request: requestFunc,
    sendRequest: (opts: any, callback: any) => {
      activeAsyncRequests.current++;
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
          headers: { get: (key: string) => res.headers?.[key] || res.headers?.[key.toLowerCase()] },
          json: () => { try { return typeof res.body === 'string' ? JSON.parse(res.body) : res.body; } catch { return null; } },
          text: () => typeof res.body === 'object' ? JSON.stringify(res.body) : String(res.body),
          toString: () => typeof res.body === 'object' ? JSON.stringify(res.body) : String(res.body)
        };
        try { if (callback) callback(null, compatResponse); } catch (err: any) { logs.push({ level: 'error', message: `Callback error: ${err.message}` }); }
        finally { activeAsyncRequests.current--; }
      })
      .catch((err: any) => {
        try { if (callback) callback(err, null); } catch (cbErr: any) { logs.push({ level: 'error', message: `Callback error: ${cbErr.message}` }); }
        finally { activeAsyncRequests.current--; }
      });
    },
    import: async (identifier: string) => {
      const allScripts = useScriptStore.getState().scripts;
      const target = allScripts.find(s => s.id === identifier || s.name === identifier);
      if (!target) throw new Error(`Script "${identifier}" not found.`);
      return async () => {
        let processedContent = target.content || '';
        processedContent = processedContent.replace(/new\s*\(\s*(['"`])(.*?)\1\s*\)/g, 'new Script("$2")');
        const fn = new Function('gmy', 'pm', 'gimay', 'putman', 'console', 'Script', 'CryptoJS', `
          return (async () => { ${processedContent} })();
        `);
        // gmy, pm, gimay, putman all point to the same object
        await fn(gmy, gmy, gmy, gmy, consoleMock, ScriptClass, typeof CryptoJS !== 'undefined' ? CryptoJS : undefined);
      };
    },
    response: {
      code: context.response?.status,
      status: context.response?.statusText,
      headers: { get: (key: string) => context.response?.headers?.[key] || context.response?.headers?.[key.toLowerCase()] },
      responseTime: context.response?.time,
      responseSize: context.response?.size,
      json: () => { try { return typeof context.response?.body === 'string' ? JSON.parse(context.response?.body) : context.response?.body; } catch { return null; } }
    },
    test: (name: string, fn: any) => {
      try {
        const res = fn();
        if (res instanceof Promise) {
          testResults.push(res.then(() => ({ name, status: 'pass' })).catch((err: any) => ({ name, status: 'fail', message: err.message })));
        } else {
          testResults.push({ name, status: 'pass' });
        }
      } catch (error: any) { testResults.push({ name, status: 'fail', message: error.message }); }
    },
    expect: (val: any) => {
      const assertion: any = {
        to: {
          equal: (expected: any) => { if (val !== expected) throw new Error(`Expected ${JSON.stringify(val)} to equal ${JSON.stringify(expected)}`); return assertion; },
          not: {
            equal: (expected: any) => { if (val === expected) throw new Error(`Expected ${JSON.stringify(val)} NOT to equal ${JSON.stringify(expected)}`); return assertion; },
            include: (item: any) => { if ((Array.isArray(val) || typeof val === 'string') && val.includes(item)) throw new Error(`Expected ${JSON.stringify(val)} NOT to include ${JSON.stringify(item)}`); return assertion; }
          },
          be: {
            a: (type: string) => { if (typeof val !== type) throw new Error(`Expected value to be a ${type}, but got ${typeof val}`); return assertion; },
            an: (type: string) => assertion.to.be.a(type),
            below: (limit: number) => { if (val >= limit) throw new Error(`Expected ${val} to be below ${limit}`); return assertion; },
            above: (limit: number) => { if (val <= limit) throw new Error(`Expected ${val} to be above ${limit}`); return assertion; },
            true: () => { if (val !== true) throw new Error(`Expected ${val} to be true`); return assertion; },
            false: () => { if (val !== false) throw new Error(`Expected ${val} to be false`); return assertion; },
            null: () => { if (val !== null) throw new Error(`Expected ${val} to be null`); return assertion; }
          },
          include: (item: any) => {
            if (Array.isArray(val) || typeof val === 'string') { if (!val.includes(item)) throw new Error(`Expected ${JSON.stringify(val)} to include ${JSON.stringify(item)}`); }
            else if (val && typeof val === 'object') { if (!Object.keys(val).includes(item)) throw new Error(`Expected object to include key ${item}`); }
            else throw new Error("Target is not include-compatible");
            return assertion;
          },
          have: {
            property: (prop: string) => { if (!val || typeof val !== 'object' || !(prop in val)) throw new Error(`Expected object to have property "${prop}"`); return assertion; },
            status: (code: number) => { if (gmy.response.code !== code) throw new Error(`Expected status ${code} but got ${gmy.response.code}`); return assertion; }
          }
        }
      };
      return assertion;
    }
  };
  return gmy;
}

export class Script {
  public name: string;
  constructor(name: string) { this.name = name; }
  async Run() {
    const allScripts = useScriptStore.getState().scripts;
    const target = allScripts.find(s => s.id === this.name || s.name === this.name);
    if (!target) throw new Error(`Script "${this.name}" not found.`);
    let processedContent = target.content || '';
    processedContent = processedContent.replace(/new\s*\(\s*(['"`])(.*?)\1\s*\)/g, 'new Script("$2")');
    const fn = new Function('gmy', 'pm', 'gimay', 'putman', 'console', 'Script', 'CryptoJS', `
      return (async () => { ${processedContent} })();
    `);
    const { gmy, pm, gimay, putman, consoleMock } = this.getContext();
    await fn(gmy, pm, gimay, putman, consoleMock, Script, typeof CryptoJS !== 'undefined' ? CryptoJS : undefined);
  }
  private getContext() {
    // This should be set before calling Run
    return (Script as any)._lastContext || { gmy: {}, pm: {}, gimay: {}, putman: {}, consoleMock: {} };
  }
  static setContext(ctx: any) {
    (Script as any)._lastContext = ctx;
  }
}

export function processScriptCode(code: string): string {
  return code.replace(/new\s*\(\s*(['"`])(.*?)\1\s*\)/g, 'new Script("$2")');
}

export function buildChangedRequest(requestFunc: any, headersMap: Map<string, string>) {
  return {
    method: requestFunc.method,
    url: requestFunc.url,
    body: requestFunc.body?.raw,
    headers: Array.from(headersMap.entries()).map(([k, v]) => ({ key: k, value: v, active: true }))
  };
}

export async function resolveTestResults(testResults: any[]): Promise<any[]> {
  const resolvedTests = [];
  for (const t of testResults) {
    if (t instanceof Promise) resolvedTests.push(await t);
    else resolvedTests.push(t);
  }
  return resolvedTests;
}

export async function waitForAsyncRequests(activeAsyncRequests: { current: number }, timeoutMs: number): Promise<void> {
  let waitTime = 0;
  while (activeAsyncRequests.current > 0 && waitTime < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    waitTime += 50;
  }
}

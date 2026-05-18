import { RequestData, ResponseData } from '../types';

export class ScriptService {
  static async executePreRequest(scripts: string | string[], request: any, context: any) {
    const scriptsToRun = Array.isArray(scripts) ? scripts : [scripts].filter(Boolean);
    const logs: { level: 'log' | 'info' | 'warn' | 'error'; args: any[]; timestamp: string }[] = [];

    const pm = {
      request: {
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: request.body
      },
      environment: {
        get: (key: string) => context.variables?.[key],
        set: (key: string, value: any) => { if (context.variables) context.variables[key] = value; }
      },
      globals: {
        get: (key: string) => context.variables?.[key],
        set: (key: string, value: any) => { if (context.variables) context.variables[key] = value; }
      },
      variables: {
        get: (key: string) => context.variables?.[key],
        set: (key: string, value: any) => { if (context.variables) context.variables[key] = value; }
      }
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
        const fn = new Function('pm', 'console', script);
        fn(pm, consoleMock);
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

    const pm = {
      response: {
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
      },
      test: (name: string, fn: () => void) => {
        try {
          fn();
          results.push({ name, status: 'pass' });
        } catch (error: any) {
          results.push({ name, status: 'fail', message: error.message });
        }
      },
      expect: (val: any) => {
        const assertion = {
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
      },
      environment: {
        get: (key: string) => context.variables?.[key],
        set: (key: string, value: any) => { if (context.variables) context.variables[key] = value; }
      },
      globals: {
        get: (key: string) => context.variables?.[key],
        set: (key: string, value: any) => { if (context.variables) context.variables[key] = value; }
      },
      variables: {
        get: (key: string) => context.variables?.[key],
        set: (key: string, value: any) => { if (context.variables) context.variables[key] = value; }
      }
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
        const fn = new Function('pm', 'console', script);
        fn(pm, consoleMock);
      } catch (error: any) {
        consoleMock.error('Test Script Error:', error.message);
      }
    }

    return { results, logs };
  }
}

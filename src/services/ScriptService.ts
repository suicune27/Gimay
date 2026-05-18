import { ResponseData } from '../types';
import { SandboxRunner } from './sandboxRunner';

export class ScriptService {
  static async executePreRequest(scripts: string | string[], request: any, context: any) {
    const scriptsToRun = Array.isArray(scripts) ? scripts : [scripts].filter(Boolean);
    const logs: { level: 'log' | 'info' | 'warn' | 'error'; args: any[]; timestamp: string }[] = [];

    const variablesMap = { ...(context.variables || {}) };

    for (const script of scriptsToRun) {
      if (!script) continue;
      
      try {
        const result = await SandboxRunner.run(script, {
          variables: variablesMap,
          request: {
            method: request?.method || 'GET',
            url: request?.url || '',
            headers: request?.headers || [],
            body: request?.body || ''
          }
        });
        
        // Sync variables modifications back
        Object.assign(variablesMap, result.changedVariables);
        if (context.variables) {
          for (const [key, value] of Object.entries(result.changedVariables)) {
            if (value === null) {
              delete context.variables[key];
            } else {
              context.variables[key] = value;
            }
          }
        }
        
        // Collect sandbox logs
        result.logs.forEach(log => {
          logs.push({
            level: log.level === 'log' ? 'log' : log.level === 'warn' ? 'warn' : log.level === 'error' ? 'error' : 'info',
            args: [log.message],
            timestamp: new Date().toISOString()
          });
        });
      } catch (error: any) {
        logs.push({
          level: 'error',
          args: ['Pre-request execution error: ' + error.message],
          timestamp: new Date().toISOString()
        });
      }
    }

    return { request, logs };
  }

  static async executeTests(scripts: string | string[], response: ResponseData, request: any, context: any) {
    const scriptsToRun = Array.isArray(scripts) ? scripts : [scripts].filter(Boolean);
    const results: { name: string; status: 'pass' | 'fail'; message?: string }[] = [];
    const logs: { level: 'log' | 'info' | 'warn' | 'error'; args: any[]; timestamp: string }[] = [];

    const variablesMap = { ...(context.variables || {}) };

    for (const script of scriptsToRun) {
      if (!script) continue;
      
      try {
        const result = await SandboxRunner.run(script, {
          variables: variablesMap,
          request: {
            method: request?.method || 'GET',
            url: request?.url || '',
            headers: request?.headers || [],
            body: request?.body || ''
          },
          response: {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            time: response.time,
            size: response.size,
            body: response.body
          }
        });
        
        // Sync variables modifications back
        Object.assign(variablesMap, result.changedVariables);
        if (context.variables) {
          for (const [key, value] of Object.entries(result.changedVariables)) {
            if (value === null) {
              delete context.variables[key];
            } else {
              context.variables[key] = value;
            }
          }
        }
        
        // Collect sandbox logs
        result.logs.forEach(log => {
          logs.push({
            level: log.level === 'log' ? 'log' : log.level === 'warn' ? 'warn' : log.level === 'error' ? 'error' : 'info',
            args: [log.message],
            timestamp: new Date().toISOString()
          });
        });

        // Collect test assertions
        result.testResults.forEach(tr => {
          results.push({
            name: tr.name,
            status: tr.status,
            message: tr.message
          });
        });
      } catch (error: any) {
        logs.push({
          level: 'error',
          args: ['Test execution error: ' + error.message],
          timestamp: new Date().toISOString()
        });
      }
    }

    return { results, logs };
  }
}

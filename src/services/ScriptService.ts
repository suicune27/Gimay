import { ResponseData } from '../types';
import { SandboxRunner } from './sandboxRunner';

export class ScriptService {
  static async executePreRequest(scripts: string | string[], request: any, context: any) {
    const scriptsToRun = (Array.isArray(scripts) ? scripts : [scripts])
      .map(s => s ? s.trim() : '')
      .filter(Boolean);
    const logs: { level: 'log' | 'info' | 'warn' | 'error'; args: any[]; timestamp: string }[] = [];

    const variablesMap = { ...(context.variables || {}) };

    const activeEnv = context.activeEnvId && context.environments
      ? context.environments.find((env: any) => env.id === context.activeEnvId)
      : null;
    const environmentVariablesMap: Record<string, any> = {};
    if (activeEnv && activeEnv.variables) {
      activeEnv.variables.forEach((v: any) => {
        if (v.active) environmentVariablesMap[v.key] = v.value;
      });
    }

    const environmentMutations: Record<string, any> = {};

    if (scriptsToRun.length > 0) {
      // Bundling multiple scripts into a single safe block-scoped script runs them inside the same Worker isolate
      // which avoids thread creation and communication overhead.
      const bundledScript = scriptsToRun.map(script => `{\n${script}\n}`).join('\n;\n');
      
      try {
        const result = await SandboxRunner.run(bundledScript, {
          variables: variablesMap,
          environmentVariables: environmentVariablesMap,
          signal: context.signal,
          request: {
            method: request?.method || 'GET',
            url: request?.url || '',
            headers: request?.headers || [],
            body: request?.body || ''
          }
        }, 5000, !!context.useWorker);
        
        // Sync variables modifications back
        const changedVars = result?.changedVariables || {};
        Object.assign(variablesMap, changedVars);
        if (context.variables) {
          for (const [key, value] of Object.entries(changedVars)) {
            if (value === null) {
              delete context.variables[key];
            } else {
              context.variables[key] = value;
            }
          }
        }

        // Sync environment modifications back
        if (result?.changedEnvironment) {
          Object.assign(environmentMutations, result.changedEnvironment);
          for (const [key, value] of Object.entries(result.changedEnvironment)) {
            if (value === null) {
              delete environmentVariablesMap[key];
            } else {
              environmentVariablesMap[key] = value;
            }
          }
        }
        
        // Sync request modifications back
        if (result?.changedRequest) {
          if (result.changedRequest.url) request.url = result.changedRequest.url;
          if (result.changedRequest.method) request.method = result.changedRequest.method;
          if (result.changedRequest.headers) request.headers = result.changedRequest.headers;
          if (result.changedRequest.body !== undefined) {
             if (typeof request.body === 'object' && request.body !== null) {
                 if ('content' in request.body) request.body.content = result.changedRequest.body;
                 else request.body = result.changedRequest.body;
             } else {
                 request.body = result.changedRequest.body;
             }
          }
        }
        
        // Collect sandbox logs
        const sLogs = result?.logs || [];
        sLogs.forEach(log => {
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

    return { request, logs, environmentMutations };
  }

  static async executeTests(scripts: string | string[], response: ResponseData, request: any, context: any) {
    const scriptsToRun = (Array.isArray(scripts) ? scripts : [scripts])
      .map(s => s ? s.trim() : '')
      .filter(Boolean);
    const results: { name: string; status: 'pass' | 'fail'; message?: string }[] = [];
    const logs: { level: 'log' | 'info' | 'warn' | 'error'; args: any[]; timestamp: string }[] = [];

    const variablesMap = { ...(context.variables || {}) };

    const activeEnv = context.activeEnvId && context.environments
      ? context.environments.find((env: any) => env.id === context.activeEnvId)
      : null;
    const environmentVariablesMap: Record<string, any> = {};
    if (activeEnv && activeEnv.variables) {
      activeEnv.variables.forEach((v: any) => {
        if (v.active) environmentVariablesMap[v.key] = v.value;
      });
    }

    const environmentMutations: Record<string, any> = {};

    if (scriptsToRun.length > 0) {
      // Bundling multiple scripts into a single safe block-scoped script runs them inside the same Worker isolate
      // which avoids thread creation and communication overhead.
      const bundledScript = scriptsToRun.map(script => `{\n${script}\n}`).join('\n;\n');
      
      try {
        const result = await SandboxRunner.run(bundledScript, {
          variables: variablesMap,
          environmentVariables: environmentVariablesMap,
          signal: context.signal,
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
        }, 5000, !!context.useWorker);
        
        // Sync variables modifications back
        const changedVars = result?.changedVariables || {};
        Object.assign(variablesMap, changedVars);
        if (context.variables) {
          for (const [key, value] of Object.entries(changedVars)) {
            if (value === null) {
              delete context.variables[key];
            } else {
              context.variables[key] = value;
            }
          }
        }

        // Sync environment modifications back
        if (result?.changedEnvironment) {
          Object.assign(environmentMutations, result.changedEnvironment);
          for (const [key, value] of Object.entries(result.changedEnvironment)) {
            if (value === null) {
              delete environmentVariablesMap[key];
            } else {
              environmentVariablesMap[key] = value;
            }
          }
        }
        
        // Collect sandbox logs
        const sLogs = result?.logs || [];
        sLogs.forEach(log => {
          logs.push({
            level: log.level === 'log' ? 'log' : log.level === 'warn' ? 'warn' : log.level === 'error' ? 'error' : 'info',
            args: [log.message],
            timestamp: new Date().toISOString()
          });
        });

        // Collect test assertions
        const sResults = result?.testResults || [];
        sResults.forEach(tr => {
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

    return { results, logs, environmentMutations };
  }
}

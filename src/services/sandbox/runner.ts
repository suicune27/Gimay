import { RequestService } from '../RequestService';
import { useScriptStore } from '../../store/scriptStore';
import { useStore } from '../../store/useStore';
import type { SandboxContext, SandboxResult } from './types';
import { WorkerPool } from './workerPool';
import {
  createConsoleMock, createVariableStore, createEnvironmentStore,
  buildHeadersMap, createRequestFunction, createGmyObject,
  processScriptCode, buildChangedRequest, resolveTestResults,
  waitForAsyncRequests, Script as SandboxScript
} from './runtime';

export class SandboxRunner {
  static clearWorkerPool() {
    WorkerPool.clear();
  }

  static async runInThread(code: string, context: SandboxContext, timeoutMs = 5000): Promise<SandboxResult> {
    return new Promise<SandboxResult>(async (resolve) => {
      let resolved = false;
      let timer: any = null;

      const logs: SandboxResult['logs'] = [];
      const testResults: any[] = [];
      const changedVariables: Record<string, any> = {};
      const changedEnvironment: Record<string, any> = {};

      const consoleMock = createConsoleMock(logs);

      const cleanUpAndResolve = (result: SandboxResult) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        resolve(result);
      };

      timer = setTimeout(() => {
        cleanUpAndResolve({
          logs: [...logs, { level: 'error', message: `Execution timed out after ${timeoutMs}ms.` }],
          testResults: [], changedVariables: {},
          error: `Timeout: Execution exceeded ${timeoutMs}ms limit.`
        });
      }, timeoutMs);

      try {
        const vars = { ...context.variables || {} };
        const envVars = { ...context.environmentVariables || {} };
        const variableStore = createVariableStore(vars, changedVariables);
        const environmentStore = createEnvironmentStore(vars, envVars, changedEnvironment);

        const headersMap = buildHeadersMap(context.request?.headers);
        const requestFunc = createRequestFunction(context, headersMap);
        const activeAsyncRequests = { current: 0 };

        const gmy = createGmyObject(
          context, requestFunc, headersMap, variableStore, environmentStore,
          logs, testResults, activeAsyncRequests, consoleMock, SandboxScript
        );

        const pm = gmy;
        const gimay = gmy;
        const putman = gmy;

        // Set context on Script class so Script.Run() can access runtime variables
        SandboxScript.setContext({ gmy, pm, gimay, putman, consoleMock });

        let processedCode = processScriptCode(code || '');

        const fn = new Function('gmy', 'pm', 'gimay', 'putman', 'console', 'Script', 'CryptoJS', `
          return (async () => {
            ${processedCode}
          })();
        `);

        const CryptoJS = (globalThis as any).CryptoJS || undefined;
        await fn(gmy, pm, gimay, putman, consoleMock, SandboxScript, CryptoJS);

        await waitForAsyncRequests(activeAsyncRequests, timeoutMs);
        const resolvedTests = await resolveTestResults(testResults);

        cleanUpAndResolve({
          logs, testResults: resolvedTests,
          changedVariables, changedEnvironment,
          changedRequest: buildChangedRequest(requestFunc, headersMap)
        });

      } catch (e: any) {
        logs.push({ level: 'error', message: e.message });
        cleanUpAndResolve({
          logs, testResults: [], changedVariables, changedEnvironment,
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
          testResults: [], changedVariables: {},
          error: 'Aborted: Execution aborted by user.'
        }, true);
      };

      const cleanUpAndResolve = (result: SandboxResult, forceTerminate = false) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        delete (worker as any).onTerminate;

        if (context.signal) context.signal.removeEventListener('abort', onAbort);

        if (forceTerminate) WorkerPool.terminateWorker(worker);
        else WorkerPool.release(worker);
        resolve(result);
      };

      if (context.signal) {
        if (context.signal.aborted) { onAbort(); return; }
        context.signal.addEventListener('abort', onAbort);
      }

      (worker as any).onTerminate = () => {
        cleanUpAndResolve({
          logs: [{ level: 'error', message: 'Sandbox Worker terminated during memory tuning or abort.' }],
          testResults: [], changedVariables: {},
          error: 'Execution terminated'
        }, true);
      };

      timer = setTimeout(() => {
        cleanUpAndResolve({
          logs: [{ level: 'error', message: `Execution timed out after ${timeoutMs}ms.` }],
          testResults: [], changedVariables: {},
          error: `Timeout: Execution exceeded ${timeoutMs}ms limit.`
        }, true);
      }, timeoutMs);

      const safePostMessage = (msg: any) => {
        try { worker.postMessage(msg); } catch (postErr) {
          console.warn('[SandboxRunner] safePostMessage discarded message. Worker might be terminated.', postErr);
        }
      };

      worker.onerror = (errEvent) => {
        cleanUpAndResolve({
          logs: [{ level: 'error', message: `Sandbox Worker Error: ${errEvent.message || 'Unknown'}` }],
          testResults: [], changedVariables: {},
          error: errEvent.message || 'Worker runtime error'
        }, true);
      };

      worker.onmessage = async (e) => {
        const { type, action, id, data, logs: msgLogs, testResults: msgTests, changedVariables: msgVars, changedEnvironment: msgEnv, changedRequest, error, runtimeId: msgRuntimeId } = e.data;

        if (msgRuntimeId && msgRuntimeId !== runtimeId) return;

        if (type === 'coordination') {
          if (action === 'request') {
            try {
              const requestOpts = typeof data === 'string' ? { url: data, method: 'GET' } : { ...data };
              if (requestOpts.header && typeof requestOpts.header === 'object') {
                requestOpts.headers = Object.entries(requestOpts.header).map(([key, value]) => ({ key, value: String(value), active: true }));
              }
              if (requestOpts.body && typeof requestOpts.body === 'object') {
                const mode = requestOpts.body.mode || requestOpts.body.type || 'raw';
                requestOpts.bodyType = mode;
                if (mode === 'urlencoded' && Array.isArray(requestOpts.body.urlencoded)) {
                  requestOpts.body.urlencoded = requestOpts.body.urlencoded.map((item: any) => ({ ...item, active: item.active !== false }));
                }
                if (mode === 'form-data' && Array.isArray(requestOpts.body.formData)) {
                  requestOpts.body.formData = requestOpts.body.formData.map((item: any) => ({ ...item, active: item.active !== false }));
                }
              }
              if (requestOpts.data !== undefined && requestOpts.body === undefined) {
                requestOpts.body = requestOpts.data;
                requestOpts.bodyType = requestOpts.bodyType || 'raw';
              }
              if (typeof requestOpts.body === 'string' && !requestOpts.bodyType) requestOpts.bodyType = 'raw';

              const state = useStore.getState();
              const response = await RequestService.execute(requestOpts as any, {
                collections: state.collections || [], environments: state.environments || [],
                activeEnvId: state.activeEnvId, variables: {}
              } as any);

              if ((worker as any).activeRuntimeId !== runtimeId) return;
              safePostMessage({ type: 'coordination_response', id, runtimeId, data: { status: response.status, statusText: response.statusText, body: response.body, headers: response.headers } });
            } catch (err: any) {
              if ((worker as any).activeRuntimeId !== runtimeId) return;
              safePostMessage({ type: 'coordination_response', id, runtimeId, error: err.message });
            }
          } else if (action === 'import') {
            try {
              const allScripts = useScriptStore.getState().scripts;
              const target = allScripts.find(s => s.id === data || s.name === data);
              if ((worker as any).activeRuntimeId !== runtimeId) return;
              if (!target) safePostMessage({ type: 'coordination_response', id, runtimeId, error: `Script "${data}" not found.` });
              else safePostMessage({ type: 'coordination_response', id, runtimeId, data: target.content });
            } catch (err: any) {
              if ((worker as any).activeRuntimeId !== runtimeId) return;
              safePostMessage({ type: 'coordination_response', id, runtimeId, error: err.message });
            }
          }
        } else if (type === 'result') {
          cleanUpAndResolve({
            logs: msgLogs || [], testResults: msgTests || [],
            changedVariables: msgVars || {}, changedEnvironment: msgEnv || {},
            changedRequest, error
          }, false);
        }
      };

      safePostMessage({ code, context: { ...context, signal: undefined }, runtimeId });
    });
  }
}

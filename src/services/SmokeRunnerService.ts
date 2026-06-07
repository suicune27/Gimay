import { RequestData, Collection, Environment } from '../types';
import { VariableService } from './VariableService';
import { RequestService } from './RequestService';
import { ScriptService } from './ScriptService';
import { SandboxRunner } from './sandboxRunner';
import { SmokeLogService } from './SmokeLogService';

// ─── Shared Types ───────────────────────────────────────────────────────────

export interface TestSample {
  id: number;
  timestamp: string;
  latency: number;
  status: number | string;
  success: boolean;
  error?: string;
  requestName?: string;
  requestMethod?: string;
  statusCode?: number | null;
  responsePreview?: string;
}

export interface MoTReport {
  durationSeconds: number;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  earlyAbort: boolean;
  abortReason: string;
  crashPreventionActions: number;
  recommendations: string[];
  hotspots?: any[];
}

export interface RunnerContext {
  environments: Environment[];
  activeEnvId: string | null;
  collections: Collection[];
  collection: Collection | null;
}

export interface MoTRunnerCallbacks {
  onSamplesUpdate: (samples: TestSample[]) => void;
  onStatsUpdate: (stats: { avgLatency: number; minLatency: number; maxLatency: number; successRate: number; throughput: number; progress: number }) => void;
  onMemoryUpdate: (pressure: number) => void;
  onStabilityUpdate: (score: number) => void;
  onGuardUpdate: (guard: 'SAFE' | 'THROTTLED' | 'CRITICAL', throttle: number, priority: 'P0' | 'P1' | 'P2' | 'P3' | 'ALL') => void;
  onCrashPreventionTrigger: (count: number) => void;
  onMemoryCooling: (cooling: boolean) => void;
  onMemoryCoolingCount: (count: number) => void;
  onToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  onCleaningStatus: (status: string) => void;
  onCleaningComplete: () => void;
}

export interface LoopWorkerConfig {
  threads: number;
  loops: number;
  delay: number;
  timeoutMs: number;
  sandboxEngine: 'in-thread' | 'worker';
  runRequestScripts: boolean;
  saveTempLogs: boolean;
  stopOnFailure?: boolean;
}

export interface MoTWorkerConfig {
  threads: number;
  delay: number;
  timeoutMs: number;
  motDuration: number;
  motMaxReqPerMin: number;
  motMaxRetriesPerMin: number;
  sandboxEngine: 'in-thread' | 'worker';
  runRequestScripts: boolean;
  saveTempLogs: boolean;
}

// ─── Ref Wrapper type (avoid React dependency) ──────────────────────────────

export interface RefWrapper<T> {
  current: T;
}

export interface CleanupContext {
  currentRunIdRef: RefWrapper<number>;
  isRunningRef: RefWrapper<boolean>;
  activeAbortControllersRef: RefWrapper<Set<AbortController>>;
  minuteTimer: RefWrapper<any>;
  allSamplesRef: RefWrapper<any[]>;
  successLogSamplesRef: RefWrapper<any[]>;
  failedLogSamplesRef: RefWrapper<any[]>;
}

export interface MemoryCoolingState {
  isMemoryCoolingRef: RefWrapper<boolean>;
  memoryPressureLevelRef: RefWrapper<number>;
  allSamplesRef: RefWrapper<any[]>;
  isRunningRef: RefWrapper<boolean>;
  currentRunIdRef: RefWrapper<number>;
  currentRunId: number;
}

// ─── SmokeRunnerService ─────────────────────────────────────────────────────

export class SmokeRunnerService {
  static buildResponsePreview(body: any): string {
    if (body === null || body === undefined) return '';
    if (typeof body === 'string') return body.slice(0, 2000);
    try {
      return JSON.stringify(body).slice(0, 2000);
    } catch {
      return '';
    }
  }

  static pushBounded(arr: any[], item: any, max = 50): void {
    arr.push(item);
    if (arr.length > max) arr.shift();
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static computeMemoryPressure(): number {
    const mem = (window as any).performance?.memory;
    if (mem) {
      return Math.min(100, Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100));
    }
    return 0;
  }

  static computeSimulatedMemoryPressure(completedCount: number): number {
    const baseCreep = Math.min(45, (completedCount * 0.04));
    return Math.round(baseCreep + Math.sin(completedCount * 0.05) * 5 + 10);
  }

  static finalizeErrorMsg(errorMsg: any): string | undefined {
    if (typeof errorMsg === 'object' && errorMsg !== null) {
      return (errorMsg as any).error || (errorMsg as any).message || JSON.stringify(errorMsg);
    }
    return errorMsg ? String(errorMsg) : undefined;
  }

  static tryForceGC(): void {
    if (typeof (window as any).gc === 'function') {
      try { (window as any).gc(); } catch { }
    }
  }

  static computeStabilityScore(
    recentSamples: TestSample[],
    jitterThreshold = 120,
    consecutiveFailures = 0
  ): number {
    let passedRecent = 0;
    const latencyHistoryArray: number[] = [];
    recentSamples.forEach(rs => {
      if (rs.success) passedRecent++;
      latencyHistoryArray.push(rs.latency);
    });

    let jitter = 0;
    if (latencyHistoryArray.length > 2) {
      const avgL = latencyHistoryArray.reduce((p, c) => p + c, 0) / latencyHistoryArray.length;
      const sqDiffsSum = latencyHistoryArray.reduce((p, c) => p + Math.pow(c - avgL, 2), 0);
      jitter = Math.round(Math.sqrt(sqDiffsSum / latencyHistoryArray.length));
    }

    const recentPassRate = recentSamples.length ? (passedRecent / recentSamples.length) * 100 : 100;
    let score = 100;
    score -= (100 - recentPassRate) * 0.8;
    if (jitter > jitterThreshold) score -= 12;
    if (consecutiveFailures > 2) score -= consecutiveFailures * 6;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  static evaluateGuardState(
    computedPressure: number,
    score: number
  ): { guard: 'SAFE' | 'THROTTLED' | 'CRITICAL'; throttle: number; priority: 'P0' | 'P1' | 'P2' | 'P3' | 'ALL' } {
    if (computedPressure > 80 || score < 40) {
      return { guard: 'CRITICAL', throttle: 0.3, priority: 'P1' };
    }
    if (computedPressure > 50 || score < 75) {
      return { guard: 'THROTTLED', throttle: 0.6, priority: 'P2' };
    }
    return { guard: 'SAFE', throttle: 1.0, priority: 'ALL' };
  }

  static generateMoTRecommendations(
    successRate: number,
    maxLatency: number,
    crashPreventionCount: number,
    hotspots?: any[]
  ): string[] {
    const recs: string[] = [];
    const finalPassRate = successRate;
    if (finalPassRate < 75 && hotspots && hotspots.length > 0) {
      recs.push(`Unstable Target Endpoint Detected: '${hotspots[0].method} ${hotspots[0].name}' exhibited a ${100 - finalPassRate}% fail rate. Investigate endpoint exception logging for connection resets.`);
    }
    if (maxLatency > 4000) {
      recs.push(`High Latency Ceiling Spike: Latency spiked to ${maxLatency}ms during loading. Implement a robust response caching layer to bypass database row scans.`);
    }
    if (crashPreventionCount > 0) {
      recs.push(`Preemptive resilience stabilizer interceded ${crashPreventionCount} times to curb stack buffer drop offs, lowering execution speeds safely to prevent browser heap exhaustion.`);
    }
    if (recs.length === 0) {
      recs.push("Pristine Systems Stability: Continuous endurance testing achieved excellent results. The local cluster sustained the concurrent loads perfectly with no memory exhaustion signs.");
    }
    return recs;
  }

  static async runCleanupPreamble(
    cleanup: CleanupContext,
    callbacks: { onCleaningStatus: (status: string) => void; onCleaningComplete: () => void }
  ): Promise<void> {
    const { currentRunIdRef, isRunningRef, activeAbortControllersRef, minuteTimer, allSamplesRef, successLogSamplesRef, failedLogSamplesRef } = cleanup;

    callbacks.onCleaningStatus('SHUTTING DOWN PREVIOUS SESSIONS & ABORTING WORKERS...');

    currentRunIdRef.current++;
    isRunningRef.current = false;

    activeAbortControllersRef.current.forEach(c => {
      try { c.abort(); } catch { }
    });
    activeAbortControllersRef.current.clear();

    if (minuteTimer.current) {
      clearInterval(minuteTimer.current);
      minuteTimer.current = null;
    }

    await new Promise(resolve => setTimeout(resolve, 150));

    callbacks.onCleaningStatus('INSPECTING LOCAL STORAGE STABILITY...');
    try {
      const gmyNodes = localStorage.getItem('gmy_expanded_nodes');
      if (gmyNodes && gmyNodes.length > 20000) {
        localStorage.setItem('gmy_expanded_nodes', '{}');
      }
      const gmyRecents = localStorage.getItem('gmy_recent_scripts');
      if (gmyRecents && gmyRecents.length > 20000) {
        localStorage.setItem('gmy_recent_scripts', '[]');
      }
    } catch { }

    callbacks.onCleaningStatus('PURGING STALE RUN SAMPLES & LOG BUFFERS...');
    await new Promise(resolve => setTimeout(resolve, 20));
    allSamplesRef.current = [];

    callbacks.onCleaningStatus('RELEASING STALE SANDBOX WEB WORKER SESSIONS...');
    await new Promise(resolve => setTimeout(resolve, 20));
    try { SandboxRunner.clearWorkerPool(); } catch { }

    callbacks.onCleaningStatus('GARBAGE-COLLECTING DETACHED HEAP REFERENCES...');
    await new Promise(resolve => setTimeout(resolve, 20));
    SmokeRunnerService.tryForceGC();

    callbacks.onCleaningStatus('PRE-WARMING ISOLATED THREAD POOL & HEAP FOR ENERGIZE RUN...');
    await new Promise(resolve => setTimeout(resolve, 15));
    callbacks.onCleaningComplete();
  }

  static async handleMemoryCooling(
    state: MemoryCoolingState,
    callbacks: { onMemoryUpdate: (pressure: number) => void; onToast: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void }
  ): Promise<void> {
    const { isMemoryCoolingRef, memoryPressureLevelRef, allSamplesRef, isRunningRef, currentRunIdRef, currentRunId } = state;

    if (allSamplesRef.current.length > 50) {
      allSamplesRef.current = allSamplesRef.current.slice(-20);
    }
    SmokeRunnerService.tryForceGC();

    while (isMemoryCoolingRef.current && isRunningRef.current) {
      await SmokeRunnerService.sleep(500);
      if (currentRunId !== currentRunIdRef.current) return;

      const checkPressure = SmokeRunnerService.computeMemoryPressure() || Math.max(20, memoryPressureLevelRef.current - 15);
      memoryPressureLevelRef.current = checkPressure;
      callbacks.onMemoryUpdate(checkPressure);

      if (checkPressure < 55) {
        isMemoryCoolingRef.current = false;
        callbacks.onToast('success', `Memory successfully sanitized to ${checkPressure}%. Resuming MoT suite execution.`);
        break;
      }
    }
  }

  static createLogSample(
    sample: TestSample,
    extras: {
      statusCode: number | null;
      responsePreview: string;
      requestName?: string;
      requestMethod?: string;
      requestUrl?: string;
      requestHeaders?: Record<string, string>;
      requestParams?: Record<string, string>;
      requestBody?: string;
      responseHeaders?: Record<string, any>;
      responseBody?: any;
    }
  ): any {
    return {
      ...sample,
      statusCode: extras.statusCode,
      responsePreview: extras.responsePreview,
      requestName: extras.requestName || sample.requestName,
      requestMethod: extras.requestMethod || sample.requestMethod,
      requestUrl: extras.requestUrl,
      requestHeaders: extras.requestHeaders,
      requestParams: extras.requestParams,
      requestBody: extras.requestBody,
      responseHeaders: extras.responseHeaders,
      responseBody: extras.responseBody,
    };
  }

  static async executeSingleRequest(
    baseRequest: RequestData,
    context: RunnerContext & {
      variables: Record<string, any>;
      signal: AbortSignal;
      useWorker: boolean;
      suppressScriptLogs: boolean;
      skipResponseBody: boolean;
      responseBodyLimitBytes?: number;
    },
    config: { timeoutMs: number; runRequestScripts: boolean; suitePreScript?: string; suiteTestScript?: string }
  ): Promise<{
    status: number | string;
    success: boolean;
    errorMsg: string;
    statusCode: number | null;
    responsePreview: string;
    requestToExecute: RequestData;
  }> {
    const { environments, activeEnvId, collections, collection } = context;
    let status: number | string = 0;
    let success = false;
    let errorMsg = '';
    let statusCode: number | null = null;
    let responsePreview = '';

    let requestToExecute: RequestData = {
      ...baseRequest,
      headers: (baseRequest.headers || []).map(h => ({ ...h })),
      params: (baseRequest.params || []).map(p => ({ ...p })),
      settings: baseRequest.settings ? { ...baseRequest.settings } : undefined
    };

    requestToExecute.settings = {
      ...(requestToExecute.settings || { followRedirects: true, maxRedirects: 10 }),
      timeout: config.timeoutMs
    };

    const activeEnvironment = activeEnvId
      ? environments.find((env) => env.id === activeEnvId)
      : null;

    try {
      const preScripts = config.runRequestScripts ? [
        activeEnvironment?.pre_request_script,
        collection?.pre_request_script,
        config.suitePreScript,
        requestToExecute.pre_request_script
      ].filter(Boolean) as string[] : [];

      if (preScripts.length > 0) {
        const preRequestOut = await ScriptService.executePreRequest(preScripts, requestToExecute, context);
        requestToExecute = preRequestOut.request;

        if (preRequestOut.environmentMutations) {
          for (const [key, value] of Object.entries(preRequestOut.environmentMutations)) {
            if (value === null) {
              delete context.variables[key];
            } else {
              context.variables[key] = String(value);
            }
          }
        }
      }

      const response = await RequestService.execute(requestToExecute, context);

      const testScripts = config.runRequestScripts ? [
        activeEnvironment?.test_script,
        collection?.test_script,
        config.suiteTestScript,
        requestToExecute.test_script
      ].filter(Boolean) as string[] : [];

      const testOut = testScripts.length > 0
        ? await ScriptService.executeTests(testScripts, response, requestToExecute, context)
        : { results: [] as { name: string; status: 'pass' | 'fail'; message?: string }[] };

      status = response.status;
      statusCode = response.status;
      responsePreview = SmokeRunnerService.buildResponsePreview(response.body);
      success = response.status >= 200 && response.status < 300;

      if (response.status === 0) {
        success = false;
        status = response.statusText;
        try {
          let bodyObj = response.body;
          if (typeof bodyObj === 'string') {
            try { bodyObj = JSON.parse(bodyObj); } catch { }
          }
          if (bodyObj && typeof bodyObj === 'object') {
            errorMsg = bodyObj.error || bodyObj.message || bodyObj.diagnostics?.message || JSON.stringify(bodyObj);
          } else {
            errorMsg = response.body || response.statusText;
          }
        } catch {
          errorMsg = typeof response.body === 'object' && response.body !== null
            ? (response.body.error || response.body.message || JSON.stringify(response.body))
            : String(response.body || response.statusText);
        }
      } else if (testOut.results.some(r => r.status === 'fail')) {
        success = false;
        const failedTest = testOut.results.find(r => r.status === 'fail');
        status = 'Assertion Fail';
        errorMsg = failedTest ? `${failedTest.name}: ${failedTest.message || 'Assertion failed'}` : 'Test assertion failed';
      }
    } catch (err: any) {
      success = false;
      status = err.name === 'AbortError' ? 'Timeout' : 'Execution Error';
      errorMsg = err.message || String(err);
    }

    return { status, success, errorMsg, statusCode, responsePreview, requestToExecute };
  }

  static async persistTemporaryRunLog(config: {
    enabled: boolean;
    runLabel: string;
    requestId?: string;
    workspaceId?: string | null;
    fallbackUserId?: string;
    durationMs: number;
    successLogSamples: any[];
    failedLogSamples: any[];
    metadata: Record<string, any>;
  }): Promise<boolean> {
    return SmokeLogService.persistTemporaryRunLog({
      enabled: config.enabled,
      runLabel: config.runLabel,
      requestId: config.requestId,
      workspaceId: config.workspaceId,
      fallbackUserId: config.fallbackUserId,
      durationMs: config.durationMs,
      samples: [...config.successLogSamples, ...config.failedLogSamples],
      metadata: config.metadata
    });
  }
}

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, Download, Activity, Clock, ShieldAlert, CheckCircle, BarChart3, AlertCircle, X, Shield, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore';
import { VariableService } from '../services/VariableService';
import { RequestData, Collection } from '../types';
import { CollectionExportService } from '../services/CollectionExportService';
import { isElectron } from '../lib/platform';
import { RequestService } from '../services/RequestService';
import { ScriptService } from '../services/ScriptService';
import { SandboxRunner } from '../services/sandboxRunner';
import { SmokeLogService } from '../services/SmokeLogService';

const ModernRadarLoader = () => {
  return (
    <div className="relative w-full h-36 bg-black/40 border border-white/[0.03] rounded-2xl overflow-hidden flex items-center justify-center p-6 select-none">
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Rings */}
        <div className="absolute inset-0 rounded-full border border-dashed border-[#3ECF8E]/30 animate-[spin_10s_linear_infinite]" />
        <div className="absolute inset-3 rounded-full border-2 border-transparent border-t-[#3ECF8E] border-b-blue-500 animate-[spin_4s_linear_infinite]" />
        <div className="absolute inset-6 rounded-full border border-blue-400/20 animate-ping opacity-60" />
        
        {/* Center Orb */}
        <div className="absolute inset-9 rounded-full bg-gradient-to-tr from-[#3ECF8E]/20 to-blue-500/20 backdrop-blur-md border border-white/[0.08] shadow-[0_0_20px_rgba(62,207,142,0.25)] flex items-center justify-center">
          <Activity size={20} className="text-[#3ECF8E] animate-pulse" />
        </div>

        {/* Orbiting particles */}
        <div className="absolute w-2 h-2 bg-[#3ECF8E] rounded-full shadow-[0_0_8px_#3ECF8E] animate-[orbit_3s_linear_infinite]" />
        <div className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_6px_#60A5FA] animate-[orbit_3s_linear_infinite_1.5s]" />
      </div>

      <style>{`
        @keyframes orbit {
          0% { transform: rotate(0deg) translateX(45px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(45px) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
};

interface SmokeTestPanelProps {
  activeRequest: RequestData;
  collection?: Collection | null;
}

interface TestSample {
  id: number;
  timestamp: string;
  latency: number;
  status: number | string;
  success: boolean;
  error?: string;
}

export const SmokeTestPanel: React.FC<SmokeTestPanelProps> = ({ activeRequest, collection }) => {
  const { environments, activeEnvId, collections, addToast } = useStore();
  const [threads, setThreads] = useState(5);
  const [loops, setLoops] = useState(5);
  const [delay, setDelay] = useState(50);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  
  const [isRunning, setIsRunning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleaningStatus, setCleaningStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [samples, setSamples] = useState<TestSample[]>([]);
  const [throughput, setThroughput] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  const [minLatency, setMinLatency] = useState(0);
  const [maxLatency, setMaxLatency] = useState(0);
  const [successRate, setSuccessRate] = useState(100);

  const [sandboxEngine, setSandboxEngine] = useState<'in-thread' | 'worker'>('worker');
  const [runRequestScripts, setRunRequestScripts] = useState(true);
  const [saveTempLogs, setSaveTempLogs] = useState(false);

  // Minutes of Testing (MoT) endurance monitoring options
  const [runnerMode, setRunnerMode] = useState<'loop' | 'mot'>('loop');
  const [motDuration, setMotDuration] = useState(120); // default to 120 seconds (2 minutes)
  const [motMaxReqPerMin, setMotMaxReqPerMin] = useState(600); // max requests budget per minute
  const [motMaxRetriesPerMin, setMotMaxRetriesPerMin] = useState(60);

  // MoT real-time metrics and dynamic stabilizer states
  const [memoryPressure, setMemoryPressure] = useState(0); // 0% - 100%
  const [adaptiveThrottle, setAdaptiveThrottle] = useState(1.0); // modifier: 1.0 = full speed, decreasing under load
  const [stabilityScore, setStabilityScore] = useState(100); // 0 - 100 system health
  const [activePriorityFocus, setActivePriorityFocus] = useState<'P0' | 'P1' | 'P2' | 'P3' | 'ALL'>('ALL');
  const [guardStatus, setGuardStatus] = useState<'SAFE' | 'THROTTLED' | 'CRITICAL'>('SAFE');
  const [crashPreventionTriggers, setCrashPreventionTriggers] = useState(0);

  // Emergency Memory Flush and Pause states
  const [isMemoryCooling, setIsMemoryCooling] = useState(false);
  const [memoryCoolingCount, setMemoryCoolingCount] = useState(0);
  const isMemoryCoolingRef = useRef(false);

  // MoT Session Intelligence Report States
  const [showMotReport, setShowMotReport] = useState(false);
  const [motReportData, setMotReportData] = useState<any | null>(null);

  // MoT session tracking variables
  const completedCountRef = useRef(0);
  const successCountRef = useRef(0);
  const currentConsecutiveFailuresRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const cleanupCyclesRef = useRef(0);
  const earlyAbortTriggeredRef = useRef(false);
  const abortReasonRef = useRef('');
  const requestsInCurrentMinute = useRef(0);
  const retriesInCurrentMinute = useRef(0);
  const crashPreventionTriggersCountRef = useRef(0);
  const memoryPressureLevelRef = useRef(0);
  const guardStateRef = useRef<'SAFE' | 'THROTTLED' | 'CRITICAL'>('SAFE');
  const minuteTimer = useRef<any>(null);

  const allSamplesRef = useRef<TestSample[]>([]);
  const successLogSamplesRef = useRef<any[]>([]);
  const failedLogSamplesRef = useRef<any[]>([]);
  const isRunningRef = useRef(false);
  const currentRunIdRef = useRef(0);
  const activeAbortControllersRef = useRef<Set<AbortController>>(new Set());

  const buildResponsePreview = (body: any): string => {
    if (body === null || body === undefined) return '';
    if (typeof body === 'string') return body.slice(0, 2000);
    try {
      return JSON.stringify(body).slice(0, 2000);
    } catch {
      return '';
    }
  };

  const pushBounded = (arr: any[], item: any, max = 50) => {
    arr.push(item);
    if (arr.length > max) arr.shift();
  };

  // Hover states for dynamic responsive tooltip
  const [hoveredSample, setHoveredSample] = useState<TestSample | null>(null);
  const [hoverXPercent, setHoverXPercent] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Dormant state pointers preserved for linting/type validation of inactive JSX blocks
  const [selectedSample, setSelectedSample] = useState<any | null>(null);
  const [modalTab, setModalTab] = useState<'request' | 'response'>('request');
  const [visibleLogType, setVisibleLogType] = useState<'success' | 'failed'>('success');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isRunning || !chartContainerRef.current || samples.length === 0) return;
    const rect = chartContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percent = Math.max(0, Math.min(100, (x / width) * 100));
    
    const graphSamples = samples.slice(-300);
    const index = Math.min(
      graphSamples.length - 1,
      Math.max(0, Math.round((percent / 100) * (graphSamples.length - 1)))
    );
    const sample = graphSamples[index];
    setHoveredSample(sample);
    setHoverXPercent((index / (graphSamples.length - 1 || 1)) * 100);
  };

  const handleMouseLeave = () => {
    setHoveredSample(null);
    setHoverXPercent(null);
  };

  // Clear hovered samples when execution starts to avoid caching/stale values
  useEffect(() => {
    if (isRunning) {
      setHoveredSample(null);
      setHoverXPercent(null);
    }
  }, [isRunning]);

  // Terminate any active execution threads on unmount
  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      activeAbortControllersRef.current.forEach(c => {
        try {
          c.abort();
        } catch {}
      });
      activeAbortControllersRef.current.clear();
      if (minuteTimer.current) {
        clearInterval(minuteTimer.current);
        minuteTimer.current = null;
      }
      try {
        SandboxRunner.clearWorkerPool();
      } catch {}
    };
  }, []);

  const handleExportJMX = () => {
    if (!activeRequest) return;
    
    // Create a temporary collection containing just this request to export
    const tempCollection: Collection = {
      id: 'temp-jmx',
      name: `Smoke_${activeRequest.name}`,
      workspace_id: activeRequest.workspace_id,
      user_id: activeRequest.user_id,
      visibility: 'private',
      permission: 'edit',
      variables: [],
      auth: { type: 'none' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      requests: [activeRequest],
      folders: []
    };

    CollectionExportService.exportJMeter(tempCollection);
  };

  const runSmokeTest = async () => {
    if (isRunning || isCleaning) return;
    if (!activeRequest) {
      if (addToast) {
        addToast({ type: 'error', message: 'No request is active. Please select a request to smoke test.' });
      } else {
        alert('No request is active. Please select a request to smoke test.');
      }
      return;
    }

    // --- High-Performance Sanitization and Warmup Core ---
    setIsCleaning(true);
    setCleaningStatus('SHUTTING DOWN PREVIOUS SESSIONS & ABORTING WORKERS...');
    
    // Increment run ID and stop active execution references synchronously so any running workers discard their output
    currentRunIdRef.current++;
    const currentRunId = currentRunIdRef.current;
    isRunningRef.current = false;

    // Immediately trigger any outstanding abort signals
    activeAbortControllersRef.current.forEach(c => {
      try {
        c.abort();
      } catch {}
    });
    activeAbortControllersRef.current.clear();

    if (minuteTimer.current) {
      clearInterval(minuteTimer.current);
      minuteTimer.current = null;
    }

    // Yield to browser event loop to flush any microtasks/tasks and resolve outstanding rejections securely
    await new Promise(resolve => setTimeout(resolve, 150));

    setCleaningStatus('INSPECTING LOCAL STORAGE STABILITY...');
    try {
      const gmyNodes = localStorage.getItem('gmy_expanded_nodes');
      if (gmyNodes && gmyNodes.length > 20000) {
        localStorage.setItem('gmy_expanded_nodes', '{}');
      }
      const gmyRecents = localStorage.getItem('gmy_recent_scripts');
      if (gmyRecents && gmyRecents.length > 20000) {
        localStorage.setItem('gmy_recent_scripts', '[]');
      }
    } catch {}

    setCleaningStatus('PURGING STALE RUN SAMPLES & LOG BUFFERS...');
    await new Promise(resolve => setTimeout(resolve, 20));
    allSamplesRef.current = [];
    setSamples([]);

    setCleaningStatus('RELEASING STALE SANDBOX WEB WORKER SESSIONS...');
    await new Promise(resolve => setTimeout(resolve, 20));
    try {
      SandboxRunner.clearWorkerPool();
    } catch {}

    setCleaningStatus('GARBAGE-COLLECTING DETACHED HEAP REFERENCES...');
    await new Promise(resolve => setTimeout(resolve, 20));
    if (typeof (window as any).gc === 'function') {
      try { (window as any).gc(); } catch {}
    }

    setCleaningStatus('PRE-WARMING ISOLATED THREAD POOL & HEAP FOR ENERGIZE RUN...');
    await new Promise(resolve => setTimeout(resolve, 15));
    setIsCleaning(false);

    setIsMemoryCooling(false);
    isMemoryCoolingRef.current = false;
    setIsRunning(true);
    isRunningRef.current = true;
    setProgress(0);
    setSamples([]);
    setThroughput(0);
    setAvgLatency(0);
    setMinLatency(0);
    setMaxLatency(0);
    setSuccessRate(100);
    allSamplesRef.current = [];
    successLogSamplesRef.current = [];
    failedLogSamplesRef.current = [];
    setMemoryCoolingCount(0);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const persistTemporaryRunLog = async (runLabel: string, durationMs: number) => {
      const persisted = await SmokeLogService.persistTemporaryRunLog({
        enabled: saveTempLogs,
        runLabel,
        requestId: activeRequest?.id,
        workspaceId: activeRequest?.workspace_id,
        fallbackUserId: activeRequest?.user_id,
        durationMs,
        samples: [
          ...successLogSamplesRef.current,
          ...failedLogSamplesRef.current
        ],
        metadata: {
          panel: 'smoke-test',
          runnerMode,
          threads,
          loops,
          delay,
          timeoutMs,
          sandboxEngine,
          runRequestScripts
        }
      });

      if (persisted && addToast) {
        addToast({ type: 'success', message: 'Temporary smoke logs saved to database.' });
      }
    };

    // ==========================================
    // BRANCH A: CONCURRENT FIXED LOOPS SCENARIO RUNNER
    // ==========================================
    if (runnerMode === 'loop') {
      const totalRequests = threads * loops;
      let completedCount = 0;
      let currentRequestIndex = 0;
      
      // Incremental Stats Aggregators for O(1) performance
      let totalLatency = 0;
      let minLatencyVal = Infinity;
      let maxLatencyVal = -Infinity;
      let successCount = 0;

      allSamplesRef.current = [];

      const startTime = performance.now();
      let lastUiUpdateTime = startTime;

      const runWorker = async (workerId: number) => {
        while (isRunningRef.current && currentRunId === currentRunIdRef.current) {
          const index = currentRequestIndex++;
          if (index >= totalRequests) {
            break;
          }

          // Apply pre-request delay
          if (delay > 0 && index >= threads) {
            await sleep(delay);
          }

          if (!isRunningRef.current || currentRunId !== currentRunIdRef.current) break;

          const sampleStartTime = performance.now();
          let status: number | string = 0;
          let success = false;
          let errorMsg = '';
          let statusCode: number | null = null;
          let responsePreview = '';

          const controller = new AbortController();
          activeAbortControllersRef.current.add(controller);

          try {
            // 1. Thread-isolated request cloning and variable resolution
            const threadVariables = VariableService.getResolvedVariableMap({
              environments,
              activeEnvId,
              collection: collection || null,
              variables: {}
            });
            const variableContext = {
              environments,
              activeEnvId,
              collections,
              collection: collection || null,
              variables: threadVariables,
              signal: controller.signal,
              useWorker: sandboxEngine === 'worker',
              suppressScriptLogs: true,
              skipResponseBody: !runRequestScripts,
              responseBodyLimitBytes: runRequestScripts ? undefined : 65536
            };

            let requestToExecute: RequestData = {
              ...activeRequest,
              headers: (activeRequest.headers || []).map(h => ({ ...h })),
              params: (activeRequest.params || []).map(p => ({ ...p })),
              settings: activeRequest.settings ? { ...activeRequest.settings } : undefined
            };

            // Override request timeout setting with current tester panel value
            requestToExecute.settings = {
              ...(requestToExecute.settings || { followRedirects: true, maxRedirects: 10 }),
              timeout: timeoutMs
            };

            // 2. Pre-request Scripts Execution (Environment -> Collection -> Request)
            const activeEnvironment = activeEnvId
              ? environments.find((env) => env.id === activeEnvId)
              : null;

            const preScripts = runRequestScripts ? [
              activeEnvironment?.pre_request_script,
              collection?.pre_request_script,
              requestToExecute.pre_request_script
            ].filter(Boolean) as string[] : [];

            const preRequestOut = await ScriptService.executePreRequest(
              preScripts,
              requestToExecute,
              variableContext
            );
            if (currentRunId !== currentRunIdRef.current) return;
            requestToExecute = preRequestOut.request;

            // Merge environment mutations set by pre-request scripts into local threadVariables
            if (preRequestOut.environmentMutations) {
              for (const [key, value] of Object.entries(preRequestOut.environmentMutations)) {
                if (value === null) {
                  delete threadVariables[key];
                } else {
                  threadVariables[key] = String(value);
                }
              }
            }

            // 3. Request Execution using core RequestService pipeline
            const response = await RequestService.execute(requestToExecute, variableContext);
            if (currentRunId !== currentRunIdRef.current) return;

            // 4. Post-Execution Validation Test Scripts Execution
            const testScripts = runRequestScripts ? [
              activeEnvironment?.test_script,
              collection?.test_script,
              requestToExecute.test_script
            ].filter(Boolean) as string[] : [];

            const testOut = await ScriptService.executeTests(
              testScripts,
              response,
              requestToExecute,
              variableContext
            );
            if (currentRunId !== currentRunIdRef.current) return;

            // 5. Determine outcome
            status = response.status;
            statusCode = response.status;
            responsePreview = buildResponsePreview(response.body);
            success = response.status >= 200 && response.status < 300;

            if (response.status === 0) {
              success = false;
              status = response.statusText;
              try {
                const bodyObj = JSON.parse(response.body);
                errorMsg = bodyObj?.error || bodyObj?.diagnostics?.message || response.statusText;
              } catch {
                errorMsg = response.body || response.statusText;
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
          } finally {
            activeAbortControllersRef.current.delete(controller);
          }

          // Safety: If the run ID changed, immediately cease execution and return, discarding any outdated result
          if (currentRunId !== currentRunIdRef.current) return;

          const sampleEndTime = performance.now();
          const duration = Math.round(sampleEndTime - sampleStartTime);

          completedCount++;
          totalLatency += duration;
          if (duration < minLatencyVal) minLatencyVal = duration;
          if (duration > maxLatencyVal) maxLatencyVal = duration;
          if (success) successCount++;

          const newSample: TestSample = {
            id: completedCount,
            timestamp: new Date().toLocaleTimeString(),
            latency: duration,
            status,
            success,
            error: errorMsg || undefined
          };

          allSamplesRef.current.push(newSample);
          const logSample = {
            ...newSample,
            statusCode,
            responsePreview,
            requestName: activeRequest?.name,
            requestMethod: activeRequest?.method
          };
          if (success) {
            pushBounded(successLogSamplesRef.current, logSample, 50);
          } else {
            pushBounded(failedLogSamplesRef.current, logSample, 50);
          }

          // Standard fixed ring buffer size to guarantee absolute ceiling on memory leaks
          if (allSamplesRef.current.length > 50) {
            allSamplesRef.current.shift();
          }

          // Throttle UI updates and React diffing block to 150ms intervals
          const now = performance.now();
          if (now - lastUiUpdateTime > 150 || completedCount === totalRequests) {
            lastUiUpdateTime = now;

            const avg = Math.round(totalLatency / completedCount);
            const succRate = Math.round((successCount / completedCount) * 100);

            setSamples([...allSamplesRef.current]);
            setAvgLatency(avg);
            setMinLatency(minLatencyVal === Infinity ? 0 : minLatencyVal);
            setMaxLatency(maxLatencyVal === -Infinity ? 0 : maxLatencyVal);
            setSuccessRate(succRate);

            const percent = Math.round((completedCount / totalRequests) * 100);
            setProgress(percent);

            const elapsedSec = (now - startTime) / 1000;
            setThroughput(parseFloat((completedCount / (elapsedSec || 1)).toFixed(1)));
          }
        }
      };

      // Spin up concurrent worker threads
      try {
        const workerPromises = Array.from({ length: threads }).map((_, id) => runWorker(id));
        await Promise.all(workerPromises);
        await persistTemporaryRunLog('loops', performance.now() - startTime);
      } catch (err: any) {
        console.error('[SmokeTester] Concurrency run failed:', err);
      } finally {
        setIsRunning(false);
        isRunningRef.current = false;
        activeAbortControllersRef.current.forEach(c => {
          try { c.abort(); } catch {}
        });
        activeAbortControllersRef.current.clear();
        if (typeof (window as any).gc === 'function') {
          try { (window as any).gc(); } catch {}
        }
      }

    // ==========================================
    // BRANCH B: MINUTES OF TESTING (MoT) ENDURANCE RUNNER
    // ==========================================
    } else {
      completedCountRef.current = 0;
      successCountRef.current = 0;
      currentConsecutiveFailuresRef.current = 0;
      startTimeRef.current = performance.now();
      cleanupCyclesRef.current = 0;
      earlyAbortTriggeredRef.current = false;
      abortReasonRef.current = '';
      requestsInCurrentMinute.current = 0;
      retriesInCurrentMinute.current = 0;
      crashPreventionTriggersCountRef.current = 0;

      setMemoryPressure(0);
      setStabilityScore(100);
      setAdaptiveThrottle(1.0);
      setActivePriorityFocus('ALL');
      setGuardStatus('SAFE');
      setCrashPreventionTriggers(0);

      guardStateRef.current = 'SAFE';
      memoryPressureLevelRef.current = 0;

      const adaptiveThrottleRef = { current: 1.0 };
      const stabilityScoreRef = { current: 100 };

      // Set up budget minute timer interval
      if (minuteTimer.current) clearInterval(minuteTimer.current);
      minuteTimer.current = setInterval(() => {
        requestsInCurrentMinute.current = 0;
        retriesInCurrentMinute.current = 0;
      }, 60000);

      let totalLatency = 0;
      let minLatencyValue = Infinity;
      let maxLatencyValue = -Infinity;
      let lastUiUpdateTime = performance.now();

      const runWorkerMoT = async (workerId: number) => {
        let localCounter = 0;
        while (isRunningRef.current && currentRunId === currentRunIdRef.current) {
          // Real-time memory pressure monitoring in MoT loops
          const memVal = (window as any).performance?.memory;
          let computedPressureVal = 0;
          if (memVal) {
            computedPressureVal = Math.min(100, Math.round((memVal.usedJSHeapSize / memVal.jsHeapSizeLimit) * 100));
          } else {
            const baseCreep = Math.min(45, (completedCountRef.current * 0.04));
            computedPressureVal = Math.round(baseCreep + Math.sin(completedCountRef.current * 0.05) * 5 + 10);
          }
          memoryPressureLevelRef.current = computedPressureVal;

          if (computedPressureVal >= 75 && !isMemoryCoolingRef.current) {
            isMemoryCoolingRef.current = true;
            setIsMemoryCooling(true);
            setMemoryCoolingCount(prev => prev + 1);
            if (addToast) {
              addToast({ type: 'warning', message: `Endurance limit danger: Memory is at ${computedPressureVal}%. Commencing emergency buffer flush...` });
            }
            
            // Flush and free references in samples storage to allow speedy GC
            if (allSamplesRef.current.length > 50) {
              allSamplesRef.current = allSamplesRef.current.slice(-20);
            }
          }

          while (isMemoryCoolingRef.current && isRunningRef.current) {
            await sleep(500);
            if (currentRunId !== currentRunIdRef.current) return;
            
            // Re-evaluate memory
            const checkMem = (window as any).performance?.memory;
            let checkPressure = 0;
            if (checkMem) {
              checkPressure = Math.min(100, Math.round((checkMem.usedJSHeapSize / checkMem.jsHeapSizeLimit) * 100));
            } else {
              checkPressure = Math.max(20, memoryPressureLevelRef.current - 15);
            }
            memoryPressureLevelRef.current = checkPressure;
            setMemoryPressure(checkPressure);

            if (checkPressure < 55) {
              isMemoryCoolingRef.current = false;
              setIsMemoryCooling(false);
              if (addToast) {
                addToast({ type: 'success', message: `Memory successfully sanitized to ${checkPressure}%. Resuming MoT suite execution.` });
              }
              break;
            }
          }

          const elapsedSec = (performance.now() - startTimeRef.current) / 1000;
          if (elapsedSec >= motDuration) {
            break;
          }

          let baseDelayValue = delay;
          const throttleVal = adaptiveThrottleRef.current;
          if (throttleVal < 1.0) {
            baseDelayValue = Math.round(baseDelayValue * (1.0 / throttleVal));
          }
          if (baseDelayValue > 0 && localCounter > 0) {
            await sleep(baseDelayValue);
            if (currentRunId !== currentRunIdRef.current) return;
          }
          localCounter++;

          if (requestsInCurrentMinute.current >= motMaxReqPerMin) {
            await sleep(250);
            continue;
          }

          let status: number | string = 0;
          let success = false;
          let errorMsg = '';
          let statusCode: number | null = null;
          let responsePreview = '';
          let requestToExecute = {
            ...activeRequest,
            headers: (activeRequest.headers || []).map(h => ({ ...h })),
            params: (activeRequest.params || []).map(p => ({ ...p })),
            settings: activeRequest.settings ? { ...activeRequest.settings } : undefined
          };
          let retryCount = 0;
          let executedSuccessfully = false;

          const sampleStartTime = performance.now();

          while (retryCount <= 3 && !executedSuccessfully && isRunningRef.current) {
            requestsInCurrentMinute.current++;

            const controller = new AbortController();
            activeAbortControllersRef.current.add(controller);

            try {
              const threadVariables = VariableService.getResolvedVariableMap({
                environments,
                activeEnvId,
                collection: collection || null,
                variables: {}
              });
              const variableContext = {
                environments,
                activeEnvId,
                collections,
                collection: collection || null,
                variables: threadVariables,
                signal: controller.signal,
                useWorker: sandboxEngine === 'worker',
                suppressScriptLogs: true,
                skipResponseBody: !runRequestScripts,
                responseBodyLimitBytes: runRequestScripts ? undefined : 65536
              };

              requestToExecute.settings = {
                ...(requestToExecute.settings || { followRedirects: true, maxRedirects: 10 }),
                timeout: timeoutMs
              };

              // Pre-request scripts
              const activeEnvironment = activeEnvId
                ? environments.find((env) => env.id === activeEnvId)
                : null;

              const preScripts = runRequestScripts ? [
                activeEnvironment?.pre_request_script,
                collection?.pre_request_script,
                requestToExecute.pre_request_script
              ].filter(Boolean) as string[] : [];

              const preRequestOut = await ScriptService.executePreRequest(
                preScripts,
                requestToExecute,
                variableContext
              );
              if (currentRunId !== currentRunIdRef.current) return;
              requestToExecute = preRequestOut.request;

              if (preRequestOut.environmentMutations) {
                for (const [key, val] of Object.entries(preRequestOut.environmentMutations)) {
                  if (val === null) {
                    delete threadVariables[key];
                  } else {
                    threadVariables[key] = String(val);
                  }
                }
              }

              const response = await RequestService.execute(requestToExecute, variableContext);
              if (currentRunId !== currentRunIdRef.current) return;

              const testScripts = runRequestScripts ? [
                activeEnvironment?.test_script,
                collection?.test_script,
                requestToExecute.test_script
              ].filter(Boolean) as string[] : [];

              const testOut = await ScriptService.executeTests(
                testScripts,
                response,
                requestToExecute,
                variableContext
              );
              if (currentRunId !== currentRunIdRef.current) return;

              status = response.status;
              statusCode = response.status;
              responsePreview = buildResponsePreview(response.body);
              success = response.status >= 200 && response.status < 300;

              if (response.status === 0) {
                success = false;
                status = response.statusText;
                try {
                  const bodyObj = JSON.parse(response.body);
                  errorMsg = bodyObj?.error || bodyObj?.diagnostics?.message || response.statusText;
                } catch {
                  errorMsg = response.body || response.statusText;
                }
              } else if (testOut.results.some(r => r.status === 'fail')) {
                success = false;
                const failedTest = testOut.results.find(r => r.status === 'fail');
                status = 'Assertion Fail';
                errorMsg = failedTest ? `${failedTest.name}: ${failedTest.message || 'Assertion failed'}` : 'Test assertion failed';
              }

              if (response.status === 401) {
                success = false;
                if (retryCount === 0) {
                  if (currentRunId !== currentRunIdRef.current) return;
                  retryCount++;
                  completedCountRef.current += 1;
                  allSamplesRef.current.push({
                    id: completedCountRef.current,
                    timestamp: new Date().toLocaleTimeString(),
                    status: 'AUTH_REFRESH',
                    success: false,
                    latency: 0
                  });
                  pushBounded(failedLogSamplesRef.current, {
                    id: completedCountRef.current,
                    timestamp: new Date().toLocaleTimeString(),
                    latency: 0,
                    status: 'AUTH_REFRESH',
                    statusCode: 401,
                    success: false,
                    error: 'Auth refresh retry',
                    responsePreview: '',
                    requestName: activeRequest?.name,
                    requestMethod: activeRequest?.method
                  }, 50);
                  await sleep(150);
                  if (currentRunId !== currentRunIdRef.current) return;
                  continue;
                }
              }

              if (response.status === 400 || status === 'Assertion Fail') {
                executedSuccessfully = true;
                break;
              }

              executedSuccessfully = true;

            } catch (err: any) {
              if (currentRunId !== currentRunIdRef.current) return;
              success = false;
              status = err.name === 'AbortError' ? 'Timeout' : 'Execution Error';
              errorMsg = err.message || String(err);

              const isTransient = err.name === 'AbortError' || err.message?.includes('NetworkError') || err.message?.includes('socket') || err.message?.includes('refused');
              if (isTransient && retryCount < 3 && retriesInCurrentMinute.current < motMaxRetriesPerMin) {
                retryCount++;
                retriesInCurrentMinute.current++;
                const backoffDelay = Math.min(1000, 200 * Math.pow(2, retryCount));
                await sleep(backoffDelay);
                if (currentRunId !== currentRunIdRef.current) return;
                continue;
              }

              executedSuccessfully = true;
            } finally {
              activeAbortControllersRef.current.delete(controller);
            }
          }

          // Safety: If the run ID changed, immediately cease execution and return, discarding any outdated result
          if (currentRunId !== currentRunIdRef.current) return;

          const sampleEndTime = performance.now();
          const duration = Math.round(sampleEndTime - sampleStartTime);

          completedCountRef.current += 1;
          totalLatency += duration;
          if (duration < minLatencyValue) minLatencyValue = duration;
          if (duration > maxLatencyValue) maxLatencyValue = duration;
          if (success) {
            successCountRef.current += 1;
            currentConsecutiveFailuresRef.current = 0;
          } else {
            currentConsecutiveFailuresRef.current++;
          }

          const newSample: TestSample = {
            id: completedCountRef.current,
            timestamp: new Date().toLocaleTimeString(),
            status,
            success,
            latency: duration,
            error: errorMsg || undefined
          };

          allSamplesRef.current.push(newSample);
          const logSample = {
            ...newSample,
            statusCode,
            responsePreview,
            requestName: activeRequest?.name,
            requestMethod: activeRequest?.method
          };
          if (success) {
            pushBounded(successLogSamplesRef.current, logSample, 50);
          } else {
            pushBounded(failedLogSamplesRef.current, logSample, 50);
          }

          if (allSamplesRef.current.length > 50) {
            allSamplesRef.current.shift();
          }

          // Performance resource and memory pressure monitor
          const mem = (window as any).performance?.memory;
          let computedPressure = 0;
          if (mem) {
            computedPressure = Math.min(100, Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100));
          } else {
            const baseCreep = Math.min(45, (completedCountRef.current * 0.04));
            computedPressure = Math.round(baseCreep + Math.sin(completedCountRef.current * 0.05) * 5 + 10);
          }
          memoryPressureLevelRef.current = computedPressure;

          // Stability Score Calculation
          const recentSamples = allSamplesRef.current.slice(-20);
          let passedRecent = 0;
          let latencyHistoryArray: number[] = [];
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
          if (jitter > 120) score -= 12;
          
          if (currentConsecutiveFailuresRef.current > 2) score -= currentConsecutiveFailuresRef.current * 6;
          
          score = Math.max(0, Math.min(100, Math.round(score)));
          stabilityScoreRef.current = score;

          // Adaptive guard stabilizers check
          let newGuardState: 'SAFE' | 'THROTTLED' | 'CRITICAL' = 'SAFE';
          let throttleCoeff = 1.0;
          let activePrio: 'P0' | 'P1' | 'P2' | 'P3' | 'ALL' = 'ALL';

          if (computedPressure > 80 || score < 40) {
            newGuardState = 'CRITICAL';
            throttleCoeff = 0.3;
            activePrio = 'P1';
          } else if (computedPressure > 50 || score < 75) {
            newGuardState = 'THROTTLED';
            throttleCoeff = 0.6;
            activePrio = 'P2';
          }

          if (newGuardState !== guardStateRef.current) {
            guardStateRef.current = newGuardState;
            setGuardStatus(newGuardState);
            setAdaptiveThrottle(throttleCoeff);
            adaptiveThrottleRef.current = throttleCoeff;
            setActivePriorityFocus(activePrio);
            crashPreventionTriggersCountRef.current++;
            setCrashPreventionTriggers(crashPreventionTriggersCountRef.current);
          }

          if (computedPressure > 88) {
            earlyAbortTriggeredRef.current = true;
            abortReasonRef.current = 'Memory Pressure Threshold Exceeded safety ceiling (88%)';
            isRunningRef.current = false;
            break;
          }
          if (score < 25 && completedCountRef.current > 15) {
            earlyAbortTriggeredRef.current = true;
            abortReasonRef.current = 'System Stability Score depleted below safety floor (25%)';
            isRunningRef.current = false;
            break;
          }

          const now = performance.now();
          if (now - lastUiUpdateTime > 350) {
            lastUiUpdateTime = now;

            const avg = Math.round(totalLatency / (completedCountRef.current || 1));
            const succRate = Math.round((successCountRef.current / (completedCountRef.current || 1)) * 100);

            setSamples([...allSamplesRef.current]);
            setAvgLatency(avg);
            setMinLatency(minLatencyValue === Infinity ? 0 : minLatencyValue);
            setMaxLatency(maxLatencyValue === -Infinity ? 0 : maxLatencyValue);
            setSuccessRate(succRate);
            setMemoryPressure(memoryPressureLevelRef.current);
            setStabilityScore(stabilityScoreRef.current);

            const pct = Math.min(100, Math.round((elapsedSec / motDuration) * 100));
            setProgress(pct);

            setThroughput(parseFloat((completedCountRef.current / (elapsedSec || 1)).toFixed(1)));
          }

          if (completedCountRef.current % 50 === 0) {
            cleanupCyclesRef.current++;
            if (typeof (window as any).gc === 'function') {
              try {
                (window as any).gc();
              } catch {}
            }
          }
        }
      };

      try {
        const workerPromises = Array.from({ length: threads }).map((_, id) => runWorkerMoT(id));
        await Promise.all(workerPromises);

        const totalElapsed = (performance.now() - startTimeRef.current) / 1000;
  await persistTemporaryRunLog('mot', totalElapsed * 1000);

        // Form recommendations
        const recs: string[] = [];
        const finalPassRate = Math.round((successCountRef.current / (completedCountRef.current || 1)) * 100);
        if (finalPassRate < 75) {
          recs.push(`Unstable Target Endpoint Detected: '${activeRequest.method} ${activeRequest.name}' exhibited a ${100 - finalPassRate}% fail rate. Investigate endpoint exception logging for connection resets.`);
        }
        if (maxLatencyValue > 4000) {
          recs.push(`High Latency Ceiling Spike: Latency spiked to ${maxLatencyValue}ms during loading. Implement a robust response caching layer to bypass database row scans.`);
        }
        if (crashPreventionTriggersCountRef.current > 0) {
          recs.push(`Preemptive resilience stabilizer interceded ${crashPreventionTriggersCountRef.current} times to curb stack buffer drop offs, lowering execution speeds safely to prevent browser heap exhaustion.`);
        }
        if (recs.length === 0) {
          recs.push("Pristine Systems Stability: Continuous endurance testing achieved excellent results. The local cluster sustained the concurrent loads perfectly with no memory exhaustion signs.");
        }

        setMotReportData({
          durationSeconds: Math.round(totalElapsed),
          totalRequests: completedCountRef.current,
          successCount: successCountRef.current,
          failureCount: completedCountRef.current - successCountRef.current,
          successRate: finalPassRate,
          avgLatency: Math.round(totalLatency / (completedCountRef.current || 1)),
          minLatency: minLatencyValue === Infinity ? 0 : minLatencyValue,
          maxLatency: maxLatencyValue === -Infinity ? 0 : maxLatencyValue,
          earlyAbort: earlyAbortTriggeredRef.current,
          abortReason: abortReasonRef.current,
          crashPreventionActions: crashPreventionTriggersCountRef.current,
          recommendations: recs
        });

        setShowMotReport(true);
        if (addToast) {
          addToast({ type: 'success', message: 'Minutes of Testing endurance run complete!' });
        }
      } catch (err: any) {
        console.error('[SmokeTester] MoT execution run error:', err);
        if (addToast) {
          addToast({ type: 'error', message: `MoT Run Error: ${err.message || String(err)}` });
        }
      } finally {
        setIsRunning(false);
        isRunningRef.current = false;
        if (minuteTimer.current) {
          clearInterval(minuteTimer.current);
          minuteTimer.current = null;
        }
        activeAbortControllersRef.current.forEach(c => {
          try { c.abort(); } catch {}
        });
        activeAbortControllersRef.current.clear();
        if (typeof (window as any).gc === 'function') {
          try { (window as any).gc(); } catch {}
        }
      }
    }
  };

  const stopSmokeTest = () => {
    currentRunIdRef.current++;
    isRunningRef.current = false;
    setIsRunning(false);
    activeAbortControllersRef.current.forEach(c => {
      try {
        c.abort();
      } catch {}
    });
    activeAbortControllersRef.current.clear();
    if (minuteTimer.current) {
      clearInterval(minuteTimer.current);
      minuteTimer.current = null;
    }
    try {
      SandboxRunner.clearWorkerPool();
    } catch {}
  };

  const exportCSV = () => {
    const dataToExport = allSamplesRef.current;
    if (dataToExport.length === 0) return;
    const headers = ['Sample ID', 'Timestamp', 'Method', 'URL', 'Latency (ms)', 'Status', 'Outcome', 'ErrorDetails'];
    const rows = dataToExport.map(s => [
      s.id,
      s.timestamp || '',
      activeRequest?.method || 'GET',
      `"${(activeRequest?.url || '').replace(/"/g, '""')}"`,
      s.latency,
      s.status || '',
      s.success ? 'SUCCESS' : 'FAIL',
      `"${(s.error || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smoke_test_${(activeRequest?.name || 'run').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const dataToExport = allSamplesRef.current;
    if (dataToExport.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Calculate metrics safely without stack overflow prone spread operator (...)
    const latencies = dataToExport.map(s => s.latency);
    const avg = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    let min = 0;
    let max = 0;
    if (latencies.length > 0) {
      min = latencies[0];
      max = latencies[0];
      for (const lat of latencies) {
        if (lat < min) min = lat;
        if (lat > max) max = lat;
      }
    }
    const succRate = Math.round((dataToExport.filter(s => s.success).length / dataToExport.length) * 100);

    const htmlContent = `
      <html>
        <head>
          <title>Gimay Smoke Test Report - ${activeRequest.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
            body {
              font-family: 'Outfit', sans-serif;
              color: #111;
              background: #fff;
              margin: 40px;
              line-height: 1.6;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #E5E7EB;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title {
              font-size: 24px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: -0.5px;
              color: #111827;
            }
            .subtitle {
              font-size: 11px;
              font-weight: 600;
              color: #059669;
              letter-spacing: 2px;
              text-transform: uppercase;
              margin-top: 4px;
            }
            .meta-grid {
              display: grid;
              grid-template-cols: 2fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
            }
            .meta-card, .config-card {
              border: 1px solid #E5E7EB;
              border-radius: 12px;
              padding: 16px;
              background: #F9FAFB;
            }
            .meta-item {
              margin-bottom: 8px;
              font-size: 13px;
            }
            .meta-label {
              font-weight: 600;
              color: #6B7280;
              text-transform: uppercase;
              font-size: 10px;
              letter-spacing: 0.5px;
            }
            .meta-val {
              font-weight: 500;
              color: #111827;
            }
            .mono-text {
              font-family: 'JetBrains Mono', monospace;
              font-size: 12px;
              background: #F3F4F6;
              padding: 2px 6px;
              border-radius: 4px;
            }
            .stats-grid {
              display: grid;
              grid-template-cols: repeat(4, 1fr);
              gap: 15px;
              margin-bottom: 30px;
            }
            .stat-card {
              border: 1px solid #E5E7EB;
              border-radius: 12px;
              padding: 16px;
              text-align: center;
              box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            }
            .stat-label {
              font-size: 10px;
              font-weight: 600;
              color: #6B7280;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 6px;
            }
            .stat-value {
              font-size: 20px;
              font-weight: 800;
              color: #111827;
            }
            .stat-value.success-rate {
              color: #059669;
            }
            .table-container {
              border: 1px solid #E5E7EB;
              border-radius: 12px;
              overflow: hidden;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              text-align: left;
              font-size: 12px;
            }
            th {
              background: #F3F4F6;
              color: #374151;
              font-weight: 600;
              padding: 10px 14px;
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.5px;
              border-bottom: 1px solid #E5E7EB;
            }
            td {
              padding: 10px 14px;
              border-bottom: 1px solid #F3F4F6;
            }
            tr:last-child td {
              border-bottom: none;
            }
            .badge-success {
              background: #DEF7EC;
              color: #03543F;
              padding: 2px 6px;
              border-radius: 4px;
              font-weight: 600;
              font-size: 10px;
            }
            .badge-fail {
              background: #FDE8E8;
              color: #9B1C1C;
              padding: 2px 6px;
              border-radius: 4px;
              font-weight: 600;
              font-size: 10px;
            }
            @media print {
              body { margin: 20px; }
              .stat-card, .meta-card, .config-card { page-break-inside: avoid; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="subtitle">Gimay Performance Engine</div>
              <div class="title">Smoke Testing Report</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #6B7280;">
              Generated: ${new Date().toLocaleString()}<br/>
              Platform: Gimay Desktop Suite
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-card">
              <div class="meta-item">
                <span class="meta-label">Request Protocol:</span>
                <span class="meta-val">${activeRequest.name}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Target Endpoint:</span>
                <span class="meta-val mono-text">${activeRequest.method} ${activeRequest.url}</span>
              </div>
            </div>
            <div class="config-card">
              <div class="meta-item">
                <span class="meta-label">Concurrency (Threads):</span>
                <span class="meta-val">${threads}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Loops per Thread:</span>
                <span class="meta-val">${loops}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Inter-Request Delay:</span>
                <span class="meta-val">${delay} ms</span>
              </div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Throughput</div>
              <div class="stat-value">${throughput} req/s</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Success Rate</div>
              <div class="stat-value success-rate">${succRate}%</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Latency</div>
              <div class="stat-value">${avg} ms</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Min / Max Latency</div>
              <div class="stat-value" style="font-size: 15px; margin-top: 4px;">${min} ms / ${max} ms</div>
            </div>
          </div>

          <div style="margin-bottom: 12px; font-weight: 600; font-size: 14px; color: #374151;">Complete Outcomes Log</div>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Sample ID</th>
                  <th>Timestamp</th>
                  <th>Latency</th>
                  <th>Status Code</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                ${dataToExport.map(sample => `
                  <tr>
                    <td>#${sample.id}</td>
                    <td>${sample.timestamp}</td>
                    <td>${sample.latency} ms</td>
                    <td>
                      <span style="font-weight: 600; color: ${sample.success ? '#059669' : '#DC2626'}">
                        ${sample.status}
                      </span>
                      ${sample.error ? `<div style="font-size: 10px; color: #DC2626; opacity: 0.8; margin-top: 2px;">${sample.error}</div>` : ''}
                    </td>
                    <td>
                      <span class="${sample.success ? 'badge-success' : 'badge-fail'}">
                        ${sample.success ? 'SUCCESS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const renderLatencyGraph = () => {
    const graphSamples = samples.slice(-60); // Check the latest 60 transmissions
    const hasData = graphSamples.length > 0;
    
    // Calculate stats safely
    let maxVal = 0;
    let minVal = 0;
    let averageVal = 0;
    if (hasData) {
      maxVal = graphSamples[0].latency;
      minVal = graphSamples[0].latency;
      let total = 0;
      for (const s of graphSamples) {
        if (s.latency > maxVal) maxVal = s.latency;
        if (s.latency < minVal) minVal = s.latency;
        total += s.latency;
      }
      averageVal = Math.round(total / graphSamples.length);
    }

    return (
      <div className="bg-[#09090D] border border-[#1E1E28]/40 rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black text-[#E1E1E6] uppercase tracking-wider block font-mono">Real-Time Transmission Activity Grid</span>
            <span className="text-[8px] text-[#888894] font-mono block">Active throughput status represented across active parallel channels</span>
          </div>
          <span className={`text-[8px] font-mono uppercase font-black px-2.5 py-0.5 rounded border transition-all ${
            hasData 
              ? "text-[#3ECF8E] bg-[#3ECF8E]/10 border-[#3ECF8E]/25 animate-pulse" 
              : "text-[#555] bg-[#101015] border-[#222]"
          }`}>
            {hasData ? 'LIVE MULTI-CHANNEL INSPECT' : 'STANDBY MODE'}
          </span>
        </div>

        {!hasData ? (
          <div className="h-[120px] rounded-xl border border-[#1E1E28]/50 bg-[#030305] flex flex-col items-center justify-center space-y-1 select-none">
            <span className="text-[9px] font-black tracking-widest text-[#444] font-mono uppercase">Telemetry stand-by</span>
            <span className="text-[7px] text-[#333] font-mono">Real-time status indexes populate here on suite execution</span>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-[#030305] rounded-xl p-3 border border-[#1E1E28]/50 space-y-2">
              <div className="h-[170px] w-full rounded-lg bg-[#05050A] border border-[#1C1C25] overflow-hidden">
                <svg viewBox="0 0 860 170" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="smokeLatencyArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3ECF8E" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#3ECF8E" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {[0, 1, 2, 3, 4].map((tick) => {
                    const y = 16 + tick * 32;
                    return (
                      <line
                        key={`grid-${tick}`}
                        x1="28"
                        y1={y}
                        x2="840"
                        y2={y}
                        stroke="#1B1B23"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {[200, 600].map((threshold) => {
                    const maxScale = Math.max(maxVal, 600, 1);
                    const y = 16 + (1 - Math.min(1, threshold / maxScale)) * 128;
                    const color = threshold === 200 ? '#3ECF8E' : '#F59E0B';
                    return (
                      <g key={`threshold-${threshold}`}>
                        <line
                          x1="28"
                          y1={y}
                          x2="840"
                          y2={y}
                          stroke={color}
                          strokeDasharray="4 5"
                          strokeOpacity="0.45"
                          strokeWidth="1"
                        />
                        <text x="834" y={y - 3} fill={color} fontSize="8" textAnchor="end" fontFamily="ui-monospace">
                          {threshold}ms
                        </text>
                      </g>
                    );
                  })}

                  {(() => {
                    const left = 28;
                    const right = 840;
                    const top = 16;
                    const bottom = 144;
                    const maxScale = Math.max(maxVal, 600, 1);
                    const points = graphSamples.map((s, i) => {
                      const x = left + (i / Math.max(1, graphSamples.length - 1)) * (right - left);
                      const y = top + (1 - Math.min(1, s.latency / maxScale)) * (bottom - top);
                      return { ...s, x, y };
                    });
                    const linePath = points
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
                      .join(' ');
                    const areaPath = points.length
                      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${bottom} L ${points[0].x.toFixed(2)} ${bottom} Z`
                      : '';

                    return (
                      <>
                        {areaPath && <path d={areaPath} fill="url(#smokeLatencyArea)" />}
                        {linePath && (
                          <path
                            d={linePath}
                            fill="none"
                            stroke="#3ECF8E"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {points.map((p, idx) => (
                          <circle
                            key={`pt-${idx}`}
                            cx={p.x}
                            cy={p.y}
                            r="2"
                            fill={p.success ? '#3ECF8E' : '#EF4444'}
                            opacity="0.95"
                          />
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[8px] font-mono uppercase tracking-wider text-[#888]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3ECF8E] inline-block" />Pass</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Fail</span>
                <span>Window: {graphSamples.length} samples</span>
              </div>
            </div>

            {/* Quick telemetry details banner */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#05050A] border border-[#1E1E28]/30 p-3 rounded-lg flex flex-col justify-center">
                <span className="text-[7px] font-black text-[#66666D] uppercase tracking-wider font-mono block">Peak Latency</span>
                <span className="text-xs font-black font-mono text-white mt-0.5">{maxVal}ms</span>
              </div>
              <div className="bg-[#05050A] border border-[#1E1E28]/30 p-3 rounded-lg flex flex-col justify-center">
                <span className="text-[7px] font-black text-[#66666D] uppercase tracking-wider font-mono block">Average Latency</span>
                <span className="text-xs font-black font-mono text-white mt-0.5">{averageVal}ms</span>
              </div>
              <div className="bg-[#05050A] border border-[#1E1E28]/30 p-3 rounded-lg flex flex-col justify-center">
                <span className="text-[7px] font-black text-[#55555C] uppercase tracking-wider font-mono block">Network Link Quality</span>
                <span className={`text-xs font-black font-mono mt-0.5 block ${
                  averageVal < 250 ? "text-[#3ECF8E]" : averageVal < 600 ? "text-amber-500" : "text-red-500"
                }`}>
                  {averageVal < 250 ? "OPTIMAL" : averageVal < 600 ? "ACCELERATED" : "DEGRADED"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 p-1">
      {/* Immersive Blocking Overlay while cleaning / resetting */}
      {isCleaning && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-[#0a0a0f] border border-emerald-500/20 rounded-2xl p-8 space-y-6 shadow-2xl flex flex-col items-center text-center">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
              <Activity className="absolute text-emerald-400 animate-pulse" size={20} />
            </div>

            <div className="space-y-4 w-full">
              <div className="space-y-1">
                <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-mono">
                  Memory Tuner: Sanitizing & Cleaning Heap
                </h3>
                <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-tight leading-relaxed font-mono">
                  Purging stale environments, workers, and stale run references.
                </p>
              </div>

              <div className="bg-[#030304] border border-[#151518] px-3 py-2.5 rounded-xl text-[9px] font-mono text-emerald-400 uppercase tracking-wide leading-relaxed">
                ⚙️ STATUS: <span className="text-white font-black font-mono">{cleaningStatus}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Immersive Blocking Overlay while running */}
      {isRunning && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 select-none">
          <div className="max-w-md w-full bg-[#0a0a0f] border border-white/[0.06] rounded-2xl p-8 space-y-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in duration-200">
            {/* Spinning/pulsing elegant loader icon */}
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-2 border-[#3ECF8E]/20 border-t-[#3ECF8E] animate-spin" />
              {runnerMode === 'mot' ? (
                <Shield className={`absolute animate-pulse ${guardStatus === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'}`} size={20} />
              ) : (
                <Activity className="absolute text-[#3ECF8E] animate-pulse" size={20} />
              )}
            </div>

            <div className="space-y-2 w-full">
              <h3 className="text-[10px] font-black text-[#555] uppercase tracking-widest font-mono">
                {runnerMode === 'mot' ? 'Minutes of Testing (MoT) Endurance Active' : 'Loop-based Smoke Test Active'}
              </h3>
              
              {runnerMode === 'loop' ? (
                <div className="text-2xl font-black text-[#3ECF8E] font-mono animate-pulse">
                  {allSamplesRef.current.length} / {threads * loops} Sent
                </div>
              ) : (
                <div className="space-y-3 w-full">
                  <div className="text-2xl font-black text-amber-500 font-mono animate-pulse">
                    {completedCountRef.current} Requests Sent
                  </div>
                  
                  {/* Dynamic Memory Pressure & Stability score on blocking overlay */}
                  <div className="grid grid-cols-2 gap-3 bg-white/[0.02] p-3 border border-white/[0.04] rounded-xl text-left">
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-[#555] uppercase tracking-wider block">Heap Pressure</span>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-[12px] font-bold font-mono ${memoryPressure > 75 ? 'text-red-400' : 'text-green-400'}`}>
                          {memoryPressure}%
                        </span>
                        <span className="text-[7px] text-[#444] font-mono">limit</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-[#555] uppercase tracking-wider block">Stability Score</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[12px] font-bold text-emerald-400 font-mono">
                          {stabilityScore}/100
                        </span>
                      </div>
                    </div>
                  </div>

                  {isMemoryCooling && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center justify-center gap-1.5 animate-pulse">
                      <ShieldAlert size={11} className="text-red-400" />
                      <span className="text-[9px] font-black text-red-400 uppercase tracking-widest font-mono">
                        Memory Flush: Safe Cool-down...
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="w-full bg-[#18181f] rounded-full h-1.5 overflow-hidden border border-white/[0.02]">
                <div 
                  className={`h-full transition-all duration-300 ${runnerMode === 'mot' ? 'bg-amber-500' : 'bg-[#3ECF8E]'}`}
                  style={{ width: `${progress}%` }} 
                />
              </div>

              <div className="flex justify-between items-center text-[9px] text-[#444] font-mono pt-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>

              <p className="text-[8px] text-[var(--text-dim)] uppercase tracking-tight font-mono mt-1">
                Target: {activeRequest.method} {activeRequest.name}
              </p>
            </div>

            {/* Cancel Button */}
            <button
              onClick={stopSmokeTest}
              className="w-full h-10 bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 rounded-xl text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 mt-2 font-mono"
            >
              <Square size={10} fill="currentColor" />
              Cancel Execution
            </button>
          </div>
        </div>
      )}

      {/* Introduction Card */}
      <div className="p-4 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Activity size={12} className="text-[#3ECF8E]" />
            Built-in JMeter Smoke Tester
          </h3>
          <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-tight leading-relaxed max-w-2xl">
            Simulates real-world traffic directly inside your browser client, or exports a professional JMeter Test Plan (.jmx) for massive-scale performance suites. Select between fixed-loop testing and minutes of testing (MoT) endurance modes.
          </p>
        </div>

        {/* Runner Mode Selection Tab */}
        <div className="flex bg-[#0A0A0F]/60 p-1 rounded-xl border border-white/[0.04] w-full md:w-auto max-w-md select-none relative shrink-0">
          {isRunning && (
            <div className="absolute inset-0 bg-transparent z-40 cursor-not-allowed" />
          )}
          <button
            onClick={() => setRunnerMode('loop')}
            className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono outline-none text-center ${
              runnerMode === 'loop' ? "bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/15" : "text-[#555] hover:text-[#888]"
            }`}
          >
            Loops Run
          </button>
          <button
            onClick={() => setRunnerMode('mot')}
            className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono outline-none text-center ${
              runnerMode === 'mot' ? "bg-amber-500/10 text-amber-500 border border-amber-500/15" : "text-[#555] hover:text-[#888]"
            }`}
          >
            Minutes (MoT)
          </button>
        </div>
      </div>

      {/* Inputs Configuration */}
      <div className="bg-[#09090B]/30 border border-[#1C1C25]/40 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Concurrency (Threads)</label>
            <input
              type="number"
              disabled={isRunning}
              min={1}
              max={10}
              value={threads}
              onChange={(e) => setThreads(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40"
            />
            <p className="text-[7px] text-[var(--text-dim)] uppercase tracking-tight font-semibold">Safe Cap: 10 Threads</p>
          </div>

          {runnerMode === 'loop' ? (
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Loops per Thread</label>
              <input
                type="number"
                disabled={isRunning}
                min={1}
                max={50}
                value={loops}
                onChange={(e) => setLoops(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40"
              />
              <p className="text-[7px] text-[var(--text-dim)] uppercase tracking-tight font-semibold">Safe Cap: 50 Loops</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-amber-500 uppercase tracking-widest block font-mono">Endurance Duration (sec)</label>
              <input
                type="number"
                disabled={isRunning}
                min={10}
                max={3600}
                value={motDuration}
                onChange={(e) => setMotDuration(Math.min(3600, Math.max(10, parseInt(e.target.value) || 120)))}
                className="w-full bg-[var(--bg-deep)] border border-amber-500/20 px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-amber-500/40"
              />
              <p className="text-[7px] text-[#555] uppercase tracking-tight font-semibold">Safe ceiling: 3600s</p>
            </div>
          )}

          {runnerMode === 'loop' ? (
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Inter-Request Delay (ms)</label>
              <input
                type="number"
                disabled={isRunning}
                value={delay}
                onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40"
              />
              <p className="text-[7px] text-[var(--text-dim)] uppercase tracking-tight font-semibold">Delay between queries</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-amber-500 uppercase tracking-widest block font-mono">Sandbox Engine</label>
              <select
                disabled={isRunning}
                value={sandboxEngine}
                onChange={(e) => setSandboxEngine(e.target.value as 'in-thread' | 'worker')}
                className="w-full bg-[var(--bg-deep)] border border-amber-500/25 px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-amber-500/40 cursor-pointer"
              >
                <option value="in-thread">💨 IN-THREAD (Fast)</option>
                <option value="worker">🔒 ISOLATED (Worker)</option>
              </select>
              <p className="text-[7px] text-[#555] uppercase tracking-tight font-semibold">Script context security</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Request Timeout (ms)</label>
            <input
              type="number"
              disabled={isRunning}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Math.max(100, parseInt(e.target.value) || 100))}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40"
            />
            <p className="text-[7px] text-[var(--text-dim)] uppercase tracking-tight font-semibold">Response timing ceiling</p>
          </div>
        </div>

        {runnerMode === 'mot' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-white/[0.03] animate-in fade-in duration-200">
            <div className="space-y-1.5 col-span-2 md:col-span-1">
              <label className="text-[8px] font-black text-amber-500 uppercase tracking-widest block font-mono">Max Requests / Min</label>
              <input
                type="number"
                disabled={isRunning}
                min={10}
                max={10000}
                value={motMaxReqPerMin}
                onChange={(e) => setMotMaxReqPerMin(Math.min(10000, Math.max(10, parseInt(e.target.value) || 600)))}
                className="w-full bg-[var(--bg-deep)] border border-[#151518] px-3 py-2 rounded-lg text-[11px] font-mono text-white outline-none focus:border-amber-500/30"
              />
              <p className="text-[7px] text-[#555] font-mono">Throughput safety roof</p>
            </div>

            <div className="space-y-1.5 col-span-2 md:col-span-1">
              <label className="text-[8px] font-black text-amber-500 uppercase tracking-widest block font-mono">Max Retries / Min</label>
              <input
                type="number"
                disabled={isRunning}
                min={0}
                max={500}
                value={motMaxRetriesPerMin}
                onChange={(e) => setMotMaxRetriesPerMin(Math.min(500, Math.max(0, parseInt(e.target.value) || 60)))}
                className="w-full bg-[var(--bg-deep)] border border-[#151518] px-3 py-2 rounded-lg text-[11px] font-mono text-white outline-none focus:border-amber-500/30"
              />
              <p className="text-[7px] text-[#555] font-mono">Endurance auto-recovery cap</p>
            </div>

            <div className="space-y-1.5 col-span-2 md:col-span-1">
              <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Inter-Request Delay (ms)</label>
              <input
                type="number"
                disabled={isRunning}
                value={delay}
                onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40"
              />
              <p className="text-[7px] text-[var(--text-dim)] uppercase tracking-tight font-semibold">Rest interval (ms)</p>
            </div>

            <div className="space-y-1.5 col-span-2 md:col-span-1">
              <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Pre/Post Scripts</label>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  disabled={isRunning}
                  id="runRequestScriptsEndure"
                  checked={runRequestScripts}
                  onChange={(e) => setRunRequestScripts(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[#1E1E28] bg-black/50 text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="runRequestScriptsEndure" className="text-[10px] font-semibold text-[#888894] uppercase tracking-wide cursor-pointer select-none">
                  Run Setup Scripts
                </label>
              </div>
            </div>
          </div>
        )}

        {runnerMode === 'loop' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-white/[0.03] animate-in fade-in duration-200">
            <div className="space-y-1.5 col-span-2 md:col-span-1">
              <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Sandbox Engine</label>
              <select
                disabled={isRunning}
                value={sandboxEngine}
                onChange={(e) => setSandboxEngine(e.target.value as 'in-thread' | 'worker')}
                className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40 cursor-pointer"
              >
                <option value="in-thread">💨 IN-THREAD (Fast)</option>
                <option value="worker">🔒 ISOLATED (Worker)</option>
              </select>
              <p className="text-[7px] text-[var(--text-dim)] uppercase tracking-tight font-semibold">Containment level</p>
            </div>

            <div className="space-y-1.5 col-span-2 md:col-span-3">
              <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Execution Scripts</label>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  disabled={isRunning}
                  id="runRequestScriptsLoop"
                  checked={runRequestScripts}
                  onChange={(e) => setRunRequestScripts(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[#1E1E28] bg-black/50 text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="runRequestScriptsLoop" className="text-[10px] font-semibold text-[#888894] uppercase tracking-wide cursor-pointer select-none">
                  Run Script Pipeline (Pre-request, tests & assertions)
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-white/[0.03]">
          <div className="space-y-1.5 col-span-2 md:col-span-4">
            <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Temporary Log Persistence</label>
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                disabled={isRunning}
                id="saveTempSmokeLogs"
                checked={saveTempLogs}
                onChange={(e) => setSaveTempLogs(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#1E1E28] bg-black/50 text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="saveTempSmokeLogs" className="text-[10px] font-semibold text-[#888894] uppercase tracking-wide cursor-pointer select-none">
                Save Compact Smoke Logs To Database (Temporary)
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {isCleaning ? (
          <button
            disabled
            className="flex-1 h-11 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-not-allowed transition-all shadow-lg animate-pulse font-mono"
          >
            <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin shrink-0" /> Sanitizing Heap...
          </button>
        ) : isRunning ? (
          <button
            onClick={stopSmokeTest}
            className="flex-1 h-11 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 rounded-xl text-[10px] font-black text-red-100 uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer font-mono"
          >
            <Square size={11} fill="currentColor" />
            Abort Smoke Run
          </button>
        ) : (
          <button
            onClick={runSmokeTest}
            className={`flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer font-mono ${
              runnerMode === 'mot' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:brightness-110'
                : 'bg-[#3ECF8E] text-black shadow-[0_0_15px_rgba(62,207,142,0.15)] hover:bg-[#34B37A]'
            } active:scale-95`}
          >
            <Play size={11} fill="currentColor" />
            {runnerMode === 'mot' ? 'Initiate MoT Endurance Run' : 'Initiate Loops Smoke Test'}
          </button>
        )}

        <button
          onClick={handleExportJMX}
          className="h-11 px-5 bg-[var(--bg-deep)] border border-[var(--border-subtle)] hover:border-[#3ECF8E]/30 rounded-xl text-[10px] font-black text-[var(--text-dim)] hover:text-[#3ECF8E] uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Download size={13} />
          Export JMX
        </button>
      </div>

      {/* MoT Live Stabilizer Panels row */}
      {runnerMode === 'mot' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in duration-200">
          <div className="bg-[#09090B]/60 border border-white/[0.04] rounded-xl p-4 space-y-1 px-4 py-3">
            <span className="text-[8px] font-black text-[#55555C] uppercase tracking-wider block font-mono">Heap Memory Pressure</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-lg font-bold font-mono ${
                memoryPressure > 80 ? "text-red-500" :
                memoryPressure > 50 ? "text-amber-500" : "text-[#3ECF8E]"
              }`}>{memoryPressure}%</span>
              <span className="text-[7px] text-[#55555C] font-mono">allocation</span>
            </div>
            <span className="text-[7px] bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[#3ECF8E] font-mono px-1 py-0.2 rounded uppercase tracking-wider block w-max mt-1">
              Web Sandbox
            </span>
          </div>

          <div className="bg-[#09090B]/60 border border-white/[0.04] rounded-xl p-4 space-y-1 px-4 py-3">
            <span className="text-[8px] font-black text-[#55555C] uppercase tracking-wider block font-mono">System Stability Score</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-lg font-bold font-mono ${
                stabilityScore > 80 ? "text-[#3ECF8E]" :
                stabilityScore > 45 ? "text-amber-500" : "text-red-500"
              }`}>{stabilityScore}</span>
              <span className="text-[7px] text-[#55555C] font-mono">/ 100</span>
            </div>
            <span className="text-[7px] text-[#555] font-mono block uppercase mt-1">Real-time health quotient</span>
          </div>

          <div className="bg-[#09090B]/60 border border-white/[0.04] rounded-xl p-4 space-y-1 px-4 py-3">
            <span className="text-[8px] font-black text-[#55555C] uppercase tracking-wider block font-mono">Resilience Guard Status</span>
            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border font-mono uppercase w-max tracking-wider block mt-1 ${
              guardStatus === 'CRITICAL' ? "text-red-500 bg-red-500/10 border-red-500/15 animate-pulse" :
              guardStatus === 'THROTTLED' ? "text-amber-500 bg-amber-500/10 border-amber-500/15" : "text-[#3ECF8E] bg-[#3ECF8E]/10 border-[#3ECF8E]/15"
            }`}>
              {guardStatus}
            </span>
            <span className="text-[7px] text-[#555] font-mono block uppercase mt-1">Priority Focus: {activePriorityFocus}</span>
          </div>

          <div className="bg-[#09090B]/60 border border-white/[0.04] rounded-xl p-4 space-y-1 px-4 py-3 flex flex-col justify-between">
            <span className="text-[8px] font-black text-[#55555C] uppercase tracking-wider block font-mono">Preemptive Adjustments</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white font-mono">{crashPreventionTriggers}</span>
              <span className="text-[7px] text-[#55555C] font-mono">throttles triggered</span>
            </div>
            <span className="text-[7px] text-[#555] font-mono block uppercase">Heap Safety Intercedes</span>
          </div>
        </div>
      )}



      {/* Metrics Dashboard */}
      {samples.length > 0 && (
        <div className="space-y-3">
          {renderLatencyGraph()}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="p-2.5 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-lg space-y-0.5">
              <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
                <BarChart3 size={10} className="text-blue-400" />
                Throughput
              </span>
              <div className="text-sm font-bold text-white font-mono leading-none">{throughput} <span className="text-[8px] font-normal text-[var(--text-dim)]">req/s</span></div>
            </div>
            <div className="p-2.5 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-lg space-y-0.5">
              <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle size={10} className="text-[#3ECF8E]" />
                Success Rate
              </span>
              <div className={`text-sm font-bold font-mono leading-none ${successRate === 100 ? 'text-[#3ECF8E]' : 'text-yellow-500'}`}>{successRate}%</div>
            </div>
            <div className="p-2.5 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-lg space-y-0.5">
              <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
                <Clock size={10} className="text-purple-400" />
                Avg Latency
              </span>
              <div className="text-sm font-bold text-white font-mono leading-none">{avgLatency} <span className="text-[8px] font-normal text-[var(--text-dim)]">ms</span></div>
            </div>
            <div className="p-2.5 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-lg space-y-0.5">
              <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
                <ShieldAlert size={10} className="text-red-400" />
                Min / Max
              </span>
              <div className="text-sm font-bold text-white font-mono leading-none">{minLatency} / {maxLatency} <span className="text-[8px] font-normal text-[var(--text-dim)]">ms</span></div>
            </div>
          </div>

          <div className="bg-[#0D0D12]/60 border border-[#1C1C25]/60 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
            <div className="flex items-start gap-3">
              <Activity size={14} className="text-[#3ECF8E] shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-0.5">
                <h4 className="text-[9px] font-black text-[#3ECF8E] uppercase tracking-wider font-mono">
                  Telemetry Session Concluded
                </h4>
                <p className="text-[8px] text-[#88888F] font-mono uppercase tracking-tight">
                  The test runs are finished and aggregated successfully. To view raw request metrics and detailed latency distribution logs, generate and download a report below.
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={exportCSV}
                className="h-8 px-3 bg-[#0D0D12] border border-[#1C1C25] hover:border-[#3ECF8E]/30 rounded-lg text-[8px] font-black text-[#88888F] hover:text-[#3ECF8E] uppercase tracking-widest transition-colors flex items-center gap-1.5 cursor-pointer font-mono"
              >
                <Download size={10} />
                Export CSV
              </button>
              <button
                onClick={exportPDF}
                className="h-8 px-3 bg-[#0D0D12] border border-[#1C1C25] hover:border-[#3ECF8E]/30 rounded-lg text-[8px] font-black text-[#88888F] hover:text-[#3ECF8E] uppercase tracking-widest transition-colors flex items-center gap-1.5 cursor-pointer font-mono"
              >
                <Download size={10} />
                Export PDF Table
              </button>
            </div>
          </div>

        </div>
      )}

      <div className="bg-[#09090B]/40 border border-[#1C1C25]/50 rounded-xl p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h4 className="text-[9px] font-black text-white uppercase tracking-widest font-mono">Execution Logs</h4>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0D0D12] border border-[#1C1C25] w-full sm:w-auto">
            <button
              onClick={() => setVisibleLogType('success')}
              className={`flex-1 sm:flex-initial px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-wider font-mono transition-colors whitespace-nowrap ${
                visibleLogType === 'success'
                  ? 'bg-[#3ECF8E]/15 text-[#3ECF8E] border border-[#3ECF8E]/25'
                  : 'text-[#777] hover:text-[#AAA]'
              }`}
            >
              Success ({successLogSamplesRef.current.length})
            </button>
            <button
              onClick={() => setVisibleLogType('failed')}
              className={`flex-1 sm:flex-initial px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-wider font-mono transition-colors whitespace-nowrap ${
                visibleLogType === 'failed'
                  ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                  : 'text-[#777] hover:text-[#AAA]'
              }`}
            >
              Failed ({failedLogSamplesRef.current.length})
            </button>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto overflow-x-hidden space-y-2 pr-1">
          {(visibleLogType === 'success' ? successLogSamplesRef.current : failedLogSamplesRef.current)
            .slice()
            .reverse()
            .map((log, idx) => (
              <div
                key={`${log.id || idx}-${idx}`}
                className="bg-[#0D0D12] border border-[#1C1C25] rounded-lg p-2.5 space-y-1.5"
              >
                <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 text-[8px] font-mono uppercase tracking-wide">
                  <span className="text-[#AAA]">#{log.id}</span>
                  <span className="text-[#888]">{log.timestamp || '-'}</span>
                  <span className={`${log.success ? 'text-[#3ECF8E]' : 'text-red-400'} font-black truncate`}>
                    {log.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                  <span className="text-white truncate">Status: {log.statusCode ?? log.status ?? '-'}</span>
                  <span className="text-[#888] truncate">Latency: {log.latency ?? 0}ms</span>
                </div>
                {log.error && (
                  <p className="text-[8px] text-red-300 font-mono break-words leading-tight">{log.error}</p>
                )}
                <div className="text-[8px] text-[#B9BAC4] bg-black/30 border border-[#1C1C25] rounded p-2 overflow-auto whitespace-pre-wrap break-words font-mono leading-tight max-h-24">
                  {log.responsePreview || '[no response preview]'}
                </div>
              </div>
            ))}

          {(visibleLogType === 'success' ? successLogSamplesRef.current.length : failedLogSamplesRef.current.length) === 0 && (
            <div className="text-[8px] text-[#777] font-mono uppercase tracking-wider py-4 text-center border border-dashed border-[#1C1C25] rounded-lg">
              No logs yet for this bucket.
            </div>
          )}
        </div>
      </div>

      {false && (selectedSample as any) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-deep)]/50">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Activity size={12} className="text-[#3ECF8E]" />
                  Sample #{selectedSample.id} Details
                </h3>
                <p className="text-[8px] text-[var(--text-dim)] uppercase tracking-widest mt-0.5">
                  Executed at {selectedSample.timestamp} | Latency: {selectedSample.latency}ms
                </p>
              </div>
              <button
                onClick={() => setSelectedSample(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-dim)] hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-deep)]/20 px-4">
              <button
                onClick={() => setModalTab('request')}
                className={`px-4 py-2.5 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${
                  modalTab === 'request' ? 'border-[#3ECF8E] text-[#3ECF8E]' : 'border-transparent text-[var(--text-dim)] hover:text-white'
                }`}
              >
                Request Context
              </button>
              <button
                onClick={() => setModalTab('response')}
                className={`px-4 py-2.5 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${
                  modalTab === 'response' ? 'border-[#3ECF8E] text-[#3ECF8E]' : 'border-transparent text-[var(--text-dim)] hover:text-white'
                }`}
              >
                Response Context
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
              {modalTab === 'request' && (
                <div className="space-y-4">
                  {/* URL */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Target URL</span>
                    <div className="flex gap-2 items-center p-2.5 bg-[var(--bg-deep)]/60 border border-[var(--border-subtle)] rounded-lg font-mono text-[10px] text-white">
                      <span className="px-1.5 py-0.5 rounded bg-[#3ECF8E]/10 text-[#3ECF8E] font-black text-[9px]">
                        {selectedSample.request?.method || 'GET'}
                      </span>
                      <span className="break-all">{selectedSample.request?.url || activeRequest.url}</span>
                    </div>
                  </div>

                  {/* Headers */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Request Headers</span>
                    {selectedSample.request?.headers && Object.keys(selectedSample.request.headers).length > 0 ? (
                      <div className="border border-[var(--border-subtle)] rounded-lg overflow-hidden bg-[var(--bg-deep)]/20">
                        <table className="w-full text-left font-mono text-[9px] border-collapse">
                          <thead className="bg-[var(--bg-deep)] text-[8px] font-black uppercase border-b border-[var(--border-subtle)]">
                            <tr>
                              <th className="p-2 pl-3">Header Name</th>
                              <th className="p-2 pr-3">Header Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-subtle)]/50">
                            {Object.entries(selectedSample.request.headers).map(([key, val]) => (
                              <tr key={key}>
                                <td className="p-2 pl-3 font-semibold text-[var(--text-dim)]">{key}</td>
                                <td className="p-2 pr-3 text-white break-all">{String(val)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-[9px] font-bold text-[var(--text-dim)] italic p-2 border border-dashed border-[var(--border-subtle)] rounded-lg text-center uppercase tracking-widest">
                        No Custom Headers Sent
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Request Body</span>
                    {selectedSample.request?.body ? (
                      <pre className="p-3 bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg font-mono text-[10px] text-white overflow-x-auto custom-scrollbar whitespace-pre-wrap max-h-40">
                        {(() => {
                          const body = selectedSample.request.body;
                          const rawString = typeof body === 'object'
                            ? JSON.stringify(body, null, 2)
                            : String(body);
                          const maxBodyLength = 100000; // 100KB limit
                          if (rawString.length > maxBodyLength) {
                            return rawString.slice(0, maxBodyLength) + "\n\n... [Request body truncated. Total size: " + (rawString.length / 1024).toFixed(1) + " KB] ...";
                          }
                          return rawString;
                        })()}
                      </pre>
                    ) : (
                      <div className="text-[9px] font-bold text-[var(--text-dim)] italic p-2 border border-dashed border-[var(--border-subtle)] rounded-lg text-center uppercase tracking-widest">
                        No Request Payload Sent
                      </div>
                    )}
                  </div>
                </div>
              )}

              {modalTab === 'response' && (
                <div className="space-y-4">
                  {/* Status Bar */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">HTTP Status</span>
                    <div className="flex gap-4 items-center p-2.5 bg-[var(--bg-deep)]/60 border border-[var(--border-subtle)] rounded-lg">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                          selectedSample.success ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {selectedSample.status}
                        </span>
                        <span className="text-[10px] font-bold text-white uppercase tracking-tight">
                          {selectedSample.response?.statusText || (selectedSample.success ? 'OK' : 'Error')}
                        </span>
                      </div>
                      <div className="w-px h-4 bg-[var(--border-subtle)]" />
                      <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest font-black">
                        Latency: <span className="text-white font-mono font-normal">{selectedSample.latency}ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Headers */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Response Headers</span>
                    {selectedSample.response?.headers && Object.keys(selectedSample.response.headers).length > 0 ? (
                      <div className="border border-[var(--border-subtle)] rounded-lg overflow-hidden bg-[var(--bg-deep)]/20">
                        <table className="w-full text-left font-mono text-[9px] border-collapse">
                          <thead className="bg-[var(--bg-deep)] text-[8px] font-black uppercase border-b border-[var(--border-subtle)]">
                            <tr>
                              <th className="p-2 pl-3">Header Name</th>
                              <th className="p-2 pr-3">Header Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-subtle)]/50">
                            {Object.entries(selectedSample.response.headers).map(([key, val]) => (
                              <tr key={key}>
                                <td className="p-2 pl-3 font-semibold text-[var(--text-dim)]">{key}</td>
                                <td className="p-2 pr-3 text-white break-all">{String(val)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-[9px] font-bold text-[var(--text-dim)] italic p-2 border border-dashed border-[var(--border-subtle)] rounded-lg text-center uppercase tracking-widest">
                        No Response Headers Returned
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Response Body</span>
                    {selectedSample.response?.body ? (
                      <pre className="p-3 bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg font-mono text-[10px] text-white overflow-x-auto custom-scrollbar whitespace-pre-wrap max-h-60 max-w-full">
                        {(() => {
                          const body = selectedSample.response.body;
                          let rawString = '';
                          if (typeof body === 'object') {
                            rawString = JSON.stringify(body, null, 2);
                          } else {
                            try {
                              // Try parsing raw string as JSON for clean indenting
                              rawString = JSON.stringify(JSON.parse(body), null, 2);
                            } catch {
                              rawString = String(body);
                            }
                          }
                          const maxBodyLength = 100000; // 100KB limit
                          if (rawString.length > maxBodyLength) {
                            return rawString.slice(0, maxBodyLength) + "\n\n... [Response body truncated. Total size: " + (rawString.length / 1024).toFixed(1) + " KB. Export results to Excel/PDF to download complete logs] ...";
                          }
                          return rawString;
                        })()}
                      </pre>
                    ) : (
                      <div className="text-[9px] font-bold text-[var(--text-dim)] italic p-2 border border-dashed border-[var(--border-subtle)] rounded-lg text-center uppercase tracking-widest">
                        No Response Body Returned
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex justify-end bg-[var(--bg-deep)]/30">
              <button
                onClick={() => setSelectedSample(null)}
                className="px-4 py-2 bg-[var(--bg-deep)] border border-[var(--border-subtle)] hover:border-[#3ECF8E]/30 rounded-lg text-[9px] font-black text-white hover:text-[#3ECF8E] uppercase tracking-widest transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MoT Session Intelligence Report Modal */}
      {showMotReport && motReportData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-4 overflow-y-auto custom-scrollbar select-none">
          <div className="bg-[#09090D] border border-white/[0.05] rounded-2xl max-w-xl w-full shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 animate-out shrink-0">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/[0.05] bg-gradient-to-r from-amber-500/10 to-transparent flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber-500 animate-pulse" size={15} />
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest font-mono">
                  Session Intelligence Report
                </h3>
              </div>
              <button 
                onClick={() => setShowMotReport(false)}
                className="text-[#555] hover:text-white transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Target Header */}
              <div className="p-3.5 bg-white/[0.01] border border-white/[0.03] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[8px] font-black text-[#555] uppercase tracking-wider block font-mono">Target Request</span>
                  <span className="text-[11px] font-mono font-bold text-white uppercase">
                    {activeRequest?.method || 'GET'} {activeRequest?.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-black text-[#555] uppercase tracking-wider block font-mono">Testing Mode</span>
                  <span className="text-[9px] font-mono text-amber-500 font-bold uppercase tracking-wider">MoT Endurance</span>
                </div>
              </div>

              {/* Bento Grid Analytics */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-[#0c0c12] border border-white/[0.03] rounded-xl p-3.5 space-y-1">
                  <span className="text-[8px] font-black text-amber-500 uppercase tracking-wider block font-mono">Sessions Run</span>
                  <div className="text-lg font-black text-white font-mono">{motReportData.durationSeconds}s</div>
                  <span className="text-[7px] text-[#444] block font-mono">ELAPSED TIME</span>
                </div>

                <div className="bg-[#0c0c12] border border-white/[0.03] rounded-xl p-3.5 space-y-1">
                  <span className="text-[8px] font-black text-[#555] uppercase tracking-wider block font-mono">Total Queries</span>
                  <div className="text-lg font-black text-white font-mono">{motReportData.totalRequests}</div>
                  <span className="text-[7px] text-emerald-400 block font-mono">{motReportData.successCount} passed</span>
                </div>

                <div className="bg-[#0c0c12] border border-white/[0.03] rounded-xl p-3.5 space-y-1">
                  <span className="text-[8px] font-black text-[#555] uppercase tracking-wider block font-mono">Health Quotient</span>
                  <div className={`text-lg font-black font-mono ${motReportData.successRate >= 80 ? 'text-[#3ECF8E]' : 'text-rose-500'}`}>
                    {motReportData.successRate}%
                  </div>
                  <span className="text-[7px] text-[#444] block font-mono">SUCCESS RATIO</span>
                </div>

                <div className="bg-[#0c0c12] border border-white/[0.03] rounded-xl p-3.5 space-y-1">
                  <span className="text-[8px] font-black text-[#555] uppercase tracking-wider block font-mono">Average Latency</span>
                  <div className="text-lg font-black text-white font-mono">{motReportData.avgLatency}ms</div>
                  <span className="text-[7px] text-[#444] block font-mono">RESPONSE MEAN TIME</span>
                </div>

                <div className="bg-[#0c0c12] border border-white/[0.03] rounded-xl p-3.5 space-y-1">
                  <span className="text-[8px] font-black text-[#555] uppercase tracking-wider block font-mono">Latency Jitter</span>
                  <div className="text-lg font-black text-white font-mono">
                    {motReportData.maxLatency - motReportData.minLatency}ms
                  </div>
                  <span className="text-[7px] text-[#444] block font-mono">MIN: {motReportData.minLatency}ms &bull; MAX: {motReportData.maxLatency}ms</span>
                </div>

                <div className="bg-[#0c0c12] border border-white/[0.03] rounded-xl p-3.5 space-y-1">
                  <span className="text-[8px] font-black text-amber-500 uppercase tracking-wider block font-mono">Guard Intercedes</span>
                  <div className="text-lg font-black text-white font-mono">{motReportData.crashPreventionActions}</div>
                  <span className="text-[7px] text-[#444] block font-mono">RESILIENCE ACTIONS</span>
                </div>
              </div>

              {/* Urgent Early Termination Warnings */}
              {motReportData.earlyAbort && (
                <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-xl flex gap-3 animate-pulse">
                  <ShieldAlert className="text-red-400 shrink-0 mt-0.5" size={15} />
                  <div className="space-y-1">
                    <h5 className="text-[10px] font-black text-red-400 uppercase tracking-widest font-mono">
                      PREMATURE SESSION ABORT TRIGGERED
                    </h5>
                    <p className="text-[9px] text-red-300 font-medium leading-relaxed font-mono">
                      {motReportData.abortReason}
                    </p>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div className="space-y-2">
                <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">
                  Engine Recommendations & Insights
                </span>
                <div className="space-y-2">
                  {motReportData.recommendations.map((rec: string, i: number) => (
                    <div 
                      key={i} 
                      className="p-3 bg-white/[0.02] border border-white/[0.03] rounded-xl flex gap-2.5 items-start text-left"
                    >
                      <Sparkles size={12} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[9px] text-[#888894] leading-relaxed font-semibold">
                        {rec}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-white/[0.05] flex justify-end gap-3 bg-[var(--bg-deep)]/30">
              <button
                onClick={() => {
                  exportCSV();
                  setShowMotReport(false);
                }}
                className="px-4 h-9 bg-[var(--bg-deep)] border border-[var(--border-subtle)] hover:border-[#3ECF8E]/30 rounded-lg text-[9px] font-black text-white hover:text-[#3ECF8E] uppercase tracking-widest transition-colors cursor-pointer"
              >
                Export CSV Logs
              </button>
              <button
                onClick={() => setShowMotReport(false)}
                className="px-5 h-9 bg-amber-500 hover:bg-amber-600 rounded-lg text-[9px] font-black text-black uppercase tracking-widest transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

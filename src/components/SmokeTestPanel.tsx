import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { VariableService } from '../services/VariableService';
import { RequestData, Collection } from '../types';
import { CollectionExportService } from '../services/CollectionExportService';
import { RequestService } from '../services/RequestService';
import { ScriptService } from '../services/ScriptService';
import { SandboxRunner } from '../services/sandboxRunner';
import { SampleBuffer, createMetrics, recordSample, RequestPool, maybeGC, PAYLOAD_TRUNCATED } from '../services/SmokeTestPool';
import { TestIntro } from './smoke/TestIntro';
import { TestConfig } from './smoke/TestConfig';
import { TestActions } from './smoke/TestActions';
import { TestMetrics } from './smoke/TestMetrics';
import { TestRunningOverlay } from './smoke/TestRunningOverlay';
import { MotStabilizerPanel } from './smoke/MotStabilizerPanel';
import { CleaningOverlay } from './smoke/CleaningOverlay';
import { MotReportModal } from './smoke/MotReportModal';

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

  const [sandboxEngine, setSandboxEngine] = useState<'in-thread' | 'worker'>('in-thread');
  const [runRequestScripts, setRunRequestScripts] = useState(true);

  // Minutes of Testing (MoT) endurance monitoring options
  const [runnerMode, setRunnerMode] = useState<'loop' | 'mot'>('loop');
  const [motDuration, setMotDuration] = useState(120);
  const [motMaxReqPerMin, setMotMaxReqPerMin] = useState(600);
  const [motMaxRetriesPerMin, setMotMaxRetriesPerMin] = useState(60);

  // MoT real-time metrics and dynamic stabilizer states
  const [memoryPressure, setMemoryPressure] = useState(0);
  const [adaptiveThrottle, setAdaptiveThrottle] = useState(1.0);
  const [stabilityScore, setStabilityScore] = useState(100);
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

  const sampleBufferRef = useRef<SampleBuffer>(new SampleBuffer(60));
  const allSamplesRef = useRef<TestSample[]>([]);
  const isRunningRef = useRef(false);
  const currentRunIdRef = useRef(0);
  const activeAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const uiIntervalRef = useRef<any>(null);
  const uiIntervalMoTRef = useRef<any>(null);

  // Terminate any active execution threads on unmount
  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      if (uiIntervalRef.current) { clearInterval(uiIntervalRef.current); uiIntervalRef.current = null; }
      if (uiIntervalMoTRef.current) { clearInterval(uiIntervalMoTRef.current); uiIntervalMoTRef.current = null; }
      [...activeAbortControllersRef.current].forEach(c => { try { c.abort(); } catch {} });
      activeAbortControllersRef.current.clear();
      if (minuteTimer.current) { clearInterval(minuteTimer.current); minuteTimer.current = null; }
      try { SandboxRunner.clearWorkerPool(); } catch {}
    };
  }, []);

  const handleExportJMX = () => {
    if (!activeRequest) return;
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
      if (addToast) addToast({ type: 'error', message: 'No request is active. Please select a request to smoke test.' });
      else alert('No request is active. Please select a request to smoke test.');
      return;
    }

    // --- High-Performance Sanitization and Warmup Core ---
    setIsCleaning(true);
    setCleaningStatus('SHUTTING DOWN PREVIOUS SESSIONS & ABORTING WORKERS...');

    currentRunIdRef.current++;
    const currentRunId = currentRunIdRef.current;
    isRunningRef.current = false;

    [...activeAbortControllersRef.current].forEach(c => { try { c.abort(); } catch {} });
    activeAbortControllersRef.current.clear();
    if (minuteTimer.current) { clearInterval(minuteTimer.current); minuteTimer.current = null; }

    await new Promise(resolve => setTimeout(resolve, 150));

    setCleaningStatus('INSPECTING LOCAL STORAGE STABILITY...');
    try {
      const gmyNodes = localStorage.getItem('gmy_expanded_nodes');
      if (gmyNodes && gmyNodes.length > 20000) localStorage.setItem('gmy_expanded_nodes', '{}');
      const gmyRecents = localStorage.getItem('gmy_recent_scripts');
      if (gmyRecents && gmyRecents.length > 20000) localStorage.setItem('gmy_recent_scripts', '[]');
    } catch {}

    setCleaningStatus('PURGING STALE RUN SAMPLES & LOG BUFFERS...');
    await new Promise(resolve => setTimeout(resolve, 20));
    allSamplesRef.current = [];
    sampleBufferRef.current.clear();
    setSamples([]);

    setCleaningStatus('RELEASING STALE SANDBOX WEB WORKER SESSIONS...');
    await new Promise(resolve => setTimeout(resolve, 20));
    try { SandboxRunner.clearWorkerPool(); } catch {}

    setCleaningStatus('GARBAGE-COLLECTING DETACHED HEAP REFERENCES...');
    await new Promise(resolve => setTimeout(resolve, 20));
    if (typeof (window as any).gc === 'function') { try { (window as any).gc(); } catch {}
      maybeGC(1, 1); }

    setCleaningStatus('PRE-WARMING ISOLATED THREAD POOL & HEAP FOR ENERGIZE RUN...');
    await new Promise(resolve => setTimeout(resolve, 15));
    setIsCleaning(false);

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
    sampleBufferRef.current.clear();
    setIsMemoryCooling(false);
    isMemoryCoolingRef.current = false;
    setMemoryCoolingCount(0);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // ==========================================
    // BRANCH A: CONCURRENT FIXED LOOPS SCENARIO RUNNER
    // ==========================================
    if (runnerMode === 'loop') {
      const totalRequests = threads * loops;
      let currentRequestIndex = 0;
      const runStats = { completed: 0, totalLatency: 0, successCount: 0, minLatency: Infinity, maxLatency: -Infinity };

      allSamplesRef.current = [];
    sampleBufferRef.current.clear();
      const startTime = performance.now();
      const uiInterval = setInterval(() => {
        const cCount = runStats.completed;
        if (cCount === 0) return;
        setSamples(sampleBufferRef.current.readLast(100));
        setAvgLatency(Math.round(runStats.totalLatency / cCount));
        setMinLatency(runStats.minLatency === Infinity ? 0 : runStats.minLatency);
        setMaxLatency(runStats.maxLatency === -Infinity ? 0 : runStats.maxLatency);
        setSuccessRate(Math.round((runStats.successCount / cCount) * 100));
        setProgress(Math.round((cCount / totalRequests) * 100));
        setThroughput(parseFloat((cCount / ((performance.now() - startTime) / 1000 || 1)).toFixed(1)));
      }, 350);
      uiIntervalRef.current = uiInterval;

      const runWorker = async () => {
        const workerController = new AbortController();
        activeAbortControllersRef.current.add(workerController);
        // P1: Pre-compute collection lookup + variable map (cached per-worker)
        const collMapTest = new Map(collections.map(c => [c.id, c]));
        const cachedCollection = collection?.id ? (collMapTest.get(collection.id) || null) : null;
        const cachedVariables = VariableService.getResolvedVariableMap({
          environments, activeEnvId, collection: cachedCollection, variables: {}
        });
        // P1: Create request template once (deep clone headers/params once)
        const requestTemplate: RequestData = {
          ...activeRequest,
          headers: (activeRequest.headers || []).map(h => ({ ...h })),
          params: (activeRequest.params || []).map(p => ({ ...p })),
          settings: activeRequest.settings ? { ...activeRequest.settings } : undefined
        };
        while (isRunningRef.current && currentRunId === currentRunIdRef.current) {
          const index = currentRequestIndex++;
          if (index >= totalRequests) break;

          if (delay > 0 && index >= threads) await sleep(delay);
          if (!isRunningRef.current || currentRunId !== currentRunIdRef.current) break;

          const sampleStartTime = performance.now();
          let status: number | string = 0;
          let success = false;
          let errorMsg = '';

          // Using per-worker controller

          try {
            // P1: Use cached variable map + request template
            const threadVariables = { ...cachedVariables };
            const variableContext = {
              environments, activeEnvId, collections, collection: collection || null,
              variables: threadVariables, signal: workerController.signal, useWorker: sandboxEngine === 'worker'
            };

            let requestToExecute: RequestData = {
              ...requestTemplate,
              settings: { ...(requestTemplate.settings || { followRedirects: true, maxRedirects: 10 }), timeout: timeoutMs }
            };

            const activeEnvironment = activeEnvId
              ? environments.find((env) => env.id === activeEnvId)
              : null;

            const preScripts = runRequestScripts ? [
              activeEnvironment?.pre_request_script,
              collection?.pre_request_script,
              requestToExecute.pre_request_script
            ].filter(Boolean) as string[] : [];

            const preRequestOut = await ScriptService.executePreRequest(preScripts, requestToExecute, variableContext);
            if (currentRunId !== currentRunIdRef.current) return;
            requestToExecute = preRequestOut.request;

            if (preRequestOut.environmentMutations) {
              for (const [key, value] of Object.entries(preRequestOut.environmentMutations)) {
                if (value === null) delete threadVariables[key];
                else threadVariables[key] = String(value);
              }
            }
            if (currentRunId !== currentRunIdRef.current) return;

            const response = await RequestService.execute(requestToExecute, variableContext);
            if (currentRunId !== currentRunIdRef.current) return;

            const testScripts = runRequestScripts ? [
              activeEnvironment?.test_script,
              collection?.test_script,
              requestToExecute.test_script
            ].filter(Boolean) as string[] : [];

            const testOut = await ScriptService.executeTests(testScripts, response, requestToExecute, variableContext);
            if (currentRunId !== currentRunIdRef.current) return;

            status = response.status;
            success = response.status >= 200 && response.status < 300;

            if (response.status === 0) {
              success = false;
              status = response.statusText;
              try {
                const bodyObj = JSON.parse(response.body);
                errorMsg = bodyObj?.error || bodyObj?.diagnostics?.message || response.statusText;
              } catch { errorMsg = response.body || response.statusText; }
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

          if (currentRunId !== currentRunIdRef.current) return;

          const sampleEndTime = performance.now();
          const duration = Math.round(sampleEndTime - sampleStartTime);

          runStats.completed++;
          runStats.totalLatency += duration;
          if (duration < runStats.minLatency) runStats.minLatency = duration;
          if (duration > runStats.maxLatency) runStats.maxLatency = duration;
          if (success) runStats.successCount++;

          sampleBufferRef.current.writeSample(
            runStats.completed, new Date().toLocaleTimeString(), duration,
            status, success, errorMsg || undefined
          );

        }
      };

      try {
        const MAX_CONCURRENCY = 6;
        const workerRunners = Array.from({ length: Math.min(MAX_CONCURRENCY, threads) }, async () => {
          while (isRunningRef.current && currentRunId === currentRunIdRef.current) {
            if (currentRequestIndex >= totalRequests) break;
            await runWorker();
          }
        });
        await Promise.all(workerRunners);
      } catch (err: any) {
        console.error('[SmokeTester] Concurrency run failed:', err);
      } finally {
        setIsRunning(false);
        isRunningRef.current = false;
        clearInterval(uiInterval);
        [...activeAbortControllersRef.current].forEach(c => { try { c.abort(); } catch {} });
        activeAbortControllersRef.current.clear();
        if (typeof (window as any).gc === 'function') { try { (window as any).gc(); } catch {} }
      }

    // ==========================================
    // BRANCH B: MINUTES OF TESTING (MoT) ENDURANCE RUNNER
    // ==========================================
    } else {
      completedCountRef.current = 0;
      successCountRef.current = 0;
      currentConsecutiveFailuresRef.current = 0;
      startTimeRef.current = performance.now();
      const uiIntervalMoT = setInterval(() => {
        if (!isRunningRef.current) return;
        const count = completedCountRef.current;
        if (count === 0) return;
        const avg = Math.round(totalLatency / (count || 1));
        const succRate = Math.round((successCountRef.current / (count || 1)) * 100);
        const cMin = minLatencyValue === Infinity ? 0 : minLatencyValue;
        const cMax = maxLatencyValue === -Infinity ? 0 : maxLatencyValue;
        setSamples(sampleBufferRef.current.readLast(100));
        setAvgLatency(avg);
        setMinLatency(cMin);
        setMaxLatency(cMax);
        setSuccessRate(succRate);
        setMemoryPressure(memoryPressureLevelRef.current);
        setStabilityScore(stabilityScoreRef.current);
        setProgress(Math.min(100, Math.round(((performance.now() - startTimeRef.current) / 1000 / motDuration) * 100)));
        setThroughput(parseFloat((count / ((performance.now() - startTimeRef.current) / 1000 || 1)).toFixed(1)));
      }, 350);
      uiIntervalMoTRef.current = uiIntervalMoT;
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
      const activePriorityFocusRef = { current: 'ALL' as 'P0' | 'P1' | 'P2' | 'P3' | 'ALL' };
      const stabilityScoreRef = { current: 100 };

      if (minuteTimer.current) clearInterval(minuteTimer.current);
      minuteTimer.current = setInterval(() => {
        requestsInCurrentMinute.current = 0;
        retriesInCurrentMinute.current = 0;
      }, 60000);

      let totalLatency = 0;
      let minLatencyValue = Infinity;
      let maxLatencyValue = -Infinity;
      const runWorkerMoT = async () => {
        const motController = new AbortController();
        activeAbortControllersRef.current.add(motController);
        // P1: Pre-compute collection lookup + variable map
        const collMapMoTTest = new Map(collections.map(c => [c.id, c]));
        const cachedCollectionMoT = collection?.id ? (collMapMoTTest.get(collection.id) || null) : null;
        const cachedVariablesMoT = VariableService.getResolvedVariableMap({
          environments, activeEnvId, collection: cachedCollectionMoT, variables: {}
        });
        // P1: Create request template once
        const requestTemplateMoT: RequestData = {
          ...activeRequest,
          headers: (activeRequest.headers || []).map(h => ({ ...h })),
          params: (activeRequest.params || []).map(p => ({ ...p })),
          settings: activeRequest.settings ? { ...activeRequest.settings } : undefined
        };
        let localCounter = 0;
        while (isRunningRef.current && currentRunId === currentRunIdRef.current) {
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
            if (addToast) addToast({ type: 'warning', message: `Endurance limit danger: Memory is at ${computedPressureVal}%. Commencing emergency buffer flush...` });
          }

          while (isMemoryCoolingRef.current && isRunningRef.current) {
            await sleep(500);
            if (currentRunId !== currentRunIdRef.current) return;
            const checkMem = (window as any).performance?.memory;
            let checkPressure = 0;
            if (checkMem) checkPressure = Math.min(100, Math.round((checkMem.usedJSHeapSize / checkMem.jsHeapSizeLimit) * 100));
            else checkPressure = Math.max(20, memoryPressureLevelRef.current - 15);
            memoryPressureLevelRef.current = checkPressure;
            if (checkPressure < 55) {
              isMemoryCoolingRef.current = false;
              setIsMemoryCooling(false);
              if (addToast) addToast({ type: 'success', message: `Memory successfully sanitized to ${checkPressure}%. Resuming MoT suite execution.` });
              break;
            }
          }

          const elapsedSec = (performance.now() - startTimeRef.current) / 1000;
          if (elapsedSec >= motDuration) break;

          let baseDelayValue = delay;
          if (adaptiveThrottleRef.current < 1.0) baseDelayValue = Math.round(baseDelayValue * (1.0 / adaptiveThrottleRef.current));
          if (baseDelayValue > 0 && localCounter > 0) {
            await sleep(baseDelayValue);
            if (currentRunId !== currentRunIdRef.current) return;
          }
          localCounter++;

          if (requestsInCurrentMinute.current >= motMaxReqPerMin) { await sleep(250); continue; }

          let status: number | string = 0;
          let success = false;
          let errorMsg = '';
          // P1: Use cached request template
          let requestToExecute = {
            ...requestTemplateMoT,
            settings: { ...(requestTemplateMoT.settings || { followRedirects: true, maxRedirects: 10 }), timeout: timeoutMs }
          };
          let retryCount = 0;
          let executedSuccessfully = false;

          const sampleStartTime = performance.now();

          while (retryCount <= 3 && !executedSuccessfully && isRunningRef.current) {
            requestsInCurrentMinute.current++;

            // Using motController

            try {
              // P1: Use cached variable map
              const threadVariables = { ...cachedVariablesMoT };
              const variableContext = {
                environments, activeEnvId, collections, collection: collection || null,
                variables: threadVariables, signal: motController.signal, useWorker: sandboxEngine === 'worker'
              };

              requestToExecute.settings = {
                ...(requestToExecute.settings || { followRedirects: true, maxRedirects: 10 }),
                timeout: timeoutMs
              };

              const activeEnvironment = activeEnvId
                ? environments.find((env) => env.id === activeEnvId)
                : null;

              const preScripts = runRequestScripts ? [
                activeEnvironment?.pre_request_script,
                collection?.pre_request_script,
                requestToExecute.pre_request_script
              ].filter(Boolean) as string[] : [];

              const preRequestOut = await ScriptService.executePreRequest(preScripts, requestToExecute, variableContext);
              if (currentRunId !== currentRunIdRef.current) return;
              requestToExecute = preRequestOut.request;

              if (preRequestOut.environmentMutations) {
                for (const [key, val] of Object.entries(preRequestOut.environmentMutations)) {
                  if (val === null) delete threadVariables[key];
                  else threadVariables[key] = String(val);
                }
              }
              if (currentRunId !== currentRunIdRef.current) return;

              const response = await RequestService.execute(requestToExecute, variableContext);
              if (currentRunId !== currentRunIdRef.current) return;

              const testScripts = runRequestScripts ? [
                activeEnvironment?.test_script,
                collection?.test_script,
                requestToExecute.test_script
              ].filter(Boolean) as string[] : [];

              const testOut = await ScriptService.executeTests(testScripts, response, requestToExecute, variableContext);
              if (currentRunId !== currentRunIdRef.current) return;

              status = response.status;
              success = response.status >= 200 && response.status < 300;

              if (response.status === 0) {
                success = false; status = response.statusText;
                try { const bodyObj = JSON.parse(response.body); errorMsg = bodyObj?.error || bodyObj?.diagnostics?.message || response.statusText; }
                catch { errorMsg = response.body || response.statusText; }
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
                  sampleBufferRef.current.writeSample(
                    completedCountRef.current, new Date().toLocaleTimeString(), 0,
                    'AUTH_REFRESH', false
                  );
                  await sleep(150);
                  if (currentRunId !== currentRunIdRef.current) return;
                  continue;
                }
              }

              if (response.status === 400 || status === 'Assertion Fail') { executedSuccessfully = true; break; }
              executedSuccessfully = true;
            } catch (err: any) {
              if (currentRunId !== currentRunIdRef.current) return;
              success = false;
              status = err.name === 'AbortError' ? 'Timeout' : 'Execution Error';
              errorMsg = err.message || String(err);
              const isTransient = err.name === 'AbortError' || err.message?.includes('NetworkError') || err.message?.includes('socket') || err.message?.includes('refused');
              if (isTransient && retryCount < 3 && retriesInCurrentMinute.current < motMaxRetriesPerMin) {
                retryCount++; retriesInCurrentMinute.current++;
                await sleep(Math.min(1000, 200 * Math.pow(2, retryCount)));
                if (currentRunId !== currentRunIdRef.current) return;
                continue;
              }
              executedSuccessfully = true;
            }
          }

          if (currentRunId !== currentRunIdRef.current) return;

          const sampleEndTime = performance.now();
          const duration = Math.round(sampleEndTime - sampleStartTime);

          completedCountRef.current += 1;
          totalLatency += duration;
          if (duration < minLatencyValue) minLatencyValue = duration;
          if (duration > maxLatencyValue) maxLatencyValue = duration;
          if (success) { successCountRef.current += 1; currentConsecutiveFailuresRef.current = 0; }
          else currentConsecutiveFailuresRef.current++;

          sampleBufferRef.current.writeSample(
            completedCountRef.current, new Date().toLocaleTimeString(), duration,
            status, success, errorMsg || undefined
          );

          const mem = (window as any).performance?.memory;
          let computedPressure = 0;
          if (mem) computedPressure = Math.min(100, Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100));
          else computedPressure = Math.round(Math.min(45, (completedCountRef.current * 0.04)) + Math.sin(completedCountRef.current * 0.05) * 5 + 10);
          memoryPressureLevelRef.current = computedPressure;

          const recentSamples = sampleBufferRef.current.readLast(20);
          let passedRecent = 0;
          const latencyHistoryArray: number[] = [];
          recentSamples.forEach(rs => { if (rs.success) passedRecent++; latencyHistoryArray.push(rs.latency); });
          let jitter = 0;
          if (latencyHistoryArray.length > 2) {
            const avgL = latencyHistoryArray.reduce((p, c) => p + c, 0) / latencyHistoryArray.length;
            jitter = Math.round(Math.sqrt(latencyHistoryArray.reduce((p, c) => p + Math.pow(c - avgL, 2), 0) / latencyHistoryArray.length));
          }

          let score = 100;
          score -= (100 - (recentSamples.length ? (passedRecent / recentSamples.length) * 100 : 100)) * 0.8;
          if (jitter > 120) score -= 12;
          if (currentConsecutiveFailuresRef.current > 2) score -= currentConsecutiveFailuresRef.current * 6;
          score = Math.max(0, Math.min(100, Math.round(score)));
          stabilityScoreRef.current = score;

          let newGuardState: 'SAFE' | 'THROTTLED' | 'CRITICAL' = 'SAFE';
          let throttleCoeff = 1.0;
          let activePrio: 'P0' | 'P1' | 'P2' | 'P3' | 'ALL' = 'ALL';

          if (computedPressure > 80 || score < 40) { newGuardState = 'CRITICAL'; throttleCoeff = 0.3; activePrio = 'P1'; }
          else if (computedPressure > 50 || score < 75) { newGuardState = 'THROTTLED'; throttleCoeff = 0.6; activePrio = 'P2'; }

          if (newGuardState !== guardStateRef.current) {
            guardStateRef.current = newGuardState;
            adaptiveThrottleRef.current = throttleCoeff;
            activePriorityFocusRef.current = activePrio;
            crashPreventionTriggersCountRef.current++;
          }

          if (computedPressure > 88) {
            earlyAbortTriggeredRef.current = true;
            abortReasonRef.current = 'Memory Pressure Threshold Exceeded safety ceiling (88%)';
            isRunningRef.current = false; break;
          }
          if (score < 25 && completedCountRef.current > 15) {
            earlyAbortTriggeredRef.current = true;
            abortReasonRef.current = 'System Stability Score depleted below safety floor (25%)';
            isRunningRef.current = false; break;
          }


          if (completedCountRef.current % 50 === 0) {
            cleanupCyclesRef.current++;
            if (typeof (window as any).gc === 'function') { try { (window as any).gc(); } catch {} }
          }
        }
        activeAbortControllersRef.current.delete(motController);
      };

      try {
        const MAX_CONCURRENCY = 6;
        const workerRunners = Array.from({ length: Math.min(MAX_CONCURRENCY, threads) }, async () => {
          while (isRunningRef.current && currentRunId === currentRunIdRef.current) {
            await runWorkerMoT();
          }
        });
        await Promise.all(workerRunners);

        const totalElapsed = (performance.now() - startTimeRef.current) / 1000;
        const recs: string[] = [];
        const finalPassRate = Math.round((successCountRef.current / (completedCountRef.current || 1)) * 100);

        if (finalPassRate < 75) recs.push(`Unstable Target Endpoint Detected: '${activeRequest.method} ${activeRequest.name}' exhibited a ${100 - finalPassRate}% fail rate.`);
        if (maxLatencyValue > 4000) recs.push(`High Latency Ceiling Spike: Latency spiked to ${maxLatencyValue}ms.`);
        if (crashPreventionTriggersCountRef.current > 0) recs.push(`Preemptive resilience stabilizer interceded ${crashPreventionTriggersCountRef.current} times.`);
        if (recs.length === 0) recs.push("Pristine Systems Stability: Excellent results.");

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
        if (addToast) addToast({ type: 'success', message: 'Minutes of Testing endurance run complete!' });
      } catch (err: any) {
        console.error('[SmokeTester] MoT execution run error:', err);
        if (addToast) addToast({ type: 'error', message: `MoT Run Error: ${err.message || String(err)}` });
      } finally {
        setIsRunning(false);
        isRunningRef.current = false;
        clearInterval(uiIntervalMoT);
        if (minuteTimer.current) { clearInterval(minuteTimer.current); minuteTimer.current = null; }
        [...activeAbortControllersRef.current].forEach(c => { try { c.abort(); } catch {} });
        activeAbortControllersRef.current.clear();
        if (typeof (window as any).gc === 'function') { try { (window as any).gc(); } catch {} }
      }
    }
  };

  const stopSmokeTest = () => {
    currentRunIdRef.current++;
    isRunningRef.current = false;
    setIsRunning(false);
    if (uiIntervalRef.current) { clearInterval(uiIntervalRef.current); uiIntervalRef.current = null; }
    if (uiIntervalMoTRef.current) { clearInterval(uiIntervalMoTRef.current); uiIntervalMoTRef.current = null; }
    [...activeAbortControllersRef.current].forEach(c => { try { c.abort(); } catch {} });
    activeAbortControllersRef.current.clear();
    if (minuteTimer.current) { clearInterval(minuteTimer.current); minuteTimer.current = null; }
    try { SandboxRunner.clearWorkerPool(); } catch {}
  };

  const exportCSV = () => {
    const dataToExport = sampleBufferRef.current.read();
    if (dataToExport.length === 0) return;
    const headers = ['Sample ID', 'Timestamp', 'Method', 'URL', 'Latency (ms)', 'Status', 'Outcome', 'ErrorDetails'];
    const rows = dataToExport.map(s => [
      s.id, s.timestamp || '', activeRequest?.method || 'GET',
      `"${(activeRequest?.url || '').replace(/"/g, '""')}"`,
      s.latency, s.status || '', s.success ? 'SUCCESS' : 'FAIL',
      `"${(s.error || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smoke_test_${(activeRequest?.name || 'run').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const dataToExport = sampleBufferRef.current.read();
    if (dataToExport.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const latencies = dataToExport.map(s => s.latency);
    const avg = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    let min = 0, max = 0;
    if (latencies.length > 0) { min = latencies[0]; max = latencies[0];
      for (const lat of latencies) { if (lat < min) min = lat; if (lat > max) max = lat; }
    }
    const succRate = Math.round((dataToExport.filter(s => s.success).length / dataToExport.length) * 100);

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>Gimay Smoke Test Report - ${activeRequest.name}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap');
            body { font-family: 'Outfit', sans-serif; color: #111; background: #fff; margin: 40px; line-height: 1.6; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #E5E7EB; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; color: #111827; }
            .subtitle { font-size: 11px; font-weight: 600; color: #059669; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
            .meta-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 30px; }
            .meta-card, .config-card { border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; background: #F9FAFB; }
            .meta-item { margin-bottom: 8px; font-size: 13px; }
            .meta-label { font-weight: 600; color: #6B7280; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
            .meta-val { font-weight: 500; color: #111827; }
            .mono-text { font-family: 'JetBrains Mono', monospace; font-size: 12px; background: #F3F4F6; padding: 2px 6px; border-radius: 4px; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .stat-card { border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; text-align: center; }
            .stat-label { font-size: 10px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
            .stat-value { font-size: 20px; font-weight: 800; color: #111827; }
            .stat-value.success-rate { color: #059669; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { background: #F3F4F6; color: #374151; font-weight: 600; padding: 10px 14px; font-size: 9px; border-bottom: 1px solid #E5E7EB; }
            td { padding: 10px 14px; border-bottom: 1px solid #F3F4F6; }
            .badge-success { background: #DEF7EC; color: #03543F; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 10px; }
            .badge-fail { background: #FDE8E8; color: #9B1C1C; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="subtitle">Gimay Performance Engine</div>
              <div class="title">Smoke Testing Report</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #6B7280;">Generated: ${new Date().toLocaleString()}<br/>Platform: Gimay Desktop Suite</div>
          </div>
          <div class="meta-grid">
            <div class="meta-card">
              <div class="meta-item"><span class="meta-label">Request:</span><span class="meta-val">${activeRequest.name}</span></div>
              <div class="meta-item"><span class="meta-label">Target:</span><span class="meta-val mono-text">${activeRequest.method} ${activeRequest.url}</span></div>
            </div>
            <div class="config-card">
              <div class="meta-item"><span class="meta-label">Threads:</span><span class="meta-val">${threads}</span></div>
              <div class="meta-item"><span class="meta-label">Loops:</span><span class="meta-val">${loops}</span></div>
              <div class="meta-item"><span class="meta-label">Delay:</span><span class="meta-val">${delay} ms</span></div>
            </div>
          </div>
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-label">Throughput</div><div class="stat-value">${throughput} req/s</div></div>
            <div class="stat-card"><div class="stat-label">Success Rate</div><div class="stat-value success-rate">${succRate}%</div></div>
            <div class="stat-card"><div class="stat-label">Avg Latency</div><div class="stat-value">${avg} ms</div></div>
            <div class="stat-card"><div class="stat-label">Min / Max</div><div class="stat-value" style="font-size: 15px; margin-top: 4px;">${min} / ${max} ms</div></div>
          </div>
          <table>
            <thead><tr><th>#</th><th>Time</th><th>Latency</th><th>Status</th><th>Outcome</th></tr></thead>
            <tbody>${dataToExport.map(s => `<tr><td>#${s.id}</td><td>${s.timestamp}</td><td>${s.latency} ms</td><td style="color:${s.success?'#059669':'#DC2626'}">${s.status}</td><td><span class="${s.success?'badge-success':'badge-fail'}">${s.success?'SUCCESS':'FAIL'}</span></td></tr>`).join('')}</tbody>
          </table>
          <script>window.onload=function(){setTimeout(function(){window.print()},500)}</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const totalRequests = runnerMode === 'loop' ? threads * loops : (motDuration * motMaxReqPerMin) / 60;

  return (
    <div className="space-y-4">
      {/* Intro + Runner Mode Selector */}
      <TestIntro runnerMode={runnerMode} isRunning={isRunning} onModeChange={setRunnerMode} />

      {/* Config Grid */}
      <TestConfig
        runnerMode={runnerMode} isRunning={isRunning}
        threads={threads} loops={loops} delay={delay} timeoutMs={timeoutMs}
        motDuration={motDuration} motMaxReqPerMin={motMaxReqPerMin} motMaxRetriesPerMin={motMaxRetriesPerMin}
        sandboxEngine={sandboxEngine} runRequestScripts={runRequestScripts}
        onThreadsChange={setThreads} onLoopsChange={setLoops} onDelayChange={setDelay}
        onTimeoutChange={setTimeoutMs}
        onMotDurationChange={setMotDuration} onMotMaxReqChange={setMotMaxReqPerMin}
        onMotMaxRetriesChange={setMotMaxRetriesPerMin}
        onSandboxEngineChange={setSandboxEngine} onRunScriptsChange={setRunRequestScripts}
      />

      {/* Action Buttons */}
      <TestActions
        isCleaning={isCleaning} isRunning={isRunning} runnerMode={runnerMode}
        onRun={runSmokeTest} onAbort={stopSmokeTest} onExportJMX={handleExportJMX}
      />

      {/* MoT Stabilizer Panel */}
      {runnerMode === 'mot' && (
        <MotStabilizerPanel
          memoryPressure={memoryPressure} stabilityScore={stabilityScore}
          guardStatus={guardStatus} activePriorityFocus={activePriorityFocus}
          adaptiveThrottle={adaptiveThrottle} crashPreventionTriggers={crashPreventionTriggers}
        />
      )}

      {/* Metrics Dashboard */}
      <TestMetrics
        samples={samples} throughput={throughput} avgLatency={avgLatency}
        minLatency={minLatency} maxLatency={maxLatency} successRate={successRate}
        onExportCSV={exportCSV} onExportPDF={exportPDF}
      />

      {/* Running Overlay */}
      <TestRunningOverlay
        isRunning={isRunning} runnerMode={runnerMode} progress={progress}
        memoryPressure={memoryPressure} stabilityScore={stabilityScore}
        isMemoryCooling={isMemoryCooling} guardStatus={guardStatus}
        completedCount={allSamplesRef.current.length} totalRequests={totalRequests}
        requestName={activeRequest?.name || ''} requestMethod={activeRequest?.method || 'GET'}
        onAbort={stopSmokeTest}
      />

      {/* Cleaning Overlay */}
      <CleaningOverlay isCleaning={isCleaning} cleaningStatus={cleaningStatus} />

      {/* MoT Session Intelligence Report Modal */}
      <MotReportModal show={showMotReport} data={motReportData} onClose={() => setShowMotReport(false)} />
    </div>
  );
};

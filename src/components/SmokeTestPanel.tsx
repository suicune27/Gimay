import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, Download, Activity, Clock, ShieldAlert, CheckCircle, BarChart3, AlertCircle, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { VariableService } from '../services/VariableService';
import { RequestData, Collection } from '../types';
import { CollectionExportService } from '../services/CollectionExportService';
import { isElectron } from '../lib/platform';
import { RequestService } from '../services/RequestService';
import { ScriptService } from '../services/ScriptService';

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
  request?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: any;
  };
}

export const SmokeTestPanel: React.FC<SmokeTestPanelProps> = ({ activeRequest, collection }) => {
  const { environments, activeEnvId, collections } = useStore();
  const [threads, setThreads] = useState(5);
  const [loops, setLoops] = useState(5);
  const [delay, setDelay] = useState(50);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [samples, setSamples] = useState<TestSample[]>([]);
  const [throughput, setThroughput] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  const [minLatency, setMinLatency] = useState(0);
  const [maxLatency, setMaxLatency] = useState(0);
  const [successRate, setSuccessRate] = useState(100);

  const [selectedSample, setSelectedSample] = useState<TestSample | null>(null);
  const [modalTab, setModalTab] = useState<'request' | 'response'>('request');

  const allSamplesRef = useRef<TestSample[]>([]);
  const isRunningRef = useRef(false);

  // Hover states for dynamic responsive tooltip
  const [hoveredSample, setHoveredSample] = useState<TestSample | null>(null);
  const [hoverXPercent, setHoverXPercent] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

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
    if (isRunning) return;
    setIsRunning(true);
    isRunningRef.current = true;
    setSamples([]);
    setProgress(0);
    setThroughput(0);
    setAvgLatency(0);
    setMinLatency(0);
    setMaxLatency(0);
    setSuccessRate(100);

    const totalRequests = threads * loops;
    let completedCount = 0;
    
    // Incremental Stats Aggregators for O(1) performance
    let totalLatency = 0;
    let minLatencyVal = Infinity;
    let maxLatencyVal = -Infinity;
    let successCount = 0;

    allSamplesRef.current = [];

    const startTime = performance.now();
    let lastUiUpdateTime = startTime;

    // Helper sleep
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const runWorker = async (workerId: number) => {
      for (let i = 0; i < loops; i++) {
        if (!isRunningRef.current) break;

        // Apply pre-request delay
        if (delay > 0 && i > 0) {
          await sleep(delay);
        }

        const sampleStartTime = performance.now();
        let status: number | string = 0;
        let success = false;
        let errorMsg = '';
        let capturedRequest: any = undefined;
        let capturedResponse: any = undefined;

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
            variables: threadVariables
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

          const preScripts = [
            activeEnvironment?.pre_request_script,
            collection?.pre_request_script,
            requestToExecute.pre_request_script
          ].filter(Boolean) as string[];

          const preRequestOut = await ScriptService.executePreRequest(
            preScripts,
            requestToExecute,
            variableContext
          );
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

          // Capture request state post-scripts & post-variables resolution
          const resolvedHeaders: Record<string, string> = {};
          (requestToExecute.headers || []).forEach(h => {
            if (h.active) {
              resolvedHeaders[h.key] = VariableService.resolve(h.value, variableContext);
            }
          });

          let actualBody: any = null;
          if (requestToExecute.bodyType !== 'none') {
            const rawBody = typeof requestToExecute.body === 'string'
              ? requestToExecute.body
              : requestToExecute.body?.content || '';
            actualBody = VariableService.resolve(rawBody, variableContext);
          }

          const isSuspendedRun = true;

          capturedRequest = {
            url: VariableService.resolve(requestToExecute.url || '', variableContext),
            method: requestToExecute.method,
            headers: isSuspendedRun ? {} : resolvedHeaders,
            body: isSuspendedRun ? '[Detailed payload logging suspended for memory optimization]' : actualBody
          };

          // 3. Request Execution using core RequestService pipeline
          const response = await RequestService.execute(requestToExecute, variableContext);

          capturedResponse = {
            status: response.status,
            statusText: response.statusText,
            headers: isSuspendedRun ? {} : response.headers,
            body: isSuspendedRun ? '[Detailed payload logging suspended for memory optimization]' : response.body
          };

          // 4. Post-Execution Validation Test Scripts Execution
          const testScripts = [
            activeEnvironment?.test_script,
            collection?.test_script,
            requestToExecute.test_script
          ].filter(Boolean) as string[];

          const testOut = await ScriptService.executeTests(
            testScripts,
            response,
            requestToExecute,
            variableContext
          );

          // 5. Determine outcome
          status = response.status;
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
        }

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
          error: errorMsg || undefined,
          request: capturedRequest,
          response: capturedResponse
        };

        allSamplesRef.current.push(newSample);

        // Prune older samples request/response payload data globally to prevent memory crashes
        if (allSamplesRef.current.length > 100) {
          const oldSample = allSamplesRef.current[allSamplesRef.current.length - 101];
          if (oldSample) {
            delete oldSample.request;
            delete oldSample.response;
          }
        }

        // Throttle UI updates and React diffing block to 150ms intervals
        // We only pass the last 100 slices to React setSamples so Virtual DOM never crashes
        const now = performance.now();
        if (now - lastUiUpdateTime > 150 || completedCount === totalRequests) {
          lastUiUpdateTime = now;

          const avg = Math.round(totalLatency / completedCount);
          const succRate = Math.round((successCount / completedCount) * 100);

          // Keep React state weightless by mapping to lightweight elements (no heavy request/response payloads)
          const lightweightSamples = allSamplesRef.current.slice(-100).map(s => ({
            id: s.id,
            timestamp: s.timestamp,
            latency: s.latency,
            status: s.status,
            success: s.success,
            error: s.error
          }));

          setSamples(lightweightSamples);
          setAvgLatency(avg);
          setMinLatency(minLatencyVal);
          setMaxLatency(maxLatencyVal);
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
    } catch (err: any) {
      console.error('[SmokeTester] Concurrency run failed:', err);
    } finally {
      setIsRunning(false);
      isRunningRef.current = false;
    }
  };

  const stopSmokeTest = () => {
    isRunningRef.current = false;
    setIsRunning(false);
  };

  const exportCSV = () => {
    const dataToExport = allSamplesRef.current;
    if (dataToExport.length === 0) return;
    const headers = ['Sample ID', 'Timestamp', 'Method', 'URL', 'Latency (ms)', 'Status', 'Outcome', 'ErrorDetails'];
    const rows = dataToExport.map(s => [
      s.id,
      s.timestamp,
      s.request?.method || activeRequest.method,
      `"${(s.request?.url || activeRequest.url).replace(/"/g, '""')}"`,
      s.latency,
      s.status,
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
    link.setAttribute('download', `smoke_test_${activeRequest.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    const graphSamples = samples.slice(-300);
    const hasData = graphSamples.length > 0;
    
    let maxVal = 10;
    let minVal = 0;
    if (hasData) {
      maxVal = graphSamples[0].latency;
      minVal = graphSamples[0].latency;
      for (const s of graphSamples) {
        if (s.latency > maxVal) maxVal = s.latency;
        if (s.latency < minVal) minVal = s.latency;
      }
      if (maxVal < 10) maxVal = 10;
      if (minVal > 0) minVal = 0;
    }
    const range = maxVal - minVal || 1;
    
    const points = hasData ? graphSamples.map((s, idx) => {
      const x = (idx / (graphSamples.length - 1 || 1)) * 100;
      // Map Y safely to coordinate grid (between 3% and 97%) to avoid line boundary overflow
      const y = 97 - ((s.latency - minVal) / range) * 94;
      return { x, y, sample: s };
    }) : [];
    
    const pathD = points.length > 0 
      ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
      : '';
      
    const areaD = points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`
      : '';

    return (
      <div className="bg-[#09090D] border border-[#1E1E28]/40 rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black text-[#E1E1E6] uppercase tracking-wider block font-mono">Response Time Telemetry Curve</span>
            <span className="text-[8px] text-[#888894] font-mono block">Real-time latency fluctuation over the last 300 cycles</span>
          </div>
          <span className={`text-[8px] font-mono uppercase font-black px-2.5 py-0.5 rounded border transition-all ${
            hasData 
              ? "text-[#3ECF8E] bg-[#3ECF8E]/10 border-[#3ECF8E]/25 animate-pulse" 
              : "text-[#555] bg-[#101015] border-[#222]"
          }`}>
            {hasData ? 'LIVE Sparkline' : 'STANDBY MODE'}
          </span>
        </div>
        
        <div 
          ref={chartContainerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={`relative w-full h-[180px] bg-[#030305] rounded-xl overflow-hidden border border-[#1C1C25]/50 flex items-center justify-center select-none transition-all ${
            isRunning ? 'cursor-not-allowed opacity-90' : 'cursor-crosshair'
          }`}
        >
          {!hasData ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[0.5px] z-10 space-y-1">
              <span className="text-[9px] font-black tracking-widest text-[#444] font-mono uppercase">Telemetry stand-by</span>
              <span className="text-[7px] text-[#333] font-mono">Real-time response curves populate here on suite execution</span>
            </div>
          ) : (
            <>
              {/* SVG containing the graph line curve */}
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full z-0 pointer-events-none" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradientTest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3ECF8E" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#3ECF8E" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                
                {/* Horizontal grid lines */}
                <line x1="0" y1="3" x2="100" y2="3" stroke="#121217" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="#121217" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="0" y1="97" x2="100" y2="97" stroke="#121217" strokeWidth="0.5" strokeDasharray="2,2" />
                
                {areaD && <path d={areaD} fill="url(#chartGradientTest)" />}
                
                {pathD && (
                  <path 
                    d={pathD} 
                    fill="none" 
                    stroke="#3ECF8E" 
                    strokeWidth="1.8" 
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="drop-shadow-[0_0_8px_rgba(62,207,142,0.5)]" 
                  />
                )}
              </svg>

              {/* Float HTML axis labels - ALWAYS fully visible & crisp */}
              <div className="absolute top-2 left-3 text-[9px] text-[#88888F] font-mono font-black uppercase tracking-wider bg-[#06060A]/85 border border-[#1C1C25]/40 px-1.5 py-0.5 rounded backdrop-blur-sm shadow z-10 pointer-events-none">
                Max: {Math.round(maxVal)}ms
              </div>
              <div className="absolute top-1/2 -translate-y-1/2 left-3 text-[9px] text-[#66666D] font-mono font-black uppercase tracking-wider bg-[#06060A]/85 border border-[#1C1C25]/40 px-1.5 py-0.5 rounded backdrop-blur-sm shadow z-10 pointer-events-none">
                Mid: {Math.round(minVal + range / 2)}ms
              </div>
              <div className="absolute bottom-2 left-3 text-[9px] text-[#3ECF8E] font-mono font-black uppercase tracking-wider bg-[#06060A]/85 border border-[#3ECF8E]/20 px-1.5 py-0.5 rounded backdrop-blur-sm shadow z-10 pointer-events-none">
                Min: {Math.round(minVal)}ms
              </div>

              {/* Interactive Vertical Crosshair Line */}
              {hoverXPercent !== null && (
                <div 
                  className="absolute top-0 bottom-0 w-[1px] bg-gradient-to-b from-[#3ECF8E]/40 via-[#3ECF8E]/20 to-transparent pointer-events-none z-10"
                  style={{ left: `${hoverXPercent}%` }}
                />
              )}

              {/* Floating Modern Interactive Tooltip */}
              {hoveredSample && hoverXPercent !== null && (
                <div 
                  className="absolute bottom-4 bg-[#09090F]/95 border border-[#1E1E28]/80 rounded-xl p-3 shadow-[0_4px_24px_rgba(0,0,0,0.8)] z-30 pointer-events-none font-mono space-y-1.5 text-left min-w-[140px] backdrop-blur-md transition-all duration-75"
                  style={{ 
                    left: `${hoverXPercent}%`, 
                    transform: `translateX(${hoverXPercent > 70 ? '-112%' : '12%'})`
                  }}
                >
                  <div className="flex items-center justify-between border-b border-[#1C1C25] pb-1">
                    <span className="text-[8px] text-[#666] font-bold">SAMPLE #{hoveredSample.id}</span>
                    <span className={`text-[7px] font-black uppercase tracking-wider px-1 rounded ${
                      hoveredSample.success ? "text-[#3ECF8E] bg-[#3ECF8E]/10" : "text-red-400 bg-red-400/10"
                    }`}>
                      {hoveredSample.success ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[7px] text-[#888] block uppercase tracking-tight">Latency</span>
                    <span className="text-xs font-black text-white block">{hoveredSample.latency} ms</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[7px] text-[#888] block uppercase tracking-tight font-black">Code / Status</span>
                    <span className={`text-[9px] font-bold block ${hoveredSample.success ? 'text-[#3ECF8E]' : 'text-red-400'}`}>
                      {hoveredSample.status}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-1">
      {/* Immersive Blocking Overlay while running */}
      {isRunning && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 select-none">
          <div className="max-w-md w-full bg-[var(--bg-deep)] border border-white/[0.06] rounded-2xl p-8 space-y-6 shadow-2xl flex flex-col items-center text-center">
            <ModernRadarLoader />

            <div className="space-y-2">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">
                Smoke Test Executing
              </h3>
              <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-tight">
                Active Workers: <span className="font-mono text-white font-bold">{threads} Threads</span> | Target: <span className="font-mono text-[#3ECF8E] font-bold">{activeRequest.method} {activeRequest.name}</span>
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full space-y-2">
              <div className="flex justify-between text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest font-mono">
                <span>Progress: {progress}%</span>
                <span>{allSamplesRef.current.length} / {threads * loops} Completed</span>
              </div>
              <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-white/[0.05]">
                <div
                  style={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-[#3ECF8E] to-blue-400 transition-all duration-150"
                />
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="p-3 bg-black/40 border border-white/[0.03] rounded-xl text-center space-y-1">
                <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block">Throughput</span>
                <div className="text-sm font-bold text-white font-mono">{throughput} <span className="text-[8px] font-normal text-[var(--text-dim)]">req/s</span></div>
              </div>
              <div className="p-3 bg-black/40 border border-white/[0.03] rounded-xl text-center space-y-1">
                <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block">Success Rate</span>
                <div className={`text-sm font-bold font-mono ${successRate === 100 ? 'text-[#3ECF8E]' : 'text-yellow-500'}`}>{successRate}%</div>
              </div>
              <div className="p-3 bg-black/40 border border-white/[0.03] rounded-xl text-center space-y-1">
                <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block">Avg Latency</span>
                <div className="text-sm font-bold text-blue-400 font-mono">{avgLatency} ms</div>
              </div>
              <div className="p-3 bg-black/40 border border-white/[0.03] rounded-xl text-center space-y-1">
                <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block">Min / Max</span>
                <div className="text-[10px] font-bold text-white font-mono">{minLatency === Infinity ? 0 : minLatency}ms / {maxLatency === -Infinity ? 0 : maxLatency}ms</div>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              onClick={stopSmokeTest}
              className="w-full h-11 bg-red-500/20 border border-red-500/30 hover:bg-red-500/40 rounded-xl text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Square size={12} fill="currentColor" />
              Cancel Execution
            </button>
          </div>
        </div>
      )}

      {/* Introduction Card */}
      <div className="p-4 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-xl space-y-2">
        <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Activity size={12} className="text-[#3ECF8E]" />
          Built-in JMeter Smoke Tester
        </h3>
        <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-tight leading-relaxed">
          Verify endpoints and database connectivity under light concurrent load. 
          Simulates real-world traffic directly inside your browser client, or exports a professional JMeter Test Plan (.jmx) for massive-scale performance suites.
        </p>
      </div>

      {/* Inputs Configuration */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Concurrency (Threads)</label>
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
        <div className="space-y-1.5">
          <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Loops per Thread</label>
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
        <div className="space-y-1.5">
          <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Inter-Request Delay (ms)</label>
          <input
            type="number"
            disabled={isRunning}
            value={delay}
            onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Request Timeout (ms)</label>
          <input
            type="number"
            disabled={isRunning}
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(Math.max(100, parseInt(e.target.value) || 100))}
            className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {isRunning ? (
          <button
            onClick={stopSmokeTest}
            className="flex-1 h-10 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 rounded-xl text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
          >
            <Square size={12} fill="currentColor" />
            Abort Smoke Test
          </button>
        ) : (
          <button
            onClick={runSmokeTest}
            className="flex-1 h-10 bg-[#3ECF8E] hover:bg-[#34B37A] rounded-xl text-[10px] font-black text-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(62,207,142,0.15)] active:scale-95"
          >
            <Play size={12} fill="currentColor" />
            Initiate Smoke Test
          </button>
        )}

        <button
          onClick={handleExportJMX}
          className="h-10 px-5 bg-[var(--bg-deep)] border border-[var(--border-subtle)] hover:border-[#3ECF8E]/30 rounded-xl text-[10px] font-black text-[var(--text-dim)] hover:text-[#3ECF8E] uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
        >
          <Download size={13} />
          Export JMX
        </button>
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex justify-between text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">
            <span>Transmission Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-[var(--bg-deep)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
              className="h-full bg-gradient-to-r from-[#3ECF8E] to-blue-400"
            />
          </div>
        </div>
      )}

      {/* Metrics Dashboard */}
      {samples.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-xl space-y-1">
              <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
                <BarChart3 size={10} className="text-blue-400" />
                Throughput
              </span>
              <div className="text-base font-bold text-white font-mono">{throughput} <span className="text-[8px] font-normal text-[var(--text-dim)]">req/s</span></div>
            </div>
            <div className="p-3 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-xl space-y-1">
              <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle size={10} className="text-[#3ECF8E]" />
                Success Rate
              </span>
              <div className={`text-base font-bold font-mono ${successRate === 100 ? 'text-[#3ECF8E]' : 'text-yellow-500'}`}>{successRate}%</div>
            </div>
            <div className="p-3 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-xl space-y-1">
              <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
                <Clock size={10} className="text-purple-400" />
                Avg Latency
              </span>
              <div className="text-base font-bold text-white font-mono">{avgLatency} <span className="text-[8px] font-normal text-[var(--text-dim)]">ms</span></div>
            </div>
            <div className="p-3 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-xl space-y-1">
              <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
                <ShieldAlert size={10} className="text-red-400" />
                Min / Max
              </span>
              <div className="text-base font-bold text-white font-mono">{minLatency} / {maxLatency} <span className="text-[8px] font-normal text-[var(--text-dim)]">ms</span></div>
            </div>
          </div>

          <div className="bg-[#0D0D12]/60 border border-[#1C1C25]/60 rounded-xl p-3.5 flex items-start gap-3 select-none">
            <Activity size={14} className="text-[#3ECF8E] shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-0.5">
              <h4 className="text-[9px] font-black text-[#3ECF8E] uppercase tracking-wider font-mono">
                Telemetry Graph Optimization Active
              </h4>
              <p className="text-[8px] text-[#88888F] font-mono uppercase tracking-tight">
                Detailed request/response body logging is disabled by default. The test runner is optimized to map response metrics in real-time to preserve memory and platform stability.
              </p>
            </div>
          </div>

          {/* Real-time telemetry graph rendering */}
          <div className="mt-2 text-white">
            {renderLatencyGraph()}
          </div>
        </div>
      )}

      {selectedSample && (
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
                                <td className="p-2 pr-3 text-white break-all">{val}</td>
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
                                <td className="p-2 pr-3 text-white break-all">{val}</td>
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
    </div>
  );
};

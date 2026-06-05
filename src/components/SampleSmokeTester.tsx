import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Play, 
  Square, 
  Globe, 
  Settings, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  HelpCircle 
} from 'lucide-react';

export function SampleSmokeTester() {
  // Input parameters
  const [url, setUrl] = useState('https://www.google.com');
  const [method, setMethod] = useState('GET');
  const [threads, setThreads] = useState(3);
  const [loops, setLoops] = useState(5);
  const [delay, setDelay] = useState(150);

  // Runtime states
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [samples, setSamples] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [hoveredSample, setHoveredSample] = useState<any | null>(null);

  // Abort controller reference
  const isAbortedRef = useRef(false);
  const activeRequestsRef = useRef<Set<AbortController>>(new Set());

  // Automatically reset states when parameters change
  useEffect(() => {
    if (!isRunning) {
      setIsCompleted(false);
      setSamples([]);
      setProgress(0);
    }
  }, [url, method, threads, loops]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isAbortedRef.current = true;
      activeRequestsRef.current.forEach(ctrl => ctrl.abort());
    };
  }, []);

  const stopTest = () => {
    isAbortedRef.current = true;
    activeRequestsRef.current.forEach(ctrl => ctrl.abort());
    activeRequestsRef.current.clear();
    setIsRunning(false);
  };

  const runSingleRequest = async (threadId: number, ctrl: AbortController): Promise<any> => {
    const startTime = performance.now();
    let status = 0;
    let success = false;
    let statusText = 'Connection Refused';

    try {
      const controller = new AbortController();
      activeRequestsRef.current.add(controller);

      // We forward requests to our built-in server proxy to bypass CORS
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method,
          url,
        }),
        signal: controller.signal
      });

      activeRequestsRef.current.delete(controller);

      if (isAbortedRef.current) return null;

      const result = await response.json();
      status = result.status || response.status;
      success = status >= 200 && status < 400;
      statusText = result.statusText || response.statusText;
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      status = 0;
      success = false;
      statusText = err.message || 'CORS Error / Blocked';
    }

    const duration = Math.round(performance.now() - startTime);

    return {
      id: Math.random(),
      threadId,
      status,
      success,
      latency: duration,
      statusText,
      timestamp: Date.now()
    };
  };

  const startTest = async () => {
    isAbortedRef.current = false;
    setIsRunning(true);
    setIsCompleted(false);
    setSamples([]);
    setProgress(0);

    const totalRequests = threads * loops;
    let completedRequests = 0;

    // Helper sleep function
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Define worker function for each thread
    const runWorkerThread = async (threadId: number) => {
      for (let i = 0; i < loops; i++) {
        if (isAbortedRef.current) break;

        const ctrl = new AbortController();
        const sample = await runSingleRequest(threadId, ctrl);

        if (isAbortedRef.current) break;

        if (sample) {
          completedRequests++;
          setSamples(prev => [...prev, sample]);
          setProgress(Math.round((completedRequests / totalRequests) * 100));
        }

        // Delay between loops to prevent excessive client-side locking
        if (i < loops - 1) {
          await sleep(delay);
        }
      }
    };

    // Spawn workers concurrently
    const threadPromises = Array.from({ length: threads }).map((_, id) => runWorkerThread(id));
    
    await Promise.all(threadPromises);

    setIsRunning(false);
    if (!isAbortedRef.current) {
      setIsCompleted(true);
    }
  };

  // Math metrics for display
  const totalCount = samples.length;
  const successCount = samples.filter(s => s.success).length;
  const failureCount = totalCount - successCount;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 1000) / 10 : 0;
  
  const latencies = samples.map(s => s.latency);
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

  // Find percentage for visual bars
  const maxSampleLatency = Math.max(...latencies, 150); // Use 150 as default scale ceiling

  return (
    <div className="w-full max-w-4xl mx-auto rounded-xl border border-white/[0.04] bg-[#0A0A0B] p-5 md:p-7 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
      {/* Decorative scanner/laser sweep */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" />
      <div className="absolute top-0 left-0 w-24 h-px bg-gradient-to-r from-transparent via-[#3ECF8E]/30 to-transparent animate-[shimmer_2s_infinite]" />

      <div className="relative z-10 flex flex-col gap-6">
        
        {/* Header Title Grid */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.03] pb-5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isRunning ? 'bg-[#3ECF8E]/10 animate-pulse' : 'bg-white/[0.02]'} border border-white/[0.04]`}>
              <Activity size={18} className={isRunning ? 'text-[#3ECF8E]' : 'text-zinc-400'} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest font-display flex items-center gap-2">
                Interactive Smoke Suite Sandbox
                <span className="text-[7px] font-black tracking-widest px-1.5 py-0.5 rounded bg-[#3ECF8E]/10 text-[#3ECF8E] uppercase">
                  v1.0.0 Live
                </span>
              </h2>
              <p className="text-[9px] text-zinc-500 font-medium">
                Verify server integrity and check real-time latency distributions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[9px] font-mono text-zinc-500 bg-white/[0.01] border border-white/[0.03] px-3 py-1.5 rounded-lg select-none">
            <Globe size={11} className="text-[#3ECF8E]" />
            <span className="uppercase font-bold">Proxy Ingress:</span>
            <span className="text-white">Active Node Engine</span>
          </div>
        </div>

        {/* Input Parameters Controls bar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* URL Input */}
          <div className="lg:col-span-7 flex flex-col gap-1.5">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono flex items-center gap-1">
              Endpoint Address
              <span title="Enter any target URL. Default google.com goes through server backend to defeat CORS.">
                <HelpCircle size={10} className="text-zinc-600 cursor-help" />
              </span>
            </span>
            <div className="flex bg-black border border-white/5 rounded-lg overflow-hidden group focus-within:border-[#3ECF8E]/30 focus-within:ring-2 focus-within:ring-[#3ECF8E]/5 transition-all">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={isRunning}
                className="bg-[#0F0F10] px-3 py-2 text-[10px] font-mono font-black border-r border-white/5 text-[#3ECF8E] hover:bg-[#151517] transition-colors cursor-pointer outline-none uppercase"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isRunning}
                placeholder="https://example.com/api"
                className="flex-grow bg-transparent px-3.5 py-2 text-[10px] font-mono text-white outline-none placeholder:text-zinc-700"
              />
            </div>
          </div>

          {/* Sizing Parameters */}
          <div className="lg:col-span-5 grid grid-cols-3 gap-3">
            
            {/* Thread Slider */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Threads</span>
              <div className="bg-black border border-white/5 rounded-lg px-2.5 py-1.5 flex items-center justify-between font-mono">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={threads}
                  disabled={isRunning}
                  onChange={(e) => setThreads(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-8 text-[11px] font-bold text-white bg-transparent outline-none text-center"
                />
                <span className="text-[7px] text-zinc-500 uppercase tracking-tight font-black">Worker</span>
              </div>
            </div>

            {/* Loop Slider */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono font-bold">Loops</span>
              <div className="bg-black border border-white/5 rounded-lg px-2.5 py-1.5 flex items-center justify-between font-mono">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={loops}
                  disabled={isRunning}
                  onChange={(e) => setLoops(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-8 text-[11px] font-bold text-white bg-transparent outline-none text-center"
                />
                <span className="text-[7px] text-zinc-500 uppercase tracking-tight font-black">Iter</span>
              </div>
            </div>

            {/* Inter-request delay */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Delay</span>
              <div className="bg-black border border-white/5 rounded-lg px-2 py-1.5 flex items-center justify-between font-mono">
                <input
                  type="number"
                  min="0"
                  max="2000"
                  value={delay}
                  disabled={isRunning}
                  onChange={(e) => setDelay(Math.min(2000, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-9 text-[11px] font-bold text-white bg-transparent outline-none text-center"
                />
                <span className="text-[7px] text-zinc-500 uppercase tracking-tight font-black">ms</span>
              </div>
            </div>

          </div>
        </div>

        {/* Trigger Button & Status HUD line */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/[0.01] border border-white/[0.03] rounded-lg">
          <div className="flex items-center gap-3">
            {isRunning ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-ping" />
                <span className="text-[9px] font-semibold text-zinc-300 font-mono">
                  Transmitting active test load: <strong className="text-white font-black">{samples.length}</strong> / {threads * loops} finished...
                </span>
              </div>
            ) : isCompleted ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[#3ECF8E]" />
                <span className="text-[9px] font-semibold text-zinc-300 font-mono">
                  Transmission finished. Processed <strong className="text-white">{samples.length}</strong> metrics successfully.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Zap size={13} className="text-zinc-600" />
                <span className="text-[9px] font-semibold text-zinc-400 font-mono">
                  State: <strong className="text-zinc-500 font-black">READY TO DEPLOY TEST ENGINES</strong>
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {isRunning ? (
              <button
                onClick={stopTest}
                className="px-5 py-2 rounded-md bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 font-black text-[9px] tracking-wider uppercase font-mono flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Square size={10} fill="currentColor" />
                Abort Safe
              </button>
            ) : (
              <button
                onClick={startTest}
                className="px-6 py-2 rounded-md bg-[#3ECF8E] hover:bg-[#34B37A] text-black font-black text-[9px] tracking-wider uppercase font-mono flex items-center gap-1.5 cursor-pointer shadow-[0_0_20px_rgba(62,207,142,0.15)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Play size={10} fill="currentColor" />
                Deploy Suite
              </button>
            )}
          </div>
        </div>

        {/* Live progress and Stats Module Grid */}
        <div className="space-y-4">
          
          {/* Progress Bar (visible only when active/completed) */}
          {(isRunning || totalCount > 0) && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[7.5px] font-black font-mono tracking-wider text-zinc-500 uppercase">
                <span>Core Sync Progress</span>
                <span className="text-white">{progress}%</span>
              </div>
              <div className="w-full h-[3px] bg-white/[0.02] border border-white/[0.01] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#3ECF8E] to-blue-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Real-time stats HUD Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            
            {/* HUD 1: Success Rate */}
            <div className="bg-[#050506]/85 border border-white/[0.02] rounded-lg p-3 flex flex-col justify-between select-none relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-12 h-12 bg-[#3ECF8E]/2 rounded-full blur-md -mr-4 -mt-4 opacity-50" />
              <span className="text-[7.5px] font-black text-zinc-500 uppercase tracking-wider font-mono">Success Rate</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-xl font-mono leading-none font-bold ${totalCount === 0 ? 'text-zinc-600' : successRate >= 90 ? 'text-[#3ECF8E]' : successRate >= 70 ? 'text-amber-500' : 'text-red-400'}`}>
                  {totalCount === 0 ? '---' : `${successRate}%`}
                </span>
              </div>
              <span className="mt-1.5 text-[7px] text-zinc-600 font-bold uppercase tracking-wide font-mono">
                {totalCount === 0 ? 'No load sent' : `${successCount} pkts / ${failureCount} errs`}
              </span>
            </div>

            {/* HUD 2: Avg Latency */}
            <div className="bg-[#050506]/85 border border-white/[0.02] rounded-lg p-3 flex flex-col justify-between select-none relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-12 h-12 bg-blue-500/2 rounded-full blur-md -mr-4 -mt-4 opacity-50" />
              <span className="text-[7.5px] font-black text-zinc-500 uppercase tracking-wider font-mono">Avg Latency</span>
              <div className="mt-2 flex items-baseline gap-0.5">
                <span className="text-xl font-mono leading-none font-bold text-white">
                  {totalCount === 0 ? '---' : `${avgLatency}`}
                </span>
                {totalCount > 0 && <span className="text-[9px] font-bold text-zinc-500 font-mono">ms</span>}
              </div>
              <span className="mt-1.5 text-[7px] text-zinc-600 font-bold uppercase tracking-wide font-mono flex items-center gap-1">
                <Clock size={8} /> Network Roundtrip
              </span>
            </div>

            {/* HUD 3: Performance Ceiling (Min/Max) */}
            <div className="bg-[#050506]/85 border border-white/[0.02] rounded-lg p-3 flex flex-col justify-between select-none relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-12 h-12 bg-purple-500/2 rounded-full blur-md -mr-4 -mt-4 opacity-50" />
              <span className="text-[7.5px] font-black text-zinc-500 uppercase tracking-wider font-mono">Variance Ceiling</span>
              <div className="mt-2 text-white font-mono flex flex-col">
                <span className="text-xs font-bold leading-normal">
                  <span className="text-zinc-600 mr-1">MIN:</span>{totalCount === 0 ? '---' : `${minLatency}ms`}
                </span>
                <span className="text-xs font-bold leading-normal">
                  <span className="text-zinc-600 mr-1">MAX:</span>{totalCount === 0 ? '---' : `${maxLatency}ms`}
                </span>
              </div>
              <span className="mt-1 text-[7px] text-zinc-600 font-bold uppercase tracking-wide font-mono">
                Latency Distribution Range
              </span>
            </div>

            {/* HUD 4: Throttling & Queue status */}
            <div className="bg-[#050506]/85 border border-white/[0.02] rounded-lg p-3 flex flex-col justify-between select-none relative group overflow-hidden">
              <div className="absolute top-0 right-0 w-12 h-12 bg-pink-500/2 rounded-full blur-md -mr-4 -mt-4 opacity-50" />
              <span className="text-[7.5px] font-black text-zinc-500 uppercase tracking-wider font-mono">Load Capacity</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl font-mono leading-none font-bold text-[#3ECF8E] drop-shadow-[0_0_8px_rgba(62,207,142,0.1)]">
                  {totalCount === 0 ? '---' : `${Math.round((totalCount / (threads * loops)) * 100)}%`}
                </span>
              </div>
              <span className="mt-1.5 text-[7px] text-zinc-600 font-bold uppercase tracking-wide font-mono">
                {isRunning ? 'TRANSMISSIONS RUNNING' : isCompleted ? 'FULL AUDIT CONCLUDED' : 'Awaiting Deployment'}
              </span>
            </div>

          </div>

          {/* Live distribution CSS-bar visual chart */}
          {totalCount > 0 && (
            <div className="space-y-2 pt-1 border-t border-white/[0.02]">
              <div className="flex justify-between items-center text-[7.5px] font-black font-mono tracking-wider text-zinc-500 uppercase">
                <span>Packet Index & Latency Grid</span>
                <span className="text-zinc-500 lowercase">hover bar for server telemetry diagnostics</span>
              </div>

              <div className="relative">
                {/* Visual grid line marks */}
                <div className="absolute inset-x-0 top-0 h-24 flex flex-col justify-between pointer-events-none border-b border-white/[0.02]">
                  <div className="border-t border-white/[0.03] w-full h-px" />
                  <div className="border-t border-dashed border-white/[0.02] w-full h-px" />
                  <div className="border-t border-dashed border-white/[0.02] w-full h-px" />
                </div>

                {/* Bars Row container */}
                <div className="relative h-24 bg-black/40 border border-white/[0.02] rounded-lg flex items-end p-2 md:gap-1.5 gap-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
                  {samples.map((sample, idx) => {
                    // Height is proportional to latency
                    const heightPct = Math.min(100, (sample.latency / maxSampleLatency) * 100);
                    return (
                      <div
                        key={sample.id}
                        onMouseEnter={() => setHoveredSample(sample)}
                        onMouseLeave={() => setHoveredSample(null)}
                        className="flex-1 min-w-[8px] max-w-[20px] h-full flex items-end justify-center group cursor-pointer"
                      >
                        <div 
                          className={`w-full rounded-t-[1.5px] transition-all duration-300 ${
                            sample.success 
                              ? 'bg-[#3ECF8E]/55 hover:bg-[#3ECF8E]' 
                              : 'bg-red-500/50 hover:bg-red-500'
                          }`}
                          style={{ height: `${Math.max(4, heightPct)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Holographic Tooltip overlays */}
                <AnimatePresence>
                  {hoveredSample && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      transition={{ duration: 0.12 }}
                      className="absolute left-1/2 bottom-26 -translate-x-1/2 z-30 bg-[#0E0E10] border border-white/[0.06] shadow-2xl rounded-lg px-3.5 py-2.5 w-60 text-left select-none pointer-events-none flex flex-col gap-1.5 backdrop-blur-md"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[7.5px] font-black text-zinc-500 uppercase tracking-widest font-mono">
                          Worker Thread #{hoveredSample.threadId}
                        </span>
                        <span className={`text-[7px] font-black tracking-widest px-1.5 py-0.5 rounded uppercase font-mono ${
                          hoveredSample.success ? 'bg-[#3ECF8E]/10 text-[#3ECF8E]' : 'bg-red-500/10 text-red-400'
                        }`}>
                          HTTP {hoveredSample.status || 'ERR'}
                        </span>
                      </div>
                      <div className="h-px bg-white/[0.04] w-full" />
                      <div className="grid grid-cols-2 gap-y-1 text-[9px] font-mono font-medium">
                        <span className="text-zinc-500">Latency:</span>
                        <span className="text-white text-right font-bold">{hoveredSample.latency} ms</span>
                        <span className="text-zinc-500">Result:</span>
                        <span className={`text-right font-black ${hoveredSample.success ? 'text-[#3ECF8E]' : 'text-red-400'}`}>
                          {hoveredSample.success ? 'SUCCESS' : 'FAILED'}
                        </span>
                        <span className="text-zinc-500">Message:</span>
                        <span className="text-white text-right text-[8px] break-words line-clamp-1">{hoveredSample.statusText}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

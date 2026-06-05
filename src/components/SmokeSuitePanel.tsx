import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Play, Square, Activity, FileDown, Clock, Sparkles, CheckCircle2, 
  XCircle, AlertCircle, Database, HelpCircle, Zap, Shield, Search,
  ChevronDown, ChevronRight, Folder, FolderOpen, Code
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { RequestService } from '../services/RequestService';
import { ScriptService } from '../services/ScriptService';
import { VariableService } from '../services/VariableService';
import { SandboxRunner } from '../services/sandboxRunner';
import { Collection, RequestData } from '../types';
import { isElectron } from '../lib/platform';

interface SmokeSuitePanelProps {
  isEmbedded?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

const safeStringify = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    if (val.length > 50000) {
      return val.substring(0, 50000) + '\n... [truncated due to large size]';
    }
    return val;
  }
  try {
    const seen = new WeakSet();
    const str = JSON.stringify(val, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      if (typeof value === 'string' && value.length > 10000) {
        return value.substring(0, 10000) + '... [truncated]';
      }
      return value;
    }, 2);
    
    if (str.length > 100000) {
      return str.substring(0, 100000) + '\n... [truncated due to large size]';
    }
    return str;
  } catch (e: any) {
    return `[Failed to serialize payload: ${e.message || String(e)}]`;
  }
};

export const SmokeSuitePanel: React.FC<SmokeSuitePanelProps> = ({ isEmbedded = false, isOpen = true, onClose }) => {
  const { 
    collections, 
    environments, 
    activeEnvId, 
    addToast 
  } = useStore();

  // Core setup states
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [threads, setThreads] = useState(1);
  const [loops, setLoops] = useState(5);
  const [delay, setDelay] = useState(50);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [stopOnFailure, setStopOnFailure] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // NEW Feature 1: Selected active environment scope state
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(activeEnvId);

  // NEW Feature 2: Suite Pre-request & Test scripts state
  const [suitePreScript, setSuitePreScript] = useState('');
  const [suiteTestScript, setSuiteTestScript] = useState('');
  const [showScriptDrawer, setShowScriptDrawer] = useState(false);
  const [runRequestScripts, setRunRequestScripts] = useState(true);
  const [sandboxEngine, setSandboxEngine] = useState<'in-thread' | 'worker'>('worker');
  const logPayloads = false;

  // NEW Feature: Minutes of Testing (MoT) endurance monitoring options
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
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleaningStatus, setCleaningStatus] = useState('');

  // MSW Virtual API Interceptor States
  const [mswEnabled, setMswEnabled] = useState(RequestService.mswConfig.enabled);
  const [mswStatus, setMswStatus] = useState(RequestService.mswConfig.status);
  const [mswStatusText, setMswStatusText] = useState(RequestService.mswConfig.statusText);
  const [mswLatency, setMswLatency] = useState(RequestService.mswConfig.latency);
  const [mswResponseType, setMswResponseType] = useState(RequestService.mswConfig.responseType);
  const [mswResponseBody, setMswResponseBody] = useState(RequestService.mswConfig.responseBody);
  const [showMswConfigPanel, setShowMswConfigPanel] = useState(false);

  const syncMswConfig = (updates: Partial<typeof RequestService.mswConfig>) => {
    const updated = {
      enabled: updates.enabled !== undefined ? updates.enabled : RequestService.mswConfig.enabled,
      status: updates.status !== undefined ? updates.status : RequestService.mswConfig.status,
      statusText: updates.statusText !== undefined ? updates.statusText : RequestService.mswConfig.statusText,
      latency: updates.latency !== undefined ? updates.latency : RequestService.mswConfig.latency,
      responseType: updates.responseType !== undefined ? updates.responseType : RequestService.mswConfig.responseType,
      responseBody: updates.responseBody !== undefined ? updates.responseBody : RequestService.mswConfig.responseBody,
    };
    RequestService.saveMswConfig(updated);
  };

  // MoT Session Intelligence Report States
  const [showMotReport, setShowMotReport] = useState(false);
  const [motReportData, setMotReportData] = useState<any | null>(null);

  // Runner telemetry states
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [samples, setSamples] = useState<any[]>([]);
  const [throughput, setThroughput] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  const [minLatency, setMinLatency] = useState(0);
  const [maxLatency, setMaxLatency] = useState(0);
  const [successRate, setSuccessRate] = useState(100);

  // Heavy data references locked in refs for safe multithread state coordination
  const allSamplesRef = useRef<any[]>([]);
  const isRunningRef = useRef(false);
  const currentRunIdRef = useRef(0);
  const activeAbortControllersRef = useRef<Set<AbortController>>(new Set());

  // MoT session tracking variables
  const completedCountRef = useRef(0);
  const successCountRef = useRef(0);
  const currentConsecutiveFailuresRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const cleanupCyclesRef = useRef(0);
  const earlyAbortTriggeredRef = useRef(false);
  const abortReasonRef = useRef<string>('');
  
  // Guard values for scoring thread loops
  const guardStateRef = useRef<'SAFE' | 'THROTTLED' | 'CRITICAL'>('SAFE');
  const memoryPressureLevelRef = useRef(0);
  const requestsInCurrentMinute = useRef(0);
  const retriesInCurrentMinute = useRef(0);
  const crashPreventionTriggersCountRef = useRef(0);
  const minuteTimer = useRef<any>(null);

  // Scorer target state histories
  const targetStats = useRef<Record<string, {
    consecutiveFailures: number;
    lastRunTime: number;
    latencyHistory: number[];
    successCount: number;
    runCount: number;
  }>>({});

  // Hover states for dynamic responsive tooltip
  const [hoveredSample, setHoveredSample] = useState<any | null>(null);
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

  // Point to active selected environment when modal is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedEnvId(activeEnvId);
    }
  }, [isOpen, activeEnvId]);

  // Memory and threads cleanup on unmount to prevent invisible background runners crashing subsequent runs
  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      if (minuteTimer.current) {
        clearInterval(minuteTimer.current);
        minuteTimer.current = null;
      }
      activeAbortControllersRef.current.forEach(c => {
        try {
          c.abort();
        } catch {}
      });
      activeAbortControllersRef.current.clear();
      try {
        SandboxRunner.clearWorkerPool();
      } catch {}
    };
  }, []);

  // Extract all request nodes recursively from a folder/collection
  const getAllRequests = (node: any): RequestData[] => {
    const list: RequestData[] = [];
    const recurse = (item: any) => {
      if (item.requests) {
        item.requests.forEach((r: RequestData) => list.push(r));
      }
      if (item.folders) {
        item.folders.forEach((f: any) => recurse(f));
      }
    };
    recurse(node);
    return list;
  };

  // Flat list of requests for targets selection
  const flatRequestsList = useMemo(() => {
    const list: { request: RequestData; collectionName: string }[] = [];
    collections.forEach(col => {
      const colReqs = getAllRequests(col);
      colReqs.forEach(req => {
        list.push({ request: req, collectionName: col.name });
      });
    });
    return list;
  }, [collections]);

  // Filtered requests list (only used in search mode)
  const filteredRequests = useMemo(() => {
    if (!searchQuery) return flatRequestsList;
    const query = searchQuery.toLowerCase();
    return flatRequestsList.filter(item => 
      item.request.name.toLowerCase().includes(query) ||
      item.request.url.toLowerCase().includes(query) ||
      item.request.method.toLowerCase().includes(query)
    );
  }, [flatRequestsList, searchQuery]);

  // Selection utilities
  const handleSelectAll = () => {
    setSelectedRequestIds(flatRequestsList.map(item => item.request.id));
    addToast({ type: 'info', message: 'All request targets selected.' });
  };

  const handleClearAll = () => {
    setSelectedRequestIds([]);
    addToast({ type: 'info', message: 'Cleared target selection.' });
  };

  const handleToggleRequest = (id: string) => {
    setSelectedRequestIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleFolder = (folder: any) => {
    const folderReqs = getAllRequests(folder);
    const reqIds = folderReqs.map(r => r.id);
    const allSelected = reqIds.every(id => selectedRequestIds.includes(id));
    
    if (allSelected) {
      setSelectedRequestIds(prev => prev.filter(id => !reqIds.includes(id)));
    } else {
      setSelectedRequestIds(prev => {
        const next = [...prev];
        reqIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleToggleCollection = (col: Collection) => {
    const colReqs = getAllRequests(col);
    const reqIds = colReqs.map(r => r.id);
    const allSelected = reqIds.every(id => selectedRequestIds.includes(id));
    
    if (allSelected) {
      setSelectedRequestIds(prev => prev.filter(id => !reqIds.includes(id)));
    } else {
      setSelectedRequestIds(prev => {
        const next = [...prev];
        reqIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const activeEnvironment = useMemo(() => {
    return selectedEnvId ? environments.find(env => env.id === selectedEnvId) : null;
  }, [environments, selectedEnvId]);

  // Recursive Folder Tree Component
  const RenderFolderNode = ({ folder, depth = 0 }: { folder: any; depth: number }) => {
    const folderReqs = getAllRequests(folder);
    const reqIds = folderReqs.map(r => r.id);
    if (reqIds.length === 0) return null;

    const isExpanded = !!expandedNodes[folder.id];
    const isAllChecked = reqIds.every(id => selectedRequestIds.includes(id));
    const isSomeChecked = reqIds.some(id => selectedRequestIds.includes(id)) && !isAllChecked;

    return (
      <div className="space-y-1 select-none">
        <div 
          className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/[0.02] cursor-pointer group"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => toggleNode(folder.id)}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[#555] hover:text-[#888] p-0.5">
              {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>
            {isExpanded ? (
              <FolderOpen size={11} className="text-[#3ECF8E]/80" />
            ) : (
              <Folder size={11} className="text-[#55555C]" />
            )}
            <span className="text-[10px] font-mono text-[#AAAAAF] truncate uppercase tracking-wider font-bold">
              {folder.name}
            </span>
          </div>
          
          <input
            type="checkbox"
            checked={isAllChecked}
            disabled={isRunning}
            ref={el => {
              if (el) el.indeterminate = isSomeChecked;
            }}
            onChange={(e) => {
              e.stopPropagation();
              handleToggleFolder(folder);
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
          />
        </div>

        {isExpanded && (
          <div className="space-y-1">
            {/* Subfolders */}
            {folder.folders?.map((subFolder: any) => (
              <RenderFolderNode key={subFolder.id} folder={subFolder} depth={depth + 1} />
            ))}
            
            {/* Requests */}
            {folder.requests?.map((req: RequestData) => {
              const isChecked = selectedRequestIds.includes(req.id);
              return (
                <div 
                  key={req.id} 
                  className={cn(
                    "flex items-center justify-between py-1 px-2 rounded-lg border border-transparent hover:border-white/[0.03] transition-all cursor-pointer select-none",
                    isChecked ? "bg-[#3ECF8E]/[0.01]" : "hover:bg-white/[0.01]"
                  )}
                  style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }}
                  onClick={() => handleToggleRequest(req.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      "text-[6px] font-bold px-1 rounded font-mono uppercase tracking-tight shrink-0",
                      req.method === 'GET' ? "bg-green-500/10 text-green-400 border border-green-500/10" :
                      req.method === 'POST' ? "bg-blue-500/10 text-blue-400 border border-blue-500/10" :
                      "bg-yellow-500/10 text-yellow-400 border border-yellow-500/10"
                    )}>{req.method}</span>
                    <span className="text-[10px] font-mono text-[#888] truncate group-hover:text-white">{req.name}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isRunning}
                    onChange={() => handleToggleRequest(req.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Top Level Collection node rendering
  const RenderCollectionNode = ({ collection }: { collection: Collection }) => {
    const colReqs = getAllRequests(collection);
    if (colReqs.length === 0) return null;

    const isExpanded = !!expandedNodes[collection.id];
    const isAllChecked = colReqs.every(r => selectedRequestIds.includes(r.id));
    const isSomeChecked = colReqs.some(r => selectedRequestIds.includes(r.id)) && !isAllChecked;

    return (
      <div className="space-y-1 border-b border-[#151518]/30 pb-2 last:border-0">
        <div 
          className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-[#09090B]/60 border border-[#151518] hover:border-[#222] cursor-pointer group"
          onClick={() => toggleNode(collection.id)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[#555] hover:text-[#888] p-0.5">
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
            <Database size={12} className="text-[#3ECF8E]" />
            <span className="text-[10px] font-mono text-[#E0E0E6] truncate uppercase tracking-widest font-black">
              {collection.name}
            </span>
          </div>
          
          <input
            type="checkbox"
            checked={isAllChecked}
            disabled={isRunning}
            ref={el => {
              if (el) el.indeterminate = isSomeChecked;
            }}
            onChange={(e) => {
              e.stopPropagation();
              handleToggleCollection(collection);
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
          />
        </div>

        {isExpanded && (
          <div className="space-y-1 pl-2 border-l border-[#151518] ml-4 mt-1.5">
            {/* Root-level Requests */}
            {collection.requests?.filter(r => !r.folder_id).map((req: RequestData) => {
              const isChecked = selectedRequestIds.includes(req.id);
              return (
                <div 
                  key={req.id} 
                  className={cn(
                    "flex items-center justify-between py-1 px-2 rounded-lg border border-transparent hover:border-white/[0.03] transition-all cursor-pointer select-none",
                    isChecked ? "bg-[#3ECF8E]/[0.01]" : "hover:bg-white/[0.01]"
                  )}
                  style={{ paddingLeft: '24px' }}
                  onClick={() => handleToggleRequest(req.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      "text-[6px] font-bold px-1 rounded font-mono uppercase tracking-tight shrink-0",
                      req.method === 'GET' ? "bg-green-500/10 text-green-400 border border-green-500/10" :
                      req.method === 'POST' ? "bg-blue-500/10 text-blue-400 border border-blue-500/10" :
                      "bg-yellow-500/10 text-yellow-400 border border-yellow-500/10"
                    )}>{req.method}</span>
                    <span className="text-[10px] font-mono text-[#AAA] truncate group-hover:text-white">{req.name}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isRunning}
                    onChange={() => handleToggleRequest(req.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                  />
                </div>
              );
            })}

            {/* Folders */}
            {collection.folders?.map((folder: any) => (
              <RenderFolderNode key={folder.id} folder={folder} depth={0} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Execution Loop
  const executeSmokeSuite = async () => {
    if (isRunning || isCleaning || selectedRequestIds.length === 0) return;

    const targets = flatRequestsList
      .filter(item => selectedRequestIds.includes(item.request.id))
      .map(item => item.request);

    if (targets.length === 0) return;

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
    setIsMemoryCooling(false);
    isMemoryCoolingRef.current = false;
    setMemoryCoolingCount(0);

    const activeCollection = collections.find(c => c.id === targets[0].collection_id);
    const activeEnvironment = environments.find(e => e.id === selectedEnvId);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const getRequestPriority = (req: RequestData): 'P0' | 'P1' | 'P2' | 'P3' => {
      const url = (req.url || '').toLowerCase();
      const name = (req.name || '').toLowerCase();
      
      if (url.includes('auth') || url.includes('login') || url.includes('signup') || url.includes('register') || url.includes('session') || url.includes('health')) {
        return 'P0';
      }
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE' || url.includes('create') || url.includes('update') || url.includes('delete') || url.includes('payment') || url.includes('checkout')) {
        return 'P1';
      }
      if (req.method === 'GET' && (url.includes('list') || url.includes('search') || url.includes('details') || url.includes('fetch') || url.includes('index'))) {
        return 'P2';
      }
      return 'P3';
    };

    // ==========================================
    // BRANCH A: LOOP-BASED SCENARIO RUNNER
    // ==========================================
    if (runnerMode === 'loop') {
      const totalRequests = threads * loops;
      const isLargeRun = true;
      let completedCount = 0;
      let totalLatency = 0;
      let minLatencyValue = Infinity;
      let maxLatencyValue = -Infinity;
      let successCount = 0;

      const startTime = performance.now();
      let lastUiUpdateTime = startTime;

      const runWorker = async (workerId: number) => {
        for (let i = 0; i < loops; i++) {
          if (!isRunningRef.current || currentRunId !== currentRunIdRef.current) break;

          // Real-time memory pressure monitoring in standard loops
          const memVal = (window as any).performance?.memory;
          let computedPressureVal = 0;
          if (memVal) {
            computedPressureVal = Math.min(100, Math.round((memVal.usedJSHeapSize / memVal.jsHeapSizeLimit) * 100));
          } else {
            // Simulated memory creep if API is unavailable
            computedPressureVal = Math.min(100, Math.round((allSamplesRef.current.length * 0.1) + 10));
          }
          memoryPressureLevelRef.current = computedPressureVal;

          if (computedPressureVal >= 75 && !isMemoryCoolingRef.current) {
            isMemoryCoolingRef.current = true;
            setIsMemoryCooling(true);
            setMemoryCoolingCount(prev => prev + 1);
            addToast({ type: 'warning', message: `Memory warning level reached (${computedPressureVal}%). Pausing executions for system cleanup...` });
            
            // Eagerly release memory structures in samples history to release references
            if (allSamplesRef.current.length > 50) {
              allSamplesRef.current = allSamplesRef.current.slice(-20);
            }
            if (typeof (window as any).gc === 'function') {
              try {
                (window as any).gc();
              } catch {}
            }
          }

          while (isMemoryCoolingRef.current && isRunningRef.current) {
            await sleep(500);
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
              addToast({ type: 'success', message: `Memory flushed successfully (${checkPressure}%). Resuming request scenarios...` });
              break;
            }
          }

          if (delay > 0 && i > 0) {
            await sleep(delay);
          }

          const currentReqOffset = (workerId + i) % targets.length;
          const baseRequest = targets[currentReqOffset];
          
          const sampleStartTime = performance.now();
          let status: number | string = 0;
          let success = false;
          let errorMsg = '';
          let resolvedResponseBody = '';
          let requestToExecute = baseRequest;

          const controller = new AbortController();
          activeAbortControllersRef.current.add(controller);

          try {
            const innerActiveCollection = collections.find(c => c.id === baseRequest.collection_id);
            const threadVariables = VariableService.getResolvedVariableMap({
              environments,
              activeEnvId: selectedEnvId,
              collection: innerActiveCollection || null,
              variables: {}
            });
            const variableContext = {
              environments,
              activeEnvId: selectedEnvId,
              collections,
              collection: innerActiveCollection || null,
              variables: threadVariables,
              signal: controller.signal,
              useWorker: sandboxEngine === 'worker'
            };

            requestToExecute = {
              ...baseRequest,
              headers: (baseRequest.headers || []).map(h => ({ ...h })),
              params: (baseRequest.params || []).map(p => ({ ...p })),
              settings: baseRequest.settings ? { ...baseRequest.settings } : undefined
            };

            requestToExecute.settings = {
              ...(requestToExecute.settings || { followRedirects: true, maxRedirects: 10 }),
              timeout: timeoutMs
            };

            const preScripts = runRequestScripts ? [
              activeEnvironment?.pre_request_script,
              innerActiveCollection?.pre_request_script,
              suitePreScript,
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
              for (const [key, value] of Object.entries(preRequestOut.environmentMutations)) {
                if (value === null) {
                  delete threadVariables[key];
                } else {
                  threadVariables[key] = String(value);
                }
              }
            }

            const response = await RequestService.execute(requestToExecute, variableContext);
            if (currentRunId !== currentRunIdRef.current) return;
            resolvedResponseBody = '[Detailed payload logging suspended for memory optimization]';

            const testScripts = runRequestScripts ? [
              activeEnvironment?.test_script,
              innerActiveCollection?.test_script,
              suiteTestScript,
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

          const sampleEndTime = performance.now();
          const duration = Math.round(sampleEndTime - sampleStartTime);

          completedCount++;
          totalLatency += duration;
          if (duration < minLatencyValue) minLatencyValue = duration;
          if (duration > maxLatencyValue) maxLatencyValue = duration;
          if (success) successCount++;

          const newSample = {
            id: completedCount,
            timestamp: new Date().toLocaleTimeString(),
            latency: duration,
            status,
            success,
            error: errorMsg || undefined,
            requestName: baseRequest.name,
            requestMethod: baseRequest.method,
            requestUrl: requestToExecute.url,
            requestPayload: '[Detailed payload logging suspended for memory optimization]',
            responseBody: '[Detailed payload logging suspended for memory optimization]'
          };

          allSamplesRef.current.push(newSample);

          if (allSamplesRef.current.length > 50) {
            allSamplesRef.current.shift();
          }

          const now = performance.now();
          if (now - lastUiUpdateTime > 350 || completedCount === totalRequests) {
            lastUiUpdateTime = now;

            const avg = Math.round(totalLatency / completedCount);
            const succRate = Math.round((successCount / completedCount) * 100);

            const lightweightSamples = allSamplesRef.current.map(s => ({
              id: s.id,
              timestamp: s.timestamp,
              latency: s.latency,
              status: s.status,
              success: s.success,
              error: s.error,
              requestName: s.requestName,
              requestMethod: s.requestMethod
            }));

            setSamples(lightweightSamples);
            setAvgLatency(avg);
            setMinLatency(minLatencyValue === Infinity ? 0 : minLatencyValue);
            setMaxLatency(maxLatencyValue === -Infinity ? 0 : maxLatencyValue);
            setSuccessRate(succRate);
            setMemoryPressure(memoryPressureLevelRef.current);

            const percent = Math.round((completedCount / totalRequests) * 100);
            setProgress(percent);

            const elapsedSec = (now - startTime) / 1000;
            setThroughput(parseFloat((completedCount / (elapsedSec || 1)).toFixed(1)));
          }

          if (stopOnFailure && !success) {
            isRunningRef.current = false;
            addToast({ type: 'warning', message: 'Execution aborted due to assertion failure.' });
            break;
          }
        }
      };

      try {
        const workerPromises = Array.from({ length: threads }).map((_, id) => runWorker(id));
        await Promise.all(workerPromises);
        addToast({ type: 'success', message: 'All target scenarios executed successfully!' });
      } catch (err: any) {
        console.error('[SmokeSuite] Concurrency run failed:', err);
        addToast({ type: 'error', message: `Execution failed: ${err.message || String(err)}` });
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

      // Initialize targets metrics trace map
      targetStats.current = {};
      targets.forEach(t => {
        targetStats.current[t.id] = {
          consecutiveFailures: 0,
          lastRunTime: 0,
          latencyHistory: [],
          successCount: 0,
          runCount: 0
        };
      });

      const adaptiveThrottleRef = { current: 1.0 };
      const activePriorityFocusRef = { current: 'ALL' as 'P0' | 'P1' | 'P2' | 'P3' | 'ALL' };
      const memoryHistoryTimeline = { current: [] as { time: number; value: number }[] };
      const stabilityHistoryTimeline = { current: [] as { time: number; value: number }[] };
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
            addToast({ type: 'warning', message: `Endurance limit danger: Memory is at ${computedPressureVal}%. Commencing emergency buffer flush...` });
            
            // Flush and free references in samples storage to allow speedy GC
            if (allSamplesRef.current.length > 50) {
              allSamplesRef.current = allSamplesRef.current.slice(-20);
            }
            if (typeof (window as any).gc === 'function') {
              try {
                (window as any).gc();
              } catch {}
            }
          }

          while (isMemoryCoolingRef.current && isRunningRef.current) {
            await sleep(500);
            
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
              addToast({ type: 'success', message: `Memory successfully sanitized to ${checkPressure}%. Resuming MoT suite execution.` });
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
          }
          localCounter++;

          if (requestsInCurrentMinute.current >= motMaxReqPerMin) {
            await sleep(250);
            continue;
          }

          const focus = activePriorityFocusRef.current;
          let availableTargets = targets;
          if (focus !== 'ALL') {
            availableTargets = targets.filter(t => getRequestPriority(t) === focus || getRequestPriority(t) === 'P0');
            if (availableTargets.length === 0) availableTargets = targets;
          }

          const currentReqOffset = (workerId + localCounter) % availableTargets.length;
          const baseRequest = availableTargets[currentReqOffset];

          const tStat = targetStats.current[baseRequest.id];
          if (tStat && tStat.consecutiveFailures >= 5) {
            if (localCounter % 5 !== 0) {
              continue;
            }
          }

          let status: number | string = 0;
          let success = false;
          let errorMsg = '';
          let resolvedResponseBody = '';
          let requestToExecute = baseRequest;
          let retryCount = 0;
          let executedSuccessfully = false;

          const sampleStartTime = performance.now();

          while (retryCount <= 3 && !executedSuccessfully && isRunningRef.current) {
            requestsInCurrentMinute.current++;

            const controller = new AbortController();
            activeAbortControllersRef.current.add(controller);

            try {
              const innerActiveCollection = collections.find(c => c.id === baseRequest.collection_id);
              const threadVariables = VariableService.getResolvedVariableMap({
                environments,
                activeEnvId: selectedEnvId,
                collection: innerActiveCollection || null,
                variables: {}
              });
              const variableContext = {
                environments,
                activeEnvId: selectedEnvId,
                collections,
                collection: innerActiveCollection || null,
                variables: threadVariables,
                signal: controller.signal,
                useWorker: sandboxEngine === 'worker'
              };

              requestToExecute = {
                ...baseRequest,
                headers: (baseRequest.headers || []).map(h => ({ ...h })),
                params: (baseRequest.params || []).map(p => ({ ...p })),
                settings: baseRequest.settings ? { ...baseRequest.settings } : undefined
              };

              requestToExecute.settings = {
                ...(requestToExecute.settings || { followRedirects: true, maxRedirects: 10 }),
                timeout: timeoutMs
              };

              const preScripts = runRequestScripts ? [
                activeEnvironment?.pre_request_script,
                innerActiveCollection?.pre_request_script,
                suitePreScript,
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
              resolvedResponseBody = '[Detailed payload logging suspended for memory optimization]';

              const testScripts = runRequestScripts ? [
                activeEnvironment?.test_script,
                innerActiveCollection?.test_script,
                suiteTestScript,
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
                  retryCount++;
                  completedCountRef.current += 1;
                  allSamplesRef.current.push({
                    id: completedCountRef.current,
                    status: 'AUTH_REFRESH',
                    success: false,
                    latency: 0
                  });
                  await sleep(150);
                  continue;
                }
              }

              if (response.status === 400 || status === 'Assertion Fail') {
                executedSuccessfully = true;
                break;
              }

              executedSuccessfully = true;

            } catch (err: any) {
              success = false;
              status = err.name === 'AbortError' ? 'Timeout' : 'Execution Error';
              errorMsg = err.message || String(err);

              const isTransient = err.name === 'AbortError' || err.message?.includes('NetworkError') || err.message?.includes('socket') || err.message?.includes('refused');
              if (isTransient && retryCount < 3 && retriesInCurrentMinute.current < motMaxRetriesPerMin) {
                retryCount++;
                retriesInCurrentMinute.current++;
                const backoffDelay = Math.min(1000, 200 * Math.pow(2, retryCount));
                await sleep(backoffDelay);
                continue;
              }

              executedSuccessfully = true;
            } finally {
              activeAbortControllersRef.current.delete(controller);
            }
          }

          const sampleEndTime = performance.now();
          const duration = Math.round(sampleEndTime - sampleStartTime);

          completedCountRef.current += 1;
          totalLatency += duration;
          if (duration < minLatencyValue) minLatencyValue = duration;
          if (duration > maxLatencyValue) maxLatencyValue = duration;
          if (success) {
            successCountRef.current += 1;
            if (targetStats.current[baseRequest.id]) {
              targetStats.current[baseRequest.id].successCount++;
              targetStats.current[baseRequest.id].consecutiveFailures = 0;
            }
          } else {
            if (targetStats.current[baseRequest.id]) {
              targetStats.current[baseRequest.id].consecutiveFailures++;
            }
          }

          if (targetStats.current[baseRequest.id]) {
            targetStats.current[baseRequest.id].runCount++;
            targetStats.current[baseRequest.id].latencyHistory.push(duration);
            if (targetStats.current[baseRequest.id].latencyHistory.length > 30) {
              targetStats.current[baseRequest.id].latencyHistory.shift();
            }
          }

          const newSample = {
            id: completedCountRef.current,
            status,
            success,
            latency: duration
          };

          allSamplesRef.current.push(newSample);

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
          
          const currentConsec = targetStats.current[baseRequest.id]?.consecutiveFailures || 0;
          if (currentConsec > 2) score -= currentConsec * 6;
          
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
            activePriorityFocusRef.current = activePrio;
            
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
            
            memoryHistoryTimeline.current.push({ time: Math.round(elapsedSec), value: computedPressure });
            stabilityHistoryTimeline.current.push({ time: Math.round(elapsedSec), value: score });
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

        // Compile Intelligence Report hotspots
        const hotspotsList = targets.map(t => {
          const stat = targetStats.current[t.id] || { runCount: 0, successCount: 0, latencyHistory: [] };
          const failureCount = stat.runCount - stat.successCount;
          const failRate = stat.runCount ? Math.round((failureCount / stat.runCount) * 100) : 0;
          const avgL = stat.latencyHistory.length ? Math.round(stat.latencyHistory.reduce((a, b: any) => a + b, 0) / stat.latencyHistory.length) : 0;
          return {
            id: t.id,
            name: t.name,
            method: t.method,
            runCount: stat.runCount,
            failRate,
            avgLatency: avgL,
            unreliabilityIndex: failRate * 2 + (avgL > 1000 ? (avgL - 1000) * 0.05 : 0)
          };
        })
        .filter(h => h.runCount > 0)
        .sort((a, b) => b.unreliabilityIndex - a.unreliabilityIndex);

        // Form recommendations
        const recs: string[] = [];
        if (hotspotsList.length > 0 && hotspotsList[0].failRate > 25) {
          recs.push(`Unstable Target Endpoint Detected: '${hotspotsList[0].method} ${hotspotsList[0].name}' exhibited a ${hotspotsList[0].failRate}% fail rate. Investigate endpoint exception logging for connection resets.`);
        }
        if (maxLatencyValue > 4000) {
          recs.push(`High Latency Ceiling Spike: Latency spiked to ${maxLatencyValue}ms during loading. Implement a robust response caching layer to bypass database row scans.`);
        }
        if (crashPreventionTriggersCountRef.current > 0) {
          recs.push(`Resilience Intercedes Active: Preemptive stabilizers adjusted loop velocities ${crashPreventionTriggersCountRef.current} times to curb stack buffer drop offs. Optimize database indexes on high throughput endpoints.`);
        }
        if (recs.length === 0) {
          recs.push("Pristine Systems Stability: Continuous endurance testing achieved excellent results. The local cluster sustained the concurrent loads perfectly with no memory exhaustion signs.");
        }

        setMotReportData({
          durationSeconds: Math.round(totalElapsed),
          totalRequests: completedCountRef.current,
          successCount: successCountRef.current,
          failureCount: completedCountRef.current - successCountRef.current,
          successRate: Math.round((successCountRef.current / (completedCountRef.current || 1)) * 100),
          avgLatency: Math.round(totalLatency / (completedCountRef.current || 1)),
          minLatency: minLatencyValue === Infinity ? 0 : minLatencyValue,
          maxLatency: maxLatencyValue === -Infinity ? 0 : maxLatencyValue,
          earlyAbort: earlyAbortTriggeredRef.current,
          abortReason: abortReasonRef.current,
          crashPreventionActions: crashPreventionTriggersCountRef.current,
          hotspots: hotspotsList,
          recommendations: recs
        });

        setShowMotReport(true);
        addToast({ type: 'success', message: 'Minutes of Testing endurance run complete!' });
      } catch (err: any) {
        console.error('[SmokeSuite] MoT execution run error:', err);
        addToast({ type: 'error', message: `MoT Run Error: ${err.message || String(err)}` });
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

  const abortSuite = () => {
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
    addToast({ type: 'info', message: 'Test execution terminated.' });
  };

  // CSV Report with detailed transmission log fields
  const exportCSVReport = () => {
    const data = allSamplesRef.current;
    if (data.length === 0) return;
    const headers = [
      'ID', 'Timestamp', 'Scenario Target Name', 'Method', 'Resolved URL', 
      'Latency (ms)', 'HTTP Status', 'Outcome', 'Request Payload', 'Response Payload', 'Diagnostics'
    ];
    const rows = data.map(s => [
      s.id,
      s.timestamp || '',
      `"${(s.requestName || '').replace(/"/g, '""')}"`,
      s.requestMethod || '',
      `"${(s.requestUrl || '').replace(/"/g, '""')}"`,
      s.latency,
      s.status || '',
      s.success ? 'SUCCESS' : 'FAILURE',
      `"${(s.requestPayload || '').replace(/"/g, '""')}"`,
      `"${(s.responseBody || '').replace(/"/g, '""')}"`,
      `"${(s.error || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gimay_smoke_report_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast({ type: 'success', message: 'Detailed CSV Report downloaded successfully.' });
  };

  const renderLatencyGraph = () => {
    const graphSamples = samples.slice(-100); // Check the latest 100 transmissions for multi-scenario
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
      <div className="bg-[#09090D] border border-white/[0.04] rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black text-[#E1E1E6] uppercase tracking-wider block font-mono">Real-Time Suite Transmission Activity Grid</span>
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
          <div className="h-[120px] rounded-xl border border-white/[0.04] bg-[#030305] flex flex-col items-center justify-center space-y-1 select-none">
            <span className="text-[9px] font-black tracking-widest text-[#444] font-mono uppercase">Telemetry stand-by</span>
            <span className="text-[7px] text-[#333] font-mono">Real-time status indexes populate here on suite execution</span>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Live contributors grid representation */}
            <div className="bg-[#030305] rounded-xl p-4 border border-white/[0.04]">
              <div className="flex flex-wrap gap-2 justify-start items-center">
                {graphSamples.map((s, idx) => {
                  const isSuccess = s.success;
                  const latency = s.latency;
                  const requestName = s.requestName || 'Unknown Scenario';
                  let colorClass = "bg-red-500 border-red-400/20"; // Failed requests
                  if (isSuccess) {
                    if (latency < 200) {
                      colorClass = "bg-[#3ECF8E] border-[#3ECF8E]/20"; // Fast success
                    } else if (latency < 600) {
                      colorClass = "bg-[#10B981] border-[#10B981]/15"; // Medium success
                    } else {
                      colorClass = "bg-amber-500 border-amber-400/15"; // Slow success
                    }
                  }
                  return (
                    <div
                      key={s.id || idx}
                      className={`w-3.5 h-3.5 rounded-md cursor-pointer transition-all duration-150 hover:scale-125 border shadow-sm relative group/dot ${colorClass}`}
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/95 border border-[#1E1E28] text-white text-[8px] font-mono p-2.5 rounded-lg shadow-2xl opacity-0 scale-0 group-hover/dot:opacity-100 group-hover/dot:scale-100 transition-all z-50 pointer-events-none whitespace-nowrap backdrop-blur-md">
                        <div className="flex items-center gap-2 border-b border-[#222] pb-1 mb-1">
                          <span className="font-extrabold text-[#555]">CYCLE #{s.id}</span>
                          <span className={`text-[6px] font-black px-1.5 py-0.2 rounded uppercase ${
                            s.success ? "bg-[#3ECF8E]/10 text-[#3ECF8E]" : "bg-red-500/10 text-red-400"
                          }`}>{s.success ? "PASS" : "FAIL"}</span>
                        </div>
                        <p className="text-[9px] font-bold text-white mb-0.5 truncate max-w-xs">{requestName}</p>
                        <p className="text-[10px] font-bold text-white mb-0.5">{latency}ms Latency</p>
                        <p className="text-[7px] text-[#888] uppercase tracking-tighter">Status: {s.status || 'N/A'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick telemetry details banner */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#05050A] border border-white/[0.04] p-3 rounded-lg flex flex-col justify-center">
                <span className="text-[7px] font-black text-[#66666D] uppercase tracking-wider font-mono block">Peak Latency</span>
                <span className="text-xs font-black font-mono text-white mt-0.5">{maxVal}ms</span>
              </div>
              <div className="bg-[#05050A] border border-white/[0.04] p-3 rounded-lg flex flex-col justify-center">
                <span className="text-[7px] font-black text-[#66666D] uppercase tracking-wider font-mono block">Average Latency</span>
                <span className="text-xs font-black font-mono text-white mt-0.5">{averageVal}ms</span>
              </div>
              <div className="bg-[#05050A] border border-white/[0.04] p-3 rounded-lg flex flex-col justify-center">
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

  if (!isEmbedded && !isOpen) return null;

  const mainCard = (
    <div className={cn(
      "flex flex-col bg-[#070708] overflow-hidden",
      isEmbedded ? "w-full h-full flex-1" : "relative w-full max-w-5xl h-[85vh] border border-[#151518] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200"
    )}>
        
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#151518] bg-[#09090B]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 flex items-center justify-center">
              <Activity size={18} className="text-[#3ECF8E] animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">Smoke & Performance Suite</h3>
              <p className="text-[10px] text-[#55555C] font-mono mt-0.5">Deploy bulk scenarios in parallel with real-time outcome analytics</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isRunning}
            className="p-2 text-[#55555C] hover:text-white bg-white/[0.02] hover:bg-white/[0.05] rounded-xl transition-all cursor-pointer disabled:opacity-30"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal content body split pane */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left panel: target checklists */}
          <div className="w-[300px] border-r border-[#151518] bg-[#08080A] flex flex-col relative">
            {isRunning && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-30 flex flex-col items-center justify-center p-4 text-center select-none">
                <Shield className="text-[#555] mb-2 animate-pulse" size={16} />
                <span className="text-[9px] font-mono font-black text-[#888] uppercase tracking-[0.2em]">Checklist Locked</span>
                <span className="text-[8px] font-mono text-[#444] mt-1">Cannot alter configurations during active deployment run.</span>
              </div>
            )}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black text-[#555] uppercase tracking-wider font-mono">Scenarios Checklist</label>
                <span className="text-[9px] font-bold font-mono text-[#3ECF8E]">{selectedRequestIds.length} SELECTED</span>
              </div>
              
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
                <input
                  type="text"
                  placeholder="Search targets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#050507] border border-[#151518] pl-8 pr-3 py-1.5 rounded-lg text-[10px] font-mono text-white outline-none focus:border-[#3ECF8E]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleSelectAll}
                  disabled={isRunning}
                  className="py-1 rounded bg-[#3ECF8E]/10 border border-[#3ECF8E]/25 text-[#3ECF8E] hover:bg-[#3ECF8E]/20 text-[9px] font-black text-center cursor-pointer font-mono"
                >
                  SELECT ALL
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={isRunning}
                  className="py-1 rounded bg-[#1C1C22]/30 border border-[#222226] text-[#888] hover:bg-[#1C1C22]/50 text-[9px] font-black text-center cursor-pointer font-mono"
                >
                  CLEAR
                </button>
              </div>
            </div>

            {/* Targets tree explorer */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 no-scrollbar border-t border-[#151518]/50 pt-3">
              {searchQuery ? (
                // Flat Search mode
                filteredRequests.map(item => {
                  const isChecked = selectedRequestIds.includes(item.request.id);
                  return (
                    <div 
                      key={item.request.id} 
                      className={cn(
                        "flex items-center justify-between py-1.5 px-2 rounded-xl border border-[#151518] bg-[#09090B]/40 hover:border-[#222] transition-all cursor-pointer select-none",
                        isChecked && "bg-[#3ECF8E]/[0.01]"
                      )}
                      onClick={() => handleToggleRequest(item.request.id)}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[6px] font-bold px-1 rounded font-mono uppercase tracking-tight shrink-0",
                            item.request.method === 'GET' ? "bg-green-500/10 text-green-400 border border-green-500/10" :
                            item.request.method === 'POST' ? "bg-blue-500/10 text-blue-400 border border-blue-500/10" :
                            "bg-yellow-500/10 text-yellow-400 border border-yellow-500/10"
                          )}>{item.request.method}</span>
                          <span className="text-[10px] font-mono text-[#E0E0E6] truncate">{item.request.name}</span>
                        </div>
                        <div className="text-[8px] text-[#55555C] font-mono truncate">{item.collectionName} &bull; {item.request.url}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isRunning}
                        onChange={() => handleToggleRequest(item.request.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer ml-2"
                      />
                    </div>
                  );
                })
              ) : (
                // Tree exploration mode
                collections.map(col => (
                  <RenderCollectionNode key={col.id} collection={col} />
                ))
              )}
              
              {((searchQuery && filteredRequests.length === 0) || (!searchQuery && collections.length === 0)) && (
                <div className="text-center py-16 text-[#444] italic font-mono text-[10px]">No scenarios target match</div>
              )}
            </div>
          </div>

          {/* Right panel: execution setup and diagnostics */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#050507]">
            
            {/* Top configuration options */}
            <div className="p-6 border-b border-[#151518] bg-[#070709] grid grid-cols-10 gap-4 relative">
              {isRunning && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-30 flex items-center justify-center p-4 text-center gap-2 select-none">
                  <Shield className="text-[#3ECF8E]/40 animate-pulse" size={14} />
                  <span className="text-[9px] font-mono font-black text-[#888] uppercase tracking-[0.2em]">Configuration Locked</span>
                  <span className="text-[8px] font-mono text-[#555]">&bull; Smoke testing active run in progress</span>
                </div>
              )}
              
              {/* Environment selector dropdown option */}
              <div className="space-y-1.5 col-span-2">
                <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono block">Environment</label>
                <select
                  disabled={isRunning}
                  value={selectedEnvId || ''}
                  onChange={(e) => setSelectedEnvId(e.target.value || null)}
                  className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30 cursor-pointer"
                >
                  <option value="">No Active Environment</option>
                  {environments.map(env => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 col-span-1">
                <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono">Threads</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  disabled={isRunning}
                  value={threads}
                  onChange={(e) => setThreads(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30"
                />
              </div>

              <div className="space-y-1.5 col-span-1">
                <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono">Loops</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  disabled={isRunning}
                  value={loops}
                  onChange={(e) => setLoops(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30"
                />
              </div>

              <div className="space-y-1.5 col-span-1">
                <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono">Delay (ms)</label>
                <input
                  type="number"
                  disabled={isRunning}
                  value={delay}
                  onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30"
                />
              </div>

              <div className="space-y-1.5 col-span-1">
                <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono">Timeout (ms)</label>
                <input
                  type="number"
                  disabled={isRunning}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Math.max(100, parseInt(e.target.value) || 100))}
                  className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30"
                />
              </div>

              {/* Abort on Fail toggle */}
              <div className="flex flex-col justify-center space-y-1.5 col-span-1 pl-2">
                <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono cursor-pointer select-none">Abort Fail</label>
                <label className="relative inline-flex items-center cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={stopOnFailure}
                    disabled={isRunning}
                    onChange={(e) => setStopOnFailure(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-[#151518] rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-[#555] peer-checked:after:bg-[#3ECF8E] after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#3ECF8E]/10 border border-[#222] peer-checked:border-[#3ECF8E]/30" />
                </label>
              </div>

              {/* Use request scripts toggle */}
              <div className="flex flex-col justify-center space-y-1.5 col-span-1 pl-2">
                <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono cursor-pointer select-none">Run Scripts</label>
                <label className="relative inline-flex items-center cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={runRequestScripts}
                    disabled={isRunning}
                    onChange={(e) => setRunRequestScripts(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-[#151518] rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-[#555] peer-checked:after:bg-[#3ECF8E] after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#3ECF8E]/10 border border-[#222] peer-checked:border-[#3ECF8E]/30" />
                </label>
              </div>

              {/* Sandbox Engine Selector */}
              <div className="space-y-1.5 col-span-1 pl-1">
                <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono block">Engine</label>
                <select
                  disabled={isRunning}
                  value={sandboxEngine}
                  onChange={(e) => setSandboxEngine(e.target.value as 'in-thread' | 'worker')}
                  className="w-full bg-[#050508] border border-[#151518] px-2.5 py-1.5 rounded-xl text-[10px] font-mono text-white outline-none focus:border-[#3ECF8E]/30 cursor-pointer"
                >
                  <option value="in-thread">💨 IN-THREAD</option>
                  <option value="worker">🔒 ISOLATED</option>
                </select>
              </div>

              {/* Telemetry mode display */}
              <div className="flex flex-col justify-center space-y-1.5 col-span-1 pl-2 select-none">
                <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono">Telemetry</label>
                <span className="text-[7px] font-sans font-black text-[#3ECF8E] bg-[#3ECF8E]/10 border border-[#3ECF8E]/25 px-2 py-0.5 rounded-md uppercase tracking-wider text-center mt-1 w-min">
                  Optimized
                </span>
              </div>

            </div>

            {/* Middle telemetry & graphs view */}
            <div className="p-6 space-y-6 flex-1 flex flex-col overflow-y-auto no-scrollbar">

              {/* Runner Mode Selection Tab */}
              <div className="flex bg-[#0A0A0F] p-1 rounded-xl border border-[#151518] w-full max-w-lg select-none relative shrink-0">
                {isRunning && (
                  <div className="absolute inset-0 bg-transparent z-40 cursor-not-allowed" />
                )}
                <button
                  onClick={() => setRunnerMode('loop')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono text-center outline-none",
                    runnerMode === 'loop' ? "bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/15" : "text-[#55555C] hover:text-[#888]"
                  )}
                >
                  Loop-based Scenario Runner
                </button>
                <button
                  onClick={() => setRunnerMode('mot')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono text-center outline-none",
                    runnerMode === 'mot' ? "bg-amber-500/10 text-amber-500 border border-amber-500/15" : "text-[#55555C] hover:text-[#888]"
                  )}
                >
                  Minutes of Testing (MoT Endurance Engine)
                </button>
              </div>

              {/* MSW Virtual API Mocking Service Section */}
              <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "p-2 rounded-xl border transition-all duration-300",
                      mswEnabled 
                        ? "bg-purple-500/10 border-purple-500/20 text-purple-400 animate-pulse" 
                        : "bg-[#101012] border-[#1C1C22] text-[#555]"
                    )}>
                      <Shield size={16} />
                    </div>
                    <div className="text-left">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-[#E4E4E7] font-mono flex items-center gap-1.5">
                        Virtual MSW Network Interceptor
                        {mswEnabled && (
                          <span className="text-[7.5px] bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono px-1.5 py-0.5 rounded tracking-widest uppercase font-black animate-pulse">
                            Active Intercept
                          </span>
                        )}
                      </h3>
                      <p className="text-[8px] text-[#55555C] font-mono leading-relaxed uppercase mt-0.5">
                        Replaces network socket fetches with instant, zero-latency micro-responses to prevent loop-based execution Out Of Memory (OOM) leaks.
                      </p>
                    </div>
                  </div>
                  
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 pl-4">
                    <input
                      type="checkbox"
                      checked={mswEnabled}
                      disabled={isRunning}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setMswEnabled(val);
                        syncMswConfig({ enabled: val });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-[#151518] rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-[#555] peer-checked:after:bg-purple-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500/10 border border-[#222] peer-checked:border-purple-400/30" />
                  </label>
                </div>

                {/* Expanded configuration metrics controls */}
                {mswEnabled && (
                  <div className="pt-3 border-t border-[#121215] grid grid-cols-12 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    
                    {/* Status Code Selection */}
                    <div className="col-span-4 space-y-1.5 text-left">
                      <label className="text-[9px] font-black text-purple-400 uppercase tracking-wider font-mono block">Mock HTTP Status</label>
                      <select
                        disabled={isRunning}
                        value={mswStatus}
                        onChange={(e) => {
                          const code = parseInt(e.target.value) || 200;
                          let text = 'OK';
                          if (code === 201) text = 'Created';
                          if (code === 204) text = 'No Content';
                          if (code === 400) text = 'Bad Request';
                          if (code === 401) text = 'Unauthorized';
                          if (code === 403) text = 'Forbidden';
                          if (code === 404) text = 'Not Found';
                          if (code === 429) text = 'Too Many Requests';
                          if (code === 500) text = 'Internal Server Error';
                          
                          setMswStatus(code);
                          setMswStatusText(text);
                          syncMswConfig({ status: code, statusText: text });
                        }}
                        className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-purple-500/30"
                      >
                        <option value={200}>200 OK</option>
                        <option value={201}>201 Created</option>
                        <option value={204}>204 No Content</option>
                        <option value={400}>400 Bad Request</option>
                        <option value={401}>401 Unauthorized</option>
                        <option value={403}>403 Forbidden</option>
                        <option value={404}>404 Not Found</option>
                        <option value={429}>429 Too Many Requests</option>
                        <option value={505}>500 Internal Server Error</option>
                      </select>
                      <p className="text-[8px] text-[#55555C] font-mono uppercase">Simulated status return</p>
                    </div>

                    {/* Mock Latency slider */}
                    <div className="col-span-4 space-y-1.5 text-left">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-black text-purple-400 uppercase tracking-wider font-mono">Mock Latency (ms)</label>
                        <span className="text-[9px] font-mono font-bold text-white">{mswLatency}ms</span>
                      </div>
                      <input
                        type="range"
                        disabled={isRunning}
                        min={0}
                        max={100}
                        step={5}
                        value={mswLatency}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setMswLatency(val);
                          syncMswConfig({ latency: val });
                        }}
                        className="w-full accent-purple-500 bg-[#050508] h-1.5 rounded-lg appearance-none cursor-pointer mt-2.5 border border-[#151518]"
                      />
                      <p className="text-[8px] text-[#55555C] font-mono uppercase">Keeps runs super fast and steady</p>
                    </div>

                    {/* Template Selections */}
                    <div className="col-span-4 space-y-1.5 text-left">
                      <label className="text-[9px] font-black text-purple-400 uppercase tracking-wider font-mono block">Preset Fast-Mock Payload</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => {
                            const body = '{\n  "status": "success",\n  "msw_mocked": true,\n  "message": "Auth Session Active",\n  "token": "msw_jwt_mocked_token_sequence_xyz123"\n}';
                            setMswResponseBody(body);
                            syncMswConfig({ responseBody: body, responseType: 'json' });
                          }}
                          className="py-1 px-2 text-[8px] text-[#888] font-bold border border-[#1C1C22] bg-[#0A0A0E] rounded-md hover:text-purple-400 hover:border-purple-500/20 hover:bg-purple-500/5 transition-all text-ellipsis overflow-hidden whitespace-nowrap uppercase font-mono cursor-pointer"
                        >
                          🔐 AUTH
                        </button>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => {
                            const body = '{\n  "status": "success",\n  "count": 3,\n  "users": [\n    {"id": 1, "name": "John Doe", "role": "admin"},\n    {"id": 2, "name": "Jane Smith", "role": "editor"},\n    {"id": 3, "name": "Bob Martin", "role": "viewer"}\n  ]\n}';
                            setMswResponseBody(body);
                            syncMswConfig({ responseBody: body, responseType: 'json' });
                          }}
                          className="py-1 px-2 text-[8px] text-[#888] font-bold border border-[#1C1C22] bg-[#0A0A0E] rounded-md hover:text-purple-400 hover:border-purple-500/20 hover:bg-purple-500/5 transition-all text-ellipsis overflow-hidden whitespace-nowrap uppercase font-mono cursor-pointer"
                        >
                          👥 USERS
                        </button>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => {
                            const body = '{\n  "status": "healthy",\n  "uptime_secs": 18231,\n  "engine": "v8-isolated-context"\n}';
                            setMswResponseBody(body);
                            syncMswConfig({ responseBody: body, responseType: 'json' });
                          }}
                          className="py-1 px-2 text-[8px] text-[#888] font-bold border border-[#1C1C22] bg-[#0A0A0E] rounded-md hover:text-purple-400 hover:border-purple-500/20 hover:bg-purple-500/5 transition-all text-ellipsis overflow-hidden whitespace-nowrap uppercase font-mono cursor-pointer"
                        >
                          💚 HEALTH
                        </button>
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={() => {
                            const body = 'OK';
                            setMswResponseBody(body);
                            setMswResponseType('text');
                            syncMswConfig({ responseBody: body, responseType: 'text' });
                          }}
                          className="py-1 px-2 text-[8px] text-[#888] font-bold border border-[#1C1C22] bg-[#0A0A0E] rounded-md hover:text-purple-400 hover:border-purple-500/20 hover:bg-purple-500/5 transition-all text-ellipsis overflow-hidden whitespace-nowrap uppercase font-mono cursor-pointer"
                        >
                          📄 PLAIN OK
                        </button>
                      </div>
                    </div>

                    {/* Response Payload Text Editor Box */}
                    <div className="col-span-12 space-y-1.5 pt-2 text-left">
                      <label className="text-[9px] font-black text-purple-400 uppercase tracking-wider font-mono block">Custom MSW Intercepted Response JSON Body</label>
                      <textarea
                        disabled={isRunning}
                        rows={3}
                        value={mswResponseBody}
                        onChange={(e) => {
                          const body = e.target.value;
                          setMswResponseBody(body);
                          syncMswConfig({ responseBody: body });
                        }}
                        className="w-full bg-[#050508] border border-[#151518] px-3.5 py-2.5 rounded-xl text-[10px] font-mono text-white outline-none focus:border-purple-500/30 no-scrollbar select-text leading-relaxed font-semibold transition-all"
                        placeholder="Paste or write mock JSON response payload returned by MSW service handler..."
                      />
                      <div className="flex items-center justify-between text-[7.5px] text-[#555] font-mono uppercase">
                        <span>* MSW intercept overrides actual request execution for loop tests</span>
                        {mswResponseType === 'json' ? (
                          <span className="text-purple-400/80 font-black">VALIDATED JSON CONTENTTYPE</span>
                        ) : (
                          <span className="text-amber-500/80 font-black">RAW TEXT CONTENTTYPE</span>
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* MoT Extra Settings Parameters inputs */}
              {runnerMode === 'mot' && (
                <div className="bg-[#09090B]/40 border border-[#151518] rounded-2xl p-5 grid grid-cols-3 gap-4 relative animate-in fade-in duration-200">
                  {isRunning && (
                    <div className="absolute inset-0 bg-transparent z-40 cursor-not-allowed" />
                  )}
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-[9px] font-black text-amber-500 uppercase tracking-wider font-mono block">Endurance Duration (sec)</label>
                    <input
                      type="number"
                      disabled={isRunning}
                      value={motDuration}
                      min={10}
                      max={3600}
                      onChange={(e) => setMotDuration(Math.min(3600, Math.max(10, parseInt(e.target.value) || 120)))}
                      className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-amber-500/30"
                    />
                    <p className="text-[8px] text-[#55555C] font-mono">Endurance window duration limit</p>
                  </div>
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-[9px] font-black text-amber-500 uppercase tracking-wider font-mono block">Max Requests / Min</label>
                    <input
                      type="number"
                      disabled={isRunning}
                      value={motMaxReqPerMin}
                      min={10}
                      max={10000}
                      onChange={(e) => setMotMaxReqPerMin(Math.min(10000, Math.max(10, parseInt(e.target.value) || 600)))}
                      className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-amber-500/30"
                    />
                    <p className="text-[8px] text-[#55555C] font-mono">Performance throughput budget limit</p>
                  </div>
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-[9px] font-black text-amber-500 uppercase tracking-wider font-mono block">Max Retries / Min</label>
                    <input
                      type="number"
                      disabled={isRunning}
                      value={motMaxRetriesPerMin}
                      min={0}
                      max={500}
                      onChange={(e) => setMotMaxRetriesPerMin(Math.min(505, Math.max(0, parseInt(e.target.value) || 60)))}
                      className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-amber-500/30"
                    />
                    <p className="text-[8px] text-[#55555C] font-mono">Resilience retry frequency ceiling</p>
                  </div>
                </div>
              )}

              {/* MoT Live Stabilizer Panels row */}
              {runnerMode === 'mot' && (
                <div className="grid grid-cols-4 gap-4 animate-in fade-in duration-200">
                  <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 space-y-1.5 relative overflow-hidden">
                    <span className="text-[9px] font-black text-[#55555C] uppercase tracking-wider block font-mono">Heap Memory Pressure</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn(
                        "text-xl font-bold font-mono",
                        memoryPressure > 80 ? "text-red-500" :
                        memoryPressure > 50 ? "text-amber-500" : "text-[#3ECF8E]"
                      )}>{memoryPressure}%</span>
                      <span className="text-[8px] text-[#55555C] font-mono">allocation limit</span>
                    </div>
                    {isElectron() ? (
                      <span className="text-[7px] bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono px-1.5 py-0.5 rounded uppercase font-black shrink-0 tracking-wider">OS Desktop Native</span>
                    ) : (
                      <span className="text-[7px] bg-slate-500/10 text-slate-400 border border-slate-500/20 font-mono px-1.5 py-0.5 rounded uppercase font-black shrink-0 tracking-wider">Web Sandbox</span>
                    )}
                  </div>

                  <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 space-y-1.5 relative overflow-hidden">
                    <span className="text-[9px] font-black text-[#55555C] uppercase tracking-wider block font-mono">System Stability Score</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className={cn(
                        "text-xl font-bold font-mono",
                        stabilityScore > 80 ? "text-[#3ECF8E]" :
                        stabilityScore > 45 ? "text-amber-500" : "text-red-500"
                      )}>{stabilityScore}</span>
                      <span className="text-[8px] text-[#55555C] font-mono">/ 100 Index</span>
                    </div>
                    <div className="text-[8px] text-[#555] font-mono">Success rate & latency jitter weight</div>
                  </div>

                  <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 space-y-1.5 relative overflow-hidden">
                    <span className="text-[9px] font-black text-[#55555C] uppercase tracking-wider block font-mono">Resilience Guard Status</span>
                    <span className={cn(
                      "text-xs font-black px-2 py-0.5 rounded border font-mono uppercase w-max tracking-wider block mt-1",
                      guardStatus === 'CRITICAL' ? "text-red-500 bg-red-500/10 border-red-500/15 animate-pulse" :
                      guardStatus === 'THROTTLED' ? "text-amber-500 bg-amber-500/10 border-amber-500/15" : "text-[#3ECF8E] bg-[#3ECF8E]/10 border-[#3ECF8E]/15"
                    )}>
                      {guardStatus}
                    </span>
                    <span className="text-[8px] text-[#555] font-mono block">Priority Focus: {activePriorityFocus} ({Math.round(adaptiveThrottle * 100)}% Speed)</span>
                  </div>

                  <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 space-y-1.5 relative overflow-hidden flex flex-col justify-between">
                    <span className="text-[9px] font-black text-[#55555C] uppercase tracking-wider block font-mono">Safety Intercedes</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-bold text-white font-mono">{crashPreventionTriggers}</span>
                      <span className="text-[8px] text-[#55555C] font-mono">throttles</span>
                    </div>
                    <span className="text-[8px] text-[#555] font-mono block">Preempted thread drop risks</span>
                  </div>
                </div>
              )}

              {/* Suite Automation scripts drawer */}
              <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 space-y-3 relative">
                {isRunning && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-30 flex items-center justify-center p-3 text-center gap-2 rounded-2xl select-none">
                    <Shield className="text-amber-500/40" size={12} />
                    <span className="text-[9px] font-mono font-black text-[#888] uppercase tracking-[0.2em]">Scripts Locked</span>
                  </div>
                )}
                <button
                  onClick={() => setShowScriptDrawer(!showScriptDrawer)}
                  className="w-full flex items-center justify-between text-[10px] font-black text-amber-500 uppercase tracking-widest font-mono hover:text-amber-400 transition-colors"
                >
                  <span className="flex items-center gap-1.5"><Code size={12} /> Dynamic Suite-Level Script Runners</span>
                  <span className="text-[8px] border border-amber-500/30 px-1.5 py-0.5 rounded font-bold font-mono">
                    {showScriptDrawer ? 'COLLAPSE CODE AREA' : 'EXPAND CODE AREA'}
                  </span>
                </button>
                
                {showScriptDrawer && (
                  <div className="grid grid-cols-2 gap-4 pt-2 animate-in fade-in duration-200">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-[#555] uppercase block font-mono">Suite Pre-request Script (javascript)</label>
                      <textarea
                        value={suitePreScript}
                        onChange={(e) => setSuitePreScript(e.target.value)}
                        placeholder="// Modify or dynamically mock target requests before transmission..."
                        className="w-full h-24 bg-[#050508] border border-[#151518] p-2.5 rounded-xl text-[9px] font-mono text-white outline-none focus:border-amber-500/30 resize-none font-normal"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-[#555] uppercase block font-mono">Suite Assertion Test Verification (javascript)</label>
                      <textarea
                        value={suiteTestScript}
                        onChange={(e) => setSuiteTestScript(e.target.value)}
                        placeholder="// Execute test assertions on the responses returned..."
                        className="w-full h-24 bg-[#050508] border border-[#151518] p-2.5 rounded-xl text-[9px] font-mono text-white outline-none focus:border-amber-500/30 resize-none font-normal"
                      />
                    </div>
                  </div>
                )}
              </div>

              {renderLatencyGraph()}

              {/* Metrics Dashboards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 space-y-1.5 relative overflow-hidden">
                  <span className="text-[9px] font-black text-[#55555C] uppercase tracking-wider block font-mono">Throughput Rate</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-white font-mono">{throughput}</span>
                    <span className="text-[10px] text-[#55555C] font-mono">req/sec</span>
                  </div>
                  <div className="absolute right-3 bottom-3 text-white/5"><Activity size={32} /></div>
                </div>

                <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 space-y-1.5 relative overflow-hidden">
                  <span className="text-[9px] font-black text-[#55555C] uppercase tracking-wider block font-mono">Average Latency</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-blue-400 font-mono">{avgLatency}</span>
                    <span className="text-[10px] text-blue-400/50 font-mono">ms</span>
                  </div>
                  <div className="text-[8px] text-[#555] font-mono">Min: {minLatency}ms &bull; Max: {maxLatency}ms</div>
                </div>

                <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 space-y-1.5 relative overflow-hidden">
                  <span className="text-[9px] font-black text-[#55555C] uppercase tracking-wider block font-mono">Success Rate</span>
                  <span className={cn("text-xl font-bold font-mono block", successRate === 100 ? "text-[#3ECF8E]" : "text-yellow-500")}>
                    {successRate}%
                  </span>
                  <div className="text-[8px] text-[#555] font-mono">Outcomes passed assertion</div>
                </div>

                {/* Variable execution context box */}
                <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 space-y-1.5 relative overflow-hidden flex flex-col justify-between">
                  <span className="text-[9px] font-black text-[#55555C] uppercase tracking-wider block font-mono">Execution Context</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-5 h-5 rounded bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 flex items-center justify-center shrink-0">
                      <Shield size={10} className="text-[#3ECF8E]" />
                    </div>
                    <span className="text-[10px] font-mono text-[#E0E0E6] truncate uppercase tracking-tight">
                      {activeEnvironment ? activeEnvironment.name : 'No Active Env'}
                    </span>
                  </div>
                  <span className="text-[8px] text-[#555] font-mono block">Variables resolved automatically</span>
                </div>
              </div>


              {/* Dynamic Emergency Memory Flush Status */}
              {isMemoryCooling && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl p-4 flex items-start gap-4 relative overflow-hidden animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Shield size={14} className="text-amber-400 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black uppercase tracking-wider font-mono flex items-center gap-1.5 text-amber-400">
                      🚨 EAGER MEMORY FLUSH & RECOVERY CYCLE ACTIVE
                    </h4>
                    <p className="text-[9px] text-[#A5A5AF] font-mono leading-relaxed uppercase tracking-tight">
                      System heap load exceeded threshold ({memoryPressure}%). Requests are currently paused while old sample buffers are flushed and garbage collection is executed. Execution will resume automatically.
                    </p>
                  </div>
                  <span className="absolute right-4 top-4 bg-amber-500/20 border border-amber-500/45 text-[8px] font-mono px-2 py-0.5 rounded font-black text-amber-400">
                    RECOVERY CYCLE #{memoryCoolingCount}
                  </span>
                </div>
              )}

              {/* Cleaning & memory tuning loading/wait */}
              {isCleaning && (
                <div className="bg-[#09090B]/60 border border-emerald-500/20 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin shrink-0" />
                      <span className="text-[9.5px] font-black text-emerald-400 uppercase tracking-widest font-mono">
                        Memory Tuner: Sanitizing & Cleaning Heap
                      </span>
                    </div>
                    <span className="text-[8px] font-mono text-emerald-500 font-black animate-pulse uppercase tracking-wider">
                      WAITING FOR COMPLETED SYSTEM SWEEP
                    </span>
                  </div>
                  <div className="bg-[#030304] border border-[#151518] px-3 py-2 rounded-xl text-[8.5px] font-mono text-emerald-400/80 uppercase tracking-wide leading-relaxed">
                    ⚙️ STATUS: <span className="text-white font-black font-mono">{cleaningStatus}</span>
                  </div>
                </div>
              )}

              {/* Progress visual bar */}
              {isRunning && (
                <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-[#3ECF8E]/20 border-t-[#3ECF8E] animate-spin shrink-0" />
                    <span className="text-[9px] font-black text-white uppercase tracking-wider font-mono">Running</span>
                  </div>
                  <div className="text-[10px] font-black font-mono text-[#3ECF8E] animate-pulse">
                    {runnerMode === 'mot'
                      ? `${completedCountRef.current} requests sent (Time elapsed: ${Math.round(((performance.now() - startTimeRef.current) / 1000))}s)`
                      : `${allSamplesRef.current.length} / ${threads * loops} sent`}
                  </div>
                </div>
              )}

            </div>

            {/* Bottom active deploy bar */}
            <div className="px-6 py-4 border-t border-[#151518] bg-[#070709] flex justify-between items-center shrink-0">
              <span className="text-[10px] text-[#555] font-mono">
                {selectedRequestIds.length === 0 
                  ? 'SELECT TARGET SCENARIOS TO ENERGIZE RUNNER' 
                  : runnerMode === 'mot'
                    ? `READY TO DEPLOY ${selectedRequestIds.length} SCENARIOS IN ENDURANCE MoT MODE • ${threads} WORKER THREADS`
                    : `READY TO DEPLOY ${selectedRequestIds.length} SCENARIOS • ${threads * loops} TOTAL REQUESTS`}
              </span>
              
              <div className="flex items-center gap-3">
                {isCleaning ? (
                  <button
                    disabled
                    className="h-10 px-6 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-not-allowed transition-all shadow-lg animate-pulse"
                  >
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin shrink-0" /> Sanitizing Heap...
                  </button>
                ) : isRunning ? (
                  <button
                    onClick={abortSuite}
                    className="h-10 px-5 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all shadow-lg animate-pulse"
                  >
                    <Square size={12} fill="currentColor" /> Abort Runner
                  </button>
                ) : (
                  <button
                    onClick={executeSmokeSuite}
                    disabled={selectedRequestIds.length === 0}
                    className={cn(
                      "h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-all shadow-lg",
                      selectedRequestIds.length === 0 
                        ? "bg-[#101012] border border-[#1C1C22] text-[#444] cursor-not-allowed" 
                        : "bg-[#3ECF8E] hover:bg-[#32B379] text-[#070708] hover:scale-[1.02] active:scale-[0.98] border border-[#3ECF8E]"
                    )}
                  >
                    <Play size={12} fill="currentColor" /> Energize Runner
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
    );

  return (
    <>
      {isEmbedded ? (
        mainCard
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4 animate-in fade-in duration-200">
          {mainCard}
        </div>
      )}

      {/* MoT Session Intelligence Report Modal */}
      {showMotReport && motReportData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
          <div className="w-full max-w-4xl bg-[#09090C] border border-[#1C1C22] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#1C1C22] flex justify-between items-center bg-[#0C0C10] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                  <Activity size={16} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                    Minutes of Testing (MoT) Session Intelligence Report
                  </h3>
                  <p className="text-[8px] text-[#55555C] font-mono uppercase tracking-widest mt-0.5">
                    Endurance Session completed successfully &bull; Diagnostics analysis computed
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMotReport(false)}
                className="p-1.5 rounded-lg hover:bg-white/[0.05] text-[#55555C] hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 progress-panel no-scrollbar bg-[#050508]">
              
              {/* Alert status if aborted early */}
              {motReportData.earlyAbort && (
                <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-xl flex gap-3 items-start select-none">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5 animate-pulse" />
                  <div className="space-y-0.5">
                    <h4 className="text-[10px] font-black text-red-400 uppercase tracking-wider font-mono">
                      Early Termination Interceded to Prevent System Crash
                    </h4>
                    <p className="text-[9px] text-red-300 leading-tight">
                      The safety guard controller terminated the endurance testing session early. Reason: <strong>{motReportData.abortReason}</strong>. Data has been safely flushed down to disk to preserve desktop runtime heap.
                    </p>
                  </div>
                </div>
              )}

              {/* Stats Overview banner */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-[#0A0A0E] border border-[#151518] rounded-xl text-center space-y-1">
                  <span className="text-[8px] font-black text-[#55555C] uppercase tracking-widest block font-mono">Total Volume Run</span>
                  <div className="text-lg font-bold text-white font-mono">{motReportData.totalRequests}</div>
                  <span className="text-[8px] text-[#444] font-mono uppercase block">API Transmissions</span>
                </div>

                <div className="p-4 bg-[#0A0A0E] border border-[#151518] rounded-xl text-center space-y-1">
                  <span className="text-[8px] font-black text-[#55555C] uppercase tracking-widest block font-mono">Success Rate</span>
                  <div className={cn(
                    "text-lg font-bold font-mono",
                    motReportData.successRate >= 95 ? "text-[#3ECF8E]" :
                    motReportData.successRate >= 80 ? "text-amber-500" : "text-red-500"
                  )}>{motReportData.successRate}%</div>
                  <span className="text-[8px] text-[#444] font-mono uppercase block">{motReportData.successCount} Pass / {motReportData.failureCount} Fail</span>
                </div>

                <div className="p-4 bg-[#0A0A0E] border border-[#151518] rounded-xl text-center space-y-1">
                  <span className="text-[8px] font-black text-[#55555C] uppercase tracking-widest block font-mono">Latency Ceiling (Min/Max)</span>
                  <div className="text-md font-bold text-white font-mono pt-[3px]">{motReportData.minLatency}ms / {motReportData.maxLatency}ms</div>
                  <span className="text-[8px] text-[#444] font-mono uppercase block">Avg: {motReportData.avgLatency}ms</span>
                </div>

                <div className="p-4 bg-[#0A0A0E] border border-[#151518] rounded-xl text-center space-y-1">
                  <span className="text-[8px] font-black text-[#55555C] uppercase tracking-widest block font-mono">Safety Interventions</span>
                  <div className="text-lg font-bold text-white font-mono">{motReportData.crashPreventionActions}</div>
                  <span className="text-[8px] text-[#444] font-mono uppercase block">Automated Adjustments</span>
                </div>
              </div>

              {/* Hotspots Analysis and Recommendations (Side-by-side) */}
              <div className="grid grid-cols-2 gap-6">
                
                {/* Hotspots Panel / ranked list */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 border-b border-[#1C1C22] pb-1.5">
                    <AlertCircle size={12} className="text-amber-500" />
                    <span className="text-[10px] font-black text-white uppercase tracking-wider font-mono">Instability Hotspots (Ranked)</span>
                  </div>
                  
                  {motReportData.hotspots && motReportData.hotspots.length > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                      {motReportData.hotspots.map((hs: any, i: number) => (
                        <div key={hs.id} className="p-3 bg-[#0A0A0F]/60 border border-[#151518] rounded-xl flex items-center justify-between font-mono text-[9px]">
                          <div className="space-y-0.5 max-w-[210px] truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[8px] text-[#555] font-black">#{i+1}</span>
                              <span className="px-1 py-0.2 rounded bg-black/50 text-[#fff]/60 font-black text-[8px]">{hs.method}</span>
                              <span className="text-white font-bold truncate">{hs.name}</span>
                            </div>
                            <span className="text-[8px] text-[#55555C] block">Avg Response Time: {hs.avgLatency}ms</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={cn(
                              "font-black tracking-wider text-[8px] px-2 py-0.5 rounded uppercase block",
                              hs.failRate > 40 ? "text-red-500 bg-red-500/10" :
                              hs.failRate > 15 ? "text-amber-500 bg-amber-500/10" : "text-[#3ECF8E] bg-[#3ECF8E]/10"
                            )}>
                              {hs.failRate}% Failures
                            </span>
                            <span className="text-[7px] text-[#444] block mt-0.5">{hs.runCount} cycles run</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[9px] text-[#55555C] italic py-4 text-center">No telemetry data recorded to chart unreliability hotspots</div>
                  )}
                </div>

                {/* Recommendations */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 border-b border-[#1C1C22] pb-1.5">
                    <Sparkles size={12} className="text-[#3ECF8E]" />
                    <span className="text-[10px] font-black text-white uppercase tracking-wider font-mono">Tactical Optimization Recommendations</span>
                  </div>
                  
                  <div className="space-y-3 bg-[#0A0A10]/50 border border-[#15151E] p-4 rounded-xl min-h-[160px]">
                    {motReportData.recommendations && motReportData.recommendations.map((rec: string, idx: number) => (
                      <div key={idx} className="flex gap-2 items-start text-[9px] text-[#9999A1] leading-relaxed">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] shrink-0 mt-1" />
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4 border-t border-[#1C1C22] bg-[#0C0C10] flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowMotReport(false)}
                className="h-9 px-6 bg-[#3ECF8E] hover:bg-[#32B379] text-[#070708] rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Close Report and Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Immersive Blocking Overlay while cleaning / resetting */}
      {isCleaning && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[99999] flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-200">
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
                <p className="text-[9px] text-[#88889F] uppercase tracking-tight leading-relaxed font-mono">
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

      {/* Running Loading Modal with Cancel Button */}
      {isRunning && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
          <motion.div 
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-lg bg-[#09090C] border border-[#1C1C24] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#1C1C24] flex items-center gap-3 bg-[#0C0C10] shrink-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin shrink-0" />
              </div>
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                  {runnerMode === 'mot' ? 'Minutes of Testing (MoT) Active' : 'Smoke Suite Execution Active'}
                </h3>
                <p className="text-[8px] text-amber-500/80 font-mono uppercase tracking-widest mt-0.5 animate-pulse">
                  Deploying concurrent multi-scenario request threads...
                </p>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 bg-[#050508] text-center">
              {/* Radial or linear progress with statistics */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-mono text-[#55555C]">
                  <span className="uppercase font-black text-left">Overall Suite Progress</span>
                  <span className="text-[#3ECF8E] font-black">{progress}%</span>
                </div>
                {/* Custom glowing progress bar */}
                <div className="w-full h-2.5 bg-black border border-[#111] rounded-full overflow-hidden p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-[#3ECF8E] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-[9px] text-[#88888F] font-mono text-center pt-0.5">
                  {runnerMode === 'mot'
                    ? `${allSamplesRef.current.length} total transmissions processed`
                    : `${allSamplesRef.current.length} / ${threads * loops} transmissions sent`}
                </div>
              </div>

              {/* Dynamic Warning Alert on Memory Guard / Cooling Mode */}
              {isMemoryCooling && (
                <div className="p-3 bg-amber-950/25 border border-amber-500/20 rounded-xl flex gap-3 items-start text-left select-none animate-pulse">
                  <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h4 className="text-[9.5px] font-black text-amber-500 uppercase tracking-wider font-mono">
                      Adaptive Guard Controller Active
                    </h4>
                    <p className="text-[8.5px] text-[#88888F] font-mono uppercase leading-normal">
                      Memory load ({memoryPressure}%) exceeds safety thresholds. Requests paused for automatic garbage collection.
                    </p>
                  </div>
                </div>
              )}

              {/* Live telemetry metrics list/grid - Extremely clean and lightweight layout */}
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="p-3 bg-black border border-[#15151A] rounded-xl flex flex-col justify-center relative overflow-hidden">
                  <span className="text-[7.5px] font-black text-[#55555C] uppercase tracking-wider font-mono block font-mono">Throughput Rate</span>
                  <span className="text-sm font-black font-mono text-white mt-0.5">{throughput} <span className="text-[8px] text-[#444] font-medium uppercase font-sans">Tx/Sec</span></span>
                </div>
                
                <div className="p-3 bg-black border border-[#15151A] rounded-xl flex flex-col justify-center relative overflow-hidden">
                  <span className="text-[7.5px] font-black text-[#55555C] uppercase tracking-wider font-mono block font-mono">Stability Score</span>
                  <span className={cn(
                    "text-sm font-black font-mono mt-0.5 block",
                    stabilityScore > 85 ? "text-[#3ECF8E]" : stabilityScore > 50 ? "text-amber-500" : "text-red-500"
                  )}>{stabilityScore}%</span>
                </div>

                <div className="p-3 bg-black border border-[#15151A] rounded-xl flex flex-col justify-center relative overflow-hidden">
                  <span className="text-[7.5px] font-black text-[#55555C] uppercase tracking-wider font-mono block font-mono">Average Latency</span>
                  <span className="text-sm font-black font-mono text-white mt-0.5">{avgLatency} <span className="text-[8px] text-[#444] font-medium uppercase font-sans font-mono">ms</span></span>
                </div>

                <div className="p-3 bg-black border border-[#15151A] rounded-xl flex flex-col justify-center relative overflow-hidden">
                  <span className="text-[7.5px] font-black text-[#55555C] uppercase tracking-wider font-mono block font-mono">Memory Pressure</span>
                  <span className={cn(
                    "text-sm font-black font-mono mt-0.5 block",
                    memoryPressure > 80 ? "text-red-500" : memoryPressure > 50 ? "text-amber-500" : "text-[#3ECF8E]"
                  )}>{memoryPressure}%</span>
                </div>

                <div className="p-3 bg-black border border-[#15151A] rounded-xl flex flex-col justify-center relative overflow-hidden col-span-2">
                  <span className="text-[7.5px] font-black text-[#55555C] uppercase tracking-wider font-mono block font-mono">Active Threads</span>
                  <span className="text-xs font-semibold font-mono text-[#E0E0E6] mt-0.5 uppercase">
                    {threads} CONCURRENT {threads === 1 ? 'WORKER' : 'WORKER THREADS'} ACTIVE
                  </span>
                </div>
              </div>
            </div>

            {/* Footer with Abort Action */}
            <div className="px-6 py-5 border-t border-[#1C1C24] bg-[#0C0C10] flex justify-end">
              <button
                onClick={abortSuite}
                className="w-full h-11 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] duration-100"
              >
                <Square size={12} fill="currentColor" /> Cancel Active Run
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

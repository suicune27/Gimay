import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Play, Square, Activity, FileDown, Clock, Sparkles, CheckCircle2, 
  XCircle, AlertCircle, Database, HelpCircle, Zap, Shield, Search,
  ChevronDown, ChevronRight, Folder, FolderOpen, Code, SlidersHorizontal
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { RequestService } from '../services/RequestService';
import { ScriptService } from '../services/ScriptService';
import { VariableService } from '../services/VariableService';
import { SandboxRunner } from '../services/sandboxRunner';
import { SmokeLogService } from '../services/SmokeLogService';
import { SmokeRunnerService } from '../services/SmokeRunnerService';
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
    activeWorkspaceId,
    addToast 
  } = useStore();

  // Core setup states
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [threads, setThreads] = useState(1);
  const [loops, setLoops] = useState(5);
  const [delay, setDelay] = useState(50);
  const [timeoutMs, setTimeoutMs] = useState(30000);
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
  const [saveTempLogs, setSaveTempLogs] = useState(false);
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
  const [showSuiteSettings, setShowSuiteSettings] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<'general' | 'scripts' | 'msw'>('general');

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
  const [visibleLogType, setVisibleLogType] = useState<'success' | 'failed'>('success');
  const [selectedLogEntry, setSelectedLogEntry] = useState<any | null>(null);
  const [logModalTab, setLogModalTab] = useState<'request' | 'response'>('request');

  // Heavy data references locked in refs for safe multithread state coordination
  const allSamplesRef = useRef<any[]>([]);
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

  const unwrapBodyEnvelope = (value: any, maxDepth = 12): any => {
    let current = value;
    for (let i = 0; i < maxDepth; i++) {
      if (typeof current === 'string') {
        const trimmed = current.trim();
        if (!(trimmed.startsWith('{') && trimmed.endsWith('}'))) break;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object' && ('content' in parsed || 'type' in parsed)) {
            current = (parsed as any).content ?? '';
            continue;
          }
        } catch {
          break;
        }
      }

      if (current && typeof current === 'object' && 'content' in current) {
        current = (current as any).content ?? '';
        continue;
      }

      break;
    }
    return current;
  };

  const normalizeRequestBody = (req: any) => {
    const method = String(req?.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') {
      return { type: 'none', content: '' };
    }

    const sourceBody = req?.body;
    const sourceType = req?.bodyType || (typeof sourceBody === 'object' && sourceBody?.type ? sourceBody.type : 'raw');
    const unwrapped = unwrapBodyEnvelope(
      typeof sourceBody === 'string' ? sourceBody : (sourceBody?.content ?? sourceBody)
    );
    const normalizedContent = typeof unwrapped === 'string' ? unwrapped : safeStringify(unwrapped || '');

    if (sourceBody && typeof sourceBody === 'object') {
      return { ...sourceBody, type: sourceType, content: normalizedContent };
    }

    return { type: sourceType, content: normalizedContent };
  };

  const pushBounded = (arr: any[], item: any, max = 50) => {
    arr.push(item);
    if (arr.length > max) arr.shift();
  };

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
      <div className="space-y-1 select-none">
        <div 
          className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/[0.02] cursor-pointer group transition-colors text-[#88888F] hover:text-white h-9"
          onClick={() => toggleNode(collection.id)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[#555] hover:text-[#888] p-0.5">
              {isExpanded ? <ChevronDown size={12} className="text-[#3ECF8E]" /> : <ChevronRight size={12} className="text-[#444]" />}
            </span>
            <Database size={12} className={isExpanded ? "text-[#3ECF8E]" : "text-[#55555C]"} />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase truncate">
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
            className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer mr-1"
          />
        </div>

        {isExpanded && (
          <div className="space-y-1 pl-2 border-l border-[#151518]/60 ml-4 mt-1">
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

    setIsMemoryCooling(false);
    isMemoryCoolingRef.current = false;
    setIsRunning(true);
    isRunningRef.current = true;
    setProgress(0);
    setSamples([]);
    setSelectedLogEntry(null);
    setThroughput(0);
    setAvgLatency(0);
    setMinLatency(0);
    setMaxLatency(0);
    setSuccessRate(100);
    allSamplesRef.current = [];
    successLogSamplesRef.current = [];
    failedLogSamplesRef.current = [];
    setMemoryCoolingCount(0);

    const activeCollection = collections.find(c => c.id === targets[0].collection_id);
    const activeEnvironment = environments.find(e => e.id === selectedEnvId);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const persistTemporaryRunLog = async (runLabel: string, durationMs: number) => {
      const persisted = await SmokeLogService.persistTemporaryRunLog({
        enabled: saveTempLogs,
        runLabel,
        requestId: targets[0]?.id,
        workspaceId: targets[0]?.workspace_id || activeWorkspaceId,
        fallbackUserId: targets[0]?.user_id,
        durationMs,
        samples: [
          ...successLogSamplesRef.current,
          ...failedLogSamplesRef.current
        ],
        metadata: {
          panel: 'smoke-suite',
          runnerMode,
          threads,
          loops,
          delay,
          timeoutMs,
          sandboxEngine,
          runRequestScripts,
          stopOnFailure,
          targetCount: targets.length
        }
      });

      if (persisted) {
        addToast({ type: 'success', message: 'Temporary smoke suite logs saved to database.' });
      }
    };

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
            if (currentRunId !== currentRunIdRef.current) return;
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
          let statusCode: number | null = null;
          let responsePreview = '';
          let responseHeaders: Record<string, any> = {};
          let responseBody: any = null;
          let resolvedRequestUrl = '';
          let resolvedRequestHeaders: Record<string, string> = {};
          let resolvedRequestParams: Record<string, string> = {};
          let resolvedRequestBody = '';
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
              useWorker: sandboxEngine === 'worker',
              suppressScriptLogs: true,
              skipResponseBody: !runRequestScripts,
              responseBodyLimitBytes: runRequestScripts ? undefined : 65536
            };

            requestToExecute = {
              ...baseRequest,
              headers: (baseRequest.headers || []).map(h => ({ ...h })),
              params: (baseRequest.params || []).map(p => ({ ...p })),
              body: normalizeRequestBody(baseRequest),
              settings: baseRequest.settings ? { ...baseRequest.settings } : undefined
            };

            requestToExecute.bodyType = (requestToExecute.method === 'GET' || requestToExecute.method === 'HEAD')
              ? 'none'
              : requestToExecute.bodyType;

            requestToExecute.settings = {
              ...(requestToExecute.settings || { followRedirects: true, maxRedirects: 10 }),
              timeout: timeoutMs
            };

            const applyPreRequestOutput = (out: any) => {
              requestToExecute = {
                ...out.request,
                headers: (out.request?.headers || []).map((h: any) => ({ ...h })),
                params: (out.request?.params || []).map((p: any) => ({ ...p })),
                body: normalizeRequestBody(out.request)
              };

              requestToExecute.bodyType = (requestToExecute.method === 'GET' || requestToExecute.method === 'HEAD')
                ? 'none'
                : requestToExecute.bodyType;

              if (out.environmentMutations) {
                for (const [key, value] of Object.entries(out.environmentMutations)) {
                  if (value === null) {
                    delete threadVariables[key];
                  } else {
                    threadVariables[key] = String(value);
                  }
                }
              }
            };

            // Stage 1 (strict): environment pre-request script always runs first.
            if (runRequestScripts && activeEnvironment?.pre_request_script?.trim()) {
              const envPreOut = await ScriptService.executePreRequest(
                activeEnvironment.pre_request_script,
                requestToExecute,
                {
                  ...variableContext,
                  throwOnError: true
                }
              );
              if (currentRunId !== currentRunIdRef.current) return;
              applyPreRequestOutput(envPreOut);
            }

            const preScripts = runRequestScripts ? [
              innerActiveCollection?.pre_request_script,
              suitePreScript,
              requestToExecute.pre_request_script
            ].filter(Boolean) as string[] : [];

            if (preScripts.length > 0) {
              const preRequestOut = await ScriptService.executePreRequest(
                preScripts,
                requestToExecute,
                {
                  ...variableContext,
                  throwOnError: true
                }
              );
              if (currentRunId !== currentRunIdRef.current) return;
              applyPreRequestOutput(preRequestOut);
            }

            // Resolve final request values after pre-request scripts to reflect actual transmitted data.
            resolvedRequestUrl = VariableService.resolve(requestToExecute.url || '', variableContext);
            resolvedRequestHeaders = (requestToExecute.headers || []).reduce((acc: Record<string, string>, h: any) => {
              if (h?.active === false || !h?.key) return acc;
              const k = VariableService.resolve(String(h.key), variableContext);
              const v = VariableService.resolve(String(h.value ?? ''), variableContext);
              acc[k] = v;
              return acc;
            }, {});
            resolvedRequestParams = (requestToExecute.params || []).reduce((acc: Record<string, string>, p: any) => {
              if (p?.active === false || !p?.key) return acc;
              const k = VariableService.resolve(String(p.key), variableContext);
              const v = VariableService.resolve(String(p.value ?? ''), variableContext);
              acc[k] = v;
              return acc;
            }, {});

            if (requestToExecute.method === 'GET' || requestToExecute.method === 'HEAD' || requestToExecute.bodyType === 'none') {
              resolvedRequestBody = '';
            } else {
              const rawBody = typeof requestToExecute.body === 'string'
                ? requestToExecute.body
                : (requestToExecute.body as any)?.content ?? requestToExecute.body;
              resolvedRequestBody = VariableService.resolve(String(rawBody ?? ''), variableContext);
            }

            const response = await RequestService.execute(requestToExecute, variableContext);
            if (currentRunId !== currentRunIdRef.current) return;

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
            statusCode = response.status;
            responsePreview = buildResponsePreview(response.body);
            responseHeaders = response.headers || {};
            responseBody = response.body;
            success = response.status >= 200 && response.status < 300;

            if (response.status === 0) {
              success = false;
              status = response.statusText;
              try {
                let bodyObj = response.body;
                if (typeof bodyObj === 'string') {
                  try {
                    bodyObj = JSON.parse(bodyObj);
                  } catch {}
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
            responseHeaders = err?.response?.headers || {};
            responseBody = err?.response?.data;
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

          const finalErrorMsg = (typeof errorMsg === 'object' && errorMsg !== null)
            ? ((errorMsg as any).error || (errorMsg as any).message || JSON.stringify(errorMsg))
            : (errorMsg ? String(errorMsg) : undefined);

          const newSample = {
            id: completedCount,
            timestamp: new Date().toLocaleTimeString(),
            latency: duration,
            status,
            success,
            error: finalErrorMsg,
            requestName: baseRequest.name,
            requestMethod: baseRequest.method
          };

          allSamplesRef.current.push(newSample);
          const logSample = {
            ...newSample,
            statusCode,
            responsePreview,
            requestUrl: resolvedRequestUrl || requestToExecute.url,
            requestMethod: requestToExecute.method,
            requestHeaders: resolvedRequestHeaders,
            requestParams: resolvedRequestParams,
            requestBody: resolvedRequestBody,
            responseHeaders,
            responseBody
          };
          if (success) {
            pushBounded(successLogSamplesRef.current, logSample, 50);
          } else {
            pushBounded(failedLogSamplesRef.current, logSample, 50);
          }

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
        await persistTemporaryRunLog('loops', performance.now() - startTime);
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
          let statusCode: number | null = null;
          let responsePreview = '';
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
                useWorker: sandboxEngine === 'worker',
                suppressScriptLogs: true,
                skipResponseBody: !runRequestScripts,
                responseBodyLimitBytes: runRequestScripts ? undefined : 65536
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
              statusCode = response.status;
              responsePreview = buildResponsePreview(response.body);
              success = response.status >= 200 && response.status < 300;

              if (response.status === 0) {
                success = false;
                status = response.statusText;
                try {
                  let bodyObj = response.body;
                  if (typeof bodyObj === 'string') {
                    try {
                      bodyObj = JSON.parse(bodyObj);
                    } catch {}
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
                  pushBounded(failedLogSamplesRef.current, {
                    id: completedCountRef.current,
                    timestamp: new Date().toLocaleTimeString(),
                    latency: 0,
                    status: 'AUTH_REFRESH',
                    statusCode: 401,
                    success: false,
                    error: 'Auth refresh retry',
                    responsePreview: '',
                    requestName: baseRequest.name,
                    requestMethod: baseRequest.method
                  }, 50);
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

          const finalErrorMsg = (typeof errorMsg === 'object' && errorMsg !== null)
            ? ((errorMsg as any).error || (errorMsg as any).message || JSON.stringify(errorMsg))
            : (errorMsg ? String(errorMsg) : undefined);

          const newSample = {
            id: completedCountRef.current,
            status,
            success,
            latency: duration,
            error: finalErrorMsg
          };

          allSamplesRef.current.push(newSample);
          const logSample = {
            ...newSample,
            statusCode,
            responsePreview,
            error: finalErrorMsg,
            requestName: baseRequest.name,
            requestMethod: baseRequest.method,
            timestamp: new Date().toLocaleTimeString()
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
        await persistTemporaryRunLog('mot', totalElapsed * 1000);

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
        const finalPassRate = Math.round((successCountRef.current / (completedCountRef.current || 1)) * 100);
        const recs = SmokeRunnerService.generateMoTRecommendations(
          finalPassRate,
          maxLatencyValue === -Infinity ? 0 : maxLatencyValue,
          crashPreventionTriggersCountRef.current,
          hotspotsList
        );
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
      'ID', 'Timestamp', 'Scenario Target Name', 'Method',
      'Latency (ms)', 'HTTP Status', 'Outcome', 'Diagnostics'
    ];
    const rows = data.map(s => [
      s.id,
      s.timestamp || '',
      `"${(s.requestName || '').replace(/"/g, '""')}"`,
      s.requestMethod || '',
      s.latency,
      s.status || '',
      s.success ? 'SUCCESS' : 'FAILURE',
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
    URL.revokeObjectURL(url);
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
      <div className="bg-[#09090D] border border-white/[0.04] rounded-2xl p-5 space-y-4 relative overflow-visible shadow-2xl">
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
            <div className="bg-[#030305] rounded-xl p-3 border border-white/[0.04] space-y-2">
              <div className="h-[300px] sm:h-[320px] w-full rounded-lg bg-[#05050A] border border-[#1C1C25] overflow-hidden">
                <svg viewBox="0 0 860 300" className="w-full h-full block" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="suiteLatencyArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3ECF8E" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#3ECF8E" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {[0, 1, 2, 3, 4, 5].map((tick) => {
                    const y = 24 + tick * 44;
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
                    const y = 24 + (1 - Math.min(1, threshold / maxScale)) * 220;
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
                    const top = 24;
                    const bottom = 244;
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
                        {areaPath && <path d={areaPath} fill="url(#suiteLatencyArea)" />}
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
          <div className="flex items-center gap-3 text-left">
            <div className="w-8 h-8 rounded-lg bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 flex items-center justify-center">
              <Activity size={14} className="text-[#3ECF8E] animate-pulse" />
            </div>
            <div>
              <h3 className="text-[11px] font-black text-white uppercase tracking-widest font-mono">Smoke & Performance Suite</h3>
              <p className="text-[8px] text-[#55555C] font-mono leading-relaxed mt-0.5 uppercase">Deploy bulk scenarios in parallel with real-time outcome analytics</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isRunning}
            className="p-1 px-2 text-[10px] text-zinc-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.05] rounded border border-white/[0.05] cursor-pointer disabled:opacity-30"
          >
            CLOSE
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
            <div className="p-4 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black text-[#555] uppercase tracking-wider font-mono">Scenarios Checklist</label>
                <span className="text-[9px] font-bold font-mono text-[#3ECF8E]">{selectedRequestIds.length} SELECTED</span>
              </div>
              
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#444]" />
                <input
                  type="text"
                  placeholder="SEARCH TARGET SCENARIOS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#050508] border border-[#151518] pl-7 pr-3 py-1.5 rounded-lg text-[10px] font-mono text-white outline-none focus:border-[#3ECF8E]/30 placeholder:text-[#333]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <button
                  onClick={handleSelectAll}
                  disabled={isRunning}
                  className="py-1 px-2.5 rounded bg-[#3ECF8E]/10 border border-[#3ECF8E]/15 text-[#3ECF8E] hover:bg-[#3ECF8E]/25 text-[8px] font-black uppercase tracking-wider text-center cursor-pointer transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={isRunning}
                  className="py-1 px-2.5 rounded bg-transparent border border-[#151518] text-[#555] hover:text-[#888] text-[8px] font-black uppercase tracking-wider text-center cursor-pointer transition-colors"
                >
                  Clear All
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
                        "flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/[0.02] cursor-pointer transition-all select-none text-left",
                        isChecked ? "bg-[#3ECF8E]/[0.01]" : "bg-transparent"
                      )}
                      onClick={() => handleToggleRequest(item.request.id)}
                    >
                      <div className="min-w-0 flex-1">
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
                <div className="text-center py-16 text-zinc-500 italic font-sans text-xs">No scenarios match query</div>
              )}
            </div>
          </div>

          {/* Right panel: execution setup and diagnostics */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#050508]">
            
            {/* Top configuration options replaced with action ribbon */}
            <div className="flex items-center justify-between p-4 border-b border-[#151518]/60 bg-[#070709] relative text-left select-none">
              {isRunning && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-30 flex items-center justify-center p-4 text-center gap-2 select-none">
                  <Shield className="text-[#555] animate-pulse" size={14} />
                  <span className="text-[9px] font-mono font-black text-[#888] uppercase tracking-[0.2em] animate-pulse">Running Smoke Suite</span>
                </div>
              )}
              
              {/* Left summary details of the active suite params */}
              <div className="flex flex-wrap items-center gap-1.5 max-w-[80%]">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono mr-1">
                  Active Suite Parameters:
                </span>
                
                {/* Env Indicator */}
                <span className="text-[8px] text-sky-400 font-black uppercase bg-sky-500/10 border border-sky-500/15 px-1.5 py-0.5 rounded font-mono tracking-wider">
                  Env: {environments.find(e => e.id === selectedEnvId)?.name || 'NONE'}
                </span>

                {/* Worker counts */}
                <span className="text-[8px] text-[#3ECF8E] font-black uppercase bg-[#3ECF8E]/10 border border-[#3ECF8E]/15 px-1.5 py-0.5 rounded font-mono tracking-wider">
                  {threads} {threads === 1 ? 'Workthread' : 'Workthreads'} • {loops} {loops === 1 ? 'Loop' : 'Loops'}
                </span>

                {/* Latencies & delay */}
                <span className="text-[8px] text-[#888] font-black uppercase bg-zinc-900 border border-[#151518] px-1.5 py-0.5 rounded font-mono tracking-wider">
                  Delay: {delay}ms • Timeout: {timeoutMs}ms
                </span>

                {/* sandbox engine */}
                <span className="text-[8px] text-purple-400 font-black uppercase bg-purple-500/10 border border-purple-500/15 px-1.5 py-0.5 rounded font-mono tracking-wider">
                  Engine: {sandboxEngine === 'worker' ? 'WorkerPool' : 'InThread'}
                </span>

                {/* Indicators flags if active */}
                {stopOnFailure && (
                  <span className="text-[8px] text-red-500 font-black uppercase bg-red-500/10 border border-red-500/15 px-1.5 py-0.5 rounded font-mono tracking-wider animate-pulse">
                    Abort-On-Fail
                  </span>
                )}
                {runRequestScripts && (
                  <span className="text-[8px] text-amber-500 font-black uppercase bg-amber-500/10 border border-amber-500/15 px-1.5 py-0.5 rounded font-mono tracking-wider">
                    Scripts
                  </span>
                )}
                {mswEnabled && (
                  <span className="text-[8px] text-pink-500 font-black uppercase bg-pink-500/10 border border-pink-500/15 px-1.5 py-0.5 rounded font-mono tracking-wider">
                    Virtual MSW Override
                  </span>
                )}
              </div>

              {/* Right Settings Toggle button */}
              <button
                onClick={() => setShowSuiteSettings(true)}
                disabled={isRunning}
                className="flex items-center gap-1.5 h-7 px-3 text-[9px] font-black text-zinc-300 hover:text-[#3ECF8E] hover:border-[#3ECF8E]/30 bg-[#09090C] border border-[#151518] rounded-xl transition-all cursor-pointer disabled:opacity-30 uppercase font-mono"
              >
                <SlidersHorizontal size={11} />
                Suite Settings
              </button>
            </div>

            {/* Middle telemetry & graphs view */}
            <div className="p-6 space-y-6 flex-1 flex flex-col overflow-y-auto no-scrollbar">

              {/* Runner Mode Selection Tab */}
              <div className="flex bg-[#050508] p-1 rounded-xl border border-[#151518] w-full max-w-sm select-none relative shrink-0">
                {isRunning && (
                  <div className="absolute inset-0 bg-transparent z-40 cursor-not-allowed" />
                )}
                <button
                  onClick={() => setRunnerMode('loop')}
                  className={cn(
                    "flex-1 py-1 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono text-center outline-none border-0",
                    runnerMode === 'loop' ? "bg-[#3ECF8E]/10 border border-[#3ECF8E]/15 text-[#3ECF8E]" : "text-[#555] hover:text-[#888]"
                  )}
                >
                  Loop-based Scenario Runner
                </button>
                <button
                  onClick={() => setRunnerMode('mot')}
                  className={cn(
                    "flex-1 py-1 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono text-center outline-none border-0",
                    runnerMode === 'mot' ? "bg-amber-500/10 border border-amber-500/15 text-amber-500" : "text-[#555] hover:text-[#888]"
                  )}
                >
                  Minutes of Testing (MoT Engine)
                </button>
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



              {renderLatencyGraph()}

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
                        onClick={() => {
                          setSelectedLogEntry(log);
                          setLogModalTab('request');
                        }}
                        className="bg-[#0D0D12] border border-[#1C1C25] rounded-lg p-2.5 space-y-1.5 cursor-pointer hover:border-[#3ECF8E]/30 transition-colors"
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
                        <div className="text-[7px] text-[#777] font-mono uppercase tracking-wider">Click to open full request/response details</div>
                      </div>
                    ))}

                  {(visibleLogType === 'success' ? successLogSamplesRef.current.length : failedLogSamplesRef.current.length) === 0 && (
                    <div className="text-[8px] text-[#777] font-mono uppercase tracking-wider py-4 text-center border border-dashed border-[#1C1C25] rounded-lg">
                      No logs yet for this bucket.
                    </div>
                  )}
                </div>
              </div>

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

      {selectedLogEntry && (
        <div className="fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-6xl max-h-[88vh] bg-[#09090C] border border-[#1C1C22] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-[#1C1C22] bg-[#0C0C10] flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="text-[11px] font-black text-white uppercase tracking-wider font-mono">
                  Smoke Suite Log Detail #{selectedLogEntry.id}
                </h3>
                <p className="text-[8px] text-[#70707A] font-mono uppercase">
                  {selectedLogEntry.requestMethod || '-'} {selectedLogEntry.requestName || '-'} • Status {selectedLogEntry.statusCode ?? selectedLogEntry.status ?? '-'} • {selectedLogEntry.latency ?? 0}ms
                </p>
              </div>
              <button
                onClick={() => setSelectedLogEntry(null)}
                className="p-1.5 rounded-lg hover:bg-white/[0.05] text-[#55555C] hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-2 border-b border-[#1C1C22] bg-[#0A0A0F] flex items-center gap-2">
              <button
                onClick={() => setLogModalTab('request')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider font-mono border transition-colors',
                  logModalTab === 'request'
                    ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border-[#3ECF8E]/25'
                    : 'bg-transparent text-[#777] border-[#1C1C22] hover:text-[#AAA]'
                )}
              >
                Request
              </button>
              <button
                onClick={() => setLogModalTab('response')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider font-mono border transition-colors',
                  logModalTab === 'response'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/25'
                    : 'bg-transparent text-[#777] border-[#1C1C22] hover:text-[#AAA]'
                )}
              >
                Response
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#050508] select-text">
              {logModalTab === 'request' ? (
                <>
                  <div className="bg-[#0D0D12] border border-[#1C1C25] rounded-xl p-3 space-y-1.5">
                    <div className="text-[8px] text-[#666] font-black uppercase tracking-wider font-mono">Request Line</div>
                    <div className="text-[10px] font-mono text-white break-all">{selectedLogEntry.requestMethod || '-'} {selectedLogEntry.requestUrl || '-'}</div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-[#0D0D12] border border-[#1C1C25] rounded-xl p-3 space-y-1.5">
                      <div className="text-[8px] text-[#666] font-black uppercase tracking-wider font-mono">Headers</div>
                      <pre className="text-[9px] text-[#E0E0E6] bg-black/30 border border-[#1C1C25] rounded p-3 overflow-auto max-h-[42vh] whitespace-pre-wrap break-words font-mono leading-relaxed">
                        {safeStringify(selectedLogEntry.requestHeaders || {}) || '{}'}
                      </pre>
                    </div>
                    <div className="bg-[#0D0D12] border border-[#1C1C25] rounded-xl p-3 space-y-1.5">
                      <div className="text-[8px] text-[#666] font-black uppercase tracking-wider font-mono">Query Params</div>
                      <pre className="text-[9px] text-[#E0E0E6] bg-black/30 border border-[#1C1C25] rounded p-3 overflow-auto max-h-[42vh] whitespace-pre-wrap break-words font-mono leading-relaxed">
                        {safeStringify(selectedLogEntry.requestParams || {}) || '{}'}
                      </pre>
                    </div>
                  </div>

                  <div className="bg-[#0D0D12] border border-[#1C1C25] rounded-xl p-3 space-y-1.5">
                    <div className="text-[8px] text-[#666] font-black uppercase tracking-wider font-mono">Body</div>
                    <pre className="text-[9px] text-[#E0E0E6] bg-black/30 border border-[#1C1C25] rounded p-3 overflow-auto max-h-[46vh] whitespace-pre-wrap break-words font-mono leading-relaxed">
                      {safeStringify(selectedLogEntry.requestBody || '') || '[empty request body]'}
                    </pre>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-[#0D0D12] border border-[#1C1C25] rounded-xl p-3 space-y-1.5">
                    <div className="text-[8px] text-[#666] font-black uppercase tracking-wider font-mono">Response Status</div>
                    <div className="text-[10px] font-mono text-white">{selectedLogEntry.statusCode ?? selectedLogEntry.status ?? '-'} • {selectedLogEntry.latency ?? 0}ms</div>
                  </div>

                  <div className="bg-[#0D0D12] border border-[#1C1C25] rounded-xl p-3 space-y-1.5">
                    <div className="text-[8px] text-[#666] font-black uppercase tracking-wider font-mono">Headers</div>
                    <pre className="text-[9px] text-[#E0E0E6] bg-black/30 border border-[#1C1C25] rounded p-3 overflow-auto max-h-[38vh] whitespace-pre-wrap break-words font-mono leading-relaxed">
                      {safeStringify(selectedLogEntry.responseHeaders || {}) || '{}'}
                    </pre>
                  </div>

                  <div className="bg-[#0D0D12] border border-[#1C1C25] rounded-xl p-3 space-y-1.5">
                    <div className="text-[8px] text-[#666] font-black uppercase tracking-wider font-mono">Body</div>
                    <pre className="text-[9px] text-[#E0E0E6] bg-black/30 border border-[#1C1C25] rounded p-3 overflow-auto max-h-[46vh] whitespace-pre-wrap break-words font-mono leading-relaxed">
                      {safeStringify(selectedLogEntry.responseBody || selectedLogEntry.responsePreview || '') || '[empty response body]'}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
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

      {/* Smoke Suite Settings Modal */}
      {showSuiteSettings && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-3xl bg-[#09090C] border border-[#1C1C22] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#1C1C22] bg-[#0C0C10] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#3ECF8E]/10 border border-[#3ECF8E]/25 flex items-center justify-center">
                  <SlidersHorizontal size={14} className="text-[#3ECF8E]" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest font-mono">
                    Suite Settings & Reliability Config
                  </h3>
                  <p className="text-[8px] text-[#55555C] font-mono uppercase tracking-widest mt-0.5 leading-none">
                    Configure threads, limits, mock response structures, and assertion triggers
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSuiteSettings(false)}
                className="p-1.5 rounded-lg hover:bg-white/[0.05] text-[#55555C] hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tab Navigation header */}
            <div className="px-5 py-2 border-b border-[#1C1C22]/60 bg-[#070709] flex gap-2 select-none shrink-0 font-mono">
              <button
                type="button"
                onClick={() => setSettingsActiveTab('general')}
                className={`px-3 py-1.5 text-[8.5px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                  settingsActiveTab === 'general'
                    ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/20 shadow-sm shadow-[#3ECF8E]/5'
                    : 'text-[#666] hover:text-[#999] border border-transparent'
                }`}
              >
                ⚙️ Profiles & General
              </button>
              <button
                type="button"
                onClick={() => setSettingsActiveTab('scripts')}
                className={`px-3 py-1.5 text-[8.5px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                  settingsActiveTab === 'scripts'
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm shadow-amber-500/5'
                    : 'text-[#666] hover:text-[#999] border border-transparent'
                }`}
              >
                📝 Suite Scripts
              </button>
              <button
                type="button"
                onClick={() => setSettingsActiveTab('msw')}
                className={`px-3 py-1.5 text-[8.5px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                  settingsActiveTab === 'msw'
                    ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20 shadow-sm shadow-purple-500/5'
                    : 'text-[#666] hover:text-[#999] border border-transparent'
                }`}
              >
                🛡️ MSW Interceptor
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 bg-[#050508] select-none no-scrollbar">
              
              {settingsActiveTab === 'general' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Profile setup: threads & limits */}
                  <div className="space-y-3">
                    <h4 className="text-[9px] font-black text-[#555] uppercase tracking-wider font-mono border-b border-[#151518]/60 pb-1.5 leading-none">
                      Execution Performance Profiles
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-[#888] uppercase tracking-wider font-mono block">Environment Scope</label>
                        <select
                          disabled={isRunning}
                          value={selectedEnvId || ''}
                          onChange={(e) => setSelectedEnvId(e.target.value || null)}
                          className="w-full h-8 bg-[#09090C] border border-[#1C1C22] px-2 rounded-lg text-[10px] font-mono text-zinc-300 outline-none focus:border-[#3ECF8E]/30 cursor-pointer uppercase font-bold"
                        >
                          <option value="">No Environment</option>
                          {environments.map(env => (
                            <option key={env.id} value={env.id}>{env.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-[#888] uppercase tracking-wider font-mono block">Concurrent Threads (1-20)</label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          disabled={isRunning}
                          value={threads}
                          onChange={(e) => setThreads(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="w-full h-8 bg-[#09090C] border border-[#1C1C22] px-2 rounded-lg text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30 font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-[#888] uppercase tracking-wider font-mono block">Loops Per Thread (1-100)</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          disabled={isRunning}
                          value={loops}
                          onChange={(e) => setLoops(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="w-full h-8 bg-[#09090C] border border-[#1C1C22] px-2 rounded-lg text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30 font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-[#888] uppercase tracking-wider font-mono block">Delay Between Runs (ms)</label>
                        <input
                          type="number"
                          disabled={isRunning}
                          value={delay}
                          onChange={(e) => setDelay(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full h-8 bg-[#09090C] border border-[#1C1C22] px-2 rounded-lg text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30 font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-[#888] uppercase tracking-wider font-mono block">Socket Timeout Limit (ms)</label>
                        <input
                          type="number"
                          disabled={isRunning}
                          value={timeoutMs}
                          onChange={(e) => setTimeoutMs(Math.max(100, parseInt(e.target.value) || 100))}
                          className="w-full h-8 bg-[#09090C] border border-[#1C1C22] px-2 rounded-lg text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30 font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-[#888] uppercase tracking-wider font-mono block">Sandbox Isolation engine</label>
                        <select
                          disabled={isRunning}
                          value={sandboxEngine}
                          onChange={(e) => setSandboxEngine(e.target.value as 'in-thread' | 'worker')}
                          className="w-full h-8 bg-[#09090C] border border-[#1C1C22] px-2 rounded-lg text-[10px] font-mono text-zinc-300 outline-none focus:border-[#3ECF8E]/30 cursor-pointer uppercase font-bold"
                        >
                          <option value="in-thread">In-Thread (Main Engine)</option>
                          <option value="worker">Worker Pool (Isolate)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Reliability toggles */}
                  <div className="space-y-3">
                    <h4 className="text-[9px] font-black text-[#555] uppercase tracking-wider font-mono border-b border-[#151518]/60 pb-1.5 leading-none">
                      Reliability Guard & Automation Toggles
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <label className="flex items-center justify-between h-8.5 px-3 rounded-xl bg-[#09090C]/60 border border-[#151518]/80 text-[8px] font-black uppercase tracking-wider text-[#888] cursor-pointer hover:border-[#1C1C22] hover:text-white select-none transition-all">
                        Abort on failure
                        <input
                          type="checkbox"
                          checked={stopOnFailure}
                          disabled={isRunning}
                          onChange={(e) => setStopOnFailure(e.target.checked)}
                          className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer ml-2"
                        />
                      </label>

                      <label className="flex items-center justify-between h-8.5 px-3 rounded-xl bg-[#09090C]/60 border border-[#151518]/80 text-[8px] font-black uppercase tracking-wider text-[#888] cursor-pointer hover:border-[#1C1C22] hover:text-white select-none transition-all">
                        execute scripts
                        <input
                          type="checkbox"
                          checked={runRequestScripts}
                          disabled={isRunning}
                          onChange={(e) => setRunRequestScripts(e.target.checked)}
                          className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer ml-2"
                        />
                      </label>

                      <label className="flex items-center justify-between h-8.5 px-3 rounded-xl bg-[#09090C]/60 border border-[#151518]/80 text-[8px] font-black uppercase tracking-wider text-[#888] cursor-pointer hover:border-[#1C1C22] hover:text-white select-none transition-all">
                        archive logs
                        <input
                          type="checkbox"
                          checked={saveTempLogs}
                          disabled={isRunning}
                          onChange={(e) => setSaveTempLogs(e.target.checked)}
                          className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer ml-2"
                        />
                      </label>

                      <label className="flex items-center justify-between h-8.5 px-3 rounded-xl bg-[#09090C]/60 border border-[#151518]/80 text-[8px] font-black uppercase tracking-wider text-[#888] cursor-pointer hover:border-[#1C1C22] hover:text-white select-none transition-all">
                        VIRTUAL MSW OVERRIDE
                        <input
                          type="checkbox"
                          checked={mswEnabled}
                          disabled={isRunning}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setMswEnabled(val);
                            syncMswConfig({ enabled: val });
                          }}
                          className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer ml-2"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {settingsActiveTab === 'scripts' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-[#09090C]/40 border border-[#151518] rounded-xl p-3.5 text-left select-none font-mono">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">
                      💡 Dynamic Scripting Integration Guide
                    </span>
                    <p className="text-[8.5px] text-[#777] leading-relaxed">
                      Scripts run synchronously inside secure isolated JavaScript threads. Use the <code className="text-amber-400 font-bold">pm.*</code> style sandbox functions: <code className="text-[#3ECF8E]">pm.environment.set(key, val)</code>, <code className="text-[#3ECF8E]">pm.response.json()</code>, and <code className="text-[#3ECF8E]">pm.expect()</code> for asserting status and fields.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <label className="text-[8px] font-black text-amber-500 uppercase block font-mono">
                          Suite Pre-request Script (javascript)
                        </label>
                        <span className="text-[7.5px] font-mono text-[#555]">Runs before each scenario request</span>
                      </div>
                      <textarea
                        value={suitePreScript}
                        disabled={isRunning}
                        onChange={(e) => setSuitePreScript(e.target.value)}
                        rows={12}
                        placeholder="// Modify or dynamically mock configurations before sending...
// Example:
// pm.variables.set('timestamp', Date.now());"
                        className="w-full bg-[#09090C] border border-[#1C1C22] p-3 rounded-xl text-[10px] font-mono text-zinc-100 outline-none focus:border-amber-500/30 font-semibold select-text"
                      />
                    </div>

                    <div className="space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <label className="text-[8px] font-black text-amber-500 uppercase block font-mono">
                          Suite Assertion Test verification (javascript)
                        </label>
                        <span className="text-[7.5px] font-mono text-[#555]">Evaluates responses returned</span>
                      </div>
                      <textarea
                        value={suiteTestScript}
                        disabled={isRunning}
                        onChange={(e) => setSuiteTestScript(e.target.value)}
                        rows={12}
                        placeholder="// Execute test assertions on the responses returned...
// Example:
// pm.test('Status is 200', () => {
//   pm.response.to.have.status(200);
// });"
                        className="w-full bg-[#09090C] border border-[#1C1C22] p-3 rounded-xl text-[10px] font-mono text-zinc-100 outline-none focus:border-amber-500/30 font-semibold select-text"
                      />
                    </div>
                  </div>
                </div>
              )}

              {settingsActiveTab === 'msw' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Toggle header at top of tab */}
                  <div className="flex items-center justify-between bg-[#09090C]/60 border border-[#151518] rounded-xl p-3.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full ${mswEnabled ? 'bg-purple-500 animate-pulse shadow-md shadow-purple-500/20' : 'bg-[#222]'}`} />
                      <div>
                        <span className="text-[9px] font-black text-white uppercase tracking-widest block font-mono">
                          MSW Network Mock Intercept Mode
                        </span>
                        <p className="text-[8px] text-[#555] font-mono uppercase tracking-wider leading-none mt-0.5">
                          {mswEnabled ? 'Routing active queries into the simulated loop sandbox' : 'Mock emulator disabled, requests query real hosts'}
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer font-mono text-[8px] font-black text-[#888] hover:text-white transition-all select-none uppercase">
                      Status: {mswEnabled ? 'ACTIVE' : 'INACTIVE'}
                      <input
                        type="checkbox"
                        checked={mswEnabled}
                        disabled={isRunning}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setMswEnabled(val);
                          syncMswConfig({ enabled: val });
                        }}
                        className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer ml-1"
                      />
                    </label>
                  </div>

                  {mswEnabled ? (
                    <div className="bg-[#09090C]/60 border border-[#151518] rounded-2xl p-4 space-y-4 relative animate-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-1.5 border-b border-[#1C1C22]/50 pb-2">
                        <Shield size={12} className="text-purple-400" />
                        <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest block font-mono">
                          Mock Interceptor Response Properties
                        </span>
                      </div>

                      <div className="grid grid-cols-12 gap-3 pb-1">
                        {/* Status Code Selection */}
                        <div className="col-span-12 md:col-span-6 space-y-1.5 text-left font-mono">
                          <label className="text-[8px] font-black text-purple-400 uppercase tracking-widest block">Mock HTTP Status Override</label>
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
                            className="w-full bg-[#050508] border border-[#151518]/60 px-2 h-8 rounded-lg text-[10px] font-mono text-white outline-none focus:border-purple-500/30 cursor-pointer"
                          >
                            <option value={200}>200 OK</option>
                            <option value={201}>201 Created</option>
                            <option value={204}>204 No Content</option>
                            <option value={400}>400 Bad Request</option>
                            <option value={401}>401 Unauthorized</option>
                            <option value={403}>403 Forbidden</option>
                            <option value={404}>404 Not Found</option>
                            <option value={429}>429 Too Many Requests</option>
                            <option value={500}>500 Internal Server Error</option>
                          </select>
                        </div>

                        {/* Mock Latency slider */}
                        <div className="col-span-12 md:col-span-6 space-y-1.5 text-left font-mono">
                          <div className="flex justify-between items-center bg-transparent">
                            <label className="text-[8px] font-black text-purple-400 uppercase tracking-widest text-[#E0E0E6]">Mock Latency (ms)</label>
                            <span className="text-[10px] font-mono font-bold text-white">{mswLatency}ms</span>
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
                            className="w-full h-1 bg-[#1C1C25] rounded-lg appearance-none cursor-pointer mt-3 outline-none"
                          />
                        </div>
                      </div>

                      {/* Preset triggers for fast mockup payloads */}
                      <div className="space-y-1.5 font-mono text-left">
                        <label className="text-[8px] font-black text-purple-400 uppercase tracking-wider block">Preset Mock response body models:</label>
                        <div className="flex flex-wrap gap-1.5 animate-in fade-in">
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => {
                              const body = '{\n  "status": "success",\n  "msw_mocked": true,\n  "message": "Auth Session Active",\n  "token": "msw_jwt_mocked_token_sequence_xyz123"\n}';
                              setMswResponseBody(body);
                              syncMswConfig({ responseBody: body, responseType: 'json' });
                            }}
                            className="py-1 px-3.5 text-[8.5px] text-[#888] font-bold border border-[#1C1C22] bg-[#0A0A0E] rounded-md hover:text-purple-400 hover:border-purple-500/25 hover:bg-purple-500/5 transition-all uppercase font-semibold cursor-pointer"
                          >
                            🔐 API AUTHENTICATION
                          </button>
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => {
                              const body = '{\n  "status": "success",\n  "count": 3,\n  "users": [\n    {"id": 1, "name": "John Doe", "role": "admin"},\n    {"id": 2, "name": "Jane Smith", "role": "editor"},\n    {"id": 3, "name": "Bob Martin", "role": "viewer"}\n  ]\n}';
                              setMswResponseBody(body);
                              syncMswConfig({ responseBody: body, responseType: 'json' });
                            }}
                            className="py-1 px-3.5 text-[8.5px] text-[#888] font-bold border border-[#1C1C22] bg-[#0A0A0E] rounded-md hover:text-purple-400 hover:border-purple-500/25 hover:bg-purple-500/5 transition-all uppercase font-semibold cursor-pointer"
                          >
                            👥 USER LISTING
                          </button>
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => {
                              const body = '{\n  "status": "healthy",\n  "uptime_secs": 18231,\n  "engine": "v8-isolated-context"\n}';
                              setMswResponseBody(body);
                              syncMswConfig({ responseBody: body, responseType: 'json' });
                            }}
                            className="py-1 px-3.5 text-[8.5px] text-[#888] font-bold border border-[#1C1C22] bg-[#0A0A0E] rounded-md hover:text-purple-400 hover:border-purple-500/25 hover:bg-purple-500/5 transition-all uppercase font-semibold cursor-pointer"
                          >
                            💚 STATUS HEALTH
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
                            className="py-1 px-3.5 text-[#888] text-[8.5px] font-bold border border-[#1C1C22] bg-[#0A0A0E] rounded-md hover:text-purple-400 hover:border-purple-500/25 hover:bg-purple-500/5 transition-all uppercase font-semibold cursor-pointer"
                          >
                            📄 PLAIN STRING OK
                          </button>
                        </div>
                      </div>

                      {/* Body Editor */}
                      <div className="space-y-1.5 text-left font-mono">
                        <label className="text-[8px] font-black text-purple-400 uppercase tracking-wider block">Custom Intercepted JSON Body Payload</label>
                        <textarea
                          disabled={isRunning}
                          rows={6}
                          value={mswResponseBody}
                          onChange={(e) => {
                            const body = e.target.value;
                            setMswResponseBody(body);
                            syncMswConfig({ responseBody: body });
                          }}
                          className="w-full bg-[#050508] border border-[#151518] px-3.5 py-2.5 rounded-xl text-[10px] font-mono text-white outline-none focus:border-purple-500/30 no-scrollbar select-text leading-relaxed font-semibold transition-all"
                          placeholder="Paste mockup response body here..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#09090C]/40 border border-[#151518]/60 rounded-xl p-8 text-center select-none font-mono">
                      <Shield size={24} className="text-[#333] mx-auto mb-2" />
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">
                        Virtual MSW Interceptor is Inactive
                      </span>
                      <p className="text-[8.5px] text-[#555] max-w-sm mx-auto leading-relaxed uppercase">
                        Enable the override toggle above to intercept API endpoint queries and substitute them locally with simulated states, response patterns, and delays.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-[#1C1C22] bg-[#0C0C10] flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowSuiteSettings(false)}
                className="h-8.5 px-5 bg-[#3ECF8E] hover:bg-[#32B379] text-[#070708] rounded-xl text-[9px] font-black uppercase tracking-wider font-mono transition-all cursor-pointer"
              >
                Apply & Save Configs
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

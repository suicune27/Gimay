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
import { Collection, RequestData } from '../types';

interface SmokeSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const SmokeSuiteModal: React.FC<SmokeSuiteModalProps> = ({ isOpen, onClose }) => {
  const { 
    collections, 
    environments, 
    activeEnvId, 
    addToast 
  } = useStore();

  // Core setup states
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [threads, setThreads] = useState(3);
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

  const renderLatencyGraph = () => {
    // Slice to the last 300 samples for the graph to prevent SVG layout lagging and stack overflows
    const graphSamples = samples.slice(-300);
    const hasData = graphSamples.length > 0;
    
    // Safely compute max and min without stack overflow-prone spread operator (...)
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
      <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-black text-[#E0E0E6] uppercase tracking-wider block font-mono">Response Time Telemetry Curve</span>
            <span className="text-[8px] text-[#55555C] font-mono block">Real-time latency fluctuation over the last 300 cycles</span>
          </div>
          <span className={cn(
            "text-[8px] font-mono uppercase font-black px-2.5 py-0.5 rounded border transition-all",
            hasData 
              ? "text-[#3ECF8E] bg-[#3ECF8E]/10 border-[#3ECF8E]/25 animate-pulse" 
              : "text-[#555] bg-[#101015] border-[#222]"
          )}>
            {hasData ? 'LIVE Sparkline' : 'STANDBY MODE'}
          </span>
        </div>
        
        <div 
          ref={chartContainerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "relative w-full h-[180px] bg-[#030305] rounded-xl overflow-hidden border border-[#151518]/60 flex items-center justify-center select-none transition-all",
            isRunning ? "cursor-not-allowed opacity-90" : "cursor-crosshair"
          )}
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
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3ECF8E" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#3ECF8E" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                
                {/* Horizontal grid lines */}
                <line x1="0" y1="3" x2="100" y2="3" stroke="#121217" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="#121217" strokeWidth="0.5" strokeDasharray="2,2" />
                <line x1="0" y1="97" x2="100" y2="97" stroke="#121217" strokeWidth="0.5" strokeDasharray="2,2" />
                
                {areaD && <path d={areaD} fill="url(#chartGradient)" />}
                
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

  // Execution Loop
  const executeSmokeSuite = async () => {
    if (isRunning || selectedRequestIds.length === 0) return;

    const targets = flatRequestsList
      .filter(item => selectedRequestIds.includes(item.request.id))
      .map(item => item.request);

    if (targets.length === 0) return;

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

    const totalRequests = threads * loops;
    const isLargeRun = true;
    let completedCount = 0;
    let totalLatency = 0;
    let minLatencyVal = Infinity;
    let maxLatencyVal = -Infinity;
    let successCount = 0;

    const startTime = performance.now();
    let lastUiUpdateTime = startTime;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const runWorker = async (workerId: number) => {
      for (let i = 0; i < loops; i++) {
        if (!isRunningRef.current) break;

        if (delay > 0 && i > 0) {
          await sleep(delay);
        }

        // Get target request in round-robin fashion distributed uniformly across threads
        const currentReqOffset = (workerId + i) % targets.length;
        const baseRequest = targets[currentReqOffset];
        
        const sampleStartTime = performance.now();
        let status: number | string = 0;
        let success = false;
        let errorMsg = '';
        let resolvedResponseBody = '';
        let requestToExecute = baseRequest;

        try {
          // Build variable context resolving active environment selection
          const activeCollection = collections.find(c => c.id === baseRequest.collection_id);
          const threadVariables = VariableService.getResolvedVariableMap({
            environments,
            activeEnvId: selectedEnvId,
            collection: activeCollection || null,
            variables: {}
          });
          const variableContext = {
            environments,
            activeEnvId: selectedEnvId,
            collections,
            collection: activeCollection || null,
            variables: threadVariables
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

          // Pre-request scripts pipeline
          const preScripts = [
            activeEnvironment?.pre_request_script,
            activeCollection?.pre_request_script,
            suitePreScript, // <-- Suite level pre-request script
            runRequestScripts && requestToExecute.pre_request_script
          ].filter(Boolean) as string[];

          const preRequestOut = await ScriptService.executePreRequest(
            preScripts,
            requestToExecute,
            variableContext
          );
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

          // Execute Request
          const response = await RequestService.execute(requestToExecute, variableContext);
          if (isLargeRun) {
            resolvedResponseBody = '[Detailed payload logging suspended for memory optimization]';
          } else {
            resolvedResponseBody = logPayloads ? response.body : '[Payload logging disabled]';
          }

          // Post-request scripts pipeline
          const testScripts = [
            activeEnvironment?.test_script,
            activeCollection?.test_script,
            suiteTestScript, // <-- Suite level test script
            runRequestScripts && requestToExecute.test_script
          ].filter(Boolean) as string[];

          const testOut = await ScriptService.executeTests(
            testScripts,
            response,
            requestToExecute,
            variableContext
          );

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

        const newSample = {
          id: completedCount,
          timestamp: new Date().toLocaleTimeString(),
          latency: duration,
          status,
          success,
          error: errorMsg || undefined,
          requestName: baseRequest.name,
          requestMethod: baseRequest.method,
          // Capture complete transmission diagnostics safely stringified
          requestUrl: requestToExecute.url,
          requestPayload: isLargeRun
            ? '[Detailed payload logging suspended for memory optimization]'
            : (logPayloads ? safeStringify(requestToExecute.body) : '[Payload logging disabled]'),
          responseBody: isLargeRun
            ? '[Detailed payload logging suspended for memory optimization]'
            : (resolvedResponseBody ? safeStringify(resolvedResponseBody) : undefined)
        };

        allSamplesRef.current.push(newSample);

        // Memory optimization: if samples exceed 1000 items, clear heavy payload details from older entries in O(1) time
        if (allSamplesRef.current.length > 1000) {
          const oldSampleIndex = allSamplesRef.current.length - 1001;
          const oldSample = allSamplesRef.current[oldSampleIndex];
          if (oldSample && (oldSample.requestPayload !== '[Payload cleared to optimize memory]' || oldSample.responseBody !== '[Payload cleared to optimize memory]')) {
            allSamplesRef.current[oldSampleIndex] = {
              ...oldSample,
              requestPayload: '[Payload cleared to optimize memory]',
              responseBody: '[Payload cleared to optimize memory]'
            };
          }
        }

        // Throttle UI rendering refresh for high performance
        const now = performance.now();
        if (now - lastUiUpdateTime > 350 || completedCount === totalRequests) {
          lastUiUpdateTime = now;

          const avg = Math.round(totalLatency / completedCount);
          const succRate = Math.round((successCount / completedCount) * 100);

          // Keep React state weightless and eliminate massive nested payload string diffs
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
          setMinLatency(minLatencyVal);
          setMaxLatency(maxLatencyVal);
          setSuccessRate(succRate);

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
    }
  };

  const abortSuite = () => {
    isRunningRef.current = false;
    setIsRunning(false);
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
      s.timestamp,
      `"${s.requestName.replace(/"/g, '""')}"`,
      s.requestMethod,
      `"${(s.requestUrl || '').replace(/"/g, '""')}"`,
      s.latency,
      s.status,
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[85vh] bg-[#070708] border border-[#151518] rounded-2xl flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-200">
        
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
            <div className="p-6 border-b border-[#151518] bg-[#070709] grid grid-cols-9 gap-4 relative">
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


              {/* Progress visual bar */}
              {isRunning && (
                <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-[9px] font-black text-[#555] uppercase tracking-wider font-mono">
                    <span>Progress telemetry</span>
                    <span>{progress}% Completed ({allSamplesRef.current.length} / {threads * loops})</span>
                  </div>
                  <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-white/[0.02]">
                    <div
                      style={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r from-[#3ECF8E] via-blue-500 to-indigo-600 transition-all duration-200 shadow-[0_0_12px_#3ECF8E]"
                    />
                  </div>
                </div>
              )}

              <div className="bg-[#09090D] border border-[#15151A] rounded-2xl p-4 flex items-start gap-3.5 relative overflow-hidden select-none">
                <Activity size={15} className="text-[#3ECF8E] shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-0.5">
                  <h4 className="text-[10px] font-black text-[#3ECF8E] uppercase tracking-wider font-mono">
                    Telemetry Graph Optimization Active
                  </h4>
                  <p className="text-[9px] text-[#88888F] font-mono leading-relaxed uppercase tracking-tight">
                    Detailed request/response body logging is disabled by default. The suite is optimized to map response time curves (the telemetry graph) in real-time, reducing browser memory usage and preventing performance bottlenecks.
                  </p>
                </div>
              </div>

              {/* Real-time telemetry graph rendering */}
              <div className="w-full">
                {renderLatencyGraph()}
              </div>

            </div>

            {/* Bottom active deploy bar */}
            <div className="px-6 py-4 border-t border-[#151518] bg-[#070709] flex justify-between items-center shrink-0">
              <span className="text-[10px] text-[#555] font-mono">
                {selectedRequestIds.length === 0 
                  ? 'SELECT TARGET SCENARIOS TO ENERGIZE RUNNER' 
                  : `READY TO DEPLOY ${selectedRequestIds.length} SCENARIOS &bull; ${threads * loops} TOTAL REQUESTS`}
              </span>
              
              <div className="flex items-center gap-3">
                {isRunning ? (
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
    </div>
  );
};

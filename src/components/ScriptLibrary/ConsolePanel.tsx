import React, { useState, useMemo } from 'react';
import { Terminal, Trash2, ChevronUp, ChevronDown, Search, Copy, Maximize2, Minimize2, Check, AlertTriangle, AlertCircle, Info, Sparkles } from 'lucide-react';
import { useScriptStore } from '../../store/scriptStore';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

export const ConsolePanel: React.FC = () => {
  const { logs, clearLogs, isConsoleOpen, setConsoleOpen } = useScriptStore();
  const { addToast } = useStore();
  
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'success' | 'info'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Filter and search logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesFilter = filter === 'all' || log.level === filter;
      const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            log.level.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [logs, filter, searchQuery]);

  const handleCopyLogs = () => {
    if (filteredLogs.length === 0) return;
    const text = filteredLogs.map(l => `[${format(l.timestamp, 'HH:mm:ss.SSS')}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    addToast({ type: 'success', message: 'All filtered logs archived to clipboard' });
  };

  const handleCopySingleLog = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    addToast({ type: 'success', message: 'Log row copied' });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!isConsoleOpen) return (
    <button 
      onClick={() => setConsoleOpen(true)}
      className="h-9 bg-surface/90 backdrop-blur-md border-t border-subtle flex items-center px-4 gap-3 text-[9px] font-black text-muted hover:text-brand hover:bg-elevated/80 transition-all uppercase tracking-[0.25em] w-full border-x border-subtle rounded-t-xl group shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
    >
      <div className="relative">
        <Terminal size={13} className="text-brand group-hover:animate-pulse" />
        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
      </div>
      <span className="font-mono">Node Terminal Console</span>
      
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand/5 border border-brand/10 ml-2">
        <span className="w-1 h-1 rounded-full bg-brand animate-pulse" />
        <span className="text-[7px] text-brand/70 font-mono tracking-normal uppercase">Active</span>
      </div>

      <span className="ml-auto font-mono text-[8px] bg-elevated border border-[#2a2a2a] px-2 py-0.5 rounded text-muted shadow-inner">{logs.length} EVENTS</span>
      <ChevronUp size={14} className="opacity-40 group-hover:opacity-100 group-hover:translate-y-[-1px] transition-all" />
    </button>
  );

  return (
    <div 
      className={cn(
        "bg-[#070708]/95 backdrop-blur-xl border-t border-[#1C1C1E] flex flex-col transition-all duration-300 ease-in-out border-x rounded-t-xl shadow-[0_-10px_40px_rgba(0,0,0,0.6)] overflow-hidden relative",
        isExpanded ? "h-[500px]" : "h-72"
      )}
    >
      {/* State-of-the-art futuristic grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_4px] pointer-events-none opacity-50 z-10" />

      {/* Terminal Header */}
      <div className="h-10 border-b border-[#1C1C1E] flex items-center justify-between px-3 shrink-0 bg-surface/90 z-20">
        <div className="flex items-center gap-4 flex-1">
          {/* Badge */}
          <div className="flex items-center gap-2 text-[9px] font-black text-muted uppercase tracking-[0.2em] font-mono">
            <div className="relative flex items-center justify-center">
              <Terminal size={12} className="text-brand drop-shadow-[0_0_4px_#3ECF8E]" />
            </div>
            Node Execution Thread
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-brand/10 border border-brand/20 shadow-[0_0_8px_rgba(62,207,142,0.15)]">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shadow-[0_0_6px_#3ECF8E]" />
            <span className="text-[7px] font-black text-brand uppercase tracking-widest font-mono">LIVE UPLINK</span>
          </div>

          {/* Filters */}
          <div className="hidden lg:flex items-center gap-1 ml-4 bg-elevated border border-subtle p-0.5 rounded-lg shadow-inner">
            {(['all', 'success', 'info', 'warn', 'error'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={cn(
                  "px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider font-mono rounded transition-all",
                  filter === lvl 
                    ? "bg-brand/10 text-brand border border-brand/20 shadow-[0_0_10px_rgba(62,207,142,0.1)]" 
                    : "text-[#55555C] hover:text-muted border border-transparent"
                )}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Console Search & Actions */}
        <div className="flex items-center gap-2 z-20">
          {/* Search Logs */}
          <div className="relative w-40 sm:w-48">
            <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
            <input 
              type="text"
              placeholder="FILTER PACKETS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-subtle rounded-lg pl-8 pr-2 py-1 text-[8px] font-mono text-main placeholder:text-dim focus:border-brand/40 focus:outline-none focus:ring-1 focus:ring-[#3ECF8E]/25 transition-all shadow-inner"
            />
          </div>

          {/* Action Separator */}
          <div className="w-px h-4 bg-[#1C1C1E] mx-1" />

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button 
              onClick={handleCopyLogs}
              disabled={filteredLogs.length === 0}
              className="p-1.5 text-muted hover:text-brand hover:bg-elevated disabled:opacity-30 disabled:hover:text-muted rounded-lg border border-transparent hover:border-strong transition-all"
              title="Copy Output Logs"
            >
              <Copy size={11} />
            </button>
            <button 
              onClick={clearLogs}
              className="p-1.5 text-muted hover:text-red-400 hover:bg-elevated rounded-lg border border-transparent hover:border-strong transition-all"
              title="Wipe Memory Logs"
            >
              <Trash2 size={11} />
            </button>
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-muted hover:text-main hover:bg-elevated rounded-lg border border-transparent hover:border-strong transition-all"
              title={isExpanded ? "Collapse View" : "Maximize View"}
            >
              {isExpanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            </button>
            <div className="w-px h-4 bg-[#1C1C1E] mx-0.5" />
            <button 
              onClick={() => setConsoleOpen(false)}
              className="p-1.5 text-muted hover:text-main hover:bg-elevated rounded-lg border border-transparent hover:border-strong transition-all"
              title="Close Panel"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto font-mono text-[10px] selection:bg-brand/20 custom-scrollbar bg-deep/95 z-20 pb-4">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center relative py-12">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(62,207,142,0.03),transparent_70%)] pointer-events-none" />
            <div className="w-10 h-10 rounded-xl bg-elevated border border-subtle flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(0,0,0,0.8)] text-brand relative">
              <Terminal size={18} className="animate-pulse" />
              <div className="absolute inset-0 rounded-xl border border-brand/20 animate-ping opacity-25" />
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-dim font-mono">SYS-READY // AWAITING STREAM</p>
            <span className="text-[7px] text-[var(--border-strong)] uppercase mt-1 font-mono">Listening on Sector 7 • zero faults</span>
          </div>
        ) : (
          <div className="divide-y divide-[#131316]">
            {filteredLogs.map((log, index) => {
              const formattedTime = format(log.timestamp, 'HH:mm:ss.SSS');
              const isErr = log.level === 'error';
              const isWarn = log.level === 'warn';
              const isSucc = log.level === 'success';
              
              return (
                <div 
                  key={log.id} 
                  className={cn(
                    "flex gap-0 group border-l-2 transition-all duration-150 relative items-stretch hover:bg-elevated",
                    isErr ? "border-red-500/60 hover:bg-red-950/5" :
                    isWarn ? "border-yellow-500/60 hover:bg-yellow-950/5" :
                    isSucc ? "border-brand/60 hover:bg-brand/5" : "border-[#3A3A3C]/40"
                  )}
                >
                  {/* Timestamp col */}
                  <div className="px-3.5 py-2 text-dim shrink-0 tabular-nums font-bold text-[8.5px] border-r border-subtle bg-surface/50 flex items-center justify-center min-w-[90px] select-none">
                    {formattedTime}
                  </div>

                  {/* Level Indicator Badge */}
                  <div className="px-3 py-2 flex items-center gap-2 shrink-0 select-none">
                    <span className={cn(
                      "w-2 h-2 rounded-full flex items-center justify-center",
                      isErr ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                      isWarn ? "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" :
                      isSucc ? "bg-brand shadow-[0_0_8px_rgba(62,207,142,0.5)]" : "bg-[#6E6E73]"
                    )} />
                    <span className={cn(
                      "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border font-mono min-w-[50px] text-center",
                      isErr ? "bg-red-500/10 border-red-500/20 text-red-400" :
                      isWarn ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" :
                      isSucc ? "bg-brand/10 border-brand/20 text-brand" :
                      "bg-[#8E8E93]/10 border-[#8E8E93]/20 text-muted"
                    )}>
                      {log.level}
                    </span>
                  </div>

                  {/* Log Content */}
                  <div className="flex-1 px-3 py-2 flex items-center min-w-0 pr-12">
                    <span className={cn(
                      "break-all leading-normal font-semibold tracking-wide font-mono",
                      isErr ? "text-red-300" :
                      isWarn ? "text-yellow-200" :
                      isSucc ? "text-main" : "text-[#A1A1AA]"
                    )}>
                      {log.message}
                    </span>
                  </div>

                  {/* Floating Action Button (Row Copy) */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-150">
                    <button
                      onClick={() => handleCopySingleLog(`[${formattedTime}] [${log.level.toUpperCase()}] ${log.message}`, index)}
                      className="p-1 bg-elevated border border-strong text-muted hover:text-main rounded hover:bg-subtle transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                      title="Copy Row"
                    >
                      {copiedIndex === index ? <Check size={10} className="text-brand" /> : <Copy size={10} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

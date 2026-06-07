import React from 'react';
import { Terminal, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useScriptStore } from '../../store/scriptStore';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

export const ConsolePanel: React.FC = () => {
  const { logs, clearLogs, isConsoleOpen, setConsoleOpen } = useScriptStore();

  if (!isConsoleOpen) return (
    <button 
      onClick={() => setConsoleOpen(true)}
      className="h-7 bg-deep border-t border-subtle flex items-center px-3 gap-2 text-[9px] font-black text-dim hover:text-muted hover:bg-white/[0.02] transition-all uppercase tracking-[0.2em]"
    >
      <Terminal size={12} className="text-[var(--brand)]" />
      Terminal Console
      <div className="flex gap-1 ml-2">
        <span className="w-1 h-1 rounded-full bg-[var(--brand)] opacity-40" />
        <span className="w-1 h-1 rounded-full bg-[var(--brand)] opacity-20" />
      </div>
      <span className="ml-auto tabular-nums bg-white/5 px-1.5 py-0.5 rounded text-[8px] text-dim">{logs.length}</span>
      <ChevronUp size={12} className="ml-1 opacity-40" />
    </button>
  );

  return (
    <div className="h-64 bg-deep border-t border-subtle flex flex-col animate-in slide-in-from-bottom duration-200">
      <div className="h-8 border-b border-subtle flex items-center justify-between px-2 shrink-0 bg-header">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[8px] font-black text-muted uppercase tracking-[0.2em] ml-1">
            <Terminal size={10} className="text-[var(--brand)]" />
            Node Execution Thread
          </div>
          <div className="flex items-center gap-1 opacity-20">
            <div className="w-1 h-1 rounded-full bg-red-500" />
            <div className="w-1 h-1 rounded-full bg-[var(--brand)]" />
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="px-1.5 text-[8px] font-mono text-dim tabular-nums mr-2">
            {logs.length} EVENTS LOADED
          </div>
          <button 
            onClick={clearLogs}
            className="p-1 text-dim hover:text-white hover:bg-white/5 rounded transition-all"
            title="Wipe Logs"
          >
            <Trash2 size={10} />
          </button>
          <div className="w-px h-3 bg-elevated mx-1" />
          <button 
            onClick={() => setConsoleOpen(false)}
            className="p-1 text-dim hover:text-white hover:bg-white/5 rounded transition-all"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-[10px] selection:bg-[var(--brand)]/20 custom-scrollbar bg-black/40">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-5 grayscale">
            <Terminal size={20} className="mb-2" />
            <p className="text-[8px] font-black uppercase tracking-[0.4em]">Ready - Awaiting Uplink</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.02]">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-0 hover:bg-white/[0.02] transition-colors group border-white/[0.01]">
                <div className="px-3 py-1 text-dim shrink-0 tabular-nums font-medium text-[9px] border-r border-white/[0.02] bg-white/[0.01] flex items-center justify-center min-w-[85px]">
                  {format(log.timestamp, 'HH:mm:ss.SSS')}
                </div>
                <div className="flex-1 flex gap-3 px-3 py-1 items-start min-w-0">
                  <span className={cn(
                    "shrink-0 w-1.5 h-1.5 rounded-full mt-1",
                    log.level === 'error' ? 'bg-red-500' :
                    log.level === 'warn' ? 'bg-yellow-500' :
                    log.level === 'success' ? 'bg-[var(--brand)]' : 'bg-[#333333]'
                  )} />
                  <span className={cn(
                    "flex-1 break-all leading-tight font-medium",
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warn' ? 'text-yellow-400' :
                    log.level === 'success' ? 'text-[var(--brand)]' : 'text-muted'
                  )}>
                    {log.message}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

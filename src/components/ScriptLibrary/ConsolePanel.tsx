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
      className="h-7 bg-[#0A0A0A] border-t border-[#1A1A1A] flex items-center px-3 gap-2 text-[9px] font-black text-[#555555] hover:text-[#AAAAAA] hover:bg-white/[0.02] transition-all uppercase tracking-[0.2em]"
    >
      <Terminal size={12} className="text-[#3ECF8E]" />
      Terminal Console
      <div className="flex gap-1 ml-2">
        <span className="w-1 h-1 rounded-full bg-[#3ECF8E] opacity-40" />
        <span className="w-1 h-1 rounded-full bg-[#3ECF8E] opacity-20" />
      </div>
      <span className="ml-auto tabular-nums bg-white/5 px-1.5 py-0.5 rounded text-[8px] text-[#444444]">{logs.length}</span>
      <ChevronUp size={12} className="ml-1 opacity-40" />
    </button>
  );

  return (
    <div className="h-64 bg-[#0A0A0A] border-t border-[#1A1A1A] flex flex-col animate-in slide-in-from-bottom duration-200">
      <div className="h-8 border-b border-[#1A1A1A] flex items-center justify-between px-2 shrink-0 bg-[#0F0F0F]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[8px] font-black text-[#666666] uppercase tracking-[0.2em] ml-1">
            <Terminal size={10} className="text-[#3ECF8E]" />
            Node Execution Thread
          </div>
          <div className="flex items-center gap-1 opacity-20">
            <div className="w-1 h-1 rounded-full bg-red-500" />
            <div className="w-1 h-1 rounded-full bg-[#3ECF8E]" />
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="px-1.5 text-[8px] font-mono text-[#444444] tabular-nums mr-2">
            {logs.length} EVENTS LOADED
          </div>
          <button 
            onClick={clearLogs}
            className="p-1 text-[#555555] hover:text-white hover:bg-white/5 rounded transition-all"
            title="Wipe Logs"
          >
            <Trash2 size={10} />
          </button>
          <div className="w-px h-3 bg-[#1A1A1A] mx-1" />
          <button 
            onClick={() => setConsoleOpen(false)}
            className="p-1 text-[#555555] hover:text-white hover:bg-white/5 rounded transition-all"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto font-mono text-[10px] selection:bg-[#3ECF8E]/20 custom-scrollbar bg-black/40">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-5 grayscale">
            <Terminal size={20} className="mb-2" />
            <p className="text-[8px] font-black uppercase tracking-[0.4em]">Ready - Awaiting Uplink</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.02]">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-0 hover:bg-white/[0.02] transition-colors group border-white/[0.01]">
                <div className="px-3 py-1 text-[#333333] shrink-0 tabular-nums font-medium text-[9px] border-r border-white/[0.02] bg-white/[0.01] flex items-center justify-center min-w-[85px]">
                  {format(log.timestamp, 'HH:mm:ss.SSS')}
                </div>
                <div className="flex-1 flex gap-3 px-3 py-1 items-start min-w-0">
                  <span className={cn(
                    "shrink-0 w-1.5 h-1.5 rounded-full mt-1",
                    log.level === 'error' ? 'bg-red-500' :
                    log.level === 'warn' ? 'bg-yellow-500' :
                    log.level === 'success' ? 'bg-[#3ECF8E]' : 'bg-[#333333]'
                  )} />
                  <span className={cn(
                    "flex-1 break-all leading-tight font-medium",
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warn' ? 'text-yellow-400' :
                    log.level === 'success' ? 'text-[#3ECF8E]' : 'text-[#888888]'
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

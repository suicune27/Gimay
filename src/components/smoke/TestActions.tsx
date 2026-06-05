import React from 'react';
import { Play, Square, Download } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TestActionsProps {
  isCleaning: boolean;
  isRunning: boolean;
  runnerMode: 'loop' | 'mot';
  onRun: () => void;
  onAbort: () => void;
  onExportJMX: () => void;
}

export const TestActions: React.FC<TestActionsProps> = ({
  isCleaning, isRunning, runnerMode, onRun, onAbort, onExportJMX,
}) => {
  return (
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
          onClick={onAbort}
          className="flex-1 h-11 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 rounded-xl text-[10px] font-black text-red-100 uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer font-mono"
        >
          <Square size={11} fill="currentColor" />
          Abort Smoke Run
        </button>
      ) : (
        <button
          onClick={onRun}
          className={cn(
            "flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer font-mono active:scale-95",
            runnerMode === 'mot'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:brightness-110'
              : 'bg-[#3ECF8E] text-black shadow-[0_0_15px_rgba(62,207,142,0.15)] hover:bg-[#34B37A]'
          )}
        >
          <Play size={11} fill="currentColor" />
          {runnerMode === 'mot' ? 'Initiate MoT Endurance Run' : 'Initiate Loops Smoke Test'}
        </button>
      )}

      <button
        onClick={onExportJMX}
        className="h-11 px-5 bg-[var(--bg-deep)] border border-[var(--border-subtle)] hover:border-[#3ECF8E]/30 rounded-xl text-[10px] font-black text-[var(--text-dim)] hover:text-[#3ECF8E] uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer"
      >
        <Download size={13} />
        Export JMX
      </button>
    </div>
  );
};

import React from 'react';
import { cn } from '../../lib/utils';
import { isElectron } from '../../lib/platform';

interface MotStabilizerPanelProps {
  memoryPressure: number;
  stabilityScore: number;
  guardStatus: 'SAFE' | 'THROTTLED' | 'CRITICAL';
  activePriorityFocus: 'P0' | 'P1' | 'P2' | 'P3' | 'ALL';
  adaptiveThrottle: number;
  crashPreventionTriggers: number;
}

export const MotStabilizerPanel: React.FC<MotStabilizerPanelProps> = ({
  memoryPressure,
  stabilityScore,
  guardStatus,
  activePriorityFocus,
  adaptiveThrottle,
  crashPreventionTriggers,
}) => {
  return (
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
  );
};

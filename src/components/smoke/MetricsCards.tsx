import React from 'react';
import { Activity, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

interface MetricsCardsProps {
  throughput: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  successRate: number;
  memoryPressure: number;
  isMemoryCooling: boolean;
  memoryCoolingCount: number;
  isCleaning: boolean;
  cleaningStatus: string;
  isRunning: boolean;
  progress: number;
  runnerMode: 'loop' | 'mot';
  completedCount: number;
  threads: number;
  loops: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  throughput,
  avgLatency,
  minLatency,
  maxLatency,
  successRate,
  memoryPressure,
  isMemoryCooling,
  memoryCoolingCount,
  isCleaning,
  cleaningStatus,
  isRunning,
  progress,
  runnerMode,
  completedCount,
  threads,
  loops,
}) => {
  return (
    <>
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
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-bold font-mono ${
              successRate >= 95 ? "text-[#3ECF8E]" : successRate >= 80 ? "text-amber-500" : "text-red-500"
            }`}>{successRate}%</span>
            <span className="text-[10px] text-[#55555C] font-mono">pass</span>
          </div>
          {successRate >= 95 ? (
            <div className="absolute right-3 bottom-3 text-[#3ECF8E]/10"><CheckCircle2 size={32} /></div>
          ) : (
            <div className="absolute right-3 bottom-3 text-red-500/10"><AlertTriangle size={32} /></div>
          )}
        </div>

        <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 space-y-1.5 relative overflow-hidden">
          <span className="text-[9px] font-black text-[#55555C] uppercase tracking-wider block font-mono">Memory Pressure</span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-bold font-mono ${
              memoryPressure > 80 ? "text-red-500" : memoryPressure > 50 ? "text-amber-500" : "text-[#3ECF8E]"
            }`}>{memoryPressure}%</span>
            <span className="text-[10px] text-[#55555C] font-mono">heap</span>
          </div>
          <div className="absolute right-3 bottom-3 text-white/5"><Zap size={32} /></div>
        </div>
      </div>

      {/* Memory Cooling Warning */}
      {isMemoryCooling && (
        <div className="bg-[#09090B]/60 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-4 relative overflow-hidden animate-in slide-in-from-top-2 duration-300">
          <div className="shrink-0">
            <AlertTriangle size={20} className="text-amber-400 animate-pulse" />
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

      {/* Cleaning status */}
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

      {/* Progress bar */}
      {isRunning && (
        <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-[#3ECF8E]/20 border-t-[#3ECF8E] animate-spin shrink-0" />
            <span className="text-[9px] font-black text-white uppercase tracking-wider font-mono">Running</span>
          </div>
          <div className="text-[10px] font-black font-mono text-[#3ECF8E] animate-pulse">
            {runnerMode === 'mot'
              ? `${completedCount} requests sent`
              : `${completedCount} / ${threads * loops} sent`}
          </div>
        </div>
      )}
    </>
  );
};

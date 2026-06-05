import React from 'react';
import { motion } from 'motion/react';
import { Square, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RunningOverlayProps {
  isRunning: boolean;
  runnerMode: 'loop' | 'mot';
  progress: number;
  throughput: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  stabilityScore: number;
  memoryPressure: number;
  threads: number;
  loops: number;
  isMemoryCooling: boolean;
  completedCount: number;
  onAbort: () => void;
}

export const RunningOverlay: React.FC<RunningOverlayProps> = ({
  isRunning,
  runnerMode,
  progress,
  throughput,
  avgLatency,
  minLatency,
  maxLatency,
  stabilityScore,
  memoryPressure,
  threads,
  loops,
  isMemoryCooling,
  completedCount,
  onAbort,
}) => {
  if (!isRunning) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <motion.div
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg bg-[#09090C] border border-[#1C1C24] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
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

        <div className="p-6 space-y-6 bg-[#050508] text-center">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono text-[#55555C]">
              <span className="uppercase font-black text-left">Overall Suite Progress</span>
              <span className="text-[#3ECF8E] font-black">{progress}%</span>
            </div>
            <div className="w-full h-2.5 bg-black border border-[#111] rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-[#3ECF8E] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-[9px] text-[#88888F] font-mono text-center pt-0.5">
              {runnerMode === 'mot'
                ? `${completedCount} total transmissions processed`
                : `${completedCount} / ${threads * loops} transmissions sent`}
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="p-3 bg-black border border-[#15151A] rounded-xl flex flex-col justify-center relative overflow-hidden">
              <span className="text-[7.5px] font-black text-[#55555C] uppercase tracking-wider font-mono block">Throughput Rate</span>
              <span className="text-sm font-black font-mono text-white mt-0.5">{throughput} <span className="text-[8px] text-[#444] font-medium uppercase font-sans">Tx/Sec</span></span>
            </div>
            <div className="p-3 bg-black border border-[#15151A] rounded-xl flex flex-col justify-center relative overflow-hidden">
              <span className="text-[7.5px] font-black text-[#55555C] uppercase tracking-wider font-mono block">Stability Score</span>
              <span className={cn("text-sm font-black font-mono mt-0.5 block", stabilityScore > 85 ? "text-[#3ECF8E]" : stabilityScore > 50 ? "text-amber-500" : "text-red-500")}>{stabilityScore}%</span>
            </div>
            <div className="p-3 bg-black border border-[#15151A] rounded-xl flex flex-col justify-center relative overflow-hidden">
              <span className="text-[7.5px] font-black text-[#55555C] uppercase tracking-wider font-mono block">Average Latency</span>
              <span className="text-sm font-black font-mono text-white mt-0.5">{avgLatency} <span className="text-[8px] text-[#444] font-medium uppercase font-sans font-mono">ms</span></span>
            </div>
            <div className="p-3 bg-black border border-[#15151A] rounded-xl flex flex-col justify-center relative overflow-hidden">
              <span className="text-[7.5px] font-black text-[#55555C] uppercase tracking-wider font-mono block">Memory Pressure</span>
              <span className={cn("text-sm font-black font-mono mt-0.5 block", memoryPressure > 80 ? "text-red-500" : memoryPressure > 50 ? "text-amber-500" : "text-[#3ECF8E]")}>{memoryPressure}%</span>
            </div>
            <div className="p-3 bg-black border border-[#15151A] rounded-xl flex flex-col justify-center relative overflow-hidden col-span-2">
              <span className="text-[7.5px] font-black text-[#55555C] uppercase tracking-wider font-mono block">Active Threads</span>
              <span className="text-xs font-semibold font-mono text-[#E0E0E6] mt-0.5 uppercase">{threads} CONCURRENT {threads === 1 ? 'WORKER' : 'WORKER THREADS'} ACTIVE</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 border-t border-[#1C1C24] bg-[#0C0C10] flex justify-end">
          <button
            onClick={onAbort}
            className="w-full h-11 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] duration-100"
          >
            <Square size={12} fill="currentColor" /> Cancel Active Run
          </button>
        </div>
      </motion.div>
    </div>
  );
};

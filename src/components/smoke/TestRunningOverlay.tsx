import React from 'react';
import { Activity, Square, Shield, ShieldAlert } from 'lucide-react';

interface TestRunningOverlayProps {
  isRunning: boolean;
  runnerMode: 'loop' | 'mot';
  progress: number;
  memoryPressure: number;
  stabilityScore: number;
  isMemoryCooling: boolean;
  guardStatus: 'SAFE' | 'THROTTLED' | 'CRITICAL';
  completedCount: number;
  totalRequests: number;
  requestName: string;
  requestMethod: string;
  onAbort: () => void;
}

const ModernRadarLoader: React.FC = () => (
  <div className="relative w-full h-36 bg-black/40 border border-white/[0.03] rounded-2xl overflow-hidden flex items-center justify-center p-6 select-none">
    <div className="relative w-24 h-24 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full border border-dashed border-[#3ECF8E]/30 animate-[spin_10s_linear_infinite]" />
      <div className="absolute inset-3 rounded-full border-2 border-transparent border-t-[#3ECF8E] border-b-blue-500 animate-[spin_4s_linear_infinite]" />
      <div className="absolute inset-6 rounded-full border border-blue-400/20 animate-ping opacity-60" />
      <div className="absolute inset-9 rounded-full bg-gradient-to-tr from-[#3ECF8E]/20 to-blue-500/20 backdrop-blur-md border border-white/[0.08] shadow-[0_0_20px_rgba(62,207,142,0.25)] flex items-center justify-center">
        <Activity size={20} className="text-[#3ECF8E] animate-pulse" />
      </div>
      <div className="absolute w-2 h-2 bg-[#3ECF8E] rounded-full shadow-[0_0_8px_#3ECF8E] animate-[orbit_3s_linear_infinite]" />
      <div className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_6px_#60A5FA] animate-[orbit_3s_linear_infinite_1.5s]" />
    </div>
    <style>{`
      @keyframes orbit {
        0% { transform: rotate(0deg) translateX(45px) rotate(0deg); }
        100% { transform: rotate(360deg) translateX(45px) rotate(-360deg); }
      }
    `}</style>
  </div>
);

export const TestRunningOverlay: React.FC<TestRunningOverlayProps> = ({
  isRunning, runnerMode, progress, memoryPressure, stabilityScore,
  isMemoryCooling, guardStatus, completedCount, totalRequests,
  requestName, requestMethod, onAbort,
}) => {
  if (!isRunning) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 select-none">
      <div className="max-w-md w-full bg-[#0a0a0f] border border-white/[0.06] rounded-2xl p-8 space-y-6 shadow-2xl flex flex-col items-center text-center animate-in fade-in duration-200">
        <ModernRadarLoader />

        <div className="space-y-2 w-full">
          <h3 className="text-[10px] font-black text-[#555] uppercase tracking-widest font-mono">
            {runnerMode === 'mot' ? 'Minutes of Testing (MoT) Endurance Active' : 'Loop-based Smoke Test Active'}
          </h3>

          {runnerMode === 'loop' ? (
            <div className="text-2xl font-black text-[#3ECF8E] font-mono animate-pulse">
              {completedCount} / {totalRequests} Sent
            </div>
          ) : (
            <div className="space-y-3 w-full">
              <div className="text-2xl font-black text-amber-500 font-mono animate-pulse">
                {completedCount} Requests Sent
              </div>
              <div className="grid grid-cols-2 gap-3 bg-white/[0.02] p-3 border border-white/[0.04] rounded-xl text-left">
                <div className="space-y-1">
                  <span className="text-[8px] font-bold text-[#555] uppercase tracking-wider block">Heap Pressure</span>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-[12px] font-bold font-mono ${memoryPressure > 75 ? 'text-red-400' : 'text-green-400'}`}>
                      {memoryPressure}%
                    </span>
                    <span className="text-[7px] text-[#444] font-mono">limit</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-bold text-[#555] uppercase tracking-wider block">Stability Score</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[12px] font-bold text-emerald-400 font-mono">{stabilityScore}/100</span>
                  </div>
                </div>
              </div>
              {isMemoryCooling && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center justify-center gap-1.5 animate-pulse">
                  <ShieldAlert size={11} className="text-red-400" />
                  <span className="text-[9px] font-black text-red-400 uppercase tracking-widest font-mono">
                    Memory Flush: Safe Cool-down...
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="w-full bg-[#18181f] rounded-full h-1.5 overflow-hidden border border-white/[0.02]">
            <div
              className={`h-full transition-all duration-300 ${runnerMode === 'mot' ? 'bg-amber-500' : 'bg-[#3ECF8E]'}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[9px] text-[#444] font-mono pt-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>

          <p className="text-[8px] text-[var(--text-dim)] uppercase tracking-tight font-mono mt-1">
            Target: {requestMethod} {requestName}
          </p>
        </div>

        <button
          onClick={onAbort}
          className="w-full h-10 bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 rounded-xl text-[9px] font-black text-red-400 uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 mt-2 font-mono"
        >
          <Square size={10} fill="currentColor" />
          Cancel Execution
        </button>
      </div>
    </div>
  );
};

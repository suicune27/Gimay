import React from 'react';
import { Activity } from 'lucide-react';

interface CleaningOverlayProps {
  isCleaning: boolean;
  cleaningStatus: string;
}

export const CleaningOverlay: React.FC<CleaningOverlayProps> = ({ isCleaning, cleaningStatus }) => {
  if (!isCleaning) return null;

  return (
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
  );
};

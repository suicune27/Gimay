import React from 'react';

interface MotConfigPanelProps {
  motDuration: number;
  motMaxReqPerMin: number;
  motMaxRetriesPerMin: number;
  isRunning: boolean;
  onDurationChange: (val: number) => void;
  onMaxReqChange: (val: number) => void;
  onMaxRetriesChange: (val: number) => void;
}

export const MotConfigPanel: React.FC<MotConfigPanelProps> = ({
  motDuration,
  motMaxReqPerMin,
  motMaxRetriesPerMin,
  isRunning,
  onDurationChange,
  onMaxReqChange,
  onMaxRetriesChange,
}) => {
  return (
    <div className="bg-[#09090B]/40 border border-[#151518] rounded-2xl p-5 grid grid-cols-3 gap-4 relative animate-in fade-in duration-200">
      {isRunning && (
        <div className="absolute inset-0 bg-transparent z-40 cursor-not-allowed" />
      )}
      <div className="space-y-1.5 col-span-1">
        <label className="text-[9px] font-black text-amber-500 uppercase tracking-wider font-mono block">Endurance Duration (sec)</label>
        <input
          type="number"
          disabled={isRunning}
          value={motDuration}
          min={10}
          max={3600}
          onChange={(e) => onDurationChange(Math.min(3600, Math.max(10, parseInt(e.target.value) || 120)))}
          className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-amber-500/30"
        />
        <p className="text-[8px] text-[#55555C] font-mono">Endurance window duration limit</p>
      </div>
      <div className="space-y-1.5 col-span-1">
        <label className="text-[9px] font-black text-amber-500 uppercase tracking-wider font-mono block">Max Requests / Min</label>
        <input
          type="number"
          disabled={isRunning}
          value={motMaxReqPerMin}
          min={10}
          max={10000}
          onChange={(e) => onMaxReqChange(Math.min(10000, Math.max(10, parseInt(e.target.value) || 600)))}
          className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-amber-500/30"
        />
        <p className="text-[8px] text-[#55555C] font-mono">Performance throughput budget limit</p>
      </div>
      <div className="space-y-1.5 col-span-1">
        <label className="text-[9px] font-black text-amber-500 uppercase tracking-wider font-mono block">Max Retries / Min</label>
        <input
          type="number"
          disabled={isRunning}
          value={motMaxRetriesPerMin}
          min={0}
          max={500}
          onChange={(e) => onMaxRetriesChange(Math.min(505, Math.max(0, parseInt(e.target.value) || 60)))}
          className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-amber-500/30"
        />
        <p className="text-[8px] text-[#55555C] font-mono">Resilience retry frequency ceiling</p>
      </div>
    </div>
  );
};

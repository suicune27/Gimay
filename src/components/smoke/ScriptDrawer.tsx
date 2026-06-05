import React from 'react';
import { Code, Shield } from 'lucide-react';

interface ScriptDrawerProps {
  showScriptDrawer: boolean;
  suitePreScript: string;
  suiteTestScript: string;
  isRunning: boolean;
  onToggle: () => void;
  onPreScriptChange: (val: string) => void;
  onTestScriptChange: (val: string) => void;
}

export const ScriptDrawer: React.FC<ScriptDrawerProps> = ({
  showScriptDrawer,
  suitePreScript,
  suiteTestScript,
  isRunning,
  onToggle,
  onPreScriptChange,
  onTestScriptChange,
}) => {
  return (
    <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-4 space-y-3 relative">
      {isRunning && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-30 flex items-center justify-center p-3 text-center gap-2 rounded-2xl select-none">
          <Shield className="text-amber-500/40" size={12} />
          <span className="text-[9px] font-mono font-black text-[#888] uppercase tracking-[0.2em]">Scripts Locked</span>
        </div>
      )}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-[10px] font-black text-amber-500 uppercase tracking-widest font-mono hover:text-amber-400 transition-colors"
      >
        <span className="flex items-center gap-1.5"><Code size={12} /> Dynamic Suite-Level Script Runners</span>
        <span className="text-[8px] border border-amber-500/30 px-1.5 py-0.5 rounded font-bold font-mono">
          {showScriptDrawer ? 'COLLAPSE CODE AREA' : 'EXPAND CODE AREA'}
        </span>
      </button>
      {showScriptDrawer && (
        <div className="grid grid-cols-2 gap-4 pt-2 animate-in fade-in duration-200">
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-[#555] uppercase block font-mono">Suite Pre-request Script (javascript)</label>
            <textarea
              value={suitePreScript}
              onChange={(e) => onPreScriptChange(e.target.value)}
              placeholder="// Modify or dynamically mock target requests before transmission..."
              className="w-full h-24 bg-[#050508] border border-[#151518] p-2.5 rounded-xl text-[9px] font-mono text-white outline-none focus:border-amber-500/30 resize-none font-normal"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-[#555] uppercase block font-mono">Suite Assertion Test Verification (javascript)</label>
            <textarea
              value={suiteTestScript}
              onChange={(e) => onTestScriptChange(e.target.value)}
              placeholder="// Execute test assertions on the responses returned..."
              className="w-full h-24 bg-[#050508] border border-[#151518] p-2.5 rounded-xl text-[9px] font-mono text-white outline-none focus:border-amber-500/30 resize-none font-normal"
            />
          </div>
        </div>
      )}
    </div>
  );
};

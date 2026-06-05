import React from 'react';
import { Shield } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RunConfigBarProps {
  selectedEnvId: string | null;
  environments: any[];
  threads: number;
  loops: number;
  delay: number;
  timeoutMs: number;
  stopOnFailure: boolean;
  runRequestScripts: boolean;
  sandboxEngine: 'in-thread' | 'worker';
  isRunning: boolean;
  onEnvChange: (id: string | null) => void;
  onThreadsChange: (val: number) => void;
  onLoopsChange: (val: number) => void;
  onDelayChange: (val: number) => void;
  onTimeoutChange: (val: number) => void;
  onStopOnFailureChange: (val: boolean) => void;
  onRunScriptsChange: (val: boolean) => void;
  onEngineChange: (val: 'in-thread' | 'worker') => void;
}

export const RunConfigBar: React.FC<RunConfigBarProps> = ({
  selectedEnvId,
  environments,
  threads,
  loops,
  delay,
  timeoutMs,
  stopOnFailure,
  runRequestScripts,
  sandboxEngine,
  isRunning,
  onEnvChange,
  onThreadsChange,
  onLoopsChange,
  onDelayChange,
  onTimeoutChange,
  onStopOnFailureChange,
  onRunScriptsChange,
  onEngineChange,
}) => {
  return (
    <div className="p-6 border-b border-[#151518] bg-[#070709] grid grid-cols-10 gap-4 relative">
      {isRunning && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-30 flex items-center justify-center p-4 text-center gap-2 select-none">
          <Shield className="text-[#3ECF8E]/40 animate-pulse" size={14} />
          <span className="text-[9px] font-mono font-black text-[#888] uppercase tracking-[0.2em]">Configuration Locked</span>
          <span className="text-[8px] font-mono text-[#555]">&bull; Smoke testing active run in progress</span>
        </div>
      )}

      <div className="space-y-1.5 col-span-2">
        <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono block">Environment</label>
        <select
          disabled={isRunning}
          value={selectedEnvId || ''}
          onChange={(e) => onEnvChange(e.target.value || null)}
          className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30 cursor-pointer"
        >
          <option value="">No Active Environment</option>
          {environments.map(env => (
            <option key={env.id} value={env.id}>{env.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5 col-span-1">
        <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono">Threads</label>
        <input
          type="number"
          min={1}
          max={20}
          disabled={isRunning}
          value={threads}
          onChange={(e) => onThreadsChange(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
          className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30"
        />
      </div>

      <div className="space-y-1.5 col-span-1">
        <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono">Loops</label>
        <input
          type="number"
          min={1}
          max={100}
          disabled={isRunning}
          value={loops}
          onChange={(e) => onLoopsChange(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
          className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30"
        />
      </div>

      <div className="space-y-1.5 col-span-1">
        <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono">Delay (ms)</label>
        <input
          type="number"
          disabled={isRunning}
          value={delay}
          onChange={(e) => onDelayChange(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30"
        />
      </div>

      <div className="space-y-1.5 col-span-1">
        <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono">Timeout (ms)</label>
        <input
          type="number"
          disabled={isRunning}
          value={timeoutMs}
          onChange={(e) => onTimeoutChange(Math.max(100, parseInt(e.target.value) || 100))}
          className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30"
        />
      </div>

      <div className="flex flex-col justify-center space-y-1.5 col-span-1 pl-2">
        <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono cursor-pointer select-none">Abort Fail</label>
        <label className="relative inline-flex items-center cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={stopOnFailure}
            disabled={isRunning}
            onChange={(e) => onStopOnFailureChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-8 h-4 bg-[#151518] rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-[#555] peer-checked:after:bg-[#3ECF8E] after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#3ECF8E]/10 border border-[#222] peer-checked:border-[#3ECF8E]/30" />
        </label>
      </div>

      <div className="flex flex-col justify-center space-y-1.5 col-span-1 pl-2">
        <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono cursor-pointer select-none">Run Scripts</label>
        <label className="relative inline-flex items-center cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={runRequestScripts}
            disabled={isRunning}
            onChange={(e) => onRunScriptsChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-8 h-4 bg-[#151518] rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-[#555] peer-checked:after:bg-[#3ECF8E] after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#3ECF8E]/10 border border-[#222] peer-checked:border-[#3ECF8E]/30" />
        </label>
      </div>

      <div className="space-y-1.5 col-span-1 pl-1">
        <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono block">Engine</label>
        <select
          disabled={isRunning}
          value={sandboxEngine}
          onChange={(e) => onEngineChange(e.target.value as 'in-thread' | 'worker')}
          className="w-full bg-[#050508] border border-[#151518] px-2.5 py-1.5 rounded-xl text-[10px] font-mono text-white outline-none focus:border-[#3ECF8E]/30 cursor-pointer"
        >
          <option value="in-thread">💨 IN-THREAD</option>
          <option value="worker">🔒 ISOLATED</option>
        </select>
      </div>

      <div className="flex flex-col justify-center space-y-1.5 col-span-1 pl-2 select-none">
        <label className="text-[9px] font-black text-[#55555C] uppercase tracking-wider font-mono">Telemetry</label>
        <span className="text-[7px] font-sans font-black text-[#3ECF8E] bg-[#3ECF8E]/10 border border-[#3ECF8E]/25 px-2 py-0.5 rounded-md uppercase tracking-wider text-center mt-1 w-min">
          Optimized
        </span>
      </div>
    </div>
  );
};

import React from 'react';

interface TestConfigProps {
  runnerMode: 'loop' | 'mot';
  isRunning: boolean;
  threads: number;
  loops: number;
  delay: number;
  timeoutMs: number;
  motDuration: number;
  motMaxReqPerMin: number;
  motMaxRetriesPerMin: number;
  sandboxEngine: 'in-thread' | 'worker';
  runRequestScripts: boolean;
  onThreadsChange: (val: number) => void;
  onLoopsChange: (val: number) => void;
  onDelayChange: (val: number) => void;
  onTimeoutChange: (val: number) => void;
  onMotDurationChange: (val: number) => void;
  onMotMaxReqChange: (val: number) => void;
  onMotMaxRetriesChange: (val: number) => void;
  onSandboxEngineChange: (val: 'in-thread' | 'worker') => void;
  onRunScriptsChange: (val: boolean) => void;
}

export const TestConfig: React.FC<TestConfigProps> = ({
  runnerMode, isRunning,
  threads, loops, delay, timeoutMs,
  motDuration, motMaxReqPerMin, motMaxRetriesPerMin,
  sandboxEngine, runRequestScripts,
  onThreadsChange, onLoopsChange, onDelayChange, onTimeoutChange,
  onMotDurationChange, onMotMaxReqChange, onMotMaxRetriesChange,
  onSandboxEngineChange, onRunScriptsChange,
}) => {
  return (
    <div className="bg-[#09090B]/30 border border-[#1C1C25]/40 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Concurrency (Threads)</label>
          <input
            type="number"
            disabled={isRunning}
            min={1} max={10}
            value={threads}
            onChange={(e) => onThreadsChange(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40"
          />
          <p className="text-[7px] text-[var(--text-dim)] uppercase tracking-tight font-semibold">Safe Cap: 10 Threads</p>
        </div>

        {runnerMode === 'loop' ? (
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Loops per Thread</label>
            <input
              type="number"
              disabled={isRunning}
              min={1} max={50}
              value={loops}
              onChange={(e) => onLoopsChange(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40"
            />
            <p className="text-[7px] text-[var(--text-dim)] uppercase tracking-tight font-semibold">Safe Cap: 50 Loops</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-amber-500 uppercase tracking-widest block font-mono">Endurance Duration (sec)</label>
            <input
              type="number"
              disabled={isRunning}
              min={10} max={3600}
              value={motDuration}
              onChange={(e) => onMotDurationChange(Math.min(3600, Math.max(10, parseInt(e.target.value) || 120)))}
              className="w-full bg-[var(--bg-deep)] border border-amber-500/20 px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-amber-500/40"
            />
            <p className="text-[7px] text-[#555] uppercase tracking-tight font-semibold">Safe ceiling: 3600s</p>
          </div>
        )}

        {runnerMode === 'loop' ? (
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Inter-Request Delay (ms)</label>
            <input
              type="number"
              disabled={isRunning}
              value={delay}
              onChange={(e) => onDelayChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40"
            />
            <p className="text-[7px] text-[var(--text-dim)] uppercase tracking-tight font-semibold">Delay between queries</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-[8px] font-black text-amber-500 uppercase tracking-widest block font-mono">Sandbox Engine</label>
            <select
              disabled={isRunning}
              value={sandboxEngine}
              onChange={(e) => onSandboxEngineChange(e.target.value as 'in-thread' | 'worker')}
              className="w-full bg-[var(--bg-deep)] border border-amber-500/25 px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-amber-500/40 cursor-pointer"
            >
              <option value="in-thread">💨 IN-THREAD (Fast)</option>
              <option value="worker">🔒 ISOLATED (Worker)</option>
            </select>
            <p className="text-[7px] text-[#555] uppercase tracking-tight font-semibold">Script context security</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Request Timeout (ms)</label>
          <input
            type="number"
            disabled={isRunning}
            value={timeoutMs}
            onChange={(e) => onTimeoutChange(Math.max(100, parseInt(e.target.value) || 100))}
            className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40"
          />
          <p className="text-[7px] text-[var(--text-dim)] uppercase tracking-tight font-semibold">Response timing ceiling</p>
        </div>
      </div>

      {runnerMode === 'mot' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-white/[0.03] animate-in fade-in duration-200">
          <div className="space-y-1.5 col-span-2 md:col-span-1">
            <label className="text-[8px] font-black text-amber-500 uppercase tracking-widest block font-mono">Max Requests / Min</label>
            <input
              type="number"
              disabled={isRunning}
              min={10} max={10000}
              value={motMaxReqPerMin}
              onChange={(e) => onMotMaxReqChange(Math.min(10000, Math.max(10, parseInt(e.target.value) || 600)))}
              className="w-full bg-[var(--bg-deep)] border border-[#151518] px-3 py-2 rounded-lg text-[11px] font-mono text-white outline-none focus:border-amber-500/30"
            />
            <p className="text-[7px] text-[#555] font-mono">Throughput safety roof</p>
          </div>

          <div className="space-y-1.5 col-span-2 md:col-span-1">
            <label className="text-[8px] font-black text-amber-500 uppercase tracking-widest block font-mono">Max Retries / Min</label>
            <input
              type="number"
              disabled={isRunning}
              min={0} max={500}
              value={motMaxRetriesPerMin}
              onChange={(e) => onMotMaxRetriesChange(Math.min(500, Math.max(0, parseInt(e.target.value) || 60)))}
              className="w-full bg-[var(--bg-deep)] border border-[#151518] px-3 py-2 rounded-lg text-[11px] font-mono text-white outline-none focus:border-amber-500/30"
            />
            <p className="text-[7px] text-[#555] font-mono">Endurance auto-recovery cap</p>
          </div>

          <div className="space-y-1.5 col-span-2 md:col-span-1">
            <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Inter-Request Delay (ms)</label>
            <input
              type="number"
              disabled={isRunning}
              value={delay}
              onChange={(e) => onDelayChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40"
            />
            <p className="text-[7px] text-[var(--text-dim)] uppercase tracking-tight font-semibold">Rest interval (ms)</p>
          </div>

          <div className="space-y-1.5 col-span-2 md:col-span-1">
            <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Pre/Post Scripts</label>
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                disabled={isRunning}
                id="runRequestScriptsEndure"
                checked={runRequestScripts}
                onChange={(e) => onRunScriptsChange(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#1E1E28] bg-black/50 text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="runRequestScriptsEndure" className="text-[10px] font-semibold text-[#888894] uppercase tracking-wide cursor-pointer select-none">
                Run Setup Scripts
              </label>
            </div>
          </div>
        </div>
      )}

      {runnerMode === 'loop' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-white/[0.03] animate-in fade-in duration-200">
          <div className="space-y-1.5 col-span-2 md:col-span-1">
            <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Sandbox Engine</label>
            <select
              disabled={isRunning}
              value={sandboxEngine}
              onChange={(e) => onSandboxEngineChange(e.target.value as 'in-thread' | 'worker')}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-3 py-2 rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#3ECF8E]/40 cursor-pointer"
            >
              <option value="in-thread">💨 IN-THREAD (Fast)</option>
              <option value="worker">🔒 ISOLATED (Worker)</option>
            </select>
            <p className="text-[7px] text-[var(--text-dim)] uppercase tracking-tight font-semibold">Containment level</p>
          </div>

          <div className="space-y-1.5 col-span-2 md:col-span-3">
            <label className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest block font-mono">Execution Scripts</label>
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                disabled={isRunning}
                id="runRequestScriptsLoop"
                checked={runRequestScripts}
                onChange={(e) => onRunScriptsChange(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#1E1E28] bg-black/50 text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="runRequestScriptsLoop" className="text-[10px] font-semibold text-[#888894] uppercase tracking-wide cursor-pointer select-none">
                Run Script Pipeline (Pre-request, tests & assertions)
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

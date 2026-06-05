import React from 'react';
import { Activity } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TestIntroProps {
  runnerMode: 'loop' | 'mot';
  isRunning: boolean;
  onModeChange: (mode: 'loop' | 'mot') => void;
}

export const TestIntro: React.FC<TestIntroProps> = ({ runnerMode, isRunning, onModeChange }) => {
  return (
    <div className="p-4 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="space-y-1">
        <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Activity size={12} className="text-[#3ECF8E]" />
          Built-in JMeter Smoke Tester
        </h3>
        <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-tight leading-relaxed max-w-2xl">
          Simulates real-world traffic directly inside your browser client, or exports a professional JMeter Test Plan (.jmx) for massive-scale performance suites. Select between fixed-loop testing and minutes of testing (MoT) endurance modes.
        </p>
      </div>

      <div className="flex bg-[#0A0A0F]/60 p-1 rounded-xl border border-white/[0.04] w-full md:w-auto max-w-md select-none relative shrink-0">
        {isRunning && <div className="absolute inset-0 bg-transparent z-40 cursor-not-allowed" />}
        <button
          onClick={() => onModeChange('loop')}
          className={cn(
            "flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono outline-none text-center",
            runnerMode === 'loop' ? "bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/15" : "text-[#555] hover:text-[#888]"
          )}
        >
          Loops Run
        </button>
        <button
          onClick={() => onModeChange('mot')}
          className={cn(
            "flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer font-mono outline-none text-center",
            runnerMode === 'mot' ? "bg-amber-500/10 text-amber-500 border border-amber-500/15" : "text-[#555] hover:text-[#888]"
          )}
        >
          Minutes (MoT)
        </button>
      </div>
    </div>
  );
};

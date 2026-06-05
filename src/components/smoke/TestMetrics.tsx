import React from 'react';
import { BarChart3, CheckCircle, Clock, ShieldAlert, Activity, Download } from 'lucide-react';
import { cn } from '../../lib/utils';
import { LatencyGrid } from './LatencyGrid';

interface TestMetricsProps {
  samples: any[];
  throughput: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  successRate: number;
  onExportCSV: () => void;
  onExportPDF: () => void;
}

export const TestMetrics: React.FC<TestMetricsProps> = ({
  samples, throughput, avgLatency, minLatency, maxLatency, successRate,
  onExportCSV, onExportPDF,
}) => {
  if (samples.length === 0) return null;

  return (
    <div className="space-y-4">
      <LatencyGrid samples={samples} isRunning={false} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-xl space-y-1">
          <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
            <BarChart3 size={10} className="text-blue-400" />
            Throughput
          </span>
          <div className="text-base font-bold text-white font-mono">{throughput} <span className="text-[8px] font-normal text-[var(--text-dim)]">req/s</span></div>
        </div>
        <div className="p-3 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-xl space-y-1">
          <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
            <CheckCircle size={10} className="text-[#3ECF8E]" />
            Success Rate
          </span>
          <div className={cn("text-base font-bold font-mono", successRate === 100 ? 'text-[#3ECF8E]' : 'text-yellow-500')}>{successRate}%</div>
        </div>
        <div className="p-3 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-xl space-y-1">
          <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
            <Clock size={10} className="text-purple-400" />
            Avg Latency
          </span>
          <div className="text-base font-bold text-white font-mono">{avgLatency} <span className="text-[8px] font-normal text-[var(--text-dim)]">ms</span></div>
        </div>
        <div className="p-3 bg-[var(--bg-deep)]/40 border border-[var(--border-subtle)] rounded-xl space-y-1">
          <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
            <ShieldAlert size={10} className="text-red-400" />
            Min / Max
          </span>
          <div className="text-base font-bold text-white font-mono">{minLatency} / {maxLatency} <span className="text-[8px] font-normal text-[var(--text-dim)]">ms</span></div>
        </div>
      </div>

      <div className="bg-[#0D0D12]/60 border border-[#1C1C25]/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div className="flex items-start gap-3">
          <Activity size={14} className="text-[#3ECF8E] shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-0.5">
            <h4 className="text-[9px] font-black text-[#3ECF8E] uppercase tracking-wider font-mono">
              Telemetry Session Concluded
            </h4>
            <p className="text-[8px] text-[#88888F] font-mono uppercase tracking-tight">
              The test runs are finished and aggregated successfully. To view raw request metrics and detailed latency distribution logs, generate and download a report below.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onExportCSV}
            className="px-3.5 py-1.5 bg-[#0D0D12] border border-[#1C1C25] hover:border-[#3ECF8E]/30 rounded-lg text-[8px] font-black text-[#88888F] hover:text-[#3ECF8E] uppercase tracking-widest transition-colors flex items-center gap-1.5 cursor-pointer font-mono"
          >
            <Download size={10} />
            Export CSV
          </button>
          <button
            onClick={onExportPDF}
            className="px-3.5 py-1.5 bg-[#0D0D12] border border-[#1C1C25] hover:border-[#3ECF8E]/30 rounded-lg text-[8px] font-black text-[#88888F] hover:text-[#3ECF8E] uppercase tracking-widest transition-colors flex items-center gap-1.5 cursor-pointer font-mono"
          >
            <Download size={10} />
            Export PDF Table
          </button>
        </div>
      </div>
    </div>
  );
};

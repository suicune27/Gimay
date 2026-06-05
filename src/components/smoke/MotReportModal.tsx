import React from 'react';
import { Activity, AlertCircle, Sparkles, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Hotspot {
  id: string;
  name: string;
  method: string;
  runCount: number;
  failRate: number;
  avgLatency: number;
  unreliabilityIndex: number;
}

interface MotReportData {
  durationSeconds: number;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  earlyAbort: boolean;
  abortReason: string;
  crashPreventionActions: number;
  hotspots: Hotspot[];
  recommendations: string[];
}

interface MotReportModalProps {
  show: boolean;
  data: MotReportData | null;
  onClose: () => void;
}

export const MotReportModal: React.FC<MotReportModalProps> = ({ show, data, onClose }) => {
  if (!show || !data) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-4xl bg-[#09090C] border border-[#1C1C22] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1C1C22] flex justify-between items-center bg-[#0C0C10] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
              <Activity size={16} className="text-amber-500" />
            </div>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
                Minutes of Testing (MoT) Session Intelligence Report
              </h3>
              <p className="text-[8px] text-[#55555C] font-mono uppercase tracking-widest mt-0.5">
                Endurance Session completed successfully &bull; Diagnostics analysis computed
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-[#55555C] hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 progress-panel no-scrollbar bg-[#050508]">
          {data.earlyAbort && (
            <div className="p-4 bg-red-950/20 border border-red-900/30 rounded-xl flex gap-3 items-start select-none">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-0.5">
                <h4 className="text-[10px] font-black text-red-400 uppercase tracking-wider font-mono">
                  Early Termination Interceded to Prevent System Crash
                </h4>
                <p className="text-[9px] text-red-300 leading-tight">
                  The safety guard controller terminated the endurance testing session early. Reason: <strong>{data.abortReason}</strong>. Data has been safely flushed down to disk to preserve desktop runtime heap.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-[#0A0A0E] border border-[#151518] rounded-xl text-center space-y-1">
              <span className="text-[8px] font-black text-[#55555C] uppercase tracking-widest block font-mono">Total Volume Run</span>
              <div className="text-lg font-bold text-white font-mono">{data.totalRequests}</div>
              <span className="text-[8px] text-[#444] font-mono uppercase block">API Transmissions</span>
            </div>
            <div className="p-4 bg-[#0A0A0E] border border-[#151518] rounded-xl text-center space-y-1">
              <span className="text-[8px] font-black text-[#55555C] uppercase tracking-widest block font-mono">Success Rate</span>
              <div className={cn("text-lg font-bold font-mono", data.successRate >= 95 ? "text-[#3ECF8E]" : data.successRate >= 80 ? "text-amber-500" : "text-red-500")}>{data.successRate}%</div>
              <span className="text-[8px] text-[#444] font-mono uppercase block">{data.successCount} Pass / {data.failureCount} Fail</span>
            </div>
            <div className="p-4 bg-[#0A0A0E] border border-[#151518] rounded-xl text-center space-y-1">
              <span className="text-[8px] font-black text-[#55555C] uppercase tracking-widest block font-mono">Latency Ceiling (Min/Max)</span>
              <div className="text-md font-bold text-white font-mono pt-[3px]">{data.minLatency}ms / {data.maxLatency}ms</div>
              <span className="text-[8px] text-[#444] font-mono uppercase block">Avg: {data.avgLatency}ms</span>
            </div>
            <div className="p-4 bg-[#0A0A0E] border border-[#151518] rounded-xl text-center space-y-1">
              <span className="text-[8px] font-black text-[#55555C] uppercase tracking-widest block font-mono">Safety Interventions</span>
              <div className="text-lg font-bold text-white font-mono">{data.crashPreventionActions}</div>
              <span className="text-[8px] text-[#444] font-mono uppercase block">Automated Adjustments</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 border-b border-[#1C1C22] pb-1.5">
                <AlertCircle size={12} className="text-amber-500" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider font-mono">Instability Hotspots (Ranked)</span>
              </div>
              {data.hotspots && data.hotspots.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                  {data.hotspots.map((hs, i) => (
                    <div key={hs.id} className="p-3 bg-[#0A0A0F]/60 border border-[#151518] rounded-xl flex items-center justify-between font-mono text-[9px]">
                      <div className="space-y-0.5 max-w-[210px] truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] text-[#555] font-black">#{i+1}</span>
                          <span className="px-1 py-0.2 rounded bg-black/50 text-[#fff]/60 font-black text-[8px]">{hs.method}</span>
                          <span className="text-white font-bold truncate">{hs.name}</span>
                        </div>
                        <span className="text-[8px] text-[#55555C] block">Avg Response Time: {hs.avgLatency}ms</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={cn("font-black tracking-wider text-[8px] px-2 py-0.5 rounded uppercase block", hs.failRate > 40 ? "text-red-500 bg-red-500/10" : hs.failRate > 15 ? "text-amber-500 bg-amber-500/10" : "text-[#3ECF8E] bg-[#3ECF8E]/10")}>
                          {hs.failRate}% Failures
                        </span>
                        <span className="text-[7px] text-[#444] block mt-0.5">{hs.runCount} cycles run</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[9px] text-[#55555C] italic py-4 text-center">No telemetry data recorded to chart unreliability hotspots</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 border-b border-[#1C1C22] pb-1.5">
                <Sparkles size={12} className="text-[#3ECF8E]" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider font-mono">Tactical Optimization Recommendations</span>
              </div>
              <div className="space-y-3 bg-[#0A0A10]/50 border border-[#15151E] p-4 rounded-xl min-h-[160px]">
                {data.recommendations && data.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex gap-2 items-start text-[9px] text-[#9999A1] leading-relaxed">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] shrink-0 mt-1" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#1C1C22] bg-[#0C0C10] flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-6 bg-[#3ECF8E] hover:bg-[#32B379] text-[#070708] rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Close Report and Continue
          </button>
        </div>
      </div>
    </div>
  );
};

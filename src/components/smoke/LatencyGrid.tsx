import React from 'react';

interface Sample {
  id: number;
  timestamp?: string;
  latency: number;
  status: number | string;
  success: boolean;
  error?: string;
  requestName?: string;
  requestMethod?: string;
}

interface LatencyGridProps {
  samples: Sample[];
  isRunning: boolean;
}

export const LatencyGrid: React.FC<LatencyGridProps> = ({ samples, isRunning }) => {
  const graphSamples = samples.slice(-100);
  const hasData = graphSamples.length > 0;

  let maxVal = 0;
  let minVal = 0;
  let averageVal = 0;
  if (hasData) {
    maxVal = graphSamples[0].latency;
    minVal = graphSamples[0].latency;
    let total = 0;
    for (const s of graphSamples) {
      if (s.latency > maxVal) maxVal = s.latency;
      if (s.latency < minVal) minVal = s.latency;
      total += s.latency;
    }
    averageVal = Math.round(total / graphSamples.length);
  }

  return (
    <div className="bg-[#09090D] border border-white/[0.04] rounded-2xl p-5 space-y-4 relative overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[10px] font-black text-[#E1E1E6] uppercase tracking-wider block font-mono">Real-Time Suite Transmission Activity Grid</span>
          <span className="text-[8px] text-[#888894] font-mono block">Active throughput status represented across active parallel channels</span>
        </div>
        <span className={`text-[8px] font-mono uppercase font-black px-2.5 py-0.5 rounded border transition-all ${
          hasData
            ? "text-[#3ECF8E] bg-[#3ECF8E]/10 border-[#3ECF8E]/25 animate-pulse"
            : "text-[#555] bg-[#101015] border-[#222]"
        }`}>
          {hasData ? 'LIVE MULTI-CHANNEL INSPECT' : 'STANDBY MODE'}
        </span>
      </div>

      {!hasData ? (
        <div className="h-[120px] rounded-xl border border-white/[0.04] bg-[#030305] flex flex-col items-center justify-center space-y-1 select-none">
          <span className="text-[9px] font-black tracking-widest text-[#444] font-mono uppercase">Telemetry stand-by</span>
          <span className="text-[7px] text-[#333] font-mono">Real-time status indexes populate here on suite execution</span>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-[#030305] rounded-xl p-4 border border-white/[0.04]">
            <div className="flex flex-wrap gap-2 justify-start items-center">
              {graphSamples.map((s, idx) => {
                const isSuccess = s.success;
                const latency = s.latency;
                const requestName = s.requestName || 'Unknown Scenario';
                let colorClass = "bg-red-500 border-red-400/20";
                if (isSuccess) {
                  if (latency < 200) {
                    colorClass = "bg-[#3ECF8E] border-[#3ECF8E]/20";
                  } else if (latency < 600) {
                    colorClass = "bg-[#10B981] border-[#10B981]/15";
                  } else {
                    colorClass = "bg-amber-500 border-amber-400/15";
                  }
                }
                return (
                  <div
                    key={s.id || idx}
                    className={`w-3.5 h-3.5 rounded-md cursor-pointer transition-all duration-150 hover:scale-125 border shadow-sm relative group/dot ${colorClass}`}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/95 border border-[#1E1E28] text-white text-[8px] font-mono p-2.5 rounded-lg shadow-2xl opacity-0 scale-0 group-hover/dot:opacity-100 group-hover/dot:scale-100 transition-all z-50 pointer-events-none whitespace-nowrap backdrop-blur-md">
                      <div className="flex items-center gap-2 border-b border-[#222] pb-1 mb-1">
                        <span className="font-extrabold text-[#555]">CYCLE #{s.id}</span>
                        <span className={`text-[6px] font-black px-1.5 py-0.2 rounded uppercase ${
                          s.success ? "bg-[#3ECF8E]/10 text-[#3ECF8E]" : "bg-red-500/10 text-red-400"
                        }`}>{s.success ? "PASS" : "FAIL"}</span>
                      </div>
                      <p className="text-[9px] font-bold text-white mb-0.5 truncate max-w-xs">{requestName}</p>
                      <p className="text-[10px] font-bold text-white mb-0.5">{latency}ms Latency</p>
                      <p className="text-[7px] text-[#888] uppercase tracking-tighter">Status: {s.status || 'N/A'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#05050A] border border-white/[0.04] p-3 rounded-lg flex flex-col justify-center">
              <span className="text-[7px] font-black text-[#66666D] uppercase tracking-wider font-mono block">Peak Latency</span>
              <span className="text-xs font-black font-mono text-white mt-0.5">{maxVal}ms</span>
            </div>
            <div className="bg-[#05050A] border border-white/[0.04] p-3 rounded-lg flex flex-col justify-center">
              <span className="text-[7px] font-black text-[#66666D] uppercase tracking-wider font-mono block">Average Latency</span>
              <span className="text-xs font-black font-mono text-white mt-0.5">{averageVal}ms</span>
            </div>
            <div className="bg-[#05050A] border border-white/[0.04] p-3 rounded-lg flex flex-col justify-center">
              <span className="text-[7px] font-black text-[#55555C] uppercase tracking-wider font-mono block">Network Link Quality</span>
              <span className={`text-xs font-black font-mono mt-0.5 block ${
                averageVal < 250 ? "text-[#3ECF8E]" : averageVal < 600 ? "text-amber-500" : "text-red-500"
              }`}>
                {averageVal < 250 ? "OPTIMAL" : averageVal < 600 ? "ACCELERATED" : "DEGRADED"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { BarChart3, Layout, PieChart as PieChartIcon, TrendingUp, Code2, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

const COLORS = ['#2563EB', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const VisualizerPanel: React.FC = () => {
  const { lastResponse } = useStore();

  const isHtmlResponse = React.useMemo(() => {
    return lastResponse?.contentType?.toLowerCase()?.includes('html') ?? false;
  }, [lastResponse?.contentType]);

  const [viewMode, setViewMode] = React.useState<'auto' | 'html' | 'chart'>(isHtmlResponse ? 'html' : 'auto');
  const [chartType, setChartType] = React.useState<'bar' | 'line' | 'area' | 'pie'>('bar');

  // Auto-switch to HTML view when an HTML response is received
  React.useEffect(() => {
    if (isHtmlResponse) {
      setViewMode('html');
    }
  }, [isHtmlResponse]);

  const data = useMemo(() => {
    if (!lastResponse?.body) return null;
    // For HTML content, skip JSON parse — return raw body so the HTML view can render
    if (isHtmlResponse) {
      return lastResponse.body;
    }
    try {
      return typeof lastResponse.body === 'string' 
        ? JSON.parse(lastResponse.body) 
        : lastResponse.body;
    } catch {
      return null;
    }
  }, [lastResponse?.body, isHtmlResponse]);

  const chartData = useMemo(() => {
    if (!data) return null;
    
    // If it's an array of objects, we can plot it
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      return data;
    }
    
    // If it's an object with a data array
    if (typeof data === 'object' && !Array.isArray(data)) {
      const arrayKey = Object.keys(data).find(key => Array.isArray(data[key]));
      if (arrayKey) return data[arrayKey];
    }
    
    return null;
  }, [data]);

  const numericKeys = useMemo(() => {
    if (!chartData || !chartData[0]) return [];
    return Object.keys(chartData[0]).filter(key => typeof chartData[0][key] === 'number');
  }, [chartData]);

  const stringKeys = useMemo(() => {
    if (!chartData || !chartData[0]) return [];
    return Object.keys(chartData[0]).filter(key => typeof chartData[0][key] === 'string');
  }, [chartData]);

  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4 opacity-30 grayscale">
        <Layout size={48} />
        <p className="text-[10px] font-black uppercase tracking-[0.2em]">No Data to Visualize</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-deep)]">
      {/* Visualizer Toolbar */}
      <div className="h-12 px-6 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex bg-[var(--bg-elevated)] rounded-lg p-1">
            <button
              onClick={() => setViewMode('auto')}
              className={cn(
                "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                viewMode === 'auto' ? "bg-[var(--brand)] text-[var(--bg-deep)] shadow-lg shadow-[var(--brand)]/20" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"
              )}
            >
              Auto
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={cn(
                "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                viewMode === 'chart' ? "bg-[var(--brand)] text-[var(--bg-deep)] shadow-lg shadow-[var(--brand)]/20" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"
              )}
            >
              Charts
            </button>
            <button
              onClick={() => setViewMode('html')}
              className={cn(
                "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                viewMode === 'html' ? "bg-[var(--brand)] text-[var(--bg-deep)] shadow-lg shadow-[var(--brand)]/20" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"
              )}
            >
              HTML
            </button>
          </div>

          {viewMode === 'chart' && chartData && (
            <div className="flex items-center gap-1 border-l border-[var(--border-strong)] ml-2 pl-4">
              <button 
                onClick={() => setChartType('bar')}
                className={cn("p-1.5 rounded transition-all", chartType === 'bar' ? "text-[var(--brand)] bg-[var(--brand)]/10" : "text-[var(--text-dim)] hover:text-[var(--text-main)]")}
              >
                <BarChart3 size={14} />
              </button>
              <button 
                onClick={() => setChartType('line')}
                className={cn("p-1.5 rounded transition-all", chartType === 'line' ? "text-[var(--brand)] bg-[var(--brand)]/10" : "text-[var(--text-dim)] hover:text-[var(--text-main)]")}
              >
                <TrendingUp size={14} />
              </button>
              <button 
                onClick={() => setChartType('pie')}
                className={cn("p-1.5 rounded transition-all", chartType === 'pie' ? "text-[var(--brand)] bg-[var(--brand)]/10" : "text-[var(--text-dim)] hover:text-[var(--text-main)]")}
              >
                <PieChartIcon size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-tighter bg-[var(--bg-elevated)] px-2 py-0.5 rounded">
              Engine V1.0
            </span>
        </div>
      </div>

      {/* Surface Area */}
      <div className="flex-1 overflow-auto p-8 bg-[var(--bg-deep)]">
        <AnimatePresence mode="wait">
          {viewMode === 'chart' && (
            <div className="h-full space-y-8 animate-in fade-in duration-200">
              {chartData ? (
                <div className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                  {/* Header metadata */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest font-mono flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[var(--brand)] animate-pulse" />
                        {chartType.toUpperCase()} Telemetry Breakdown
                      </h4>
                      <p className="text-[8px] text-[var(--text-dim)] font-mono uppercase tracking-tight mt-1">
                        Active rendering of first 15 structural points to preserve interface performance
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {numericKeys.slice(0, 3).map((key, idx) => (
                        <div key={key} className="flex items-center gap-2 text-[9px] font-mono text-[var(--text-dim)] uppercase bg-deep/25 px-2.5 py-1 rounded-md border border-[var(--border-subtle)]/30">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-white font-black">{key}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Core Bars Rendering Stage */}
                  <div className="h-[280px] flex items-end gap-3 border-b border-[var(--border-strong)] pb-2 pt-6 overflow-x-auto no-scrollbar">
                    {chartData.slice(0, 15).map((node: any, idx: number) => {
                      const label = String(node[stringKeys[0]] || node['id'] || node['name'] || `Item ${idx + 1}`);
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full min-w-[36px] group relative">
                          <div className="w-full flex gap-1 justify-center items-end h-[220px]">
                            {numericKeys.slice(0, 2).map((key, keyIdx) => {
                              const val = Number(node[key]) || 0;
                              // Walk correct maximum limit
                              const maxVal = Math.max(...chartData.map((d: any) => Number(d[key]) || 1)) || 1;
                              const heightPercent = Math.max(3, Math.min(100, (val / maxVal) * 100));
                              return (
                                <div
                                  key={key}
                                  className="w-full rounded-t-lg relative group/bar cursor-pointer transition-all duration-300 hover:scale-x-105 hover:brightness-125 shadow-lg"
                                  style={{
                                    height: `${heightPercent}%`,
                                    backgroundColor: COLORS[keyIdx % COLORS.length],
                                  }}
                                >
                                  {/* Hover Floating Tooltip widget */}
                                  <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 bg-[var(--bg-card)]/95 border border-[var(--bg-code)] text-white text-[8px] font-mono p-3 rounded-lg shadow-2xl opacity-0 translate-y-2 group-hover/bar:opacity-100 group-hover/bar:translate-y-0 transition-all z-50 pointer-events-none whitespace-nowrap backdrop-blur-md">
                                    <p className="font-bold text-[var(--text-dim)] uppercase text-[7px] tracking-wider mb-0.5">{key}</p>
                                    <p className="text-white font-black text-[11px]">{val.toLocaleString()}</p>
                                    <div className="text-[6px] text-gray-500 mt-1 uppercase tracking-tighter">Record: {label}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <span className="text-[8px] font-mono text-[var(--text-dim)] uppercase truncate w-full text-center mt-3 group-hover:text-white transition-colors tracking-tighter">
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-[var(--border-subtle)] rounded-3xl opacity-50 bg-[var(--bg-surface)]">
                  <BarChart3 size={32} className="mb-4 text-[var(--brand)]" />
                  <h3 className="text-sm font-black text-[var(--text-main)] uppercase tracking-[0.2em] mb-2">Incompatible Data Structure</h3>
                  <p className="text-[10px] text-[var(--text-dim)] max-w-xs uppercase leading-relaxed font-mono">Charts require an array of objects with numeric properties to render correctly.</p>
                </div>
              )}

              {chartData && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {numericKeys.map((key, i) => {
                      const values = chartData.map((d: any) => d[key]);
                      let max = 0;
                      let min = 0;
                      if (values.length > 0) {
                        max = values[0];
                        min = values[0];
                        for (const val of values) {
                          if (val > max) max = val;
                          if (val < min) min = val;
                        }
                      }
                      const sum = values.reduce((a: number, b: number) => a + b, 0);
                      const avg = values.length > 0 ? sum / values.length : 0;

                      return (
                        <div key={key} className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 rounded-2xl shadow-lg">
                           <div className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest mb-4 flex items-center justify-between">
                              <span>{key}</span>
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                 <p className="text-[8px] text-[var(--text-dim)] uppercase">Average</p>
                                 <p className="text-xl font-black text-[var(--text-main)]">{avg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[8px] text-[var(--text-dim)] uppercase">Peak</p>
                                 <p className="text-xl font-black text-[var(--brand)]">{max.toLocaleString()}</p>
                              </div>
                           </div>
                        </div>
                      );
                   })}
                </div>
              )}
            </div>
          )}

          {viewMode === 'html' && (
            <div className="h-full flex flex-col bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl">
              <div className="h-10 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-deep)] flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Code2 size={12} className="text-amber-500" />
                    <span className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Isolated HTML Rendering</span>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                       <span className="text-[8px] font-bold text-[var(--text-dim)] uppercase">Safe Shell</span>
                    </div>
                 </div>
              </div>
              <div className="flex-1 bg-white">
                <iframe 
                  title="visualizer-output"
                  srcDoc={lastResponse?.contentType?.includes('html') ? lastResponse.body : `
                    <html>
                      <head>
                        <style>
                          body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; color: #333; background: #fff; line-height: 1.6; }
                          .header { margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
                          h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
                          pre { background: #f5f5f5; padding: 20px; border-radius: 8px; font-size: 13px; overflow: auto; border: 1px solid #ddd; }
                          .badge { background: var(--brand); color: #000; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <span class="badge">API Response Visualized</span>
                          <h1>Raw Data View</h1>
                        </div>
                        <pre>${JSON.stringify(data, null, 2)}</pre>
                      </body>
                    </html>
                  `}
                  className="w-full h-full border-none"
                />
              </div>
            </div>
          )}

          {viewMode === 'auto' && (
            <div className="space-y-6">
               <div className="flex items-start gap-6">
                  <div className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-8 shadow-xl">
                     <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 border border-[var(--brand)]/30 flex items-center justify-center">
                           <Info size={20} className="text-[var(--brand)]" />
                        </div>
                        <div>
                           <h2 className="text-[12px] font-black text-[var(--text-main)] uppercase tracking-[0.2em]">Intel Analysis</h2>
                           <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-widest mt-1">Structural Meta-Examination</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="space-y-1">
                           <p className="text-[8px] text-[var(--text-dim)] uppercase tracking-widest">Data Type</p>
                           <p className="text-[13px] font-bold text-[var(--brand)] uppercase">{Array.isArray(data) ? 'Collection' : 'Object Shell'}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[8px] text-[var(--text-dim)] uppercase tracking-widest">Entry Nodes</p>
                           <p className="text-[13px] font-bold text-[var(--text-main)]">{Array.isArray(data) ? data.length : Object.keys(data).length}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[8px] text-[var(--text-dim)] uppercase tracking-widest">Depth Index</p>
                           <p className="text-[13px] font-bold text-[var(--text-main)]">Level {calculateDepth(data)}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[8px] text-[var(--text-dim)] uppercase tracking-widest">Weight</p>
                           <p className="text-[13px] font-bold text-[var(--text-main)]">{(JSON.stringify(data).length / 1024).toFixed(2)} KB</p>
                        </div>
                     </div>
                  </div>
               </div>

               {Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && (
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-2xl">
                     <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Layout size={14} className="text-[var(--brand)]" />
                           <span className="text-[10px] font-black text-[var(--text-main)] uppercase tracking-widest">Grid Inspector</span>
                        </div>
                        <span className="text-[9px] font-bold text-[var(--text-dim)] uppercase">{data.length} Records Detected</span>
                     </div>
                     <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full border-collapse">
                           <thead>
                              <tr className="bg-[var(--bg-deep)] border-b border-[var(--border-subtle)]">
                                 {Object.keys(data[0]).slice(0, 8).map(key => (
                                    <th key={key} className="px-6 py-3 text-left text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">{key}</th>
                                 ))}
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-[var(--border-subtle)]/30">
                              {data.slice(0, 10).map((row, i) => (
                                 <tr key={i} className="hover:bg-[var(--bg-elevated)]/50 transition-all">
                                    {Object.values(row).slice(0, 8).map((val: any, j) => (
                                       <td key={j} className="px-6 py-3 text-[11px] font-medium text-[var(--text-muted)] truncate max-w-[200px]">
                                          {typeof val === 'object' ? '{...}' : String(val)}
                                       </td>
                                    ))}
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                        {data.length > 10 && (
                           <div className="p-4 text-center border-t border-[var(--border-subtle)] bg-[var(--bg-deep)]">
                              <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-widest">Truncated View - Showing first 10 entries</p>
                           </div>
                        )}
                     </div>
                  </div>
               )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

function calculateDepth(obj: any, currentDepth = 0): number {
  if (currentDepth > 10) return 10;
  if (typeof obj !== 'object' || obj === null) return 0;
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return 1;
    const sample = obj.slice(0, 5);
    return 1 + Math.max(0, ...sample.map(val => calculateDepth(val, currentDepth + 1)));
  }

  const keys = Object.keys(obj);
  if (keys.length === 0) return 1;
  const maxKeysToCheck = keys.slice(0, 15);
  return 1 + Math.max(0, ...maxKeysToCheck.map(key => calculateDepth(obj[key], currentDepth + 1)));
}

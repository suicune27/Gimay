import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { BarChart3, Layout, PieChart as PieChartIcon, TrendingUp, Code2, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

const COLORS = ['#3ECF8E', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const VisualizerPanel: React.FC = () => {
  const { lastResponse } = useStore();
  const [viewMode, setViewMode] = React.useState<'auto' | 'html' | 'chart'>('auto');
  const [chartType, setChartType] = React.useState<'bar' | 'line' | 'area' | 'pie'>('bar');

  const data = useMemo(() => {
    if (!lastResponse?.body) return null;
    try {
      return typeof lastResponse.body === 'string' 
        ? JSON.parse(lastResponse.body) 
        : lastResponse.body;
    } catch {
      return null;
    }
  }, [lastResponse?.body]);

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
    <div className="h-full flex flex-col bg-deep">
      {/* Visualizer Toolbar */}
      <div className="h-12 px-6 border-b border-subtle flex items-center justify-between bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex bg-elevated rounded-lg p-1">
            <button
              onClick={() => setViewMode('auto')}
              className={cn(
                "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                viewMode === 'auto' ? "bg-brand text-[var(--bg-deep)] shadow-lg shadow-[var(--brand)]/20" : "text-dim hover:text-main"
              )}
            >
              Auto
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={cn(
                "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                viewMode === 'chart' ? "bg-brand text-[var(--bg-deep)] shadow-lg shadow-[var(--brand)]/20" : "text-dim hover:text-main"
              )}
            >
              Charts
            </button>
            <button
              onClick={() => setViewMode('html')}
              className={cn(
                "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                viewMode === 'html' ? "bg-brand text-[var(--bg-deep)] shadow-lg shadow-[var(--brand)]/20" : "text-dim hover:text-main"
              )}
            >
              HTML
            </button>
          </div>

          {viewMode === 'chart' && chartData && (
            <div className="flex items-center gap-1 border-l border-strong ml-2 pl-4">
              <button 
                onClick={() => setChartType('bar')}
                className={cn("p-1.5 rounded transition-all", chartType === 'bar' ? "text-brand bg-brand/10" : "text-dim hover:text-main")}
              >
                <BarChart3 size={14} />
              </button>
              <button 
                onClick={() => setChartType('line')}
                className={cn("p-1.5 rounded transition-all", chartType === 'line' ? "text-brand bg-brand/10" : "text-dim hover:text-main")}
              >
                <TrendingUp size={14} />
              </button>
              <button 
                onClick={() => setChartType('pie')}
                className={cn("p-1.5 rounded transition-all", chartType === 'pie' ? "text-brand bg-brand/10" : "text-dim hover:text-main")}
              >
                <PieChartIcon size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-dim uppercase tracking-tighter bg-elevated px-2 py-0.5 rounded">
              Engine V1.0
            </span>
        </div>
      </div>

      {/* Surface Area */}
      <div className="flex-1 overflow-auto p-8 bg-deep">
        <AnimatePresence mode="wait">
          {viewMode === 'chart' && (
            <div className="h-full space-y-8">
              {chartData ? (
                <div className="h-[400px] w-full bg-surface border border-subtle rounded-2xl p-6 shadow-xl">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis 
                          dataKey={stringKeys[0] || 'id'} 
                          stroke="#555" 
                          fontSize={10} 
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #222', borderRadius: '8px', fontSize: '10px' }}
                          cursor={{ fill: 'rgba(62, 207, 142, 0.05)' }}
                        />
                        {numericKeys.slice(0, 3).map((key, i) => (
                           <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                        ))}
                      </BarChart>
                    ) : chartType === 'line' ? (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis dataKey={stringKeys[0] || 'id'} stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #222', borderRadius: '8px', fontSize: '10px' }} />
                        {numericKeys.slice(0, 3).map((key, i) => (
                           <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                        ))}
                      </LineChart>
                    ) : (
                      <PieChart>
                         <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey={numericKeys[0]}
                            nameKey={stringKeys[0]}
                          >
                            {chartData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #222', borderRadius: '8px', fontSize: '10px' }} />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-subtle rounded-3xl opacity-50 bg-surface">
                  <BarChart3 size={32} className="mb-4 text-brand" />
                  <h3 className="text-sm font-black text-main uppercase tracking-[0.2em] mb-2">Incompatible Data Structure</h3>
                  <p className="text-[10px] text-dim max-w-xs uppercase leading-relaxed font-mono">Charts require an array of objects with numeric properties to render correctly.</p>
                </div>
              )}

              {chartData && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {numericKeys.map((key, i) => {
                      const values = chartData.map((d: any) => d[key]);
                      const max = Math.max(...values);
                      const min = Math.min(...values);
                      const sum = values.reduce((a: number, b: number) => a + b, 0);
                      const avg = sum / values.length;

                      return (
                        <div key={key} className="bg-surface border border-subtle p-6 rounded-2xl shadow-lg">
                           <div className="text-[9px] font-black text-dim uppercase tracking-widest mb-4 flex items-center justify-between">
                              <span>{key}</span>
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                 <p className="text-[8px] text-dim uppercase">Average</p>
                                 <p className="text-xl font-black text-main">{avg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[8px] text-dim uppercase">Peak</p>
                                 <p className="text-xl font-black text-brand">{max.toLocaleString()}</p>
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
            <div className="h-full flex flex-col bg-surface border border-subtle rounded-2xl overflow-hidden shadow-2xl">
              <div className="h-10 px-4 border-b border-subtle bg-deep flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Code2 size={12} className="text-amber-500" />
                    <span className="text-[9px] font-black text-dim uppercase tracking-widest">Isolated HTML Rendering</span>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                       <span className="text-[8px] font-bold text-dim uppercase">Safe Shell</span>
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
                          .badge { background: #3ECF8E; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
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
                  <div className="flex-1 bg-surface border border-subtle rounded-2xl p-8 shadow-xl">
                     <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center">
                           <Info size={20} className="text-brand" />
                        </div>
                        <div>
                           <h2 className="text-[12px] font-black text-main uppercase tracking-[0.2em]">Intel Analysis</h2>
                           <p className="text-[9px] text-dim uppercase tracking-widest mt-1">Structural Meta-Examination</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="space-y-1">
                           <p className="text-[8px] text-dim uppercase tracking-widest">Data Type</p>
                           <p className="text-[13px] font-bold text-brand uppercase">{Array.isArray(data) ? 'Collection' : 'Object Shell'}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[8px] text-dim uppercase tracking-widest">Entry Nodes</p>
                           <p className="text-[13px] font-bold text-main">{Array.isArray(data) ? data.length : Object.keys(data).length}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[8px] text-dim uppercase tracking-widest">Depth Index</p>
                           <p className="text-[13px] font-bold text-main">Level {calculateDepth(data)}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[8px] text-dim uppercase tracking-widest">Weight</p>
                           <p className="text-[13px] font-bold text-main">{(JSON.stringify(data).length / 1024).toFixed(2)} KB</p>
                        </div>
                     </div>
                  </div>
               </div>

               {Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && (
                  <div className="bg-surface border border-subtle rounded-2xl overflow-hidden shadow-2xl">
                     <div className="px-6 py-4 border-b border-subtle bg-elevated flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Layout size={14} className="text-brand" />
                           <span className="text-[10px] font-black text-main uppercase tracking-widest">Grid Inspector</span>
                        </div>
                        <span className="text-[9px] font-bold text-dim uppercase">{data.length} Records Detected</span>
                     </div>
                     <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full border-collapse">
                           <thead>
                              <tr className="bg-deep border-b border-subtle">
                                 {Object.keys(data[0]).slice(0, 8).map(key => (
                                    <th key={key} className="px-6 py-3 text-left text-[9px] font-black text-dim uppercase tracking-widest">{key}</th>
                                 ))}
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-[var(--border-subtle)]/30">
                              {data.slice(0, 10).map((row, i) => (
                                 <tr key={i} className="hover:bg-elevated/50 transition-all">
                                    {Object.values(row).slice(0, 8).map((val: any, j) => (
                                       <td key={j} className="px-6 py-3 text-[11px] font-medium text-muted truncate max-w-[200px]">
                                          {typeof val === 'object' ? '{...}' : String(val)}
                                       </td>
                                    ))}
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                        {data.length > 10 && (
                           <div className="p-4 text-center border-t border-subtle bg-deep">
                              <p className="text-[9px] text-dim uppercase tracking-widest">Truncated View - Showing first 10 entries</p>
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

function calculateDepth(obj: any): number {
  if (typeof obj !== 'object' || obj === null) return 0;
  return 1 + Math.max(0, ...Object.values(obj).map(val => calculateDepth(val)));
}

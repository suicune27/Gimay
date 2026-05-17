import React from 'react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Database, Globe, Save, Terminal, Search, Copy, Check } from 'lucide-react';
import { PersistenceService } from '../../services/PersistenceService';
import Editor from '@monaco-editor/react';

export const ResponseViewer: React.FC = () => {
  const { lastResponse } = useStore();
  const [activeTab, setActiveTab] = React.useState<'Body' | 'Headers' | 'Tests' | 'Console'>('Body');
  const [consoleFilter, setConsoleFilter] = React.useState<'all' | 'error' | 'warn' | 'log'>('all');
  const [consoleSearch, setConsoleSearch] = React.useState('');
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const filteredConsoleLogs = React.useMemo(() => {
    if (!lastResponse?.consoleLogs) return [];
    return lastResponse.consoleLogs.filter(log => {
      const matchesFilter = consoleFilter === 'all' || log.level === consoleFilter;
      const logString = (log.args || []).map((arg: any) => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ').toLowerCase();
      const matchesSearch = logString.includes(consoleSearch.toLowerCase()) || log.level.toLowerCase().includes(consoleSearch.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [lastResponse?.consoleLogs, consoleFilter, consoleSearch]);

  if (!lastResponse) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#222222] bg-[#0A0A0A] relative overflow-hidden">
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.05, 0.1, 0.05] 
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
        >
          <Globe size={64} className="mb-6" />
        </motion.div>
        <div className="space-y-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-20 animate-pulse">Awaiting Signal</p>
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <motion.div 
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                className="w-1 h-1 rounded-full bg-[#3ECF8E]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isError = lastResponse.status >= 400;
  const content = typeof lastResponse.body === 'string' ? lastResponse.body : JSON.stringify(lastResponse.body, null, 2);

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      {/* Response Header */}
      <div className="h-9 px-4 border-b border-[#1A1A1A] flex items-center justify-between bg-[#0F0F0F] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isError ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-[#3ECF8E] shadow-[0_0_8px_rgba(62,207,142,0.4)]"
            )} />
            <span className={cn(
              "text-[9px] font-black uppercase tracking-[0.15em]",
              isError ? "text-red-500" : "text-[#3ECF8E]"
            )}>
              {lastResponse.status} {lastResponse.statusText || (isError ? 'Error' : 'Success')}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[#444444]">
            <div className="flex items-center gap-1">
              <Clock size={9} />
              <span className="text-[8px] font-bold tabular-nums tracking-tighter">{lastResponse.time}ms</span>
            </div>
            <div className="flex items-center gap-1">
              <Database size={9} />
              <span className="text-[8px] font-bold tabular-nums tracking-tighter">{(lastResponse.size / 1024).toFixed(2)}KB</span>
            </div>
          </div>
        </div>

        <div className="flex items-center">
            <button 
              onClick={async () => {
                const { activeTabId, addToast, profile } = useStore.getState();
                if (!activeTabId || !profile?.id) return;
                try {
                  await PersistenceService.createSavedResponse(activeTabId, profile.id, lastResponse);
                  addToast({ type: 'success', message: 'Mission footprint archived' });
                } catch (error) {
                  addToast({ type: 'error', message: 'Failed to preserve status' });
                }
              }}
              className="mr-3 px-2 py-1 flex items-center gap-1.5 text-[8px] font-black text-[#555555] hover:text-[#3ECF8E] transition-all uppercase tracking-widest hover:bg-white/5 rounded"
            >
              <Save size={10} />
              Snapshot
            </button>
            <div className="w-px h-3 bg-[#222222] mr-3" />
            <div className="flex">
              {(['Body', 'Headers', 'Tests', 'Console'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "h-9 px-3 text-[8px] font-black uppercase tracking-[0.2em] border-b-2 transition-all relative",
                    activeTab === tab ? "border-[#3ECF8E] text-[#3ECF8E]" : "border-transparent text-[#444444] hover:text-[#888888]"
                  )}
                >
                  {tab}
                  {tab === 'Tests' && lastResponse.testResults && (
                    <span className={cn(
                      "ml-1.5 px-1 rounded-[2px] text-[7px] font-bold",
                      lastResponse.testResults.every(r => r.status === 'pass') ? "bg-[#3ECF8E]/20 text-[#3ECF8E]" : "bg-red-500/20 text-red-500"
                    )}>
                      {lastResponse.testResults.filter(r => r.status === 'pass').length}/{lastResponse.testResults.length}
                    </span>
                  )}
                  {tab === 'Console' && lastResponse.consoleLogs && lastResponse.consoleLogs.length > 0 && (
                    <span className="ml-1.5 px-1 rounded-[2px] text-[7px] font-bold bg-blue-500/20 text-blue-400">
                      {lastResponse.consoleLogs.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
        </div>
      </div>

      {/* Response Content */}
      <div className="flex-1 overflow-auto custom-scrollbar p-3">
        <div className="h-full w-full rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] overflow-hidden shadow-2xl">
          {activeTab === 'Body' && (
            <Editor
              height="100%"
              language={(lastResponse.contentType || '').includes('json') ? 'json' : (lastResponse.contentType || '').includes('html') ? 'html' : 'text'}
              value={content}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: true },
                fontSize: 12,
                fontFamily: 'JetBrains Mono',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 20 }
              }}
            />
          )}

          {activeTab === 'Headers' && (
            <div className="p-6 space-y-2">
              {Object.entries(lastResponse.headers || {}).map(([key, value]) => (
                <div key={key} className="flex border-b border-[#222222] pb-2 last:border-0">
                  <div className="w-1/3 text-[10px] font-black text-[#555555] uppercase tracking-widest">{key}</div>
                  <div className="flex-1 text-[11px] font-mono text-[#AAAAAA] break-all">{value}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'Tests' && (
            <div className="p-6 space-y-4">
               {lastResponse.testResults?.map((result, i) => (
                 <div key={i} className="flex items-center justify-between p-4 bg-[#111111] rounded-xl border border-[#222222]">
                    <div className="flex items-center gap-3">
                       <div className={cn(
                         "w-1.5 h-1.5 rounded-full",
                         result.status === 'pass' ? "bg-[#3ECF8E]" : "bg-red-500"
                       )} />
                       <div className="text-[11px] font-bold text-white uppercase tracking-tight">{result.name}</div>
                    </div>
                    <div className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                      result.status === 'pass' ? "bg-[#3ECF8E]/10 text-[#3ECF8E]" : "bg-red-500/10 text-red-500"
                    )}>
                      {result.status}
                    </div>
                 </div>
               ))}
               {(!lastResponse.testResults || lastResponse.testResults.length === 0) && (
                 <div className="h-40 flex flex-col items-center justify-center text-[#222222]">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-20">No Protocol Verifications Found</span>
                 </div>
               )}
            </div>
          )}

          {activeTab === 'Console' && (
            <div className="flex flex-col h-full bg-[#050506] relative overflow-hidden">
               {/* Cyber scanline overlay */}
               <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.12)_50%)] bg-[length:100%_4px] pointer-events-none opacity-50 z-10" />

               {/* Console Sub-header */}
               <div className="h-9 px-3 border-b border-[#1C1C1F] bg-[#0C0C0E]/90 flex items-center justify-between shrink-0 z-20">
                 {/* Left side filters */}
                 <div className="flex items-center gap-1 bg-[#141417] border border-[#242429] p-0.5 rounded-lg shadow-inner">
                   {(['all', 'log', 'warn', 'error'] as const).map((lvl) => (
                     <button
                       key={lvl}
                       onClick={() => setConsoleFilter(lvl)}
                       className={cn(
                         "px-2.5 py-0.5 text-[7.5px] font-bold uppercase tracking-wider font-mono rounded transition-all",
                         consoleFilter === lvl 
                           ? "bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/20 shadow-[0_0_8px_rgba(62,207,142,0.1)]" 
                           : "text-[#55555C] hover:text-[#9E9EAE] border border-transparent"
                       )}
                     >
                       {lvl === 'log' ? 'info' : lvl}
                     </button>
                   ))}
                 </div>

                 {/* Right side search & copy */}
                 <div className="flex items-center gap-2">
                   <div className="relative">
                     <Search size={9} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4E4E54]" />
                     <input 
                       type="text"
                       placeholder="FILTER LOGS..."
                       value={consoleSearch}
                       onChange={(e) => setConsoleSearch(e.target.value)}
                       className="bg-[#121215] border border-[#242429] rounded-lg pl-7 pr-2 py-0.5 text-[8px] font-mono text-[#D1D1D6] placeholder:text-[#4E4E54] focus:border-[#3ECF8E]/40 focus:outline-none focus:ring-1 focus:ring-[#3ECF8E]/25 transition-all shadow-inner"
                     />
                   </div>
                   <button 
                     onClick={() => {
                       if (filteredConsoleLogs.length === 0) return;
                       const text = filteredConsoleLogs.map((l, idx) => `[LOG-${(idx+1).toString().padStart(3, '0')}] [${l.level.toUpperCase()}] ${l.args.map((a: any) => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`).join('\n');
                       navigator.clipboard.writeText(text);
                       useStore.getState().addToast({ type: 'success', message: 'Response logs archived' });
                     }}
                     disabled={filteredConsoleLogs.length === 0}
                     className="p-1 text-[#8E8E93] hover:text-[#3ECF8E] hover:bg-[#1C1C1F] disabled:opacity-30 disabled:hover:text-[#8E8E93] rounded-lg border border-transparent hover:border-[#2C2C2F] transition-all"
                     title="Copy Console Logs"
                   >
                     <Copy size={11} />
                   </button>
                 </div>
               </div>

               {/* Log Terminal List */}
               <div className="flex-1 overflow-y-auto font-mono text-[10px] selection:bg-[#3ECF8E]/20 custom-scrollbar divide-y divide-[#131316] z-20">
                    {filteredConsoleLogs.map((log, i) => {
                      const isErr = log.level === 'error';
                      const isWarn = log.level === 'warn';
                      
                      return (
                        <div 
                          key={i} 
                          className={cn(
                            "flex gap-0 group items-stretch border-l-2 transition-all duration-150 relative hover:bg-[#0C0C0F]",
                            isErr ? "border-red-500/60 hover:bg-red-950/5" :
                            isWarn ? "border-yellow-500/60 hover:bg-yellow-950/5" :
                            "border-[#3ECF8E]/60 hover:bg-[#3ECF8E]/5"
                          )}
                        >
                          {/* Segment ID */}
                          <div className="px-3.5 py-1.5 text-[#44444F] shrink-0 tabular-nums font-bold text-[8px] border-r border-[#131316] bg-[#09090C]/50 flex items-center justify-center min-w-[90px] select-none">
                            LOG-{(i+1).toString().padStart(3, '0')}
                          </div>

                          <div className="flex-1 flex gap-3 px-3 py-1.5 items-start min-w-0 pr-12">
                            {/* Neon level tag */}
                            <div className={cn(
                              "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 min-w-[45px] text-center mt-0.5 border font-mono select-none",
                              isErr ? "bg-red-500/10 border-red-500/20 text-red-400" :
                              isWarn ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" :
                              "bg-[#3ECF8E]/10 border-[#3ECF8E]/20 text-[#3ECF8E]"
                            )}>
                              {log.level === 'log' ? 'info' : log.level}
                            </div>
                            
                            {/* Message arguments */}
                            <div className="flex-1 overflow-x-auto no-scrollbar pb-0.5">
                              <div className={cn(
                                "flex flex-wrap gap-2 leading-relaxed font-semibold tracking-wide font-mono",
                                isErr ? 'text-red-300' :
                                isWarn ? 'text-yellow-200' : 'text-[#D1D1D6]'
                              )}>
                                {(log.args || []).map((arg: any, j: number) => (
                                  <div key={j} className="whitespace-pre-wrap break-all">
                                    {typeof arg === 'object' ? (
                                      <span className="text-[#3ECF8E]/90 bg-[#3ECF8E]/5 px-1 py-0.5 rounded border border-[#3ECF8E]/10 select-all font-bold">
                                        {JSON.stringify(arg, null, 2)}
                                      </span>
                                    ) : (
                                      <span className="select-all">{String(arg)}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Floating Copy Row Button */}
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-150">
                            <button
                              onClick={() => {
                                const text = log.args.map((a: any) => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
                                navigator.clipboard.writeText(`[${log.level.toUpperCase()}] ${text}`);
                                setCopiedIndex(i);
                                useStore.getState().addToast({ type: 'success', message: 'Log row copied' });
                                setTimeout(() => setCopiedIndex(null), 2000);
                              }}
                              className="p-1 bg-[#141416] border border-[#2C2C2F] text-[#8E8E93] hover:text-white rounded hover:bg-[#202024] transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                              title="Copy Row"
                            >
                              {copiedIndex === i ? <Check size={10} className="text-[#3ECF8E]" /> : <Copy size={10} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    
                    {filteredConsoleLogs.length === 0 && (
                      <div className="h-48 flex flex-col items-center justify-center relative py-12">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(62,207,142,0.03),transparent_70%)] pointer-events-none" />
                        <div className="w-9 h-9 rounded-xl bg-[#141416] border border-[#222] flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(0,0,0,0.8)] text-[#3ECF8E] relative">
                          <Terminal size={16} className="animate-pulse opacity-30" />
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#555] font-mono select-none">READY // NO PACKETS DETECTED</p>
                      </div>
                    )}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

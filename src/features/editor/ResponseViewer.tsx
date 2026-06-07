import React, { Suspense } from 'react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Database, Globe, Save, Terminal, Layout, AlertTriangle } from 'lucide-react';
import { PersistenceService } from '../../services/PersistenceService';
import { VisualizerPanel } from './VisualizerPanel';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const Editor = React.lazy(() => import('@monaco-editor/react'));

export const ResponseViewer: React.FC = () => {
  const { lastResponse, theme } = useStore();
  const [activeTab, setActiveTab] = React.useState<'Body' | 'Headers' | 'Tests' | 'Console' | 'Visualizer'>('Body');

  if (!lastResponse) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-dim bg-deep relative overflow-hidden">
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
                className="w-1 h-1 rounded-full bg-[var(--brand)]"
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
    <div className="h-full flex flex-col bg-deep">
      {/* Response Header */}
      <div className="h-9 px-4 border-b border-subtle flex items-center justify-between bg-header shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isError ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-[var(--brand)] shadow-[0_0_8px_rgba(var(--brand-rgb),0.4)]"
            )} />
            <span className={cn(
              "text-[9px] font-black uppercase tracking-[0.15em]",
              isError ? "text-red-500" : "text-[var(--brand)]"
            )}>
              {lastResponse.status} {lastResponse.statusText || (isError ? 'Error' : 'Success')}
            </span>
          </div>

          <div className="flex items-center gap-3 text-dim">
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
              className="mr-3 px-2 py-1 flex items-center gap-1.5 text-[8px] font-black text-dim hover:text-[var(--brand)] transition-all uppercase tracking-widest hover:bg-white/5 rounded"
            >
              <Save size={10} />
              Snapshot
            </button>
            <div className="w-px h-3 bg-elevated mr-3" />
            <div className="flex">
              {(['Body', 'Headers', 'Tests', 'Visualizer', 'Console'] as const).map((tab) => (
                <button
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={cn(
                     "h-9 px-3 text-[8px] font-black uppercase tracking-[0.2em] border-b-2 transition-all relative",
                     activeTab === tab ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-dim hover:text-muted"
                   )}
                >
                  {tab}
                  {tab === 'Tests' && lastResponse.testResults && (
                    <span className={cn(
                      "ml-1.5 px-1 rounded-[2px] text-[7px] font-bold",
                      lastResponse.testResults.every(r => r.status === 'pass') ? "bg-[var(--brand)]/20 text-[var(--brand)]" : "bg-red-500/20 text-red-500"
                    )}>
                      {lastResponse.testResults.filter(r => r.status === 'pass').length}/{lastResponse.testResults.length}
                    </span>
                  )}
                  {tab === 'Console' && lastResponse.consoleLogs && lastResponse.consoleLogs.length > 0 && (
                    <span className="ml-1.5 px-1 rounded-[2px] text-[7px] font-bold bg-blue-500/20 text-blue-400">
                      {lastResponse.consoleLogs.length}
                    </span>
                  )}
                  {tab === 'Visualizer' && (
                    lastResponse.contentType?.toLowerCase().includes('html') 
                      ? <span className="ml-1.5 px-1 rounded-[2px] text-[7px] font-bold bg-amber-500/20 text-amber-400">HTML</span>
                      : <Layout size={10} className="ml-1 inline-block" />
                  )}
                </button>
              ))}
            </div>
        </div>
      </div>

      {/* Response Content */}
      <div className="flex-1 overflow-auto custom-scrollbar p-3">
        <div className="h-full w-full rounded-lg border border-subtle bg-header overflow-hidden shadow-2xl">
          {activeTab === 'Body' && (
            <Suspense fallback={
              <div className="absolute inset-0 flex items-center justify-center bg-header text-dim text-xs font-mono">
                Drawing response body...
              </div>
            }>
              <Editor
                height="100%"
                language={(lastResponse.contentType || '').includes('json') ? 'json' : (lastResponse.contentType || '').includes('html') ? 'html' : 'text'}
                value={content}
                theme={theme === 'light' ? 'vs' : 'vs-dark'}
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
            </Suspense>
          )}

          {activeTab === 'Headers' && (
            <div className="p-6 space-y-2">
              {Object.entries(lastResponse.headers || {}).map(([key, value]) => (
                <div key={key} className="flex border-b border-subtle pb-2 last:border-0">
                  <div className="w-1/3 text-[10px] font-black text-dim uppercase tracking-widest">{key}</div>
                  <div className="flex-1 text-[11px] font-mono text-muted break-all">{value}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'Tests' && (
            <div className="p-6 space-y-4">
               {lastResponse.testResults?.map((result, i) => (
                 <div key={i} className="flex items-center justify-between p-4 bg-input rounded-xl border border-subtle">
                    <div className="flex items-center gap-3">
                       <div className={cn(
                         "w-1.5 h-1.5 rounded-full",
                         result.status === 'pass' ? "bg-[var(--brand)]" : "bg-red-500"
                       )} />
                       <div className="text-[11px] font-bold text-white uppercase tracking-tight">{result.name}</div>
                    </div>
                    <div className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                      result.status === 'pass' ? "bg-[var(--brand)]/10 text-[var(--brand)]" : "bg-red-500/10 text-red-500"
                    )}>
                      {result.status}
                    </div>
                 </div>
               ))}
               {(!lastResponse.testResults || lastResponse.testResults.length === 0) && (
                 <div className="h-40 flex flex-col items-center justify-center text-dim">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-20">No Protocol Verifications Found</span>
                 </div>
               )}
            </div>
          )}

          {activeTab === 'Visualizer' && (
            <ErrorBoundary fallback={
              <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4 bg-[var(--bg-deep)]">
                <AlertTriangle size={32} className="text-red-500/50" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500/70">Visualizer Engine Error</p>
                <p className="text-[9px] text-[var(--text-dim)] max-w-xs">
                  The visualizer encountered an error. Try switching to the Body tab to view the raw response data.
                </p>
              </div>
            }>
              <VisualizerPanel />
            </ErrorBoundary>
          )}

          {activeTab === 'Console' && (
            <div className="flex flex-col h-full bg-deep">
               <div className="flex-1 overflow-y-auto font-mono text-[11px] selection:bg-[var(--brand)]/30 custom-scrollbar divide-y divide-white/[0.03]">
                    {lastResponse.consoleLogs?.map((log, i) => (
                      <div key={i} className="flex gap-0 hover:bg-white/[0.02] transition-colors group items-start">
                        <div className="px-4 py-1.5 text-dim shrink-0 tabular-nums text-[9px] border-r border-white/[0.02] bg-white/[0.01] min-w-[100px] text-center">
                          LOG-SEG-{(i+1).toString().padStart(3, '0')}
                        </div>
                        <div className="flex-1 flex gap-3 px-4 py-1.5 items-start">
                          <div className={cn(
                            "text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded shrink-0 min-w-[40px] text-center mt-0.5 border",
                            log.level === 'error' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                            log.level === 'warn' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500" :
                            "bg-[var(--brand)]/10 border-[var(--brand)]/20 text-[var(--brand)]"
                          )}>{log.level}</div>
                          
                          <div className="flex-1 overflow-x-auto no-scrollbar pb-1">
                            <div className={cn(
                              "flex flex-wrap gap-2 leading-tight font-medium",
                              log.level === 'error' ? 'text-red-400' :
                              log.level === 'warn' ? 'text-yellow-400' : 'text-muted'
                            )}>
                              {(log.args || []).map((arg: any, j: number) => (
                                <div key={j} className="whitespace-pre-wrap break-all">
                                  {typeof arg === 'object' ? (
                                    <span className="text-[var(--brand)]/80">{JSON.stringify(arg, null, 2)}</span>
                                  ) : (
                                    <span>{String(arg)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!lastResponse.consoleLogs || lastResponse.consoleLogs.length === 0) && (
                      <div className="h-64 flex flex-col items-center justify-center text-dim">
                        <Terminal size={24} className="mb-4 opacity-5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-10">Awaiting Signal</span>
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

import React from 'react';
import { Clock, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface LogsPanelProps {
  filteredLogs: any[];
  selectedLog: any;
  setSelectedLog: (log: any) => void;
  addToast: (toast: any) => void;
  addTab: (tab: any) => void;
  onClearHistory: () => void;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({
  filteredLogs,
  selectedLog,
  setSelectedLog,
  addToast,
  addTab,
  onClearHistory,
}) => {
  return (
    <div className="px-1 flex flex-col h-full animate-in fade-in duration-300">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#1A1A1E]/30 bg-[#070708]/10 mb-2 shrink-0">
        <span className="text-[8px] font-black text-[#55555C] uppercase tracking-[0.2em] font-mono">Stream transaction logs</span>
        <button
          onClick={onClearHistory}
          className="text-[8px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest"
          title="Clear History Logs"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-1">
        {filteredLogs.map((item, idx) => {
          const isErr = item.status && item.status >= 400;
          return (
            <div
              key={idx}
              onClick={() => setSelectedLog(selectedLog?.id === item.id ? null : item)}
              className={cn(
                "px-4 py-2 hover:bg-white/[0.02] cursor-pointer group border-l-2 relative transition-all border-y border-[#1A1A1E]/20 bg-[#09090B]/30",
                selectedLog?.id === item.id
                  ? "bg-[#3ECF8E]/[0.02] border-[#3ECF8E] shadow-[inset_4px_0_12px_rgba(62,207,142,0.02)]"
                  : (isErr ? "border-red-500/30" : "border-transparent")
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0 pr-6">
                  <span className={cn(
                    "text-[8px] font-black px-1.5 py-0.5 rounded font-mono uppercase tracking-tighter shrink-0",
                    item.method === 'GET' ? 'bg-[#3ECF8E]/10 text-[#3ECF8E]' :
                    item.method === 'POST' ? 'bg-amber-500/10 text-amber-500' : 'bg-[#1A1A1E] text-[#AAAAAF]'
                  )}>
                    {item.method}
                  </span>
                  <span className="truncate text-[10px] text-[#88888F] font-mono group-hover:text-white transition-colors">
                    {item.request_name || item.url}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-[9px] shrink-0">
                  {item.status ? (
                    <span className={isErr ? "text-red-500 font-bold" : "text-[#3ECF8E] font-bold"}>
                      {item.status}
                    </span>
                  ) : (
                    <span className="text-[#55555C]">No Status</span>
                  )}
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    isErr ? "bg-red-500 shadow-[0_0_6px_#ef4444]" : "bg-[#3ECF8E] shadow-[0_0_6px_#3ecf8e]"
                  )} />
                </div>
              </div>

              <div className="flex items-center justify-between text-[7px] text-[#55555C] font-mono pl-10 uppercase tracking-widest">
                <span className="flex items-center gap-1">
                  <Clock size={8} /> {new Date(item.created_at || '').toLocaleTimeString()}
                </span>
                {item.time && <span>{item.time} ms</span>}
                {item.size && <span>{item.size} bytes</span>}
              </div>

              <AnimatePresence>
                {selectedLog?.id === item.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    className="overflow-hidden border-t border-[#1A1A22] pt-2 mt-2 space-y-2 text-[9px] uppercase tracking-wide text-[#88888F] animate-in slide-in-from-top-2 duration-200"
                  >
                    <div className="p-2.5 bg-[#070708] rounded-lg border border-[#1A1A22] font-mono space-y-2 select-text">
                      <div>
                        <span className="text-[#55555C] font-black">Endpoint URL:</span>
                        <div className="text-white break-all mt-0.5 text-[8px] lowercase font-normal">{item.url}</div>
                      </div>
                      {item.request_data && (
                        <div>
                          <span className="text-[#55555C] font-black">Transmission Payload:</span>
                          <pre className="text-[#3ECF8E] text-[7px] overflow-x-auto p-1 bg-black/40 rounded mt-1 max-h-24 no-scrollbar lowercase font-mono">
                            {typeof item.request_data === 'object'
                              ? JSON.stringify(item.request_data, null, 2)
                              : String(item.request_data)}
                          </pre>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (item.request_data) {
                              addTab({
                                ...item.request_data,
                                id: `history-${item.id}`,
                                name: `${item.method} Request Replay`
                              });
                              addToast({ type: 'success', message: 'Replaying request node in editor.' });
                            }
                          }}
                          className="flex-1 py-1 rounded bg-[#3ECF8E]/10 border border-[#3ECF8E]/25 text-[#3ECF8E] hover:bg-[#3ECF8E]/20 text-[8px] font-black text-center"
                        >
                          Load in Workspace
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {filteredLogs.length === 0 && (
          <div className="text-center py-16 px-4">
            <Terminal size={24} className="mx-auto text-[#1D1D22] mb-3" />
            <p className="text-[9px] font-black text-[#44444F] uppercase tracking-widest">Logs catalog empty</p>
          </div>
        )}
      </div>
    </div>
  );
};

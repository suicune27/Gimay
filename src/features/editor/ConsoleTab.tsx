import React from 'react';
import { cn } from '../../lib/utils';
import { Terminal } from 'lucide-react';

interface ConsoleLog {
  level: string;
  args?: any[];
  [key: string]: any;
}

interface ConsoleTabProps {
  consoleLogs?: ConsoleLog[];
}

export const ConsoleTab: React.FC<ConsoleTabProps> = ({ consoleLogs }) => {
  if (!consoleLogs || consoleLogs.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-dim">
        <Terminal size={24} className="mb-4 opacity-5" />
        <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-10">Awaiting Signal</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-deep">
      <div className="flex-1 overflow-y-auto font-mono text-[11px] selection:bg-[var(--brand)]/30 custom-scrollbar divide-y divide-white/[0.03]">
        {consoleLogs.map((log, i) => (
          <div key={i} className="flex gap-0 hover:bg-elevated transition-colors group items-start">
            <div className="px-4 py-1.5 text-dim shrink-0 tabular-nums text-[9px] border-r border-subtle bg-white/[0.01] min-w-[100px] text-center">
              LOG-SEG-{(i + 1).toString().padStart(3, '0')}
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
      </div>
    </div>
  );
};

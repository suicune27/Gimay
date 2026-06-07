import React from 'react';
import { cn } from '../../lib/utils';

interface TestResult {
  name: string;
  status: 'pass' | 'fail';
  [key: string]: any;
}

interface TestsTabProps {
  testResults?: TestResult[];
}

export const TestsTab: React.FC<TestsTabProps> = ({ testResults }) => {
  if (!testResults || testResults.length === 0) {
    return (
      <div className="h-40 flex flex-col items-center justify-center text-dim">
        <span className="text-[10px] font-black uppercase tracking-widest opacity-20">No Protocol Verifications Found</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {testResults.map((result, i) => (
        <div key={i} className="flex items-center justify-between p-4 bg-elevated rounded-xl border border-subtle">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              result.status === 'pass' ? "bg-[var(--brand)]" : "bg-red-500"
            )} />
            <div className="text-[11px] font-bold text-main uppercase tracking-tight">{result.name}</div>
          </div>
          <div className={cn(
            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
            result.status === 'pass' ? "bg-[var(--brand)]/10 text-[var(--brand)]" : "bg-red-500/10 text-red-500"
          )}>
            {result.status}
          </div>
        </div>
      ))}
    </div>
  );
};

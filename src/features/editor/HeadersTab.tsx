import React from 'react';

interface HeadersTabProps {
  headers: Record<string, string>;
}

export const HeadersTab: React.FC<HeadersTabProps> = ({ headers }) => {
  const entries = Object.entries(headers || {});

  if (entries.length === 0) {
    return (
      <div className="h-40 flex flex-col items-center justify-center text-dim">
        <span className="text-[10px] font-black uppercase tracking-widest opacity-20">No Headers Found</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex border-b border-subtle pb-2 last:border-0">
          <div className="w-1/3 text-[10px] font-black text-dim uppercase tracking-widest">{key}</div>
          <div className="flex-1 text-[11px] font-mono text-muted break-all">{String(value)}</div>
        </div>
      ))}
    </div>
  );
};

import React from 'react';
import { Globe, Search, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Environment } from '../../types';

interface EnvironmentMenuProps {
  environments: Environment[];
  activeEnvId: string | null;
  onSelect: (id: string | null) => void;
  envFilterQuery: string;
  onFilterChange: (query: string) => void;
  filteredEnvironments: Environment[];
}

export const EnvironmentMenu: React.FC<EnvironmentMenuProps> = ({
  environments,
  activeEnvId,
  onSelect,
  envFilterQuery,
  onFilterChange,
  filteredEnvironments,
}) => {
  const activeEnvironment = environments.find(e => e.id === activeEnvId);

  return (
    <div className={cn(
      "absolute top-full left-0 mt-1 w-64 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-2xl py-2 transition-all z-50",
      "opacity-100 visible translate-y-0"
    )}>
      <div className="px-4 py-2 border-b border-[var(--border-subtle)] space-y-2">
        <h3 className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Select Environment</h3>
        <div className="relative">
          <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#444444]" />
          <input
            type="text"
            placeholder="Search environments..."
            value={envFilterQuery}
            onChange={(e) => onFilterChange(e.target.value)}
            className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg py-1 pl-7 pr-3 text-[9px] font-mono text-white outline-none focus:border-[var(--brand)]/35 placeholder:text-[#333333]"
          />
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto no-scrollbar py-1">
        <div
          onClick={() => onSelect(null)}
          className={cn(
            "w-full px-4 py-2 flex items-center justify-between hover:bg-[var(--bg-deep)] cursor-pointer transition-colors text-[9px] font-black uppercase tracking-widest",
            activeEnvId === null ? "text-[var(--brand)] bg-[var(--brand)]/5" : "text-[var(--text-muted)] hover:text-white"
          )}
        >
          <span>No Environment</span>
          {activeEnvId === null && <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] shadow-[0_0_6px_var(--brand)]" />}
        </div>

        {filteredEnvironments.map(env => (
          <div
            key={env.id}
            onClick={() => onSelect(env.id)}
            className={cn(
              "w-full px-4 py-2 flex items-center justify-between hover:bg-[var(--bg-deep)] cursor-pointer transition-colors text-[9px] font-black uppercase tracking-widest",
              activeEnvId === env.id ? "text-[var(--brand)] bg-[var(--brand)]/5" : "text-[var(--text-muted)] hover:text-white"
            )}
          >
            <div className="flex items-center gap-2 min-w-0 pr-4">
              <span className={cn(
                "w-2 h-2 rounded-full shrink-0",
                activeEnvId === env.id ? "bg-[var(--brand)]" : "bg-[#55555C]"
              )} />
              <span className="truncate">{env.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[7px] text-[#444444] font-mono">
                {env.is_global ? 'Cloud' : 'Local'}
              </span>
              {activeEnvId === env.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] shadow-[0_0_6px_var(--brand)]" />
              )}
            </div>
          </div>
        ))}

        {filteredEnvironments.length === 0 && envFilterQuery && (
          <div className="px-4 py-3 text-center text-[9px] text-[#55555C] uppercase tracking-widest">
            No matching modules
          </div>
        )}
      </div>
    </div>
  );
};

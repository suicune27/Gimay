import React from 'react';
import { Search, ChevronsLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarSearchBarProps {
  activeNav: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  methodFilter: string | null;
  onMethodFilterChange: (method: string | null) => void;
  logFilter: 'all' | 'success' | 'error';
  onLogFilterChange: (filter: 'all' | 'success' | 'error') => void;
  onClearFilters: () => void;
}

export const SidebarSearchBar: React.FC<SidebarSearchBarProps> = ({
  activeNav,
  searchQuery,
  onSearchChange,
  methodFilter,
  onMethodFilterChange,
  logFilter,
  onLogFilterChange,
  onClearFilters
}) => {
  if (activeNav === 'scripts') return null;

  return (
    <div className="px-5 py-3 border-b border-[#1A1A1E] bg-[#070708]/30 flex flex-col gap-2 shrink-0">
      <div className="relative group">
        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#44444F] group-focus-within:text-[#3ECF8E] transition-colors" />
        <input
          type="text"
          placeholder="Scan directory components..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[#070708] border border-[#1A1A1E] rounded-lg py-1.5 pl-8 pr-6 text-[10px] font-mono text-[#E0E0E6] placeholder-[#44444F] focus:border-[#3ECF8E]/30 outline-none transition-all focus:shadow-[0_0_10px_rgba(62,207,142,0.02)]"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold uppercase text-[#55555C] hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        <button
          onClick={() => onMethodFilterChange(methodFilter ? null : 'GET')}
          className={cn(
            "text-[8px] font-black uppercase px-2 py-0.5 rounded border transition-all shrink-0 font-mono",
            methodFilter === 'GET'
              ? "bg-[#3ECF8E]/10 border-[#3ECF8E]/35 text-[#3ECF8E] shadow-[0_0_8px_rgba(62,207,142,0.05)]"
              : "bg-[#09090B] border-[#1A1A1E] text-[#55555C] hover:text-[#AAAAAF]"
          )}
        >
          GET
        </button>
        <button
          onClick={() => onMethodFilterChange(methodFilter ? null : 'POST')}
          className={cn(
            "text-[8px] font-black uppercase px-2 py-0.5 rounded border transition-all shrink-0 font-mono",
            methodFilter === 'POST'
              ? "bg-amber-500/10 border-amber-500/35 text-amber-500"
              : "bg-[#09090B] border-[#1A1A1E] text-[#55555C] hover:text-[#AAAAAF]"
          )}
        >
          POST
        </button>
        {activeNav === 'history' && (
          <>
            <button
              onClick={() => onLogFilterChange(logFilter === 'success' ? 'all' : 'success')}
              className={cn(
                "text-[8px] font-black uppercase px-2 py-0.5 rounded border transition-all shrink-0",
                logFilter === 'success'
                  ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-500"
                  : "bg-[#09090B] border-[#1A1A1E] text-[#55555C] hover:text-[#AAAAAF]"
              )}
            >
              Success
            </button>
            <button
              onClick={() => onLogFilterChange(logFilter === 'error' ? 'all' : 'error')}
              className={cn(
                "text-[8px] font-black uppercase px-2 py-0.5 rounded border transition-all shrink-0",
                logFilter === 'error'
                  ? "bg-red-500/10 border-red-500/35 text-red-500"
                  : "bg-[#09090B] border-[#1A1A1E] text-[#55555C] hover:text-[#AAAAAF]"
              )}
            >
              Failures
            </button>
          </>
        )}
        {(methodFilter || logFilter !== 'all') && (
          <button
            onClick={onClearFilters}
            className="text-[8px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest pl-1 shrink-0"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};

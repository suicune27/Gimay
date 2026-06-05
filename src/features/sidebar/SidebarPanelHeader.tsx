import React from 'react';
import { Pin } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarPanelHeaderProps {
  workspaceName: string;
  workspaceVisibility?: string;
  isSidebarPinned: boolean;
  onTogglePin: () => void;
}

export const SidebarPanelHeader: React.FC<SidebarPanelHeaderProps> = ({
  workspaceName,
  workspaceVisibility,
  isSidebarPinned,
  onTogglePin
}) => {
  return (
    <div className="h-14 border-b border-[#1A1A1E] flex items-center justify-between px-5 bg-[#09090B]/60 shrink-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] shadow-[0_0_8px_#3ECF8E]" />
          <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] truncate">
            {workspaceName}
          </h2>
        </div>
        <p className="text-[7px] text-[#55555C] font-mono tracking-tighter uppercase font-bold mt-0.5">
          Node Engine // {workspaceVisibility || 'Private'}
        </p>
      </div>

      <button
        onClick={onTogglePin}
        className="p-1.5 text-[#55555C] hover:text-[var(--brand)] rounded hover:bg-white/[0.02] transition-colors"
        title={isSidebarPinned ? "Unlock Sidebar" : "Lock Sidebar"}
      >
        <Pin size={14} className={cn("transition-transform duration-200", !isSidebarPinned && "rotate-45")} />
      </button>
    </div>
  );
};

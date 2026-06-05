import React from 'react';
import { LayoutGrid, ChevronDown, Plus, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Workspace } from '../../types';

interface WorkspaceMenuProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onSelect: (id: string) => void;
  onRename: (ws: Workspace) => void;
  onDelete: (id: string, name: string) => void;
  onCreateNew: () => void;
}

export const WorkspaceMenu: React.FC<WorkspaceMenuProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelect,
  onRename,
  onDelete,
  onCreateNew
}) => {
  return (
    <div className="max-h-60 overflow-y-auto no-scrollbar">
      {workspaces.map(ws => (
        <div
          key={ws.id}
          onClick={() => onSelect(ws.id)}
          className={cn(
            "w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-deep)] cursor-pointer transition-colors text-left group/ws",
            activeWorkspaceId === ws.id ? "bg-[var(--brand)]/5" : ""
          )}
        >
          <div className={cn(
            "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shadow-sm",
            activeWorkspaceId === ws.id ? "bg-[var(--brand)] text-black" : "bg-[var(--bg-deep)] text-[var(--text-dim)]"
          )}>
            {(ws.name || 'W')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className={cn(
              "text-[10px] font-bold truncate",
              activeWorkspaceId === ws.id ? "text-[var(--brand)]" : "text-[var(--text-muted)]"
            )}>
              {ws.name}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover/ws:opacity-100 transition-all">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRename(ws);
              }}
              className="p-1 hover:text-[var(--text-main)] text-[var(--text-dim)]"
            >
              <Settings size={10} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(ws.id, ws.name);
              }}
              className="p-1 hover:text-red-500 text-[var(--text-dim)]"
            >
              <Plus size={10} className="rotate-45" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

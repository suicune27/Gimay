import React, { useState } from 'react';
import { 
  FileCode, 
  Folder, 
  Plus, 
  Search, 
  ChevronRight, 
  MoreVertical, 
  Trash2, 
  Copy, 
  Edit3,
  Star
} from 'lucide-react';
import { useScriptStore } from '../../store/scriptStore';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { Script } from '../../types';
import { PersistenceService } from '../../services/PersistenceService';

export const ScriptSidebar: React.FC = () => {
  const { scripts, folders, addTab, activeTabId, addScript, deleteScript, setScripts } = useScriptStore();
  const { profile, activeWorkspaceId, addToast } = useStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredScripts = scripts.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateScript = async () => {
    if (!profile?.id || !activeWorkspaceId) {
      addToast({ type: 'warning', message: 'No active workspace detected.' });
      return;
    }
    try {
      const newScript = await PersistenceService.createScript({
        name: 'Untitled Script',
        content: '// Write your code here\n',
        workspace_id: activeWorkspaceId,
        user_id: profile.id,
      });
      addScript(newScript);
      addTab(newScript.id);
      addToast({ type: 'success', message: 'New script initialized.' });
    } catch (e) {
      addToast({ type: 'error', message: 'Failed to initialize script.' });
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await PersistenceService.deleteScript(id);
      deleteScript(id);
      addToast({ type: 'info', message: 'Script deleted.' });
    } catch (e) {
      addToast({ type: 'error', message: 'Deletion failed.' });
    }
  };

  const [renamingId, setRenamingId] = useState<string | null>(null);

  const handleRename = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await PersistenceService.updateScript(id, { name: newName });
      useScriptStore.getState().updateScript(id, { name: newName });
      setRenamingId(null);
    } catch (e) {
      addToast({ type: 'error', message: 'Rename failed.' });
    }
  };

  return (
    <div className="w-64 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col shrink-0">
      <div className="p-4 border-b border-[var(--border-subtle)] space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-black text-[var(--text-main)] uppercase tracking-widest">Script Explorer</h2>
          <button 
            onClick={handleCreateScript}
            className="p-1.5 hover:bg-[var(--brand)]/10 hover:text-[var(--brand)] text-[var(--text-muted)] rounded-md transition-all border border-[var(--border-subtle)] hover:border-[var(--brand)]/30"
            title="New Script"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="relative group">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--border-strong)] group-focus-within:text-[var(--brand)] transition-colors" />
          <input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="FILTER_SCRIPTS..."
            className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-md py-1.5 pl-8 pr-3 text-[10px] font-mono text-[var(--text-muted)] focus:border-[var(--brand)]/40 outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {filteredScripts.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center">
            <FileCode size={32} className="mb-2 text-[var(--border-subtle)]" />
            <p className="text-[9px] font-black text-[var(--border-strong)] uppercase tracking-widest mb-4">No scripts found</p>
            <button 
              onClick={handleCreateScript}
              className="px-4 py-2 bg-[var(--brand)]/10 border border-[var(--brand)]/30 rounded-lg text-[9px] font-black text-[var(--brand)] uppercase tracking-widest hover:bg-[var(--brand)]/20 transition-all flex items-center gap-2"
            >
              <Plus size={12} />
              Create First Script
            </button>
          </div>
        ) : (
          filteredScripts.map((script) => (
            <div 
              key={script.id}
              onClick={() => addTab(script.id)}
              className={cn(
                "group flex items-center px-4 py-2 cursor-pointer transition-all border-l-2",
                useScriptStore.getState().openTabs.find(t => t.scriptId === script.id && t.id === activeTabId)
                  ? "bg-[var(--brand)]/5 border-[var(--brand)] text-[var(--text-main)]" 
                  : "border-transparent text-[var(--text-dim)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-muted)]"
              )}
            >
              <FileCode size={14} className="mr-3 shrink-0" />
              {renamingId === script.id ? (
                <input 
                  autoFocus
                  defaultValue={script.name}
                  onBlur={(e) => handleRename(script.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(script.id, e.currentTarget.value);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[var(--bg-deep)] border border-[var(--brand)]/30 rounded px-2 py-0.5 text-[10px] text-[var(--text-main)] outline-none w-full"
                />
              ) : (
                <span className="text-[10px] font-bold truncate flex-1">{script.name}</span>
              )}
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={(e) => { e.stopPropagation(); setRenamingId(script.id); }}
                  className="p-1 hover:text-[var(--brand)] text-[var(--border-strong)] transition-all"
                >
                  <Edit3 size={12} />
                </button>
                <button 
                  onClick={(e) => handleDelete(script.id, e)}
                  className="p-1 hover:text-red-500 text-[var(--border-strong)] transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

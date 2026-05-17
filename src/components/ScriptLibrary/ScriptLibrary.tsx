import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Code2, Sparkles, Terminal, Plus } from 'lucide-react';
import { useScriptStore } from '../../store/scriptStore';
import { useStore } from '../../store/useStore';
import { ScriptSidebar } from './ScriptSidebar';
import { ScriptEditor } from './ScriptEditor';
import { ConsolePanel } from './ConsolePanel';
import { PersistenceService } from '../../services/PersistenceService';

interface ScriptLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ScriptLibrary: React.FC<ScriptLibraryProps> = ({ isOpen, onClose }) => {
  const { profile, activeWorkspaceId, addToast } = useStore();
  const { setScripts, setFolders } = useScriptStore();

  useEffect(() => {
    if (isOpen && activeWorkspaceId) {
      const loadData = async () => {
        try {
          const [scripts, folders] = await Promise.all([
            PersistenceService.fetchScripts(activeWorkspaceId),
            PersistenceService.fetchScriptFolders(activeWorkspaceId)
          ]);
          setScripts(scripts);
          setFolders(folders);
        } catch (e) {
          console.error('Failed to load script library:', e);
        }
      };
      loadData();
    }
  }, [isOpen, activeWorkspaceId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Modal Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full h-full bg-surface border border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10"
      >
        {/* Header */}
        <div className="h-14 border-b border-subtle flex items-center justify-between px-6 bg-deep shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center shadow-[0_0_15px_var(--brand-muted)]">
              <Code2 size={16} className="text-[var(--bg-deep)]" />
            </div>
            <div>
              <h1 className="text-[12px] font-black text-main uppercase tracking-[0.2em] flex items-center gap-2">
                Script Laboratory
                <Sparkles size={12} className="text-brand" />
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
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
                  useScriptStore.getState().addScript(newScript);
                  useScriptStore.getState().addTab(newScript.id);
                  addToast({ type: 'success', message: 'New script initialized.' });
                } catch (e) {
                  addToast({ type: 'error', message: 'Failed to initialize script.' });
                }
              }}
              className="px-3 py-1.5 bg-brand text-[var(--bg-deep)] text-[10px] font-black rounded-lg uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
            >
              <Plus size={14} /> New Script
            </button>
            <div className="h-4 w-px bg-[var(--border-subtle)]" />
            <button 
              onClick={onClose}
              className="p-1.5 text-dim hover:text-main transition-all hover:bg-elevated rounded-md"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          <ScriptSidebar />
          <div className="flex-1 flex flex-col min-w-0 bg-surface relative">
            <ScriptEditor />
            <ConsolePanel />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

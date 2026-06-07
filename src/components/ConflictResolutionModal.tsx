import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, X, RefreshCw, Cloud, Trash2, CheckCircle2,
  FileText, FolderOpen, Globe, Box, Terminal, ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getConflicts, resolveKeepLocal, resolveUseCloud, resolveDiscardLocal, type ConflictItem } from '../services/ConflictResolver';
import { useStore } from '../store/useStore';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  request: <FileText size={14} />,
  collection: <FolderOpen size={14} />,
  folder: <Box size={14} />,
  environment: <Globe size={14} />,
  workspace: <Terminal size={14} />,
};

type ResolveAction = 'keep-local' | 'use-cloud' | 'discard' | null;

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({ isOpen, onClose }) => {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: ResolveAction } | null>(null);
  const addToast = useStore(s => s.addToast);

  const loadConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getConflicts();
      setConflicts(items);
    } catch (err) {
      console.error('[ConflictModal] Failed to load conflicts:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) loadConflicts();
  }, [isOpen, loadConflicts]);

  const handleResolve = async (item: ConflictItem, action: ResolveAction) => {
    if (!action) return;
    setResolvingId(`${item.entityType}:${item.id}`);
    setConfirmAction(null);

    try {
      switch (action) {
        case 'keep-local':
          await resolveKeepLocal(item.entityType, item.id);
          addToast({ type: 'info', message: `Keeping local version of ${item.tableName} "${item.name}". Will retry sync.` });
          break;
        case 'use-cloud':
          await resolveUseCloud(item.entityType, item.id);
          addToast({ type: 'success', message: `Replaced local ${item.tableName} "${item.name}" with cloud version.` });
          break;
        case 'discard':
          await resolveDiscardLocal(item.entityType, item.id);
          addToast({ type: 'warning', message: `Discarded local ${item.tableName} "${item.name}".` });
          break;
      }
      // Refresh list
      await loadConflicts();
    } catch (err: any) {
      addToast({ type: 'error', message: `Failed to resolve conflict: ${err.message}` });
    }
    setResolvingId(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-glass-bg backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative w-full max-w-2xl max-h-[80vh] flex flex-col bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-modal overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-red-400" />
                </div>
                <div>
                  <h2 className="text-[11px] font-black text-[var(--text-main)] uppercase tracking-widest">
                    Sync Conflicts
                  </h2>
                  <p className="text-[8px] text-[var(--text-dim)] font-mono uppercase tracking-wider mt-0.5">
                    {conflicts.length} item{conflicts.length !== 1 ? 's' : ''} need attention
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadConflicts}
                  className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
              {loading && conflicts.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={18} className="text-[var(--text-dim)] animate-spin" />
                </div>
              )}

              {!loading && conflicts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 size={28} className="text-[var(--brand)] mb-3" />
                  <p className="text-[11px] font-black text-[var(--text-main)] uppercase tracking-widest">
                    All Clear
                  </p>
                  <p className="text-[9px] text-[var(--text-dim)] font-mono mt-1.5">
                    No sync conflicts to resolve
                  </p>
                </div>
              )}

              {conflicts.map((item) => {
                const resolveKey = `${item.entityType}:${item.id}`;
                const isResolving = resolvingId === resolveKey;

                return (
                  <motion.div
                    key={resolveKey}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[var(--bg-elevated)] border border-red-500/15 rounded-xl p-4 space-y-3"
                  >
                    {/* Item header */}
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 text-red-400">
                        {TYPE_ICONS[item.entityType] || <Box size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-red-400 uppercase tracking-widest font-mono px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                            {item.tableName}
                          </span>
                          <span className="text-[9px] text-[var(--text-dim)] font-mono truncate">
                            {item.id.slice(0, 12)}...
                          </span>
                        </div>
                        <p className="text-[11px] font-bold text-[var(--text-main)] mt-1 truncate">
                          {item.name}
                        </p>
                        <p className="text-[8px] text-red-400/80 font-mono mt-1 leading-relaxed break-all line-clamp-2">
                          {item.lastError}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {isResolving ? (
                      <div className="flex items-center justify-center py-2">
                        <RefreshCw size={14} className="text-blue-400 animate-spin" />
                        <span className="ml-2 text-[9px] text-[var(--text-dim)] font-mono">Resolving...</span>
                      </div>
                    ) : confirmAction?.id === resolveKey ? (
                      <div className="flex items-center gap-2 pt-1 border-t border-red-500/10">
                        <span className="text-[9px] text-[var(--text-dim)] font-mono mr-1">
                          {confirmAction.action === 'discard' ? 'Discard local version?' :
                           confirmAction.action === 'use-cloud' ? 'Replace with cloud version?' :
                           'Keep local & retry sync?'}
                        </span>
                        <button
                          onClick={() => handleResolve(item, confirmAction.action)}
                          className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 text-[8px] font-black uppercase tracking-widest hover:bg-red-500/30 transition-all"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmAction(null)}
                          className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
                        <button
                          onClick={() => setConfirmAction({ id: resolveKey, action: 'keep-local' })}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--brand)]/10 text-[var(--brand)] border border-[var(--brand)]/20 text-[8px] font-black uppercase tracking-widest hover:bg-[var(--brand)]/20 transition-all flex items-center justify-center gap-1"
                        >
                          <RefreshCw size={10} />
                          Keep Local
                        </button>
                        <button
                          onClick={() => setConfirmAction({ id: resolveKey, action: 'use-cloud' })}
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all flex items-center justify-center gap-1"
                        >
                          <Cloud size={10} />
                          Use Cloud
                        </button>
                        <button
                          onClick={() => setConfirmAction({ id: resolveKey, action: 'discard' })}
                          className="px-2.5 py-1.5 rounded-lg text-red-400 text-[8px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all flex items-center gap-1"
                          title="Discard local version"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            {conflicts.length > 0 && (
              <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between shrink-0 bg-[var(--bg-elevated)]/50">
                <p className="text-[8px] text-[var(--text-dim)] font-mono">
                  Conflicts occur when cloud sync permanently fails after retries
                </p>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-[8px] font-black uppercase tracking-widest hover:border-[var(--border-strong)] transition-all"
                >
                  Close
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

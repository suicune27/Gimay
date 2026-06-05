import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus } from 'lucide-react';

interface DisconnectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  profile: { email?: string } | null;
  workspaceName?: string;
}

export const DisconnectDialog: React.FC<DisconnectDialogProps> = ({
  isOpen,
  onClose,
  onRefresh,
  profile,
  workspaceName,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl p-6 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-[var(--brand)] to-blue-500" />

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                  <Plus className="rotate-45" size={16} />
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-white uppercase tracking-widest font-mono">Secure Node Handshake Closed</h3>
                  <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-tight mt-0.5">Desktop Core Terminal Sandbox Instance</p>
                </div>
              </div>

              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed font-mono">
                You requested to shutdown the active desktop shell. Because you are in secure cloud preview mode, the database uplink remains synchronized. Your active tokens are securely stored in the Supabase network.
              </p>

              <div className="bg-black/35 border border-[var(--border-subtle)] rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between text-[8px] font-mono uppercase tracking-tight">
                  <span className="text-[var(--text-dim)]">Session Status</span>
                  <span className="text-[var(--brand)] font-bold">ONLINE (PREVIEW)</span>
                </div>
                <div className="flex justify-between text-[8px] font-mono uppercase tracking-tight">
                  <span className="text-[var(--text-dim)]">Active Operator</span>
                  <span className="text-white font-bold">{profile?.email || 'Guest Developer'}</span>
                </div>
                <div className="flex justify-between text-[8px] font-mono uppercase tracking-tight">
                  <span className="text-[var(--text-dim)]">Tenant Registry</span>
                  <span className="text-blue-400 font-bold">{workspaceName || 'Local Sandbox'}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-white/5 border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[9px] font-black uppercase tracking-widest text-white transition-all cursor-pointer"
                >
                  Keep Session Active
                </button>
                <button
                  onClick={onRefresh}
                  className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 hover:border-red-500/30 text-[9px] font-black uppercase tracking-widest text-red-400 hover:text-white transition-all cursor-pointer"
                >
                  Refresh Uplink
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

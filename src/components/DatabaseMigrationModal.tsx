import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Loader2, 
  Link2,
  Terminal,
  Settings2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { DatabaseMigrationService, MigrationProgress } from '../services/DatabaseMigrationService';

interface DatabaseMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  addToast?: (toast: { type: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

export const DatabaseMigrationModal: React.FC<DatabaseMigrationModalProps> = ({
  isOpen,
  onClose,
  userId,
  addToast,
}) => {
  const [targetUrl, setTargetUrl] = useState('');
  const [targetServiceKey, setTargetServiceKey] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress>({
    step: 'idle',
    message: '',
    percent: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setTargetUrl('');
    setTargetServiceKey('');
    setIsMigrating(false);
    setProgress({ step: 'idle', message: '', percent: 0 });
    setError(null);
  };

  const handleClose = () => {
    if (isMigrating && progress.step !== 'complete' && progress.step !== 'failed') {
      return; // Prevent closing mid-transaction
    }
    resetState();
    onClose();
  };

  const handleMigrate = async () => {
    if (!targetUrl.trim() || !targetServiceKey.trim()) {
      addToast?.({ type: 'warning', message: 'Specify target Supabase parameters.' });
      return;
    }

    if (!userId) {
      addToast?.({ type: 'error', message: 'Uplink error: No authenticated session found.' });
      return;
    }

    setIsMigrating(true);
    setError(null);

    try {
      await DatabaseMigrationService.migrate(
        targetUrl.trim(),
        targetServiceKey.trim(),
        userId,
        (prog) => {
          setProgress(prog);
        }
      );

      addToast?.({ 
        type: 'success', 
        message: 'All profiles, workspaces, team nodes and requests migrated successfully!' 
      });
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Migration halted due to a critical connection error.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      {/* Dark overlay backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-[#000000]/90 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        className="relative w-full max-w-xl bg-[#0F0F11]/95 border border-white/[0.05] rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col backdrop-blur-xl z-10"
      >
        {/* Neon Backdrop Glow */}
        <div className="absolute top-0 right-0 w-60 h-60 bg-[#3ECF8E]/[0.015] rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/[0.01] rounded-full blur-[80px] pointer-events-none" />

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.04] flex items-center justify-between bg-black/25 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Database size={15} className="text-[#3ECF8E]" />
              <h2 className="text-[13px] font-black text-white uppercase tracking-[0.2em]">Database Migration</h2>
            </div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider mt-1">
              Clone current workspaces, request history, teams, and environments to a target Supabase project.
            </p>
          </div>
          <button 
            onClick={handleClose} 
            disabled={isMigrating && progress.step !== 'complete' && progress.step !== 'failed'}
            className="w-7 h-7 rounded-lg border border-white/[0.03] bg-white/[0.01] flex items-center justify-center text-zinc-500 hover:text-white hover:border-white/[0.1] hover:bg-white/[0.04] disabled:opacity-20 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto no-scrollbar max-h-[70vh]">
          {progress.step === 'idle' ? (
            <>
              {/* Security Banner */}
              <div className="p-4 rounded-xl bg-amber-500/[0.03] border border-amber-500/10 flex gap-3 text-amber-500/80">
                <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                <div className="text-[9px] uppercase tracking-wide leading-relaxed font-semibold">
                  <span className="font-black text-amber-400">Important Requirement:</span> To clone data across different users and team rosters securely without triggering Row-Level Security (RLS) constraints, you must supply the target project's <span className="font-black text-amber-400">Service Role API Key</span> (service_role). Avoid using the public Anon Key.
                </div>
              </div>

              {/* Input Forms */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Link2 size={11} className="text-[#3ECF8E]" /> Target Supabase Project URL
                  </label>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://your-project.supabase.co"
                    className="w-full bg-black border border-white/[0.05] rounded-xl py-3 px-4 text-xs font-mono text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-[#3ECF8E]/40 focus:bg-white/[0.01] transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Settings2 size={11} className="text-[#3ECF8E]" /> Target Service Role Key (service_role)
                  </label>
                  <input
                    type="password"
                    value={targetServiceKey}
                    onChange={(e) => setTargetServiceKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey..."
                    className="w-full bg-black border border-white/[0.05] rounded-xl py-3 px-4 text-xs font-mono text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-[#3ECF8E]/40 focus:bg-white/[0.01] transition-all"
                  />
                </div>
              </div>
            </>
          ) : (
            /* Active Progress Screen */
            <div className="py-6 space-y-6">
              <div className="flex flex-col items-center justify-center text-center space-y-3">
                {progress.step === 'complete' ? (
                  <div className="w-12 h-12 rounded-full bg-[#3ECF8E]/10 border border-[#3ECF8E]/25 flex items-center justify-center text-[#3ECF8E] shadow-[0_0_20px_rgba(62,207,142,0.1)]">
                    <CheckCircle2 size={24} className="stroke-[2.5]" />
                  </div>
                ) : progress.step === 'failed' ? (
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                    <AlertTriangle size={24} className="stroke-[2.5]" />
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full border border-white/[0.05] bg-black flex items-center justify-center text-zinc-400">
                      <Loader2 size={22} className="animate-spin text-[#3ECF8E]" />
                    </div>
                  </div>
                )}
                
                <div className="space-y-1">
                  <div className="text-[11px] font-black uppercase tracking-widest text-white">
                    {progress.step === 'complete' ? 'Migration Locked & Verified' : progress.step === 'failed' ? 'Connection Blocked' : 'Copying Target Database'}
                  </div>
                  <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                    {progress.step.toUpperCase()} STEP
                  </div>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-black rounded-full overflow-hidden border border-white/[0.03]">
                  <motion.div
                    className="h-full bg-[#3ECF8E] rounded-full shadow-[0_0_10px_rgba(62,207,142,0.3)]"
                    animate={{ width: `${progress.percent}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                  <span>Progress Meter</span>
                  <span className="text-[#3ECF8E] font-black">{progress.percent}%</span>
                </div>
              </div>

              {/* Logs Display Console */}
              <div className="bg-[#070708] border border-white/[0.03] rounded-xl p-4 max-h-36 overflow-y-auto no-scrollbar shadow-inner">
                <div className="flex items-center gap-2 text-[#3ECF8E]/60 text-[8px] font-black uppercase tracking-widest mb-2 pb-1 border-b border-white/[0.03]">
                  <Terminal size={11} /> Migration Terminal Output
                </div>
                <div className="space-y-1.5 text-[9px] font-mono leading-relaxed break-all">
                  <div className="text-zinc-600">&gt; INITIALIZING CLONE PROCEDURES</div>
                  <div className="text-zinc-500">&gt; TARGET: {targetUrl}</div>
                  {progress.message && (
                    <div className={cn(
                      "font-bold",
                      progress.step === 'complete' ? "text-[#3ECF8E]" :
                      progress.step === 'failed' ? "text-rose-400" : "text-zinc-300"
                    )}>
                      &gt; {progress.message}
                    </div>
                  )}
                  {error && (
                    <div className="text-rose-500 font-bold leading-relaxed whitespace-pre-line mt-2">
                      Migration Error Details: {error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.04] bg-black/25 flex justify-end gap-2 shrink-0">
          {progress.step === 'idle' ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2.5 rounded-lg border border-white/[0.04] bg-transparent text-[9px] font-black text-zinc-400 hover:text-white hover:bg-white/[0.02] transition-all uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleMigrate}
                disabled={!targetUrl.trim() || !targetServiceKey.trim()}
                className="px-5 py-2.5 rounded-lg bg-[#3ECF8E] text-[#050505] text-[9px] font-black uppercase tracking-widest disabled:opacity-20 active:scale-[0.97] transition-all shadow-[0_4px_20px_rgba(62,207,142,0.15)] flex items-center gap-1.5 hover:bg-[#46e6a0]"
              >
                <Sparkles size={11} /> Start Migration
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              disabled={progress.step !== 'complete' && progress.step !== 'failed'}
              className="px-5 py-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.15] text-[9px] font-black text-white transition-all uppercase tracking-widest disabled:opacity-20"
            >
              {progress.step === 'complete' ? 'Completed & Return' : progress.step === 'failed' ? 'Failed & Exit' : 'Processing...'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Plus, UserPlus, ArrowLeft, Zap, Shield, Database, Activity, Cpu } from 'lucide-react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { cn } from '../../lib/utils';

export const OptionSelection: React.FC = () => {
  const { setStep, setSetupMode } = useOnboardingStore();

  const handleSelectCreate = () => {
    setSetupMode('create');
    setStep('create-setup');
  };

  const handleSelectJoin = () => {
    setSetupMode('join');
    setStep('join-team');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-12"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black text-white tracking-tight">
          How would you like to start?
        </h2>
        <button
          onClick={() => useOnboardingStore.getState().setStep('welcome')}
          className="p-2 hover:bg-elevated rounded-lg transition-all"
        >
          <ArrowLeft size={20} className="text-muted" />
        </button>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create Own Setup */}
        <motion.button
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSelectCreate}
          className="group p-8 rounded-3xl bg-gradient-to-br from-[var(--bg-elevated)] to-[var(--bg-surface)] border-2 border-subtle hover:border-[var(--brand)]/50 transition-all text-left flex flex-col"
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--brand)]/10 group-hover:bg-[var(--brand)]/20 mb-6 transition-all">
            <Plus size={30} className="text-[var(--brand)]" />
          </div>

          <h3 className="text-xl font-black text-white mb-3 leading-tight">
            Create Own Setup
          </h3>

          <p className="text-sm text-muted mb-8 leading-relaxed">
            Initialize a new deployment. Build your own workspace and connect to your Supabase database with full control.
          </p>

          <div className="flex items-center text-[var(--brand)] font-bold text-sm gap-2 group-hover:gap-3 transition-all mt-auto pt-4 border-t border-subtle">
            Start Fresh
            <ChevronRight size={16} />
          </div>
        </motion.button>

        {/* Join Team */}
        <motion.button
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSelectJoin}
          className="group p-8 rounded-3xl bg-gradient-to-br from-[var(--brand)]/5 to-[var(--bg-surface)] border-2 border-[var(--brand)]/30 hover:border-[var(--brand)] transition-all text-left flex flex-col"
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--brand)] mb-6 transition-all shadow-[0_0_20px_rgba(var(--brand-rgb),0.2)]">
            <UserPlus size={30} className="text-black" />
          </div>

          <h3 className="text-xl font-black text-white mb-3 leading-tight">
            Join Team
          </h3>

          <p className="text-sm text-muted mb-8 leading-relaxed">
            The easiest way to collaborate. Just enter your team invite code to auto-configure everything and join the workspace.
          </p>

          <div className="flex items-center text-[var(--brand)] font-bold text-sm gap-2 group-hover:gap-3 transition-all mt-auto pt-4 border-t border-[var(--brand)]/20">
            Join Now
            <ChevronRight size={16} />
          </div>
        </motion.button>
      </div>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 p-4 rounded-lg bg-elevated border border-subtle"
      >
        <p className="text-xs text-muted">
          <span className="font-bold text-[var(--brand)]">💡 Tip:</span> You can always
          switch between workspaces or create new ones after setup is complete.
        </p>
      </motion.div>
    </motion.div>
  );
};

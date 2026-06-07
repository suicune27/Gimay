import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, ArrowLeft } from 'lucide-react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../hooks/useAuth';
import { OnboardingWelcome } from './OnboardingWelcome';
import { OptionSelection } from './OptionSelection';
import { CreateSetupWizard } from './CreateSetupWizard';
import { JoinTeamWizard } from './JoinTeamWizard';
import { JoinInviteWizard } from './JoinInviteWizard';
import { TeamSelection } from './TeamSelection';

export const OnboardingModal: React.FC = () => {
  const { step, setupMode, isConfigured } = useOnboardingStore();
  const { teams, setLandingSkipped } = useStore();
  const { logout } = useAuth();

  if (isConfigured) {
    return null;
  }

  const hasTeams = teams.length > 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[var(--bg-deep)]/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-surface)] border border-subtle rounded-2xl shadow-2xl relative"
      >
        {/* Universal Escape Rail */}
        <div className="absolute top-6 right-6 z-10 flex items-center gap-4">
          {step === 'welcome' && (
            <button
              onClick={() => setLandingSkipped(false)}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-dim hover:text-[var(--brand)] transition-colors"
            >
              <ArrowLeft size={14} /> Back to Landing
            </button>
          )}
          {step !== 'welcome' && step !== 'team-select' && (
             <button
              onClick={() => useOnboardingStore.getState().setStep(hasTeams ? 'team-select' : 'welcome')}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-dim hover:text-[var(--brand)] transition-colors"
            >
              <ArrowLeft size={14} /> {hasTeams ? 'Back to Selection' : 'Reset Flow'}
            </button>
          )}
          <div className="h-3 w-px bg-elevated" />
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-dim hover:text-red-500 transition-colors"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 'welcome' && <OnboardingWelcome key="welcome" />}
          {step === 'option-select' && <OptionSelection key="option-select" />}
          {step === 'create-setup' && setupMode === 'create' && (
            <CreateSetupWizard key="create-setup" />
          )}
          {step === 'join-team' && setupMode === 'join' && (
            <JoinTeamWizard key="join-team" />
          )}
          {step === 'join-invite' && setupMode === 'join-invite' && (
            <JoinInviteWizard key="join-invite" />
          )}
          {step === 'team-select' && <TeamSelection key="team-select" />}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

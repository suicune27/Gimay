import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { OnboardingWelcome } from './OnboardingWelcome';
import { OptionSelection } from './OptionSelection';
import { CreateSetupWizard } from './CreateSetupWizard';
import { JoinTeamWizard } from './JoinTeamWizard';
import { JoinInviteWizard } from './JoinInviteWizard';

export const OnboardingModal: React.FC = () => {
  const { step, setupMode, isConfigured } = useOnboardingStore();

  if (isConfigured) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-deep/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border border-subtle rounded-2xl shadow-2xl"
      >
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
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Zap, Lock, Users } from 'lucide-react';
import { useOnboardingStore } from '../../store/onboardingStore';

export const OnboardingWelcome: React.FC = () => {
  const { setStep } = useOnboardingStore();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-12 flex flex-col items-center justify-center min-h-[600px] text-center"
    >
      {/* Logo/Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="mb-6"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3ECF8E] to-[#2BA86D] flex items-center justify-center shadow-[0_0_30px_rgba(62,207,142,0.3)]">
          <Sparkles size={40} className="text-white" />
        </div>
      </motion.div>

      {/* Title */}
      <h1 className="text-4xl font-black text-white mb-3 tracking-tight">
        Welcome to Putman
      </h1>

      {/* Subtitle */}
      <p className="text-[#888888] text-lg mb-12 max-w-md leading-relaxed">
        Advanced API client for teams. Set up your workspace to get started with
        collections, environments, and team collaboration.
      </p>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 w-full">
        {[
          { icon: Zap, label: 'Fast', desc: 'Lightning-quick API requests' },
          { icon: Lock, label: 'Secure', desc: 'End-to-end encrypted configs' },
          { icon: Users, label: 'Teams', desc: 'Real-time collaboration' },
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-lg bg-[#1A1A1A] border border-[#222222] hover:border-[#3ECF8E]/30 transition-all"
          >
            <feature.icon size={24} className="text-[#3ECF8E] mx-auto mb-2" />
            <p className="text-sm font-bold text-white mb-1">{feature.label}</p>
            <p className="text-xs text-[#666666]">{feature.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* CTA Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => useOnboardingStore.getState().setStep('option-select')}
        className="px-8 py-3 bg-[#3ECF8E] text-[var(--text-on-brand)] font-bold rounded-lg hover:shadow-[0_0_20px_rgba(62,207,142,0.4)] transition-all uppercase text-sm tracking-widest"
      >
        Get Started
      </motion.button>

      {/* Footer Note */}
      <p className="text-xs text-[#555555] mt-8">
        No credit card required • Takes less than 5 minutes
      </p>
    </motion.div>
  );
};

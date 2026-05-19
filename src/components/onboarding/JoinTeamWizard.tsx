import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Loader, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { OnboardingService } from '../../services/OnboardingService';
import { useStore } from '../../store/useStore';

type JoinStep = 'input-code' | 'joining' | 'complete';

export const JoinTeamWizard: React.FC = () => {
  const { addToast, profile } = useStore();
  const {
    setStep: setOnboardingStep,
    setIsConfigured,
    setWorkspaceId,
    setTeamId,
    setSupabaseCredentials,
    setUserId,
  } = useOnboardingStore();

  const [joinStep, setJoinStep] = useState<JoinStep>('input-code');
  const [teamCode, setTeamCode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoinTeam = async () => {
    setError(null);
    setIsJoining(true);

    if (!inviteCode) {
      setError('Please enter your team invite code.');
      setIsJoining(false);
      return;
    }

    if (!OnboardingService.isValidInviteCodeFormat(inviteCode)) {
      setError('Invalid invite code format. Expected: TEMP-XXXX-XXXX-XXXX');
      setIsJoining(false);
      return;
    }

    if (!profile?.id) {
      setError('Active session not detected.');
      setIsJoining(false);
      return;
    }

    const userId = profile.id;

    try {
      // 1. Fetch connection details from the temporary code
      const validation = await OnboardingService.validateInviteCode(inviteCode);
      if (!validation.success || !validation.invite) {
        setError(validation.error || 'Invalid invite code.');
        setIsJoining(false);
        return;
      }

      const { supabase_url, supabase_anon_key, teams } = validation.invite;
      const actualTeamCode = teamCode || teams?.team_code;

      if (!actualTeamCode) {
        setError('Could not determine team code. Please enter it manually or check your invite code.');
        setIsJoining(false);
        return;
      }

      // 2. Perform the join
      const result = await OnboardingService.joinTeam(
        supabase_url,
        supabase_anon_key,
        userId,
        actualTeamCode,
        inviteCode
      );

      if (result.success) {
        setSupabaseCredentials(supabase_url, supabase_anon_key);
        setWorkspaceId(result.workspaceId || '');
        setTeamId(result.teamId || '');
        setUserId(userId);
        setJoinStep('complete');
        setIsConfigured(true);

        addToast({
          type: 'success',
          message: 'Successfully joined team!',
        });

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError(result.error || 'Failed to join team');
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred during join.');
    } finally {
      setIsJoining(false);
    }
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
          Join Team
        </h2>
        <button
          onClick={() => setOnboardingStep('option-select')}
          className="p-2 hover:bg-[#1A1A1A] rounded-lg transition-all"
        >
          <ArrowLeft size={20} className="text-[#888888]" />
        </button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <div className="p-4 rounded-xl bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 flex gap-4 items-center mb-2">
          <div className="w-12 h-12 rounded-lg bg-[#3ECF8E]/20 flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} className="text-[#3ECF8E]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Simplified Access</p>
            <p className="text-xs text-[#888888]">
              Supabase credentials will be configured automatically from your code.
            </p>
          </div>
        </div>

        <p className="text-sm text-[#888888]">
          Enter your team invite code to automatically configure your workspace.
        </p>

        {/* Temporary Code Input */}
        <div>
          <label className="block text-xs font-black uppercase text-[#888888] mb-2 tracking-widest">
            Team Invite Code
          </label>
          <input
            type="text"
            placeholder="TEMP-XXXX-XXXX-XXXX"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            maxLength={24}
            className="w-full px-4 py-4 bg-[#1A1A1A] border border-[#222222] rounded-lg text-white placeholder:text-[#555555] focus:border-[#3ECF8E] focus:outline-none transition-all font-mono tracking-widest text-center text-xl"
          />
          <p className="text-xs text-[#555555] mt-2 text-center font-mono">
            Format: TEMP-XXXX-XXXX-XXXX
          </p>
        </div>

        {/* Optional Team Code Input */}
        <div>
          <label className="block text-xs font-black uppercase text-[#888888] mb-2 tracking-widest">
            Team Code (Optional)
          </label>
          <input
            type="text"
            placeholder="TEAM-XXXX-XXXX-XXXX"
            value={teamCode}
            onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
            maxLength={24}
            className="w-full px-4 py-3 bg-[#1A1A1A] border border-[#222222] rounded-lg text-white placeholder:text-[#555555] focus:border-[#3ECF8E] focus:outline-none transition-all font-mono tracking-wider text-center"
          />
          <p className="text-[10px] text-[#555555] mt-2 italic text-center">
            Usually fetched automatically from your team invite code.
          </p>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex gap-3"
          >
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        {/* Join Button */}
        <button
          onClick={handleJoinTeam}
          disabled={
            isJoining ||
            !inviteCode ||
            !OnboardingService.isValidInviteCodeFormat(inviteCode)
          }
          className="w-full px-4 py-4 bg-[#3ECF8E] text-[var(--text-on-brand)] font-black rounded-lg hover:shadow-[0_0_20px_rgba(62,207,142,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg uppercase tracking-wider"
        >
          {isJoining && <Loader size={20} className="animate-spin" />}
          {isJoining ? 'Initializing...' : 'Join Workspace'}
        </button>
      </div>
    </motion.div>
  );
};


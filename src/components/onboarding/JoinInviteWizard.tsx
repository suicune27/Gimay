import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Loader, AlertCircle, CheckCircle2, QrCode } from 'lucide-react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { OnboardingService } from '../../services/OnboardingService';
import { useStore } from '../../store/useStore';

export const JoinInviteWizard: React.FC = () => {
  const { addToast } = useStore();
  const {
    setStep: setOnboardingStep,
    setIsConfigured,
    setWorkspaceId,
    setTeamId,
    setSupabaseCredentials,
    setUserId,
  } = useOnboardingStore();

  const [inviteCode, setInviteCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoinInvite = async () => {
    setError(null);
    setIsJoining(true);

    if (!inviteCode) {
      setError('Please enter a temporary code.');
      setIsJoining(false);
      return;
    }

    if (!OnboardingService.isValidInviteCodeFormat(inviteCode)) {
      setError('Invalid temporary code format. Expected: TEMP-XXXX-XXXX-XXXX');
      setIsJoining(false);
      return;
    }

    // In this app, userId should come from the current auth session
    // We'll rely on OnboardingService to handle session if needed
    const userId = (await OnboardingService.createAuthenticatedClient('', '', '')).client?.auth?.user?.id || 'temp-user-id';

    try {
      const result = await OnboardingService.joinByInviteCode(inviteCode, userId);

      if (result.success) {
        // Fetch invite details to get credentials (needed for local store)
        const validation = await OnboardingService.validateInviteCode(inviteCode);
        if (validation.invite) {
          setSupabaseCredentials(validation.invite.supabase_url, validation.invite.supabase_anon_key);
        }
        
        setWorkspaceId(result.workspaceId || '');
        setTeamId(result.teamId || '');
        setUserId(userId);
        setIsConfigured(true);

        addToast({
          type: 'success',
          message: 'Successfully joined team via invite!',
        });

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError(result.error || 'Failed to join team');
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred');
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
        <h2 className="text-2xl font-black text-main tracking-tight">
          Join via Invite
        </h2>
        <button
          onClick={() => setOnboardingStep('option-select')}
          className="p-2 hover:bg-elevated rounded-lg transition-all"
        >
          <ArrowLeft size={20} className="text-muted" />
        </button>
      </div>

      <div className="space-y-6">
        <div className="p-4 rounded-xl bg-brand/10 border border-brand/20 flex gap-4 items-center">
          <div className="w-12 h-12 rounded-lg bg-brand/20 flex items-center justify-center shrink-0">
            <QrCode size={24} className="text-brand" />
          </div>
          <div>
            <p className="text-sm font-bold text-main">Secure Onboarding</p>
            <p className="text-xs text-muted">
              Your team connection details will be fetched automatically.
            </p>
          </div>
        </div>

        <p className="text-sm text-muted">
          Enter the secure temporary code provided by your team administrator.
        </p>

        {/* Temporary Code Input */}
        <div>
          <label className="block text-xs font-black uppercase text-muted mb-2 tracking-widest">
            Temporary Code
          </label>
          <input
            type="text"
            placeholder="TEMP-XXXX-XXXX-XXXX"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            maxLength={24}
            className="w-full px-4 py-4 bg-elevated border border-subtle rounded-lg text-main placeholder:text-dim focus:border-brand focus:outline-none transition-all font-mono tracking-widest text-center text-xl"
          />
          <p className="text-xs text-dim mt-2 text-center">
            Format: TEMP-XXXX-XXXX-XXXX
          </p>
        </div>

        {/* Code Validation Helper */}
        {inviteCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`p-3 rounded-lg border flex items-center gap-2 ${
              OnboardingService.isValidInviteCodeFormat(inviteCode)
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            {OnboardingService.isValidInviteCodeFormat(inviteCode) ? (
              <>
                <CheckCircle2 size={16} className="text-green-500" />
                <p className="text-xs text-green-400">Valid temporary code format</p>
              </>
            ) : (
              <>
                <AlertCircle size={16} className="text-red-500" />
                <p className="text-xs text-red-400">Invalid temporary code format</p>
              </>
            )}
          </motion.div>
        )}

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
          onClick={handleJoinInvite}
          disabled={
            isJoining ||
            !inviteCode ||
            !OnboardingService.isValidInviteCodeFormat(inviteCode)
          }
          className="w-full px-4 py-4 bg-brand text-[var(--text-on-brand)] font-black rounded-lg hover:shadow-[0_0_20px_rgba(62,207,142,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-md"
        >
          {isJoining && <Loader size={20} className="animate-spin" />}
          {isJoining ? 'Verifying Invite...' : 'Secure Join'}
        </button>
      </div>
    </motion.div>
  );
};

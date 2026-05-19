import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UserPlus, Shield, UserMinus, Crown, ShieldCheck, Mail, QrCode, Copy, Trash2, Calendar, Link as LinkIcon } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PersistenceService } from '../services/PersistenceService';
import { OnboardingService } from '../services/OnboardingService';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { TeamInvite } from '../types';

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  team?: any; // If provided, we are editing
}

export const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose, team }) => {
  const { profile, addToast } = useStore();
  const [name, setName] = useState(team?.name || '');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'invites'>('members');

  useEffect(() => {
    if (!team?.id) return;

    fetchMembers();
    fetchInvites();

    // 1. Real-time Subscription (Instant updates when replication is enabled)
    const channel = supabase
      .channel(`team-members-changes-${team.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `team_id=eq.${team.id}`,
        },
        () => {
          console.log('[TeamModal] Real-time event detected on team_members. Fetching latest roster...');
          fetchMembers();
          fetchInvites();
        }
      )
      .subscribe();

    // 2. Polling Fallback (Updates every 10 seconds as backup)
    const interval = setInterval(() => {
      fetchMembers();
      fetchInvites();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [team?.id]);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*, profiles(email, full_name)')
      .eq('team_id', team.id);
    
    if (data) setMembers(data);
  };

  const fetchInvites = async () => {
    try {
      const data = await OnboardingService.listTeamInvites(team.id);
      setInvites(data);
    } catch (e) {
      console.error('Failed to fetch invites');
    }
  };

  const handleGenerateInvite = async () => {
    if (!team?.id || !profile?.id) return;
    setIsLoading(true);
    try {
      const result = await OnboardingService.createTeamInvite(team.id, profile.id, {
        expiresInDays: 7, // Default 7 days
      });
      if (result.success) {
        addToast({ type: 'success', message: 'Secure temporary code generated.' });
        fetchInvites();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to generate invite.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await OnboardingService.revokeTeamInvite(inviteId);
      addToast({ type: 'info', message: 'Invite revoked.' });
      fetchInvites();
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to revoke invite.' });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast({ type: 'success', message: `${label} copied to clipboard.` });
  };

  const handleCreate = async () => {
    if (!name.trim() || !profile?.id) return;
    setIsLoading(true);
    try {
      await PersistenceService.createTeam(name, profile.id);
      addToast({ type: 'success', message: `Team "${name}" established.` });
      onClose();
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to establish team.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!email.trim() || !team?.id) return;
    setIsLoading(true);
    try {
      await PersistenceService.addTeamMember(team.id, email);
      addToast({ type: 'success', message: `Invite sent to ${email}.` });
      setEmail('');
      fetchMembers();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to send invite.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, currentRole: string) => {
    if (!team?.id) return;
    const newRole = currentRole === 'admin' ? 'editor' : 'admin';
    try {
      await PersistenceService.updateTeamMemberRole(team.id, userId, newRole);
      addToast({ type: 'success', message: 'Permissions updated.' });
      fetchMembers();
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to update permissions.' });
    }
  };

  const handleRemove = async (userId: string) => {
    if (!team?.id || !confirm('Decommission this operator?')) return;
    try {
      await PersistenceService.removeTeamMember(team.id, userId);
      addToast({ type: 'info', message: 'Operator decommissioned.' });
      fetchMembers();
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to decommission operator.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-black text-[var(--text-main)] uppercase tracking-widest flex items-center gap-2">
              {team ? 'Manage Team' : 'Initialize Unit'}
            </h2>
            <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-tighter mt-1">
              {team ? `Unit ID: ${team.id.split('-')[0]}` : 'Configure collaborative deployment'}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Team Name Input */}
          <div className="space-y-2">
            <label className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Unit Designation</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!team}
              placeholder="TEAM_NAME..."
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] px-4 py-3 rounded-lg text-[var(--text-main)] font-mono text-[11px] placeholder:text-[var(--border-strong)] focus:outline-none focus:border-[var(--brand)] transition-all"
            />
          </div>

          {team && (
            <>
              {/* Tabs */}
              <div className="flex bg-[var(--bg-deep)] p-1 rounded-xl border border-[var(--border-subtle)]">
                <button
                  onClick={() => setActiveTab('members')}
                  className={cn(
                    "flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                    activeTab === 'members' ? "bg-[var(--bg-surface)] text-[var(--text-main)] shadow-sm" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"
                  )}
                >
                  Operators
                </button>
                <button
                  onClick={() => setActiveTab('invites')}
                  className={cn(
                    "flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2",
                    activeTab === 'invites' ? "bg-[var(--bg-surface)] text-[var(--text-main)] shadow-sm" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"
                  )}
                >
                  <QrCode size={12} />
                  Secure Invites
                </button>
              </div>

              {activeTab === 'members' ? (
                <>
                  {/* Member Invite */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Enlist Operator</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--border-strong)]" />
                        <input 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="operator@email.com"
                          className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] pl-10 pr-4 py-2.5 rounded-lg text-[var(--text-main)] font-mono text-[11px] placeholder:text-[var(--border-strong)] focus:outline-none focus:border-[var(--brand)] transition-all"
                        />
                      </div>
                      <button 
                        onClick={handleInvite}
                        disabled={isLoading || !email}
                        className="px-4 bg-[var(--brand)] text-[var(--bg-deep)] text-[10px] font-black uppercase tracking-widest rounded-lg hover:shadow-[0_0_15px_var(--brand-muted)] transition-all disabled:opacity-50"
                      >
                        Invite
                      </button>
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="space-y-4">
                    <label className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Current Roster ({members.length})</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
                      {members.map((member) => (
                        <div key={member.user_id} className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl group/member">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-[var(--bg-deep)] flex items-center justify-center border border-[var(--border-subtle)]">
                              {member.role === 'owner' ? <Crown size={12} className="text-yellow-500" /> : <Shield size={12} className="text-[var(--brand)]" />}
                            </div>
                            <div>
                              <div className="text-[11px] font-bold text-[var(--text-main)]">
                                {member.profiles?.full_name || member.profiles?.email}
                              </div>
                              <div className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">
                                {member.role === 'owner' ? 'Commander' : member.role === 'admin' ? 'Officer' : 'Operator'}
                              </div>
                            </div>
                          </div>
                          
                          {member.user_id !== profile?.id && member.role !== 'owner' && (
                            <div className="flex items-center gap-1 opacity-0 group-hover/member:opacity-100 transition-all">
                              <button 
                                onClick={() => handleUpdateRole(member.user_id, member.role)}
                                className="p-1.5 hover:text-[var(--brand)] text-[var(--text-dim)] transition-all"
                                title="Promote/Demote"
                              >
                                <ShieldCheck size={14} />
                              </button>
                              <button 
                                onClick={() => handleRemove(member.user_id)}
                                className="p-1.5 hover:text-red-500 text-[var(--text-dim)] transition-all"
                                title="Dismiss"
                              >
                                <UserMinus size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-2">
                       Active Invitations
                    </label>
                    <button
                      onClick={handleGenerateInvite}
                      disabled={isLoading}
                      className="text-[9px] font-black text-[var(--brand)] uppercase tracking-widest hover:underline"
                    >
                      Generate New Code
                    </button>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar pr-1">
                    {invites.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-[var(--border-subtle)] rounded-xl">
                        <QrCode size={32} className="mx-auto text-[var(--border-strong)] mb-4 opacity-20" />
                        <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest leading-relaxed">
                          No secure invites generated.<br/>Use these for one-click onboarding.
                        </p>
                      </div>
                    ) : (
                      invites.map((invite) => (
                        <div key={invite.id} className="p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl space-y-3 group/invite">
                          <div className="flex items-center justify-between">
                            <div className="text-[14px] font-mono font-bold text-[var(--text-main)] tracking-widest">
                              {invite.code}
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => copyToClipboard(invite.code, 'Code')}
                                className="p-1.5 text-[var(--text-dim)] hover:text-[var(--brand)] transition-all"
                                title="Copy Code"
                              >
                                <Copy size={12} />
                              </button>
                              <button 
                                onClick={() => copyToClipboard(`${window.location.origin}/?invite=${invite.code}`, 'Join Link')}
                                className="p-1.5 text-[var(--text-dim)] hover:text-[var(--brand)] transition-all"
                                title="Copy Join Link"
                              >
                                <LinkIcon size={12} />
                              </button>
                              <button 
                                onClick={() => handleRevokeInvite(invite.id)}
                                className="p-1.5 text-[var(--text-dim)] hover:text-red-500 transition-all opacity-0 group-hover/invite:opacity-100"
                                title="Revoke"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-[var(--text-dim)]">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={10} />
                              {invite.expires_at ? `Expires: ${new Date(invite.expires_at).toLocaleDateString()}` : 'Never'}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <UserPlus size={10} />
                              Uses: {invite.use_count} {invite.max_uses > 0 ? `/ ${invite.max_uses}` : ''}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-4 bg-[#3ECF8E]/5 border border-[#3ECF8E]/20 rounded-xl">
                    <p className="text-[10px] text-[#3ECF8E] font-bold mb-1">💡 Secure Onboarding</p>
                    <p className="text-[9px] text-[var(--text-dim)] leading-relaxed">
                      Temporary codes securely package your Supabase connection details.
                      Users joining via code do not need to manually enter keys.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {!team && (
            <button
               onClick={handleCreate}
               disabled={isLoading || !name}
               className="w-full py-4 bg-[var(--brand)] text-[var(--bg-deep)] text-[11px] font-black uppercase tracking-[0.2em] rounded-xl hover:shadow-[0_0_20px_var(--brand-muted)] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              Initialize Deployment Unit
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, UserPlus, Shield, UserMinus, Crown, ShieldCheck, Mail, QrCode, 
  Copy, Trash2, Calendar, Link as LinkIcon, Users, Settings2, 
  Check, ChevronDown, Activity, ShieldAlert, Sparkles, HelpCircle 
} from 'lucide-react';
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
  const [activeRoleDropdown, setActiveRoleDropdown] = useState<string | null>(null);

  // Generate unique visual color gradient based on operator's name/email initials
  const getAvatarGradient = (seedStr: string) => {
    const gradients = [
      'from-pink-500 to-purple-600',
      'from-cyan-500 to-blue-600',
      'from-emerald-400 to-teal-600',
      'from-amber-400 to-orange-600',
      'from-indigo-500 to-violet-700',
      'from-rose-400 to-red-600'
    ];
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
  };

  const getInitials = (member: any) => {
    const name = member.profiles?.full_name || member.profiles?.email || 'OP';
    return name.substring(0, 2).toUpperCase();
  };

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
        addToast({ type: 'success', message: 'Secure temporary onboarding code generated.' });
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

  const handleUpdateRole = async (userId: string, newRole: 'viewer' | 'editor' | 'admin') => {
    if (!team?.id) return;
    try {
      await PersistenceService.updateTeamMemberRole(team.id, userId, newRole);
      addToast({ type: 'success', message: `Operator permission set to ${newRole}.` });
      setActiveRoleDropdown(null);
      fetchMembers();
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to update permissions.' });
    }
  };

  const handleRemove = async (userId: string) => {
    if (!team?.id || !confirm('Decommission this operator? They will lose real-time access to all shared workspace scenarios.')) return;
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
      {/* Background Dim Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-lg bg-[#0A0A0C] border border-[#1C1C22] rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Glowing visual accent line */}
        <div className="h-[2px] bg-gradient-to-r from-[#3ECF8E] via-blue-500 to-indigo-600" />

        {/* Modal Header */}
        <div className="p-6 border-b border-[#1A1A22]/50 bg-[#0C0C0F] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 flex items-center justify-center">
              <Users size={18} className="text-[#3ECF8E]" />
            </div>
            <div>
              <h2 className="text-[13px] font-black text-white uppercase tracking-[0.15em] font-mono flex items-center gap-2">
                {team ? team.name : 'Initialize Team Unit'}
              </h2>
              <p className="text-[9px] text-[#55555C] uppercase tracking-wider font-mono mt-0.5">
                {team ? `UNIT CODE: ${team.id.split('-')[0]}` : 'Configure collaborative sync deployment'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-xl text-[#55555C] hover:text-white bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
          
          {/* TEAM CONFIGURATION FORM (If creating) */}
          {!team && (
            <div className="space-y-5">
              <div className="p-4 bg-[#3ECF8E]/5 border border-[#3ECF8E]/15 rounded-2xl space-y-1.5">
                <span className="text-[9px] font-black text-[#3ECF8E] uppercase tracking-widest font-mono flex items-center gap-1.5"><Sparkles size={11} /> Collaborative Sandbox</span>
                <p className="text-[10px] text-[#888] leading-relaxed font-mono">
                  Initializing a Team Unit enables instant, bi-directional workspace sync. Shared collections, environments, and runner configurations sync in near real-time between all enlistees.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-[#55555C] uppercase tracking-[0.2em] font-mono">Unit Designation (Name)</label>
                <input 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ALPHA_TEAM"
                  className="w-full bg-[#050507] border border-[#1C1C22] px-4 py-3.5 rounded-xl text-white font-mono text-[11px] placeholder:text-[#333] focus:outline-none focus:border-[#3ECF8E]/40 focus:ring-1 focus:ring-[#3ECF8E]/20 transition-all uppercase"
                />
              </div>
            </div>
          )}

          {/* ACTIVE TEAM MANAGEMENT (If editing) */}
          {team && (
            <>
              {/* Telemetry Metrics Panel */}
              <div className="grid grid-cols-3 gap-3 bg-[#0C0C0F] p-4 border border-[#1A1A22] rounded-2xl font-mono">
                <div className="space-y-1 text-center">
                  <span className="text-[8px] text-[#55555C] uppercase tracking-widest block">Operators</span>
                  <span className="text-sm font-bold text-white block">{members.length}</span>
                </div>
                <div className="space-y-1 text-center border-x border-[#1A1A22]">
                  <span className="text-[8px] text-[#55555C] uppercase tracking-widest block">Realtime Sync</span>
                  <span className="text-xs font-bold text-[#3ECF8E] flex items-center justify-center gap-1.5">
                    <Activity size={10} className="animate-pulse" /> ACTIVE
                  </span>
                </div>
                <div className="space-y-1 text-center">
                  <span className="text-[8px] text-[#55555C] uppercase tracking-widest block">Access Rulings</span>
                  <span className="text-[9px] font-bold text-[#A0A0A9] block">RBAC ENFORCED</span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex bg-[#0C0C0F] p-1 rounded-xl border border-[#1A1A22]">
                <button
                  onClick={() => setActiveTab('members')}
                  className={cn(
                    "flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer",
                    activeTab === 'members' 
                      ? "bg-[#1C1C22] text-[#3ECF8E] border border-white/5 shadow-sm" 
                      : "text-[#55555C] hover:text-[#A0A0A9]"
                  )}
                >
                  Roster Operations
                </button>
                <button
                  onClick={() => setActiveTab('invites')}
                  className={cn(
                    "flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer",
                    activeTab === 'invites' 
                      ? "bg-[#1C1C22] text-[#3ECF8E] border border-white/5 shadow-sm" 
                      : "text-[#55555C] hover:text-[#A0A0A9]"
                  )}
                >
                  <QrCode size={11} />
                  Secure Invites ({invites.length})
                </button>
              </div>

              {/* TAB 1: MEMBERS ROSTER */}
              {activeTab === 'members' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Member Invite Panel */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[#55555C] uppercase tracking-[0.2em] font-mono">Enlist Operator</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#333]" />
                        <input 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="operator@email.com"
                          className="w-full bg-[#050507] border border-[#1C1C22] pl-10 pr-4 py-2.5 rounded-xl text-white font-mono text-[11px] placeholder:text-[#333] focus:outline-none focus:border-[#3ECF8E]/40 transition-all"
                        />
                      </div>
                      <button 
                        onClick={handleInvite}
                        disabled={isLoading || !email}
                        className="px-4.5 bg-[#3ECF8E] hover:bg-[#32B379] text-[#070708] text-[9px] font-black uppercase tracking-widest rounded-xl hover:shadow-[0_0_15px_rgba(62,207,142,0.2)] transition-all disabled:opacity-30 cursor-pointer"
                      >
                        Enlist
                      </button>
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-black text-[#55555C] uppercase tracking-[0.2em] font-mono">Current Roster ({members.length})</label>
                      <span className="text-[8px] text-[#444] font-mono font-bold">HOVER FOR CONTROLS</span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
                      {members.map((member) => {
                        const initials = getInitials(member);
                        const gradient = getAvatarGradient(member.user_id);
                        const isSelf = member.user_id === profile?.id;
                        
                        return (
                          <div 
                            key={member.user_id} 
                            className="flex items-center justify-between p-3 bg-[#0C0C0F]/60 border border-[#1C1C22] rounded-xl hover:border-white/5 transition-all group/member"
                          >
                            <div className="flex items-center gap-3">
                              {/* Glowing Avatar */}
                              <div className="relative">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center font-black font-mono text-[10px] text-white shadow-lg border border-white/5",
                                  gradient
                                )}>
                                  {initials}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#3ECF8E] border border-[#0A0A0C] shadow-[0_0_6px_#3ECF8E]" />
                              </div>

                              <div>
                                <div className="text-[11px] font-bold text-[#E0E0E6] flex items-center gap-1.5">
                                  {member.profiles?.full_name || member.profiles?.email}
                                  {isSelf && (
                                    <span className="text-[7px] font-black bg-white/5 text-[#888] px-1 py-0.2 rounded font-mono">YOU</span>
                                  )}
                                </div>
                                <div className="text-[8px] font-black text-[#555] uppercase tracking-widest font-mono mt-0.5">
                                  {member.profiles?.email}
                                </div>
                              </div>
                            </div>
                            
                            {/* Role Selection & Decommission */}
                            <div className="flex items-center gap-2">
                              {/* Role Badge Dropdown Button */}
                              <div className="relative">
                                <button
                                  disabled={member.role === 'owner' || !team}
                                  onClick={() => setActiveRoleDropdown(activeRoleDropdown === member.user_id ? null : member.user_id)}
                                  className={cn(
                                    "px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider font-mono flex items-center gap-1 transition-all border",
                                    member.role === 'owner' 
                                      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" 
                                      : member.role === 'admin' 
                                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20" 
                                        : member.role === 'editor'
                                          ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
                                          : "bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20",
                                    member.role !== 'owner' && "cursor-pointer"
                                  )}
                                >
                                  {member.role === 'owner' ? 'Commander' : member.role === 'admin' ? 'Officer' : member.role === 'editor' ? 'Editor' : 'Viewer'}
                                  {member.role !== 'owner' && <ChevronDown size={8} />}
                                </button>

                                {/* Custom Floating Role Selector */}
                                <AnimatePresence>
                                  {activeRoleDropdown === member.user_id && (
                                    <>
                                      <div className="fixed inset-0 z-[600]" onClick={() => setActiveRoleDropdown(null)} />
                                      <motion.div
                                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                        transition={{ duration: 0.1 }}
                                        className="absolute right-0 mt-1.5 w-32 bg-[#0E0E12] border border-[#222] rounded-xl shadow-2xl z-[700] p-1 space-y-0.5 text-left"
                                      >
                                        {([
                                          { r: 'admin', l: 'Officer', desc: 'Manage access' },
                                          { r: 'editor', l: 'Editor', desc: 'Modify scenario' },
                                          { r: 'viewer', l: 'Viewer', desc: 'Read / Execute' }
                                        ] as const).map((opt) => (
                                          <button
                                            key={opt.r}
                                            onClick={() => handleUpdateRole(member.user_id, opt.r)}
                                            className={cn(
                                              "w-full text-left px-2 py-1.5 rounded-lg text-[9px] font-black tracking-wide font-mono transition-all flex items-center justify-between cursor-pointer",
                                              member.role === opt.r 
                                                ? "bg-[#3ECF8E]/10 text-[#3ECF8E]" 
                                                : "text-[#555] hover:text-[#E0E0E6] hover:bg-white/5"
                                            )}
                                          >
                                            <div>
                                              <div>{opt.l}</div>
                                              <div className="text-[6px] text-[#444] font-normal uppercase tracking-normal">{opt.desc}</div>
                                            </div>
                                            {member.role === opt.r && <Check size={10} />}
                                          </button>
                                        ))}
                                      </motion.div>
                                    </>
                                  )}
                                </AnimatePresence>
                              </div>

                              {/* Decommission Operator Icon */}
                              {!isSelf && member.role !== 'owner' && (
                                <button 
                                  onClick={() => handleRemove(member.user_id)}
                                  className="p-1 text-[#55555C] hover:text-red-400 bg-white/[0.02] hover:bg-red-500/10 rounded-lg border border-transparent hover:border-red-500/20 transition-all cursor-pointer opacity-0 group-hover/member:opacity-100"
                                  title="Decommission Operator"
                                >
                                  <UserMinus size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SECURE INVITES */}
              {activeTab === 'invites' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-[#55555C] uppercase tracking-[0.2em] font-mono flex items-center gap-1.5">
                       Secure Invitation Tokens
                    </label>
                    <button
                      onClick={handleGenerateInvite}
                      disabled={isLoading}
                      className="text-[9px] font-black text-[#3ECF8E] uppercase tracking-widest hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles size={11} /> Generate New Token
                    </button>
                  </div>

                  {/* Invitations list */}
                  <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar pr-1">
                    {invites.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-[#1C1C22] rounded-2xl bg-[#070709]/50">
                        <QrCode size={30} className="mx-auto text-[#222] mb-3 opacity-30 animate-pulse" />
                        <p className="text-[10px] text-[#55555C] uppercase tracking-widest leading-relaxed font-mono">
                          No secure codes generated.<br/>Create one for one-click onboarding.
                        </p>
                      </div>
                    ) : (
                      invites.map((invite) => (
                        <div key={invite.id} className="p-4 bg-[#0C0C0F]/80 border border-[#1C1C22] rounded-xl space-y-3.5 group/invite relative overflow-hidden">
                          {/* Copier overlay */}
                          <div className="flex items-center justify-between">
                            <div className="text-[12px] font-mono font-black text-[#3ECF8E] tracking-[0.18em] bg-[#050507] px-2.5 py-1.5 rounded-lg border border-white/5 select-all">
                              {invite.code}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => copyToClipboard(invite.code, 'Onboarding code')}
                                className="p-2 text-[#55555C] hover:text-[#3ECF8E] bg-white/[0.02] border border-[#1C1C22] hover:border-[#3ECF8E]/20 rounded-lg transition-all cursor-pointer"
                                title="Copy Invitation Token"
                              >
                                <Copy size={11} />
                              </button>
                              <button 
                                onClick={() => copyToClipboard(`${window.location.origin}/?invite=${invite.code}`, 'Onboarding Join Link')}
                                className="p-2 text-[#55555C] hover:text-[#3ECF8E] bg-white/[0.02] border border-[#1C1C22] hover:border-[#3ECF8E]/20 rounded-lg transition-all cursor-pointer"
                                title="Copy Secure Join Link"
                              >
                                <LinkIcon size={11} />
                              </button>
                              <button 
                                onClick={() => handleRevokeInvite(invite.id)}
                                className="p-2 text-[#55555C] hover:text-red-400 bg-white/[0.02] border border-[#1C1C22] hover:border-red-500/20 rounded-lg transition-all cursor-pointer opacity-0 group-hover/invite:opacity-100"
                                title="Revoke Secure Token"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-[#555] font-mono pt-1 border-t border-[#1C1C22]/50">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={10} />
                              {invite.expires_at ? `Exp: ${new Date(invite.expires_at).toLocaleDateString()}` : 'Never'}
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

                  {/* Informational Security Tip */}
                  <div className="p-4 bg-[#3ECF8E]/5 border border-[#3ECF8E]/10 rounded-2xl flex gap-3">
                    <ShieldAlert size={16} className="text-[#3ECF8E] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-[#3ECF8E] font-bold font-mono">💡 Secure Connection Packages</p>
                      <p className="text-[9px] text-[#55555C] leading-relaxed font-mono mt-0.5">
                        These secure invite codes carry cryptographically compiled references to active Supabase sync hosts. Operators joining using a valid token are instantly logged in and synced without needing to manual-configure server connection hashes.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Modal Actions Footer */}
        <div className="p-6 border-t border-[#1A1A22]/50 bg-[#0C0C0F] flex items-center justify-between shrink-0">
          <span className="text-[8px] text-[#444] uppercase tracking-wider font-mono">
            {team ? 'RBAC deployment active' : 'Secure handshake pending'}
          </span>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[9px] font-black text-[#888] hover:text-white bg-white/[0.02] hover:bg-white/[0.05] border border-[#1A1A22] cursor-pointer uppercase transition-all"
            >
              Close
            </button>
            {!team && (
              <button
                onClick={handleCreate}
                disabled={isLoading || !name.trim()}
                className="px-5 py-2 bg-[#3ECF8E] hover:bg-[#32B379] text-[#070708] text-[9px] font-black uppercase tracking-wider rounded-xl hover:shadow-[0_0_15px_rgba(62,207,142,0.2)] disabled:opacity-30 cursor-pointer transition-all"
              >
                Initialize Deployment
              </button>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
};

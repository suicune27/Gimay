import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Shield, Eye, Edit3, Zap, Lock, Globe } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PersistenceService } from '../services/PersistenceService';
import { cn } from '../lib/utils';
import { Collection } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, collection }) => {
  const { teams, addToast, profile } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const [visibility, setVisibility] = useState<'private' | 'team'>(collection.visibility || 'private');
  const [teamId, setTeamId] = useState<string | null>(collection.team_id || null);
  const [permission, setPermission] = useState<'view' | 'edit' | 'execute'>(collection.permission || 'edit');

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      await PersistenceService.updateCollection(collection.id, {
        visibility,
        team_id: visibility === 'team' ? teamId : null,
        permission
      });
      addToast({ type: 'success', message: 'Sharing configuration updated.' });
      onClose();
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to update sharing settings.' });
    } finally {
      setIsLoading(false);
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
        className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-[#0F0F0F] border border-[#222222] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-[#222222] flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-black text-white uppercase tracking-widest flex items-center gap-2">
              Share Collection
            </h2>
            <p className="text-[10px] text-[#555555] uppercase tracking-tighter mt-1">
              Set visibility and permissions for "{collection.name}"
            </p>
          </div>
          <button onClick={onClose} className="text-[#444444] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Visibility Toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setVisibility('private')}
              className={cn(
                "p-4 rounded-xl border flex flex-col items-center gap-2 transition-all",
                visibility === 'private' 
                  ? "bg-[#3ECF8E]/5 border-[#3ECF8E] text-[#3ECF8E]" 
                  : "bg-[#111111] border-[#222222] text-[#555555] hover:border-[#333333]"
              )}
            >
              <Lock size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Private</span>
            </button>
            <button
              onClick={() => setVisibility('team')}
              className={cn(
                "p-4 rounded-xl border flex flex-col items-center gap-2 transition-all",
                visibility === 'team' 
                  ? "bg-[#3ECF8E]/5 border-[#3ECF8E] text-[#3ECF8E]" 
                  : "bg-[#111111] border-[#222222] text-[#555555] hover:border-[#333333]"
              )}
            >
              <Users size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">Team</span>
            </button>
          </div>

          <AnimatePresence>
            {visibility === 'team' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[#555555] uppercase tracking-widest">Select Deployment Unit</label>
                  <select
                    value={teamId || ''}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="w-full bg-[#111111] border border-[#222222] px-4 py-3 rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-[#3ECF8E] transition-all appearance-none"
                  >
                    <option value="" disabled>Select Team...</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[#555555] uppercase tracking-widest">Operational Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'view', icon: Eye, label: 'Observer' },
                      { id: 'execute', icon: Zap, label: 'Operator' },
                      { id: 'edit', icon: Edit3, label: 'Admin' }
                    ].map((role) => (
                      <button
                        key={role.id}
                        onClick={() => setPermission(role.id as any)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
                          permission === role.id 
                            ? "bg-[#3ECF8E]/10 border-[#3ECF8E] text-[#3ECF8E]" 
                            : "bg-[#111111] border-[#222222] text-[#444444] hover:border-[#333333]"
                        )}
                      >
                        <role.icon size={14} />
                        <span className="text-[8px] font-black uppercase tracking-widest">{role.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[8px] text-[#444444] uppercase tracking-tighter mt-2 text-center">
                    {permission === 'view' && 'Limited to observation. Cannot execute or modify protocols.'}
                    {permission === 'execute' && 'Authorized to execute requests and view historical data.'}
                    {permission === 'edit' && 'Full administrative override. Can modify all request parameters.'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-4">
            <button
               onClick={handleUpdate}
               disabled={isLoading || (visibility === 'team' && !teamId)}
               className="w-full py-4 bg-[#3ECF8E] text-[#0A0A0A] text-[11px] font-black uppercase tracking-[0.2em] rounded-xl hover:shadow-[0_0_20px_rgba(62,207,142,0.3)] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              Update Security Protocol
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Users, ChevronRight, LayoutGrid, Plus, Search, LogOut, Database, Key, Settings } from 'lucide-react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useStore } from '../../store/useStore';
import { PersistenceService } from '../../services/PersistenceService';
import { Team } from '../../types';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { globalSupabase } from '../../lib/supabase';

export const TeamSelection: React.FC = () => {
  const { setStep, setSetupMode, setIsConfigured, setWorkspaceId, setTeamId, setUserId } = useOnboardingStore();
  const { profile, setActiveWorkspaceId, setTeams, addToast } = useStore();
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const { logout } = useAuth();

  const [selectingTeamId, setSelectingTeamId] = useState<string | null>(null);

  const globalUrl = (globalSupabase as any).config?.url || 'unknown';

  useEffect(() => {
    const loadTeams = async () => {
      if (!profile?.id) return;
      try {
        const teams = await PersistenceService.fetchUserTeams(profile.id);
        setUserTeams(teams);
        setTeams(teams);
      } catch (error) {
        console.error('Failed to load teams:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [profile?.id, setTeams]);

  const handleSelectTeam = async (team: Team) => {
    if (selectingTeamId) return;
    
    setSelectingTeamId(team.id);
    console.group(`%c[TeamSelection] Selecting team: ${team.name}`, 'color: #3ECF8E; font-weight: bold;');
    console.log(`[Diagnostic] User Profile ID: ${profile?.id}`);
    console.log(`[Diagnostic] Global Endpoint: ${globalUrl}`);
    
    try {
      // Find workspaces for this team
      console.log('Fetching workspaces for team...');
      let workspaces = await PersistenceService.fetchWorkspacesByTeam(team.id);
      console.log(`Found ${workspaces.length} workspaces:`, workspaces);
      
      if (workspaces.length === 0 && profile?.id) {
        console.warn('CRITICAL: No workspaces found for team. Attempting emergency self-healing...');
        try {
          const newWorkspace = await PersistenceService.createWorkspace('General', profile.id, team.id);
          console.log('Self-healing successful. Created workspace:', newWorkspace);
          workspaces = [newWorkspace];
        } catch (wsError: any) {
          console.error('Self-healing failed. Root cause:', wsError.message);
          if (wsError.message.includes('column')) {
            throw new Error(`DATABASE_SCHEMA_ERROR: The 'workspaces' table in your global project (${globalUrl}) is missing the 'team_id' column. Please run the initialization script again.`);
          }
          throw wsError;
        }
      }

      if (workspaces.length > 0) {
        const targetWorkspace = workspaces[0];
        console.log('Target workspace:', targetWorkspace.name, targetWorkspace.id);
        
        // 1. Update onboarding store (persisted metadata)
        console.log('Updating onboarding store...');
        setTeamId(team.id);
        setUserId(profile.id);
        setWorkspaceId(targetWorkspace.id);
        
        // 2. Update global app store
        console.log('Updating global app store...');
        setActiveWorkspaceId(targetWorkspace.id);
        
        // 3. Mark as configured (triggers UI flip in App.tsx)
        console.log('Finalizing configuration...');
        setIsConfigured(true);
        setStep('complete');
        
        addToast({ 
          type: 'success', 
          message: `Mission objective locked. Connected to ${team.name}.` 
        });
      } else {
        console.warn('No workspaces found for this team. This shouldn\'t happen for standard setup.');
        addToast({ 
          type: 'error', 
          message: 'Structural error: No workspace found for this sector.' 
        });
      }
    } catch (error: any) {
      console.error('Team selection failed:', error);
      addToast({ 
        type: 'error', 
        message: `Connection failed: ${error.message || 'Unknown protocol error'}` 
      });
    } finally {
      console.groupEnd();
      setSelectingTeamId(null);
    }
  };

  const filteredTeams = userTeams.filter(t => 
    t.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-12 flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">System Access</h2>
          <p className="text-sm text-[#888888] mt-1 italic tracking-wide lowercase">Initialize secure uplink to available infrastructure nodes...</p>
        </div>
        <button
          onClick={() => logout()}
          className="p-2 hover:bg-red-500/10 rounded-lg transition-all group"
          title="Logout"
        >
          <LogOut size={20} className="text-[#555555] group-hover:text-red-500" />
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" size={16} />
        <input 
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="SEARCH_INFRASTRUCTURE..."
          className="w-full bg-black border border-[#222222] rounded-xl py-3 pl-10 pr-4 text-xs font-mono uppercase tracking-widest text-[#AAAAAA] focus:outline-none focus:border-[#3ECF8E]/40 transition-all"
        />
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#3ECF8E]/20 border-t-[#3ECF8E] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar no-scrollbar">
          {filteredTeams.map((team) => (
            <motion.button
              key={team.id}
              disabled={!!selectingTeamId}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => handleSelectTeam(team)}
              className={cn(
                "w-full group p-4 rounded-xl bg-gradient-to-r from-[#1A1A1A] to-transparent border transition-all text-left flex items-center gap-4",
                selectingTeamId === team.id ? "border-[#3ECF8E] bg-[#3ECF8E]/5" : "border-[#222222] hover:border-[#3ECF8E]/30 hover:from-[#3ECF8E]/5",
                selectingTeamId && selectingTeamId !== team.id ? "opacity-40 grayscale" : ""
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-lg bg-[var(--bg-surface)] border flex items-center justify-center shrink-0 transition-all",
                selectingTeamId === team.id ? "border-[#3ECF8E] bg-[#3ECF8E]/10" : "border-[#222222] group-hover:border-[#3ECF8E]/40 group-hover:bg-[#3ECF8E]/10"
              )}>
                {selectingTeamId === team.id ? (
                  <div className="w-4 h-4 border-2 border-[#3ECF8E]/20 border-t-[#3ECF8E] rounded-full animate-spin" />
                ) : (
                  <Users size={20} className="text-[#555555] group-hover:text-[#3ECF8E]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-white truncate uppercase tracking-widest">{team.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                   <div className="flex items-center gap-1 text-[9px] font-bold text-[#555555] uppercase tracking-tighter">
                      <LayoutGrid size={10} />
                      {selectingTeamId === team.id ? 'Establishing Sync...' : 'Infrastructure Node Ready'}
                   </div>
                </div>
              </div>

              <ChevronRight size={18} className={cn(
                "text-[#3ECF8E] transition-all",
                selectingTeamId === team.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )} />
            </motion.button>
          ))}

          {filteredTeams.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-[#222222] rounded-2xl">
              <Users size={32} className="mx-auto text-[#222222] mb-3" />
              <p className="text-xs font-bold text-[#555555] uppercase tracking-widest">No matching teams found</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-[#222222]">
        <div className="mb-4 px-2">
            <h4 className="text-[10px] font-black text-[#444444] uppercase tracking-[0.2em] mb-1">Active Infrastructure Node</h4>
            <div className="text-[9px] font-mono text-[#3ECF8E]/40 truncate bg-black/40 p-2 rounded-lg border border-[#222222]/50">
              {globalUrl || 'NOT_CONNECTED_ERROR'}
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              setSetupMode('create');
              setStep('create-setup');
            }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1A1A1A] border border-[#222222] text-[10px] font-black text-[#888888] uppercase tracking-widest hover:text-white hover:border-[#3ECF8E]/30 transition-all"
          >
            <Plus size={14} className="text-[#3ECF8E]" /> Setup Team
          </button>
          <button
            onClick={() => {
              setSetupMode('join');
              setStep('join-team');
            }}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1A1A1A] border border-[#222222] text-[10px] font-black text-[#888888] uppercase tracking-widest hover:text-white hover:border-[#3ECF8E]/30 transition-all"
          >
            <Key size={14} className="text-[#3ECF8E]" /> Join with Code
          </button>
          <button
            onClick={() => addToast({ type: 'info', message: 'Migration system coming soon.' })}
            className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A1A1A] border border-[#222222] text-[10px] font-black text-[#888888] uppercase tracking-widest hover:text-white hover:border-[#3ECF8E]/30 transition-all"
          >
            <Database size={14} className="text-[#3ECF8E]" /> Migrate Database
          </button>
        </div>
      </div>
    </motion.div>
  );
};

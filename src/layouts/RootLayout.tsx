import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useDataSync } from '../hooks/useDataSync';
import { Sidebar } from '../features/sidebar/Sidebar';
import { RequestEditor } from '../features/editor/RequestEditor';
import { ResponseViewer } from '../features/editor/ResponseViewer';
import { PersistenceService } from '../services/PersistenceService';
import { NameModal } from '../components/NameModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { SettingsModal } from '../components/SettingsModal';
import { ScriptLibrary } from '../components/ScriptLibrary/ScriptLibrary';
import { ToastContainer } from '../components/Toast';
import { 
  Terminal, 
  Search, 
  Settings, 
  Bell, 
  HelpCircle, 
  Cloud, 
  User,
  ChevronDown,
  LayoutGrid,
  Plus,
  Globe
} from 'lucide-react';
import { Workspace } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

import { StatusBar } from '../components/StatusBar';

export const RootLayout: React.FC = () => {
  const { 
    activeWorkspaceId, 
    workspaces, 
    profile, 
    setProfile, 
    setActiveWorkspaceId,
    addTab,
    consoleCollapsed,
    setConsoleCollapsed,
    addToast,
    environments,
    activeEnvId,
    setActiveEnvId,
    syncStatus,
    settings,
    updateSettings,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isScriptLabOpen,
    setIsScriptLabOpen
  } = useStore();
  const { fetchWorkspaces, fetchCollections, fetchEnvironments, fetchHistory, fetchTeams } = useDataSync();

  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileData) {
          setProfile(profileData);
          if (profileData.preferences?.theme) {
             updateSettings({ appearance: { ...settings.appearance, theme: profileData.preferences.theme } });
          }
        } else {
          setProfile({
            id: session.user.id,
            email: session.user.email!,
            full_name: session.user.user_metadata?.full_name || 'Operator',
            preferences: { theme: 'dark', sidebar_width: 300 }
          });
        }
        
        fetchWorkspaces(session.user.id);
        fetchTeams(session.user.id);
      }
    };

    initSession();
  }, []);

  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isRenameWorkspaceModalOpen, setIsRenameWorkspaceModalOpen] = useState(false);
  const [workspaceToRename, setWorkspaceToRename] = useState<Workspace | null>(null);
  const [envFilterQuery, setEnvFilterQuery] = useState('');
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isEnvironmentMenuOpen, setIsEnvironmentMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [wsToDelete, setWsToDelete] = useState<{ id: string; name: string } | null>(null);
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const environmentMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const filteredEnvironments = useMemo(() => {
    const query = envFilterQuery.trim().toLowerCase();
    if (!environments) return [];
    if (!query) return environments;
    return environments.filter((env) => (env.name || '').toLowerCase().includes(query));
  }, [environments, envFilterQuery]);

  const handleCreateWorkspace = async (name: string) => {
    if (!profile?.id) return;
    try {
      const ws = await PersistenceService.createWorkspace(name, profile.id);
      await fetchWorkspaces(profile.id);
      setActiveWorkspaceId(ws.id);
      addToast({ type: 'success', message: `Workspace "${name}" initialized.` });
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to initialize workspace.' });
    }
  };

  const handleRenameWorkspace = async (name: string) => {
    if (!workspaceToRename || !profile?.id) return;
    try {
      useStore.getState().updateWorkspace(workspaceToRename.id, { name });
      addToast({ type: 'info', message: 'Workspace identity update scheduled.' });
    } catch (err) {
      addToast({ type: 'error', message: 'Identity update failed.' });
    }
  };

  const handleDeleteWorkspace = async (wsId: string, wsName: string) => {
    if (workspaces.length <= 1) {
      addToast({ type: 'warning', message: 'Mission Critical: Minimum one workspace required.' });
      return;
    }
    setWsToDelete({ id: wsId, name: wsName });
  };

  const handleConfirmedDeleteWorkspace = async () => {
    if (!wsToDelete) return;
    try {
      await PersistenceService.deleteWorkspace(wsToDelete.id);
      addToast({ type: 'info', message: `Workspace "${wsToDelete.name}" decommissioned.` });
      if (activeWorkspaceId === wsToDelete.id) {
        const nextWs = workspaces.find(w => w.id !== wsToDelete.id);
        setActiveWorkspaceId(nextWs?.id || null);
      }
    } catch (err) {
      addToast({ type: 'error', message: 'Decommissioning failed.' });
    }
    setWsToDelete(null);
  };

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchCollections(activeWorkspaceId);
      fetchEnvironments(activeWorkspaceId);
      fetchHistory(activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setIsWorkspaceMenuOpen(false);
      }
      if (environmentMenuRef.current && !environmentMenuRef.current.contains(event.target as Node)) {
        setIsEnvironmentMenuOpen(false);
      }
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const handleToggleTheme = async () => {
    const nextTheme = settings.appearance.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ appearance: { ...settings.appearance, theme: nextTheme } });

    if (!profile) return;
    try {
      const preferences: typeof profile.preferences = { ...profile.preferences, theme: nextTheme };
      setProfile({ ...profile, preferences });
      await PersistenceService.updateProfilePreferences(profile.id, preferences);
      setIsProfileMenuOpen(false);
      addToast({ type: 'success', message: `${nextTheme === 'light' ? 'Light' : 'Dark'} theme activated.` });
    } catch {
      addToast({ type: 'error', message: 'Failed to persist theme preference.' });
    }
  };

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="theme-shell h-screen w-screen flex flex-col font-sans selection:bg-[var(--brand)]/30 overflow-hidden text-sm bg-[var(--bg-deep)] text-[var(--text-main)]">
      <ToastContainer />
      <NameModal 
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
        onConfirm={handleCreateWorkspace}
        title="Initialize New Workspace"
        placeholder="WORKSPACE_NAME..."
      />
      <NameModal 
        isOpen={isRenameWorkspaceModalOpen}
        onClose={() => setIsRenameWorkspaceModalOpen(false)}
        onConfirm={handleRenameWorkspace}
        title="Update Workspace Identity"
        placeholder="NEW_NAME..."
        initialValue={workspaceToRename?.name}
      />
      <ConfirmModal
        isOpen={!!wsToDelete}
        onClose={() => setWsToDelete(null)}
        onConfirm={handleConfirmedDeleteWorkspace}
        title="Decommission Workspace"
        description={`Delete "${wsToDelete?.name}" and all its collections? This cannot be undone.`}
        confirmText="Decommission"
        variant="danger"
      />
      <AnimatePresence>
        {isSettingsModalOpen && (
          <SettingsModal 
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
          />
        )}
        {isScriptLabOpen && (
          <ScriptLibrary 
            isOpen={isScriptLabOpen}
            onClose={() => setIsScriptLabOpen(false)}
          />
        )}
      </AnimatePresence>
      {/* Top Universal Rail */}
      <header className="h-12 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center px-4 justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#3ECF8E] rounded flex items-center justify-center shadow-[0_0_15px_rgba(62,207,142,0.3)]">
              <Terminal size={12} className="text-black" />
            </div>
            <span className="text-[10px] font-black tracking-widest uppercase">Gimay</span>
          </div>
          
          <div className="h-4 w-px bg-[#222222]" />

          <div ref={workspaceMenuRef} className="relative">
            <button
              onClick={() => setIsWorkspaceMenuOpen((open) => !open)}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#1A1A1A] transition-all group"
            >
              <LayoutGrid size={12} className="text-[#555555] group-hover:text-[#3ECF8E]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#888888]">
                {activeWorkspace?.name || 'Local'}
              </span>
              <ChevronDown size={8} className="text-[#555555]" />
            </button>

            <div className={cn(
              "absolute top-full left-0 mt-1 w-64 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-2xl py-2 transition-all z-50",
              isWorkspaceMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1 pointer-events-none"
            )}>
              <div className="px-4 py-2 mb-1 border-b border-[var(--border-subtle)]">
                <h3 className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Select Workspace</h3>
              </div>
              <div className="max-h-60 overflow-y-auto no-scrollbar">
                {workspaces.map(ws => (
                  <div
                    key={ws.id}
                    onClick={() => {
                      setActiveWorkspaceId(ws.id);
                      setIsWorkspaceMenuOpen(false);
                    }}
                    className={cn(
                      "w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-deep)] cursor-pointer transition-colors text-left group/ws",
                      activeWorkspaceId === ws.id ? "bg-[var(--brand)]/5" : ""
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shadow-sm",
                      activeWorkspaceId === ws.id ? "bg-[var(--brand)] text-black" : "bg-[var(--bg-deep)] text-[var(--text-dim)]"
                    )}>
                      {(ws.name || 'W')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "text-[10px] font-bold truncate",
                        activeWorkspaceId === ws.id ? "text-[var(--brand)]" : "text-[var(--text-muted)]"
                      )}>
                        {ws.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover/ws:opacity-100 transition-all">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           setWorkspaceToRename(ws);
                           setIsRenameWorkspaceModalOpen(true);
                           setIsWorkspaceMenuOpen(false);
                         }}
                         className="p-1 hover:text-[var(--text-main)] text-[var(--text-dim)]"
                       >
                         <Settings size={10} />
                       </button>
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           setIsWorkspaceMenuOpen(false);
                           handleDeleteWorkspace(ws.id, ws.name);
                         }}
                         className="p-1 hover:text-red-500 text-[var(--text-dim)]"
                       >
                         <Plus size={10} className="rotate-45" />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-[var(--border-subtle)] mt-1">
                <button 
                  onClick={() => {
                    setIsWorkspaceModalOpen(true);
                    setIsWorkspaceMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 text-[9px] font-black text-[var(--brand)] uppercase tracking-widest hover:text-[var(--text-main)] transition-colors py-1"
                >
                  <Plus size={10} /> New Workspace
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div ref={environmentMenuRef} className="relative">
              <button
                onClick={() => setIsEnvironmentMenuOpen((open) => !open)}
                className="flex items-center gap-2 px-2 py-1 bg-[#0A0A0A] border border-[#222222] rounded hover:border-[#3ECF8E]/30 transition-all min-w-[110px]"
              >
                <Globe size={11} className={cn(activeEnvId ? "text-[#3ECF8E]" : "text-[#555555]")} />
                <span className="text-[8px] font-black uppercase tracking-widest text-[#AAAAAA] truncate flex-1 text-left">
                  {environments.find(e => e.id === activeEnvId)?.name || 'Local Env'}
                </span>
                <ChevronDown size={8} className="text-[#555555]" />
              </button>

              <div className={cn(
                "absolute top-full right-0 mt-1 w-64 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-2xl py-2 transition-all z-[60]",
                isEnvironmentMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1 pointer-events-none"
              )}>
                <div className="px-2 pb-2 border-b border-[var(--border-subtle)]">
                  <input
                    value={envFilterQuery}
                    onChange={(e) => setEnvFilterQuery(e.target.value)}
                    placeholder="SEARCH_ENVIRONMENTS..."
                    className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-md py-1.5 px-2 text-[10px] font-mono text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand)]/40"
                  />
                </div>
                <div 
                  onClick={() => {
                    setActiveEnvId(null);
                    setIsEnvironmentMenuOpen(false);
                  }}
                  className={cn(
                    "px-3 py-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-[var(--bg-deep)] transition-colors",
                    !activeEnvId ? "text-[var(--brand)]" : "text-[var(--text-dim)]"
                  )}
                >
                  No Environment
                </div>
                {filteredEnvironments.map(env => (
                  <div 
                    key={env.id}
                    onClick={() => {
                      setActiveEnvId(env.id);
                      setIsEnvironmentMenuOpen(false);
                    }}
                    className={cn(
                      "px-3 py-2 text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-[var(--bg-deep)] transition-colors",
                      activeEnvId === env.id ? "text-[var(--brand)]" : "text-[var(--text-muted)]"
                    )}
                  >
                    {env.name}
                  </div>
                ))}
                {filteredEnvironments.length === 0 && (
                  <div className="px-3 py-3 text-[9px] font-bold uppercase tracking-widest text-[var(--text-dim)]">No matches</div>
                )}
                <div className="px-2 pt-2 mt-1 border-t border-[var(--border-subtle)]">
                  <button
                    onClick={() => {
                      addTab({
                        id: 'tab-environments',
                        type: 'environment-manager',
                        name: 'Environments',
                        environmentId: activeEnvId || undefined,
                      });
                      setIsEnvironmentMenuOpen(false);
                    }}
                    className="w-full py-1.5 rounded-md border border-[var(--border-subtle)] text-[9px] font-black uppercase tracking-widest text-[var(--brand)] hover:bg-[var(--brand)]/10 transition-all"
                  >
                    Show All Environments
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0A0A0A] border border-[#222222] rounded-full">
            {syncStatus === 'saving' ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-[8px] font-bold text-blue-400 uppercase tracking-tighter">Syncing</span>
              </>
            ) : syncStatus === 'error' ? (
              <>
                <Cloud size={9} className="text-red-500" />
                <span className="text-[8px] font-bold text-red-500 uppercase tracking-tighter">Error</span>
              </>
            ) : (
              <>
                <Cloud size={9} className="text-[#3ECF8E]" />
                <span className="text-[8px] font-bold text-[#3ECF8E] uppercase tracking-tighter">
                  {syncStatus === 'saved' ? 'Saved' : 'Synced'}
                </span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-1">
             <button className="p-1.5 text-[#555555] hover:text-white transition-all"><Search size={14} /></button>
             <button className="p-1.5 text-[#555555] hover:text-white transition-all"><Bell size={14} /></button>
             <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-1.5 text-[#555555] hover:text-[#3ECF8E] transition-all"
             >
               <Settings size={14} />
             </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 flex overflow-hidden">
        <Sidebar aria-label="Collections Sidebar" />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 flex overflow-hidden">
             <RequestEditor />
          </div>
          
          <AnimatePresence>
            {!consoleCollapsed && (
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: 190 }}
                exit={{ height: 0 }}
                className="border-t border-[#1C1C1F] bg-[#050506]/95 backdrop-blur-xl overflow-hidden flex flex-col relative"
              >
                {/* Futuristic matrix scanline overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40 z-10" />

                {/* Terminal Header */}
                <div className="h-8 border-b border-[#1C1C1F] flex items-center justify-between px-3 bg-[#0A0A0C]/90 shrink-0 z-20">
                   <div className="flex items-center gap-3">
                     <span className="text-[8px] font-black text-[#8E8E93] uppercase tracking-[0.25em] flex items-center gap-2 font-mono">
                       <Terminal size={11} className="text-[#3ECF8E] drop-shadow-[0_0_3px_#3ECF8E]" />
                       Protocol System Core
                     </span>
                     
                     <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#3ECF8E]/5 border border-[#3ECF8E]/10">
                       <span className="w-1 h-1 rounded-full bg-[#3ECF8E] animate-pulse" />
                       <span className="text-[6.5px] text-[#3ECF8E]/70 font-mono tracking-normal uppercase">ZERO FAULTS</span>
                     </div>
                   </div>
                   
                   <button 
                    onClick={() => setConsoleCollapsed(true)} 
                    className="text-[7.5px] font-black text-[#5E5E64] hover:text-red-400 hover:bg-[#1A1A1F] border border-transparent hover:border-red-950/20 px-2 py-0.5 rounded-md transition-all font-mono tracking-wider"
                   >
                     TERMINATE TERMINAL
                   </button>
                </div>

                {/* Terminal Output Logs */}
                <div className="flex-1 overflow-y-auto font-mono text-[9.5px] text-[#888888] divide-y divide-[#131316] custom-scrollbar bg-[#050506]/90 z-20 pb-2">
                   {/* Log KERN */}
                   <div className="flex gap-0 hover:bg-[#0C0C0F] transition-colors items-center border-l-2 border-emerald-500/60 pl-0.5">
                     <span className="text-[#44444F] shrink-0 font-bold tabular-nums border-r border-[#131316] pr-3 py-1.5 min-w-[85px] text-center select-none">{new Date().toLocaleTimeString()}</span>
                     <span className="text-[#3ECF8E] bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[7px] font-black px-1.5 py-0.5 rounded shrink-0 min-w-[50px] text-center uppercase tracking-widest font-mono mx-3 select-none">[KERN]</span>
                     <span className="text-[#D1D1D6] leading-normal font-semibold tracking-wide py-1.5 pr-4 flex-1">Uplink established; core kernel version 2.4.0 active.</span>
                   </div>

                   {/* Log AUTH */}
                   <div className="flex gap-0 hover:bg-[#0C0C0F] transition-colors items-center border-l-2 border-blue-500/60 pl-0.5">
                     <span className="text-[#44444F] shrink-0 font-bold tabular-nums border-r border-[#131316] pr-3 py-1.5 min-w-[85px] text-center select-none">{new Date().toLocaleTimeString()}</span>
                     <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 text-[7px] font-black px-1.5 py-0.5 rounded shrink-0 min-w-[50px] text-center uppercase tracking-widest font-mono mx-3 select-none">[AUTH]</span>
                     <span className="text-[#D1D1D6] leading-normal font-semibold tracking-wide py-1.5 pr-4 flex-1">Handshake success: Node identity <span className="text-blue-300 font-bold">{profile?.email}</span> validated on sector A.</span>
                   </div>

                   {/* Log SYNC */}
                   <div className="flex gap-0 hover:bg-[#0C0C0F] transition-colors items-center border-l-2 border-yellow-500/60 pl-0.5">
                     <span className="text-[#44444F] shrink-0 font-bold tabular-nums border-r border-[#131316] pr-3 py-1.5 min-w-[85px] text-center select-none">{new Date().toLocaleTimeString()}</span>
                     <span className="text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 text-[7px] font-black px-1.5 py-0.5 rounded shrink-0 min-w-[50px] text-center uppercase tracking-widest font-mono mx-3 select-none">[SYNC]</span>
                     <span className="text-yellow-200 leading-normal font-semibold tracking-wide py-1.5 pr-4 flex-1">Real-time delta channel initializing... heartbeat listening on sector 7.</span>
                   </div>

                   {/* Log SUCCESS */}
                   <div className="flex gap-0 hover:bg-[#0C0C0F] transition-colors items-center border-l-2 border-[#3ECF8E]/60 pl-0.5">
                     <span className="text-[#44444F] shrink-0 font-bold tabular-nums border-r border-[#131316] pr-3 py-1.5 min-w-[85px] text-center select-none">{new Date().toLocaleTimeString()}</span>
                     <span className="text-[#3ECF8E] bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[7px] font-black px-1.5 py-0.5 rounded shrink-0 min-w-[50px] text-center uppercase tracking-widest font-mono mx-3 select-none">[SUCCESS]</span>
                     <span className="text-[#D1D1D6] leading-normal font-semibold tracking-wide py-1.5 pr-4 flex-1">System ready for packet routing and state synchronization.</span>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer / Status Bar Replacement */}
      <StatusBar />
    </div>
  );
};

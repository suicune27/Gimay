import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useDataSync } from '../hooks/useDataSync';
import { Sidebar } from '../features/sidebar/Sidebar';
import { RequestEditor } from '../features/editor/RequestEditor';
import { ResponseViewer } from '../features/editor/ResponseViewer';
import { ScriptLibraryModal } from '../features/scripts/ScriptLibraryModal';
import { PersistenceService } from '../services/PersistenceService';
import { NameModal } from '../components/NameModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { SettingsModal } from '../components/SettingsModal';
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
  Globe,
  PanelLeftOpen,
  PanelLeftClose
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
    isSidebarPinned,
    setIsSidebarPinned
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
      </AnimatePresence>
      <ScriptLibraryModal />
      {/* Top Universal Rail */}
      <header className="h-12 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center px-4 justify-between z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarPinned(!isSidebarPinned)}
              className={cn(
                "p-1.5 rounded-md transition-all",
                isSidebarPinned ? "text-[#3ECF8E] bg-[#3ECF8E]/10" : "text-[#555555] hover:text-[#3ECF8E] hover:bg-white/[0.03]"
              )}
              title={isSidebarPinned ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarPinned ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
            <div className="w-5 h-5 bg-[#3ECF8E] rounded flex items-center justify-center shadow-[0_0_15px_rgba(62,207,142,0.3)]">
              <Terminal size={12} className="text-black" />
            </div>
            <span className="text-[10px] font-black tracking-widest uppercase">Putman</span>
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
                animate={{ height: 180 }}
                exit={{ height: 0 }}
                className="border-t border-[#111111] bg-[#050505] overflow-hidden flex flex-col"
              >
                <div className="h-7 border-b border-[#1A1A1A] flex items-center justify-between px-3 bg-[#0A0A0A] shrink-0">
                   <div className="flex items-center gap-3">
                     <span className="text-[8px] font-black text-[#666666] uppercase tracking-[0.3em] flex items-center gap-2">
                       <Terminal size={10} className="text-[#3ECF8E]" />
                       Protocol System Core
                     </span>
                     <div className="flex gap-1">
                        <div className="w-1 h-1 rounded-full bg-[#3ECF8E] animate-pulse" />
                        <div className="w-1 h-1 rounded-full bg-[#3ECF8E] opacity-10" />
                     </div>
                   </div>
                   <button 
                    onClick={() => setConsoleCollapsed(true)} 
                    className="text-[7px] font-black text-[#555555] hover:text-[#3ECF8E] uppercase transition-colors tracking-[0.2em] px-2 py-0.5 rounded hover:bg-white/[0.03]"
                   >
                     Disconnect Terminal
                   </button>
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-[9px] text-[#888888] divide-y divide-white/[0.02] custom-scrollbar bg-black/60">
                   <div className="flex gap-4 px-4 py-1.5 hover:bg-white/[0.01] transition-colors">
                     <span className="text-[#222222] shrink-0 font-medium tabular-nums border-r border-white/[0.02] pr-3 min-w-[70px] text-center">{new Date().toLocaleTimeString()}</span>
                     <span className="text-[#3ECF8E] font-bold shrink-0">[KERN]</span>
                     <span className="opacity-70 leading-normal">Uplink established; kernel version 2.4.0 active.</span>
                   </div>
                   <div className="flex gap-4 px-4 py-1.5 hover:bg-white/[0.01] transition-colors">
                     <span className="text-[#222222] shrink-0 font-medium tabular-nums border-r border-white/[0.02] pr-3 min-w-[70px] text-center">{new Date().toLocaleTimeString()}</span>
                     <span className="text-[#3ECF8E] font-bold shrink-0">[AUTH]</span>
                     <span className="opacity-70 leading-normal">Handshake success: Node identity {profile?.email} validated.</span>
                   </div>
                   <div className="flex gap-4 px-4 py-1.5 hover:bg-white/[0.01] transition-colors text-yellow-500/60">
                     <span className="text-[#222222] shrink-0 font-medium tabular-nums border-r border-white/[0.02] pr-3 min-w-[70px] text-center">{new Date().toLocaleTimeString()}</span>
                     <span className="font-bold shrink-0">[SYNC]</span>
                     <span className="leading-normal">Real-time delta channel initializing... heartbeat listening on sector 7.</span>
                   </div>
                   <div className="flex gap-4 px-4 py-1.5 hover:bg-white/[0.01] transition-colors text-[#3ECF8E]">
                     <span className="text-[#222222] shrink-0 font-medium tabular-nums border-r border-white/[0.02] pr-3 min-w-[70px] text-center">{new Date().toLocaleTimeString()}</span>
                     <span className="font-bold shrink-0">[SUCCESS]</span>
                     <span className="font-medium leading-normal tracking-tight">System ready for packet routing.</span>
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

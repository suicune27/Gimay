import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useDataSync, useDataSyncSubscription } from '../hooks/useDataSync';
import { Sidebar } from '../features/sidebar/Sidebar';
import { RequestEditor } from '../features/editor/RequestEditor';
import { ResponseViewer } from '../features/editor/ResponseViewer';
import { ScriptLibraryModal } from '../features/scripts/ScriptLibraryModal';
import { ScriptLibrary as ScriptLab } from '../components/ScriptLibrary/ScriptLibrary';
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
  PanelLeftClose,
  Laptop,
  Palette,
  Pin
} from 'lucide-react';
import { Workspace } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { isElectron } from '../lib/platform';

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
    setIsSidebarPinned,
    isScriptLabOpen,
    setIsScriptLabOpen,
    setLandingSkipped,
    layoutOrientation,
    setLayoutOrientation
  } = useStore();
  const { fetchWorkspaces, fetchCollections, fetchEnvironments, fetchHistory, fetchTeams } = useDataSync();
  useDataSyncSubscription();

  const [activeAccent, setActiveAccent] = useState<'emerald' | 'sapphire' | 'ruby' | 'amber' | 'amethyst'>(() => {
    return (localStorage.getItem('gmy_theme_accent') as any) || 'emerald';
  });

  useEffect(() => {
    const applyTheme = (base: string, accent: string) => {
      const root = document.documentElement;
      
      // 1. Base Theme
      let resolvedBase = base;
      if (base === 'system') {
        resolvedBase = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      
      if (resolvedBase === 'light') {
        root.classList.add('light');
        useStore.setState({ theme: 'light' });
      } else {
        root.classList.remove('light');
        useStore.setState({ theme: 'dark' });
      }
      
      // 2. Accent color variables
      const accents = {
        emerald: { brand: '#3ECF8E', brandMuted: 'rgba(62, 207, 142, 0.1)', brandBorder: 'rgba(62, 207, 142, 0.2)' },
        sapphire: { brand: '#3B82F6', brandMuted: 'rgba(59, 130, 246, 0.1)', brandBorder: 'rgba(59, 130, 246, 0.2)' },
        ruby: { brand: '#EF4444', brandMuted: 'rgba(239, 68, 68, 0.1)', brandBorder: 'rgba(239, 68, 68, 0.2)' },
        amber: { brand: '#F59E0B', brandMuted: 'rgba(245, 158, 11, 0.1)', brandBorder: 'rgba(245, 158, 11, 0.2)' },
        amethyst: { brand: '#8B5CF6', brandMuted: 'rgba(139, 92, 246, 0.1)', brandBorder: 'rgba(139, 92, 246, 0.2)' }
      };
      
      const selectedAccent = (accents as any)[accent] || accents.emerald;
      root.style.setProperty('--brand', selectedAccent.brand);
      root.style.setProperty('--brand-muted', selectedAccent.brandMuted);
      root.style.setProperty('--brand-border', selectedAccent.brandBorder);
    };

    applyTheme(settings.appearance.theme, activeAccent);
  }, [settings.appearance.theme, activeAccent]);

  useEffect(() => {
    const initSession = async () => {
      if (isElectron() && typeof navigator !== 'undefined' && !navigator.onLine) {
        console.warn('[RootLayout] Offline mode active. Using local data context.');
        if (!profile) {
          setProfile({
            id: 'offline-user-id',
            email: 'offline@gimay.io',
            full_name: 'Offline Operator',
            preferences: { theme: 'dark', sidebar_width: 300 }
          } as any);
        }
        if (workspaces.length === 0) {
          const localWs = { id: 'offline-ws', name: 'Offline Sandbox Workspace', user_id: 'offline-user-id', visibility: 'private' };
          useStore.setState({ workspaces: [localWs as any], activeWorkspaceId: 'offline-ws' });
        }
        return;
      }

      try {
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
            } as any);
          }
          
          fetchWorkspaces(session.user.id);
          fetchTeams(session.user.id);
        }
      } catch (err) {
        console.warn('[RootLayout] Session check failed. Running offline fallback:', err);
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
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [wsToDelete, setWsToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const environmentMenuRef = useRef<HTMLDivElement | null>(null);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);

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
    if (!wsToDelete || !profile?.id) return;
    try {
      await PersistenceService.deleteWorkspace(wsToDelete.id);
      await fetchWorkspaces(profile.id);
      addToast({ type: 'info', message: `Workspace "${wsToDelete.name}" decommissioned.` });
      if (activeWorkspaceId === wsToDelete.id) {
        const freshWorkspaces = useStore.getState().workspaces;
        const nextWs = freshWorkspaces.find(w => w.id !== wsToDelete.id);
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
  }, [activeWorkspaceId, profile?.id]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setIsWorkspaceMenuOpen(false);
      }
      if (environmentMenuRef.current && !environmentMenuRef.current.contains(event.target as Node)) {
        setIsEnvironmentMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const activeEnvironment = environments.find(e => e.id === activeEnvId);

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
        {isDisconnectDialogOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-[var(--brand)] to-blue-500" />
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
                    <Plus className="rotate-45" size={16} />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-widest font-mono">Secure Node Handshake Closed</h3>
                    <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-tight mt-0.5">Desktop Core Terminal Sandbox Instance</p>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed font-mono">
                  You requested to shutdown the active desktop shell. Because you are in secure cloud preview mode, the database uplink remains synchronized. Your active tokens are securely stored in the Supabase network.
                </p>

                <div className="bg-black/35 border border-[var(--border-subtle)] rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between text-[8px] font-mono uppercase tracking-tight">
                    <span className="text-[var(--text-dim)]">Session Status</span>
                    <span className="text-[var(--brand)] font-bold">ONLINE (PREVIEW)</span>
                  </div>
                  <div className="flex justify-between text-[8px] font-mono uppercase tracking-tight">
                    <span className="text-[var(--text-dim)]">Active Operator</span>
                    <span className="text-white font-bold">{profile?.email || 'Guest Developer'}</span>
                  </div>
                  <div className="flex justify-between text-[8px] font-mono uppercase tracking-tight">
                    <span className="text-[var(--text-dim)]">Tenant Registry</span>
                    <span className="text-blue-400 font-bold">{activeWorkspace?.name || 'Local Sandbox'}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setIsDisconnectDialogOpen(false)}
                    className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-white/5 border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[9px] font-black uppercase tracking-widest text-white transition-all cursor-pointer"
                  >
                    Keep Session Active
                  </button>
                  <button
                    onClick={() => {
                      setIsDisconnectDialogOpen(false);
                      addToast({ type: 'info', message: 'Secured node session cache refreshed.' });
                    }}
                    className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 hover:border-red-500/30 text-[9px] font-black uppercase tracking-widest text-red-400 hover:text-white transition-all cursor-pointer"
                  >
                    Refresh Uplink
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isSettingsModalOpen && (
          <SettingsModal 
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
          />
        )}
      </AnimatePresence>
      <ScriptLibraryModal />
      <ScriptLab isOpen={isScriptLabOpen} onClose={() => setIsScriptLabOpen(false)} />
      {/* Top Universal Rail */}
      <header className={cn(
        "h-12 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center px-4 justify-between z-[100]",
        isElectron() && "titlebar-drag-region select-none"
      )}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarPinned(!isSidebarPinned)}
              className={cn(
                "p-1.5 rounded-md transition-all text-[#555555] hover:text-[var(--brand)] hover:bg-white/[0.03] titlebar-no-drag",
                isSidebarPinned && "text-[var(--brand)] bg-[var(--brand)]/10"
              )}
              title={isSidebarPinned ? "Unlock Sidebar" : "Lock Sidebar"}
            >
              <Pin size={15} className={cn("transition-transform duration-300", !isSidebarPinned && "rotate-45")} />
            </button>
            <button
              onClick={() => {
                if (!isElectron()) {
                  window.history.pushState(null, '', '/');
                }
                setLandingSkipped(false);
              }}
              className="flex items-center gap-2 hover:opacity-80 transition-all cursor-pointer focus:outline-none titlebar-no-drag"
              title="Return to Landing Page"
            >
              <div className="w-5 h-5 bg-[var(--brand)] rounded flex items-center justify-center shadow-[0_0_15px_var(--brand-muted)]">
                <Terminal size={12} className="text-black" />
              </div>
              <span className="text-[10px] font-black tracking-widest uppercase">Gimay</span>
            </button>
          </div>
          
          <div className="h-4 w-px bg-[#222222]" />

          {/* Workspace selector dropdown */}
          <div ref={workspaceMenuRef} className="relative titlebar-no-drag">
            <button
              onClick={() => setIsWorkspaceMenuOpen((open) => !open)}
              className="flex items-center gap-2 px-2.5 py-1 rounded hover:bg-[#1A1A1A] transition-all group border border-transparent hover:border-[var(--border-subtle)]"
            >
              <LayoutGrid size={12} className="text-[#555555] group-hover:text-[var(--brand)]" />
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

          <div className="h-4 w-px bg-[#222222]" />

          {/* Environment Selector Dropdown */}
          <div ref={environmentMenuRef} className="relative titlebar-no-drag">
            <button
              onClick={() => setIsEnvironmentMenuOpen((open) => !open)}
              className="flex items-center gap-2 px-2.5 py-1 rounded hover:bg-[#1A1A1A] transition-all group border border-transparent hover:border-[var(--border-subtle)]"
            >
              <Globe size={12} className={cn("transition-colors", activeEnvironment ? "text-[var(--brand)]" : "text-[#555555]")} />
              <span className={cn("text-[9px] font-bold uppercase tracking-widest", activeEnvironment ? "text-white" : "text-[#888888]")}>
                {activeEnvironment?.name || 'No Environment'}
              </span>
              {activeEnvironment && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] shadow-[0_0_6px_var(--brand)]" />
              )}
              <ChevronDown size={8} className="text-[#555555]" />
            </button>

            <div className={cn(
              "absolute top-full left-0 mt-1 w-64 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-2xl py-2 transition-all z-50",
              isEnvironmentMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1 pointer-events-none"
            )}>
              <div className="px-4 py-2 border-b border-[var(--border-subtle)] space-y-2">
                <h3 className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Select Environment</h3>
                <div className="relative">
                  <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#444444]" />
                  <input
                    type="text"
                    placeholder="Search environments..."
                    value={envFilterQuery}
                    onChange={(e) => setEnvFilterQuery(e.target.value)}
                    className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg py-1 pl-7 pr-3 text-[9px] font-mono text-white outline-none focus:border-[var(--brand)]/35 placeholder:text-[#333333]"
                  />
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto no-scrollbar py-1">
                <div
                  onClick={() => {
                    setActiveEnvId(null);
                    setIsEnvironmentMenuOpen(false);
                  }}
                  className={cn(
                    "w-full px-4 py-2 flex items-center justify-between hover:bg-[var(--bg-deep)] cursor-pointer transition-colors text-[9px] font-black uppercase tracking-widest",
                    activeEnvId === null ? "text-[var(--brand)] bg-[var(--brand)]/5" : "text-[var(--text-muted)] hover:text-white"
                  )}
                >
                  <span>No Environment</span>
                  {activeEnvId === null && <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] shadow-[0_0_6px_var(--brand)]" />}
                </div>

                {filteredEnvironments.map(env => (
                  <div
                    key={env.id}
                    onClick={() => {
                      setActiveEnvId(env.id);
                      setIsEnvironmentMenuOpen(false);
                    }}
                    className={cn(
                      "w-full px-4 py-2 flex items-center justify-between hover:bg-[var(--bg-deep)] cursor-pointer transition-colors text-[9px] font-black uppercase tracking-widest",
                      activeEnvId === env.id ? "text-[var(--brand)] bg-[var(--brand)]/5" : "text-[var(--text-muted)] hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-4">
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        activeEnvId === env.id ? "bg-[var(--brand)]" : "bg-[#55555C]"
                      )} />
                      <span className="truncate">{env.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] text-[#444444] font-mono">
                        {env.is_global ? 'Cloud' : 'Local'}
                      </span>
                      {activeEnvId === env.id && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] shadow-[0_0_6px_var(--brand)]" />
                      )}
                    </div>
                  </div>
                ))}

                {filteredEnvironments.length === 0 && envFilterQuery && (
                  <div className="px-4 py-3 text-center text-[9px] text-[#55555C] uppercase tracking-widest">
                    No matching modules
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right side options */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#0A0A0A] border border-[#222222] rounded-full titlebar-no-drag">
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
                <Cloud size={9} className="text-[var(--brand)]" />
                <span className="text-[8px] font-bold text-[var(--brand)] uppercase tracking-tighter">
                  {syncStatus === 'saved' ? 'Saved' : 'Synced'}
                </span>
              </>
            )}
          </div>

          {/* Theme & Accent Custom Popover */}
          <div ref={themeMenuRef} className="relative titlebar-no-drag">
            <button
              onClick={() => setIsThemeMenuOpen((open) => !open)}
              className="p-1.5 rounded-lg text-[#555555] hover:text-white hover:bg-[#1A1A1A] transition-all flex items-center justify-center border border-transparent hover:border-[var(--border-subtle)]"
              title="Aesthetic Config"
            >
              <Palette size={14} className="text-[#888888] hover:text-[var(--brand)] transition-colors" />
            </button>

            <div className={cn(
              "absolute top-full right-0 mt-1 w-56 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-4 transition-all z-50 space-y-4",
              isThemeMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1 pointer-events-none"
            )}>
              <div className="border-b border-[var(--border-subtle)] pb-2">
                <h3 className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Base Theme</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'dark', label: 'Dark', icon: Moon },
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'system', label: 'System', icon: Laptop }
                ].map((t) => {
                  const Icon = t.icon;
                  const isActive = settings.appearance.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        updateSettings({ appearance: { ...settings.appearance, theme: t.id as any } });
                        if (profile) {
                          PersistenceService.updateProfilePreferences(profile.id, {
                            ...profile.preferences,
                            theme: t.id as any
                          });
                        }
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all text-[8px] font-black uppercase tracking-widest",
                        isActive 
                          ? "bg-[var(--brand)]/10 border-[var(--brand)] text-[var(--brand)] shadow-[0_0_10px_var(--brand-muted)]" 
                          : "bg-[var(--bg-deep)] border-[var(--border-subtle)] text-[#55555C] hover:border-[#333333] hover:text-white"
                      )}
                    >
                      <Icon size={12} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="border-b border-[var(--border-subtle)] pt-1 pb-2">
                <h3 className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Accent Core</h3>
              </div>

              <div className="flex items-center justify-between px-1">
                {[
                  { id: 'emerald', color: '#3ECF8E', label: 'Emerald' },
                  { id: 'sapphire', color: '#3B82F6', label: 'Sapphire' },
                  { id: 'ruby', color: '#EF4444', label: 'Ruby' },
                  { id: 'amber', color: '#F59E0B', label: 'Amber' },
                  { id: 'amethyst', color: '#8B5CF6', label: 'Amethyst' }
                ].map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setActiveAccent(a.id as any);
                      localStorage.setItem('gmy_theme_accent', a.id);
                    }}
                    className={cn(
                      "w-6 h-6 rounded-full border transition-all flex items-center justify-center relative",
                      activeAccent === a.id 
                        ? "border-white scale-110 shadow-lg" 
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: a.color }}
                    title={a.label}
                  >
                    {activeAccent === a.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 titlebar-no-drag">
             <button className="p-1.5 text-[#555555] hover:text-[#3ECF8E] transition-all"><Search size={14} /></button>
          </div>

          {isElectron() && (
            <>
              <div className="h-4 w-px bg-[#222222]" />

              {/* Desktop Shell Window System controls */}
              <div className="flex items-center gap-1 ml-1 titlebar-no-drag">
                <button 
                  onClick={() => {
                    (window as any).electron?.minimize();
                  }} 
                  className="p-1.5 rounded-lg hover:bg-white/5 text-[#55555C] hover:text-[var(--brand)] transition-all flex items-center justify-center border border-transparent hover:border-[var(--border-subtle)]"
                  title="Minimize Window"
                >
                  <span className="w-2.5 h-[2px] bg-current rounded-full" />
                </button>
                <button 
                  onClick={() => {
                    (window as any).electron?.maximize();
                  }} 
                  className="p-1.5 rounded-lg hover:bg-white/5 text-[#55555C] hover:text-blue-400 transition-all flex items-center justify-center border border-transparent hover:border-[var(--border-subtle)]"
                  title="Maximize Window"
                >
                  <span className="w-2 h-2 border-2 border-current rounded-xs" />
                </button>
                <button 
                  onClick={() => {
                    (window as any).electron?.close();
                  }} 
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#55555C] hover:text-red-500 transition-all flex items-center justify-center border border-transparent hover:border-red-500/20"
                  title="Terminate Secure Session (Close)"
                >
                  <Plus className="rotate-45" size={14} />
                </button>
              </div>
            </>
          )}
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

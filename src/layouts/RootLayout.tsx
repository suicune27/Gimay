import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useDataSync, useDataSyncSubscription } from '../hooks/useDataSync';
import { Sidebar } from '../features/sidebar/Sidebar';
import { RequestEditor } from '../features/editor/RequestEditor';
import { ScriptLibraryModal } from '../features/scripts/ScriptLibraryModal';
import { ScriptLibrary as ScriptLab } from '../components/ScriptLibrary/ScriptLibrary';
import { PersistenceService } from '../services/PersistenceService';
import { NameModal } from '../components/NameModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { SettingsModal } from '../components/SettingsModal';
import { ToastContainer } from '../components/Toast';
import {
  Terminal, Search, Cloud, ChevronDown, LayoutGrid,
  Plus, Globe, Palette, Pin
} from 'lucide-react';
import { Workspace } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { isElectron } from '../lib/platform';
import { StatusBar } from '../components/StatusBar';
import { DisconnectDialog } from './DisconnectDialog';
import { ConsolePanel } from './ConsolePanel';
import { WorkspaceMenu } from './header/WorkspaceMenu';
import { EnvironmentMenu } from './header/EnvironmentMenu';
import { ThemeMenu } from './header/ThemeMenu';
import { WindowControls } from './header/WindowControls';

export const RootLayout: React.FC = () => {
  const {
    activeWorkspaceId, workspaces, profile, setProfile, setActiveWorkspaceId,
    addTab, consoleCollapsed, setConsoleCollapsed, addToast, environments,
    activeEnvId, setActiveEnvId, syncStatus, settings, updateSettings,
    isSettingsModalOpen, setIsSettingsModalOpen, isSidebarPinned, setIsSidebarPinned,
    isScriptLabOpen, setIsScriptLabOpen, setLandingSkipped, layoutOrientation, setLayoutOrientation
  } = useStore();
  const { fetchWorkspaces, fetchCollections, fetchEnvironments, fetchHistory, fetchTeams } = useDataSync();
  useDataSyncSubscription();

  const [activeAccent, setActiveAccent] = useState<'emerald' | 'sapphire' | 'ruby' | 'amber' | 'amethyst'>(() => {
    return (localStorage.getItem('gmy_theme_accent') as any) || 'emerald';
  });

  useEffect(() => {
    const applyTheme = (base: string, accent: string) => {
      const root = document.documentElement;
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

      const accents: Record<string, { brand: string; brandMuted: string; brandBorder: string }> = {
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

  const handleDeleteWorkspace = (wsId: string, wsName: string) => {
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
      <DisconnectDialog
        isOpen={isDisconnectDialogOpen}
        onClose={() => setIsDisconnectDialogOpen(false)}
        onRefresh={() => {
          setIsDisconnectDialogOpen(false);
          addToast({ type: 'info', message: 'Secured node session cache refreshed.' });
        }}
        profile={profile}
        workspaceName={activeWorkspace?.name}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
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
              <WorkspaceMenu
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspaceId}
                onSelect={(id) => {
                  setActiveWorkspaceId(id);
                  setIsWorkspaceMenuOpen(false);
                }}
                onRename={(ws) => {
                  setWorkspaceToRename(ws);
                  setIsRenameWorkspaceModalOpen(true);
                  setIsWorkspaceMenuOpen(false);
                }}
                onDelete={(id, name) => {
                  setIsWorkspaceMenuOpen(false);
                  handleDeleteWorkspace(id, name);
                }}
                onCreateNew={() => {
                  setIsWorkspaceModalOpen(true);
                  setIsWorkspaceMenuOpen(false);
                }}
              />
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
              <EnvironmentMenu
                environments={environments}
                activeEnvId={activeEnvId}
                onSelect={(id) => {
                  setActiveEnvId(id);
                  setIsEnvironmentMenuOpen(false);
                }}
                envFilterQuery={envFilterQuery}
                onFilterChange={setEnvFilterQuery}
                filteredEnvironments={filteredEnvironments}
              />
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
              "absolute top-full right-0 mt-1 transition-all z-50",
              isThemeMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1 pointer-events-none"
            )}>
              <ThemeMenu
                settings={settings}
                updateSettings={updateSettings}
                activeAccent={activeAccent}
                onAccentChange={(accent) => setActiveAccent(accent as any)}
                profile={profile}
              />
            </div>
          </div>

          <div className="flex items-center gap-1 titlebar-no-drag">
            <button className="p-1.5 text-[#555555] hover:text-[#3ECF8E] transition-all"><Search size={14} /></button>
          </div>

          <div className="h-4 w-px bg-[#222222]" />

          {/* Desktop Shell Window System controls */}
          <WindowControls
            isElectron={isElectron()}
            consoleCollapsed={consoleCollapsed}
            onToggleConsole={() => setConsoleCollapsed(!consoleCollapsed)}
            layoutOrientation={layoutOrientation}
            onToggleOrientation={(orientation) => setLayoutOrientation(orientation as any)}
            onClose={() => {
              if (isElectron()) {
                (window as any).electron?.close();
              } else {
                setIsDisconnectDialogOpen(true);
              }
            }}
          />
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
              <ConsolePanel
                isOpen={!consoleCollapsed}
                onClose={() => setConsoleCollapsed(true)}
                profile={profile}
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <StatusBar />
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, globalSupabase, getSupabaseConfig } from './lib/supabase';
import { AuthUI } from './components/AuthUI';
import { RootLayout } from './layouts/RootLayout';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { useStore } from './store/useStore';
import { useOnboardingStore } from './store/onboardingStore';
import { syncManager } from './services/SyncService';
import { compareDatabaseStructure, ensureDatabaseSchema } from './services/ensureDatabaseSchema';
import { isElectron } from './lib/platform';
import { LandingPage } from './components/LandingPage';
import { ChangelogPage } from './components/ChangelogPage';
import { DocumentationPage } from './components/DocumentationPage';
import { PersistenceService } from './services/PersistenceService';
import { OnboardingService } from './services/OnboardingService';
import { ToastContainer } from './components/Toast';

export default function App() {
  const { setSyncStatus, settings, setProfile, landingSkipped, setLandingSkipped, reset: resetStore, addToast } = useStore();
  const { isConfigured, resetOnboarding, userId, setUserId, setStep, setSetupMode, hasHydrated } = useOnboardingStore();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // If electron, always skip landing
  useEffect(() => {
    if (isElectron() && !landingSkipped) {
      setLandingSkipped(true);
    }
  }, [landingSkipped, setLandingSkipped]);

  // Electron Auto-Update Setup
  useEffect(() => {
    if (!isElectron()) return;

    // Scan for updates 5 seconds after application bootstrap
    const initialCheckTimer = setTimeout(() => {
      console.log('[App Auto-Update] Initial scan triggered');
      (window as any).electron?.checkForUpdates?.();
    }, 5000);

    const cleanupAvailable = (window as any).electron?.onUpdateAvailable?.((info: any) => {
      console.log('[App Auto-Update] Update detected:', info);
      addToast({
        type: 'info',
        message: `A new update (v${info.version}) is available. Downloading...`
      });
    });

    const cleanupDownloaded = (window as any).electron?.onUpdateDownloaded?.((info: any) => {
      console.log('[App Auto-Update] Update completed:', info);
      addToast({
        type: 'success',
        message: `Update v${info.version} downloaded successfully! Restart Gimay to apply changes.`
      });
    });

    const cleanupError = (window as any).electron?.onUpdateError?.((err: string) => {
      console.warn('[App Auto-Update] Scan failure:', err);
      // Suppress dev mock offline environment warning notifications
      if (err !== 'Offline / local server environment') {
        addToast({
          type: 'warning',
          message: `Update verification interrupted: ${err}`
        });
      }
    });

    return () => {
      clearTimeout(initialCheckTimer);
      cleanupAvailable?.();
      cleanupDownloaded?.();
      cleanupError?.();
    };
  }, [addToast]);

  const [showingChangelog, setShowingChangelog] = useState(false);
  const [showingDocs, setShowingDocs] = useState(false);

  // Sync landingSkipped with URL path on web
  useEffect(() => {
    if (isElectron()) return;

    const handleUrlChange = () => {
      const isAppPath = window.location.pathname === '/app';
      const isChangelogPath = window.location.pathname === '/changelog';
      const isDocsPath = window.location.pathname === '/docs';
      if (isAppPath) {
        if (!landingSkipped) {
          setLandingSkipped(true);
        }
      } else if (isChangelogPath) {
        setShowingChangelog(true);
        setShowingDocs(false);
      } else if (isDocsPath) {
        setShowingDocs(true);
        setShowingChangelog(false);
      } else {
        if (landingSkipped) {
          setLandingSkipped(false);
        }
        setShowingChangelog(false);
        setShowingDocs(false);
      }
    };

    // Run on mount
    handleUrlChange();

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [landingSkipped, setLandingSkipped]);    // Check for deep link invite
  useEffect(() => {
    if (hasHydrated && !isConfigured) {
      const params = new URLSearchParams(window.location.search);
      const inviteCode = params.get('invite');
      if (inviteCode) {
        setStep('join-invite');
        setSetupMode('join-invite');
        setLandingSkipped(true); // Auto skip landing on invite
        // Clear param without refreshing to avoid re-run
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [hasHydrated, isConfigured, setStep, setSetupMode]);

  // Navigate to changelog
  const goToChangelog = useCallback(() => {
    if (!isElectron()) {
      window.history.pushState(null, '', '/changelog');
    }
    setLandingSkipped(true);
    setShowingChangelog(true);
    setShowingDocs(false);
  }, [setLandingSkipped]);

  // Go back from changelog
  const goBackFromChangelog = useCallback(() => {
    if (!isElectron()) {
      window.history.pushState(null, '', '/');
    }
    setShowingChangelog(false);
    setLandingSkipped(false);
  }, [setLandingSkipped]);

  // Navigate to docs
  const goToDocs = useCallback(() => {
    if (!isElectron()) {
      window.history.pushState(null, '', '/docs');
    }
    setLandingSkipped(true);
    setShowingDocs(true);
    setShowingChangelog(false);
  }, [setLandingSkipped]);

  // Go back from docs
  const goBackFromDocs = useCallback(() => {
    if (!isElectron()) {
      window.history.pushState(null, '', '/');
    }
    setShowingDocs(false);
    setLandingSkipped(false);
  }, [setLandingSkipped]);
  const [schemaBootstrapLoading, setSchemaBootstrapLoading] = useState(false);
  const [schemaBootstrapMessage, setSchemaBootstrapMessage] = useState('Checking database structure...');
  const [schemaBootstrapError, setSchemaBootstrapError] = useState<string | null>(null);
  const schemaCheckedUserRef = useRef<string | null>(null);

  const SANDBOX_BACKUP_KEY = 'gimay-sandbox-backup';

  function saveSandboxBackup() {
    const state = useStore.getState();
    try {
      const backup = {
        collections: state.collections,
        workspaces: state.workspaces,
        environments: state.environments,
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
        activeWorkspaceId: state.activeWorkspaceId,
        activeEnvId: state.activeEnvId,
        savedAt: Date.now()
      };
      localStorage.setItem(SANDBOX_BACKUP_KEY, JSON.stringify(backup));
      console.log('[Sandbox] Collections/requests saved to localStorage backup.');
    } catch (e) {
      console.warn('[Sandbox] Failed to save backup:', e);
    }
  }

  const SANDBOX_PERSIST_KEY = 'gimay-sandbox-persist';

  function restoreSandboxBackup() {
    try {
      // Try continuous auto-persist key first (saved in real-time by RootLayout), then backup key
      let raw = localStorage.getItem(SANDBOX_PERSIST_KEY);
      let source = 'continuous-persist';
      if (!raw) {
        raw = localStorage.getItem(SANDBOX_BACKUP_KEY);
        source = 'backup';
      }
      if (!raw) return;
      const backup = JSON.parse(raw);

      // Clear both keys after restoring
      try { localStorage.removeItem(SANDBOX_PERSIST_KEY); } catch {}
      try { localStorage.removeItem(SANDBOX_BACKUP_KEY); } catch {}

      // Restore all data atomically via useStore.setState to avoid
      // side effects from individual setter functions (e.g. setActiveWorkspaceId clears collections)
      const patch: Record<string, any> = {};
      if (backup.workspaces && Array.isArray(backup.workspaces)) patch.workspaces = backup.workspaces;
      if (backup.collections && Array.isArray(backup.collections)) patch.collections = backup.collections;
      if (backup.environments && Array.isArray(backup.environments)) patch.environments = backup.environments;
      if (backup.activeWorkspaceId) patch.activeWorkspaceId = backup.activeWorkspaceId;
      if (backup.activeEnvId != null) patch.activeEnvId = backup.activeEnvId;
      if (backup.openTabs && Array.isArray(backup.openTabs)) {
        patch.openTabs = backup.openTabs;
        patch.activeTabId = backup.activeTabId || backup.openTabs[backup.openTabs.length - 1]?.id || null;
      } else {
        patch.activeTabId = null;
      }

      if (Object.keys(patch).length > 0) {
        useStore.setState(patch);
      }

      console.log(`[Sandbox] Collections/requests restored from localStorage (${source}).`);
    } catch (e) {
      console.warn('[Sandbox] Failed to restore backup:', e);
      try { localStorage.removeItem(SANDBOX_PERSIST_KEY); } catch {}
      try { localStorage.removeItem(SANDBOX_BACKUP_KEY); } catch {}
    }
  }

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else {
        setProfile(profile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  // Listen for sandbox exit event (dispatched from StatusBar)
  // Saves sandbox data to localStorage backup, then shows AuthUI
  useEffect(() => {
    const handler = () => {
      saveSandboxBackup();
      setSession(null);
      const store = useStore.getState();
      store.updateSyncMetadata({ isOffline: false });
    };
    window.addEventListener('gimay:exit-sandbox', handler);
    return () => window.removeEventListener('gimay:exit-sandbox', handler);
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    // Light mode temporarily disabled — always force dark
    root.classList.remove('light');
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');

    // Clear any leftover inline brand styles
    root.style.removeProperty('--brand');
    root.style.removeProperty('--brand-muted');
    root.style.removeProperty('--brand-border');
  }, []); // light mode disabled — deps intentionally empty

  // Auto-recovery: If local storage has valid configuration but the store is not marked configured, auto-align it.
  useEffect(() => {
    if (hasHydrated) {
      const hasConfig = OnboardingService.hasExistingConfiguration();
      if (hasConfig && !isConfigured) {
        console.log('[Onboarding] Found existing configuration in local storage, auto-configuring store.');
        useOnboardingStore.getState().setIsConfigured(true);
      }
    }
  }, [hasHydrated, isConfigured]);

  useEffect(() => {
    if (!hasHydrated) return;

    const unsubscribeSync = syncManager.onStatusChange((status) => {
      setSyncStatus(status);
    });

    const handleAuthChange = async (event: string, session: any) => {
      setSession(session);
      
      if (session?.user?.id) {
        fetchProfile(session.user.id);
        
        const store = useOnboardingStore.getState();
        let currentIsConfigured = store.isConfigured;
        let currentStep = store.step;
        const currentUserId = store.userId;

        // ⛔ Reset onboarding if signing in from sandbox/offline mode
        // Sandbox mode previously persisted isConfigured=true, userId='offline-user-id'
        // which blocks the team selection flow for real cloud users.
        if (currentUserId === 'offline-user-id' && session.user.id !== 'offline-user-id') {
          console.log('[App] Signed in from sandbox mode. Resetting onboarding for team selection.');
          resetOnboarding();
          resetStore();
          currentIsConfigured = false;
          currentStep = 'welcome';
        }

        // Check for teams if REALLY not configured and at welcome screen
        if (!currentIsConfigured && currentStep === 'welcome') {
          PersistenceService.fetchUserTeams(session.user.id).then(teams => {
            const latestStore = useOnboardingStore.getState();
            if (!latestStore.isConfigured && latestStore.step === 'welcome') {
              if (teams && teams.length > 0) {
                setStep('team-select');
              }
            }
          }).catch(err => console.error('Team check failed:', err));
        }

        // Only reset onboarding if we DEFINITELY have a user ID mismatch, not currently configuring, and neither is the offline fallback user
        if (
          currentUserId && 
          currentUserId !== session.user.id && 
          !currentIsConfigured && 
          currentUserId !== 'offline-user-id' && 
          session.user.id !== 'offline-user-id'
        ) {
          console.warn('[AUTH] User mismatch detected, resetting fallback state');
          resetOnboarding();
          resetStore();
        }

        // If the session changed but we didn't have a userId, or it's a new session, sync it
        if (!currentUserId || (event === 'SIGNED_IN')) {
          setUserId(session.user.id);
        }
      } else {
        // If session is lost completely
        if (event === 'SIGNED_OUT') {
          resetStore();
          resetOnboarding();
          setUserId(null);
        }
      }
      setLoading(false);
    };

    // Electron: try Supabase auth first (user can choose sandbox via AuthUI)
    // Initial check
    // Auth always uses globalSupabase (global project) so credentials are validated against the right project,
    // while data operations use `supabase` which now preferentially points to the user's tenant project.
    globalSupabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthChange('INITIAL_SESSION', session);
    }).catch((err) => {
      // If Supabase is unreachable (e.g. offline Electron), fall back to sandbox
      console.warn('[App] Auth check failed, falling back to sandbox mode:', err);
      handleOfflineMode();
      setLoading(false);
    });

    const { data: { subscription } } = globalSupabase.auth.onAuthStateChange((event, session) => {
      handleAuthChange(event, session);
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeSync();
    };
  }, [hasHydrated, setSyncStatus, setProfile, resetOnboarding, setUserId, resetStore, setStep]);

  function handleOfflineMode() {
    const offlineSession = {
      user: {
        id: 'offline-user-id',
        email: 'offline-operator@putmen.io',
        user_metadata: {
          full_name: 'Offline Operator',
          username: 'offline'
        }
      }
    };
    
    // Restore sandbox data from localStorage backup (if any)
    restoreSandboxBackup();

    // Force onboarding configuration to true for offline sandbox
    setUserId('offline-user-id');
    setStep('complete');
    useOnboardingStore.getState().setIsConfigured(true);

    const mainStore = useStore.getState();
    mainStore.setProfile({
      id: 'offline-user-id',
      email: 'offline-operator@putmen.io',
      full_name: 'Offline Operator',
      username: 'offline',
      avatar_url: undefined,
      preferences: { theme: 'dark', sidebar_width: 300 }
    });

    mainStore.updateSyncMetadata({ isOffline: true });
    mainStore.setSyncStatus('offline');

    setSession(offlineSession);
  }

  const runSchemaBootstrap = useCallback(async () => {
    if (!session?.user?.id || !isConfigured) {
      return;
    }

    if (schemaCheckedUserRef.current === session.user.id) {
      return;
    }

    const { settings } = useStore.getState();
    if (!settings.general.checkDatabaseIntegrity) {
      console.log('[Schema Bootstrap] Database integrity check on load is disabled in settings. Skipping.');
      schemaCheckedUserRef.current = session.user.id;
      return;
    }

    const config = getSupabaseConfig();
    if (!config.url || !config.anonKey) {
      return;
    }

    setSchemaBootstrapError(null);
    setSchemaBootstrapMessage('Checking database structure...');
    setSchemaBootstrapLoading(true);

    // If we are offline, bypass completely (Desktop only)
    const isAppOffline = useStore.getState().syncMetadata.isOffline || (typeof navigator !== 'undefined' && !navigator.onLine);
    if (isElectron() && isAppOffline) {
      console.warn('[Schema Bootstrap] Client is offline. Bypassing database schema bootstrap to support offline mode.');
      schemaCheckedUserRef.current = session.user.id;
      setSchemaBootstrapLoading(false);
      return;
    }

    const compare = await compareDatabaseStructure(config.url, config.anonKey);

    if (!compare.success) {
      const errStr = String(compare.error || '').toLowerCase();
      const isConnectionIssue = errStr.includes('fetch') || errStr.includes('network') || errStr.includes('timeout') || errStr.includes('failed to connect');
      
      if (isElectron() && isConnectionIssue) {
        console.warn('[Schema Bootstrap] Database is unreachable. Bypassing to support offline mode:', compare.error);
        schemaCheckedUserRef.current = session.user.id;
        setSchemaBootstrapLoading(false);
        return;
      }

      setSchemaBootstrapLoading(false);
      setSchemaBootstrapError(compare.error || 'Failed to compare database structure.');
      return;
    }

    // Bypass script updates if table structure is already up-to-date
    if (compare.upToDate) {
      console.log('[Schema Bootstrap] Database structure is up-to-date. Skipping statement-by-statement integrity execution on startup.');
      schemaCheckedUserRef.current = session.user.id;
      setSchemaBootstrapLoading(false);
      return;
    }

    setSchemaBootstrapMessage(`Ensuring database integrity...`);

    const update = await ensureDatabaseSchema(config.url, config.anonKey, (label) => {
      setSchemaBootstrapMessage(label);
    });

    if (!update.success) {
      setSchemaBootstrapLoading(false);
      setSchemaBootstrapError(update.error || 'Failed to auto-update database structure.');
      return;
    }

    schemaCheckedUserRef.current = session.user.id;
    setSchemaBootstrapLoading(false);
  }, [session?.user?.id, isConfigured]);

  useEffect(() => {
    if (session?.user?.id && landingSkipped) {
      runSchemaBootstrap();
    } else {
      schemaCheckedUserRef.current = null;
      setSchemaBootstrapError(null);
      setSchemaBootstrapLoading(false);
    }
  }, [session?.user?.id, landingSkipped, runSchemaBootstrap]);

  if (loading || schemaBootstrapLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-deep text-white select-none relative overflow-hidden font-sans">
        {/* Style block for advanced custom CSS animations (shimmer, dash offset, orb rotation) */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes border-shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes pulse-ring {
            0% { transform: scale(0.95); opacity: 0.2; }
            50% { transform: scale(1.05); opacity: 0.6; }
            100% { transform: scale(0.95); opacity: 0.2; }
          }
          @keyframes orbit {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .animate-border-shimmer {
            animation: border-shimmer 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          .animate-pulse-ring {
            animation: pulse-ring 3s ease-in-out infinite;
          }
          .animate-orbit {
            animation: orbit 8s linear infinite;
          }
        `}} />

        {/* Ambient background glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[var(--brand)]/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] bg-blue-500/5 rounded-full blur-[60px] pointer-events-none" />

        {/* Technical grid lines in the background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <div className="relative flex flex-col items-center justify-center space-y-8 z-10">
          {/* Futuristic Circular Loading Unit */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Outer dotted tech ring (rotates slowly) */}
            <svg className="absolute w-full h-full animate-[spin_24s_linear_infinite]" viewBox="0 0 100 100">
              <circle 
                cx="50" 
                cy="50" 
                r="46" 
                stroke="var(--brand)" 
                strokeWidth="1" 
                strokeDasharray="2, 6" 
                fill="none" 
                className="opacity-40"
              />
            </svg>

            {/* Middle segmented technical ring (rotates counter-clockwise) */}
            <svg className="absolute w-[90%] h-[90%] animate-[spin_10s_linear_infinite_reverse]" viewBox="0 0 100 100">
              <circle 
                cx="50" 
                cy="50" 
                r="44" 
                stroke="var(--brand)" 
                strokeWidth="1.5" 
                strokeDasharray="25, 40, 10, 15" 
                fill="none" 
                className="opacity-60"
              />
            </svg>

            {/* Inner glowing pulse ring */}
            <div className="absolute w-[76%] h-[76%] border border-blue-500/30 rounded-full animate-pulse-ring" />

            {/* Small technical orbits */}
            <div className="absolute w-full h-full animate-orbit">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--brand)] shadow-[0_0_8px_var(--brand)]" />
            </div>

            {/* Central Gimay glowing terminal brand-mark */}
            <div className="relative w-14 h-14 rounded-xl bg-black border border-white/10 flex items-center justify-center shadow-[0_0_25px_rgba(var(--brand-rgb),0.15)] overflow-hidden">
              {/* Internal abstract pattern */}
              <div className="absolute inset-0 bg-gradient-to-tr from-[var(--brand)]/5 via-transparent to-blue-500/5" />
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="var(--brand)" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="drop-shadow-[0_0_8px_rgba(var(--brand-rgb),0.6)]"
              >
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" className="animate-pulse" />
              </svg>
            </div>
          </div>

          {/* Dynamic Technical Status Indicators */}
          <div className="flex flex-col items-center space-y-4 max-w-xs w-full">
            {/* Minimal glowing progress line */}
            <div className="w-48 h-[2px] bg-white/[0.04] rounded-full overflow-hidden relative border border-white/[0.02]">
              <div className="absolute top-0 bottom-0 left-0 w-full bg-gradient-to-r from-transparent via-[var(--brand)] to-transparent animate-border-shimmer" />
            </div>

            {/* Status title with dynamic system messages */}
            <div className="flex flex-col items-center space-y-1">
              <span className="text-[10px] font-black text-white uppercase tracking-[0.25em] font-display">
                Gimay Command Node
              </span>
              <p className="text-[8px] font-bold text-[var(--brand)] uppercase tracking-[0.2em] font-mono text-center opacity-90 min-h-[12px] animate-pulse">
                {loading ? 'INITIALIZING SUBSYSTEMS...' : schemaBootstrapMessage.toUpperCase()}
              </p>
            </div>

            {/* Interactive tactical diagnostics hud */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pt-4 border-t border-white/[0.05] w-full text-[7px] font-bold font-mono text-dim">
              <div className="flex items-center justify-between">
                <span>SYS.CORE</span>
                <span className="text-[var(--brand)]/80 animate-pulse">● READY</span>
              </div>
              <div className="flex items-center justify-between">
                <span>NET.CONN</span>
                <span className={typeof navigator !== 'undefined' && !navigator.onLine ? "text-amber-500" : "text-[var(--brand)]/80 animate-pulse"}>
                  {typeof navigator !== 'undefined' && !navigator.onLine ? "▲ OFFLINE" : "● ONLINE"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>DB.SCHEMA</span>
                <span className={schemaBootstrapLoading ? "text-blue-400 animate-pulse" : "text-[var(--brand)]/80"}>
                  {schemaBootstrapLoading ? "◌ SYNCING" : "● VERIFIED"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>ENV.SECURE</span>
                <span className="text-[var(--brand)]/80">● ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (schemaBootstrapError && session && isConfigured) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--bg-deep)] px-6">
        <p className="text-xs font-black text-red-400 uppercase tracking-widest">Schema Check Failed</p>
        <p className="mt-3 text-sm text-[var(--text-muted)] max-w-xl text-center">{schemaBootstrapError}</p>
        <button
          onClick={runSchemaBootstrap}
          className="mt-6 px-4 py-2 rounded-lg bg-[var(--brand)] text-black text-xs font-bold uppercase tracking-wider"
        >
          Retry Auto Update
        </button>
      </div>
    );
  }

  // Show docs page
  if (showingDocs) {
    return <DocumentationPage onBack={goBackFromDocs} />;
  }

  // Show changelog page
  if (showingChangelog) {
    return <ChangelogPage onBack={goBackFromChangelog} />;
  }

  if (!landingSkipped) {
    return (
      <LandingPage 
        onStart={() => {
          if (!isElectron()) {
            window.history.pushState(null, '', '/app');
          }
          setLandingSkipped(true);
        }}
        onChangelog={goToChangelog}
        onDocs={goToDocs}
      />
    );
  }

  return (
    <>
      <ToastContainer />
      {!session && <AuthUI onOfflineMode={handleOfflineMode} />}
      {session && !isConfigured && <OnboardingModal />}
      {session && isConfigured && <RootLayout />}
    </>
  );
}

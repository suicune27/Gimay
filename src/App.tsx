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

  // Sync landingSkipped with URL path on web
  useEffect(() => {
    if (isElectron()) return;

    const handleUrlChange = () => {
      const isAppPath = window.location.pathname === '/app';
      if (isAppPath) {
        if (!landingSkipped) {
          setLandingSkipped(true);
        }
      } else {
        if (landingSkipped) {
          setLandingSkipped(false);
        }
      }
    };

    // Run on mount
    handleUrlChange();

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [landingSkipped, setLandingSkipped]);

  // Check for deep link invite
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
  const [schemaBootstrapLoading, setSchemaBootstrapLoading] = useState(false);
  const [schemaBootstrapMessage, setSchemaBootstrapMessage] = useState('Checking database structure...');
  const [schemaBootstrapError, setSchemaBootstrapError] = useState<string | null>(null);
  const schemaCheckedUserRef = useRef<string | null>(null);

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

  useEffect(() => {
    const updateTheme = () => {
      const isDark =
        settings.appearance.theme === 'dark' ||
        (settings.appearance.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.classList.toggle('light', !isDark);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      document.documentElement.style.setProperty('--brand', settings.appearance.accentColor);
      document.documentElement.style.setProperty('--brand-muted', `${settings.appearance.accentColor}1A`);
      document.documentElement.style.setProperty('--brand-border', `${settings.appearance.accentColor}33`);
    };

    updateTheme();

    if (settings.appearance.theme !== 'system') {
      return;
    }

    const matcher = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => updateTheme();
    matcher.addEventListener('change', listener);

    return () => matcher.removeEventListener('change', listener);
  }, [settings.appearance.theme, settings.appearance.accentColor]);

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
        const currentIsConfigured = store.isConfigured;
        const currentStep = store.step;
        const currentUserId = store.userId;

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

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthChange('INITIAL_SESSION', session);
      if (isElectron() && !session) {
        console.log('[App] Desktop environment without session detected. Auto-launching offline sandbox.');
        setTimeout(() => {
          handleOfflineMode();
        }, 150);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      handleAuthChange(event, session);
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeSync();
    };
  }, [hasHydrated, setSyncStatus, setProfile, resetOnboarding, setUserId, resetStore, setStep]);

  const handleOfflineMode = () => {
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
  };

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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#050505] text-white select-none relative overflow-hidden font-sans">
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
            <div className="relative w-14 h-14 rounded-xl bg-black border border-white/10 flex items-center justify-center shadow-[0_0_25px_rgba(62,207,142,0.15)] overflow-hidden">
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
                className="drop-shadow-[0_0_8px_rgba(62,207,142,0.6)]"
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
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pt-4 border-t border-white/[0.05] w-full text-[7px] font-bold font-mono text-[#555555]">
              <div className="flex items-center justify-between">
                <span>SYS.CORE</span>
                <span className="text-[#3ECF8E]/80 animate-pulse">● READY</span>
              </div>
              <div className="flex items-center justify-between">
                <span>NET.CONN</span>
                <span className={typeof navigator !== 'undefined' && !navigator.onLine ? "text-amber-500" : "text-[#3ECF8E]/80 animate-pulse"}>
                  {typeof navigator !== 'undefined' && !navigator.onLine ? "▲ OFFLINE" : "● ONLINE"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>DB.SCHEMA</span>
                <span className={schemaBootstrapLoading ? "text-blue-400 animate-pulse" : "text-[#3ECF8E]/80"}>
                  {schemaBootstrapLoading ? "◌ SYNCING" : "● VERIFIED"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>ENV.SECURE</span>
                <span className="text-[#3ECF8E]/80">● ACTIVE</span>
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

  if (!landingSkipped) {
    return (
      <LandingPage 
        onStart={() => {
          if (!isElectron()) {
            window.history.pushState(null, '', '/app');
          }
          setLandingSkipped(true);
        }} 
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

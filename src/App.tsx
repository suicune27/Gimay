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
import { ToastContainer } from './components/Toast';

export default function App() {
  const { setSyncStatus, settings, setProfile, landingSkipped, setLandingSkipped, reset: resetStore } = useStore();
  const { isConfigured, resetOnboarding, userId, setUserId, setStep, setSetupMode } = useOnboardingStore();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // If electron, always skip landing
  useEffect(() => {
    if (isElectron() && !landingSkipped) {
      setLandingSkipped(true);
    }
  }, [landingSkipped, setLandingSkipped]);

  // Check for deep link invite
  useEffect(() => {
    if (!isConfigured) {
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
  }, [isConfigured, setStep, setSetupMode]);
  const [schemaBootstrapLoading, setSchemaBootstrapLoading] = useState(false);
  const [schemaBootstrapMessage, setSchemaBootstrapMessage] = useState('Checking database structure...');
  const [schemaBootstrapError, setSchemaBootstrapError] = useState<string | null>(null);
  const schemaCheckedUserRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await globalSupabase
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

  useEffect(() => {
    const unsubscribeSync = syncManager.onStatusChange((status) => {
      setSyncStatus(status);
    });

    globalSupabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        fetchProfile(session.user.id);
        
        // Check for teams if not configured
        if (!isConfigured) {
          PersistenceService.fetchUserTeams(session.user.id).then(teams => {
            if (teams && teams.length > 0) {
              setStep('team-select');
            } else {
              setStep('welcome');
            }
          }).catch(err => {
            console.error('Initial team check failed:', err);
            setStep('welcome');
          });
        }

        // If userId in store is different, reset onboarding
        if (userId !== session.user.id) {
          resetOnboarding();
          resetStore();
          setUserId(session.user.id);
        }
      } else {
        resetStore();
        resetOnboarding();
        setUserId(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = globalSupabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        fetchProfile(session.user.id);

        // Check for teams if not configured
        if (!isConfigured) {
          PersistenceService.fetchUserTeams(session.user.id).then(teams => {
            if (teams && teams.length > 0) {
              setStep('team-select');
            } else {
              setStep('welcome');
            }
          }).catch(err => {
            console.error('Auth change team check failed:', err);
            setStep('welcome');
          });
        }

        if (userId !== session.user.id) {
          resetOnboarding();
          resetStore();
          setUserId(session.user.id);
        }
      } else {
        resetStore();
        resetOnboarding();
        setUserId(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeSync();
    };
  }, [setSyncStatus, setProfile, userId, resetOnboarding, setUserId]);

  const runSchemaBootstrap = useCallback(async () => {
    if (!session?.user?.id || !isConfigured) {
      return;
    }

    if (schemaCheckedUserRef.current === session.user.id) {
      return;
    }

    const config = getSupabaseConfig();
    if (!config.url || !config.anonKey) {
      return;
    }

    setSchemaBootstrapError(null);
    setSchemaBootstrapMessage('Checking database structure...');
    setSchemaBootstrapLoading(true);

    const compare = await compareDatabaseStructure(config.url, config.anonKey);

    if (!compare.success) {
      setSchemaBootstrapLoading(false);
      setSchemaBootstrapError(compare.error || 'Failed to compare database structure.');
      return;
    }

    if (!compare.upToDate) {
      setSchemaBootstrapMessage(`Structure out of date (${compare.missingTables.length} missing tables). Auto-updating...`);

      const update = await ensureDatabaseSchema(config.url, config.anonKey, (label) => {
        setSchemaBootstrapMessage(label);
      });

      if (!update.success) {
        setSchemaBootstrapLoading(false);
        setSchemaBootstrapError(update.error || 'Failed to auto-update database structure.');
        return;
      }
    }

    schemaCheckedUserRef.current = session.user.id;
    setSchemaBootstrapLoading(false);
  }, [session?.user?.id, isConfigured]);

  useEffect(() => {
    if (session?.user?.id) {
      runSchemaBootstrap();
    } else {
      schemaCheckedUserRef.current = null;
      setSchemaBootstrapError(null);
      setSchemaBootstrapLoading(false);
    }
  }, [session?.user?.id, runSchemaBootstrap]);

  if (loading || schemaBootstrapLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[var(--bg-deep)]">
        <div className="w-16 h-16 border-2 border-[var(--brand)]/20 border-t-[var(--brand)] rounded-full animate-spin shadow-[0_0_20px_var(--brand-muted)]" />
        <p className="mt-4 text-[10px] font-black text-[var(--brand)] uppercase tracking-widest animate-pulse">
          {loading ? 'Initializing System...' : schemaBootstrapMessage}
        </p>
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
          setLandingSkipped(true);
        }} 
      />
    );
  }

  return (
    <>
      <ToastContainer />
      {!session && <AuthUI />}
      {session && !isConfigured && <OnboardingModal />}
      {session && isConfigured && <RootLayout />}
    </>
  );
}

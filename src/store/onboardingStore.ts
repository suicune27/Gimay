import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OnboardingStep = 'idle' | 'welcome' | 'option-select' | 'create-setup' | 'join-team' | 'join-invite' | 'team-select' | 'complete';
export type SetupMode = 'create' | 'join' | 'join-invite' | 'select' | null;

interface OnboardingState {
  // State
  step: OnboardingStep;
  setupMode: SetupMode;
  isConfigured: boolean;
  isInitializing: boolean;
  error: string | null;
  
  // Credentials
  supabaseUrl: string;
  supabaseAnonKey: string;
  teamCode: string;
  teamSecretCode: string;
  
  // Metadata
  workspaceId: string | null;
  teamId: string | null;
  userId: string | null;
  hasHydrated: boolean;

  // Actions
  setStep: (step: OnboardingStep) => void;
  setSetupMode: (mode: SetupMode) => void;
  setIsConfigured: (configured: boolean) => void;
  setIsInitializing: (initializing: boolean) => void;
  setError: (error: string | null) => void;
  setSupabaseCredentials: (url: string, key: string) => void;
  setTeamCode: (code: string) => void;
  setTeamSecretCode: (code: string) => void;
  setWorkspaceId: (id: string) => void;
  setTeamId: (id: string) => void;
  setUserId: (id: string | null) => void;
  setHasHydrated: (hydrated: boolean) => void;
  resetOnboarding: () => void;
}

const initialState = {
  step: 'welcome' as OnboardingStep,
  setupMode: null as SetupMode,
  isConfigured: false,
  isInitializing: false,
  error: null as string | null,
  supabaseUrl: '',
  supabaseAnonKey: '',
  teamCode: '',
  teamSecretCode: '',
  workspaceId: null as string | null,
  teamId: null as string | null,
  userId: null as string | null,
  hasHydrated: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,

      setStep: (step) => set({ step }),
      setSetupMode: (mode) => set({ setupMode: mode }),
      setIsConfigured: (configured) => set({ isConfigured: configured }),
      setIsInitializing: (initializing) => set({ isInitializing: initializing }),
      setError: (error) => set({ error }),
      setSupabaseCredentials: (url, key) => set({ supabaseUrl: url, supabaseAnonKey: key }),
      setTeamCode: (code) => set({ teamCode: code }),
      setTeamSecretCode: (code) => set({ teamSecretCode: code }),
      setWorkspaceId: (id) => set({ workspaceId: id }),
      setTeamId: (id) => set({ teamId: id }),
      setUserId: (id) => set({ userId: id }),
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
      resetOnboarding: () => {
        console.log('[OnboardingStore] resetOnboarding called');
        set({ ...initialState, step: 'welcome', hasHydrated: true });
      },
    }),
    {
      name: 'gimay-onboarding-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        step: state.step,
        setupMode: state.setupMode,
        isConfigured: state.isConfigured,
        workspaceId: state.workspaceId,
        teamId: state.teamId,
        userId: state.userId,
      }),
    }
  )
);

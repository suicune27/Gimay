import { StateCreator } from 'zustand';
import { AppState } from '../types';
import { Toast, KeyValue, ResponseData, ScriptCategory, ScriptTemplate } from '../../types';
import { PersistenceService } from '../../services/PersistenceService';

export interface UISlice {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  activeEnvId: string | null;
  setActiveEnvId: (id: string | null) => void;
  globalVariables: KeyValue[];
  setGlobalVariables: (variables: KeyValue[]) => void;
  scriptCategories: ScriptCategory[];
  setScriptCategories: (categories: ScriptCategory[]) => void;
  scriptLibrary: ScriptTemplate[];
  setScriptLibrary: (scripts: ScriptTemplate[]) => void;
  scriptFavorites: string[];
  setScriptFavorites: (favorites: string[]) => void;
  isScriptLibraryOpen: boolean;
  setIsScriptLibraryOpen: (isOpen: boolean) => void;
  isScriptLabOpen: boolean;
  setIsScriptLabOpen: (isOpen: boolean) => void;
  lastResponse: ResponseData | null;
  setLastResponse: (response: ResponseData | null) => void;
  isSending: boolean;
  setIsSending: (sending: boolean) => void;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  sidebarMode: 'expanded' | 'compact' | 'hidden';
  setSidebarMode: (mode: 'expanded' | 'compact' | 'hidden') => void;
  isSidebarPinned: boolean;
  setIsSidebarPinned: (pinned: boolean) => void;
  layoutOrientation: 'vertical' | 'horizontal';
  setLayoutOrientation: (orientation: 'vertical' | 'horizontal') => void;
  consoleCollapsed: boolean;
  setConsoleCollapsed: (collapsed: boolean) => void;
  landingSkipped: boolean;
  setLandingSkipped: (skipped: boolean) => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set, get) => ({
  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  toasts: [],
  addToast: (toast) => set((state) => ({
    toasts: [...state.toasts, { ...toast, id: Math.random().toString(36).substr(2, 9) }]
  })),
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id)
  })),

  activeEnvId: null,
  setActiveEnvId: (id) => set({ activeEnvId: id }),

  globalVariables: [],
  setGlobalVariables: (globalVariables) => {
    set({ globalVariables });
    const profile = get().profile;
    if (profile?.id) {
      PersistenceService.saveGlobalVariables(profile.id, globalVariables);
    }
  },

  scriptCategories: [],
  setScriptCategories: (scriptCategories) => set({ scriptCategories }),
  scriptLibrary: [],
  setScriptLibrary: (scriptLibrary) => set({ scriptLibrary }),
  scriptFavorites: [],
  setScriptFavorites: (scriptFavorites) => set({ scriptFavorites }),
  isScriptLibraryOpen: false,
  setIsScriptLibraryOpen: (isScriptLibraryOpen) => set({ isScriptLibraryOpen }),
  isScriptLabOpen: false,
  setIsScriptLabOpen: (isScriptLabOpen) => set({ isScriptLabOpen }),

  lastResponse: null,
  setLastResponse: (lastResponse) => set({ lastResponse }),
  isSending: false,
  setIsSending: (isSending) => set({ isSending }),

  isSettingsModalOpen: false,
  setIsSettingsModalOpen: (isOpen) => set({ isSettingsModalOpen: isOpen }),

  sidebarWidth: 300,
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  sidebarCollapsed: true,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  sidebarMode: 'compact',
  setSidebarMode: (mode) => set({ sidebarMode: mode, sidebarCollapsed: mode !== 'expanded' }),
  isSidebarPinned: true,
  setIsSidebarPinned: (pinned) => set({ isSidebarPinned: pinned }),
  layoutOrientation: 'vertical',
  setLayoutOrientation: (orientation) => set({ layoutOrientation: orientation }),
  consoleCollapsed: true,
  setConsoleCollapsed: (consoleCollapsed) => set({ consoleCollapsed }),

  landingSkipped: false,
  setLandingSkipped: (landingSkipped) => set({ landingSkipped }),
});

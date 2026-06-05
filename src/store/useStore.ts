import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PersistenceService } from '../services/PersistenceService';
import { AppState } from './types';
import { createProfileSlice } from './slices/profileSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createWorkspaceSlice } from './slices/workspaceSlice';
import { createTabsSlice } from './slices/tabsSlice';
import { createDataSlice } from './slices/dataSlice';
import { createUISlice } from './slices/uiSlice';
import { persistStorage } from './storage';
import { performStorageCleanup } from './storageCleanup';

// Self-healing recovery for origin-wide local storage exhaustion
performStorageCleanup();

export const useStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createProfileSlice(...a),
      ...createSettingsSlice(...a),
      ...createWorkspaceSlice(...a),
      ...createTabsSlice(...a),
      ...createDataSlice(...a),
      ...createUISlice(...a),
    }),
    {
      name: 'omni-node-storage',
      storage: persistStorage,
      partialize: (state) => ({
        openTabs: (state.openTabs || []).map(tab => {
          if (tab && 'response' in tab) {
            return {
              ...tab,
              response: null
            } as any;
          }
          return tab;
        }),
        activeTabId: state.activeTabId,
        activeWorkspaceId: state.activeWorkspaceId,
        activeEnvId: state.activeEnvId,
        theme: state.theme,
        sidebarWidth: state.sidebarWidth,
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarMode: state.sidebarMode,
        isSidebarPinned: state.isSidebarPinned,
        layoutOrientation: state.layoutOrientation,
        consoleCollapsed: state.consoleCollapsed,
        landingSkipped: state.landingSkipped,
        settings: state.settings
      }),
    }
  )
);

PersistenceService.registerStore(useStore);

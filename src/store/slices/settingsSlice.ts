import { StateCreator } from 'zustand';
import { AppState } from '../types';
import { AppSettings, SyncMetadata } from '../../types';
import { DEFAULT_SETTINGS, DEFAULT_SYNC_METADATA } from '../defaults';
import { ProxyService } from '../../services/ProxyService';

export interface SettingsSlice {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  syncMetadata: SyncMetadata;
  updateSyncMetadata: (metadata: Partial<SyncMetadata>) => void;
  syncStatus: 'idle' | 'saving' | 'saved' | 'error' | 'pending' | 'offline';
  setSyncStatus: (status: 'idle' | 'saving' | 'saved' | 'error' | 'pending' | 'offline') => void;
  pendingSyncIds: Set<string>;
  setPendingSyncIds: (ids: Set<string>) => void;
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set) => ({
  settings: DEFAULT_SETTINGS,
  updateSettings: (newSettings) => set((state) => {
    const merged = { ...state.settings, ...newSettings };
    if (newSettings.proxy) {
      ProxyService.syncSettings(merged.proxy);
    }
    return { settings: merged };
  }),
  resetSettings: () => set((state) => {
    ProxyService.syncSettings(DEFAULT_SETTINGS.proxy);
    return { settings: DEFAULT_SETTINGS };
  }),

  syncMetadata: DEFAULT_SYNC_METADATA,
  updateSyncMetadata: (newMetadata) => set((state) => ({
    syncMetadata: { ...state.syncMetadata, ...newMetadata }
  })),

  syncStatus: 'idle',
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  pendingSyncIds: new Set(),
  setPendingSyncIds: (pendingSyncIds) => set({ pendingSyncIds }),
});

import { StateCreator } from 'zustand';
import { AppState } from '../types';
import { RequestData, Collection, Environment, Workspace, EnvironmentTab, SmokeTestingTab } from '../../types';
import { syncManager } from '../../services/SyncService';

export interface TabsSlice {
  openTabs: (RequestData | Collection | EnvironmentTab | SmokeTestingTab)[];
  activeTabId: string | null;
  addTab: (item: RequestData | Collection | EnvironmentTab | SmokeTestingTab) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToTheRight: (id: string) => void;
  closeTabsToTheLeft: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  updateTab: (id: string, data: Partial<RequestData | Collection | EnvironmentTab | SmokeTestingTab>) => void;
  updateRequest: (id: string, data: Partial<RequestData>) => void;
  updateCollection: (id: string, data: Partial<Collection>) => void;
  updateEnvironment: (id: string, data: Partial<Environment>) => void;
  updateWorkspace: (id: string, data: Partial<Workspace>) => void;
  setUserTabs: (tabs: (RequestData | Collection | EnvironmentTab | SmokeTestingTab)[]) => void;
}

export const createTabsSlice: StateCreator<AppState, [], [], TabsSlice> = (set, get) => ({
  openTabs: [],
  activeTabId: null,

  addTab: (request) => set((state) => {
    const exists = state.openTabs.find(t => t.id === request.id);
    if (exists) return { activeTabId: request.id };
    return {
      openTabs: [...state.openTabs, request],
      activeTabId: request.id
    };
  }),

  closeTab: (id) => set((state) => {
    const newTabs = state.openTabs.filter(t => t.id !== id);
    let newActiveId = state.activeTabId;
    if (state.activeTabId === id) {
      newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
    }
    return { openTabs: newTabs, activeTabId: newActiveId };
  }),

  closeAllTabs: () => set({ openTabs: [], activeTabId: null }),

  closeOtherTabs: (id) => set((state) => {
    const tab = state.openTabs.find(t => t.id === id);
    return {
      openTabs: tab ? [tab] : [],
      activeTabId: tab ? id : null
    };
  }),

  closeTabsToTheRight: (id) => set((state) => {
    const index = state.openTabs.findIndex(t => t.id === id);
    if (index === -1) return {};
    const newTabs = state.openTabs.slice(0, index + 1);
    let newActiveId = state.activeTabId;
    const activeStillExists = newTabs.some(t => t.id === state.activeTabId);
    if (!activeStillExists) {
      newActiveId = id;
    }
    return { openTabs: newTabs, activeTabId: newActiveId };
  }),

  closeTabsToTheLeft: (id) => set((state) => {
    const index = state.openTabs.findIndex(t => t.id === id);
    if (index === -1) return {};
    const newTabs = state.openTabs.slice(index);
    let newActiveId = state.activeTabId;
    const activeStillExists = newTabs.some(t => t.id === state.activeTabId);
    if (!activeStillExists) {
      newActiveId = id;
    }
    return { openTabs: newTabs, activeTabId: newActiveId };
  }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, data) => set((state) => ({
    openTabs: state.openTabs.map(t => t.id === id ? { ...t, ...data } as any : t) as AppState['openTabs']
  })),

  updateRequest: (id, data) => set((state) => {
    const newTabs = state.openTabs.map(t => t.id === id ? { ...t, ...data } as any : t) as AppState['openTabs'];
    const updateInTree = (nodes: any[]): any[] => {
      return nodes.map(node => {
        if (node.id === id) return { ...node, ...data };
        if (node.folders) return { ...node, folders: updateInTree(node.folders) };
        if (node.requests) return { ...node, requests: node.requests.map((r: any) => r.id === id ? { ...r, ...data } : r) };
        return node;
      });
    };
    const newCollections = updateInTree(state.collections);
    if (!id.startsWith('history-') && !id.startsWith('temp-')) {
      const updatedRequest = newTabs.find(t => t.id === id) as RequestData;
      if (updatedRequest) {
        syncManager.enqueue('request', id, updatedRequest);
      }
    }
    return { openTabs: newTabs, collections: newCollections };
  }),

  updateCollection: (id, data) => set((state) => {
    const newTabs = state.openTabs.map(t => t.id === id ? { ...t, ...data } as any : t) as AppState['openTabs'];
    const newCollections = state.collections.map(c => c.id === id ? { ...c, ...data } : c);
    syncManager.enqueue('collection', id, data);
    return { openTabs: newTabs, collections: newCollections };
  }),

  updateEnvironment: (id, data) => set((state) => {
    const newEnvironments = state.environments.map(e => e.id === id ? { ...e, ...data } : e);
    syncManager.enqueue('environment', id, data);
    return { environments: newEnvironments };
  }),

  updateWorkspace: (id, data) => set((state) => {
    const newWorkspaces = state.workspaces.map(w => w.id === id ? { ...w, ...data } : w);
    syncManager.enqueue('workspace', id, data);
    return { workspaces: newWorkspaces };
  }),

  setUserTabs: (tabs) => set({ openTabs: tabs, activeTabId: tabs.length > 0 ? tabs[0].id : null }),
});

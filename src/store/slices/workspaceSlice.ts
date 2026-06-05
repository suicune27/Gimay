import { StateCreator } from 'zustand';
import { AppState } from '../types';
import { Workspace } from '../../types';

export interface WorkspaceSlice {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  reset: () => void;
}

export const createWorkspaceSlice: StateCreator<AppState, [], [], WorkspaceSlice> = (set) => ({
  activeWorkspaceId: null,
  setActiveWorkspaceId: (id) => set({
    activeWorkspaceId: id,
    collections: [],
    environments: [],
    history: [],
    activeTabId: null,
    openTabs: []
  }),
  workspaces: [],
  setWorkspaces: (workspaces) => set({ workspaces: workspaces || [] }),

  reset: () => set({
    profile: null,
    activeWorkspaceId: null,
    workspaces: [],
    collections: [],
    environments: [],
    history: [],
    teams: [],
    openTabs: [],
    activeTabId: null,
    activeEnvId: null,
    globalVariables: [],
    lastResponse: null,
    pendingSyncIds: new Set()
  }),
});

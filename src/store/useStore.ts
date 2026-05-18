import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PersistenceService } from '../services/PersistenceService';
import { syncManager } from '../services/SyncService';
import { RequestUtils } from '../utils/RequestUtils';
import { ProxyService } from '../services/ProxyService';
import { 
  RequestData, 
  Workspace, 
  Collection, 
  CollectionCollaborator,
  Environment, 
  EnvironmentTab,
  ResponseData, 
  Profile,
  KeyValue,
  Toast,
  Team,
  ScriptCategory,
  ScriptTemplate,
  AppSettings,
  SyncMetadata
} from '../types';

interface AppState {
  // Session & Identity
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  
  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  
  // Sync Metadata
  syncMetadata: SyncMetadata;
  updateSyncMetadata: (metadata: Partial<SyncMetadata>) => void;
  
  // Workspace Context
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  
  // Navigation & Tabs
  openTabs: (RequestData | Collection | EnvironmentTab)[];
  activeTabId: string | null;
  addTab: (item: RequestData | Collection | EnvironmentTab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  updateTab: (id: string, data: Partial<RequestData | Collection | EnvironmentTab>) => void;
  updateRequest: (id: string, data: Partial<RequestData>) => void;
  updateCollection: (id: string, data: Partial<Collection>) => void;
  updateEnvironment: (id: string, data: Partial<Environment>) => void;
  updateWorkspace: (id: string, data: Partial<Workspace>) => void;
  
  // Data
  collections: Collection[];
  setCollections: (collections: Collection[]) => void;
  environments: Environment[];
  setEnvironments: (environments: Environment[]) => void;
  history: any[];
  setHistory: (history: any[]) => void;
  teams: Team[];
  setTeams: (teams: Team[]) => void;
  collectionPresence: Record<string, Array<{ userId: string; name: string; state: 'viewing' | 'editing' }>>;
  setCollectionPresence: (collectionId: string, members: Array<{ userId: string; name: string; state: 'viewing' | 'editing' }>) => void;
  memberPresence: Record<string, any>;
  setMemberPresence: (presence: Record<string, any>) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  activeEnvId: string | null;
  setActiveEnvId: (id: string | null) => void;
  globalVariables: KeyValue[];
  setGlobalVariables: (variables: KeyValue[]) => void;
  
  // Script Library
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
  duplicateRequest: (id: string, overrides?: Partial<RequestData>) => Promise<void>;
  addRequest: (request: RequestData) => void;
  deleteRequestState: (id: string) => void;
  syncResource: (type: 'request' | 'collection' | 'environment', id: string) => Promise<boolean>;
  
  // Execution
  lastResponse: ResponseData | null;
  setLastResponse: (response: ResponseData | null) => void;
  isSending: boolean;
  setIsSending: (sending: boolean) => void;
  
  // UI Preferences
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
  // Landing/Intro
  landingSkipped: boolean;
  setLandingSkipped: (skipped: boolean) => void;
  // Tab Sync
  setUserTabs: (tabs: (RequestData | Collection | EnvironmentTab)[]) => void;

  // Sync Status
  syncStatus: 'idle' | 'saving' | 'saved' | 'error' | 'pending' | 'offline';
  setSyncStatus: (status: 'idle' | 'saving' | 'saved' | 'error' | 'pending' | 'offline') => void;
  pendingSyncIds: Set<string>;
  setPendingSyncIds: (ids: Set<string>) => void;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  
  // Reset
  reset: () => void;
  
  // Permissions helper
  canPerformAction: (collection: Collection, action: 'view' | 'edit' | 'execute') => boolean;
  
  // Reordering
  reorderCollection: (collectionId: string, newIndex: number) => void;
  reorderFolder: (collectionId: string, folderId: string, newIndex: number) => void;
  reorderRequest: (collectionId: string, requestId: string, newIndex: number, folderId?: string) => void;
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    autoSave: true,
    httpVersion: 'auto',
    requestTimeout: 0,
    maxResponseSize: 100 * 1024 * 1024,
    followRedirects: true,
    maxRedirects: 10,
    retryCount: 0,
    retryDelay: 1000,
    keepAlive: true,
  },
  ssl: {
    verifySSL: true,
    customCA: '',
    clientCert: '',
    clientKey: '',
    tlsVersion: 'auto',
    keyLogFile: false,
  },
  proxy: {
    mode: 'auto',
    pacUrl: '',
    enabled: false,
    useSystemProxy: true,
    httpProxy: '',
    httpsProxy: '',
    socksProxy: '',
    bypassList: 'localhost, 127.0.0.1',
    auth: {
      enabled: false,
      username: '',
      password: '',
    },
  },
  appearance: {
    theme: 'dark',
    accentColor: '#3ECF8E',
    layoutMode: 'comfortable',
    fontFamily: 'Inter',
    fontSize: 13,
    showStatusBar: true,
  },
  cookies: {
    enabled: true,
    clearOnExit: false,
    workspaceIsolation: false,
  },
  network: {
    enableCompression: true,
    enableStreaming: true,
    rawNetworkLog: false,
  },
  experimental: {
    enabled: false,
    useNewEditor: false,
    debugLogs: false,
  },
  github: {
    token: '',
    repo: '',
    branch: 'main',
    path: 'collections',
    autoSync: false,
  },
};

export const DEFAULT_SYNC_METADATA: SyncMetadata = {
  lastSaved: null,
  lastSynced: null,
  lastBackup: null,
  retryCount: 0,
  isOffline: false,
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (profile) => set({ profile }),
      
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

      isSettingsModalOpen: false,
      setIsSettingsModalOpen: (isOpen) => set({ isSettingsModalOpen: isOpen }),
      
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
      setActiveTab: (id) => set({ activeTabId: id }),
      updateTab: (id, data) => set((state) => ({
        openTabs: state.openTabs.map(t => t.id === id ? { ...t, ...data } as any : t) as AppState['openTabs']
      })),
      updateRequest: (id, data) => set((state) => {
        // 1. Update tabs
        const newTabs = state.openTabs.map(t => t.id === id ? { ...t, ...data } as any : t) as AppState['openTabs'];
        
        // 2. Update collections (deep update for requests)
        const updateInTree = (nodes: any[]): any[] => {
          return nodes.map(node => {
            if (node.id === id) return { ...node, ...data };
            if (node.folders) return { ...node, folders: updateInTree(node.folders) };
            if (node.requests) return { ...node, requests: node.requests.map((r: any) => r.id === id ? { ...r, ...data } : r) };
            return node;
          });
        };
        
        const newCollections = updateInTree(state.collections);
        
        // Enqueue sync if valid request
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
      
      collections: [],
      setCollections: (collections) => set((state) => {
        const safeCollections = collections || [];
        const order = state.profile?.preferences?.sidebar_order;
        if (!order) return { collections: safeCollections };

        const sortRequests = (reqs: RequestData[], parentId: string): RequestData[] => {
          const safeReqs = reqs || [];
          const reqOrder = order.requests?.[parentId];
          if (!reqOrder) return safeReqs;
          return [...safeReqs].sort((a, b) => {
            const idxA = reqOrder.indexOf(a.id);
            const idxB = reqOrder.indexOf(b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
        };

        const sortFolders = (folders: any[], collectionId: string): any[] => {
          const safeFolders = folders || [];
          const folderOrder = order.folders?.[collectionId];
          let sorted = safeFolders;
          if (folderOrder) {
            sorted = [...safeFolders].sort((a, b) => {
              const idxA = folderOrder.indexOf(a.id);
              const idxB = folderOrder.indexOf(b.id);
              if (idxA === -1 && idxB === -1) return 0;
              if (idxA === -1) return 1;
              if (idxB === -1) return -1;
              return idxA - idxB;
            });
          }
          return sorted.map(f => ({
            ...f,
            folders: f.folders ? sortFolders(f.folders, collectionId) : undefined,
            requests: f.requests ? sortRequests(f.requests, f.id) : undefined
          }));
        };

        const sortedCollections = [...safeCollections].sort((a, b) => {
          const colOrder = order.collections;
          if (!colOrder) return 0;
          const idxA = colOrder.indexOf(a.id);
          const idxB = colOrder.indexOf(b.id);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        }).map(c => ({
          ...c,
          folders: c.folders ? sortFolders(c.folders, c.id) : undefined,
          requests: c.requests ? sortRequests(c.requests, c.id) : undefined
        }));

        return { collections: sortedCollections };
      }),
      environments: [],
      setEnvironments: (environments) => set({ environments: environments || [] }),
      history: [],
      setHistory: (history) => set({ history: history || [] }),
      teams: [],
      setTeams: (teams) => set({ teams: teams || [] }),
      collectionPresence: {},
      setCollectionPresence: (collectionId, members) => set((state) => ({
        collectionPresence: { ...state.collectionPresence, [collectionId]: members }
      })),
      memberPresence: {},
      setMemberPresence: (memberPresence) => set({ memberPresence }),
      setUserTabs: (tabs) => set({ openTabs: tabs, activeTabId: tabs.length > 0 ? tabs[0].id : null }),
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
        const profile = useStore.getState().profile;
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
      
      duplicateRequest: async (id, overrides = {}) => {
        const state = useStore.getState();
        try {
          const duplicated = await PersistenceService.duplicateRequest(id, overrides);
          state.addRequest(duplicated);
          state.addTab(duplicated);
          state.addToast({ type: 'success', message: 'Request duplicated successfully.' });
        } catch (error) {
          state.addToast({ type: 'error', message: 'Failed to duplicate request.' });
          console.error(error);
        }
      },
      
      addRequest: (request) => set((state) => {
        const normalized = RequestUtils.normalizeRequest(request);
        const newCollections = state.collections.map(c => {
          if (c.id !== normalized.collection_id) return c;
          
          if (normalized.folder_id) {
            const updateFolders = (folders: any[]): any[] => {
              return folders.map(f => {
                if (f.id === normalized.folder_id) {
                  const exists = (f.requests || []).some((r: any) => r.id === normalized.id);
                  if (exists) return f;
                  return { ...f, requests: [...(f.requests || []), normalized] };
                }
                if (f.folders) return { ...f, folders: updateFolders(f.folders) };
                return f;
              });
            };
            return { ...c, folders: updateFolders(c.folders || []) } as any;
          } else {
            const exists = (c.requests || []).some((r: any) => r.id === normalized.id);
            if (exists) return c;
            return { ...c, requests: [...(c.requests || []), normalized] };
          }
        });
        
        return { collections: newCollections };
      }),

      deleteRequestState: (id) => set((state) => {
        const deleteInTree = (nodes: any[]): any[] => {
          return nodes.map(node => {
            if (node.folders) return { ...node, folders: deleteInTree(node.folders) };
            if (node.requests) return { ...node, requests: node.requests.filter((r: any) => r.id !== id) };
            return node;
          });
        };
        const newCollections = deleteInTree(state.collections);
        const newTabs = state.openTabs.filter(t => t.id !== id);
        const newActiveId = state.activeTabId === id 
          ? (newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null) 
          : state.activeTabId;
          
        return { collections: newCollections, openTabs: newTabs, activeTabId: newActiveId };
      }),

      syncResource: async (type, id) => {
        try {
          await syncManager.triggerSync(type, id);
          return true;
        } catch (error) {
          useStore.getState().addToast({ 
            type: 'error', 
            message: `Manual sync failed: ${error instanceof Error ? error.message : 'Unknown Error'}` 
          });
          return false;
        }
      },
      
      lastResponse: null,
      setLastResponse: (lastResponse) => set({ lastResponse }),
      isSending: false,
      setIsSending: (isSending) => set({ isSending }),
      
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
      
      syncStatus: 'idle',
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      pendingSyncIds: new Set(),
      setPendingSyncIds: (pendingSyncIds) => set({ pendingSyncIds }),
      
      updateProfile: async (data) => {
        const profile = useStore.getState().profile;
        if (!profile) return;
        const newProfile = { ...profile, ...data };
        set({ profile: newProfile });
        
        // Sync to DB
        syncManager.enqueue('profile', profile.id, data.preferences || data);
      },
      
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

      canPerformAction: (collection: Collection, action) => {
        const state = useStore.getState();
        const profile = state.profile;
        if (!profile || !collection) return false;
        
        // Owner always has full access
        // Use loose check and email fallbacks for robustness
        const isOwner = collection.user_id === profile.id || 
                      (collection as any).owner_email === profile.email;

        if (isOwner) return true;

        const directRole = collection.collaborators?.find(c => c.user_id === profile.id)?.role;
        if (directRole) {
          if (directRole === 'admin') return true;
          if (directRole === 'editor') return true;
          if (directRole === 'viewer') return action === 'view';
        }
        
        // If not shared, and not owner, no access
        if (collection.visibility !== 'team' && !directRole) return false;
        
        // Check if user is in the team
        const team = state.teams.find(t => t.id === collection.team_id);
        const teamMember = team?.team_members?.find(m => m.user_id === profile.id);
        
        if (teamMember) {
           if (teamMember.role === 'admin' || teamMember.role === 'editor') return true;
           // viewer-role in team follows collection's default permission level
           if (action === 'view') return true;
           if (action === 'execute') return collection.permission === 'execute' || collection.permission === 'edit';
           if (action === 'edit') return collection.permission === 'edit';
        }
        
        return false;
      },

      reorderCollection: (collectionId, newIndex) => set((state) => {
        const collections = [...state.collections];
        const oldIndex = collections.findIndex(c => c.id === collectionId);
        if (oldIndex === -1) return state;
        const [removed] = collections.splice(oldIndex, 1);
        collections.splice(newIndex, 0, removed);
        
        // Update preferences
        const preferences = { ...state.profile?.preferences };
        preferences.sidebar_order = {
          ...preferences.sidebar_order,
          collections: collections.map(c => c.id)
        };
        
        if (state.profile) {
          state.updateProfile({ preferences } as any);
        }

        return { collections };
      }),

      reorderFolder: (collectionId, folderId, newIndex) => set((state) => {
        let updatedCollectionsPath = false;
        const collections = state.collections.map(col => {
          if (col.id !== collectionId || !col.folders) return col;
          const folders = [...col.folders];
          const oldIndex = folders.findIndex(f => f.id === folderId);
          if (oldIndex === -1) return col;
          const [removed] = folders.splice(oldIndex, 1);
          folders.splice(newIndex, 0, removed);
          updatedCollectionsPath = true;
          return { ...col, folders };
        });

        if (updatedCollectionsPath && state.profile) {
          const preferences = { ...state.profile.preferences };
          const col = collections.find(c => c.id === collectionId);
          if (col?.folders) {
            preferences.sidebar_order = {
              ...preferences.sidebar_order,
              folders: {
                ...preferences.sidebar_order?.folders,
                [collectionId]: col.folders.map(f => f.id)
              }
            };
            state.updateProfile({ preferences } as any);
          }
        }

        return { collections };
      }),

      reorderRequest: (collectionId, requestId, newIndex, folderId) => set((state) => {
        let updatedCollectionsPath = false;
        const collections = state.collections.map(col => {
          if (col.id !== collectionId) return col;
          
          if (folderId) {
            // Update in specific folder
            const updateFolders = (folders: any[]): any[] => {
              return folders.map(f => {
                if (f.id === folderId) {
                  const requests = [...(f.requests || [])];
                  const oldIndex = requests.findIndex(r => r.id === requestId);
                  if (oldIndex === -1) return f;
                  const [removed] = requests.splice(oldIndex, 1);
                  requests.splice(newIndex, 0, removed);
                  updatedCollectionsPath = true;
                  return { ...f, requests };
                }
                if (f.folders) return { ...f, folders: updateFolders(f.folders) };
                return f;
              });
            };
            return { ...col, folders: updateFolders(col.folders || []) };
          } else {
            // Update in root collection
            const requests = [...(col.requests || [])];
            const oldIndex = requests.findIndex(r => r.id === requestId);
            if (oldIndex === -1) return col;
            const [removed] = requests.splice(oldIndex, 1);
            requests.splice(newIndex, 0, removed);
            updatedCollectionsPath = true;
            return { ...col, requests };
          }
        });

        if (updatedCollectionsPath && state.profile) {
          const preferences = { ...state.profile.preferences };
          const parentId = folderId || collectionId;
          const target = collections.find(c => c.id === collectionId);
          let targetRequests: any[] = [];
          if (folderId) {
            const findFolder = (folders: any[]): any => {
              for (const f of folders) {
                if (f.id === folderId) return f;
                if (f.folders) {
                  const found = findFolder(f.folders);
                  if (found) return found;
                }
              }
              return null;
            };
            targetRequests = findFolder(target?.folders || [])?.requests || [];
          } else {
            targetRequests = target?.requests || [];
          }

          preferences.sidebar_order = {
            ...preferences.sidebar_order,
            requests: {
              ...preferences.sidebar_order?.requests,
              [parentId]: targetRequests.map(r => r.id)
            }
          };
          state.updateProfile({ preferences } as any);
        }

        return { collections };
      }),
    }),
    {
      name: 'omni-node-storage',
      partialize: (state) => ({ 
        openTabs: state.openTabs, 
        activeTabId: state.activeTabId,
        activeWorkspaceId: state.activeWorkspaceId,
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

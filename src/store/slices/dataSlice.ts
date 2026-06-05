import { StateCreator } from 'zustand';
import { AppState } from '../types';
import { Collection, Environment, Team, RequestData } from '../../types';
import { PersistenceService } from '../../services/PersistenceService';
import { syncManager } from '../../services/SyncService';
import { RequestUtils } from '../../utils/RequestUtils';

export interface DataSlice {
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
  duplicateRequest: (id: string, overrides?: Partial<RequestData>) => Promise<void>;
  addRequest: (request: RequestData) => void;
  deleteRequestState: (id: string) => void;
  syncResource: (type: 'request' | 'collection' | 'environment', id: string) => Promise<boolean>;
  reorderCollection: (collectionId: string, newIndex: number) => void;
  reorderFolder: (collectionId: string, folderId: string, newIndex: number) => void;
  reorderRequest: (collectionId: string, requestId: string, newIndex: number, folderId?: string) => void;
}

export const createDataSlice: StateCreator<AppState, [], [], DataSlice> = (set, get) => ({
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

  duplicateRequest: async (id, overrides = {}) => {
    const state = get();
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
      get().addToast({
        type: 'error',
        message: `Manual sync failed: ${error instanceof Error ? error.message : 'Unknown Error'}`
      });
      return false;
    }
  },

  reorderCollection: (collectionId, newIndex) => set((state) => {
    const collections = [...state.collections];
    const oldIndex = collections.findIndex(c => c.id === collectionId);
    if (oldIndex === -1) return state;
    const [removed] = collections.splice(oldIndex, 1);
    collections.splice(newIndex, 0, removed);
    const preferences = { ...state.profile?.preferences };
    preferences.sidebar_order = {
      ...preferences.sidebar_order,
      collections: collections.map(c => c.id)
    };
    if (state.profile) {
      get().updateProfile({ preferences } as any);
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
        get().updateProfile({ preferences } as any);
      }
    }
    return { collections };
  }),

  reorderRequest: (collectionId, requestId, newIndex, folderId) => set((state) => {
    let updatedCollectionsPath = false;
    const collections = state.collections.map(col => {
      if (col.id !== collectionId) return col;
      if (folderId) {
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
      get().updateProfile({ preferences } as any);
    }
    return { collections };
  }),
});

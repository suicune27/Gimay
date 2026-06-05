import { 
  RequestData, 
  Workspace, 
  Collection, 
  Environment, 
  EnvironmentTab,
  SmokeTestingTab,
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

export interface AppState {
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
  setUserTabs: (tabs: (RequestData | Collection | EnvironmentTab | SmokeTestingTab)[]) => void;

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

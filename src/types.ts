export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type RequestType = 'rest' | 'graphql' | 'websocket' | 'grpc' | 'socketio';
export type BodyType = 'none' | 'json' | 'form-data' | 'urlencoded' | 'raw' | 'graphql' | 'xml' | 'binary';

export interface FormDataItem {
  id: string;
  key: string;
  value: string;
  type: 'text' | 'file';
  active: boolean;
  description?: string;
  file?: File;
}

export interface RequestBody {
  type: BodyType;
  content: string;
  formData: FormDataItem[];
  urlencoded: KeyValue[];
  graphql: {
    query: string;
    variables: string;
  };
  binary?: {
    file?: File;
    name?: string;
  };
}

export interface RequestData {
  id: string;
  collection_id?: string;
  folder_id?: string;
  workspace_id: string;
  user_id: string;
  name: string;
  type: RequestType;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string | RequestBody; // Support both for legacy/DB compatibility
  bodyType: BodyType;
  auth: AuthConfig;
  pre_request_script?: string;
  test_script?: string;
  settings?: {
    followRedirects: boolean;
    timeout: number;
    maxRedirects: number;
  };
  created_at: string;
  updated_at: string;
}
export type AuthType = 'none' | 'inherit' | 'bearer' | 'basic' | 'apikey' | 'oauth2';

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  initialValue?: string;
  currentValue?: string;
  active: boolean;
  enabled?: boolean; // Alias for active in some contexts
  masked?: boolean;
  description?: string;
  type?: 'string' | 'number' | 'boolean' | 'json' | 'secret' | 'dynamic' | 'encrypted' | 'text' | 'file';
  createdAt?: string;
  updatedAt?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  team_id?: string;
  user_id: string;
  visibility: 'private' | 'team' | 'public';
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  workspace_id: string;
  user_id: string;
  team_id?: string;
  visibility: 'private' | 'team';
  permission: 'view' | 'edit' | 'execute';
  variables: KeyValue[];
  auth: AuthConfig;
  pre_request_script?: string;
  test_script?: string;
  documentation?: string;
  collaborators?: CollectionCollaborator[];
  last_edited_by?: string;
  last_edited_at?: string;
  created_at: string;
  updated_at: string;
  requests?: RequestData[];
  folders?: Folder[];
}

export interface CollectionCollaborator {
  id: string;
  collection_id: string;
  user_id: string;
  invited_by?: string;
  role: 'viewer' | 'editor' | 'admin';
  created_at?: string;
  updated_at?: string;
  profiles?: {
    email?: string;
    full_name?: string;
    username?: string;
  };
}

export interface Folder {
  id: string;
  name: string;
  collection_id: string;
  user_id: string;
  parent_id?: string;
  description?: string;
  auth: AuthConfig;
  created_at: string;
  requests?: RequestData[];
  folders?: Folder[];
}

export interface AuthConfig {
  type: AuthType;
  bearer?: string;
  basic?: { username?: string; password?: string };
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
  oauth2?: { accessToken?: string; tokenType?: string };
}



export interface AppSettings {
  general: {
    autoSave: boolean;
    httpVersion: 'auto' | 'http1.1' | 'http2' | 'http3';
    requestTimeout: number;
    maxResponseSize: number;
    followRedirects: boolean;
    maxRedirects: number;
    retryCount: number;
    retryDelay: number;
    keepAlive: boolean;
  };
  ssl: {
    verifySSL: boolean;
    customCA: string;
    clientCert: string;
    clientKey: string;
    tlsVersion: 'auto' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3';
    keyLogFile: boolean;
  };
  proxy: {
    mode: 'auto' | 'manual' | 'pac' | 'disabled';
    pacUrl: string;
    enabled: boolean;
    useSystemProxy: boolean;
    httpProxy: string;
    httpsProxy: string;
    socksProxy: string;
    bypassList: string;
    auth: {
      enabled: boolean;
      username?: string;
      password?: string;
    };
  };
  appearance: {
    theme: 'dark' | 'light' | 'system';
    accentColor: string;
    layoutMode: 'compact' | 'comfortable';
    fontFamily: string;
    fontSize: number;
    showStatusBar: boolean;
  };
  cookies: {
    enabled: boolean;
    clearOnExit: boolean;
    workspaceIsolation: boolean;
  };
  network: {
    enableCompression: boolean;
    enableStreaming: boolean;
    rawNetworkLog: boolean;
  };
  experimental: {
    enabled: boolean;
    useNewEditor: boolean;
    debugLogs: boolean;
  };
  github: {
    token: string;
    repo: string;
    branch: string;
    path: string;
    autoSync: boolean;
    lastPulledAt?: string;
    lastPushedAt?: string;
  };
}
export type SettingsSection = 'General' | 'Themes' | 'Proxy' | 'SSL/TLS' | 'Cookies' | 'Response & Network' | 'GitHub Sync' | 'Experimental' | 'Diagnostics' | 'About';

export interface SyncMetadata {
  lastSaved: number | null;
  lastSynced: number | null;
  lastBackup: number | null;
  retryCount: number;
  isOffline: boolean;
}

export interface HistoryEntry {
  id: string;
  workspace_id: string;
  user_id: string;
  request_id: string;
  request_name: string;
  method: HttpMethod;
  url: string;
  status: number;
  time: number;
  size?: number;
  request_data?: any;
  response_data?: any;
  created_at: string;
}

export interface ResponseData {
  id: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  time: number;
  size: number;
  contentType: string;
  testResults?: { name: string; status: 'pass' | 'fail'; message?: string }[];
  consoleLogs?: any[];
  request_config?: any;
}

export interface Environment {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  variables: KeyValue[];
  pre_request_script?: string;
  test_script?: string;
  documentation?: string;
  is_global: boolean;
  created_at: string;
  updated_at?: string;
}

export interface EnvironmentTab {
  id: string;
  type: 'environment-manager';
  name: string;
  environmentId?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  created_at: string;
  team_members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'viewer' | 'editor' | 'admin';
  email?: string;
  profiles?: {
    email?: string;
    full_name?: string;
    username?: string;
  };
}

export interface TeamInvite {
  id: string;
  team_id: string;
  created_by: string;
  code: string;
  supabase_url: string;
  supabase_anon_key: string;
  expires_at: string | null;
  max_uses: number;
  use_count: number;
  is_revoked: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  username?: string;
  full_name: string;
  avatar_url?: string;
  preferences: {
    theme: 'light' | 'dark';
    sidebar_width: number;
    last_workspace_id?: string;
    sidebar_order?: {
      collections?: string[];
      folders?: Record<string, string[]>; // collectionId -> folderIds[]
      requests?: Record<string, string[]>; // (collectionId|folderId) -> requestIds[]
    };
  };
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export interface ScriptCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  description?: string;
  category_id?: string;
  content: string;
  example_usage?: string;
  variables_used: string[];
  author_id?: string;
  version: string;
  is_builtin: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  categories?: ScriptCategory;
}

export interface ScriptExecutionLog {
  id: string;
  request_id?: string;
  workspace_id?: string;
  user_id: string;
  logs: any[];
  errors: any[];
  duration: number;
  variables_changed: Record<string, any>;
  created_at: string;
}

export interface Script {
  id: string;
  name: string;
  content: string;
  folder_id?: string | null;
  workspace_id: string;
  user_id: string;
  tags?: string[];
  favorite?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScriptFolder {
  id: string;
  name: string;
  workspace_id: string;
  user_id: string;
  parent_id?: string | null;
  created_at: string;
}

export interface ScriptTab {
  id: string;
  scriptId: string;
  isDirty: boolean;
}

export interface ScriptLog {
  id: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp: number;
}

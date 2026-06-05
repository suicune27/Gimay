export interface AppSettings {
  general: {
    autoSave: boolean;
    checkDatabaseIntegrity: boolean;
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

export type SettingsSection = 'General' | 'Themes' | 'Proxy' | 'SSL/TLS' | 'Cookies' | 'Response & Network' | 'Experimental' | 'Diagnostics' | 'About';

export interface SyncMetadata {
  lastSaved: number | null;
  lastSynced: number | null;
  lastBackup: number | null;
  retryCount: number;
  isOffline: boolean;
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
      folders?: Record<string, string[]>;
      requests?: Record<string, string[]>;
    };
  };
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
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

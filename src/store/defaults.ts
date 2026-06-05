import { AppSettings, SyncMetadata } from '../types';
import { isElectron } from '../lib/platform';

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    autoSave: true,
    checkDatabaseIntegrity: false,
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
  isOffline: typeof window !== 'undefined' ? isElectron() : false,
};

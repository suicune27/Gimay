export interface SandboxContext {
  variables: Record<string, any>;
  environmentVariables?: Record<string, any>;
  signal?: AbortSignal;
  request?: {
    method: string;
    url: string;
    headers: any;
    body?: any;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    time: number;
    size: number;
    body: any;
  };
}

export interface SandboxResult {
  logs: Array<{ level: 'log' | 'info' | 'warn' | 'error' | 'success'; message: string; timestamp?: string }>;
  testResults: Array<{ name: string; status: 'pass' | 'fail'; message?: string }>;
  changedVariables: Record<string, any>;
  changedEnvironment?: Record<string, any>;
  changedRequest?: {
    method?: string;
    url?: string;
    headers?: Array<{ key: string; value: string; active?: boolean }>;
    body?: any;
  };
  error?: string;
}

export interface LogEntry {
  level: 'log' | 'info' | 'warn' | 'error' | 'success';
  message: string;
  timestamp?: string;
}

export interface TestEntry {
  name: string;
  status: 'pass' | 'fail';
  message?: string;
}

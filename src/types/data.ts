import { AuthConfig, KeyValue, RequestData, HttpMethod } from './http';

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
  workspace_id?: string;
}

export interface SmokeTestingTab {
  id: string;
  type: 'smoke-testing';
  name: string;
  workspace_id?: string;
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

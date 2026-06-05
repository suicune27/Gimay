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

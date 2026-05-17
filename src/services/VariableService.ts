import { KeyValue, Environment, Collection } from '../types';

export class VariableService {
  static resolve(text: string, context: {
    environments: Environment[];
    activeEnvId: string | null;
    collection: Collection | null;
    workspaceVariables?: KeyValue[];
    variables?: Record<string, any>;
  }): string {
    if (!text || typeof text !== 'string') return text;

    let resolved = text;
    // 0. Dynamic Variables (e.g. {{$guid}}, {{$timestamp}})
    resolved = resolved.replace(/{{(\$.*?)}}/g, (match, key) => {
      switch (key) {
        case '$guid': return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
        case '$timestamp': return Math.floor(Date.now() / 1000).toString();
        case '$randomInt': return Math.floor(Math.random() * 1000).toString();
        case '$isoTimestamp': return new Date().toISOString();
        default: return match;
      }
    });

    const variableMap: Record<string, string> = {};

    // 1. Workspace Variables (Lowest priority)
    if (context.workspaceVariables) {
      context.workspaceVariables.forEach(v => {
        if (v.active) variableMap[v.key] = v.value;
      });
    }

    // 2. Collection Variables
    if (context.collection && context.collection.variables) {
      context.collection.variables.forEach(v => {
        if (v.active) variableMap[v.key] = v.value;
      });
    }

    // 3. Environment Variables (Highest priority)
    if (context.activeEnvId) {
      const activeEnv = context.environments.find(e => e.id === context.activeEnvId);
      if (activeEnv && activeEnv.variables) {
        activeEnv.variables.forEach(v => {
          if (v.active) variableMap[v.key] = v.value;
        });
      }
    }

    // 4. Script-set Variables (Top priority)
    if (context.variables) {
      Object.entries(context.variables).forEach(([key, value]) => {
        variableMap[key] = String(value);
      });
    }

    // Replace {{key}} patterns
    // Using a loop to handle nested variables like {{BASE_URL}}/{{API_VERSION}}
    // Limit to 5 iterations to prevent infinite recursion
    for (let i = 0; i < 5; i++) {
      const matches = resolved.match(/{{(.*?)}}/g);
      if (!matches) break;

      let changed = false;
      matches.forEach(match => {
        const key = match.slice(2, -2);
        if (variableMap[key] !== undefined) {
          resolved = resolved.replace(match, variableMap[key]);
          changed = true;
        }
      });
      if (!changed) break;
    }

    return resolved;
  }

  static getResolvedVariableMap(context: {
    environments: Environment[];
    activeEnvId: string | null;
    collection: Collection | null;
    workspaceVariables?: KeyValue[];
    variables?: Record<string, any>;
  }): Record<string, string> {
    const variableMap: Record<string, string> = {};

    // 1. Workspace Variables
    if (context.workspaceVariables) {
      context.workspaceVariables.forEach(v => {
        if (v.active) variableMap[v.key] = v.value;
      });
    }

    // 2. Collection Variables
    if (context.collection && context.collection.variables) {
      context.collection.variables.forEach(v => {
        if (v.active) variableMap[v.key] = v.value;
      });
    }

    // 3. Environment Variables
    if (context.activeEnvId) {
      const activeEnv = context.environments.find(e => e.id === context.activeEnvId);
      if (activeEnv && activeEnv.variables) {
        activeEnv.variables.forEach(v => {
          if (v.active) variableMap[v.key] = v.value;
        });
      }
    }

    // 4. Script-set Variables
    if (context.variables) {
      Object.entries(context.variables).forEach(([key, value]) => {
        variableMap[key] = String(value);
      });
    }

    return variableMap;
  }

  static lookupVariable(key: string, context: {
    environments: Environment[];
    activeEnvId: string | null;
    collection: Collection | null;
    workspaceVariables?: KeyValue[];
    variables?: Record<string, any>;
    globalVariables?: KeyValue[];
  }): { 
    value: string; 
    source: string; 
    name: string; 
    scope: 'environment' | 'collection' | 'workspace' | 'global' | 'script' | 'unresolved';
    sourceId?: string;
    masked?: boolean;
  } {
    // Check in reverse order of priority (Script -> Env -> Coll -> Workspace -> Global)

    // 4. Script Variables
    if (context.variables && context.variables[key] !== undefined) {
      return { 
        value: String(context.variables[key]), 
        source: 'Script', 
        name: key, 
        scope: 'script' 
      };
    }

    // 3. Environment Variables
    if (context.activeEnvId) {
      const activeEnv = context.environments.find(e => e.id === context.activeEnvId);
      const v = activeEnv?.variables?.find(v => v.key === key && v.active);
      if (v) return { 
        value: v.value, 
        source: `Environment (${activeEnv?.name})`, 
        name: key, 
        scope: 'environment',
        sourceId: activeEnv?.id,
        masked: (v as any).masked 
      };
    }

    // 2. Collection Variables
    if (context.collection && context.collection.variables) {
      const v = context.collection.variables.find(v => v.key === key && v.active);
      if (v) return { 
        value: v.value, 
        source: 'Collection', 
        name: key, 
        scope: 'collection',
        masked: (v as any).masked
      };
    }

    // 1. Workspace Variables
    if (context.workspaceVariables) {
      const v = context.workspaceVariables.find(v => v.key === key && v.active);
      if (v) return { 
        value: v.value, 
        source: 'Workspace', 
        name: key, 
        scope: 'workspace',
        masked: (v as any).masked
      };
    }

    // 0. Global Variables
    if (context.globalVariables) {
      const v = context.globalVariables.find(v => v.key === key && v.active);
      if (v) return { 
        value: v.value, 
        source: 'Global', 
        name: key, 
        scope: 'global',
        masked: (v as any).masked
      };
    }

    return { 
      value: key, 
      source: 'Unresolved', 
      name: key, 
      scope: 'unresolved' 
    };
  }
}

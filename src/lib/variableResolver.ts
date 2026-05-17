import { KeyValue, Environment, Collection } from '../types';

export function resolveVariables(
  text: string, 
  activeEnv: Environment | null, 
  collection?: Collection | null
): { resolved: string; variables: Record<string, string> } {
  const variables: Record<string, string> = {};

  // 1. Collect from active environment
  if (activeEnv?.variables) {
    activeEnv.variables.forEach(v => {
      if (v.active) variables[v.key] = v.value;
    });
  }

  // 2. Collect from collection (overwrites env if same key, usually env overwrites collection in Postman, but let's follow a priority)
  // Standard priority: Local > Data > Environment > Collection > Global
  // Here let's do: Environment > Collection
  if (collection?.variables) {
    collection.variables.forEach(v => {
      if (v.active) {
         // Only set if not already set by env (Environment has higher priority in many clients, but some do it differently)
         // Actually, usually Environment variables are considered "more specific" than collection variables.
         if (variables[v.key] === undefined) {
           variables[v.key] = v.value;
         }
      }
    });
  }

  const resolved = text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });

  return { resolved, variables };
}

export function getVariableStatus(
  key: string,
  activeEnv: Environment | null,
  collection?: Collection | null
): 'resolved' | 'unresolved' | 'none' {
  if (!key.startsWith('{{') || !key.endsWith('}}')) return 'none';
  const varName = key.slice(2, -2);
  
  const envVar = activeEnv?.variables?.find(v => v.key === varName && v.active);
  if (envVar) return 'resolved';
  
  const colVar = collection?.variables?.find(v => v.key === varName && v.active);
  if (colVar) return 'resolved';
  
  return 'unresolved';
}

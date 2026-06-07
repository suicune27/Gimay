import { describe, it, expect } from 'vitest';
import { VariableService } from './VariableService';
import { KeyValue, Environment, Collection } from '../types';

const makeEnv = (id: string, name: string, vars: KeyValue[]): Environment => ({
  id,
  workspace_id: 'ws-1',
  user_id: 'user-1',
  name,
  variables: vars,
  is_global: false,
  created_at: new Date().toISOString(),
});

const makeCollection = (vars: KeyValue[]): Collection => ({
  id: 'col-1',
  name: 'Test Collection',
  workspace_id: 'ws-1',
  user_id: 'user-1',
  visibility: 'private',
  permission: 'edit',
  variables: vars,
  auth: { type: 'none' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const makeVar = (key: string, value: string, active = true): KeyValue => ({
  id: `var-${key}`,
  key,
  value,
  active,
});

describe('VariableService.resolve', () => {
  it('returns the same string if no variables', () => {
    expect(VariableService.resolve('hello', { environments: [], activeEnvId: null, collection: null })).toBe('hello');
  });

  it('returns the same string if null or non-string', () => {
    expect(VariableService.resolve(null as any, { environments: [], activeEnvId: null, collection: null })).toBe(null);
    expect(VariableService.resolve(undefined as any, { environments: [], activeEnvId: null, collection: null })).toBe(undefined);
  });

  it('replaces {{key}} with environment variable', () => {
    const env = makeEnv('env-1', 'Dev', [makeVar('BASE_URL', 'http://localhost:3000')]);
    const result = VariableService.resolve('{{BASE_URL}}/api/users', {
      environments: [env],
      activeEnvId: 'env-1',
      collection: null,
    });
    expect(result).toBe('http://localhost:3000/api/users');
  });

  it('environment takes priority over collection', () => {
    const env = makeEnv('env-1', 'Dev', [makeVar('API_KEY', 'env-key')]);
    const col = makeCollection([makeVar('API_KEY', 'col-key')]);
    const result = VariableService.resolve('{{API_KEY}}', {
      environments: [env],
      activeEnvId: 'env-1',
      collection: col,
    });
    expect(result).toBe('env-key');
  });

  it('collection variable used when no environment matches', () => {
    const col = makeCollection([makeVar('API_KEY', 'col-key')]);
    const result = VariableService.resolve('{{API_KEY}}', {
      environments: [],
      activeEnvId: null,
      collection: col,
    });
    expect(result).toBe('col-key');
  });

  it('script-set variables override environment', () => {
    const env = makeEnv('env-1', 'Dev', [makeVar('TOKEN', 'env-token')]);
    const result = VariableService.resolve('{{TOKEN}}', {
      environments: [env],
      activeEnvId: 'env-1',
      collection: null,
      variables: { TOKEN: 'script-token' },
    });
    expect(result).toBe('script-token');
  });

  it('workspace variables are used as fallback', () => {
    const result = VariableService.resolve('{{DB_URL}}', {
      environments: [],
      activeEnvId: null,
      collection: null,
      workspaceVariables: [makeVar('DB_URL', 'postgres://localhost')],
    });
    expect(result).toBe('postgres://localhost');
  });

  it('resolves nested variables (up to 5 levels)', () => {
    const env = makeEnv('env-1', 'Dev', [
      makeVar('HOST', 'localhost'),
      makeVar('PORT', '3000'),
      makeVar('BASE', 'http://{{HOST}}:{{PORT}}'),
    ]);
    const result = VariableService.resolve('{{BASE}}/api', {
      environments: [env],
      activeEnvId: 'env-1',
      collection: null,
    });
    expect(result).toBe('http://localhost:3000/api');
  });

  it('handles $guid dynamic variable', () => {
    const result = VariableService.resolve('{{$guid}}', {
      environments: [], activeEnvId: null, collection: null,
    });
    expect(result).not.toBe('{{$guid}}');
    expect(result.length).toBeGreaterThan(10);
  });

  it('handles $timestamp dynamic variable', () => {
    const result = VariableService.resolve('{{$timestamp}}', {
      environments: [], activeEnvId: null, collection: null,
    });
    expect(result).toMatch(/^\d+$/);
  });

  it('handles $isoTimestamp dynamic variable', () => {
    const result = VariableService.resolve('{{$isoTimestamp}}', {
      environments: [], activeEnvId: null, collection: null,
    });
    expect(() => new Date(result)).not.toThrow();
  });

  it('replaces multiple variables in one string', () => {
    const env = makeEnv('env-1', 'Dev', [
      makeVar('HOST', 'example.com'),
      makeVar('PORT', '8080'),
    ]);
    const result = VariableService.resolve('{{HOST}}:{{PORT}}', {
      environments: [env],
      activeEnvId: 'env-1',
      collection: null,
    });
    expect(result).toBe('example.com:8080');
  });

  it('leaves unresolved variables as-is', () => {
    const result = VariableService.resolve('{{UNKNOWN}}', {
      environments: [], activeEnvId: null, collection: null,
    });
    expect(result).toBe('{{UNKNOWN}}');
  });

  it('respects inactive variables', () => {
    const env = makeEnv('env-1', 'Dev', [
      makeVar('SECRET', 'should-not-appear', false),
      makeVar('SECRET', 'should-appear', true),
    ]);
    const result = VariableService.resolve('{{SECRET}}', {
      environments: [env],
      activeEnvId: 'env-1',
      collection: null,
    });
    expect(result).toBe('should-appear');
  });
});

describe('VariableService.getResolvedVariableMap', () => {
  it('returns combined map with proper priority', () => {
    const env = makeEnv('env-1', 'Dev', [makeVar('A', 'env-a'), makeVar('B', 'env-b')]);
    const col = makeCollection([makeVar('A', 'col-a'), makeVar('C', 'col-c')]);
    const map = VariableService.getResolvedVariableMap({
      environments: [env],
      activeEnvId: 'env-1',
      collection: col,
      workspaceVariables: [makeVar('D', 'ws-d')],
      variables: { A: 'script-a' },
    });
    expect(map['A']).toBe('script-a'); // script wins
    expect(map['B']).toBe('env-b');
    expect(map['C']).toBe('col-c');
    expect(map['D']).toBe('ws-d');
  });
});

describe('VariableService.lookupVariable', () => {
  it('returns scope information for a variable', () => {
    const env = makeEnv('env-1', 'Dev', [makeVar('KEY', 'val')]);
    const result = VariableService.lookupVariable('KEY', {
      environments: [env],
      activeEnvId: 'env-1',
      collection: null,
    });
    expect(result.value).toBe('val');
    expect(result.scope).toBe('environment');
    expect(result.source).toContain('Dev');
  });

  it('returns unresolved for missing variables', () => {
    const result = VariableService.lookupVariable('MISSING', {
      environments: [],
      activeEnvId: null,
      collection: null,
    });
    expect(result.scope).toBe('unresolved');
  });
});

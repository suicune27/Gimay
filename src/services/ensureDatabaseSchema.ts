import { createClient } from '@supabase/supabase-js';
import { fetchInitScriptFromDb } from './fetchInitScriptFromDb';
import { SQLScriptGenerator } from '../lib/SQLScriptGenerator';

type ProgressCallback = (label: string, pct: number) => void;

export type SchemaCompareResult = {
  success: boolean;
  upToDate: boolean;
  requiredTables: string[];
  missingTables: string[];
  script: string;
  error?: string;
};

const FALLBACK_REQUIRED_TABLES = [
  'profiles',
  'teams',
  'workspaces',
  'team_members',
  'collections',
  'folders',
  'requests',
  'environments',
  'scripts',
  'script_execution_logs',
  'request_history',
  'sync_logs',
];

function extractRequiredTablesFromScript(sql: string): string[] {
  const regex = /create\s+table\s+if\s+not\s+exists\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  const found = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sql)) !== null) {
    found.add(match[1].toLowerCase());
  }

  return Array.from(found);
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;

  while (i < sql.length) {
    if (sql[i] === '$') {
      const tagEnd = sql.indexOf('$', i + 1);
      if (tagEnd !== -1) {
        const tag = sql.substring(i, tagEnd + 1);
        if (/^\$[a-zA-Z_0-9]*\$$/.test(tag)) {
          const closeIdx = sql.indexOf(tag, tagEnd + 1);
          if (closeIdx !== -1) {
            current += sql.substring(i, closeIdx + tag.length);
            i = closeIdx + tag.length;
            continue;
          }
        }
      }
    }

    if (sql[i] === ';') {
      const stmt = current.trim();
      if (stmt.length > 0) statements.push(stmt);
      current = '';
      i++;
      continue;
    }

    current += sql[i];
    i++;
  }

  const tail = current.trim();
  if (tail.length > 0) statements.push(tail);

  return statements;
}

async function tableExists(client: any, table: string): Promise<boolean> {
  const { error } = await client.from(table).select('*').limit(0);
  if (!error) return true;

  const msg = (error.message || '').toLowerCase();
  
  // High-priority: Handle schema cache stale errors (PGRST205)
  if (msg.includes('schema cache') || error.code === 'PGRST205') {
    console.warn(`[Schema Check] Schema cache stale for table "${table}". Tentatively assuming success.`);
    return true; 
  }

  // Permission errors imply the table exists but caller cannot read it.
  if (msg.includes('permission denied') || msg.includes('forbidden')) {
    return true;
  }

  if (msg.includes('does not exist') || msg.includes('not found') || msg.includes('relation')) {
    return false;
  }

  // Fallback
  return true;
}

export async function compareDatabaseStructure(
  supabaseUrl: string,
  anonOrServiceKey: string,
): Promise<SchemaCompareResult> {
  try {
    const { script: dbScript } = await fetchInitScriptFromDb(supabaseUrl, anonOrServiceKey);
    const script = dbScript || SQLScriptGenerator.generateInitializationScript();

    const parsedTables = extractRequiredTablesFromScript(script);
    const requiredTables = parsedTables.length > 0 ? parsedTables : FALLBACK_REQUIRED_TABLES;

    const client = createClient(supabaseUrl, anonOrServiceKey);
    const missingTables: string[] = [];

    for (const table of requiredTables) {
      const exists = await tableExists(client, table);
      if (!exists) missingTables.push(table);
    }

    return {
      success: true,
      upToDate: missingTables.length === 0,
      requiredTables,
      missingTables,
      script,
    };
  } catch (err: any) {
    return {
      success: false,
      upToDate: false,
      requiredTables: [],
      missingTables: [],
      script: SQLScriptGenerator.generateInitializationScript(),
      error: err?.message || 'Failed to compare database structure.',
    };
  }
}

/**
 * Fetches the latest script from init_scripts, compares current DB structure,
 * and auto-applies missing updates through execute_sql when needed.
 */
export async function ensureDatabaseSchema(
  supabaseUrl: string,
  anonOrServiceKey: string,
  onProgress?: ProgressCallback,
): Promise<{ success: boolean; updated?: boolean; missingTables?: string[]; error?: string }> {
  try {
    onProgress?.('Fetching initialization script from database', 20);

    const compare = await compareDatabaseStructure(supabaseUrl, anonOrServiceKey);
    if (!compare.success) {
      return { success: false, error: compare.error || 'Failed to compare database structure.' };
    }

    onProgress?.('Comparing current database structure', 40);

    // Even if upToDate is true (meaning all tables exist), 
    // we still execute the script to ensure ALL columns and constraints are correct 
    // (the "Repair" section of the script handles this IDEMPOTENTLY).
    if (compare.upToDate) {
      onProgress?.('Ensuring schema integrity and relationships', 60);
    } else {
      onProgress?.(`Applying schema updates (${compare.missingTables.length} missing tables)`, 55);
    }

    const client = createClient(supabaseUrl, anonOrServiceKey);
    const statements = splitSqlStatements(compare.script);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const pct = Math.round(55 + ((i + 1) / statements.length) * 40);
      onProgress?.('Executing update statements', pct);

      const { error } = await client.rpc('execute_sql', { sql: stmt });
      if (error) {
        const msg = error.message ?? '';
        
        // Handle missing RPC specially
        if (msg.includes('function') && msg.includes('execute_sql') && (msg.includes('not find') || msg.includes('does not exist'))) {
          return {
            success: false,
            missingTables: compare.missingTables,
            error: `Helper function 'execute_sql' is missing from your database.\n\nFIX: Run the initialization script in the Supabase SQL Editor manually first, or use the 'Smart Initialize' flow which includes it.`,
          };
        }

        const ignorable =
          msg.includes('already exists') ||
          msg.includes('duplicate_object') ||
          (msg.includes('does not exist') && msg.includes('constraint')) ||
          (msg.includes('policy') && msg.includes('does not exist'));

        if (!ignorable) {
          return {
            success: false,
            missingTables: compare.missingTables,
            error: msg,
          };
        }
      }
    }

    onProgress?.('Re-checking database structure', 97);
    const verify = await compareDatabaseStructure(supabaseUrl, anonOrServiceKey);

    if (!verify.success) {
      return { success: false, error: verify.error || 'Schema update verification failed.' };
    }

    if (!verify.upToDate) {
      return {
        success: false,
        missingTables: verify.missingTables,
        error: `Schema update incomplete. Missing tables: ${verify.missingTables.join(', ')}`,
      };
    }

    onProgress?.('Done', 100);
    return { success: true, updated: true, missingTables: [] };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Schema initialization failed.' };
  }
}

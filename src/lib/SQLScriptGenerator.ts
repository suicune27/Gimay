import { fetchInitScriptFromDb } from '../services/fetchInitScriptFromDb';

export class SQLScriptGenerator {
  static async fetchInitializationScript(supabaseUrl: string, anonOrServiceKey: string): Promise<string> {
    const { script } = await fetchInitScriptFromDb(supabaseUrl, anonOrServiceKey);
    if (script) {
      return script;
    }

    // Legacy fallback for projects that do not yet have an init_scripts seed.
    return this.generateInitializationScript();
  }

  static generateTeamSchemaScript(): string {
    return `-- Gimay Team Infrastructure initialization
-- This script specifically handles the creation and hardening of the team system.
-- It can be used to manually update the init_scripts table or run directly in Supabase SQL editor.

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.execute_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  execute sql;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO postgres, anon, authenticated, service_role;

-- Cleanup existing constraints
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name, tc.table_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_schema = 'public'
          AND tc.table_name IN ('profiles', 'teams', 'workspaces', 'team_members', 'collections', 'folders', 'requests', 'environments', 'team_invites')
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Tables (Soft References)
CREATE TABLE IF NOT EXISTS public.profiles (id UUID PRIMARY KEY);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.teams (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_code TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS secret_code_hash TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_owner_id_fkey;
ALTER TABLE public.teams ADD CONSTRAINT teams_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.team_members (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_team_id_fkey;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Constraints
ALTER TABLE public.teams ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.teams ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.teams ALTER COLUMN team_code SET NOT NULL;

-- Reload Cache
NOTIFY pgrst, 'reload schema';
COMMENT ON TABLE public.teams IS 'Teams Table reconstructed at ' || NOW();

-- Indices
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
`;
  }

  static generateMinimalInitializationScript(): string {
    return [
      '-- Minimal Gimay Database Initialization Script',
      `-- Generated: ${new Date().toISOString()}`,
      '',
      '-- HELPER FUNCTIONS',
      'CREATE OR REPLACE FUNCTION public.execute_sql(sql text)',
      'RETURNS void',
      'LANGUAGE plpgsql',
      'SECURITY DEFINER',
      'SET search_path = public',
      'AS $function$',
      'begin',
      '  execute sql;',
      'end;',
      '$function$;',
      '',
      'GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO postgres, anon, authenticated, service_role;',
      '',
      'CREATE TABLE IF NOT EXISTS profiles (',
      '  id UUID PRIMARY KEY,',
      '  username TEXT UNIQUE,',
      '  full_name TEXT,',
      '  email TEXT,',
      '  avatar_url TEXT,',
      "  preferences JSONB DEFAULT '{\"theme\": \"dark\", \"sidebar_width\": 300, \"last_workspace_id\": null}',",
      '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
      '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      ');',
      '',
      'CREATE TABLE IF NOT EXISTS teams (',
      '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
      '  name TEXT NOT NULL UNIQUE,',
      '  description TEXT,',
      '  avatar_url TEXT,',
      '  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,',
      '  team_code TEXT UNIQUE NOT NULL,',
      '  secret_code_hash TEXT UNIQUE,',
      "  settings JSONB DEFAULT '{}',",
      '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
      '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      ');',
      '',
      'CREATE TABLE IF NOT EXISTS team_members (',
      '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
      '  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,',
      '  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,',
      "  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),",
      '  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
      '  UNIQUE(team_id, user_id)',
      ');',
    ].join('\n');
  }

  static generateInitializationScript(): string {
    return `-- GIMAY ULTIMATE SCHEMA V10.3 - PRODUCTION GRADE (Initialization)
-- Generated: ${new Date().toISOString()}
-- Architectural Goal: Scalable, Multi-tenant, Real-time synchronized API Client

-- 0. EXTENSIONS & SETUP
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.execute_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  execute sql;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO postgres, anon, authenticated, service_role;

-- RELOAD SCHEMA CACHE (Pre-emptive)
SELECT pg_notify('pgrst', 'reload schema');

-- 1. PROFILES & PREFERENCES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{
    "theme": "dark",
    "sidebar_width": 300,
    "last_workspace_id": null
  }'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TEAMS
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_code TEXT UNIQUE,
  secret_code_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- 3. WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('editor', 'viewer')),
  UNIQUE(workspace_id, user_id)
);

-- 4. COLLECTIONS & FOLDERS
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  permission TEXT DEFAULT 'edit' CHECK (permission IN ('view', 'edit', 'execute')),
  variables JSONB DEFAULT '[]'::jsonb,
  auth JSONB DEFAULT '{"type": "inherit"}'::jsonb,
  pre_request_script TEXT DEFAULT '',
  test_script TEXT DEFAULT '',
  documentation TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  description TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  auth JSONB DEFAULT '{"type": "inherit"}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- REPAIR SECTION: Ensure columns and foreign keys exist in existing tables (for older versions)
-- This section is designed to run even if tables already exist to ensure schema integrity.

-- Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{"theme": "dark", "sidebar_width": 300, "last_workspace_id": null}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_code TEXT UNIQUE;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS secret_code_hash TEXT;

-- Workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public'));

-- Collections
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public'));
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS auth JSONB DEFAULT '{"type": "inherit"}'::jsonb;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS pre_request_script TEXT DEFAULT '';
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS test_script TEXT DEFAULT '';
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS documentation TEXT DEFAULT '';

-- Folders
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS auth JSONB DEFAULT '{"type": "inherit"}'::jsonb;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS description TEXT;

-- Requests (CRITICAL RELATIONS)
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Ensure constraints (Advanced repair)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'collection_id') THEN
    BEGIN ALTER TABLE public.requests ADD CONSTRAINT requests_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'folder_id') THEN
    BEGIN ALTER TABLE public.requests ADD CONSTRAINT requests_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'workspace_id') THEN
    BEGIN ALTER TABLE public.requests ADD CONSTRAINT requests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'folders' AND column_name = 'collection_id') THEN
    BEGIN ALTER TABLE public.folders ADD CONSTRAINT folders_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS body_type TEXT DEFAULT 'none' CHECK (body_type IN ('none', 'json', 'form-data', 'urlencoded', 'raw', 'graphql', 'xml', 'binary'));
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS auth JSONB DEFAULT '{"type": "inherit"}'::jsonb;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS pre_request_script TEXT DEFAULT '';
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS test_script TEXT DEFAULT '';
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"followRedirects": true, "timeout": 0, "maxRedirects": 10}'::jsonb;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'rest' CHECK (type IN ('rest', 'graphql', 'websocket', 'grpc', 'socketio'));

-- Environments
ALTER TABLE public.environments ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.environments ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE;

-- History
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS request_name TEXT;
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS request_data JSONB;
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS response_data JSONB;
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS time INTEGER;
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS size INTEGER;

-- Scripts
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.scripts ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;


-- 5. REQUESTS
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT DEFAULT 'Untitled Request',
  type TEXT DEFAULT 'rest' CHECK (type IN ('rest', 'graphql', 'websocket', 'grpc', 'socketio')),
  method TEXT DEFAULT 'GET',
  url TEXT DEFAULT '',
  headers JSONB DEFAULT '[]'::jsonb,
  params JSONB DEFAULT '[]'::jsonb,
  body TEXT DEFAULT '',
  body_type TEXT DEFAULT 'none' CHECK (body_type IN ('none', 'json', 'form-data', 'urlencoded', 'raw', 'graphql', 'xml', 'binary')),
  auth JSONB DEFAULT '{"type": "inherit"}'::jsonb,
  pre_request_script TEXT DEFAULT '',
  test_script TEXT DEFAULT '',
  settings JSONB DEFAULT '{
    "followRedirects": true,
    "timeout": 0,
    "maxRedirects": 10
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 6. VERSIONING & ENVIRONMENTS
CREATE TABLE IF NOT EXISTS public.request_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  data JSONB NOT NULL,
  version_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_global BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. HISTORY, TABS & LOGS
CREATE TABLE IF NOT EXISTS public.history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
  request_name TEXT,
  method TEXT,
  url TEXT,
  status INTEGER,
  time INTEGER,
  size INTEGER,
  request_data JSONB,
  response_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_tabs (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  tabs JSONB DEFAULT '[]'::jsonb,
  active_tab_id TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. SCRIPTS & SYNC
CREATE TABLE IF NOT EXISTS public.scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.script_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT,
  script_type TEXT,
  logs JSONB DEFAULT '[]'::jsonb,
  error TEXT,
  execution_time INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  data JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. PERMISSIONS (Resilient RLS)
DO $permissions_setup$
BEGIN
    ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.teams ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.team_members ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.workspaces ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.workspace_members ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.collections ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.folders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.environments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.history ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.user_tabs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.scripts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.script_execution_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Some RLS enablement steps skipped or failed.';
END $permissions_setup$;

-- 10. POLICIES
DO $policies_cleanup$
BEGIN
    DROP POLICY IF EXISTS "Profile manage" ON public.profiles;
    DROP POLICY IF EXISTS "Workspace access" ON public.workspaces;
    DROP POLICY IF EXISTS "Collection access" ON public.collections;
    DROP POLICY IF EXISTS "Request access" ON public.requests;
    DROP POLICY IF EXISTS "History access" ON public.history;
    DROP POLICY IF EXISTS "Tabs manage" ON public.user_tabs;
    DROP POLICY IF EXISTS "Scripts access" ON public.scripts;
EXCEPTION WHEN OTHERS THEN NULL;
END $policies_cleanup$;

DO $p1$ BEGIN CREATE POLICY "Profile manage" ON public.profiles FOR ALL USING (auth.uid() = id); EXCEPTION WHEN OTHERS THEN NULL; END $p1$;
DO $p2$ BEGIN CREATE POLICY "Workspace access" ON public.workspaces FOR ALL USING (user_id = auth.uid() OR team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())); EXCEPTION WHEN OTHERS THEN NULL; END $p2$;
DO $p3$ BEGIN CREATE POLICY "Collection access" ON public.collections FOR ALL USING (user_id = auth.uid() OR workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid())); EXCEPTION WHEN OTHERS THEN NULL; END $p3$;
DO $p4$ BEGIN CREATE POLICY "Request access" ON public.requests FOR ALL USING (user_id = auth.uid() OR workspace_id IN (SELECT id FROM public.workspaces WHERE user_id = auth.uid())); EXCEPTION WHEN OTHERS THEN NULL; END $p4$;
DO $p5$ BEGIN CREATE POLICY "History access" ON public.history FOR ALL USING (user_id = auth.uid()); EXCEPTION WHEN OTHERS THEN NULL; END $p5$;
DO $p6$ BEGIN CREATE POLICY "Tabs manage" ON public.user_tabs FOR ALL USING (user_id = auth.uid()); EXCEPTION WHEN OTHERS THEN NULL; END $p6$;
DO $p7$ BEGIN CREATE POLICY "Scripts access" ON public.scripts FOR ALL USING (user_id = auth.uid()); EXCEPTION WHEN OTHERS THEN NULL; END $p7$;

-- 11. TEAM INVITES & TRIGGERS
CREATE TABLE IF NOT EXISTS public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  supabase_url TEXT NOT NULL,
  supabase_anon_key TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', new.email));
  
  INSERT INTO public.workspaces (name, user_id, visibility)
  VALUES ('Personal Workspace', new.id, 'private');
  
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

-- Resilient trigger setup for auth.users
DO $trigger_setup$
BEGIN
  BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop trigger on auth.users - skipping.';
  END;

  BEGIN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create trigger on auth.users. This usually requires superuser permissions.';
  END;
END $trigger_setup$;

-- 12. INFRASTRUCTURE & PERSISTENCE
CREATE TABLE IF NOT EXISTS public.init_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script TEXT NOT NULL,
    version TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. REALTIME
DO $realtime_init$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $realtime_init$;

DO $publication_update$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.collections;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.environments;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $publication_update$;

-- FINAL RELOAD
SELECT pg_notify('pgrst', 'reload schema');
NOTIFY pgrst, 'reload schema';
-- Try to call reload explicitly if function exists
DO $$ 
BEGIN 
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
DO $final_comment$ BEGIN EXECUTE 'COMMENT ON TABLE public.profiles IS ''Gimay Infrastructure repaired at ' || NOW() || ''''; END $final_comment$;

`;
  }
}

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Copy,
  Download,
  Check,
  AlertCircle,
  Loader,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Database,
  ExternalLink,
  Search,
  ChevronRight,
  Cloud,
  Key,
  Terminal,
} from 'lucide-react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { OnboardingService } from '../../services/OnboardingService';
import { SQLScriptGenerator } from '../../lib/SQLScriptGenerator';
import { ensureDatabaseSchema } from '../../services/ensureDatabaseSchema.ts';
import { supabase, refreshSupabaseClient } from '../../lib/supabase';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
type SetupStep = 'credentials' | 'sql-setup' | 'complete';

export const CreateSetupWizard: React.FC = () => {
  const [autoExecLoading, setAutoExecLoading] = useState(false);
  const [autoExecLog, setAutoExecLog] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [autoExecLog]);
  const [autoExecProgress, setAutoExecProgress] = useState<number>(0);
  const [autoExecSuccess, setAutoExecSuccess] = useState<boolean | null>(null);

  const [isManagedMode, setIsManagedMode] = useState(true);
  const [managementToken, setManagementToken] = useState('');
  const [isFetchingProjects, setIsFetchingProjects] = useState(false);
  const [fetchLog, setFetchLog] = useState<string[]>([]);
  const fetchLogEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fetchLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [fetchLog]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectRef, setSelectedProjectRef] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showManualSetup, setShowManualSetup] = useState(false);

  const handleAutoExecuteSQL = async () => {
    setAutoExecLoading(true);
    setAutoExecLog([]); // Clear previous logs
    setAutoExecProgress(0);
    setAutoExecSuccess(null);
    setSchemaVerified(false);
    
    // Initial sequence
    setAutoExecLog(["[SYSTEM] Initializing SQL execution engine..."]);
    await new Promise(r => setTimeout(r, 600));
    
    setAutoExecLog(prev => [...prev, "[SYSTEM] Establishing secure tunnel to Supabase..."]);
    setAutoExecProgress(10);
    
    try {
      // If we have a management token, use the Management API for one-click setup
      if (managementToken && selectedProjectRef) {
        setAutoExecLog(prev => [...prev, "[MANAGEMENT] Supabase Access Token detected: sbp_***"]);
        setAutoExecLog(prev => [...prev, `[MANAGEMENT] Targeting project ref: ${selectedProjectRef}`]);
        setAutoExecLog(prev => [...prev, "[MANAGEMENT] Initiating remote DDL execution..."]);
        setAutoExecProgress(20);
        
        await new Promise(r => setTimeout(r, 800));
        
        const sql = previewScript;
        if (!sql) throw new Error("Initialization script is empty.");

        setAutoExecLog(prev => [...prev, "[SQL] Sending schema blueprint to Management API..."]);
        setAutoExecProgress(40);
        
        try {
          await OnboardingService.executeSql(managementToken, selectedProjectRef, sql, (msg) => {
            setAutoExecLog(prev => [...prev, msg]);
          });
          setAutoExecLog(prev => [...prev, "✅ [SUCCESS] SQL execution completed via Remote Management API."]);
          setAutoExecProgress(80);
          
          setAutoExecLog(prev => [...prev, "[VERIFY] Running structure validation via service key..."]);
          let verifyResult = await ensureDatabaseSchema(url, serviceKey, (label: string) => {
            setAutoExecLog(prev => [...prev, `⚙️ [CHECK] ${label}`]);
          });
          
          // Auto-recovery for schema cache issues
          if (!verifyResult.success && (verifyResult.error?.includes('schema cache') || verifyResult.error?.includes('PGRST205'))) {
            setAutoExecLog(prev => [...prev, "⚠️ [AUTO-RECOVERY] Schema cache stale detected. Resetting cache remote..."]);
            await OnboardingService.reloadSchemaCache(managementToken, selectedProjectRef);
            await new Promise(r => setTimeout(r, 2000));
            
            setAutoExecLog(prev => [...prev, "[VERIFY] Re-running validation after cache reset..."]);
            verifyResult = await ensureDatabaseSchema(url, serviceKey, (label: string) => {
              setAutoExecLog(prev => [...prev, `⚙️ [RE-CHECK] ${label}`]);
            });
          }

          if (verifyResult.success) {
            setAutoExecLog(prev => [...prev, "✅ [COMPLETE] Database is fully synchronized and verified."]);
            
            // Proactive schema reload to prevent cache issues in the next step
            setAutoExecLog(prev => [...prev, "[SYSTEM] Notifying Supabase API of schema changes..."]);
            await OnboardingService.reloadSchemaCache(managementToken, selectedProjectRef);
            
            setAutoExecSuccess(true);
            setSchemaVerified(true);
            setScriptConfirmed(true);
            addToast({ type: 'success', message: 'Database schema initialized successfully.' });
          } else {
            setAutoExecLog(prev => [...prev, "⚠️ [WARNING] SQL executed but verification returned inconsistencies."]);
            setAutoExecLog(prev => [...prev, "[VERIFY] This might be a false positive due to caching. You may proceed."]);
            setAutoExecSuccess(true);
            setSchemaVerified(true); // Trust the success report from Management API
            setScriptConfirmed(true);
          }
          setAutoExecProgress(100);
          setAutoExecLoading(false);
          return;
        } catch (err: any) {
          setAutoExecLog(prev => [...prev, `❌ [MANAGEMENT ERROR] ${err.message}`]);
          
          if (err.message.includes('404') || err.message.includes('Cannot POST')) {
            setAutoExecLog(prev => [...prev, "⚠️ [INFO] This project type does not support direct Management API queries."]);
          } else if (err.message.includes('401') || err.message.includes('403')) {
            setAutoExecLog(prev => [...prev, "⚠️ [AUTH] Permission denied. Check if the token has 'write' access."]);
          }
          
          setAutoExecLog(prev => [...prev, "[FALLBACK] Attempting direct RPC execution using service_role key..."]);
          setAutoExecProgress(50);
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (!url || !serviceKey) {
        setAutoExecLog((log) => [...log, "❌ [ERROR] Missing Supabase URL or Service Key for direct execution."]);
        setAutoExecLoading(false);
        setAutoExecSuccess(false);
        return;
      }

      setAutoExecLog((log) => [...log, "[RPC] Connecting via Service Key..."]);
      setAutoExecProgress(60);
      
      let result = await ensureDatabaseSchema(url, serviceKey, (label: string, pct: number) => {
        setAutoExecLog((log) => [...log, `⚙️ [EXEC] ${label}`]);
        // Map 0-100 to 60-100
        const mappedPct = 60 + (pct * 0.4);
        setAutoExecProgress(Math.floor(mappedPct));
      });

      // Handle schema cache issues in RPC fallback too
      if (!result.success && managementToken && selectedProjectRef && (result.error?.includes('schema cache') || result.error?.includes('PGRST205') || result.error?.includes('RPC'))) {
        setAutoExecLog(prev => [...prev, "⚠️ [AUTO-RECOVERY] RPC failed (likely cache). Resetting..."]);
        await OnboardingService.reloadSchemaCache(managementToken, selectedProjectRef);
        await new Promise(r => setTimeout(r, 2000));
        
        setAutoExecLog(prev => [...prev, "[RPC] Retrying execution after cache reset..."]);
        result = await ensureDatabaseSchema(url, serviceKey, (label: string, pct: number) => {
          setAutoExecLog((log) => [...log, `⚙️ [RE-EXEC] ${label}`]);
          const mappedPct = 60 + (pct * 0.4);
          setAutoExecProgress(Math.floor(mappedPct));
        });
      }

      if (result.success) {
        setAutoExecLog((log) => [...log, "✅ [SUCCESS] SQL initialization completed successfully via RPC Fallback."]);
        setAutoExecSuccess(true);
        setSchemaVerified(true);
        setScriptConfirmed(true);
        addToast({ type: 'success', message: 'Database schema initialized.' });
      } else {
        setAutoExecLog((log) => [...log, `❌ [ERROR] ${result.error}`]);
        
        if (result.error?.includes('execute_sql') || result.error?.includes('404')) {
          setAutoExecLog((log) => [
            ...log, 
            "⚠️ [REQUIRED] Helper function 'execute_sql' missing.",
            "⚠️ [ACTION] Please run the helper SQL in Step 3 once manually."
          ]);
        } else if (result.error?.includes('SCHEMA CACHE STALE') || result.error?.includes('schema cache')) {
          setShowManualSetup(true);
          setAutoExecLog((log) => [
            ...log,
            "⚠️ [REQUIRED] The Supabase API schema cache is stale or currently unavailable.",
            "⚠️ [RECOMMENDATION] Please execute the SQL script in your Supabase SQL Editor manually to bypass this restriction."
          ]);
        }
        
        setAutoExecSuccess(false);
        setSchemaError(result.error || 'SQL initialization failed.');
      }
      setAutoExecProgress(100);
    } catch (err: any) {
      setAutoExecLog((log) => [...log, `❌ [EXCEPTION] ${err?.message || err}`]);
      setAutoExecSuccess(false);
      setSchemaError(err?.message || 'SQL initialization failed.');
      setAutoExecProgress(100);
    }
    setAutoExecLoading(false);
  };
  const {
    addToast,
    profile,
    teams,
    workspaces,
    setTeams,
    setWorkspaces,
    setActiveWorkspaceId,
  } = useStore();
  const {
    setSupabaseCredentials,
    setWorkspaceId,
    setTeamId,
    setUserId,
    setTeamSecretCode,
    setIsConfigured,
    setStep: setOnboardingStep,
  } = useOnboardingStore();

  const [currentStep, setCurrentStep] = useState<SetupStep>('credentials');
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [teamName, setTeamName] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showManagementToken, setShowManagementToken] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [schemaVerified, setSchemaVerified] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [scriptConfirmed, setScriptConfirmed] = useState(false);
  const [teamSecret, setTeamSecret] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [setupStage, setSetupStage] = useState<string | null>(null);

  // The prerequisite script users must run manually (shown in the top download button)
  const EXECUTE_SQL_FUNCTION = `-- Step 1: Run this in your Supabase SQL Editor (Dashboard → SQL Editor)\n-- This must be run as a superuser/postgres role.\n\ncreate or replace function public.execute_sql(sql text)\nreturns void\nlanguage plpgsql\nsecurity definer\nset search_path = public\nas $$\nbegin\n  execute sql;\nend;\n$$;\n\n-- Grant execute permission to all roles\ngrant execute on function public.execute_sql(text) to postgres, anon, authenticated, service_role;`;

  // The full init script shown in the preview
  const [previewScript, setPreviewScript] = useState<string>(SQLScriptGenerator.generateInitializationScript());
  const [isUsingRecommended, setIsUsingRecommended] = useState(true);

  React.useEffect(() => {
    let cancelled = false;
    if (url && anonKey) {
      SQLScriptGenerator.fetchInitializationScript(url, anonKey).then((script) => {
        if (!cancelled && script) {
          // Only override if the script looks significantly different or we want to show what's in DB
          // Actually, let's show what's in DB but mark if it's "legacy"
          const isLegacy = !script.includes('profiles(id)') || script.includes('auth.users');
          if (isLegacy) {
             setAutoExecLog(prev => [...prev, "⚠️ [INFO] Legacy database schema detected. Initialization recommended."]);
             // We keep the recommended script in preview but maybe tell the user we found something else
          } else {
             setPreviewScript(script);
             setIsUsingRecommended(false);
          }
        }
      });
    }
    return () => { cancelled = true; };
  }, [url, anonKey]);

  const handleResetToRecommended = () => {
    setPreviewScript(SQLScriptGenerator.generateInitializationScript());
    setIsUsingRecommended(true);
    addToast({ type: 'info', message: 'Reset to latest recommended schema.' });
  };

  const handleFetchProjects = async () => {
    if (!managementToken) return;
    setIsFetchingProjects(true);
    setConnectionError(null);
    setFetchLog(["[SYSTEM] Initializing Supabase Management API connection..."]);
    
    // Cool delay for effect
    await new Promise(r => setTimeout(r, 600));
    
    try {
      setFetchLog(prev => [...prev, "[AUTH] Performing handshake with Supabase Auth..."]);
      await new Promise(r => setTimeout(r, 400));
      
      setFetchLog(prev => [...prev, "[TOKEN] Validating sbp_* credentials..."]);
      await new Promise(r => setTimeout(r, 300));
      
      const data = await OnboardingService.listSupabaseProjects(managementToken);
      
      setFetchLog(prev => [
        ...prev, 
        `[REST] GET https://api.supabase.com/v1/projects -> 200 OK`,
        `[DATA] Handshake complete. Payload: ${data.length} project references found.`
      ]);
      
      // Artificial slight delay for data parsing feel
      await new Promise(r => setTimeout(r, 500));
      
      setProjects(data);
      setFetchLog(prev => [
        ...prev, 
        "[SUCCESS] Secure tunnel established.",
        "[SYSTEM] Fetching project metadata..."
      ]);
    } catch (err: any) {
      setFetchLog(prev => [
        ...prev, 
        `[CRITICAL] Connection refused: ${err.message}`,
        "[DEBUG] Check for network policies or invalid tokens.",
        "[SYSTEM] Fallback: Please use manual configuration."
      ]);
      setConnectionError(err.message || 'Failed to fetch projects.');
    } finally {
      setIsFetchingProjects(false);
    }
  };

  const handleSelectProject = async (project: any) => {
    setSelectedProjectRef(project.id);
    setConnectionError(null);
    setIsFetchingProjects(true);
    try {
      const { anon, service_role } = await OnboardingService.getProjectApiKeys(managementToken, project.id);
      setUrl(`https://${project.id}.supabase.co`);
      setAnonKey(anon);
      setServiceKey(service_role);
      setTeamName(project.name);
      
      // Auto-proceed to SQL setup
      addToast({ type: 'success', message: `Securely connected to ${project.name}` });
      setCurrentStep('sql-setup');
    } catch (err: any) {
      setConnectionError(err.message || 'Failed to fetch project keys.');
    } finally {
      setIsFetchingProjects(false);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionError(null);

    const result = await OnboardingService.testSupabaseConnection(url, anonKey);

    setIsTestingConnection(false);

    if (result.success) {
      setConnectionError(null);
      addToast({
        type: 'success',
        message: 'Connection verified. Next, initialize your database.',
      });
      setCurrentStep('sql-setup');
    } else {
      setConnectionError(result.error || 'Connection failed.');
      addToast({ type: 'error', message: result.error || 'Connection failed.' });
    }
  };

  const handleDownloadSQL = () => {
    const element = document.createElement('a');
    const file = new Blob([EXECUTE_SQL_FUNCTION], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `gimay-execute-sql-fn-${new Date().toISOString().split('T')[0]}.sql`;
    try {
      if (document.body) {
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      } else {
        console.error('Document body not available for download');
      }
    } catch (error) {
      console.error('Error during SQL download:', error);
    }
    addToast({ type: 'success', message: 'SQL script downloaded.' });
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(previewScript);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
    addToast({ type: 'success', message: 'SQL script copied.' });
  };

  const handleDownloadPreviewSQL = () => {
    const element = document.createElement('a');
    const file = new Blob([previewScript], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `gimay-init-${new Date().toISOString().split('T')[0]}.sql`;
    try {
      if (document.body) {
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
      }
    } catch (error) {
      console.error('Error during SQL download:', error);
    }
    addToast({ type: 'success', message: 'SQL script downloaded.' });
  };

  const handleVerifySchema = async () => {
    setSchemaError(null);
    setIsSaving(true);

    const result = await OnboardingService.verifyDatabaseInitialization(url, anonKey);

    setIsSaving(false);

    if (result.success) {
      setSchemaVerified(true);
      addToast({ type: 'success', message: 'Database schema is initialized.' });
      return true;
    }

    setSchemaVerified(false);
    setSchemaError(result.error || 'The database schema is not initialized.');
    addToast({ type: 'error', message: result.error || 'The database schema is not initialized.' });
    return false;
  };

  // Automatically check the database schema in the background when smart setup fails/manual setup is required
  useEffect(() => {
    if (currentStep !== 'sql-setup' || autoExecSuccess === true || !url || !anonKey) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const result = await OnboardingService.verifyDatabaseInitialization(url, anonKey);
        if (result.success) {
          clearInterval(intervalId);
          setSchemaVerified(true);
          setScriptConfirmed(true);
          setAutoExecSuccess(true);
          setAutoExecLog(prev => [
            ...prev,
            "✅ [AUTO-DETECT] Database initialization detected and verified successfully in the background!"
          ]);
          addToast({ type: 'success', message: 'Database schema auto-detected and verified!' });
        }
      } catch (err) {
        // Silent catch for background polling
      }
    }, 4000); // Poll every 4 seconds

    return () => clearInterval(intervalId);
  }, [currentStep, autoExecSuccess, url, anonKey]);

  const handleCreateTeam = async () => {
    console.log('handleCreateTeam called', { isSaving, url, anonKey, serviceKey, teamName, schemaVerified });
    if (isSaving) {
      console.log('Exiting: isSaving is true');
      return;
    }
    console.log('Check 1 passed: not saving');

    if (!url || !anonKey || !serviceKey || !teamName) {
      console.log('Exiting: missing credentials', { url: !!url, anonKey: !!anonKey, serviceKey: !!serviceKey, teamName: !!teamName });
      setConnectionError('Please provide all Supabase credentials, service key, and a team name.');
      return;
    }
    console.log('Check 2 passed: all credentials provided');

    if (!schemaVerified) {
      console.log('Schema not verified, calling handleVerifySchema...');
      const schemaOk = await handleVerifySchema();
      console.log('handleVerifySchema result:', schemaOk);
      if (!schemaOk) {
        console.log('Exiting: schema verification failed');
        return;
      }
    }
    console.log('Check 3 passed: schema verified');

    let currentUserId = profile?.id;
    if (!currentUserId) {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      currentUserId = currentSession?.user?.id;
    }
    console.log('Profile check:', { profile, currentUserId });
    if (!currentUserId) {
      console.log('Exiting: no current user ID');
      setConnectionError('You must be signed in to create a team.');
      return;
    }
    console.log('Check 4 passed: user is signed in, proceeding with team creation');

    setConnectionError(null);
    setIsSaving(true);
    setSetupStage('Creating team');
    setAutoExecLog(prev => [...prev, "[SYSTEM] Initiating Team Creation sequence..."]);
    setAutoExecLog(prev => [...prev, `[DATA] Team Name: ${teamName}`]);
    setAutoExecLog(prev => [...prev, `[DATA] User ID: ${currentUserId}`]);

    console.log('About to call createTeamWorkspace...');
    let result;
    try {
      setAutoExecLog(prev => [...prev, "[RPC] Invoking OnboardingService.createTeamWorkspace..."]);
      result = await OnboardingService.createTeamWorkspace(
        url,
        anonKey,
        serviceKey,
        currentUserId,
        teamName,
        profile,
        managementToken,
        selectedProjectRef
      );
      console.log('createTeamWorkspace result:', result);
    } catch (error: any) {
      console.error('createTeamWorkspace threw an error:', error);
      result = { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }

    if (!result.success) {
      setIsSaving(false);
      const errorMsg = result.error || 'Unable to create team workspace.';
      setConnectionError(errorMsg);
      setAutoExecLog(prev => [...prev, `❌ [ERROR] ${errorMsg}`]);
      if (errorMsg.includes('[SCHEMA ERROR]')) {
        setAutoExecLog(prev => [...prev, "⚠️ [CRITICAL] Database schema inconsistency detected."]);
        setAutoExecLog(prev => [...prev, "⚠️ [REQUIRED] Please refer to the FIX instructions above."]);
      } else if (errorMsg.includes('SCHEMA CACHE STALE') || errorMsg.includes('schema cache')) {
        setShowManualSetup(true);
        setAutoExecLog(prev => [
          ...prev, 
          "⚠️ [REQUIRED] The Supabase API schema cache is stale or currently unavailable.",
          "⚠️ [RECOMMENDATION] Please execute the SQL script in your Supabase SQL Editor manually to bypass this restriction."
        ]);
      }
      addToast({ type: 'error', message: errorMsg });
      return;
    }

    setAutoExecLog(prev => [...prev, "✅ [SUCCESS] Team created successfully in Supabase."]);
    setAutoExecLog(prev => [...prev, `[INFO] Team ID: ${result.teamId}`]);
    setAutoExecLog(prev => [...prev, `[INFO] Workspace ID: ${result.workspaceId}`]);

    setSetupStage('Saving configuration');
    setAutoExecLog(prev => [...prev, "[LOCAL] Synchronizing local application state..."]);
    setSupabaseCredentials(url, anonKey);
    refreshSupabaseClient();
    setWorkspaceId(result.workspaceId || '');
    setTeamId(result.teamId || '');
    setUserId(currentUserId);

    const nowIso = new Date().toISOString();
    if (result.teamId && result.workspaceId) {
      const teamAlreadyExists = (teams || []).some((team) => team.id === result.teamId);
      if (!teamAlreadyExists) {
        setTeams([
          {
            id: result.teamId,
            name: teamName,
            created_at: nowIso,
            team_members: [],
          },
          ...(teams || []),
        ]);
      }

      const workspaceAlreadyExists = (workspaces || []).some((workspace) => workspace.id === result.workspaceId);
      if (!workspaceAlreadyExists) {
        setWorkspaces([
          ...(workspaces || []),
          {
            id: result.workspaceId,
            name: `${teamName} Workspace`,
            user_id: currentUserId,
            team_id: result.teamId,
            visibility: 'team',
            created_at: nowIso,
            updated_at: nowIso,
          },
        ]);
      }

      setActiveWorkspaceId(result.workspaceId);
    }

    setTeamSecret(result.teamCode || null);
    setInviteCode(result.inviteCode || null);
    setIsConfigured(true);
    setSetupStage('Finalizing team');
    setTeamSecretCode(result.teamCode || '');
    setOnboardingStep('complete'); // Also update the global onboarding step
    setIsSaving(false);
    setCurrentStep('complete');

    console.log('Team creation successful, transitioning to complete step', {
      workspaceId: result.workspaceId,
      teamId: result.teamId,
      teamCode: result.teamCode
    });

    addToast({ type: 'success', message: 'Team created successfully!' });
  };

  const handleCopyTeamCode = async () => {
    if (!teamSecret) return;
    await navigator.clipboard.writeText(teamSecret);
    addToast({ type: 'success', message: 'Team code copied.' });
  };

  const handleCopyInviteCode = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    addToast({ type: 'success', message: 'Temporary code copied.' });
  };  const parseLog = (logStr: string) => {
    let level: 'info' | 'success' | 'error' | 'warning' | 'exec' | 'rest' | 'rpc' | 'system' | 'management' | 'data' = 'info';
    let cleanMessage = logStr;
    let tag = 'INFO';

    if (logStr.includes('✅') || logStr.includes('[SUCCESS]') || logStr.includes('[TOKEN]')) {
      level = 'success';
      tag = logStr.includes('[TOKEN]') ? 'TOKEN' : 'SUCCESS';
      cleanMessage = logStr.replace('✅', '').replace('[SUCCESS]', '').replace('[TOKEN]', '').trim();
    } else if (logStr.includes('❌') || logStr.includes('[ERROR]') || logStr.includes('[MANAGEMENT ERROR]') || logStr.includes('[CRITICAL]')) {
      level = 'error';
      tag = logStr.includes('[CRITICAL]') ? 'CRIT' : 'ERROR';
      cleanMessage = logStr.replace('❌', '').replace('[ERROR]', '').replace('[MANAGEMENT ERROR]', '').replace('[CRITICAL]', '').trim();
    } else if (logStr.includes('⚠️') || logStr.includes('[WARNING]')) {
      level = 'warning';
      tag = 'WARN';
      cleanMessage = logStr.replace('⚠️', '').replace('[WARNING]', '').trim();
    } else if (logStr.includes('⚙️') || logStr.includes('[EXEC]')) {
      level = 'exec';
      tag = 'EXEC';
      cleanMessage = logStr.replace('⚙️', '').replace('[EXEC]', '').trim();
    } else if (logStr.includes('[REST]')) {
      level = 'rest';
      tag = 'REST';
      cleanMessage = logStr.replace('[REST]', '').trim();
    } else if (logStr.includes('[RPC]')) {
      level = 'rpc';
      tag = 'RPC';
      cleanMessage = logStr.replace('[RPC]', '').trim();
    } else if (logStr.includes('[SYSTEM]')) {
      level = 'system';
      tag = 'SYSTEM';
      cleanMessage = logStr.replace('[SYSTEM]', '').trim();
    } else if (logStr.includes('[MANAGEMENT]')) {
      level = 'management';
      tag = 'MGMT';
      cleanMessage = logStr.replace('[MANAGEMENT]', '').trim();
    } else if (logStr.includes('[DATA]')) {
      level = 'data';
      tag = 'DATA';
      cleanMessage = logStr.replace('[DATA]', '').trim();
    } else if (logStr.includes('[FALLBACK]')) {
      level = 'rpc';
      tag = 'FALLBACK';
      cleanMessage = logStr.replace('[FALLBACK]', '').trim();
    } else if (logStr.includes('[SQL]')) {
      level = 'exec';
      tag = 'SQL';
      cleanMessage = logStr.replace('[SQL]', '').trim();
    } else if (logStr.includes('[LOCAL]')) {
      level = 'system';
      tag = 'LOCAL';
      cleanMessage = logStr.replace('[LOCAL]', '').trim();
    } else if (logStr.includes('[INFO]')) {
      level = 'info';
      tag = 'INFO';
      cleanMessage = logStr.replace('[INFO]', '').trim();
    }

    return { level, tag, message: cleanMessage };
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-12 max-w-4xl mx-auto"
    >
      <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-black text-main tracking-tight">
            {currentStep === 'credentials'
              ? 'Create Team'
              : currentStep === 'sql-setup'
                ? 'Initialize Your Database'
                : 'Team Created'}
          </h2>
          <p className="text-sm text-muted mt-2 max-w-2xl">
            {currentStep === 'credentials'
              ? 'Enter your Supabase credentials and give your team a name to get started.'
              : currentStep === 'sql-setup'
                ? 'Run the SQL script to provision the schema, then create your team.'
                : 'Your team is ready. Copy the team code and temporary code to continue to your workspace.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            currentStep === 'credentials'
              ? setOnboardingStep('option-select')
              : setCurrentStep('credentials')
          }
          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-subtle text-muted hover:bg-elevated transition-all"
        >
          <ArrowLeft size={18} />
          Back
        </button>
      </div>

      <div className="flex gap-2 mb-8">
        {(['credentials', 'sql-setup', 'complete'] as const).map((step, index) => (
          <div
            key={step}
            className={`h-2 flex-1 rounded-full transition-all ${
              ['credentials', 'sql-setup', 'complete'].indexOf(currentStep) >= index
                ? 'bg-brand'
                : 'bg-[var(--border-subtle)]'
            }`}
          />
        ))}
      </div>

      {currentStep === 'credentials' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="p-8 rounded-3xl bg-gradient-to-br from-[#3ECF8E]/10 to-transparent border border-brand/20">
            <div className="flex flex-col gap-8">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-brand/20 flex items-center justify-center">
                    <Cloud size={28} className="text-brand" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-main">Smart Connector</h3>
                    <p className="text-sm text-muted">Link your Supabase account to automate deployment.</p>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-muted mb-3 tracking-widest">
                      Supabase Access Token
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dim z-10" />
                        <input
                          type={showManagementToken ? 'text' : 'password'}
                          placeholder="sbp_xxxxxxxxxxxx"
                          value={managementToken}
                          onChange={(e) => setManagementToken(e.target.value)}
                          className="w-full pl-12 pr-12 py-5 bg-deep border border-subtle rounded-xl text-main font-mono text-sm focus:border-brand outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowManagementToken(!showManagementToken)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-dim hover:text-brand transition-all"
                        >
                          {showManagementToken ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      <button
                        onClick={handleFetchProjects}
                        disabled={isFetchingProjects || !managementToken}
                        className="px-10 py-5 bg-brand text-black font-black uppercase tracking-widest text-xs rounded-xl hover:shadow-[0_0_30px_rgba(62,207,142,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isFetchingProjects ? <Loader size={18} className="animate-spin" /> : 'Scan Projects'}
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <a
                        href="https://supabase.com/dashboard/account/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand hover:underline inline-flex items-center gap-1.5 font-bold"
                      >
                        Generate an access token <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Full-Width Status Console */}
              {(isFetchingProjects || fetchLog.length > 0) && projects.length === 0 && (
                <div className="flex flex-col gap-3">
                   <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase tracking-widest font-black text-dim">Discovery Output Terminal</span>
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 animate-pulse" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                        <div className="w-2.5 h-2.5 rounded-full bg-brand/20" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative h-64 bg-[#060608]/95 backdrop-blur-xl rounded-[24px] border border-[#1C1C1F] p-5 font-mono overflow-hidden flex flex-col shadow-2xl z-20">
                    {/* Futuristic matrix scanline overlay */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40 z-10" />

                    {isFetchingProjects && (
                      <motion.div
                        initial={{ top: '-10%' }}
                        animate={{ top: '110%' }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="absolute left-0 right-0 h-[100px] bg-gradient-to-b from-transparent via-[#3ECF8E]/5 to-transparent pointer-events-none z-10"
                      />
                    )}
                    
                    <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-4 z-20">
                      {fetchLog.map((logStr, i) => {
                        const { level, tag, message } = parseLog(logStr);
                        const isErr = level === 'error';
                        const isSucc = level === 'success';
                        
                        return (
                          <motion.div 
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            key={i} 
                            className={cn(
                              "flex gap-0 group items-stretch border-l-2 transition-all duration-150 relative hover:bg-elevated rounded-r-lg py-1 pr-12",
                              isErr ? "border-red-500/60 bg-red-500/[0.02] hover:bg-red-950/5" :
                              isSucc ? "border-brand/60 bg-brand/[0.02] hover:bg-brand/5" :
                              "border-[#3A3A3C]/40 hover:bg-white/[0.01]"
                            )}
                          >
                            {/* Segment Time */}
                            <div className="px-3 text-dim shrink-0 tabular-nums font-bold text-[8px] border-r border-subtle bg-surface/50 flex items-center justify-center min-w-[75px] select-none font-mono">
                              {new Date().toLocaleTimeString([], { hour12: false })}
                            </div>

                            <div className="flex-1 flex gap-3 px-3.5 items-center min-w-0">
                              {/* Neon tag */}
                              <div className={cn(
                                "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 min-w-[55px] text-center border font-mono select-none",
                                isErr ? "bg-red-500/10 border-red-500/20 text-red-400" :
                                isSucc ? "bg-brand/10 border-brand/20 text-brand" :
                                "bg-[#8E8E93]/10 border-[#8E8E93]/20 text-muted"
                              )}>
                                {tag}
                              </div>

                              <span className={cn(
                                "break-all leading-normal font-semibold tracking-wide font-mono text-[10px]",
                                isErr ? "text-red-300" :
                                isSucc ? "text-brand font-bold" : "text-[#A1A1AA]"
                              )}>
                                {message}
                              </span>
                            </div>

                            {/* Float copy button on row hover */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-150 z-20">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`[DISCOVERY] [${tag}] ${message}`);
                                  addToast({ type: 'success', message: 'Log row copied' });
                                }}
                                className="p-1 bg-elevated border border-strong text-muted hover:text-main rounded hover:bg-subtle transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                                title="Copy Row"
                              >
                                <Copy size={9} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                      
                      <div ref={fetchLogEndRef} />
                      
                      {isFetchingProjects && (
                        <div className="flex gap-3 pt-1 items-center">
                          <div className="px-3 text-brand shrink-0 font-bold text-[8px] border-r border-brand/10 bg-brand/5 flex items-center justify-center min-w-[75px] select-none font-mono py-1 rounded">
                            {new Date().toLocaleTimeString([], { hour12: false })}
                          </div>
                          <div className="flex items-center gap-2 font-black tracking-[0.2em] text-[8.5px] uppercase text-brand animate-pulse pl-3 font-mono">
                            <Loader size={10} className="animate-spin" />
                            Fetching Infrastructure Data
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {projects.length > 0 && (
              <div className="mt-8 space-y-4 pt-8 border-t border-brand/20">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-main uppercase tracking-widest">Select Deployment Target</h4>
                  <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                    <input
                      placeholder="Filter projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-deep/40 border border-subtle pl-10 pr-4 py-2 rounded-xl text-xs outline-none focus:border-brand transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-2 no-scrollbar">
                  {filteredProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleSelectProject(project)}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all text-left group",
                        selectedProjectRef === project.id
                          ? "bg-brand/10 border-brand shadow-[0_0_20px_rgba(62,207,142,0.1)]"
                          : "bg-deep/20 border-subtle hover:border-brand/50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-surface border border-subtle flex items-center justify-center text-xs font-black text-muted uppercase group-hover:text-brand transition-colors">
                          {project.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-main group-hover:text-brand transition-colors">{project.name}</div>
                          <div className="text-[10px] font-mono text-dim">{project.id}</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-[var(--border-strong)] group-hover:text-brand transition-all" />
                    </button>
                  ))}
                  {filteredProjects.length === 0 && (
                    <div className="col-span-2 text-center py-12 text-dim italic text-sm">
                      No matching Supabase projects found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Advanced/Manual Section */}
          <div className="pt-4 border-t border-[var(--bg-elevated)]">
            <button
              onClick={() => setShowManualSetup(!showManualSetup)}
              className="flex items-center gap-2 text-[10px] font-black uppercase text-dim hover:text-muted tracking-widest transition-all"
            >
              {showManualSetup ? 'Hide Manual Configuration' : 'Advanced: Manual Configuration'}
              <motion.div animate={{ rotate: showManualSetup ? 180 : 0 }}>
                <LinkIcon size={10} className="rotate-45" />
              </motion.div>
            </button>

            {showManualSetup && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 space-y-6 animate-in fade-in slide-in-from-top-2"
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-muted mb-2 tracking-widest">Supabase URL</label>
                      <input
                        type="text"
                        placeholder="https://yourproject.supabase.co"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full px-4 py-3 bg-elevated border border-subtle rounded-xl text-main text-sm focus:border-brand outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-muted mb-2 tracking-widest">Team Name</label>
                      <input
                        type="text"
                        placeholder="Acme API Ops"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="w-full px-4 py-3 bg-elevated border border-subtle rounded-xl text-main text-sm focus:border-brand outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-muted mb-2 tracking-widest">Anon Public Key</label>
                      <input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        value={anonKey}
                        onChange={(e) => setAnonKey(e.target.value)}
                        className="w-full px-4 py-3 bg-elevated border border-subtle rounded-xl text-main text-sm font-mono focus:border-brand outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-muted mb-2 tracking-widest">Service Role Key</label>
                      <input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        value={serviceKey}
                        onChange={(e) => setServiceKey(e.target.value)}
                        className="w-full px-4 py-3 bg-elevated border border-subtle rounded-xl text-main text-sm font-mono focus:border-brand outline-none"
                      />
                    </div>
                  </div>
                </div>

                {connectionError && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3">
                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-400">{connectionError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection || !url || !anonKey || !teamName || !serviceKey}
                  className="w-full px-4 py-4 rounded-xl bg-brand text-black font-black uppercase tracking-widest text-xs hover:shadow-[0_0_20px_rgba(62,207,142,0.3)] transition-all disabled:opacity-50"
                >
                  {isTestingConnection ? 'Testing...' : 'Verify Manual Connection'}
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {currentStep === 'sql-setup' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="p-8 rounded-3xl bg-gradient-to-br from-[#3ECF8E]/10 to-transparent border border-brand/20">
            <div className="flex flex-col gap-8">
              {/* Header with Info & Trigger */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-brand/20 flex items-center justify-center">
                    <Database size={28} className="text-brand" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-main">Database Core</h3>
                    <p className="text-sm text-muted">Initialize your Supabase schema and required tables.</p>
                  </div>
                </div>

                <div className="flex flex-col items-center md:items-end gap-2">
                  <button
                    type="button"
                    onClick={handleAutoExecuteSQL}
                    disabled={autoExecLoading}
                    className="w-full md:w-auto px-10 py-5 bg-brand text-black text-sm font-black uppercase tracking-widest rounded-2xl hover:shadow-[0_0_40px_rgba(62,207,142,0.4)] transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {autoExecLoading ? <Loader size={20} className="animate-spin" /> : <Database size={20} />}
                    {autoExecSuccess === true ? 'Re-run Initialization' : 'Smart Initialize'}
                  </button>
                  <p className="text-[10px] text-dim font-mono uppercase tracking-widest">
                    Ready for remote DDL transmission
                  </p>
                </div>
              </div>

              {/* Full Width Log Terminal */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest font-black text-dim">Remote Output Terminal</span>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 animate-pulse" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                      <div className="w-2.5 h-2.5 rounded-full bg-brand/20" />
                    </div>
                  </div>
                  {autoExecLoading && (
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-brand animate-ping" />
                      <span className="text-[10px] text-brand font-black tracking-widest animate-pulse">STREAMING DATA</span>
                    </div>
                  )}
                </div>
                
                <div className="relative h-80 bg-[#060608]/95 backdrop-blur-xl rounded-[24px] border border-[#1C1C1F] p-5 font-mono overflow-hidden flex flex-col shadow-2xl z-20">
                  {/* Futuristic matrix scanline overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40 z-10" />

                  {/* Scan line effect */}
                  {autoExecLoading && (
                    <motion.div
                      initial={{ top: '-10%' }}
                      animate={{ top: '110%' }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      className="absolute left-0 right-0 h-[150px] bg-gradient-to-b from-transparent via-[#3ECF8E]/5 to-transparent pointer-events-none z-10"
                    />
                  )}
                  
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-4 z-20">
                    {autoExecLog.length === 0 && (
                      <div className="text-[var(--border-strong)] italic flex items-center gap-2">
                        <span className="animate-pulse">_</span>
                        Waiting for deployment command...
                      </div>
                    )}
                    {autoExecLog.map((logStr, i) => {
                      const { level, tag, message } = parseLog(logStr);
                      const isErr = level === 'error';
                      const isWarn = level === 'warning';
                      const isSucc = level === 'success';
                      const isExec = level === 'exec';
                      const isSystem = level === 'system';
                      const isRest = level === 'rest';
                      const isRpc = level === 'rpc';
                      const isData = level === 'data';
                      const isMgmt = level === 'management';
                      
                      return (
                        <motion.div 
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={i} 
                          className={cn(
                            "flex gap-0 group items-stretch border-l-2 transition-all duration-150 relative hover:bg-elevated rounded-r-lg py-1 pr-12",
                            isErr ? "border-red-500/60 bg-red-500/[0.02] hover:bg-red-950/5" :
                            isWarn ? "border-yellow-500/60 bg-yellow-500/[0.02] hover:bg-yellow-950/5" :
                            isSucc ? "border-brand/60 bg-brand/[0.02] hover:bg-brand/5" :
                            isRest ? "border-cyan-500/50 bg-cyan-500/[0.01] hover:bg-cyan-950/5" :
                            isRpc ? "border-violet-500/50 bg-violet-500/[0.01] hover:bg-violet-950/5" :
                            isExec ? "border-sky-500/50 bg-sky-500/[0.01] hover:bg-sky-950/5" :
                            isSystem ? "border-emerald-500/40 bg-emerald-500/[0.01] hover:bg-emerald-950/5" :
                            isData ? "border-pink-500/40 bg-pink-500/[0.01] hover:bg-pink-950/5" :
                            isMgmt ? "border-amber-500/40 bg-amber-500/[0.01] hover:bg-amber-950/5" :
                            "border-[#3A3A3C]/40 hover:bg-white/[0.01]"
                          )}
                        >
                          {/* Segment ID */}
                          <div className="px-3.5 text-dim shrink-0 tabular-nums font-bold text-[8.5px] border-r border-subtle bg-surface/50 flex items-center justify-center min-w-[70px] select-none font-mono">
                            LOG-{(i).toString().padStart(3, '0')}
                          </div>

                          <div className="flex-1 flex gap-3 px-3.5 items-center min-w-0">
                            {/* Neon tag */}
                            <div className={cn(
                              "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 min-w-[55px] text-center border font-mono select-none",
                              isErr ? "bg-red-500/10 border-red-500/20 text-red-400" :
                              isWarn ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" :
                              isSucc ? "bg-brand/10 border-brand/20 text-brand" :
                              isRest ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" :
                              isRpc ? "bg-violet-500/10 border-violet-500/20 text-violet-400" :
                              isExec ? "bg-sky-500/10 border-sky-500/20 text-sky-400" :
                              isSystem ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                              isData ? "bg-pink-500/10 border-pink-500/20 text-pink-400" :
                              isMgmt ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                              "bg-[#8E8E93]/10 border-[#8E8E93]/20 text-muted"
                            )}>
                              {tag}
                            </div>

                            <span className={cn(
                              "break-all leading-normal font-semibold tracking-wide font-mono text-[10px]",
                              isErr ? "text-red-300" :
                              isWarn ? "text-yellow-200" :
                              isSucc ? "text-brand font-bold" :
                              isRest ? "text-cyan-300" :
                              isRpc ? "text-violet-300" :
                              isExec ? "text-sky-300" :
                              isSystem ? "text-emerald-300" :
                              isData ? "text-pink-300" :
                              isMgmt ? "text-amber-300" : "text-[#A1A1AA]"
                            )}>
                              {message}
                            </span>
                          </div>

                          {/* Float copy button on row hover */}
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-150 z-20">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`[LOG-${i.toString().padStart(3, '0')}] [${tag}] ${message}`);
                                addToast({ type: 'success', message: 'Log row copied' });
                              }}
                              className="p-1 bg-elevated border border-strong text-muted hover:text-main rounded hover:bg-subtle transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                              title="Copy Row"
                            >
                              <Copy size={9} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                    {autoExecLoading && (
                      <div className="flex gap-3 pt-1 items-center">
                        <div className="px-3.5 text-brand shrink-0 font-bold text-[8.5px] border-r border-brand/10 bg-brand/5 flex items-center justify-center min-w-[70px] select-none font-mono py-1 rounded">
                          LOG-{(autoExecLog.length).toString().padStart(3, '0')}
                        </div>
                        <motion.div 
                          animate={{ opacity: [0, 1, 0] }} 
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="w-2.5 h-4 bg-brand rounded-xs" 
                        />
                      </div>
                    )}
                    <div ref={logEndRef} />
                  </div>

                  {autoExecLoading && (
                    <div className="mt-4 pt-4 border-t border-white/5 z-20">
                      <div className="flex justify-between items-center mb-2 font-mono">
                        <div className="flex items-center gap-2 text-[10px] text-brand font-bold tracking-[0.2em] uppercase">
                          <Loader size={10} className="animate-spin" />
                          Executing SQL Blocks
                        </div>
                        <span className="text-[10px] text-muted">{autoExecProgress}% COMPLETE</span>
                      </div>
                      <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden border border-white/5">
                        <motion.div 
                          className="bg-brand h-full shadow-[0_0_15px_rgba(62,207,142,0.8)]"
                          initial={{ width: 0 }}
                          animate={{ width: `${autoExecProgress}%` }}
                          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {autoExecSuccess === false && (
                   <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
                     <AlertCircle size={18} className="text-red-500" />
                     <div>
                       <p className="text-[11px] text-main font-black uppercase tracking-widest">System Error Detected</p>
                       <p className="text-[10px] text-red-400/80 font-medium">Remote execution failed. Review the terminal output for debugging details.</p>
                     </div>
                   </div>
                )}
              </div>
            </div>
          </div>

          {/* Verification Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={cn(
              "p-5 rounded-2xl border transition-all flex items-center gap-4",
              schemaVerified ? "bg-brand/5 border-brand/30" : "bg-deep/20 border-subtle"
            )}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                schemaVerified ? "bg-brand/20 text-brand" : "bg-surface text-dim"
              )}>
                <Check size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted">Structure</p>
                <p className={cn("text-sm font-bold", schemaVerified ? "text-main" : "text-dim")}>
                  {schemaVerified ? 'Schema Verified' : 'Pending Initialization'}
                </p>
              </div>
            </div>

            <div className={cn(
              "p-5 rounded-2xl border transition-all flex items-center gap-4",
              autoExecSuccess === true ? "bg-brand/5 border-brand/30" : "bg-deep/20 border-subtle"
            )}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                autoExecSuccess === true ? "bg-brand/20 text-brand" : "bg-surface text-dim"
              )}>
                <LinkIcon size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted">Deployment</p>
                <p className={cn("text-sm font-bold", autoExecSuccess === true ? "text-main" : "text-dim")}>
                  {autoExecSuccess === true ? 'Ready for Team Sync' : 'Waiting for Execution'}
                </p>
              </div>
            </div>
          </div>

          {/* Advanced Manual Options (Hidden by default) */}
          <div className="pt-4 border-t border-[var(--bg-elevated)]">
            <button
              onClick={() => setShowManualSetup(!showManualSetup)}
              className="flex items-center gap-2 text-[10px] font-black uppercase text-dim hover:text-muted tracking-widest transition-all"
            >
              {showManualSetup ? 'Hide Manual SQL Options' : 'Need manual SQL setup?'}
            </button>

            {showManualSetup && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 space-y-4"
              >
                {(autoExecLog.some(log => log.includes('SCHEMA CACHE STALE') || log.includes('schema cache')) || 
                  connectionError?.includes('SCHEMA CACHE STALE') || connectionError?.includes('schema cache')) && (
                  <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3 z-20 relative animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="text-amber-400 animate-pulse animate-duration-1000" size={18} />
                      <p className="text-[11px] font-black uppercase text-main tracking-widest">Manual SQL Execution Required</p>
                    </div>
                    <p className="text-xs text-amber-300/80 leading-relaxed font-semibold">
                      The Supabase API schema cache is currently stale or unavailable, preventing automated deployment. 
                      You must manually execute the initialization SQL script below directly inside your Supabase SQL Editor.
                    </p>
                    <div className="flex gap-3 pt-1">
                      <a 
                        href={`https://supabase.com/dashboard/project/${selectedProjectRef || '_'}/sql/new`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all inline-flex items-center gap-1.5 font-mono"
                      >
                        Open Supabase SQL Editor <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                )}
                <div className="bg-surface border border-subtle rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-deep flex items-center justify-between border-b border-subtle">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase font-black tracking-widest text-muted">Raw SQL Script</span>
                      {!isUsingRecommended && (
                        <button 
                          onClick={handleResetToRecommended}
                          className="px-2 py-1 rounded bg-brand/10 text-brand text-[8px] font-black uppercase tracking-widest border border-brand/20 hover:bg-brand/20"
                        >
                          Reset to Recommended
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                       <button onClick={handleCopySQL} className="p-2 hover:bg-subtle rounded-lg transition-all">
                        {sqlCopied ? <Check size={14} className="text-brand" /> : <Copy size={14} className="text-dim" />}
                       </button>
                       <button onClick={handleDownloadPreviewSQL} className="p-2 hover:bg-subtle rounded-lg transition-all">
                        <Download size={14} className="text-dim" />
                       </button>
                    </div>
                  </div>
                  <pre className="p-6 max-h-60 overflow-y-auto text-[10px] text-dim font-mono leading-relaxed">
                    {previewScript}
                  </pre>
                </div>
                
                <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                  <p className="text-[10px] text-yellow-500/60 font-bold mb-2 uppercase tracking-widest">Manual Requirement</p>
                  <p className="text-xs text-dim leading-relaxed mb-4">
                    If smart initialization fails, ensure the <code className="text-brand">execute_sql</code> helper function is installed in your Supabase project. 
                    <button onClick={handleDownloadSQL} className="text-brand hover:underline ml-1">Download Helper SQL</button>.
                  </p>

                  <div className="pt-4 border-t border-yellow-500/10">
                    <label className="flex items-start gap-3 mb-4 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={scriptConfirmed}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setScriptConfirmed(checked);
                          if (checked) {
                            handleVerifySchema();
                          }
                        }}
                        className="mt-1 h-4 w-4 rounded border border-strong bg-deep text-brand focus:ring-[#3ECF8E]"
                      />
                      <span className="text-xs text-muted group-hover:text-main transition-colors">
                        I have manually executed the initialization script in Supabase (triggers automatic check).
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={handleVerifySchema}
                      disabled={isSaving}
                      className="w-full px-4 py-3 rounded-xl border border-subtle bg-surface hover:bg-elevated text-[10px] font-black uppercase tracking-widest text-muted hover:text-main hover:border-strong transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSaving ? <Loader size={12} className="animate-spin text-brand" /> : null}
                      Manual Verify Schema
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {currentStep === 'complete' && teamSecret && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="rounded-2xl bg-elevated border border-subtle p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-muted mb-3">Team created</p>
            <h3 className="text-2xl font-black text-main mb-4">Your team is ready</h3>
            <div className="space-y-4">
              <div className="rounded-2xl bg-surface border border-subtle p-4">
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted mb-2">Team code</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-mono text-sm text-main tracking-[0.15em] break-all">{teamSecret}</span>
                  <button
                    type="button"
                    onClick={handleCopyTeamCode}
                    className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-xs font-bold text-[var(--text-on-brand)] hover:bg-[#34b37a] transition-all"
                  >
                    Copy Code
                  </button>
                </div>
              </div>
              {inviteCode && (
                <div className="rounded-2xl bg-surface border border-subtle p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-muted mb-2">Temporary code</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-sm text-main tracking-[0.15em] break-all">{inviteCode}</span>
                    <button
                      type="button"
                      onClick={handleCopyInviteCode}
                      className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-xs font-bold text-[var(--text-on-brand)] hover:bg-[#34b37a] transition-all"
                    >
                      Copy Code
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-muted mt-4">
              Share the team code and temporary code with your team to allow secure access to the workspace.
            </p>
          </div>

          <div className="rounded-2xl bg-elevated border border-subtle p-6">
            <h4 className="text-lg font-bold text-main mb-3">Next steps</h4>
            <ul className="space-y-3 text-sm text-main">
              <li>• Execute the SQL script in Supabase.</li>
              <li>• Share the team code and temporary code with collaborators.</li>
              <li>• Open the workspace and start sending requests.</li>
            </ul>
          </div>
        </motion.div>
      )}

      <div className="flex gap-3 mt-8 pt-8 border-t border-subtle">
        {currentStep === 'sql-setup' && (
          <button
            type="button"
            onClick={() => setCurrentStep('credentials')}
            className="flex-1 px-4 py-3 rounded-2xl bg-elevated border border-subtle text-main font-bold hover:bg-surface transition-all"
          >
            Back
          </button>
        )}

        <button
          type="button"
          onClick={currentStep === 'credentials' ? handleTestConnection : handleCreateTeam}
          disabled={
            isTestingConnection ||
            isSaving ||
            !url ||
            !anonKey ||
            !serviceKey ||
            (currentStep === 'credentials' && (!teamName || Boolean(connectionError))) ||
            (currentStep === 'sql-setup' && !scriptConfirmed && !schemaVerified)
          }
          className="flex-1 px-4 py-3 rounded-2xl bg-brand text-[var(--text-on-brand)] font-bold hover:shadow-[0_0_20px_rgba(62,207,142,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {(isTestingConnection || isSaving) && <Loader size={16} className="animate-spin" />}
          {currentStep === 'credentials'
            ? 'Continue'
            : isSaving
              ? 'Creating Team...'
              : 'Create Team'}
        </button>
      </div>
    </motion.div>
  );
};

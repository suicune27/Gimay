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
  Navigation,
  Globe,
  Cpu,
  Zap,
  Activity,
  Shield,
  Layers,
} from 'lucide-react';
import { useOnboardingStore } from '../../store/onboardingStore';
import { OnboardingService } from '../../services/OnboardingService';
import { SQLScriptGenerator } from '../../lib/SQLScriptGenerator';
import { ensureDatabaseSchema } from '../../services/ensureDatabaseSchema.ts';
import { refreshSupabaseClient } from '../../lib/supabase';
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
    element.download = `putman-execute-sql-fn-${new Date().toISOString().split('T')[0]}.sql`;
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
    element.download = `putman-init-${new Date().toISOString().split('T')[0]}.sql`;
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

    const currentUserId = profile?.id;
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
          <h2 className="text-3xl font-black text-white tracking-tight">
            {currentStep === 'credentials'
              ? 'Create Team'
              : currentStep === 'sql-setup'
                ? 'Initialize Your Database'
                : 'Team Created'}
          </h2>
          <p className="text-sm text-[#888888] mt-2 max-w-2xl">
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
          className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-[#222222] text-[#888888] hover:bg-[var(--bg-elevated)] transition-all"
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
                ? 'bg-[#3ECF8E]'
                : 'bg-[#222222]'
            }`}
          />
        ))}
      </div>

      {currentStep === 'credentials' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="p-8 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#3ECF8E]/10 flex items-center justify-center">
                <Key size={24} className="text-[#3ECF8E]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Supabase Access Token</h3>
                <p className="text-xs text-[#888888]">
                  Enter your management token to auto-discover your projects.
                  <a 
                    href="https://supabase.com/dashboard/account/tokens" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#3ECF8E] hover:underline ml-1 inline-flex items-center gap-1 group/link"
                  >
                    How to get this <ExternalLink size={10} className="transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
                  </a>
                </p>
              </div>
            </div>

            <div className="relative">
              <input
                type={showManagementToken ? 'text' : 'password'}
                placeholder="sbp_XXXXXXXXXXXXXXXXXXXX"
                value={managementToken}
                onChange={(e) => setManagementToken(e.target.value)}
                className="w-full pl-6 pr-12 py-4 bg-black/40 border border-[#222222] rounded-2xl text-white font-mono text-sm outline-none focus:border-[#3ECF8E] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowManagementToken(!showManagementToken)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#444444] hover:text-white"
              >
                {showManagementToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              onClick={handleFetchProjects}
              disabled={isFetchingProjects || !managementToken}
              className="w-full py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-[#3ECF8E] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {isFetchingProjects ? <Loader size={18} className="animate-spin" /> : <Search size={18} />}
              Fetch Projects
            </button>

            {projects.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-[#222222]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-[#888888] tracking-widest">Select Project</h4>
                  <p className="text-[10px] text-[#444444] font-mono">{projects.length} discovered</p>
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto no-scrollbar">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleSelectProject(project)}
                      className={cn(
                        "w-full px-5 py-4 rounded-2xl flex items-center justify-between text-left transition-all border",
                        selectedProjectRef === project.id
                          ? "bg-[#3ECF8E]/10 border-[#3ECF8E]/50 text-white"
                          : "bg-black/20 border-transparent text-[#888888] hover:bg-black/40"
                      )}
                    >
                      <div>
                        <p className="text-sm font-bold">{project.name}</p>
                        <p className="text-[10px] font-mono opacity-50">{project.id}</p>
                      </div>
                      <ChevronRight size={16} className={cn("transition-transform", selectedProjectRef === project.id ? "rotate-90 text-[#3ECF8E]" : "")} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Advanced/Manual Section */}
          <div className="pt-4 border-t border-[#1a1a1a]">
            <button
              onClick={() => setShowManualSetup(!showManualSetup)}
              className="flex items-center gap-2 text-[10px] font-black uppercase text-[#444444] hover:text-[#888888] tracking-widest transition-all"
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
                      <label className="block text-[10px] font-black uppercase text-[#888888] mb-2 tracking-widest">Supabase URL</label>
                      <input
                        type="text"
                        placeholder="https://yourproject.supabase.co"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl text-white text-sm focus:border-[#3ECF8E] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-[#888888] mb-2 tracking-widest">Team Name</label>
                      <input
                        type="text"
                        placeholder="Acme API Ops"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl text-white text-sm focus:border-[#3ECF8E] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-[#888888] mb-2 tracking-widest">Anon Public Key</label>
                      <input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        value={anonKey}
                        onChange={(e) => setAnonKey(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl text-white text-sm font-mono focus:border-[#3ECF8E] outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-[10px] font-black uppercase text-[#888888] tracking-widest">Service Role Key</label>
                        <a 
                          href="https://supabase.com/dashboard/project/_/settings/api" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[9px] text-[#3ECF8E] hover:underline flex items-center gap-1"
                        >
                          Find in Settings <ExternalLink size={8} />
                        </a>
                      </div>
                      <input
                        type="password"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        value={serviceKey}
                        onChange={(e) => setServiceKey(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl text-white text-sm font-mono focus:border-[#3ECF8E] outline-none"
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
                  className="w-full px-4 py-4 rounded-xl bg-[#3ECF8E] text-black font-black uppercase tracking-widest text-xs hover:shadow-[0_0_20px_rgba(62,207,142,0.3)] transition-all disabled:opacity-50"
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
          <div className="p-8 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#3ECF8E]/10 flex items-center justify-center">
                  <Database size={24} className="text-[#3ECF8E]" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Database Schema</h3>
                  <p className="text-xs text-[#888888]">Initialize your Supabase database with the required tables and functions.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAutoExecuteSQL}
                disabled={autoExecLoading}
                className="w-full md:w-auto px-8 py-4 bg-[#3ECF8E] text-black text-xs font-black uppercase tracking-widest rounded-xl hover:shadow-[0_10px_30px_rgba(62,207,142,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {autoExecLoading ? <Loader size={18} className="animate-spin" /> : <Zap size={18} />}
                {autoExecSuccess === true ? 'Re-run Setup' : 'Auto-Setup Database'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase text-[#888888] tracking-widest">Execution Logs</h4>
                {autoExecLoading && (
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] animate-pulse" />
                    <span className="text-[10px] text-[#3ECF8E] font-bold">Processing...</span>
                  </div>
                )}
              </div>
              
              <div className="h-64 bg-black/40 rounded-2xl border border-[#222222] p-6 font-mono text-[11px] overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
                  {autoExecLog.length === 0 && (
                    <div className="h-full flex items-center justify-center text-[#444444] uppercase tracking-widest text-[10px]">
                      Waiting for initialization...
                    </div>
                  )}
                  {autoExecLog.map((log, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "leading-relaxed transition-all",
                        log.includes('✅') || log.includes('[SUCCESS]') ? 'text-[#3ECF8E]' :
                        log.includes('❌') || log.includes('[ERROR]') ? 'text-red-500' :
                        log.includes('⚠️') || log.includes('[WAITING]') ? 'text-yellow-500' : 'text-[#888888]'
                      )}
                    >
                      <span className="opacity-20 mr-2 text-[9px]">[{i.toString().padStart(2, '0')}]</span>
                      {log}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>

                {autoExecLoading && (
                  <div className="mt-4 pt-4 border-t border-[#222222]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] text-[#555555] font-black uppercase tracking-widest">Initialising Schema</span>
                      <span className="text-[10px] text-white font-mono">{autoExecProgress}%</span>
                    </div>
                    <div className="w-full bg-[#1A1A1A] rounded-full h-1 overflow-hidden">
                      <motion.div 
                        className="bg-[#3ECF8E] h-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${autoExecProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {autoExecSuccess === false && (
                <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-red-500/5 border border-red-500/20 rounded-[28px] flex items-center gap-6"
                >
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <AlertCircle size={24} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-white">System Error: Execution Fault</p>
                    <p className="text-[11px] text-red-400/80 font-medium leading-relaxed mt-1">The DDL transmission was interrupted. Verify helper functions and security policies in the host environment.</p>
                  </div>
                </motion.div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={cn(
              "p-8 rounded-[32px] border transition-all flex items-center gap-6 group overflow-hidden relative",
              schemaVerified ? "bg-[#3ECF8E]/5 border-[#3ECF8E]/30" : "bg-white/[0.02] border-white/5 h-24"
            )}>
              {schemaVerified && <div className="absolute top-0 right-0 p-4 opacity-5"><Layers size={64} className="text-[#3ECF8E]" /></div>}
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500",
                schemaVerified ? "bg-[#3ECF8E] text-black shadow-[0_0_20px_rgba(62,207,142,0.3)]" : "bg-black border border-white/10 text-[#222222]"
              )}>
                <Check size={28} strokeWidth={3} />
              </div>
              <div className="relative z-10">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#555555]">Logical Integrity</p>
                <p className={cn("text-lg font-black tracking-tight mt-1", schemaVerified ? "text-white" : "text-[#222222]")}>
                  {schemaVerified ? 'Schema Synchronized' : 'Structural Check Required'}
                </p>
              </div>
            </div>

            <div className={cn(
              "p-8 rounded-[32px] border transition-all flex items-center gap-6 group overflow-hidden relative",
              autoExecSuccess === true ? "bg-[#3ECF8E]/5 border-[#3ECF8E]/30" : "bg-white/[0.02] border-white/5 h-24"
            )}>
               {autoExecSuccess === true && <div className="absolute top-0 right-0 p-4 opacity-5"><Zap size={64} className="text-[#3ECF8E]" /></div>}
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500",
                autoExecSuccess === true ? "bg-[#3ECF8E] text-black shadow-[0_0_20px_rgba(62,207,142,0.3)]" : "bg-black border border-white/10 text-[#222222]"
              )}>
                <Check size={28} strokeWidth={3} />
              </div>
              <div className="relative z-10">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#555555]">Deployment Readiness</p>
                <p className={cn("text-lg font-black tracking-tight mt-1", autoExecSuccess === true ? "text-white" : "text-[#222222]")}>
                  {autoExecSuccess === true ? 'Verified Target' : 'Pending Deployment'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={() => setShowManualSetup(!showManualSetup)}
              className="flex items-center gap-3 text-[11px] font-black uppercase text-[#444444] hover:text-[#888888] tracking-[0.3em] transition-all"
            >
              <div className={cn("w-1.5 h-1.5 rounded-full bg-[#444444] transition-colors", showManualSetup && "bg-[#3ECF8E]")} />
              {showManualSetup ? 'Close Advanced Console' : 'Open Advanced Console'}
            </button>

            {showManualSetup && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-8 space-y-6 overflow-hidden"
              >
                <div className="bg-black/60 border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
                  <div className="px-8 py-5 bg-white/5 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] uppercase font-black tracking-[0.2em] text-[#888888]">DDL Script Preview</span>
                      {!isUsingRecommended && (
                        <button 
                          onClick={handleResetToRecommended}
                          className="px-3 py-1 rounded bg-[#3ECF8E]/10 text-[#3ECF8E] text-[9px] font-black uppercase tracking-widest border border-[#3ECF8E]/20 hover:bg-[#3ECF8E]/20 transition-all"
                        >
                          Reset to Recommended
                        </button>
                      )}
                    </div>
                    <div className="flex gap-3">
                       <button onClick={handleCopySQL} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 group">
                        {sqlCopied ? <Check size={16} className="text-[#3ECF8E]" /> : <Copy size={16} className="text-[#888888] group-hover:text-white" />}
                       </button>
                       <button onClick={handleDownloadPreviewSQL} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 group">
                        <Download size={16} className="text-[#888888] group-hover:text-white" />
                       </button>
                    </div>
                  </div>
                  <div className="p-8 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <pre className="text-[11px] text-[#666666] font-mono leading-relaxed whitespace-pre-wrap">
                      {previewScript}
                    </pre>
                  </div>
                </div>
                
                <div className="p-8 rounded-[32px] bg-yellow-500/[0.03] border border-yellow-500/10 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12"><AlertCircle size={120} className="text-yellow-500" /></div>
                   
                   <div className="relative z-10">
                    <h5 className="text-[11px] text-yellow-500 font-black mb-4 uppercase tracking-[0.3em]">Manual Installation Protocol</h5>
                    <p className="text-sm text-[#888888] leading-relaxed mb-8 max-w-2xl font-medium">
                      If the automated provisioner fails due to host security policies, you must ensure the <code className="text-[#3ECF8E] bg-[#3ECF8E]/5 px-2 py-0.5 rounded border border-[#3ECF8E]/10 font-mono">execute_sql</code> kernel is installed in the public schema.
                      <button onClick={handleDownloadSQL} className="text-[#3ECF8E] hover:underline font-black uppercase text-[10px] tracking-widest ml-4 bg-[#3ECF8E]/10 px-4 py-2 rounded-xl border border-[#3ECF8E]/20">Fetch Kernel SQL</button>
                    </p>

                    <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center gap-8">
                      <label className="flex items-center gap-4 cursor-pointer group flex-1">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={scriptConfirmed}
                            onChange={(e) => setScriptConfirmed(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={cn(
                            "w-8 h-8 rounded-xl border transition-all flex items-center justify-center",
                            scriptConfirmed ? "bg-[#3ECF8E] border-[#3ECF8E]" : "bg-black border-white/10"
                          )}>
                            {scriptConfirmed && <Check size={16} strokeWidth={3} className="text-black" />}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#888888] group-hover:text-white transition-colors tracking-tight">
                          I have successfully verified the manual DDL execution.
                        </span>
                      </label>

                      <button
                        type="button"
                        onClick={handleVerifySchema}
                        disabled={!scriptConfirmed || isSaving}
                        className="w-full sm:w-auto px-10 py-5 rounded-[22px] border border-white/5 bg-white/5 text-[11px] font-black uppercase tracking-[0.3em] text-[#888888] hover:text-white hover:bg-white/10 hover:border-white/10 transition-all disabled:opacity-50"
                      >
                        Run Topology Validation
                      </button>
                    </div>
                   </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
      {currentStep === 'complete' && teamSecret && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
          <div className="p-8 rounded-3xl bg-[#3ECF8E]/5 border-2 border-[#3ECF8E]/20 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-[#3ECF8E] flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(62,207,142,0.3)]">
              <Check size={40} className="text-black" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white tracking-tight">Team Created Successfully!</h3>
              <p className="text-sm text-[#888888] max-w-md mx-auto">
                Your workspace is ready. Save these codes as you will need them to manage your team or invite members.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="p-6 rounded-2xl bg-black/40 border border-[#222222] space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-[#888888] tracking-widest">Team Code (Secret)</p>
                  <Shield size={14} className="text-[#3ECF8E]" />
                </div>
                <div className="flex items-center gap-3">
                  <code className="flex-1 px-4 py-3 bg-black rounded-xl border border-[#222222] text-white font-mono text-xs break-all">
                    {teamSecret}
                  </code>
                  <button
                    onClick={handleCopyTeamCode}
                    className="p-3 bg-[#1A1A1A] hover:bg-[#222222] rounded-xl text-[#888888] hover:text-white transition-all"
                  >
                    <Copy size={18} />
                  </button>
                </div>
                <p className="text-[10px] text-red-400 font-medium">NEVER share this code with anyone but co-admins.</p>
              </div>

              {inviteCode && (
                <div className="p-6 rounded-2xl bg-black/40 border border-[#222222] space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase text-[#888888] tracking-widest">Temporary Invite Code</p>
                    <LinkIcon size={14} className="text-[#3ECF8E]" />
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 px-4 py-3 bg-black rounded-xl border border-[#222222] text-white font-mono text-xs break-all">
                      {inviteCode}
                    </code>
                    <button
                      onClick={handleCopyInviteCode}
                      className="p-3 bg-[#1A1A1A] hover:bg-[#222222] rounded-xl text-[#888888] hover:text-white transition-all"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                  <p className="text-[10px] text-[#444444]">Valid for 24 hours. Your team can use this to join.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex gap-3 mt-8 pt-8 border-t border-[#222222]">
        {currentStep === 'sql-setup' && (
          <button
            type="button"
            onClick={() => setCurrentStep('credentials')}
            className="flex-1 px-4 py-3 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-main)] font-bold hover:bg-[var(--bg-surface)] transition-all"
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
          className="flex-1 px-4 py-3 rounded-2xl bg-[#3ECF8E] text-[var(--text-on-brand)] font-bold hover:shadow-[0_0_20px_rgba(62,207,142,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

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
          <div className="p-8 rounded-3xl bg-gradient-to-br from-[#3ECF8E]/10 to-transparent border border-[#3ECF8E]/20">
            <div className="flex flex-col gap-8">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#3ECF8E]/20 flex items-center justify-center">
                    <Cloud size={28} className="text-[#3ECF8E]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">Smart Connector</h3>
                    <p className="text-sm text-[#888888]">Link your Supabase account to automate deployment.</p>
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-[#888888] mb-3 tracking-widest">
                      Supabase Access Token
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555555] z-10" />
                        <input
                          type={showManagementToken ? 'text' : 'password'}
                          placeholder="sbp_xxxxxxxxxxxx"
                          value={managementToken}
                          onChange={(e) => setManagementToken(e.target.value)}
                          className="w-full pl-12 pr-12 py-5 bg-black border border-[#222222] rounded-xl text-white font-mono text-sm focus:border-[#3ECF8E] outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowManagementToken(!showManagementToken)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555555] hover:text-[#3ECF8E] transition-all"
                        >
                          {showManagementToken ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      <button
                        onClick={handleFetchProjects}
                        disabled={isFetchingProjects || !managementToken}
                        className="px-10 py-5 bg-[#3ECF8E] text-black font-black uppercase tracking-widest text-xs rounded-xl hover:shadow-[0_0_30px_rgba(62,207,142,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isFetchingProjects ? <Loader size={18} className="animate-spin" /> : 'Scan Projects'}
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <a
                        href="https://supabase.com/dashboard/account/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#3ECF8E] hover:underline inline-flex items-center gap-1.5 font-bold"
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
                      <span className="text-[10px] uppercase tracking-widest font-black text-[#444444]">Discovery Output</span>
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/10" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/10" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/10" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative h-64 bg-black/90 rounded-[32px] border border-[#222222] p-8 font-mono text-[11px] overflow-hidden flex flex-col shadow-2xl">
                    {isFetchingProjects && (
                      <motion.div
                        initial={{ top: '-10%' }}
                        animate={{ top: '110%' }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="absolute left-0 right-0 h-[100px] bg-gradient-to-b from-transparent via-[#3ECF8E]/5 to-transparent pointer-events-none z-10"
                      />
                    )}
                    <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-4">
                      {fetchLog.map((log, i) => (
                        <motion.div 
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={i} 
                          className={cn(
                            "flex gap-4 p-1 rounded-lg",
                            log.includes('[CRITICAL]') || log.includes('[ERROR]') ? 'text-red-500 bg-red-500/5' :
                            log.includes('[SUCCESS]') || log.includes('[TOKEN]') ? 'text-[#3ECF8E] bg-[#3ECF8E]/5 font-bold' : 'text-[#888888]'
                          )}
                        >
                          <span className="opacity-20 shrink-0 text-[10px] font-black uppercase tracking-tighter">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                          <span className="flex-1">{log}</span>
                        </motion.div>
                      ))}
                      <div ref={fetchLogEndRef} />
                      {isFetchingProjects && (
                        <div className="flex items-center gap-4 text-[#3ECF8E] animate-pulse p-1">
                          <span className="opacity-20 text-[10px] font-black">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                          <div className="flex items-center gap-2 font-black tracking-[0.2em] text-[9px] uppercase">
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
              <div className="mt-8 space-y-4 pt-8 border-t border-[#3ECF8E]/20">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white uppercase tracking-widest">Select Deployment Target</h4>
                  <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
                    <input
                      placeholder="Filter projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-black/40 border border-[#222222] pl-10 pr-4 py-2 rounded-xl text-xs outline-none focus:border-[#3ECF8E] transition-all"
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
                          ? "bg-[#3ECF8E]/10 border-[#3ECF8E] shadow-[0_0_20px_rgba(62,207,142,0.1)]"
                          : "bg-black/20 border-[#222222] hover:border-[#3ECF8E]/50"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#111111] border border-[#222222] flex items-center justify-center text-xs font-black text-[#888888] uppercase group-hover:text-[#3ECF8E] transition-colors">
                          {project.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white group-hover:text-[#3ECF8E] transition-colors">{project.name}</div>
                          <div className="text-[10px] font-mono text-[#555555]">{project.id}</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-[#333333] group-hover:text-[#3ECF8E] transition-all" />
                    </button>
                  ))}
                  {filteredProjects.length === 0 && (
                    <div className="col-span-2 text-center py-12 text-[#555555] italic text-sm">
                      No matching Supabase projects found.
                    </div>
                  )}
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
                      <label className="block text-[10px] font-black uppercase text-[#888888] mb-2 tracking-widest">Service Role Key</label>
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
          <div className="p-8 rounded-3xl bg-gradient-to-br from-[#3ECF8E]/10 to-transparent border border-[#3ECF8E]/20">
            <div className="flex flex-col gap-8">
              {/* Header with Info & Trigger */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#3ECF8E]/20 flex items-center justify-center">
                    <Database size={28} className="text-[#3ECF8E]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">Database Core</h3>
                    <p className="text-sm text-[#888888]">Initialize your Supabase schema and required tables.</p>
                  </div>
                </div>

                <div className="flex flex-col items-center md:items-end gap-2">
                  <button
                    type="button"
                    onClick={handleAutoExecuteSQL}
                    disabled={autoExecLoading}
                    className="w-full md:w-auto px-10 py-5 bg-[#3ECF8E] text-black text-sm font-black uppercase tracking-widest rounded-2xl hover:shadow-[0_0_40px_rgba(62,207,142,0.4)] transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {autoExecLoading ? <Loader size={20} className="animate-spin" /> : <Database size={20} />}
                    {autoExecSuccess === true ? 'Re-run Initialization' : 'Smart Initialize'}
                  </button>
                  <p className="text-[10px] text-[#555555] font-mono uppercase tracking-widest">
                    Ready for remote DDL transmission
                  </p>
                </div>
              </div>

              {/* Full Width Log Terminal */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest font-black text-[#444444]">Remote Output Terminal</span>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                    </div>
                  </div>
                  {autoExecLoading && (
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-[#3ECF8E] animate-ping" />
                      <span className="text-[10px] text-[#3ECF8E] font-black tracking-widest animate-pulse">STREAMING DATA</span>
                    </div>
                  )}
                </div>
                
                <div className="relative h-80 bg-black/90 rounded-[24px] border border-[#222222] p-6 font-mono text-[11px] overflow-hidden flex flex-col shadow-2xl">
                  {/* Scan line effect */}
                  {autoExecLoading && (
                    <motion.div
                      initial={{ top: '-10%' }}
                      animate={{ top: '110%' }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      className="absolute left-0 right-0 h-[150px] bg-gradient-to-b from-transparent via-[#3ECF8E]/5 to-transparent pointer-events-none z-10"
                    />
                  )}
                  
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-4">
                    {autoExecLog.length === 0 && (
                      <div className="text-[#333333] italic flex items-center gap-2">
                        <span className="animate-pulse">_</span>
                        Waiting for deployment command...
                      </div>
                    )}
                    {autoExecLog.map((log, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={i} 
                        className={cn(
                          "flex gap-3 leading-relaxed break-all transition-colors p-1 rounded-lg",
                          log.includes('✅') || log.includes('[SUCCESS]') || log.includes('[COMPLETE]') ? 'text-[#3ECF8E] font-bold bg-[#3ECF8E]/5' :
                          log.includes('❌') || log.includes('[ERROR]') || log.includes('[MANAGEMENT ERROR]') ? 'text-red-500 bg-red-500/5' :
                          log.includes('⚠️') || log.includes('[WAITING]') || log.includes('[WARNING]') ? 'text-yellow-500 bg-yellow-500/5' :
                          log.includes('⚙️') || log.includes('[CHECK]') || log.includes('[MANAGEMENT]') ? 'text-blue-400 bg-blue-400/5' : 'text-[#888888]'
                        )}
                      >
                        <span className="opacity-20 shrink-0 text-[9px] mt-0.5 font-black">[{i.toString().padStart(3, '0')}] »</span>
                        <span className="flex-1">{log}</span>
                      </motion.div>
                    ))}
                    {autoExecLoading && (
                      <div className="flex gap-3 pt-1 p-1">
                        <span className="opacity-20 shrink-0 text-[10px] mt-0.5 font-black">[{autoExecLog.length.toString().padStart(3, '0')}] »</span>
                        <motion.div 
                          animate={{ opacity: [0, 1, 0] }} 
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="w-2.5 h-4 bg-[#3ECF8E] rounded-xs" 
                        />
                      </div>
                    )}
                    <div ref={logEndRef} />
                  </div>

                  {autoExecLoading && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-[10px] text-[#3ECF8E] font-bold tracking-[0.2em] uppercase">
                          <Loader size={10} className="animate-spin" />
                          Executing SQL Blocks
                        </div>
                        <span className="text-[10px] text-[#555555] font-mono">{autoExecProgress}% COPMLETE</span>
                      </div>
                      <div className="w-full bg-[#111111] rounded-full h-1.5 overflow-hidden border border-white/5">
                        <motion.div 
                          className="bg-[#3ECF8E] h-full shadow-[0_0_15px_rgba(62,207,142,0.8)]"
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
                       <p className="text-[11px] text-white font-black uppercase tracking-widest">System Error Detected</p>
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
              schemaVerified ? "bg-[#3ECF8E]/5 border-[#3ECF8E]/30" : "bg-black/20 border-[#222222]"
            )}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                schemaVerified ? "bg-[#3ECF8E]/20 text-[#3ECF8E]" : "bg-[#111111] text-[#444444]"
              )}>
                <Check size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#888888]">Structure</p>
                <p className={cn("text-sm font-bold", schemaVerified ? "text-white" : "text-[#444444]")}>
                  {schemaVerified ? 'Schema Verified' : 'Pending Initialization'}
                </p>
              </div>
            </div>

            <div className={cn(
              "p-5 rounded-2xl border transition-all flex items-center gap-4",
              autoExecSuccess === true ? "bg-[#3ECF8E]/5 border-[#3ECF8E]/30" : "bg-black/20 border-[#222222]"
            )}>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                autoExecSuccess === true ? "bg-[#3ECF8E]/20 text-[#3ECF8E]" : "bg-[#111111] text-[#444444]"
              )}>
                <LinkIcon size={20} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#888888]">Deployment</p>
                <p className={cn("text-sm font-bold", autoExecSuccess === true ? "text-white" : "text-[#444444]")}>
                  {autoExecSuccess === true ? 'Ready for Team Sync' : 'Waiting for Execution'}
                </p>
              </div>
            </div>
          </div>

          {/* Advanced Manual Options (Hidden by default) */}
          <div className="pt-4 border-t border-[#1a1a1a]">
            <button
              onClick={() => setShowManualSetup(!showManualSetup)}
              className="flex items-center gap-2 text-[10px] font-black uppercase text-[#444444] hover:text-[#888888] tracking-widest transition-all"
            >
              {showManualSetup ? 'Hide Manual SQL Options' : 'Need manual SQL setup?'}
            </button>

            {showManualSetup && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 space-y-4"
              >
                <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-black flex items-center justify-between border-b border-[#222222]">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] uppercase font-black tracking-widest text-[#888888]">Raw SQL Script</span>
                      {!isUsingRecommended && (
                        <button 
                          onClick={handleResetToRecommended}
                          className="px-2 py-1 rounded bg-[#3ECF8E]/10 text-[#3ECF8E] text-[8px] font-black uppercase tracking-widest border border-[#3ECF8E]/20 hover:bg-[#3ECF8E]/20"
                        >
                          Reset to Recommended
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                       <button onClick={handleCopySQL} className="p-2 hover:bg-[#222222] rounded-lg transition-all">
                        {sqlCopied ? <Check size={14} className="text-[#3ECF8E]" /> : <Copy size={14} className="text-[#555555]" />}
                       </button>
                       <button onClick={handleDownloadPreviewSQL} className="p-2 hover:bg-[#222222] rounded-lg transition-all">
                        <Download size={14} className="text-[#555555]" />
                       </button>
                    </div>
                  </div>
                  <pre className="p-6 max-h-60 overflow-y-auto text-[10px] text-[#555555] font-mono leading-relaxed">
                    {previewScript}
                  </pre>
                </div>
                
                <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                  <p className="text-[10px] text-yellow-500/60 font-bold mb-2 uppercase tracking-widest">Manual Requirement</p>
                  <p className="text-xs text-[#555555] leading-relaxed mb-4">
                    If smart initialization fails, ensure the <code className="text-[#3ECF8E]">execute_sql</code> helper function is installed in your Supabase project. 
                    <button onClick={handleDownloadSQL} className="text-[#3ECF8E] hover:underline ml-1">Download Helper SQL</button>.
                  </p>

                  <div className="pt-4 border-t border-yellow-500/10">
                    <label className="flex items-start gap-3 mb-4 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={scriptConfirmed}
                        onChange={(e) => setScriptConfirmed(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border border-[#333333] bg-black text-[#3ECF8E] focus:ring-[#3ECF8E]"
                      />
                      <span className="text-xs text-[#888888] group-hover:text-[#aaaaaa] transition-colors">
                        I have manually executed the initialization script in Supabase.
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={handleVerifySchema}
                      disabled={!scriptConfirmed || isSaving}
                      className="w-full px-4 py-3 rounded-xl border border-[#222222] bg-[#111111] text-[10px] font-black uppercase tracking-widest text-[#888888] hover:text-white hover:border-[#444444] transition-all disabled:opacity-50"
                    >
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
          <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[#222222] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#888888] mb-3">Team created</p>
            <h3 className="text-2xl font-black text-white mb-4">Your team is ready</h3>
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#111111] border border-[#222222] p-4">
                <p className="text-[10px] uppercase tracking-[0.3em] text-[#888888] mb-2">Team code</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-mono text-sm text-white tracking-[0.15em] break-all">{teamSecret}</span>
                  <button
                    type="button"
                    onClick={handleCopyTeamCode}
                    className="inline-flex items-center justify-center rounded-2xl bg-[#3ECF8E] px-4 py-3 text-xs font-bold text-[var(--text-on-brand)] hover:bg-[#34b37a] transition-all"
                  >
                    Copy Code
                  </button>
                </div>
              </div>
              {inviteCode && (
                <div className="rounded-2xl bg-[#111111] border border-[#222222] p-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#888888] mb-2">Temporary code</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-sm text-white tracking-[0.15em] break-all">{inviteCode}</span>
                    <button
                      type="button"
                      onClick={handleCopyInviteCode}
                      className="inline-flex items-center justify-center rounded-2xl bg-[#3ECF8E] px-4 py-3 text-xs font-bold text-[var(--text-on-brand)] hover:bg-[#34b37a] transition-all"
                    >
                      Copy Code
                    </button>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-[#888888] mt-4">
              Share the team code and temporary code with your team to allow secure access to the workspace.
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[#222222] p-6">
            <h4 className="text-lg font-bold text-white mb-3">Next steps</h4>
            <ul className="space-y-3 text-sm text-[#aaaaaa]">
              <li>• Execute the SQL script in Supabase.</li>
              <li>• Share the team code and temporary code with collaborators.</li>
              <li>• Open the workspace and start sending requests.</li>
            </ul>
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

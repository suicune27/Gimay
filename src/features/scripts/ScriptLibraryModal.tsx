import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';
import { useScriptStore } from '../../store/scriptStore';
import { ScriptLibraryService } from '../../services/ScriptLibraryService';
import { PersistenceService } from '../../services/PersistenceService';
import { ScriptCategory, ScriptTemplate, RequestData, Script } from '../../types';
import { 
  Search, 
  X, 
  Star, 
  TerminalSquare, 
  Copy, 
  CheckCircle2, 
  ChevronRight, 
  BookTemplate,
  Trash2,
  Edit3,
  Share2,
  FilePlus,
  Play,
  RotateCcw,
  Zap,
  Users,
  AlertTriangle,
  ShieldAlert,
  Code
} from 'lucide-react';
import { cn } from '../../lib/utils';

const Editor = React.lazy(() => import('@monaco-editor/react'));

interface CustomScriptTemplate {
  id: string;
  name: string;
  description: string;
  category_id: string;
  content: string;
  variables_used: string[];
  version: string;
  is_builtin: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_shared?: boolean;
}

// Premium Offline Fallback Templates
const premiumTemplates: CustomScriptTemplate[] = [
  {
    id: 'auth_bearer',
    name: 'Bearer Token Injector',
    description: 'Automatically injects a bearer token from the active environment into request headers.',
    category_id: 'Authentication',
    content: `// Retrieve the token from environment variables\nconst token = gmy.environment.get('BEARER_TOKEN');\n\nif (token) {\n  // Inject the authorization header\n  gmy.request.headers.push({\n    key: 'Authorization',\n    value: \`Bearer \${token}\`\n  });\n  console.log('Bearer token injected successfully.');\n} else {\n  console.warn('No BEARER_TOKEN found in environment.');\n}`,
    version: '1.0.0',
    tags: ['auth', 'jwt', 'bearer'],
    is_builtin: true,
    variables_used: ['BEARER_TOKEN'],
    created_at: '',
    updated_at: ''
  },
  {
    id: 'auth_basic',
    name: 'Basic Authentication Header',
    description: 'Encodes and injects client credentials into request headers.',
    category_id: 'Authentication',
    content: `// Retrieve credentials from environment\nconst username = gmy.environment.get('API_USERNAME');\nconst password = gmy.environment.get('API_PASSWORD');\n\nif (username && password) {\n  const encoded = btoa(\`\${username}:\${password}\`);\n  gmy.request.headers.push({\n    key: 'Authorization',\n    value: \`Basic \${encoded}\`\n  });\n  console.log('Basic auth header injected successfully.');\n} else {\n  console.warn('API_USERNAME or API_PASSWORD not configured.');\n}`,
    version: '1.0.0',
    tags: ['auth', 'basic'],
    is_builtin: true,
    variables_used: ['API_USERNAME', 'API_PASSWORD'],
    created_at: '',
    updated_at: ''
  },
  {
    id: 'jwt_decoder',
    name: 'JWT Decoder & Expiry Check',
    description: 'Decodes a JWT payload and asserts that it has not expired.',
    category_id: 'JWT Handling',
    content: `// Decodes and validates JWT token in response body\nconst response = gmy.response.json();\nconst token = response.access_token || response.token;\n\nif (token) {\n  const parts = token.split('.');\n  if (parts.length === 3) {\n    const payload = JSON.parse(atob(parts[1]));\n    console.log('JWT Payload:', payload);\n    \n    const exp = payload.exp * 1000;\n    const now = Date.now();\n    \n    gmy.test("JWT Token has not expired", function () {\n      gmy.expect(exp).to.be.above(now);\n    });\n  } else {\n    console.error('Invalid JWT format');\n  }\n} else {\n  console.warn('No access_token found in response.');\n}`,
    version: '1.0.0',
    tags: ['jwt', 'decode', 'security'],
    is_builtin: true,
    variables_used: [],
    created_at: '',
    updated_at: ''
  },
  {
    id: 'oauth_flow',
    name: 'OAuth 2.0 Client Credentials Flow',
    description: 'Pre-request script that automatically fetches a token using client credentials and caches it.',
    category_id: 'OAuth Helpers',
    content: `// Automatically obtain and cache client credentials token\nconst tokenUrl = gmy.environment.get('OAUTH_TOKEN_URL');\nconst clientId = gmy.environment.get('OAUTH_CLIENT_ID');\nconst clientSecret = gmy.environment.get('OAUTH_CLIENT_SECRET');\nconst cachedToken = gmy.environment.get('OAUTH_ACCESS_TOKEN');\nconst expiryTime = gmy.environment.get('OAUTH_TOKEN_EXPIRY');\n\nconst now = Date.now();\nif (cachedToken && expiryTime && parseInt(expiryTime) > now) {\n  gmy.request.headers.push({ key: 'Authorization', value: \`Bearer \${cachedToken}\` });\n  console.log('Using cached OAuth access token.');\n} else {\n  console.log('OAuth token expired or missing. Fetching new token...');\n  gmy.sendRequest({\n    url: tokenUrl,\n    method: 'POST',\n    header: { 'Content-Type': 'application/x-www-form-urlencoded' },\n    body: {\n      mode: 'urlencoded',\n      urlencoded: [\n        { key: 'grant_type', value: 'client_credentials' },\n        { key: 'client_id', value: clientId },\n        { key: 'client_secret', value: clientSecret }\n      ]\n    }\n  }, function (err, res) {\n    if (res.code === 200) {\n      const data = res.json();\n      gmy.environment.set('OAUTH_ACCESS_TOKEN', data.access_token);\n      gmy.environment.set('OAUTH_TOKEN_EXPIRY', (now + (data.expires_in * 1000)).toString());\n      gmy.request.headers.push({ key: 'Authorization', value: \`Bearer \${data.access_token}\` });\n      console.log('OAuth access token fetched and cached successfully.');\n    } else {\n      console.error('Failed to retrieve OAuth token:', res.code);\n    }\n  });\n}`,
    version: '1.1.0',
    tags: ['oauth', 'token', 'auth'],
    is_builtin: true,
    variables_used: ['OAUTH_TOKEN_URL', 'OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET', 'OAUTH_ACCESS_TOKEN', 'OAUTH_TOKEN_EXPIRY'],
    created_at: '',
    updated_at: ''
  },
  {
    id: 'assertions_status',
    name: 'Response Status Code Assertions',
    description: 'Asserts standard HTTP response codes and response times.',
    category_id: 'Response Assertions',
    content: `gmy.test("Status code is 200 OK", function () {\n  gmy.expect(gmy.response.code).to.equal(200);\n});\n\ngmy.test("Response time is under 250ms", function () {\n  gmy.expect(gmy.response.responseTime).to.be.below(250);\n});\n\ngmy.test("Content-Type header is present", function () {\n  gmy.response.to.have.header("Content-Type");\n});`,
    version: '1.0.0',
    tags: ['test', 'assertions', 'status'],
    is_builtin: true,
    variables_used: [],
    created_at: '',
    updated_at: ''
  },
  {
    id: 'assertions_schema',
    name: 'Response JSON Schema Validation',
    description: 'Validates that the response matches a specific JSON Schema structure.',
    category_id: 'Response Assertions',
    content: `// Define JSON Schema structure\nconst userSchema = {\n  type: "object",\n  required: ["id", "email", "name"],\n  properties: {\n    id: { type: "string" },\n    email: { type: "string", format: "email" },\n    name: { type: "string" },\n    roles: { type: "array", items: { type: "string" } }\n  }\n};\n\ngmy.test("Response matches expected user schema", function () {\n  const responseData = gmy.response.json();\n  const isValid = tv4.validate(responseData, userSchema);\n  gmy.expect(isValid).to.be.true;\n});`,
    version: '1.0.0',
    tags: ['schema', 'validation', 'json'],
    is_builtin: true,
    variables_used: [],
    created_at: '',
    updated_at: ''
  },
  {
    id: 'env_setup',
    name: 'Environment Extractor & Login Setup',
    description: 'Automatically saves auth token and user details from a successful login response.',
    category_id: 'Environment Setup',
    content: `if (gmy.response.code === 200) {\n  const data = gmy.response.json();\n  \n  if (data.token) {\n    gmy.environment.set("BEARER_TOKEN", data.token);\n    console.log("Authentication token extracted.");\n  }\n  if (data.user && data.user.id) {\n    gmy.environment.set("USER_ID", data.user.id);\n    console.log("Active User ID set to: " + data.user.id);\n  }\n} else {\n  console.warn("Skipped environment extraction: Response status was not 200.");\n}`,
    version: '1.0.0',
    tags: ['env', 'login', 'setup'],
    is_builtin: true,
    variables_used: ['BEARER_TOKEN', 'USER_ID'],
    created_at: '',
    updated_at: ''
  },
  {
    id: 'req_signing_hmac',
    name: 'HMAC SHA256 Request Payload Signer',
    description: 'Calculates an HMAC signature of the request body and appends it to headers.',
    category_id: 'Request Signing',
    content: `// Generates signature using CryptoJS sandbox module\nconst secretKey = gmy.environment.get('API_SECRET');\nconst partnerId = gmy.environment.get('PARTNER_ID');\n\nif (secretKey) {\n  const timestamp = Date.now().toString();\n  const method = gmy.request.method;\n  const body = gmy.request.body || '';\n  \n  const message = partnerId + timestamp + body;\n  const hash = CryptoJS.HmacSHA256(message, secretKey);\n  const signature = CryptoJS.enc.Hex.stringify(hash);\n  \n  gmy.request.headers.push({ key: 'X-Partner-Id', value: partnerId });\n  gmy.request.headers.push({ key: 'X-Timestamp', value: timestamp });\n  gmy.request.headers.push({ key: 'X-Signature', value: signature });\n  \n  console.log('Request HMAC signature calculated successfully.');\n} else {\n  console.warn('API_SECRET is missing from active environment.');\n}`,
    version: '1.0.0',
    tags: ['crypto', 'hmac', 'sign'],
    is_builtin: true,
    variables_used: ['API_SECRET', 'PARTNER_ID'],
    created_at: '',
    updated_at: ''
  },
  {
    id: 'trans_xml2json',
    name: 'XML Response to JSON Converter',
    description: 'Parses raw XML response and transforms it into a standard JSON object.',
    category_id: 'Data Transformers',
    content: `// Convert XML response into JSON representation\nconst rawXml = gmy.response.text();\n\nif (rawXml) {\n  const jsonResult = xml2Json(rawXml);\n  console.log('Transformed JSON payload:', jsonResult);\n  \n  gmy.test("XML parsed successfully", function () {\n    gmy.expect(jsonResult).to.not.be.null;\n  });\n} else {\n  console.warn('Response body is empty.');\n}`,
    version: '1.0.0',
    tags: ['xml', 'json', 'transform'],
    is_builtin: true,
    variables_used: [],
    created_at: '',
    updated_at: ''
  },
  {
    id: 'util_uuid',
    name: 'Dynamic Random UUID Generator',
    description: 'Generates a random v4 UUID and saves it to environment variables.',
    category_id: 'Utilities',
    content: `// Generate a new random UUID v4\nconst uuid = crypto.randomUUID();\ngmy.environment.set("RANDOM_UUID", uuid);\nconsole.log("New UUID allocated: " + uuid);`,
    version: '1.0.0',
    tags: ['uuid', 'random', 'utils'],
    is_builtin: true,
    variables_used: ['RANDOM_UUID'],
    created_at: '',
    updated_at: ''
  },
  {
    id: 'util_timestamp',
    name: 'Timestamp Offset Utility',
    description: 'Generates timestamps for current time, past 24 hours, and next 7 days in ISO format.',
    category_id: 'Utilities',
    content: `const now = new Date();\nconst yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);\nconst nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);\n\ngmy.environment.set("TIME_NOW", now.toISOString());\ngmy.environment.set("TIME_YESTERDAY", yesterday.toISOString());\ngmy.environment.set("TIME_NEXT_WEEK", nextWeek.toISOString());\n\nconsole.log("Timestamps configured in active context.");`,
    version: '1.0.0',
    tags: ['time', 'timestamp', 'date'],
    is_builtin: true,
    variables_used: ['TIME_NOW', 'TIME_YESTERDAY', 'TIME_NEXT_WEEK'],
    created_at: '',
    updated_at: ''
  }
];

export interface ScriptLibraryModalProps {
  onInsertScript?: (scriptContent: string) => void;
}

export const ScriptLibraryModal: React.FC<ScriptLibraryModalProps> = ({ onInsertScript }) => {
  const { 
    isScriptLibraryOpen, 
    setIsScriptLibraryOpen, 
    profile, 
    activeWorkspaceId, 
    openTabs, 
    activeTabId, 
    updateRequest, 
    addToast,
    scriptFavorites,
    setScriptFavorites,
    theme
  } = useStore();

  const [activeTab, setActiveTab] = useState<'templates' | 'my_scripts' | 'team_scripts' | 'recent'>('templates');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<CustomScriptTemplate | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // User and Team Custom scripts
  const [userScripts, setUserScripts] = useState<CustomScriptTemplate[]>([]);
  const [recentScriptIds, setRecentScriptIds] = useState<string[]>([]);
  
  // Custom script CRUD / sharing states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deleteScriptCandidateId, setDeleteScriptCandidateId] = useState<string | null>(null);

  // Script Loader integration overlays
  const [showInjectPanel, setShowInjectPanel] = useState(false);
  const [injectTarget, setInjectTarget] = useState<'pre_request_script' | 'test_script'>('pre_request_script');
  const [injectMode, setInjectMode] = useState<'append' | 'replace'>('append');

  // Load active request tab
  const activeRequest = useMemo(() => {
    const tab = openTabs.find(t => t.id === activeTabId);
    if (tab && 'method' in tab) {
      return tab as RequestData;
    }
    return null;
  }, [activeTabId, openTabs]);

  // Load workspaces, scripts and recent lists
  useEffect(() => {
    if (isScriptLibraryOpen) {
      loadData();
      try {
        const cachedRecents = localStorage.getItem('gmy_recent_scripts');
        setRecentScriptIds(cachedRecents ? JSON.parse(cachedRecents) : []);
      } catch {
        setRecentScriptIds([]);
      }
    }
  }, [isScriptLibraryOpen, activeWorkspaceId]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeWorkspaceId && activeWorkspaceId !== 'null' && activeWorkspaceId !== 'undefined') {
        const workspaceScripts = await PersistenceService.fetchScripts(activeWorkspaceId);
        // Transform database Script type to ScriptTemplate layout
        const mapped: CustomScriptTemplate[] = (workspaceScripts || []).map((s: any) => ({
          id: s.id,
          name: s.name || 'Untitled Script',
          description: s.description || 'Custom custom script',
          content: s.content || '',
          category_id: s.category || 'Utilities',
          is_builtin: false,
          version: '1.0.0',
          tags: s.tags || ['custom'],
          is_shared: s.is_shared || false,
          user_id: s.user_id,
          variables_used: [],
          created_at: s.created_at || '',
          updated_at: s.updated_at || ''
        }));
        setUserScripts(mapped);
      }
      if (profile) {
        const favs = await ScriptLibraryService.fetchFavorites(profile.id);
        setScriptFavorites(favs);
      }
    } catch (e) {
      console.error('Failed to resolve Script Laboratory data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsScriptLibraryOpen(false);
    setSelectedScript(null);
    setShowInjectPanel(false);
    setIsEditing(false);
  };

  // Categories list based on active tab
  const categories = useMemo(() => {
    return ['Authentication', 'JWT Handling', 'OAuth Helpers', 'Response Assertions', 'Environment Setup', 'Request Signing', 'Data Transformers', 'Utilities'];
  }, []);

  // Filter scripts based on active tabs, searches, and categories
  const currentScripts = useMemo(() => {
    let baseList: CustomScriptTemplate[] = [];
    if (activeTab === 'templates') {
      baseList = premiumTemplates;
    } else if (activeTab === 'my_scripts') {
      baseList = userScripts;
    } else if (activeTab === 'team_scripts') {
      // Shared templates or user scripts shared to team
      baseList = userScripts.filter(s => s.is_shared);
    } else if (activeTab === 'recent') {
      baseList = [...premiumTemplates, ...userScripts].filter(s => recentScriptIds.includes(s.id));
    }

    const query = searchQuery.trim().toLowerCase();
    return baseList.filter(s => {
      const matchesQuery = !query || 
        s.name.toLowerCase().includes(query) || 
        s.description.toLowerCase().includes(query) ||
        (s.tags || []).some(t => t.toLowerCase().includes(query));
      
      const matchesCategory = !selectedCategoryId || s.category_id === selectedCategoryId;
      return matchesQuery && matchesCategory;
    });
  }, [activeTab, userScripts, recentScriptIds, searchQuery, selectedCategoryId]);

  const toggleFavorite = async (scriptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile || !scriptFavorites) return;
    const isFav = Array.isArray(scriptFavorites) && scriptFavorites.includes(scriptId);
    try {
      await ScriptLibraryService.toggleFavorite(scriptId, profile.id, !isFav);
      if (isFav) {
        setScriptFavorites(scriptFavorites.filter(id => id !== scriptId));
        addToast({ type: 'info', message: 'Script removed from favorites.' });
      } else {
        setScriptFavorites([...(scriptFavorites || []), scriptId]);
        addToast({ type: 'success', message: 'Script added to favorites.' });
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleCopy = () => {
    if (!selectedScript) return;
    navigator.clipboard.writeText(selectedScript.content);
    setCopied(true);
    addToast({ type: 'success', message: 'Script copied to clipboard.' });
    setTimeout(() => setCopied(false), 2000);
  };

  // Add script to recents
  const addToRecents = (scriptId: string) => {
    const updated = [scriptId, ...recentScriptIds.filter(id => id !== scriptId)].slice(0, 10);
    setRecentScriptIds(updated);
    localStorage.setItem('gmy_recent_scripts', JSON.stringify(updated));
  };

  // Inject Script Workflow
  const handleLoadScriptClick = () => {
    if (!activeRequest) {
      addToast({ type: 'warning', message: 'Please open a request tab in the editor first.' });
      return;
    }
    // Pre-populate target based on script category
    if (selectedScript?.category_id === 'Response Assertions') {
      setInjectTarget('test_script');
    } else {
      setInjectTarget('pre_request_script');
    }
    setShowInjectPanel(true);
  };

  const handleConfirmInjection = () => {
    if (!activeRequest || !selectedScript) return;

    const originalContent = activeRequest[injectTarget] || '';
    let newContent = '';

    const importStatement = `const script = new ("${selectedScript.name}");\nscript.Run();`;

    if (injectMode === 'replace') {
      newContent = importStatement;
    } else {
      newContent = originalContent ? `${originalContent}\n\n${importStatement}` : importStatement;
    }

    updateRequest(activeRequest.id, { [injectTarget]: newContent });
    addToRecents(selectedScript.id);

    if (onInsertScript) {
      onInsertScript(importStatement);
    }

    addToast({
      type: 'success',
      message: `Script injected into ${injectTarget === 'pre_request_script' ? 'Pre-request' : 'Tests'}!`
    });

    setShowInjectPanel(false);
    handleClose();
  };

  // Duplicate / Customizing
  const handleDuplicate = async () => {
    if (!selectedScript || !profile || !activeWorkspaceId) return;
    try {
      const newScript = await PersistenceService.createScript({
        name: `${selectedScript.name} Copy`,
        content: selectedScript.content,
        workspace_id: activeWorkspaceId,
        user_id: profile.id
      });
      addToast({ type: 'success', message: `Duplicated into My Scripts!` });
      await loadData();
      setActiveTab('my_scripts');
      setSelectedScript({
        id: newScript.id,
        name: newScript.name,
        description: 'Custom custom script',
        content: newScript.content,
        category_id: 'Utilities',
        is_builtin: false,
        version: '1.0.0',
        tags: ['custom'],
        variables_used: [],
        created_at: newScript.created_at || '',
        updated_at: newScript.updated_at || ''
      });
    } catch {
      addToast({ type: 'error', message: 'Failed to duplicate script.' });
    }
  };

  // Delete My Script
  const handleDeleteCustomScript = (scriptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteScriptCandidateId(scriptId);
  };

  const handleDeleteCustomScriptConfirmed = async (scriptId: string) => {
    try {
      await PersistenceService.deleteScript(scriptId);
      addToast({ type: 'info', message: 'Custom script removed.' });
      setUserScripts(prev => prev.filter(s => s.id !== scriptId));
      if (selectedScript?.id === scriptId) {
        setSelectedScript(null);
      }
    } catch {
      addToast({ type: 'error', message: 'Failed to delete script.' });
    }
  };

  // Toggle Share to Team
  const handleToggleShare = async () => {
    if (!selectedScript || selectedScript.is_builtin) return;
    try {
      const nextShared = !selectedScript.is_shared;
      await PersistenceService.updateScript(selectedScript.id, { is_shared: nextShared } as any);
      addToast({ 
        type: 'success', 
        message: nextShared ? 'Script shared with Team!' : 'Script unshared from Team.' 
      });
      setSelectedScript(prev => prev ? { ...prev, is_shared: nextShared } : null);
      await loadData();
    } catch {
      addToast({ type: 'error', message: 'Failed to share script.' });
    }
  };

  // Edit My Script identity
  const handleSaveEdit = async () => {
    if (!selectedScript || !editName.trim()) return;
    try {
      await PersistenceService.updateScript(selectedScript.id, {
        name: editName,
        description: editDesc
      } as any);
      addToast({ type: 'success', message: 'Script details updated.' });
      setSelectedScript(prev => prev ? { ...prev, name: editName, description: editDesc } : null);
      setIsEditing(false);
      await loadData();
    } catch {
      addToast({ type: 'error', message: 'Failed to save edits.' });
    }
  };

  if (!isScriptLibraryOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Main Panel Box */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="relative w-full max-w-6xl h-[85vh] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 font-sans"
      >
        {deleteScriptCandidateId && (
          <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in duration-200">
            <ShieldAlert size={40} className="text-red-500 mb-4 animate-[bounce_1s_infinite]" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-2">Delete Custom Script</h3>
            <p className="text-[10px] text-gray-400 max-w-sm mb-6 font-mono leading-relaxed uppercase tracking-tight">
              Are you sure you want to delete this custom script templates? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  const sId = deleteScriptCandidateId;
                  setDeleteScriptCandidateId(null);
                  await handleDeleteCustomScriptConfirmed(sId);
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-[10px] font-black uppercase tracking-widest text-white rounded-lg transition-all cursor-pointer font-bold"
              >
                Delete Script
              </button>
              <button
                onClick={() => setDeleteScriptCandidateId(null)}
                className="px-5 py-2.5 bg-code border border-subtle text-[10px] font-black uppercase tracking-widest text-muted hover:text-white rounded-lg transition-all cursor-pointer font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Top Header Rail */}
        <div className="h-14 border-b border-[var(--border-subtle)] flex items-center justify-between px-6 bg-[var(--bg-deep)] shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-muted)] border border-[var(--brand-border)] flex items-center justify-center text-[var(--brand)] shadow-[0_0_12px_var(--brand-muted)]">
              <TerminalSquare size={16} />
            </div>
            <div>
              <h2 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                Script Laboratory
                <span className="text-[8px] bg-[var(--brand)]/10 text-[var(--brand)] px-1.5 py-0.5 rounded border border-[var(--brand-border)]">v11 Engine</span>
              </h2>
              <p className="text-[8px] text-dim font-mono uppercase tracking-widest font-black mt-0.5">Reusable Protocol Handlers & Test Assertions</p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            className="p-1.5 text-[var(--text-dim)] hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Central Layout splits */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* 1. Left Nav & Search Sidebar */}
          <div className="w-64 border-r border-[var(--border-subtle)] bg-[var(--bg-deep)] flex flex-col shrink-0">
            {/* Search Input Bar */}
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <div className="relative group">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-placeholder group-focus-within:text-[var(--brand)] transition-colors" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Scan laboratory components..."
                  className="w-full bg-deep border border-[var(--border-subtle)] rounded-lg pl-9 pr-4 py-1.5 text-[10px] font-mono text-white outline-none focus:border-[var(--brand)]/40 transition-colors placeholder:text-dim"
                />
              </div>
            </div>

            {/* Scope Selection Menu Tabs */}
            <div className="p-2 space-y-0.5 border-b border-[var(--border-subtle)] shrink-0">
              {[
                { id: 'templates', label: 'Templates', icon: BookTemplate, count: premiumTemplates.length },
                { id: 'my_scripts', label: 'My Scripts', icon: Code, count: userScripts.length },
                { id: 'team_scripts', label: 'Team Scripts', icon: Users, count: userScripts.filter(s => s.is_shared).length },
                { id: 'recent', label: 'Recents', icon: RotateCcw, count: recentScriptIds.length }
              ].map((scope) => {
                const Icon = scope.icon;
                const isActive = activeTab === scope.id;
                return (
                  <button
                    key={scope.id}
                    onClick={() => {
                      setActiveTab(scope.id as any);
                      setSelectedCategoryId(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-[9px] font-black uppercase tracking-widest border border-transparent",
                      isActive 
                        ? "bg-[var(--brand)]/10 text-[var(--brand)] border-[var(--brand-border)] shadow-[0_0_10px_var(--brand-muted)]" 
                        : "text-dim hover:bg-white/[0.02] hover:text-white"
                    )}
                  >
                    <Icon size={13} className={isActive ? "text-[var(--brand)]" : "text-dim"} />
                    <span className="flex-1 truncate">{scope.label}</span>
                    <span className="text-[8px] font-mono text-placeholder">{scope.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Categories sidebar lists */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-0.5">
              <div className="px-3 py-2 text-[8px] font-black text-placeholder uppercase tracking-widest">Library Sectors</div>
              
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors text-[9px] font-bold uppercase tracking-widest",
                  selectedCategoryId === null ? "text-[var(--brand)] bg-[var(--brand)]/5" : "text-dim hover:bg-white/[0.01] hover:text-muted"
                )}
              >
                <span>All Sectors</span>
              </button>

              {categories.map((catName) => {
                const count = (activeTab === 'templates' ? premiumTemplates : userScripts).filter(s => s.category_id === catName).length;
                return (
                  <button
                    key={catName}
                    onClick={() => setSelectedCategoryId(catName)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-colors text-[9px] font-bold uppercase tracking-widest truncate",
                      selectedCategoryId === catName ? "text-[var(--brand)] bg-[var(--brand)]/5" : "text-dim hover:bg-white/[0.01] hover:text-muted"
                    )}
                  >
                    <span className="truncate pr-2">{catName}</span>
                    <span className="text-[8px] font-mono text-dim">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Middle list cards of Scripts */}
          <div className="w-80 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col shrink-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0 bg-[var(--bg-deep)]/20">
              <span className="text-[9px] font-black text-dim uppercase tracking-widest">Available Components ({currentScripts.length})</span>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2.5">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin text-[var(--brand)]"><RotateCcw size={20} /></div>
                </div>
              ) : currentScripts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <TerminalSquare size={36} className="text-[var(--border-subtle)] mb-3" />
                  <span className="text-[9px] font-black text-placeholder uppercase tracking-widest leading-relaxed">No matching scripts mapped</span>
                </div>
              ) : (
                currentScripts.map((script) => {
                  const isFav = Array.isArray(scriptFavorites) && scriptFavorites.includes(script.id);
                  const isSelected = selectedScript?.id === script.id;
                  return (
                    <div
                      key={script.id}
                      onClick={() => {
                        setSelectedScript(script);
                        setShowInjectPanel(false);
                        setIsEditing(false);
                      }}
                      className={cn(
                        "group p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-2 relative",
                        isSelected 
                          ? "bg-[var(--brand)]/5 border-[var(--brand)]/35 shadow-lg" 
                          : "bg-sidebar border-[var(--border-subtle)] hover:bg-surface hover:border-[#222225]"
                      )}
                    >
                      <div className="flex items-start justify-between min-w-0 pr-6">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-wide truncate",
                          isSelected ? "text-[var(--brand)]" : "text-white group-hover:text-[var(--brand)]"
                        )}>
                          {script.name}
                        </span>
                        
                        <button
                          onClick={(e) => toggleFavorite(script.id, e)}
                          className="absolute top-3 right-3 p-1 rounded hover:bg-white/5 transition-colors"
                        >
                          <Star size={11} className={cn("transition-colors", isFav ? "fill-yellow-500 text-yellow-500" : "text-[#33333A] hover:text-white")} />
                        </button>
                      </div>

                      <p className="text-[9px] text-dim line-clamp-2 leading-relaxed">
                        {script.description}
                      </p>

                      <div className="flex items-center justify-between pt-1 mt-auto">
                        <div className="flex items-center gap-1.5">
                          {script.is_builtin ? (
                            <span className="text-[7px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded">Core</span>
                          ) : (
                            <span className="text-[7px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.5 rounded">User</span>
                          )}
                          <span className="text-[7px] text-dim font-mono">v{script.version}</span>
                        </div>

                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!script.is_builtin && (
                            <button
                              onClick={(e) => handleDeleteCustomScript(script.id, e)}
                              className="p-1 hover:text-red-500 text-dim transition-colors"
                              title="Delete custom script"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                          <ChevronRight size={12} className={cn("transition-colors", isSelected ? "text-[var(--brand)]" : "text-dim")} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. Right script details / Preview panel */}
          <div className="flex-1 flex flex-col bg-deep overflow-hidden relative">
            <AnimatePresence mode="wait">
              {selectedScript ? (
                <motion.div
                  key={selectedScript.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  {/* Preview Meta Header */}
                  <div className="p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-deep)]/40 shrink-0">
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-3 max-w-lg">
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="w-full bg-deep border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-[11px] font-mono text-white outline-none focus:border-[var(--brand)]"
                              placeholder="Script name..."
                            />
                            <textarea
                              value={editDesc}
                              onChange={e => setEditDesc(e.target.value)}
                              rows={2}
                              className="w-full bg-deep border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-[10px] text-muted outline-none focus:border-[var(--brand)] resize-none"
                              placeholder="Description..."
                            />
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={handleSaveEdit}
                                className="px-3 py-1 bg-[var(--brand)] text-[var(--bg-deep)] text-[9px] font-black uppercase tracking-widest rounded-lg"
                              >
                                Save details
                              </button>
                              <button
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-1 bg-transparent hover:bg-white/5 border border-[var(--border-subtle)] text-[9px] font-black uppercase tracking-widest rounded-lg text-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <h1 className="text-sm font-black text-white uppercase tracking-tight truncate">{selectedScript.name}</h1>
                              {selectedScript.is_builtin ? (
                                <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">Official core</span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">User module</span>
                              )}
                              {selectedScript.is_shared && (
                                <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20">Team Shared</span>
                              )}
                            </div>
                            <p className="text-[10px] text-dim leading-relaxed max-w-xl pr-4">{selectedScript.description}</p>
                          </>
                        )}
                      </div>

                      {/* Top Action Triggers */}
                      {!isEditing && (
                        <div className="flex items-center gap-2 shrink-0">
                          {selectedScript.is_builtin ? (
                            <button
                              onClick={handleDuplicate}
                              className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-sidebar hover:bg-[#141415] text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-1.5 transition-all"
                              title="Duplicate to My Scripts to customize"
                            >
                              <Copy size={11} /> Customize
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditName(selectedScript.name);
                                  setEditDesc(selectedScript.description);
                                  setIsEditing(true);
                                }}
                                className="p-2 rounded-lg border border-[var(--border-subtle)] bg-sidebar hover:bg-[#141415] text-muted hover:text-white transition-all flex items-center justify-center"
                                title="Edit name & description"
                              >
                                <Edit3 size={11} />
                              </button>

                              <button
                                onClick={handleToggleShare}
                                className={cn(
                                  "p-2 rounded-lg border transition-all flex items-center justify-center",
                                  selectedScript.is_shared 
                                    ? "bg-purple-500/10 border-purple-500/30 text-purple-400" 
                                    : "bg-sidebar border-[var(--border-subtle)] text-muted hover:text-white"
                                )}
                                title={selectedScript.is_shared ? "Unshare from Team" : "Share with Team"}
                              >
                                <Share2 size={11} />
                              </button>
                            </>
                          )}

                          <button
                            onClick={handleCopy}
                            className="p-2 rounded-lg border border-[var(--border-subtle)] bg-sidebar hover:bg-[#141415] text-white flex items-center justify-center transition-all"
                            title="Copy to clipboard"
                          >
                            {copied ? <CheckCircle2 size={11} className="text-[var(--brand)]" /> : <Copy size={11} />}
                          </button>

                          <button
                            onClick={handleLoadScriptClick}
                            className="px-3.5 py-1.5 rounded-lg bg-[var(--brand)] text-[var(--bg-deep)] hover:brightness-115 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_var(--brand-muted)] transition-all"
                          >
                            <Play size={11} /> Load Script
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Script tags info */}
                    {!isEditing && selectedScript.tags && selectedScript.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3.5">
                        {selectedScript.tags.map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 rounded bg-surface border border-[var(--border-subtle)] text-[8px] font-mono text-dim uppercase">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Monaco Live Preview Box */}
                  <div className="flex-1 relative overflow-hidden">
                    <Suspense fallback={
                      <div className="absolute inset-0 flex items-center justify-center bg-deep text-dim text-[10px] font-mono">
                        Injecting laboratory editor engine...
                      </div>
                    }>
                      <Editor
                        height="100%"
                        language="javascript"
                        theme={theme === 'light' ? 'vs' : 'vs-dark'}
                        value={selectedScript.content}
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          fontSize: 12,
                          fontFamily: 'JetBrains Mono',
                          padding: { top: 15, bottom: 15 },
                          scrollBeyondLastLine: false,
                          lineNumbers: 'on',
                          scrollbar: {
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8
                          }
                        }}
                      />
                    </Suspense>
                  </div>
                </motion.div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
                  <TerminalSquare size={48} className="text-[var(--border-subtle)] mb-4" />
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Script Laboratory Core</h3>
                  <p className="text-[9px] text-dim max-w-sm leading-relaxed mt-2 uppercase tracking-wide">
                    Select any protocol handler, helper, or assertion suite to inspect, customize, and load into your requests.
                  </p>
                </div>
              )}
            </AnimatePresence>

            {/* Injection Setup Panel Overlay */}
            <AnimatePresence>
              {showInjectPanel && selectedScript && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="absolute inset-x-0 bottom-0 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] shadow-2xl p-6 z-20 space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                        <Zap size={12} className="text-[var(--brand)]" /> Load workflow config
                      </h3>
                      <p className="text-[8px] text-dim uppercase tracking-widest font-black mt-0.5">Determine routing and injection logic</p>
                    </div>
                    <button
                      onClick={() => setShowInjectPanel(false)}
                      className="p-1 text-dim hover:text-white rounded hover:bg-white/5 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Settings selectors */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* 1. Target Selectors */}
                    <div className="space-y-2">
                      <span className="text-[8px] font-black text-dim uppercase tracking-widest">Routing Target</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'pre_request_script', label: 'Pre-request' },
                          { id: 'test_script', label: 'Assertion / Tests' }
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setInjectTarget(t.id as any)}
                            className={cn(
                              "px-3 py-2 rounded-lg text-center text-[9px] font-black uppercase tracking-widest border transition-all",
                              injectTarget === t.id
                                ? "bg-[var(--brand)]/10 border-[var(--brand)] text-[var(--brand)]"
                                : "bg-deep border-[var(--border-subtle)] text-dim hover:border-strong hover:text-white"
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Injection logic */}
                    <div className="space-y-2">
                      <span className="text-[8px] font-black text-dim uppercase tracking-widest">Injection Mode</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'append', label: 'Append Code' },
                          { id: 'replace', label: 'Overwrite' }
                        ].map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setInjectMode(m.id as any)}
                            className={cn(
                              "px-3 py-2 rounded-lg text-center text-[9px] font-black uppercase tracking-widest border transition-all",
                              injectMode === m.id
                                ? "bg-[var(--brand)]/10 border-[var(--brand)] text-[var(--brand)]"
                                : "bg-deep border-[var(--border-subtle)] text-dim hover:border-strong hover:text-white"
                            )}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Active Request Warning */}
                  {injectMode === 'replace' && activeRequest && activeRequest[injectTarget] && (
                    <div className="px-4 py-2.5 bg-yellow-500/5 border border-yellow-500/20 rounded-xl flex items-center gap-3">
                      <AlertTriangle size={14} className="text-yellow-500 shrink-0" />
                      <span className="text-[9px] font-bold text-yellow-500/80 uppercase tracking-wide leading-relaxed">
                        Warning: overwriting will replace the existing script block. This action is irreversible.
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-1 border-t border-[var(--border-subtle)]">
                    <button
                      onClick={() => setShowInjectPanel(false)}
                      className="px-4 py-2 bg-transparent border border-[var(--border-subtle)] text-white hover:bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmInjection}
                      className="px-5 py-2 bg-[var(--brand)] text-[var(--bg-deep)] hover:brightness-110 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-[0_0_15px_var(--brand-muted)] transition-all"
                    >
                      Confirm Routing Injection
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

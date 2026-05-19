import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  Folder, 
  FolderOpen,
  ChevronRight, 
  ChevronDown, 
  MoreVertical, 
  Plus, 
  Search,
  Globe,
  Users,
  Settings,
  Zap,
  LayoutGrid,
  Activity,
  Trash2,
  GripVertical,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  Edit3,
  FileDown,
  FileUp,
  RefreshCw,
  FolderPlus,
  FilePlus,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Database,
  Terminal,
  LogOut,
  Pin,
  Play,
  Square
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Collection, Folder as FolderType, RequestData, Environment } from '../../types';
import { PersistenceService } from '../../services/PersistenceService';
import { CollectionExportService } from '../../services/CollectionExportService';
import { GitHubService } from '../../services/GitHubService';
import { NameModal } from '../../components/NameModal';
import { TeamModal } from '../../components/TeamModal';
import { EnvironmentModal } from '../../components/EnvironmentModal';
import { ShareModal } from '../../components/ShareModal';
import { CollectionImportModal } from '../../components/CollectionImportModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { SettingsModal } from '../../components/SettingsModal';
import { SmokeSuiteModal } from '../../components/SmokeSuiteModal';
import { useDataSync } from '../../hooks/useDataSync';
import { RequestService } from '../../services/RequestService';
import { ScriptService } from '../../services/ScriptService';
import { VariableService } from '../../services/VariableService';

// Slim navigation tab configuration
const NAV_ITEMS = [
  { id: 'collections', icon: LayoutGrid, label: 'Collections', desc: 'Collection Tree' },
  { id: 'environments', icon: Globe, label: 'Environments', desc: 'API Environments' },
  { id: 'scripts', icon: Zap, label: 'Scripts', desc: 'Logic Library' },
  { id: 'smoke', icon: Activity, label: 'Smoke Testing', desc: 'Bulk Runner' },
  { id: 'history', icon: Clock, label: 'Logs', desc: 'Realtime Traffic' },
  { id: 'teams', icon: Users, label: 'Teams', desc: 'Collaborators' }
];

export const Sidebar: React.FC = () => {
  const { 
    collections, 
    addTab, 
    updateRequest,
    updateCollection,
    sidebarWidth,
    setSidebarWidth,
    isSidebarPinned,
    setIsSidebarPinned,
    activeWorkspaceId,
    workspaces,
    profile,
    environments,
    history,
    teams,
    activeEnvId,
    setActiveEnvId,
    addToast,
    reorderCollection,
    reorderFolder,
    reorderRequest,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    activeTabId,
    canPerformAction
  } = useStore();
  
  const { logout } = useAuth();
  const { fetchCollections, fetchEnvironments, fetchHistory, fetchTeams } = useDataSync();

  // State Management
  const [activeNav, setActiveNav] = useState('collections');
  const [searchQuery, setSearchQuery] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'error'>('all');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    try {
      const cached = localStorage.getItem('gmy_expanded_nodes');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // Modal Context to unify all CRUD operations
  const [modalContext, setModalContext] = useState<{
    type: 'collection' | 'folder' | 'request';
    action: 'create_folder' | 'create_request' | 'rename' | 'delete' | 'move';
    id: string;
    name?: string;
    collectionId?: string;
    parentId?: string;
    initialValue?: string;
  } | null>(null);

  // Moving Requests State
  const [movingRequest, setMovingRequest] = useState<RequestData | null>(null);

  // Script Copy confirmation overlay
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Selected object context for panels
  const [selectedEnv, setSelectedEnv] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  // Modals visibility toggles
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareCollection, setShareCollection] = useState<Collection | null>(null);

  // Smoke testing modal state
  const [isSmokeModalOpen, setIsSmokeModalOpen] = useState(false);

  // Right Click Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'collection' | 'folder' | 'request';
    id: string;
    name: string;
    collectionId?: string;
    parentId?: string;
  } | null>(null);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const isExpanded = isSidebarPinned || isHoverExpanded;
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  // Persist expanded nodes to localStorage
  const toggleNodeExpanded = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      localStorage.setItem('gmy_expanded_nodes', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedNodes({});
    localStorage.removeItem('gmy_expanded_nodes');
    addToast({ type: 'info', message: 'All explorer branches collapsed.' });
  }, [addToast]);

  // Handle Drag & Drop Sorting
  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const { draggableId, destination, type } = result;
    
    if (type === 'collection') {
      reorderCollection(draggableId, destination.index);
    } else if (type === 'folder') {
      const collectionId = draggableId.split(':')[0];
      const folderId = draggableId.split(':')[1];
      reorderFolder(collectionId, folderId, destination.index);
    } else if (type === 'request') {
      const parts = draggableId.split(':');
      const collectionId = parts[0];
      const requestId = parts[1];
      const folderId = parts.length > 2 ? parts[2] : undefined;
      reorderRequest(collectionId, requestId, destination.index, folderId);
    }
  };

  // Handle resizing sub-panel width
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate relative to the 50px left nav bar
      const newWidth = e.clientX - 50;
      if (newWidth > 200 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  // Auto close context menu when click elsewhere
  useEffect(() => {
    const handleOutside = () => {
      setContextMenu(null);
      if (!isSidebarPinned && sidebarRef.current && !sidebarRef.current.matches(':hover')) {
        setIsHoverExpanded(false);
      }
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, [isSidebarPinned]);

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setIsSidebarPinned(!isSidebarPinned);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarPinned, setIsSidebarPinned]);

  // Mouse Hover Expand Logic for Collapsed Sidebar
  const handleMouseEnterNav = () => {
    if (isSidebarPinned) return;
    if (hoverTimeout) clearTimeout(hoverTimeout);
    const to = setTimeout(() => setIsHoverExpanded(true), 150);
    setHoverTimeout(to);
  };

  const handleMouseLeaveSidebar = () => {
    if (isSidebarPinned) return;
    if (hoverTimeout) clearTimeout(hoverTimeout);
    const to = setTimeout(() => {
      if (contextMenu) return;
      setIsHoverExpanded(false);
      setContextMenu(null);
    }, 450);
    setHoverTimeout(to);
  };

  // Perform resource modifications
  const handleCreateCollection = async (name: string) => {
    if (!activeWorkspaceId || !profile?.id) return;
    try {
      const col = await PersistenceService.createCollection(activeWorkspaceId, profile.id, name);
      await fetchCollections(activeWorkspaceId);
      addTab(col);
      addToast({ type: 'success', message: `Collection "${name}" deployed.` });
    } catch {
      addToast({ type: 'error', message: 'Failed to deploy collection.' });
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!profile?.id || !activeWorkspaceId || !modalContext) return;
    try {
      const { collectionId, parentId } = modalContext;
      await PersistenceService.createFolder(name, collectionId!, profile.id, parentId, activeWorkspaceId);
      await fetchCollections(activeWorkspaceId);
      addToast({ type: 'success', message: `Folder "${name}" established.` });
    } catch {
      addToast({ type: 'error', message: 'Failed to deploy folder.' });
    } finally {
      setModalContext(null);
    }
  };

  const handleCreateRequest = async (name: string) => {
    if (!profile?.id || !activeWorkspaceId || !modalContext) return;
    try {
      const { collectionId, parentId } = modalContext;
      const newRequest = await PersistenceService.createRequest({
        name,
        collection_id: collectionId!,
        folder_id: parentId,
        workspace_id: activeWorkspaceId,
        user_id: profile.id,
        method: 'GET',
        url: 'https://api.example.com',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none',
        auth: { type: 'inherit' }
      });
      useStore.getState().addRequest(newRequest);
      await fetchCollections(activeWorkspaceId);
      addTab(newRequest);
      addToast({ type: 'success', message: `Request "${name}" deployed.` });
    } catch {
      addToast({ type: 'error', message: 'Failed to deploy request.' });
    } finally {
      setModalContext(null);
    }
  };

  const handleRenameResource = async (newName: string) => {
    if (!activeWorkspaceId || !modalContext) return;
    try {
      const { type, id } = modalContext;
      if (type === 'collection') {
        updateCollection(id, { name: newName });
        addToast({ type: 'info', message: 'Collection identity updated.' });
      } else if (type === 'folder') {
        await PersistenceService.updateFolder(id, { name: newName });
        await fetchCollections(activeWorkspaceId);
        addToast({ type: 'success', message: 'Folder identity updated.' });
      } else if (type === 'request') {
        updateRequest(id, { name: newName });
        addToast({ type: 'info', message: 'Request identity updated.' });
      }
    } catch {
      addToast({ type: 'error', message: 'Identity update failed.' });
    } finally {
      setModalContext(null);
    }
  };

  const handleConfirmedDelete = async () => {
    if (!activeWorkspaceId || !modalContext) return;
    try {
      const { type, id, name } = modalContext;
      if (type === 'collection') {
        await PersistenceService.deleteCollection(id);
        await fetchCollections(activeWorkspaceId);
        addToast({ type: 'info', message: `Collection "${name}" decommissioned.` });
      } else if (type === 'folder') {
        await PersistenceService.deleteFolder(id);
        await fetchCollections(activeWorkspaceId);
        addToast({ type: 'info', message: `Folder "${name}" liquidated.` });
      } else if (type === 'request') {
        await PersistenceService.deleteRequest(id);
        await fetchCollections(activeWorkspaceId);
        addToast({ type: 'info', message: `Request "${name}" dismantled.` });
      }
    } catch {
      addToast({ type: 'error', message: 'Purge failed.' });
    } finally {
      setModalContext(null);
    }
  };

  const handleManualRefresh = async () => {
    if (isRefreshing || !activeWorkspaceId) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchCollections(activeWorkspaceId),
        fetchEnvironments(activeWorkspaceId),
        fetchHistory(activeWorkspaceId),
        profile?.id ? fetchTeams(profile.id) : Promise.resolve()
      ]);
      addToast({ type: 'success', message: 'API Workspace synchronized.' });
    } catch {
      addToast({ type: 'error', message: 'Failed to refresh workspace.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Move request execution
  const handleMoveRequest = async (targetColId: string, targetFolderId?: string) => {
    if (!movingRequest || !activeWorkspaceId) return;
    try {
      await PersistenceService.updateRequest(movingRequest.id, {
        collection_id: targetColId,
        folder_id: targetFolderId || null
      });
      await fetchCollections(activeWorkspaceId);
      addToast({
        type: 'success',
        message: `Request moved to ${targetFolderId ? 'target folder' : 'collection root'}.`
      });
    } catch {
      addToast({ type: 'error', message: 'Failed to move request.' });
    } finally {
      setMovingRequest(null);
    }
  };

  // Filter and search collections
  const filteredCollections = useMemo(() => {
    if (!collections) return [];
    
    // Deep clone and filter
    const copy = JSON.parse(JSON.stringify(collections)) as Collection[];
    
    const matchesSearch = (str?: string) => 
      str ? str.toLowerCase().includes(searchQuery.toLowerCase()) : false;

    const filterNode = (node: any): boolean => {
      // Filter requests
      if (node.requests) {
        node.requests = node.requests.filter((r: RequestData) => {
          const matchesSec = matchesSearch(r.name) || matchesSearch(r.url) || matchesSearch(r.method);
          const matchesMeth = methodFilter ? r.method === methodFilter : true;
          return matchesSec && matchesMeth;
        });
      }

      // Filter subfolders
      if (node.folders) {
        node.folders = node.folders.filter((f: any) => filterNode(f));
      }

      // Keep folder if search matches folder name, or it has matching child folders/requests
      const folderMatches = matchesSearch(node.name);
      const hasContent = (node.requests && node.requests.length > 0) || (node.folders && node.folders.length > 0);

      return folderMatches || hasContent;
    };

    return copy.filter(col => {
      if (!searchQuery && !methodFilter) return true;
      const colMatches = matchesSearch(col.name);
      
      // Filter collections recursively
      col.folders = col.folders?.filter(f => filterNode(f)) || [];
      col.requests = col.requests?.filter(r => {
        const matchesSec = matchesSearch(r.name) || matchesSearch(r.url) || matchesSearch(r.method);
        const matchesMeth = methodFilter ? r.method === methodFilter : true;
        return matchesSec && matchesMeth;
      }) || [];

      const hasContent = col.folders.length > 0 || col.requests.length > 0;
      return colMatches || hasContent;
    });
  }, [collections, searchQuery, methodFilter]);

  // Scripts catalog definitions
  const scriptSnippets = [
    {
      title: 'Pre-request Context',
      items: [
        { name: 'Set Env Variable', code: 'gmy.environment.set("key", "value");' },
        { name: 'Get Env Variable', code: 'const token = gmy.environment.get("key");' },
        { name: 'Unset Env Variable', code: 'gmy.environment.unset("key");' },
        { name: 'Get Global Variable', code: 'const val = gmy.globals.get("key");' },
        { name: 'Send HTTP Request', code: 'gmy.request({\n  url: "https://httpbin.org/get",\n  method: "GET"\n}, (err, res) => {\n  console.log(res.json());\n});' }
      ]
    },
    {
      title: 'Post-Execution Validation',
      items: [
        { name: 'Status Code: 200 OK', code: 'gmy.test("Status is 200 OK", () => {\n  gmy.expect(res.status).to.equal(200);\n});' },
        { name: 'JSON Property Check', code: 'gmy.test("Response body exists", () => {\n  const json = res.json();\n  gmy.expect(json.id).to.exist;\n});' },
        { name: 'Header Content Check', code: 'gmy.test("Check Server Header", () => {\n  gmy.expect(res.headers["content-type"]).to.include("application/json");\n});' },
        { name: 'Latency Threshold', code: 'gmy.test("Response under 200ms", () => {\n  gmy.expect(res.responseTime).to.be.below(200);\n});' }
      ]
    }
  ];

  // Real-time Traffic Logs filtered list
  const filteredLogs = useMemo(() => {
    if (!history) return [];
    return history.filter(item => {
      // Method Filter
      if (methodFilter && item.method !== methodFilter) return false;
      // Success/Error Filter
      if (logFilter === 'success' && (item.status && item.status >= 400)) return false;
      if (logFilter === 'error' && (!item.status || item.status < 400)) return false;
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const urlMatch = item.url && item.url.toLowerCase().includes(query);
        const nameMatch = item.request_name && item.request_name.toLowerCase().includes(query);
        return urlMatch || nameMatch;
      }
      return true;
    });
  }, [history, methodFilter, logFilter, searchQuery]);

  // Copy helper
  const handleCopySnippet = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(code);
    addToast({ type: 'success', message: 'Script snippet copied to clipboard.' });
    setTimeout(() => setCopiedSnippet(null), 1000);
  };

  // Append snippet to active script editor
  const handleAppendSnippet = (code: string) => {
    const activeTab = useStore.getState().openTabs.find(t => t.id === activeTabId);
    if (!activeTab || !('method' in activeTab)) {
      addToast({ type: 'warning', message: 'Please open a request tab first.' });
      return;
    }
    const request = activeTab as RequestData;
    // Append code dynamically
    const targetScript = 'test_script';
    const oldCode = request.test_script || '';
    const newCode = oldCode ? `${oldCode}\n\n${code}` : code;
    updateRequest(request.id, { [targetScript]: newCode });
    addToast({ type: 'success', message: 'Snippet appended to test script editor.' });
  };

  return (
    <div 
      ref={sidebarRef}
      onMouseLeave={handleMouseLeaveSidebar}
      className={cn(
        "h-full flex relative z-40 shrink-0 bg-[#070708] border-r border-[#151518]",
        !isSidebarPinned && "overflow-visible"
      )}
      style={{
        width: isSidebarPinned ? `${sidebarWidth + 50}px` : '50px',
        transition: isResizing ? 'none' : 'width 250ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* 1. Left Slim Navigation Icon Bar (VS Code style) */}
      <div 
        onMouseEnter={handleMouseEnterNav}
        className="w-[50px] h-full bg-[#09090B] border-r border-[#151518] flex flex-col items-center py-4 justify-between select-none shrink-0"
      >
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Logo Brand Icon */}
          <div 
            className="w-8 h-8 rounded-lg bg-[var(--brand-muted)] flex items-center justify-center border border-[var(--brand-border)] mb-3 select-none"
          >
            <Sparkles size={14} className="text-[var(--brand)] animate-pulse" />
          </div>

          {/* Navigation selectors */}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <div key={item.id} className="relative group/nav-btn w-full flex justify-center">
                <button
                  onClick={() => {
                    if (item.id === 'smoke') {
                      setIsSmokeModalOpen(true);
                      return;
                    }
                    setActiveNav(item.id);
                    setIsHoverExpanded(true);
                  }}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 relative group/btn",
                    isActive 
                      ? "bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/20 shadow-[0_0_12px_rgba(62,207,142,0.1)]" 
                      : "text-[#55555C] hover:text-[#E0E0E6] hover:bg-white/[0.02]"
                  )}
                >
                  <Icon size={16} className="group-hover/btn:scale-105 transition-transform duration-200" />
                  {/* Left indicator bar */}
                  {isActive && (
                    <motion.div 
                      layoutId="active-nav-bullet"
                      className="absolute left-0 w-[3px] h-5 bg-[#3ECF8E] rounded-r-md top-1/2 -translate-y-1/2 shadow-[0_0_8px_#3ECF8E]"
                    />
                  )}
                </button>

                {/* Collapsed mode custom hover tooltips */}
                {!isExpanded && (
                  <div className="absolute left-[54px] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#0F0F12] border border-[#1D1D22] text-[9px] font-black uppercase tracking-widest text-[#E0E0E6] rounded-md opacity-0 group-hover/nav-btn:opacity-100 translate-x-2 group-hover/nav-btn:translate-x-0 transition-all duration-200 pointer-events-none z-[100] whitespace-nowrap shadow-[8px_0_24px_rgba(0,0,0,0.8)] border-l-2 border-l-[#3ECF8E]">
                    <div className="font-bold">{item.label}</div>
                    <div className="text-[7px] text-[#55555C] font-mono mt-0.5">{item.desc}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Settings Icon */}
          <button 
            onClick={() => setIsSettingsModalOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#55555C] hover:text-[#E0E0E6] hover:bg-white/[0.02] transition-all duration-200"
            title="System Configuration"
          >
            <Settings size={15} />
          </button>

          {/* User profile initials block */}
          <div className="w-8 h-8 rounded-full bg-[#1A1A1E] border border-[#26262B] flex items-center justify-center text-[10px] font-black text-[#88888F] uppercase cursor-pointer hover:border-[#3ECF8E]/40 hover:text-white transition-all duration-300 relative group/avatar">
            {profile?.full_name?.substring(0, 2) || 'U'}
            
            {/* Quick avatar status dot */}
            <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#3ECF8E] border-2 border-[#09090B] shadow-[0_0_5px_#3ECF8E]" />

            {/* Micro logout popover */}
            <div className="absolute left-full pl-2 bottom-0 hidden group-hover/avatar:flex flex-col w-48 z-[100] animate-in fade-in duration-200">
              <div className="bg-[#0F0F12] border border-[#1D1D22] rounded-xl shadow-2xl p-3 flex flex-col w-full backdrop-blur-xl">
                <div className="text-[9px] font-bold text-white uppercase tracking-wider truncate">{profile?.full_name || 'Protocol User'}</div>
                <div className="text-[8px] text-[#55555C] font-mono truncate mt-0.5">{profile?.email}</div>
                <div className="h-px bg-[#1D1D22] my-2" />
                <button 
                  onClick={() => logout()}
                  className="w-full py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
                >
                  <LogOut size={10} /> Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Expandable Right Sub-panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: sidebarWidth }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className={cn(
              "h-full flex flex-col relative select-none bg-[#0B0B0C] shrink-0 border-r border-[#151518]",
              !isSidebarPinned && "z-50 absolute left-[50px] top-0 bottom-0 backdrop-blur-xl bg-[#0B0B0C]/95"
            )}
            style={{ width: `${sidebarWidth}px` }}
          >
            {/* Header Unit context */}
            <div className="h-14 border-b border-[#1A1A1E] flex items-center justify-between px-5 bg-[#09090B]/60 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] shadow-[0_0_8px_#3ECF8E]" />
                  <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] truncate">
                    {activeWorkspace?.name || 'Workspace'}
                  </h2>
                </div>
                <p className="text-[7px] text-[#55555C] font-mono tracking-tighter uppercase font-bold mt-0.5">
                  Node Engine // {activeWorkspace?.visibility || 'Private'}
                </p>
              </div>

              {/* Pin/Collapse trigger */}
              <button 
                onClick={() => setIsSidebarPinned(!isSidebarPinned)}
                className="p-1.5 text-[#55555C] hover:text-[var(--brand)] rounded hover:bg-white/[0.02] transition-colors"
                title={isSidebarPinned ? "Unlock Sidebar" : "Lock Sidebar"}
              >
                <Pin size={14} className={cn("transition-transform duration-200", !isSidebarPinned && "rotate-45")} />
              </button>
            </div>

            {/* Global Search and Filter Header */}
            {activeNav !== 'scripts' && (
              <div className="px-5 py-3 border-b border-[#1A1A1E] bg-[#070708]/30 flex flex-col gap-2 shrink-0">
                <div className="relative group">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#44444F] group-focus-within:text-[#3ECF8E] transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Scan directory components..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#070708] border border-[#1A1A1E] rounded-lg py-1.5 pl-8 pr-6 text-[10px] font-mono text-[#E0E0E6] placeholder-[#44444F] focus:border-[#3ECF8E]/30 outline-none transition-all focus:shadow-[0_0_10px_rgba(62,207,142,0.02)]"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold uppercase text-[#55555C] hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Filter chips (GET, POST, Success, Error) */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  <button 
                    onClick={() => setMethodFilter(methodFilter ? null : 'GET')}
                    className={cn(
                      "text-[8px] font-black uppercase px-2 py-0.5 rounded border transition-all shrink-0 font-mono",
                      methodFilter === 'GET' 
                        ? "bg-[#3ECF8E]/10 border-[#3ECF8E]/35 text-[#3ECF8E] shadow-[0_0_8px_rgba(62,207,142,0.05)]" 
                        : "bg-[#09090B] border-[#1A1A1E] text-[#55555C] hover:text-[#AAAAAF]"
                    )}
                  >
                    GET
                  </button>
                  <button 
                    onClick={() => setMethodFilter(methodFilter ? null : 'POST')}
                    className={cn(
                      "text-[8px] font-black uppercase px-2 py-0.5 rounded border transition-all shrink-0 font-mono",
                      methodFilter === 'POST' 
                        ? "bg-amber-500/10 border-amber-500/35 text-amber-500" 
                        : "bg-[#09090B] border-[#1A1A1E] text-[#55555C] hover:text-[#AAAAAF]"
                    )}
                  >
                    POST
                  </button>
                  {activeNav === 'history' && (
                    <>
                      <button 
                        onClick={() => setLogFilter(logFilter === 'success' ? 'all' : 'success')}
                        className={cn(
                          "text-[8px] font-black uppercase px-2 py-0.5 rounded border transition-all shrink-0",
                          logFilter === 'success' 
                            ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-500" 
                            : "bg-[#09090B] border-[#1A1A1E] text-[#55555C] hover:text-[#AAAAAF]"
                        )}
                      >
                        Success
                      </button>
                      <button 
                        onClick={() => setLogFilter(logFilter === 'error' ? 'all' : 'error')}
                        className={cn(
                          "text-[8px] font-black uppercase px-2 py-0.5 rounded border transition-all shrink-0",
                          logFilter === 'error' 
                            ? "bg-red-500/10 border-red-500/35 text-red-500" 
                            : "bg-[#09090B] border-[#1A1A1E] text-[#55555C] hover:text-[#AAAAAF]"
                        )}
                      >
                        Failures
                      </button>
                    </>
                  )}
                  {(methodFilter || logFilter !== 'all') && (
                    <button 
                      onClick={() => { setMethodFilter(null); setLogFilter('all'); }}
                      className="text-[8px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest pl-1 shrink-0"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable Sub-panel Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-2 relative">
              
              {/* SECTION A: Explorer Tree (Collections) */}
              {activeNav === 'collections' && (
                <div className="px-1 flex flex-col h-full">
                  {/* Explorer Sub-Toolbar */}
                  <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#1A1A1E]/30 bg-[#070708]/10 mb-2 shrink-0">
                    <span className="text-[8px] font-black text-[#55555C] uppercase tracking-[0.2em] font-mono">Collections</span>
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => setIsCollectionModalOpen(true)}
                        className="p-1 hover:text-[#3ECF8E] text-[#55555C] transition-colors"
                        title="New Collection"
                      >
                        <Plus size={13} />
                      </button>
                      <button 
                        onClick={() => setIsImportModalOpen(true)}
                        className="p-1 hover:text-[#3ECF8E] text-[#55555C] transition-colors"
                        title="Import Collection Schema"
                      >
                        <FileUp size={13} />
                      </button>
                      <button 
                        onClick={collapseAll}
                        className="p-1 hover:text-red-400 text-[#55555C] transition-colors"
                        title="Collapse All Tree Nodes"
                      >
                        <ChevronsLeft size={13} />
                      </button>
                      <button 
                        onClick={handleManualRefresh}
                        className="p-1 hover:text-[#3ECF8E] text-[#55555C] transition-colors"
                        title="Synchronize Local Cache"
                      >
                        <RefreshCw size={12} className={cn(isRefreshing && "animate-spin text-[#3ECF8E]")} />
                      </button>
                    </div>
                  </div>

                  {/* Move Request Mode Alert Banner */}
                  {movingRequest && (
                    <div className="mx-3 mb-3 p-2 bg-[#3ECF8E]/5 border border-[#3ECF8E]/20 rounded-xl text-[9px] uppercase tracking-wide flex flex-col gap-1.5 shrink-0 animate-in fade-in duration-200">
                      <div className="font-black text-[#3ECF8E] flex items-center justify-between">
                        <span>Select Relocation Target</span>
                        <button onClick={() => setMovingRequest(null)} className="text-red-500 font-bold">X</button>
                      </div>
                      <div className="text-[#88888F] font-mono">Moving: {movingRequest.name}</div>
                      <div className="text-[7px] text-[#55555C]">Click on any collection or folder to deploy here.</div>
                    </div>
                  )}

                  {/* Active Tree Nodes */}
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="collections-root" type="collection">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                          {filteredCollections.map((col, idx) => (
                            <CollectionNode 
                              key={col.id}
                              collection={col}
                              index={idx}
                              expandedNodes={expandedNodes}
                              toggleNodeExpanded={toggleNodeExpanded}
                              activeTabId={activeTabId}
                              addTab={addTab}
                              movingRequest={movingRequest}
                              handleMoveRequest={handleMoveRequest}
                              setModalContext={setModalContext}
                              setShareCollection={setShareCollection}
                              setIsShareModalOpen={setIsShareModalOpen}
                              setContextMenu={setContextMenu}
                              canEdit={canPerformAction(col, 'edit')}
                            />
                          ))}
                          {provided.placeholder}
                          {filteredCollections.length === 0 && (
                            <div className="text-center py-16 px-4">
                              <Database size={24} className="mx-auto text-[#1D1D22] mb-3" />
                              <p className="text-[9px] font-black text-[#44444F] uppercase tracking-widest leading-relaxed">No collections found</p>
                              <button 
                                onClick={() => setIsCollectionModalOpen(true)}
                                className="mt-3 px-3 py-1.5 bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 text-[9px] text-[#3ECF8E] font-black uppercase tracking-widest rounded hover:bg-[#3ECF8E]/20 transition-all"
                              >
                                New Collection
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              )}

              {/* SECTION B: Environments */}
              {activeNav === 'environments' && (
                <div className="px-5 space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-[#1A1A1E]/30 pb-2">
                    <span className="text-[9px] font-black text-[#55555C] uppercase tracking-widest font-mono">Environments</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsGlobalModalOpen(true)}
                        className="text-amber-500/70 text-[8px] font-black uppercase hover:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full transition-all tracking-wider"
                      >
                        Globals
                      </button>
                      <button 
                        onClick={() => { setSelectedEnv(null); setIsEnvModalOpen(true); }}
                        className="text-[#3ECF8E] text-[8px] font-black uppercase tracking-wider border border-[#3ECF8E]/30 px-2 py-0.5 rounded-full hover:bg-[#3ECF8E]/10 transition-all"
                      >
                        + Environment
                      </button>
                    </div>
                  </div>

                  {/* Environmental Cards Grid */}
                  <div className="space-y-2">
                    {(environments || []).map(env => {
                      const isActive = activeEnvId === env.id;
                      return (
                        <div 
                          key={env.id} 
                          onClick={() => setActiveEnvId(isActive ? null : env.id)}
                          className={cn(
                            "p-3.5 bg-[#0F0F12] border rounded-xl hover:bg-[#121216] transition-all cursor-pointer group/env relative overflow-hidden",
                            isActive 
                              ? "border-[#3ECF8E] shadow-[0_0_15px_rgba(62,207,142,0.06)]" 
                              : "border-[#1A1A22] hover:border-[#22222E]"
                          )}
                        >
                          {isActive && (
                            <div className="absolute top-0 right-0 w-8 h-8 bg-[#3ECF8E]/10 rounded-bl-full flex items-center justify-end pr-2 pt-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] shadow-[0_0_6px_#3ECF8E]" />
                            </div>
                          )}

                          <div className="flex items-center justify-between mb-2 pr-4">
                            <div className="text-[10px] font-black text-[#E0E0E6] uppercase tracking-wider font-mono">{env.name}</div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-[8px] text-[#55555C] font-black uppercase tracking-widest font-mono">
                              {env.variables?.length || 0} active variables
                            </div>
                            
                            {/* Actions overlay */}
                            <div className="flex items-center gap-1.5 opacity-0 group-hover/env:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEnv(env);
                                  setIsEnvModalOpen(true);
                                }}
                                className="p-1 hover:text-[#3ECF8E] text-[#55555C] hover:bg-white/[0.03] rounded transition-all"
                                title="Edit Environment"
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!profile?.id || !activeWorkspaceId) return;
                                  try {
                                    addToast({ type: 'info', message: 'Duplicating registry unit...' });
                                    await PersistenceService.createEnvironment(activeWorkspaceId, profile.id, `${env.name} (Copy)`, env.variables || []);
                                    await fetchEnvironments(activeWorkspaceId);
                                    addToast({ type: 'success', message: `Duplicated environment "${env.name}" successfully.` });
                                  } catch {
                                    addToast({ type: 'error', message: 'Duplication failed.' });
                                  }
                                }}
                                className="p-1 hover:text-[#3ECF8E] text-[#55555C] hover:bg-white/[0.03] rounded transition-all"
                                title="Duplicate Environment"
                              >
                                <Copy size={11} />
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await PersistenceService.deleteEnvironment(env.id);
                                    if (activeEnvId === env.id) setActiveEnvId(null);
                                    await fetchEnvironments(activeWorkspaceId!);
                                    addToast({ type: 'info', message: 'Environment purged from registry.' });
                                  } catch {
                                    addToast({ type: 'error', message: 'Purge failed.' });
                                  }
                                }}
                                className="p-1 hover:text-red-500 text-[#55555C] hover:bg-white/[0.03] rounded transition-all"
                                title="Delete Environment"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {(!environments || environments.length === 0) && (
                      <div className="text-center py-16 border border-dashed border-[#1A1A22] rounded-2xl bg-[#09090B]/30">
                        <Globe size={24} className="mx-auto text-[#1D1D22] mb-3" />
                        <p className="text-[9px] font-black text-[#44444F] uppercase tracking-widest">No environments</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION C: Scripts (Logic Catalog snippets) */}
              {activeNav === 'scripts' && (
                <div className="px-5 space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-[#1A1A1E]/30 pb-2 shrink-0">
                    <span className="text-[9px] font-black text-[#55555C] uppercase tracking-widest font-mono">Logic Library</span>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => useStore.getState().setIsScriptLabOpen(true)}
                        className="text-[#3ECF8E] text-[8px] font-black uppercase border border-[#3ECF8E]/30 px-2 py-0.5 rounded-full hover:bg-[#3ECF8E]/10 transition-all tracking-wider"
                      >
                        OPEN LAB
                      </button>
                    </div>
                  </div>

                  <p className="text-[9px] text-[#55555C] font-semibold leading-relaxed uppercase tracking-tight font-mono">
                    Copy and deploy pre-engineered automation scripts to execute transactions seamlessly.
                  </p>

                  <div className="space-y-4">
                    {scriptSnippets.map((category, catIdx) => (
                      <div key={catIdx} className="space-y-2">
                        <div className="text-[8px] font-black text-amber-500/70 uppercase tracking-widest font-mono pl-1">{category.title}</div>
                        <div className="space-y-1.5">
                          {category.items.map((snippet, idx) => (
                            <div 
                              key={idx}
                              className="group/snip p-2 bg-[#0F0F12] border border-[#1A1A22] rounded-lg hover:border-[#3ECF8E]/30 hover:bg-[#121216] transition-all flex items-center justify-between relative overflow-hidden"
                            >
                              <div className="min-w-0 pr-6">
                                <div className="text-[9px] font-bold text-[#E0E0E6] truncate font-mono uppercase tracking-wider">{snippet.name}</div>
                                <div className="text-[7px] text-[#55555C] font-mono truncate mt-0.5">{snippet.code}</div>
                              </div>

                              <div className="flex items-center gap-1.5 opacity-0 group-hover/snip:opacity-100 transition-opacity absolute right-2 bg-gradient-to-l from-[#121216] via-[#121216] to-transparent pl-4 py-1">
                                <button 
                                  onClick={() => handleCopySnippet(snippet.code)}
                                  className="p-1 hover:text-[#3ECF8E] text-[#55555C] rounded hover:bg-white/5 transition-all text-[8px] font-black uppercase tracking-wider border border-[#1A1A22]"
                                  title="Copy code"
                                >
                                  Copy
                                </button>
                                <button 
                                  onClick={() => handleAppendSnippet(snippet.code)}
                                  className="p-1 hover:text-[#3ECF8E] text-[#55555C] rounded hover:bg-white/5 transition-all text-[8px] font-black uppercase tracking-wider border border-[#1A1A22]"
                                  title="Append directly to test code pane"
                                >
                                  Append
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION D: Logs (Realtime logs streaming) */}
              {activeNav === 'history' && (
                <div className="px-1 flex flex-col h-full animate-in fade-in duration-300">
                  <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#1A1A1E]/30 bg-[#070708]/10 mb-2 shrink-0">
                    <span className="text-[8px] font-black text-[#55555C] uppercase tracking-[0.2em] font-mono">Stream transaction logs</span>
                    <button 
                      onClick={async () => {
                        if (!activeWorkspaceId || !profile?.id) return;
                        try {
                          await PersistenceService.clearHistory(activeWorkspaceId, profile.id);
                          await fetchHistory(activeWorkspaceId);
                          addToast({ type: 'info', message: 'Traffic log history cleared.' });
                        } catch {
                          addToast({ type: 'error', message: 'Failed to clear logs.' });
                        }
                      }}
                      className="text-[8px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest"
                      title="Clear History Logs"
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Logs Viewer */}
                  <div className="space-y-1">
                    {filteredLogs.map((item, idx) => {
                      const isErr = item.status && item.status >= 400;
                      return (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedLog(selectedLog?.id === item.id ? null : item)}
                          className={cn(
                            "px-4 py-2 hover:bg-white/[0.02] cursor-pointer group border-l-2 relative transition-all border-y border-[#1A1A1E]/20 bg-[#09090B]/30",
                            selectedLog?.id === item.id 
                              ? "bg-[#3ECF8E]/[0.02] border-[#3ECF8E] shadow-[inset_4px_0_12px_rgba(62,207,142,0.02)]" 
                              : (isErr ? "border-red-500/30" : "border-transparent")
                          )}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0 pr-6">
                              <span className={cn(
                                "text-[8px] font-black px-1.5 py-0.5 rounded font-mono uppercase tracking-tighter shrink-0",
                                item.method === 'GET' ? 'bg-[#3ECF8E]/10 text-[#3ECF8E]' : 
                                item.method === 'POST' ? 'bg-amber-500/10 text-amber-500' : 'bg-[#1A1A1E] text-[#AAAAAF]'
                              )}>
                                {item.method}
                              </span>
                              <span className="truncate text-[10px] text-[#88888F] font-mono group-hover:text-white transition-colors">
                                {item.request_name || item.url}
                              </span>
                            </div>

                            {/* Status and status color dot */}
                            <div className="flex items-center gap-1.5 font-mono text-[9px] shrink-0">
                              {item.status ? (
                                <span className={isErr ? "text-red-500 font-bold" : "text-[#3ECF8E] font-bold"}>
                                  {item.status}
                                </span>
                              ) : (
                                <span className="text-[#55555C]">No Status</span>
                              )}
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                isErr ? "bg-red-500 shadow-[0_0_6px_#ef4444]" : "bg-[#3ECF8E] shadow-[0_0_6px_#3ecf8e]"
                              )} />
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[7px] text-[#55555C] font-mono pl-10 uppercase tracking-widest">
                            <span className="flex items-center gap-1">
                              <Clock size={8} /> {new Date(item.created_at || '').toLocaleTimeString()}
                            </span>
                            {item.time && <span>{item.time} ms</span>}
                            {item.size && <span>{item.size} bytes</span>}
                          </div>

                          {/* Slide down Expanded Log Details Panel inside tree list */}
                          <AnimatePresence>
                            {selectedLog?.id === item.id && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
                                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                className="overflow-hidden border-t border-[#1A1A22] pt-2 mt-2 space-y-2 text-[9px] uppercase tracking-wide text-[#88888F] animate-in slide-in-from-top-2 duration-200"
                              >
                                <div className="p-2.5 bg-[#070708] rounded-lg border border-[#1A1A22] font-mono space-y-2 select-text">
                                  <div>
                                    <span className="text-[#55555C] font-black">Endpoint URL:</span>
                                    <div className="text-white break-all mt-0.5 text-[8px] lowercase font-normal">{item.url}</div>
                                  </div>
                                  {item.request_data && (
                                    <div>
                                      <span className="text-[#55555C] font-black">Transmission Payload:</span>
                                      <pre className="text-[#3ECF8E] text-[7px] overflow-x-auto p-1 bg-black/40 rounded mt-1 max-h-24 no-scrollbar lowercase font-mono">
                                        {typeof item.request_data === 'object' 
                                          ? JSON.stringify(item.request_data, null, 2) 
                                          : String(item.request_data)}
                                      </pre>
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={async () => {
                                        if (item.request_data) {
                                          addTab({
                                            ...item.request_data,
                                            id: `history-${item.id}`,
                                            name: `${item.method} Request Replay`
                                          });
                                          addToast({ type: 'success', message: 'Replaying request node in editor.' });
                                        }
                                      }}
                                      className="flex-1 py-1 rounded bg-[#3ECF8E]/10 border border-[#3ECF8E]/25 text-[#3ECF8E] hover:bg-[#3ECF8E]/20 text-[8px] font-black text-center"
                                    >
                                      Load in Workspace
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}

                    {filteredLogs.length === 0 && (
                      <div className="text-center py-16 px-4">
                        <Terminal size={24} className="mx-auto text-[#1D1D22] mb-3" />
                        <p className="text-[9px] font-black text-[#44444F] uppercase tracking-widest">Logs catalog empty</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION E: Teams (Workspace/Team switche) */}
              {activeNav === 'teams' && (
                <div className="px-5 space-y-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-[#1A1A1E]/30 pb-2">
                    <span className="text-[9px] font-black text-[#55555C] uppercase tracking-widest font-mono">Active Units</span>
                    <button 
                      onClick={() => setIsTeamModalOpen(true)} 
                      className="text-[#3ECF8E] text-[18px] hover:scale-110 transition-transform leading-none font-bold"
                    >
                      +
                    </button>
                  </div>

                  {/* Active teams / Protocol Units list */}
                  <div className="space-y-2">
                    {(teams || []).map(team => (
                      <div 
                        key={team.id} 
                        onClick={() => setSelectedTeam(selectedTeam?.id === team.id ? null : team)}
                        className={cn(
                          "p-3 border rounded-xl bg-[#0F0F12] text-[10px] font-black uppercase tracking-wider bg-[#0F0F12] hover:bg-[#121216] transition-all cursor-pointer relative",
                          selectedTeam?.id === team.id ? "border-[#3ECF8E] shadow-[0_0_12px_rgba(62,207,142,0.05)]" : "border-[#1A1A22]"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[#E0E0E6] font-mono">{team.name}</span>
                          <Users size={12} className={selectedTeam?.id === team.id ? "text-[#3ECF8E]" : "text-[#55555C]"} />
                        </div>

                        {/* Collapsed slide member lists */}
                        <AnimatePresence>
                          {selectedTeam?.id === team.id && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0, marginTop: 0 }}
                              animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
                              exit={{ height: 0, opacity: 0, marginTop: 0 }}
                              className="overflow-hidden border-t border-[#1A1A22] pt-2 space-y-2 text-[8px] font-bold text-[#88888F]"
                            >
                              <div className="text-[7px] text-[#55555C] uppercase font-black tracking-widest">Channel Node Members:</div>
                              <div className="space-y-1">
                                {(team.team_members || []).map((m: any, mIdx: number) => (
                                  <div key={mIdx} className="flex items-center justify-between bg-black/25 p-1 rounded px-2">
                                    <span className="truncate pr-4 text-white">{m.profiles?.full_name || m.profiles?.email || 'Active Collaborator'}</span>
                                    <span className="text-[7px] text-[#3ECF8E] border border-[#3ECF8E]/20 px-1 rounded uppercase tracking-tighter shrink-0">{m.role || 'Member'}</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}

                    {(!teams || teams.length === 0) && (
                      <div className="text-center py-12 border border-dashed border-[#1A1A22] rounded-2xl bg-[#09090B]/30">
                        <Users size={24} className="mx-auto text-[#1D1D22] mb-3" />
                        <p className="text-[9px] font-black text-[#44444F] uppercase tracking-widest">No active team segments</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sub-panel bottom resize border and trigger */}
            <div 
              onMouseDown={startResizing}
              className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-[#3ECF8E]/40 z-[100] transition-colors"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Universal absolute context menu overlay */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.12 }}
            className="fixed w-52 bg-[#0F0F12]/95 border border-[#1D1D22] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] py-2 z-[9999] backdrop-blur-2xl overflow-hidden"
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 260),
              left: Math.min(contextMenu.x, window.innerWidth - 220)
            }}
          >
            <div className="px-4 py-1.5 mb-1 border-b border-white/[0.03]">
              <span className="text-[8px] font-black text-[#55555C] uppercase tracking-[0.2em] font-mono">Node actions // Gimay</span>
            </div>

            {/* Collection specific options */}
            {contextMenu.type === 'collection' && (
              <>
                <button
                  onClick={() => {
                    setModalContext({ type: 'collection', action: 'rename', id: contextMenu.id, initialValue: contextMenu.name });
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center justify-between group/opt transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Edit3 size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Rename Collection
                  </div>
                  <span className="text-[7px] text-[#33333C] font-mono">F2</span>
                </button>
                <button
                  onClick={async () => {
                    if (!profile?.id || !activeWorkspaceId) return;
                    try {
                      addToast({ type: 'info', message: 'Duplicating collection archetype...' });
                      await PersistenceService.duplicateCollection(contextMenu.id, profile.id, activeWorkspaceId);
                      await fetchCollections(activeWorkspaceId);
                      addToast({ type: 'success', message: 'Collection duplicated successfully.' });
                    } catch {
                      addToast({ type: 'error', message: 'Duplication failed.' });
                    }
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
                >
                  <Copy size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Duplicate Collection
                </button>
                <button
                  onClick={() => {
                    setModalContext({ type: 'collection', action: 'create_folder', id: '', collectionId: contextMenu.id });
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
                >
                  <FolderPlus size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Add Sub-Folder
                </button>
                <button
                  onClick={() => {
                    setModalContext({ type: 'collection', action: 'create_request', id: '', collectionId: contextMenu.id });
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
                >
                  <FilePlus size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Add Request
                </button>
                <div className="h-px bg-white/[0.03] my-1" />
                <button
                  onClick={() => {
                    const col = collections.find(c => c.id === contextMenu.id);
                    if (col) {
                      setShareCollection(col);
                      setIsShareModalOpen(true);
                    }
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
                >
                  <Users size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Protocol Share
                </button>
                <button
                  onClick={() => {
                    const col = collections.find(c => c.id === contextMenu.id);
                    if (col) {
                      CollectionExportService.exportCollection(col);
                      addToast({ type: 'success', message: 'Exporting collection binary...' });
                    }
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
                >
                  <FileDown size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Export Schema
                </button>
                <button
                  onClick={async () => {
                    const col = collections.find(c => c.id === contextMenu.id);
                    if (col) {
                      try {
                        addToast({ type: 'info', message: 'Pushing changes to GitHub...' });
                        await GitHubService.pushUpdates(col);
                        addToast({ type: 'success', message: 'Collection pushed to GitHub.' });
                      } catch (err: any) {
                        addToast({ type: 'error', message: `Push failed: ${err.message}` });
                      }
                    }
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
                >
                  <Activity size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> GitHub Sync
                </button>
                <div className="h-px bg-white/[0.03] my-1" />
                <button
                  onClick={() => {
                    setModalContext({ type: 'collection', action: 'delete', id: contextMenu.id, name: contextMenu.name });
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-red-500 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2.5 group/opt transition-colors"
                >
                  <Trash2 size={11} className="text-red-900 group-hover/opt:text-red-500" /> Purge Collection
                </button>
              </>
            )}

            {/* Folder specific options */}
            {contextMenu.type === 'folder' && (
              <>
                <button
                  onClick={() => {
                    setModalContext({ type: 'folder', action: 'rename', id: contextMenu.id, initialValue: contextMenu.name });
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center justify-between group/opt transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Edit3 size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Rename Folder
                  </div>
                  <span className="text-[7px] text-[#33333C] font-mono">F2</span>
                </button>
                <button
                  onClick={async () => {
                    if (!profile?.id || !activeWorkspaceId || !contextMenu.collectionId) return;
                    try {
                      addToast({ type: 'info', message: 'Duplicating folder branch...' });
                      await PersistenceService.duplicateFolder(
                        contextMenu.id,
                        contextMenu.collectionId,
                        profile.id,
                        contextMenu.parentId,
                        activeWorkspaceId
                      );
                      await fetchCollections(activeWorkspaceId);
                      addToast({ type: 'success', message: 'Folder branch duplicated successfully.' });
                    } catch {
                      addToast({ type: 'error', message: 'Duplication failed.' });
                    }
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
                >
                  <Copy size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Duplicate Folder
                </button>
                <button
                  onClick={() => {
                    setModalContext({ type: 'folder', action: 'create_folder', id: '', collectionId: contextMenu.collectionId, parentId: contextMenu.id });
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
                >
                  <FolderPlus size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Add Nested Folder
                </button>
                <button
                  onClick={() => {
                    setModalContext({ type: 'folder', action: 'create_request', id: '', collectionId: contextMenu.collectionId, parentId: contextMenu.id });
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
                >
                  <FilePlus size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Add Request
                </button>
                <div className="h-px bg-white/[0.03] my-1" />
                <button
                  onClick={() => {
                    setModalContext({ type: 'folder', action: 'delete', id: contextMenu.id, name: contextMenu.name });
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-red-500 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2.5 group/opt transition-colors"
                >
                  <Trash2 size={11} className="text-red-900 group-hover/opt:text-red-500" /> Purge Folder
                </button>
              </>
            )}

            {/* Request specific options */}
            {contextMenu.type === 'request' && (
              <>
                <button
                  onClick={() => {
                    setModalContext({ type: 'request', action: 'rename', id: contextMenu.id, initialValue: contextMenu.name });
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center justify-between group/opt transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Edit3 size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Rename Request
                  </div>
                  <span className="text-[7px] text-[#33333C] font-mono">F2</span>
                </button>
                <button
                  onClick={async () => {
                    if (!activeWorkspaceId) return;
                    try {
                      addToast({ type: 'info', message: 'Duplicating request segment...' });
                      const req = useStore.getState().collections
                        .flatMap(c => [...(c.requests || []), ...(c.folders || []).flatMap(f => f.requests || [])])
                        .find(r => r.id === contextMenu.id);
                      if (req) {
                        const duplicate = {
                          ...req,
                          id: undefined,
                          name: `${req.name} (Copy)`,
                          user_id: profile?.id
                        } as any;
                        delete duplicate.id;
                        const created = await PersistenceService.createRequest(duplicate);
                        await fetchCollections(activeWorkspaceId);
                        addTab(created);
                        addToast({ type: 'success', message: 'Request cloned successfully.' });
                      }
                    } catch {
                      addToast({ type: 'error', message: 'Duplication failed.' });
                    }
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
                >
                  <Copy size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Duplicate Request
                </button>
                <button
                  onClick={() => {
                    const req = useStore.getState().collections
                      .flatMap(c => [...(c.requests || []), ...(c.folders || []).flatMap(f => f.requests || [])])
                      .find(r => r.id === contextMenu.id);
                    if (req) {
                      setMovingRequest(req);
                      addToast({ type: 'info', message: 'Choose destination collection or folder.' });
                    }
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-[#88888F] hover:bg-[#3ECF8E]/10 hover:text-white flex items-center gap-2.5 group/opt transition-colors"
                >
                  <ArrowRightLeft size={11} className="text-[#55555C] group-hover/opt:text-[#3ECF8E]" /> Relocate Request
                </button>
                <div className="h-px bg-white/[0.03] my-1" />
                <button
                  onClick={() => {
                    setModalContext({ type: 'request', action: 'delete', id: contextMenu.id, name: contextMenu.name });
                  }}
                  className="w-full text-left px-4 py-1.5 text-[9px] font-black uppercase text-red-500 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2.5 group/opt transition-colors"
                >
                  <Trash2 size={11} className="text-red-900 group-hover/opt:text-red-500" /> Purge Request
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Modular CRUD Dialog Overlays (NameModal & ConfirmModal wrappers) */}
      <NameModal 
        isOpen={modalContext?.action === 'create_folder'}
        onClose={() => setModalContext(null)}
        onConfirm={handleCreateFolder}
        title="Deploy Sub-Folder"
        placeholder="FOLDER_NAME..."
      />

      <NameModal 
        isOpen={modalContext?.action === 'create_request'}
        onClose={() => setModalContext(null)}
        onConfirm={handleCreateRequest}
        title="Deploy Request"
        placeholder="REQUEST_NAME..."
      />

      <NameModal 
        isOpen={modalContext?.action === 'rename'}
        onClose={() => setModalContext(null)}
        onConfirm={handleRenameResource}
        title="Modify Component Identity"
        placeholder="NEW_NAME..."
        initialValue={modalContext?.initialValue}
      />

      <ConfirmModal
        isOpen={modalContext?.action === 'delete'}
        onClose={() => setModalContext(null)}
        onConfirm={handleConfirmedDelete}
        title={`Decommission Component`}
        description={`Permanently purge "${modalContext?.name}"? All nested child nodes will be recursively deleted.`}
        confirmText="Confirm Purge"
        variant="danger"
      />

      {/* Original support modals mapping */}
      <NameModal 
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        onConfirm={handleCreateCollection}
        title="Deploy Collection"
        placeholder="COLLECTION_NAME..."
      />

      <TeamModal 
        isOpen={isTeamModalOpen}
        onClose={() => {
          setIsTeamModalOpen(false);
          setSelectedTeam(null);
        }}
        team={selectedTeam}
      />

      <EnvironmentModal 
        isOpen={isEnvModalOpen}
        onClose={() => {
          setIsEnvModalOpen(false);
          setSelectedEnv(null);
        }}
        environment={selectedEnv}
      />

      <EnvironmentModal
        isOpen={isGlobalModalOpen}
        onClose={() => setIsGlobalModalOpen(false)}
        isGlobal={true}
      />

      <CollectionImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        workspaceId={activeWorkspaceId}
        userId={profile?.id}
        addToast={addToast}
        onImported={async () => {
          if (activeWorkspaceId) await fetchCollections(activeWorkspaceId);
        }}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setShareCollection(null);
          if (activeWorkspaceId) fetchCollections(activeWorkspaceId);
        }}
        collection={shareCollection!}
      />

      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      <SmokeSuiteModal
        isOpen={isSmokeModalOpen}
        onClose={() => setIsSmokeModalOpen(false)}
      />
    </div>
  );
};

// ----------------------------------------------------
// TREE COMPONENT 1: CollectionNode
// ----------------------------------------------------
const CollectionNode: React.FC<{
  collection: Collection;
  index: number;
  expandedNodes: Record<string, boolean>;
  toggleNodeExpanded: (id: string) => void;
  activeTabId: string | null;
  addTab: (res: any) => void;
  movingRequest: RequestData | null;
  handleMoveRequest: (colId: string, fId?: string) => void;
  setModalContext: (ctx: any) => void;
  setShareCollection: (col: any) => void;
  setIsShareModalOpen: (open: boolean) => void;
  setContextMenu: (menu: any) => void;
  canEdit: boolean;
}> = ({
  collection,
  index,
  expandedNodes,
  toggleNodeExpanded,
  activeTabId,
  addTab,
  movingRequest,
  handleMoveRequest,
  setModalContext,
  setShareCollection,
  setIsShareModalOpen,
  setContextMenu,
  canEdit
}) => {
  const isOpen = !!expandedNodes[collection.id];
  const isActive = activeTabId === collection.id;

  const handleContextMenuTrigger = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'collection',
      id: collection.id,
      name: collection.name
    });
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (movingRequest) {
      e.stopPropagation();
      handleMoveRequest(collection.id);
      return;
    }
    // Highlight / open tab
    addTab(collection);
    toggleNodeExpanded(collection.id);
  };

  return (
    <Draggable draggableId={collection.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "select-none group/col transition-opacity",
            snapshot.isDragging && "opacity-40"
          )}
        >
          {/* Main Collection Item Header Row */}
          <div 
            onClick={handleRowClick}
            onContextMenu={handleContextMenuTrigger}
            className={cn(
              "group flex items-center px-3.5 py-2 hover:bg-white/[0.02] cursor-pointer transition-all border-l-[3px] relative overflow-hidden h-9",
              isActive 
                ? "bg-[#3ECF8E]/5 border-[#3ECF8E] text-white" 
                : "border-transparent text-[#88888F] hover:text-white"
            )}
          >
            {/* active row hover/select glow */}
            {isActive && (
              <div className="absolute inset-0 bg-[#3ECF8E]/[0.01] shadow-[inset_4px_0_15px_rgba(62,207,142,0.02)] pointer-events-none" />
            )}

            {/* Drag Handle */}
            <div 
              {...provided.dragHandleProps} 
              className="mr-1 opacity-0 group-hover/col:opacity-100 transition-opacity flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={11} className="text-[#33333F]" />
            </div>

            {/* Expand Arrow Chevron */}
            <div 
              className="p-1 -ml-1 hover:bg-white/5 rounded transition-colors relative z-10"
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpanded(collection.id);
              }}
            >
              <motion.div
                animate={{ rotate: isOpen ? 90 : 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center"
              >
                <ChevronRight size={12} className={isOpen ? "text-[#3ECF8E]" : "text-[#44444F]"} />
              </motion.div>
            </div>

            {/* Folder Open/Close icons */}
            <div className="relative ml-1.5 mr-2 z-10">
              {isOpen ? (
                <FolderOpen size={13} className="text-[#3ECF8E]" />
              ) : (
                <Folder size={13} className="text-[#55555C]" />
              )}
            </div>

            {/* Title / Identity Label */}
            <div className="flex flex-col flex-1 min-w-0 relative z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.05em] truncate">
                {collection.name}
              </span>
            </div>

            {/* Hover Actions triggers */}
            <div className="flex items-center gap-1 opacity-0 group-hover/col:opacity-100 transition-opacity relative z-10 scale-90">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setModalContext({ type: 'collection', action: 'create_folder', id: '', collectionId: collection.id });
                }}
                className="p-1 hover:text-[#3ECF8E] text-[#55555C] hover:bg-white/5 rounded"
                title="Add Folder"
              >
                <FolderPlus size={12} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setModalContext({ type: 'collection', action: 'create_request', id: '', collectionId: collection.id });
                }}
                className="p-1 hover:text-[#3ECF8E] text-[#55555C] hover:bg-white/5 rounded"
                title="Add Request"
              >
                <Plus size={13} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: 'collection',
                    id: collection.id,
                    name: collection.name
                  });
                }}
                className="p-1 hover:text-white text-[#55555C] hover:bg-white/5 rounded"
              >
                <MoreVertical size={12} />
              </button>
            </div>
          </div>

          {/* Nested Children (Folders and Requests) */}
          <AnimatePresence>
            {isOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-l border-[#1A1A22] ml-[23px] pl-1 py-0.5 space-y-0.5"
              >
                {/* Folders droppable zone */}
                <Droppable droppableId={`${collection.id}:folders`} type="folder">
                  {(prov) => (
                    <div {...prov.droppableProps} ref={prov.innerRef} className="space-y-0.5">
                      {collection.folders?.map((folder, folderIdx) => (
                        <FolderNode 
                          key={folder.id}
                          folder={folder}
                          index={folderIdx}
                          collectionId={collection.id}
                          expandedNodes={expandedNodes}
                          toggleNodeExpanded={toggleNodeExpanded}
                          activeTabId={activeTabId}
                          addTab={addTab}
                          movingRequest={movingRequest}
                          handleMoveRequest={handleMoveRequest}
                          setModalContext={setModalContext}
                          setContextMenu={setContextMenu}
                        />
                      ))}
                      {prov.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Root level requests droppable zone */}
                <Droppable droppableId={`${collection.id}:requests:root`} type="request">
                  {(prov) => (
                    <div {...prov.droppableProps} ref={prov.innerRef} className="space-y-0.5">
                      {collection.requests?.filter(r => !r.folder_id).map((req, reqIdx) => (
                        <RequestNode 
                          key={req.id}
                          request={req}
                          index={reqIdx}
                          activeTabId={activeTabId}
                          addTab={addTab}
                          setContextMenu={setContextMenu}
                        />
                      ))}
                      {prov.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Void State placeholder */}
                {(!collection.requests?.length && !collection.folders?.length) && (
                  <div className="px-5 py-2.5 text-[8px] font-black text-[#44444F] uppercase tracking-widest italic font-mono">
                    Empty Collection
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Draggable>
  );
};

// ----------------------------------------------------
// TREE COMPONENT 2: FolderNode
// ----------------------------------------------------
const FolderNode: React.FC<{
  folder: FolderType;
  index: number;
  collectionId: string;
  expandedNodes: Record<string, boolean>;
  toggleNodeExpanded: (id: string) => void;
  activeTabId: string | null;
  addTab: (res: any) => void;
  movingRequest: RequestData | null;
  handleMoveRequest: (colId: string, fId?: string) => void;
  setModalContext: (ctx: any) => void;
  setContextMenu: (menu: any) => void;
}> = ({
  folder,
  index,
  collectionId,
  expandedNodes,
  toggleNodeExpanded,
  activeTabId,
  addTab,
  movingRequest,
  handleMoveRequest,
  setModalContext,
  setContextMenu
}) => {
  const isOpen = !!expandedNodes[folder.id];

  const handleContextMenuTrigger = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'folder',
      id: folder.id,
      name: folder.name,
      collectionId,
      parentId: folder.parent_id
    });
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (movingRequest) {
      e.stopPropagation();
      handleMoveRequest(collectionId, folder.id);
      return;
    }
    toggleNodeExpanded(folder.id);
  };

  return (
    <Draggable draggableId={`${collectionId}:${folder.id}`} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "select-none group/folder relative transition-opacity",
            snapshot.isDragging && "opacity-40"
          )}
        >
          {/* Main Folder node item */}
          <div 
            onClick={handleRowClick}
            onContextMenu={handleContextMenuTrigger}
            className="flex items-center px-2 py-1.5 hover:bg-white/[0.02] cursor-pointer transition-all border-l border-transparent hover:border-white/[0.03] text-[#77777F] hover:text-[#E0E0E6] h-8"
          >
            {/* Drag Handle */}
            <div 
              {...provided.dragHandleProps} 
              className="mr-1 opacity-0 group-hover/folder:opacity-100 transition-opacity flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={10} className="text-[#33333F]" />
            </div>

            {/* Expand arrows chevron */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpanded(folder.id);
              }}
              className="flex items-center"
            >
              <motion.div
                animate={{ rotate: isOpen ? 90 : 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center"
              >
                <ChevronRight size={11} className={isOpen ? "text-[#3ECF8E]" : "text-[#44444F]"} />
              </motion.div>
            </div>

            {/* Folder icon */}
            {isOpen ? (
              <FolderOpen size={12} className="ml-1.5 mr-2 text-[#3ECF8E]" />
            ) : (
              <Folder size={12} className="ml-1.5 mr-2 text-[#55555C]" />
            )}

            {/* Title */}
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider truncate">
                {folder.name}
              </span>
            </div>

            {/* Quick Actions triggers */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity scale-90">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setModalContext({ type: 'folder', action: 'create_folder', id: '', collectionId, parentId: folder.id });
                }}
                className="p-1 hover:text-[#3ECF8E] text-[#55555C] hover:bg-white/5 rounded"
                title="Add Sub-folder"
              >
                <FolderPlus size={11} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setModalContext({ type: 'folder', action: 'create_request', id: '', collectionId, parentId: folder.id });
                }}
                className="p-1 hover:text-[#3ECF8E] text-[#55555C] hover:bg-white/5 rounded"
                title="Add Request Inside"
              >
                <Plus size={12} />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: 'folder',
                    id: folder.id,
                    name: folder.name,
                    collectionId,
                    parentId: folder.parent_id
                  });
                }}
                className="p-1 hover:text-white text-[#55555C] hover:bg-white/5 rounded"
              >
                <MoreVertical size={11} />
              </button>
            </div>
          </div>

          {/* Sub folders and sub requests */}
          <AnimatePresence>
            {isOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-l border-[#1A1A22] ml-[14px] pl-1.5 py-0.5 space-y-0.5"
              >
                {/* Nested sub-folders */}
                {folder.folders?.map((sub, subIdx) => (
                  <FolderNode 
                    key={sub.id}
                    folder={sub}
                    index={subIdx}
                    collectionId={collectionId}
                    expandedNodes={expandedNodes}
                    toggleNodeExpanded={toggleNodeExpanded}
                    activeTabId={activeTabId}
                    addTab={addTab}
                    movingRequest={movingRequest}
                    handleMoveRequest={handleMoveRequest}
                    setModalContext={setModalContext}
                    setContextMenu={setContextMenu}
                  />
                ))}

                {/* Nested Requests in this folder */}
                <Droppable droppableId={`${collectionId}:requests:${folder.id}`} type="request">
                  {(prov) => (
                    <div {...prov.droppableProps} ref={prov.innerRef} className="space-y-0.5">
                      {folder.requests?.map((req, reqIdx) => (
                        <RequestNode 
                          key={req.id}
                          request={req}
                          index={reqIdx}
                          activeTabId={activeTabId}
                          addTab={addTab}
                          setContextMenu={setContextMenu}
                          folderId={folder.id}
                        />
                      ))}
                      {prov.placeholder}
                    </div>
                  )}
                </Droppable>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Draggable>
  );
};

// ----------------------------------------------------
// TREE COMPONENT 3: RequestNode
// ----------------------------------------------------
const RequestNode: React.FC<{
  request: RequestData;
  index: number;
  activeTabId: string | null;
  addTab: (res: any) => void;
  setContextMenu: (menu: any) => void;
  folderId?: string;
}> = ({
  request,
  index,
  activeTabId,
  addTab,
  setContextMenu,
  folderId
}) => {
  const isActive = activeTabId === request.id;

  const handleContextMenuTrigger = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'request',
      id: request.id,
      name: request.name,
      collectionId: request.collection_id,
      parentId: folderId
    });
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-[#3ECF8E]';
      case 'POST': return 'text-amber-500';
      case 'PUT': return 'text-blue-500';
      case 'DELETE': return 'text-red-500';
      case 'PATCH': return 'text-purple-500';
      default: return 'text-[#AAAAAF]';
    }
  };

  return (
    <Draggable draggableId={`${request.collection_id}:${request.id}${folderId ? ':' + folderId : ''}`} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "select-none group/req transition-opacity relative",
            snapshot.isDragging && "opacity-40"
          )}
        >
          {/* Main Request node item */}
          <div 
            onClick={() => addTab(request)}
            onContextMenu={handleContextMenuTrigger}
            className={cn(
              "flex items-center px-3 py-1.5 hover:bg-white/[0.02] cursor-pointer transition-all border-l-[3px] h-7.5 relative items-stretch",
              isActive 
                ? "bg-[#3ECF8E]/5 border-[#3ECF8E] text-white font-bold" 
                : "border-transparent text-[#77777F] hover:text-[#E0E0E6]"
            )}
          >
            {/* active indicator glow */}
            {isActive && (
              <div className="absolute inset-0 bg-[#3ECF8E]/[0.01] shadow-[inset_4px_0_12px_rgba(62,207,142,0.02)] pointer-events-none" />
            )}

            {/* Drag Handle */}
            <div 
              {...provided.dragHandleProps} 
              className="flex items-center mr-1.5 opacity-0 group-hover/req:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={10} className="text-[#33333F]" />
            </div>

            {/* Method Prefix and Name */}
            <div className="flex items-center gap-2 flex-1 min-w-0 relative z-10">
              <span className={cn(
                "text-[7px] font-black font-mono w-8 shrink-0 tracking-tighter uppercase",
                getMethodColor(request.method)
              )}>
                {request.method}
              </span>
              <span className="text-[9.5px] font-medium truncate tracking-wide">
                {request.name}
              </span>
            </div>

            {/* More Options action trigger */}
            <div className="flex items-center opacity-0 group-hover/req:opacity-100 transition-opacity scale-90 relative z-10">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: 'request',
                    id: request.id,
                    name: request.name,
                    collectionId: request.collection_id,
                    parentId: folderId
                  });
                }}
                className="p-1 hover:text-white text-[#55555C] hover:bg-white/5 rounded"
              >
                <MoreVertical size={11} />
              </button>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default Sidebar;

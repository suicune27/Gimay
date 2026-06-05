import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../hooks/useAuth';
import { useDataSync } from '../../hooks/useDataSync';
import { PersistenceService } from '../../services/PersistenceService';
import { NameModal } from '../../components/NameModal';
import { TeamModal } from '../../components/TeamModal';
import { EnvironmentModal } from '../../components/EnvironmentModal';
import { ShareModal } from '../../components/ShareModal';
import { CollectionImportModal } from '../../components/CollectionImportModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { SettingsModal } from '../../components/SettingsModal';
import { SidebarNavBar } from './SidebarNavBar';
import { SidebarPanelHeader } from './SidebarPanelHeader';
import { SidebarSearchBar } from './SidebarSearchBar';
import { CollectionsPanel } from './CollectionsPanel';
import { EnvironmentsPanel } from './EnvironmentsPanel';
import { ScriptsPanel } from './ScriptsPanel';
import { LogsPanel } from './LogsPanel';
import { TeamsPanel } from './TeamsPanel';
import { SidebarContextMenu } from './SidebarContextMenu';
import { Collection, RequestData } from '../../types';

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

  const handleClearHistory = async () => {
    if (!activeWorkspaceId || !profile?.id) return;
    try {
      await PersistenceService.clearHistory(activeWorkspaceId, profile.id);
      await fetchHistory(activeWorkspaceId);
      addToast({ type: 'info', message: 'Traffic log history cleared.' });
    } catch {
      addToast({ type: 'error', message: 'Failed to clear logs.' });
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
    const copy = JSON.parse(JSON.stringify(collections)) as Collection[];
    const matchesSearch = (str?: string) =>
      str ? str.toLowerCase().includes(searchQuery.toLowerCase()) : false;
    const filterNode = (node: any): boolean => {
      if (node.requests) {
        node.requests = node.requests.filter((r: RequestData) => {
          const matchesSec = matchesSearch(r.name) || matchesSearch(r.url) || matchesSearch(r.method);
          const matchesMeth = methodFilter ? r.method === methodFilter : true;
          return matchesSec && matchesMeth;
        });
      }
      if (node.folders) {
        node.folders = node.folders.filter((f: any) => filterNode(f));
      }
      const folderMatches = matchesSearch(node.name);
      const hasContent = (node.requests && node.requests.length > 0) || (node.folders && node.folders.length > 0);
      return folderMatches || hasContent;
    };
    return copy.filter(col => {
      if (!searchQuery && !methodFilter) return true;
      const colMatches = matchesSearch(col.name);
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

  // Real-time Traffic Logs filtered list
  const filteredLogs = useMemo(() => {
    if (!history) return [];
    return history.filter((item: any) => {
      if (methodFilter && item.method !== methodFilter) return false;
      if (logFilter === 'success' && (item.status && item.status >= 400)) return false;
      if (logFilter === 'error' && (!item.status || item.status < 400)) return false;
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
    addToast({ type: 'success', message: 'Script snippet copied to clipboard.' });
  };

  // Append snippet to active script editor
  const handleAppendSnippet = (code: string) => {
    const activeTab = useStore.getState().openTabs.find(t => t.id === activeTabId);
    if (!activeTab || !('method' in activeTab)) {
      addToast({ type: 'warning', message: 'Please open a request tab first.' });
      return;
    }
    const request = activeTab as RequestData;
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
      {/* 1. Left Slim Navigation Icon Bar */}
      <SidebarNavBar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        setIsHoverExpanded={setIsHoverExpanded}
        isExpanded={isExpanded}
        activeWorkspaceId={activeWorkspaceId}
        profile={profile}
        logout={logout}
        addTab={addTab}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        handleMouseEnterNav={handleMouseEnterNav}
      />

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
            {/* Header */}
            <SidebarPanelHeader
              workspaceName={activeWorkspace?.name || 'Workspace'}
              workspaceVisibility={activeWorkspace?.visibility}
              isSidebarPinned={isSidebarPinned}
              onTogglePin={() => setIsSidebarPinned(!isSidebarPinned)}
            />

            {/* Global Search and Filter Header */}
            <SidebarSearchBar
              activeNav={activeNav}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              methodFilter={methodFilter}
              onMethodFilterChange={setMethodFilter}
              logFilter={logFilter}
              onLogFilterChange={setLogFilter}
              onClearFilters={() => { setMethodFilter(null); setLogFilter('all'); }}
            />

            {/* Scrollable Sub-panel Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-2 relative">
              {activeNav === 'collections' && (
                <CollectionsPanel
                  filteredCollections={filteredCollections}
                  expandedNodes={expandedNodes}
                  toggleNodeExpanded={toggleNodeExpanded}
                  activeTabId={activeTabId}
                  addTab={addTab}
                  movingRequest={movingRequest}
                  setMovingRequest={setMovingRequest}
                  handleMoveRequest={handleMoveRequest}
                  setModalContext={setModalContext}
                  setShareCollection={setShareCollection}
                  setIsShareModalOpen={setIsShareModalOpen}
                  setContextMenu={setContextMenu}
                  canPerformAction={canPerformAction}
                  onNewCollection={() => setIsCollectionModalOpen(true)}
                  onImport={() => setIsImportModalOpen(true)}
                  onCollapseAll={collapseAll}
                  onRefresh={handleManualRefresh}
                  isRefreshing={isRefreshing}
                  onDragEnd={onDragEnd}
                />
              )}

              {activeNav === 'environments' && (
                <EnvironmentsPanel
                  environments={environments}
                  activeEnvId={activeEnvId}
                  setActiveEnvId={setActiveEnvId}
                  setIsEnvModalOpen={setIsEnvModalOpen}
                  setIsGlobalModalOpen={setIsGlobalModalOpen}
                  setSelectedEnv={setSelectedEnv}
                  profile={profile}
                  activeWorkspaceId={activeWorkspaceId}
                  addToast={addToast}
                  fetchEnvironments={fetchEnvironments}
                />
              )}

              {activeNav === 'scripts' && (
                <ScriptsPanel
                  handleCopySnippet={handleCopySnippet}
                  handleAppendSnippet={handleAppendSnippet}
                  onOpenScriptLab={() => useStore.getState().setIsScriptLabOpen(true)}
                />
              )}

              {activeNav === 'history' && (
                <LogsPanel
                  filteredLogs={filteredLogs}
                  selectedLog={selectedLog}
                  setSelectedLog={setSelectedLog}
                  addToast={addToast}
                  addTab={addTab}
                  onClearHistory={handleClearHistory}
                />
              )}

              {activeNav === 'teams' && (
                <TeamsPanel
                  teams={teams}
                  selectedTeam={selectedTeam}
                  setSelectedTeam={setSelectedTeam}
                  setIsTeamModalOpen={setIsTeamModalOpen}
                />
              )}
            </div>

            {/* Sub-panel bottom resize border */}
            <div
              onMouseDown={startResizing}
              className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-[#3ECF8E]/40 z-[100] transition-colors"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Context menu overlay */}
      <SidebarContextMenu
        contextMenu={contextMenu}
        collections={collections}
        activeWorkspaceId={activeWorkspaceId}
        profile={profile}
        addToast={addToast}
        fetchCollections={fetchCollections}
        setModalContext={setModalContext}
        setMovingRequest={setMovingRequest}
        setShareCollection={setShareCollection}
        setIsShareModalOpen={setIsShareModalOpen}
      />

      {/* 4. Modular CRUD Dialog Overlays */}
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
        title="Decommission Component"
        description={`Permanently purge "${modalContext?.name}"? All nested child nodes will be recursively deleted.`}
        confirmText="Confirm Purge"
        variant="danger"
      />

      {/* Original support modals */}
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
    </div>
  );
};

export default Sidebar;

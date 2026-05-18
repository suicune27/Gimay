import React, { useState, useRef, useEffect } from 'react';
import { 
  Folder, 
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
  Grid,
  Trash2,
  Upload,
  GripVertical,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  PanelLeftClose,
  PanelLeftOpen,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  Copy,
  Edit3,
  FileDown,
  FileUp,
  Download
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
import { useDataSync } from '../../hooks/useDataSync';

import { useAuth } from '../../hooks/useAuth';

const SidebarTooltip: React.FC<{ children: React.ReactNode; text: string; enabled: boolean }> = ({ children, text, enabled }) => {
  if (!enabled) return <>{children}</>;
  return (
    <div className="group/tooltip relative flex items-center justify-center">
      {children}
      <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#111111] border border-[#222222] text-[9px] font-black uppercase tracking-widest text-white rounded-md opacity-0 group-hover/tooltip:opacity-100 translate-x-2 group-hover/tooltip:translate-x-0 transition-all duration-300 pointer-events-none z-[100] whitespace-nowrap shadow-[0_10px_30px_rgba(0,0,0,0.5)] border-l-2 border-l-[#3ECF8E]">
        {text}
      </div>
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const { 
    collections, 
    addTab, 
    updateRequest,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarWidth,
    setSidebarWidth,
    sidebarMode,
    setSidebarMode,
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
    setIsSettingsModalOpen
  } = useStore();
  
  const { logout } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNav, setActiveNav] = useState('collections');
  const [isResizing, setIsResizing] = useState(false);
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  const isExpanded = isSidebarPinned;

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

  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [selectedEnv, setSelectedEnv] = useState<any>(null);
  const [confirmEnvDelete, setConfirmEnvDelete] = useState<{ id: string; name: string } | null>(null);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  const { fetchCollections } = useDataSync();

  const onDragEnd = (result: any) => {
    if (!result.destination) return;

    const { draggableId, source, destination, type } = result;
    
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

  const handleCreateCollection = async (name: string) => {
    if (!activeWorkspaceId || !profile?.id) return;
    try {
      const col = await PersistenceService.createCollection(activeWorkspaceId, profile.id, name);
      await fetchCollections(activeWorkspaceId);
      addTab(col);
      addToast({ type: 'success', message: `Collection "${name}" deployed.` });
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to deploy collection.' });
    }
  };

  return (
    <motion.div 
      ref={sidebarRef}
      initial={false}
      animate={{ 
        width: isExpanded ? 320 : 0,
        opacity: isExpanded ? 1 : 0,
        transition: { type: 'spring', stiffness: 350, damping: 35 }
      }}
      className={cn(
        "h-full bg-[#0F0F0F] border-r border-[#222222] flex flex-col relative z-40 overflow-hidden shrink-0 shadow-[10px_0_40px_rgba(0,0,0,0.6)]",
      )}
    >
      <NameModal 
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        onConfirm={handleCreateCollection}
        title="Initialize New Collection"
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
      
      <ConfirmModal
        isOpen={!!confirmEnvDelete}
        onClose={() => setConfirmEnvDelete(null)}
        onConfirm={async () => {
          if (!confirmEnvDelete) return;
          try {
            await PersistenceService.deleteEnvironment(confirmEnvDelete.id);
            if (activeEnvId === confirmEnvDelete.id) setActiveEnvId(null);
            addToast({ type: 'info', message: 'Environment purged.' });
          } catch {
            addToast({ type: 'error', message: 'Failed to purge environment.' });
          }
          setConfirmEnvDelete(null);
        }}
        title="Purge Environment"
        description={`Delete "${confirmEnvDelete?.name}"? This cannot be undone.`}
        confirmText="Purge"
        variant="danger"
      />

      {/* Header Info */}
      <div className="h-14 border-b border-[#222222] flex items-center px-5 bg-[#0A0A0A]/50 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#3ECF8E] animate-pulse" />
            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] truncate">
              {activeWorkspace?.name || 'Workspace'}
            </h2>
          </div>
          <p className="text-[8px] text-[#444444] font-mono tracking-tighter uppercase font-bold mt-0.5">
            NODE_ACTIVE // {activeWorkspace?.visibility || 'Private'}
          </p>
        </div>
        
        <button 
          onClick={() => setIsSidebarPinned(false)}
          className="p-1.5 text-[#333333] hover:text-[#3ECF8E] transition-colors"
          title="Collapse Sidebar"
        >
          <ChevronsLeft size={16} />
        </button>
      </div>

      {/* 5-Tab Navigation Bar */}
      <div className="flex border-b border-[#222222] bg-[#0A0A0A]/30 shrink-0 overflow-x-auto no-scrollbar">
        {[
          { id: 'collections', icon: LayoutGrid, label: 'EXPLORER' },
          { id: 'environments', icon: Globe, label: 'REGISTRY' },
          { id: 'scripts', icon: Zap, label: 'SCRIPTS' },
          { id: 'history', icon: Activity, label: 'LOGS' },
          { id: 'teams', icon: Users, label: 'TEAMS' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveNav(item.id)}
            className={cn(
              "flex-1 min-w-[70px] py-3 flex flex-col items-center gap-1 transition-all relative border-r border-[#222222]/50 last:border-r-0",
              activeNav === item.id 
                ? "bg-white/[0.03]" 
                : "hover:bg-white/[0.01]"
            )}
          >
            <item.icon 
              size={13} 
              className={cn(
                "transition-all duration-300",
                activeNav === item.id ? "text-[#3ECF8E] scale-110" : "text-[#444444]"
              )} 
            />
            <span className={cn(
              "text-[8px] font-black tracking-widest",
              activeNav === item.id ? "text-white" : "text-[#444444]"
            )}>
              {item.label}
            </span>
            {activeNav === item.id && (
              <motion.div 
                layoutId="nav-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3ECF8E] shadow-[0_0_10px_rgba(62,207,142,0.4)]"
              />
            )}
          </button>
        ))}
      </div>

      {/* Search & Main Actions */}
      {activeNav === 'collections' && (
        <div className="px-5 py-4 border-b border-[#222222] bg-[#0A0A0A]/20">
          <div className="space-y-3">
            <div className="relative group">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#333333] group-focus-within:text-[#3ECF8E] transition-colors" />
              <input 
                type="text" 
                placeholder="SCAN_OBJECTS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#050505] border border-[#222222] rounded-lg py-2 pl-8 pr-3 text-[10px] font-mono text-[#AAAAAA] placeholder-[#333333] focus:border-[#3ECF8E]/40 outline-none transition-all"
              />
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              <button 
                onClick={() => setIsCollectionModalOpen(true)}
                className="col-span-4 py-1.5 bg-[#111111] border border-[#222222] rounded-md text-[9px] font-black text-[#555555] hover:text-[#3ECF8E] hover:border-[#3ECF8E]/30 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Plus size={12} strokeWidth={3} /> NEW COLLECTION
              </button>
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center justify-center bg-[#111111] border border-[#222222] rounded-md text-[#555555] hover:text-[#3ECF8E] transition-all flex-1"
                title="Import Collection"
              >
                <FileUp size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-2">
              {activeNav === 'collections' && (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="collections-root" type="collection">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef}>
                        {(collections || []).map((col, index) => (
                          <CollectionNode
                            key={col.id}
                            collection={col}
                            index={index}
                            fetchCollections={fetchCollections}
                            onOpenImport={() => setIsImportModalOpen(true)}
                          />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}

              {activeNav === 'environments' && (
                <div className="px-5 space-y-4 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <button 
                      onClick={() => setIsGlobalModalOpen(true)}
                      className="text-amber-500/60 text-[9px] font-black uppercase hover:text-amber-400 transition-all tracking-widest"
                    >
                      Globals
                    </button>
                    <button 
                      onClick={() => setIsEnvModalOpen(true)}
                      className="text-[#3ECF8E] text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                    >
                      + Register Env
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(environments || []).map(env => (
                      <div 
                        key={env.id} 
                        onClick={() => setActiveEnvId(activeEnvId === env.id ? null : env.id)}
                        className={cn(
                          "p-3 bg-[#111111]/40 border rounded-xl hover:bg-[#151515] transition-all cursor-pointer group/env relative",
                          activeEnvId === env.id ? "border-[#3ECF8E] shadow-[0_0_15px_rgba(62,207,142,0.1)]" : "border-[#222222]"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-black text-white uppercase tracking-wider">{env.name}</div>
                          <div className="flex items-center gap-1 opacity-0 group-hover/env:opacity-100 transition-all">
                             <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEnv(env);
                                setIsEnvModalOpen(true);
                              }}
                              className="p-1 hover:text-[#3ECF8E] text-[#444444]"
                             >
                               <Settings size={12} />
                             </button>
                             <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmEnvDelete({ id: env.id, name: env.name });
                              }}
                              className="p-1 hover:text-red-500 text-[#444444]"
                             >
                               <Trash2 size={12} />
                             </button>
                          </div>
                        </div>
                        <div className="text-[8px] text-[#444444] font-black uppercase tracking-widest mt-1">
                          {env.variables?.length || 0} KEYS
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeNav === 'history' && (
                <div className="space-y-1 animate-in fade-in duration-500">
                  {(history || []).map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={async () => {
                        if (item.request_data) {
                          addTab({
                            ...item.request_data,
                            id: `history-${item.id}`,
                            name: `${item.method} Request Replay`
                          });
                        }
                      }}
                      className="px-5 py-3 hover:bg-white/[0.02] cursor-pointer group border-l-2 border-transparent hover:border-[#3ECF8E] transition-all"
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <span className={cn(
                          "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter",
                          item.method === 'GET' ? 'bg-[#3ECF8E]/10 text-[#3ECF8E]' : 'bg-[#222222] text-[#AAAAAA]'
                        )}>{item.method}</span>
                        <span className="truncate text-[10px] text-[#777777] font-mono group-hover:text-[#AAAAAA] transition-colors">{item.url}</span>
                      </div>
                      <div className="text-[8px] text-[#333333] uppercase font-black tracking-widest pl-12">
                        {new Date(item.created_at || '').toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeNav === 'teams' && (
                <div className="px-5 space-y-4 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-[#444444] uppercase tracking-widest">Protocol Units</span>
                    <button onClick={() => setIsTeamModalOpen(true)} className="text-[#3ECF8E] text-[18px] hover:scale-110 transition-transform leading-none">+</button>
                  </div>
                  <div className="space-y-2">
                    {(teams || []).map(team => (
                      <div key={team.id} className="p-3 border border-[#222222] rounded-xl text-[10px] font-black text-[#AAAAAA] uppercase tracking-widest bg-[#111111]/30 hover:border-[#3ECF8E]/20 transition-all flex items-center justify-between group">
                         {team.name}
                         <Users size={12} className="text-[#333333] group-hover:text-[#3ECF8E] transition-colors" />
                      </div>
                    ))}
                    {(!teams || teams.length === 0) && (
                      <div className="text-center py-12 border-2 border-dashed border-[#222222] rounded-2xl">
                        <Users size={24} className="mx-auto text-[#222222] mb-3" />
                        <p className="text-[9px] font-black text-[#444444] uppercase tracking-widest">No nodes active</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeNav === 'scripts' && (
                <div className="px-5 space-y-4 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-[#444444] uppercase tracking-widest">Logic Library</span>
                    <button 
                      onClick={() => useStore.getState().setIsScriptLibraryOpen(true)}
                      className="text-[#3ECF8E] text-[9px] font-black uppercase border border-[#3ECF8E]/30 px-3 py-1 rounded-full hover:bg-[#3ECF8E]/10 transition-all"
                    >
                      BROWSE_HUB
                    </button>
                  </div>
                  <p className="text-[9px] text-[#444444] font-medium leading-relaxed uppercase tracking-tight">
                    Deploy automation scripts to your runtime environment.
                  </p>
                  <div className="space-y-2">
                    <div className="p-3 border border-[#222222] rounded-xl bg-white/[0.02] group cursor-pointer hover:border-[#3ECF8E]/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap size={12} className="text-amber-500" />
                        <div className="text-[9px] font-black text-[#AAAAAA] uppercase tracking-wider">Pre-request Hooks</div>
                      </div>
                      <div className="text-[8px] text-[#444444] uppercase font-bold tracking-tight">Dynamic context & headers</div>
                    </div>
                    <div className="p-3 border border-[#222222] rounded-xl bg-white/[0.02] group cursor-pointer hover:border-[#3ECF8E]/30 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity size={12} className="text-blue-500" />
                        <div className="text-[9px] font-black text-[#AAAAAA] uppercase tracking-wider">Test Assertions</div>
                      </div>
                      <div className="text-[8px] text-[#444444] uppercase font-bold tracking-tight">Object validation & state check</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Detail at Expanded Bottom */}
            <div className="mt-auto border-t border-[#222222] bg-[#0A0A0A] p-5">
              <div className="flex items-center gap-4 group/user-detail">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-white uppercase tracking-widest truncate">
                    {profile?.full_name || 'Protocol_User'}
                  </p>
                  <p className="text-[9px] text-[#444444] font-mono truncate mt-0.5">
                    {profile?.email}
                  </p>
                </div>
                <button 
                  onClick={() => logout()}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-[#333333] hover:text-red-500 transition-all"
                  title="Disconnect Node"
                >
                  <Plus size={14} className="rotate-45" />
                </button>
              </div>
            </div>
    </motion.div>
  );
};

const CollectionNode: React.FC<{
  collection: Collection;
  index: number;
  fetchCollections: (wsId: string) => Promise<void>;
  onOpenImport: () => void;
}> = ({ collection, index, fetchCollections, onOpenImport }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { profile, activeWorkspaceId, addToast, canPerformAction, addTab, activeTabId, updateCollection, pendingSyncIds, addRequest } = useStore();
  const isUnsaved = pendingSyncIds.has(collection.id);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMenuOpen(false); };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleOutside); document.removeEventListener('keydown', handleEsc); };
  }, [isMenuOpen]);

  const canEdit = canPerformAction(collection, 'edit');

  const handleConfirmRequest = async (name: string) => {
    if (!profile?.id || !activeWorkspaceId) return;
    try {
      setIsOpen(true);
      const newRequest = await PersistenceService.createRequest({
        name,
        collection_id: collection.id,
        workspace_id: collection.workspace_id || activeWorkspaceId,
        user_id: profile.id,
        method: 'GET',
        url: 'https://api.example.com',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none',
        auth: { type: 'inherit' }
      });
      addRequest(newRequest);
      addToast({ type: 'success', message: `Request "${name}" synchronized.` });
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to synchronize request.' });
    }
  };

  const handleConfirmFolder = async (name: string) => {
    if (!profile?.id) return;
    try {
      setIsOpen(true);
      await PersistenceService.createFolder(name, collection.id, profile.id, undefined, activeWorkspaceId!);
      await fetchCollections(activeWorkspaceId!);
      addToast({ type: 'success', message: `Folder "${name}" established.` });
    } catch (error) {
      addToast({ type: 'error', message: 'Folder initialization failed.' });
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmedDelete = async () => {
    try {
      await PersistenceService.deleteCollection(collection.id);
      await fetchCollections(activeWorkspaceId!);
      addToast({ type: 'info', message: `Collection "${collection.name}" decommissioned.` });
    } catch (error) {
      addToast({ type: 'error', message: 'Decommissioning failed.' });
    }
  };

  const handleRename = async (newName: string) => {
    try {
      updateCollection(collection.id, { name: newName });
      addToast({ type: 'info', message: 'Collection identity update scheduled.' });
    } catch (error) {
      addToast({ type: 'error', message: 'Identity update failed.' });
    }
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (!profile?.id || !activeWorkspaceId) return;
    try {
      addToast({ type: 'info', message: 'Duplicating collection archetype...' });
      await PersistenceService.duplicateCollection(collection.id, profile.id, activeWorkspaceId);
      await fetchCollections(activeWorkspaceId);
      addToast({ type: 'success', message: `Collection "${collection.name}" duplicated.` });
    } catch (error) {
      addToast({ type: 'error', message: 'Duplication failed.' });
    }
  };

  return (
    <Draggable draggableId={collection.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn("select-none group/col", snapshot.isDragging && "opacity-50")}
        >
          <NameModal 
            isOpen={isRequestModalOpen}
            onClose={() => setIsRequestModalOpen(false)}
            onConfirm={handleConfirmRequest}
            title="Deploy New Request"
            placeholder="REQUEST_NAME..."
          />
          <NameModal 
            isOpen={isFolderModalOpen}
            onClose={() => setIsFolderModalOpen(false)}
            onConfirm={handleConfirmFolder}
            title="Initialize New Folder"
            placeholder="FOLDER_NAME..."
          />
          <NameModal 
            isOpen={isRenameModalOpen}
            onClose={() => setIsRenameModalOpen(false)}
            onConfirm={handleRename}
            title="Update Identity"
            placeholder="NEW_NAME..."
            initialValue={collection.name}
          />
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => {
              setIsShareModalOpen(false);
              if (activeWorkspaceId) fetchCollections(activeWorkspaceId);
            }}
            collection={collection}
          />
          <ConfirmModal
            isOpen={isConfirmDeleteOpen}
            onClose={() => setIsConfirmDeleteOpen(false)}
            onConfirm={handleConfirmedDelete}
            title="Decommission Collection"
            description={`Delete "${collection.name}" and all its requests? This cannot be undone.`}
            confirmText="Delete"
            variant="danger"
          />
          
          <div 
            onClick={() => {
              addTab(collection);
              setIsOpen(!isOpen);
            }}
            className={cn(
              "group flex items-center px-4 py-2 hover:bg-white/[0.02] cursor-pointer transition-all border-l-2 relative overflow-hidden",
              activeTabId === collection.id ? "bg-[#3ECF8E]/5 border-[#3ECF8E]" : "border-transparent"
            )}
          >
            <div {...provided.dragHandleProps} className="mr-1 opacity-0 group-hover/col:opacity-100 transition-opacity">
              <GripVertical size={10} className="text-[#333333]" />
            </div>
            <div 
              onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
              className="p-1 -ml-1 hover:bg-white/5 rounded transition-colors relative z-10"
            >
              <motion.div
                animate={{ rotate: isOpen ? 90 : 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              >
                <ChevronRight 
                  size={12} 
                  className={cn("text-[#444444]", isOpen && "text-[#3ECF8E]")} 
                />
              </motion.div>
            </div>
            <div className="relative ml-2 mr-2 z-10">
              <Folder size={14} className={cn("transition-colors duration-300", isOpen ? "text-[#3ECF8E]" : "text-[#555555]")} />
              {isUnsaved && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />}
            </div>
            <div className="flex flex-col flex-1 min-w-0 relative z-10">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-[0.05em] truncate transition-colors",
                  isOpen ? "text-white" : "text-[#777777] group-hover/col:text-[#AAAAAA]"
                )}>
                  {collection.name}
                </span>
              </div>
              {collection.visibility === 'team' && (
                <div className="flex items-center gap-1 scale-[0.8] origin-left -mt-0.5 opacity-60">
                  <span className="text-[7px] font-black text-[#3ECF8E] uppercase tracking-tighter border border-[#3ECF8E]/30 px-1 rounded">TEAM</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover/col:opacity-100 transition-all relative z-10 scale-90">
              {canEdit && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsFolderModalOpen(true); }}
                    className="p-1.5 hover:text-[#3ECF8E] text-[#444444] transition-all hover:bg-white/5 rounded"
                    title="New Folder"
                  >
                    <Folder size={11} className="text-[#3ECF8E]/60" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsRequestModalOpen(true); }}
                    className="p-1.5 hover:text-[#3ECF8E] text-[#444444] transition-all hover:bg-white/5 rounded"
                    title="New Request"
                  >
                    <Plus size={12} strokeWidth={3} />
                  </button>
                </>
              )}
              <div ref={menuRef} className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(v => !v); }}
                  className="p-1.5 hover:text-white text-[#444444] transition-all hover:bg-white/5 rounded"
                >
                  <MoreVertical size={12} />
                </button>
                <AnimatePresence>
                  {isMenuOpen && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 5 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 5 }}
                          className="absolute right-0 top-full mt-2 w-52 bg-[#111111]/95 border border-[#222222] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,1)] py-2 z-30 backdrop-blur-xl overflow-hidden scale-95"
                        >
                          <div className="px-4 py-1.5 mb-1 border-b border-white/[0.03]">
                            <span className="text-[8px] font-black text-[#444444] uppercase tracking-[0.2em]">Actions // Node</span>
                          </div>

                          {canEdit && (
                            <button
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); setIsRenameModalOpen(true); }}
                              className="w-full text-left px-4 py-2 text-[9px] font-black uppercase text-[#888888] hover:bg-white/[0.05] hover:text-white flex items-center justify-between group/opt transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Edit3 size={12} className="text-[#444444] group-hover/opt:text-[#3ECF8E]" />
                                Rename
                              </div>
                              <span className="text-[7px] text-[#333333] font-mono group-hover/opt:text-[#555555]">F2</span>
                            </button>
                          )}

                          <button
                            onMouseDown={handleDuplicate}
                            className="w-full text-left px-4 py-2 text-[9px] font-black uppercase text-[#888888] hover:bg-white/[0.05] hover:text-white flex items-center gap-3 group/opt transition-colors"
                          >
                            <Copy size={12} className="text-[#444444] group-hover/opt:text-[#3ECF8E]" />
                            Duplicate
                          </button>

                          <div className="h-px bg-white/[0.03] my-1" />

                          {collection.user_id === profile?.id && (
                            <button
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); setIsShareModalOpen(true); }}
                              className="w-full text-left px-4 py-2 text-[9px] font-black uppercase text-[#3ECF8E] hover:bg-[#3ECF8E]/5 flex items-center gap-3 group/opt transition-colors"
                            >
                              <Users size={12} className="text-[#3ECF8E]/60 group-hover/opt:text-[#3ECF8E]" />
                              Protocol Share
                            </button>
                          )}

                          <button
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); onOpenImport(); }}
                            className="w-full text-left px-4 py-2 text-[9px] font-black uppercase text-[#888888] hover:bg-white/[0.05] hover:text-white flex items-center gap-3 group/opt transition-colors"
                          >
                            <FileUp size={12} className="text-[#444444] group-hover/opt:text-[#3ECF8E]" />
                            Import Collection
                          </button>

                          <button
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); CollectionExportService.exportCollection(collection); addToast({ type: 'success', message: 'Exporting collection binary...' }); }}
                            className="w-full text-left px-4 py-2 text-[9px] font-black uppercase text-[#888888] hover:bg-white/[0.05] hover:text-white flex items-center gap-3 group/opt transition-colors"
                          >
                            <FileDown size={12} className="text-[#444444] group-hover/opt:text-[#3ECF8E]" />
                            Export Collection
                          </button>

                          <button
                            onMouseDown={async (e) => { 
                              e.preventDefault(); 
                              e.stopPropagation(); 
                              setIsMenuOpen(false); 
                              try {
                                await GitHubService.pushUpdates(collection);
                                addToast({ type: 'success', message: 'Collection pushed to GitHub.' });
                              } catch (err: any) {
                                addToast({ type: 'error', message: `Push failed: ${err.message}` });
                              }
                            }}
                            className="w-full text-left px-4 py-2 text-[9px] font-black uppercase text-[#3ECF8E] hover:bg-[#3ECF8E]/5 flex items-center gap-3 group/opt transition-colors"
                          >
                            <Activity size={12} className="text-[#3ECF8E]/60 group-hover/opt:text-[#3ECF8E]" />
                            GitHub Sync
                          </button>

                          {canEdit && (
                            <>
                              <div className="h-px bg-white/[0.03] my-1" />
                              <button
                                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); handleDelete(e as any); }}
                                className="w-full text-left px-4 py-2 text-[9px] font-black uppercase text-red-500 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-3 group/opt transition-colors"
                              >
                                <Trash2 size={12} className="text-red-900 group-hover/opt:text-red-500" />
                                Delete
                              </button>
                            </>
                          )}
                        </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-l border-[#222222] ml-5"
          >
            <Droppable droppableId={`${collection.id}:folders`} type="folder">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {collection.folders?.map((folder: FolderType, idx: number) => (
                    <FolderNode 
                      key={folder.id} 
                      folder={folder} 
                      index={idx}
                      collectionId={collection.id} 
                      fetchCollections={fetchCollections} 
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            
            <Droppable droppableId={`${collection.id}:requests:root`} type="request">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {collection.requests?.filter((r: any) => !r.folder_id).map((req: any, idx: number) => (
                    <RequestNode 
                      key={req.id} 
                      request={req} 
                      index={idx}
                      fetchCollections={fetchCollections} 
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            {(!collection.requests?.length && !collection.folders?.length) && (
              <div className="px-4 py-2 text-[8px] font-black text-[#333333] uppercase tracking-widest italic">
                Void Node
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

const FolderNode: React.FC<{ folder: FolderType; index: number; collectionId: string; fetchCollections: (wsId: string) => Promise<void> }> = ({ folder, index, collectionId, fetchCollections }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMenuOpen(false); };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleOutside); document.removeEventListener('keydown', handleEsc); };
  }, [isMenuOpen]);

  const { profile, activeWorkspaceId, addToast, collections, canPerformAction, pendingSyncIds, addRequest } = useStore();
  const isUnsaved = pendingSyncIds.has(folder.id);
  
  const collection = collections.find(c => c.id === collectionId);
  const canEdit = collection ? canPerformAction(collection, 'edit') : false;

  const handleConfirmRequest = async (name: string) => {
    if (!profile?.id || !activeWorkspaceId) return;
    try {
      setIsOpen(true);
      const newRequest = await PersistenceService.createRequest({
        name,
        collection_id: collectionId,
        folder_id: folder.id,
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
      addRequest(newRequest);
      addToast({ type: 'success', message: `Request "${name}" nested.` });
    } catch (error) {
      addToast({ type: 'error', message: 'Nesting failed.' });
    }
  };

  const handleRename = async (newName: string) => {
    try {
      await PersistenceService.updateFolder(folder.id, { name: newName });
      await fetchCollections(activeWorkspaceId!);
      addToast({ type: 'success', message: 'Folder identity updated.' });
    } catch (error) {
      addToast({ type: 'error', message: 'Identity update failed.' });
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmedDelete = async () => {
    try {
      await PersistenceService.deleteFolder(folder.id);
      await fetchCollections(activeWorkspaceId!);
      addToast({ type: 'info', message: 'Folder liquidated.' });
    } catch (error) {
      addToast({ type: 'error', message: 'Liquidation failed.' });
    }
  };

  return (
    <Draggable draggableId={`${collectionId}:${folder.id}`} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn("select-none group/folder relative", snapshot.isDragging && "opacity-50")}
        >
          <NameModal 
            isOpen={isRequestModalOpen}
            onClose={() => setIsRequestModalOpen(false)}
            onConfirm={handleConfirmRequest}
            title="Deploy Nested Request"
            placeholder="REQUEST_NAME..."
          />
          <NameModal 
            isOpen={isRenameModalOpen}
            onClose={() => setIsRenameModalOpen(false)}
            onConfirm={handleRename}
            title="Update Folder Identity"
            placeholder="FOLDER_NAME..."
            initialValue={folder.name}
          />
          <ConfirmModal
            isOpen={isConfirmDeleteOpen}
            onClose={() => setIsConfirmDeleteOpen(false)}
            onConfirm={handleConfirmedDelete}
            title="Liquidate Folder"
            description={`Delete "${folder.name}" and all nested requests? This cannot be undone.`}
            confirmText="Delete"
            variant="danger"
          />
          <div 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center px-4 py-1.5 hover:bg-white/[0.02] cursor-pointer transition-all border-l border-transparent hover:border-white/10"
          >
            <div {...provided.dragHandleProps} className="mr-1 opacity-0 group-hover/folder:opacity-100 transition-opacity">
              <GripVertical size={10} className="text-[#333333]" />
            </div>
            <motion.div
              animate={{ rotate: isOpen ? 90 : 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <ChevronRight 
                size={10} 
                className={cn("text-[#444444]", isOpen && "text-[#3ECF8E]")} 
              />
            </motion.div>
            <Folder size={12} className={cn("ml-2 mr-2 transition-colors duration-300", isOpen ? "text-[#3ECF8E]" : "text-[#444444]")} />
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest truncate transition-colors",
                  isOpen ? "text-[#AAAAAA]" : "text-[#666666] group-hover/folder:text-[#888888]"
                )}>
                  {folder.name}
                </span>
                {isUnsaved && <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />}
              </div>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-all scale-90">
              {canEdit && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsRequestModalOpen(true); }}
                  className="p-1 hover:text-[#3ECF8E] text-[#444444] transition-all hover:bg-white/5 rounded"
                  title="New Request"
                >
                  <Plus size={10} strokeWidth={3} />
                </button>
              )}
              <div ref={menuRef} className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(v => !v); }}
                  className="p-1 hover:text-white text-[#444444] transition-all hover:bg-white/5 rounded"
                >
                  <MoreVertical size={11} />
                </button>
                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                      className="absolute right-0 top-full mt-1 w-32 bg-[#111111] border border-[#222222] rounded-lg shadow-2xl py-1 z-[100] backdrop-blur-md overflow-hidden"
                    >
                      {canEdit && (
                        <>
                          <button
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); setIsRenameModalOpen(true); }}
                            className="w-full text-left px-3 py-2 text-[8px] font-black uppercase text-[#888888] hover:bg-white/[0.03] hover:text-white"
                          >
                            Rename
                          </button>
                          <button
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); handleDelete(e as any); }}
                            className="w-full text-left px-3 py-2 text-[8px] font-black uppercase text-red-500 hover:bg-red-500/10 hover:text-red-400"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
          <AnimatePresence>
            {isOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-l border-[#222222] ml-[22px]"
              >
                <Droppable droppableId={`${collectionId}:requests:${folder.id}`} type="request">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                      {folder.requests?.map((req: any, idx: number) => (
                        <RequestNode 
                          key={req.id} 
                          request={req} 
                          index={idx}
                          fetchCollections={fetchCollections} 
                          folderId={folder.id}
                        />
                      ))}
                      {provided.placeholder}
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

const RequestNode: React.FC<{ request: RequestData; index: number; fetchCollections: (wsId: string) => Promise<void>; folderId?: string }> = ({ request, index, fetchCollections, folderId }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMenuOpen(false); };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleOutside); document.removeEventListener('keydown', handleEsc); };
  }, [isMenuOpen]);

  const { addTab, activeTabId, addToast, collections, canPerformAction, activeWorkspaceId, updateRequest, pendingSyncIds, profile } = useStore();
  const isUnsaved = pendingSyncIds.has(request.id);
  
  const collection = collections.find(c => c.id === request.collection_id);
  const canEdit = collection ? canPerformAction(collection, 'edit') : false;

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-[#3ECF8E]';
      case 'POST': return 'text-amber-500';
      case 'PUT': return 'text-blue-500';
      case 'DELETE': return 'text-red-500';
      case 'PATCH': return 'text-purple-500';
      default: return 'text-[#AAAAAA]';
    }
  };

  const handleRename = async (newName: string) => {
    try {
      updateRequest(request.id, { name: newName });
      addToast({ type: 'info', message: 'Identity update scheduled.' });
    } catch (error) {
      addToast({ type: 'error', message: 'Identity update failed.' });
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmedDelete = async () => {
    try {
      await PersistenceService.deleteRequest(request.id);
      await fetchCollections(activeWorkspaceId!);
      addToast({ type: 'info', message: 'Logical unit dismantled.' });
    } catch (error) {
      addToast({ type: 'error', message: 'Dismantle failed.' });
    }
  };

  const isActive = activeTabId === request.id;

  return (
    <Draggable draggableId={`${request.collection_id}:${request.id}${folderId ? ':' + folderId : ''}`} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn("select-none group/req relative", snapshot.isDragging && "opacity-50")}
        >
          <NameModal 
            isOpen={isRenameModalOpen}
            onClose={() => setIsRenameModalOpen(false)}
            onConfirm={handleRename}
            title="Update Node Identity"
            placeholder="REQUEST_NAME..."
            initialValue={request.name}
          />
          <ConfirmModal
            isOpen={isConfirmDeleteOpen}
            onClose={() => setIsConfirmDeleteOpen(false)}
            onConfirm={handleConfirmedDelete}
            title="Dismantle Request"
            description={`Permanently delete "${request.name}"?`}
            confirmText="Dismantle"
            variant="danger"
          />
          <div 
            onClick={() => addTab(request)}
            className={cn(
              "flex items-center px-4 py-1.5 hover:bg-white/[0.02] cursor-pointer transition-all border-l-2 relative items-stretch",
              isActive ? "bg-[#3ECF8E]/5 border-[#3ECF8E]" : "border-transparent"
            )}
          >
            {isActive && (
              <motion.div 
                layoutId="active-req-glow"
                className="absolute inset-0 bg-[#3ECF8E]/[0.02] shadow-[inset_4px_0_15px_rgba(62,207,142,0.05)] pointer-events-none"
              />
            )}
            <div {...provided.dragHandleProps} className="flex items-center mr-1 opacity-0 group-hover/req:opacity-100 transition-opacity">
              <GripVertical size={10} className="text-[#333333]" />
            </div>
            
            <div className="flex items-center gap-2 flex-1 min-w-0 relative z-10">
              <span className={cn(
                "text-[7px] font-black font-mono w-8 shrink-0 tracking-tighter uppercase",
                getMethodColor(request.method)
              )}>
                {request.method}
              </span>
              <span className={cn(
                "text-[10px] font-medium truncate uppercase tracking-wider transition-colors",
                isActive ? "text-white" : "text-[#777777] group-hover/req:text-[#AAAAAA]"
              )}>
                {request.name}
              </span>
              {isUnsaved && <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover/req:opacity-100 transition-all scale-90 relative z-10">
              <div ref={menuRef} className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(v => !v); }}
                  className="p-1 hover:text-white text-[#444444] transition-all hover:bg-white/5 rounded"
                >
                  <MoreVertical size={11} />
                </button>
                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                      className="absolute right-0 top-full mt-1 w-32 bg-[#111111] border border-[#222222] rounded-lg shadow-2xl py-1 z-[100] backdrop-blur-md overflow-hidden"
                    >
                      <button
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); setIsRenameModalOpen(true); }}
                        className="w-full text-left px-3 py-2 text-[8px] font-black uppercase text-[#888888] hover:bg-white/[0.03] hover:text-white"
                      >
                        Rename
                      </button>
                      <button
                        onMouseDown={async (e) => {
                          e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false);
                          try {
                            const duplicate = {
                              ...request,
                              id: undefined,
                              name: `${request.name} Copy`,
                              user_id: profile?.id
                            } as any;
                            delete duplicate.id;
                            const created = await PersistenceService.createRequest(duplicate);
                            await fetchCollections(activeWorkspaceId!);
                            addTab(created);
                            addToast({ type: 'success', message: 'Protocol duplicated.' });
                          } catch (err) {
                            addToast({ type: 'error', message: 'Duplication failed.' });
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-[8px] font-black uppercase text-[#3ECF8E] hover:bg-[#3ECF8E]/5"
                      >
                        Duplicate
                      </button>
                      {canEdit && (
                        <button
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); handleDelete(e as any); }}
                          className="w-full text-left px-3 py-2 text-[8px] font-black uppercase text-red-500 hover:bg-red-500/10 hover:text-red-400 mt-0.5 border-t border-white/[0.02]"
                        >
                          Dismantle
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default Sidebar;

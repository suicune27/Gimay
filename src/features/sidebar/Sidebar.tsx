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
  Minimize2
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
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNav, setActiveNav] = useState('collections');
  const [isResizing, setIsResizing] = useState(false);
  const [isHoveringCompact, setIsHoveringCompact] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarMode((sidebarMode === 'hidden') ? 'expanded' : 'hidden');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarMode, setSidebarMode]);

  // Auto-collapse for smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && sidebarMode === 'expanded') {
        setSidebarMode('compact');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarMode, setSidebarMode]);

  const startResizing = (e: React.MouseEvent) => {
    if (isLocked || sidebarMode === 'hidden') return;
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      let newWidth = e.clientX;
      const minWidth = sidebarMode === 'compact' ? 64 : 180;
      const maxWidth = 600;
      
      if (newWidth < 100) {
        setSidebarMode('compact');
        newWidth = 64;
      } else {
        setSidebarMode('expanded');
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
      }
      
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.cursor = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isLocked, sidebarMode, setSidebarWidth, setSidebarMode]);

  const toggleSidebar = () => {
    if (sidebarMode === 'expanded') {
      setSidebarMode('compact');
    } else if (sidebarMode === 'compact') {
      setSidebarMode('hidden');
    } else {
      setSidebarMode('expanded');
    }
  };

  const handleMouseEnter = () => {
    if (sidebarMode === 'compact') {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = window.setTimeout(() => {
        setIsHoveringCompact(true);
      }, 300);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsHoveringCompact(false);
  };

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
    <div 
      ref={sidebarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "h-full bg-[#0F0F0F] border-r border-[#222222] flex flex-col transition-all duration-300 relative z-40 group/sidebar overflow-hidden",
        sidebarMode === 'hidden' ? "w-0 border-none opacity-0 pointer-events-none" : "",
        isHoveringCompact ? "absolute left-0 shadow-2xl !w-[300px]" : ""
      )}
      style={{ 
        width: sidebarMode === 'hidden' ? 0 : (sidebarMode === 'compact' && !isHoveringCompact ? 64 : sidebarWidth),
        minWidth: sidebarMode === 'hidden' ? 0 : (sidebarMode === 'compact' && !isHoveringCompact ? 64 : 180),
        zIndex: isHoveringCompact ? 100 : 40
      }}
    >
      {/* Resize Handle */}
      {sidebarMode !== 'hidden' && (
        <div 
          onMouseDown={startResizing}
          className={cn(
            "absolute -right-0.5 top-0 bottom-0 w-1 cursor-col-resize z-50 transition-colors",
            isResizing ? "bg-[var(--brand)]" : "hover:bg-[var(--brand)]/30",
            isLocked && "cursor-default pointer-events-none"
          )}
        >
          {isResizing && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 bg-[var(--brand)] rounded-full shadow-[0_0_15px_var(--brand)]" />}
        </div>
      )}

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
      <div 
        className={cn(
          "h-14 border-b border-[var(--border-subtle)] flex items-center px-4 gap-3 bg-[var(--bg-surface)] cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors overflow-hidden",
          sidebarMode === 'compact' && !isHoveringCompact && "justify-center px-0"
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center text-black font-black text-xs shadow-[0_0_15px_var(--brand-muted)] shrink-0">
          {activeWorkspace?.name?.[0].toUpperCase() || 'W'}
        </div>
        {(sidebarMode === 'expanded' || isHoveringCompact) && (
          <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2 duration-200">
            <h2 className="text-[11px] font-black text-[var(--text-main)] uppercase tracking-widest truncate">
              {activeWorkspace?.name || 'Workspace'}
            </h2>
            <p className="text-[9px] text-[var(--text-dim)] font-mono tracking-tighter uppercase">
              {activeWorkspace?.visibility || 'Private'} Node
            </p>
          </div>
        )}
        {(sidebarMode === 'expanded' || isHoveringCompact) && <ChevronDown size={14} className="text-[var(--text-dim)]" />}
      </div>

      {/* Explorer Controls */}
      {(sidebarMode === 'expanded' || isHoveringCompact) && activeNav === 'collections' && (
        <div className="p-3 space-y-3">
          <div className="relative group">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] group-focus-within:text-[var(--brand)] transition-colors" />
            <input 
              type="text" 
              placeholder="FILTER_COLLECTIONS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-md py-1.5 pl-8 pr-3 text-[10px] font-mono text-[var(--text-muted)] focus:border-[var(--brand)]/50 outline-none transition-all"
            />
          </div>
          
          <div className="flex gap-1">
            <button 
              onClick={() => setIsCollectionModalOpen(true)}
              className="flex-1 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[9px] font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-deep)] transition-all flex items-center justify-center gap-1.5 uppercase"
            >
              <Plus size={12} className="text-[var(--brand)]" /> Collection
            </button>
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[9px] font-bold text-[var(--text-muted)] hover:text-[var(--brand)] transition-all flex items-center justify-center gap-1.5 uppercase disabled:opacity-50"
            >
              <Upload size={12} className="text-[var(--brand)]/80" /> Import
            </button>
          </div>
        </div>
      )}

      {/* Navigation Icons */}
      <div className="flex flex-col flex-1 min-h-0 bg-[#0F0F0F]">
        <div className={cn(
          "flex border-b border-[var(--border-subtle)]",
          (sidebarMode === 'compact' && !isHoveringCompact) ? "flex-col" : ""
        )}>
          {[
            { id: 'collections', icon: LayoutGrid, label: 'Collections' },
            { id: 'environments', icon: Globe, label: 'Environments' },
            { id: 'history', icon: Activity, label: 'History' },
            { id: 'teams', icon: Users, label: 'Teams' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              title={sidebarMode === 'compact' ? item.label : undefined}
              className={cn(
                "flex-1 flex items-center justify-center transition-all",
                (sidebarMode === 'compact' && !isHoveringCompact) ? "py-4 border-r-0 border-l-2" : "py-2 border-b-2",
                "hover:text-[var(--text-main)]",
                activeNav === item.id 
                  ? "text-[var(--brand)] border-[var(--brand)] bg-[var(--brand)]/5" 
                  : "text-[var(--text-dim)] border-transparent"
              )}
            >
              <item.icon size={16} />
            </button>
          ))}
        </div>

        {/* Tree View */}
        <div className={cn(
          "flex-1 overflow-y-auto no-scrollbar py-2",
          (sidebarMode === 'compact' && !isHoveringCompact) && "hidden"
        )}>
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
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest">Active Env</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsGlobalModalOpen(true)}
                    className="text-amber-500 text-[10px] font-black uppercase hover:text-amber-400 transition-all"
                  >
                    Globals
                  </button>
                  <button 
                    onClick={() => setIsEnvModalOpen(true)}
                    className="text-[var(--brand)] text-[10px] font-black uppercase hover:text-[var(--brand)]/80 transition-all"
                  >
                    + New
                  </button>
                </div>
              </div>
              {(environments || []).map(env => (
                <div 
                  key={env.id} 
                  onClick={() => setActiveEnvId(activeEnvId === env.id ? null : env.id)}
                  className={cn(
                    "p-3 bg-[var(--bg-elevated)] border rounded-xl hover:bg-[var(--bg-deep)] transition-all cursor-pointer group/env relative",
                    activeEnvId === env.id ? "border-[var(--brand)] shadow-[0_0_15px_var(--brand-muted)]" : "border-[var(--border-subtle)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-[var(--text-main)] mb-1">{env.name}</div>
                    <div className="flex items-center gap-2 opacity-0 group-hover/env:opacity-100 transition-all">
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEnv(env);
                          setIsEnvModalOpen(true);
                        }}
                        className="p-1 hover:text-[var(--brand)] text-[var(--text-dim)]"
                       >
                         <Settings size={12} />
                       </button>
                       <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmEnvDelete({ id: env.id, name: env.name });
                        }}
                        className="p-1 hover:text-red-500 text-[var(--text-dim)]"
                       >
                         <Trash2 size={12} />
                       </button>
                    </div>
                  </div>
                  <div className="text-[9px] text-[var(--text-dim)] uppercase tracking-tighter">
                    {env.variables?.length || 0} Variables
                  </div>
                </div>
              ))}
              {environments.length === 0 && (
                <div className="py-8 text-center opacity-20">
                  <Globe size={32} className="mx-auto mb-2" />
                  <p className="text-[9px] font-black uppercase tracking-widest">No Environments</p>
                </div>
              )}
            </div>
          )}

          {activeNav === 'history' && (
            <div className="space-y-1">
              {(history || []).map((item, idx) => (
                <div 
                  key={idx} 
                  onClick={async () => {
                    if (item.request_data) {
                      addTab({
                        ...item.request_data,
                        id: `history-${item.id}`,
                        name: `Replay: ${item.request_name || 'Untitled'}`
                      });
                      addToast({ type: 'info', message: 'History state restored.' });
                    } else {
                      // Fallback for old history items
                      addToast({ type: 'info', message: 'Replaying from legacy logs...' });
                      addTab({
                        id: item.request_id,
                        name: item.request_name || 'History Item',
                        method: item.method,
                        url: item.url,
                        workspace_id: activeWorkspaceId!,
                        user_id: profile!.id,
                        headers: [],
                        params: [],
                        body: '',
                        bodyType: 'none',
                        auth: { type: 'inherit' }
                      } as any);
                    }
                  }}
                  className="px-4 py-2 hover:bg-[var(--bg-elevated)] cursor-pointer group border-r-2 border-transparent hover:border-[var(--brand)] transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "text-[8px] font-black font-mono px-1.5 py-0.5 rounded bg-black/20",
                      item.method === 'GET' ? 'text-[var(--brand)]' : 
                      item.method === 'POST' ? 'text-yellow-500' :
                      item.method === 'PUT' ? 'text-blue-500' :
                      item.method === 'DELETE' ? 'text-red-500' : 'text-[var(--text-muted)]'
                    )}>{item.method}</span>
                    <span className="text-[10px] font-bold text-[var(--text-muted)] truncate flex-1">{item.url}</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <span className="text-[8px] text-[var(--text-dim)] font-mono">{new Date(item.created_at).toLocaleTimeString()}</span>
                        <div className="w-1 h-1 rounded-full bg-[var(--border-subtle)]" />
                        <span className="text-[8px] text-[var(--text-dim)] font-mono">{item.time}ms</span>
                        {item.size && (
                           <>
                             <div className="w-1 h-1 rounded-full bg-[var(--border-subtle)]" />
                             <span className="text-[8px] text-[var(--text-dim)] font-mono">{Math.round(item.size / 1024 * 100) / 100}KB</span>
                           </>
                        )}
                     </div>
                     <span className={cn(
                       "text-[8px] font-bold px-1.5 py-0.5 rounded",
                       item.status < 400 ? "bg-[var(--brand)]/5 text-[var(--brand)]" : "bg-red-500/5 text-red-500"
                     )}>{item.status}</span>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <div className="py-8 text-center opacity-20">
                  <Activity size={32} className="mx-auto mb-2" />
                  <p className="text-[9px] font-black uppercase tracking-widest">Protocol Clear</p>
                </div>
              )}
            </div>
          )}

          {activeNav === 'teams' && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-[#555555] uppercase tracking-widest">Deployment Units</span>
                <button 
                  onClick={() => setIsTeamModalOpen(true)}
                  className="text-[#3ECF8E] text-[10px] font-black uppercase shadow-[0_0_10px_rgba(62,207,142,0.2)]"
                >
                  + Unit
                </button>
              </div>
              {(teams || []).map(team => (
                <div 
                  key={team.id} 
                  onClick={() => {
                    setSelectedTeam(team);
                    setIsTeamModalOpen(true);
                  }}
                  className="p-3 bg-[#111111] border border-[#222222] rounded-xl hover:bg-[#151515] hover:border-[#3ECF8E]/30 transition-all cursor-pointer group/team"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#1A1A1A] border border-[#222222] flex items-center justify-center text-[#AAAAAA] group-hover/team:text-[#3ECF8E] group-hover/team:border-[#3ECF8E]/30 font-black text-xs uppercase transition-all">
                      {team.name?.[0] || 'T'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">{team.name || 'Unnamed Unit'}</div>
                      <div className="text-[9px] text-[#555555] uppercase tracking-tighter">
                        {team.team_members?.length || 1} Operators
                      </div>
                    </div>
                    <Settings size={12} className="text-[#333333] group-hover/team:text-[#AAAAAA] transition-colors" />
                  </div>
                </div>
              ))}
              {teams.length === 0 && (
                <div className="py-8 text-center border border-dashed border-[#222222] rounded-xl bg-[#0A0A0A]/50">
                  <Users size={32} className="mx-auto mb-2 text-[#222222]" />
                  <p className="text-[9px] font-black text-[#333333] uppercase tracking-widest">No Sector Presence</p>
                  <p className="text-[8px] text-[#222222] uppercase tracking-tighter mt-2">Initialize a unit to begin collaborative ops.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-[#222222] bg-[#0A0A0A]">
        <div className="flex flex-col gap-1">
          <button 
            onClick={() => setIsSettingsModalOpen(true)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
              "text-[#555555] hover:text-[#3ECF8E] hover:bg-[#3ECF8E]/5",
              (sidebarMode === 'compact' && !isHoveringCompact) && "justify-center px-0"
            )}
          >
            <Settings size={14} />
            {(sidebarMode === 'expanded' || isHoveringCompact) && <span>Settings</span>}
          </button>

          <div className={cn(
            "flex items-center gap-1 border-t border-[#222222]/50 mt-1 pt-1",
            (sidebarMode === 'compact' && !isHoveringCompact) ? "flex-col" : "justify-between px-2"
          )}>
            <button
              onClick={toggleSidebar}
              title={sidebarMode === 'expanded' ? 'Collapse Sidebar' : 'Expand Sidebar'}
              className="p-2 text-[var(--text-dim)] hover:text-[var(--brand)] transition-all rounded"
            >
              {sidebarMode === 'expanded' ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
            </button>

            {(sidebarMode === 'expanded' || isHoveringCompact) && (
              <>
                <button
                  onClick={() => setIsLocked(!isLocked)}
                  title={isLocked ? 'Unlock Width' : 'Lock Width'}
                  className={cn("p-2 transition-all rounded", isLocked ? "text-[var(--brand)]" : "text-[var(--text-dim)] hover:text-[#AAAAAA]")}
                >
                  {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
                <button
                  onClick={() => setSidebarMode(sidebarMode === 'expanded' ? 'compact' : 'expanded')}
                  title={sidebarMode === 'expanded' ? 'Compact Mode' : 'Expanded Mode'}
                  className="p-2 text-[var(--text-dim)] hover:text-[var(--brand)] transition-all rounded"
                >
                  {sidebarMode === 'expanded' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </>
            )}
          </div>
          
          {(sidebarMode === 'expanded' || isHoveringCompact) && (
            <div className="flex items-center gap-3 px-3 py-2 mt-1 border-t border-[#222222]/50 pt-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
              <div className="w-6 h-6 rounded-full bg-[#1A1A1A] border border-[#222222] flex items-center justify-center text-[10px] font-black text-[#555555] shrink-0">
                {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[#AAAAAA] truncate">{profile?.full_name || 'Operator'}</p>
                <p className="text-[8px] text-[#444444] truncate">{profile?.email}</p>
              </div>
            </div>
          )}
          
          {sidebarMode === 'compact' && !isHoveringCompact && (
            <div className="flex justify-center py-2">
              <div className="w-6 h-6 rounded-full bg-[#1A1A1A] border border-[#222222] flex items-center justify-center text-[10px] font-black text-[#555555]">
                {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
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

  return (
    <Draggable draggableId={collection.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn("select-none", snapshot.isDragging && "opacity-50")}
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
              "group flex items-center px-4 py-2 hover:bg-[#1A1A1A] cursor-pointer transition-colors border-l-2",
              activeTabId === collection.id ? "bg-[#3ECF8E]/5 border-[#3ECF8E]" : "border-transparent"
            )}
          >
            <div {...provided.dragHandleProps} className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={10} className="text-[#333333]" />
            </div>
            <div 
              onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
              className="p-1 -ml-1 hover:bg-white/5 rounded transition-colors"
            >
              <ChevronRight 
                size={12} 
                className={cn("text-[#444444] transition-transform", isOpen && "rotate-90 text-[#3ECF8E]")} 
              />
            </div>
            <Folder size={14} className={cn("ml-2 mr-2", isOpen ? "text-[#3ECF8E]" : "text-[#555555]")} />
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className={cn(
                  "text-[11px] font-bold uppercase tracking-wider truncate",
                  isOpen ? "text-white" : "text-[#888888]"
                )}>
                  {collection.name}
                </span>
                {isUnsaved && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-1 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />}
              </div>
              {collection.visibility === 'team' && (
                <div className="flex items-center gap-1">
                  <span className="text-[7px] font-black text-[#3ECF8E] uppercase tracking-tighter">Shared: {collection.permission}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {canEdit && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsFolderModalOpen(true); }}
                className="p-1 hover:text-[#3ECF8E] text-[#555555] transition-all"
                title="Add Folder"
              >
                <Plus size={10} strokeWidth={3} className="text-[#3ECF8E]/50" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsRequestModalOpen(true); }}
                className="p-1 hover:text-[#3ECF8E] text-[#555555] transition-all"
                title="Add Request"
              >
                <Plus size={12} />
              </button>
            </>
          )}
          <div ref={menuRef} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen(v => !v); }}
              className="p-1 hover:text-white text-[#555555] transition-all"
            >
              <MoreVertical size={12} />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-[#111111] border border-[#222222] rounded-lg shadow-2xl py-1 z-[100]">
                {canEdit && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); setIsRenameModalOpen(true); }}
                    className="w-full text-left px-3 py-2 text-[9px] font-black uppercase text-[#AAAAAA] hover:bg-[#1A1A1A] hover:text-white"
                  >
                    Rename
                  </button>
                )}
                {collection.user_id === profile?.id && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); setIsShareModalOpen(true); }}
                    className="w-full text-left px-3 py-2 text-[9px] font-black uppercase text-[#3ECF8E] hover:bg-[#3ECF8E]/10"
                  >
                    Share
                  </button>
                )}
                <button
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); onOpenImport(); }}
                  className="w-full text-left px-3 py-2 text-[9px] font-black uppercase text-[#AAAAAA] hover:bg-[#1A1A1A] hover:text-white"
                >
                  Import Collection
                </button>
                <button
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); CollectionExportService.exportCollection(collection); addToast({ type: 'success', message: 'Exporting collection...' }); }}
                  className="w-full text-left px-3 py-2 text-[9px] font-black uppercase text-[#3ECF8E] hover:bg-[#3ECF8E]/10"
                >
                  Export
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
                  className="w-full text-left px-3 py-2 text-[9px] font-black uppercase text-[#3ECF8E] hover:bg-[#3ECF8E]/10"
                >
                  Sync to GitHub
                </button>
                {canEdit && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); handleDelete(e as any); }}
                    className="w-full text-left px-3 py-2 text-[9px] font-black uppercase text-red-500 hover:bg-red-500/10 hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
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
          className={cn("select-none", snapshot.isDragging && "opacity-50")}
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
            className="group flex items-center px-4 py-1.5 hover:bg-[#1A1A1A] cursor-pointer transition-colors"
          >
            <div {...provided.dragHandleProps} className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={10} className="text-[#333333]" />
            </div>
            <ChevronRight 
              size={10} 
              className={cn("text-[#444444] transition-transform", isOpen && "rotate-90 text-[#3ECF8E]")} 
            />
            <Folder size={12} className={cn("ml-2 mr-2", isOpen ? "text-[#3ECF8E]" : "text-[#555555]")} />
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className={cn(
                  "text-[10px] font-bold truncate",
                  isOpen ? "text-white" : "text-[#777777]"
                )}>
                  {folder.name}
                </span>
                {isUnsaved && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-1 shadow-[0_0_5px_rgba(59,130,246,0.5)]" />}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              {canEdit && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsRequestModalOpen(true); }}
                  className="p-1 hover:text-[#3ECF8E] text-[#555555] transition-all"
                  title="Add Request"
                >
                  <Plus size={10} strokeWidth={3} />
                </button>
              )}
              <div ref={menuRef} className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(v => !v); }}
                  className="p-1 hover:text-white text-[#555555] transition-all"
                >
                  <MoreVertical size={12} />
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-32 bg-[#111111] border border-[#222222] rounded-lg shadow-2xl py-1 z-[100]">
                    {canEdit && (
                      <>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); setIsRenameModalOpen(true); }}
                          className="w-full text-left px-3 py-2 text-[9px] font-black uppercase text-[#AAAAAA] hover:bg-[#1A1A1A] hover:text-white"
                        >
                          Rename
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); handleDelete(e as any); }}
                          className="w-full text-left px-3 py-2 text-[9px] font-black uppercase text-red-500 hover:bg-red-500/10 hover:text-red-400"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <AnimatePresence>
            {isOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-l border-[#222222] ml-4"
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

const RequestNode: React.FC<{ request: RequestData; index: number; fetchCollections: (wsId: string) => Promise<void> }> = ({ request, index, fetchCollections }) => {
  const { addTab, activeTabId, addToast, activeWorkspaceId, updateRequest, collections, canPerformAction, pendingSyncIds, deleteRequestState } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(request.name);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isUnsaved = pendingSyncIds.has(request.id);

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
  const isActive = activeTabId === request.id;

  const collection = collections.find(c => c.id === request.collection_id);
  const canEdit = collection ? canPerformAction(collection, 'edit') : false;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmedDelete = async () => {
    try {
      await PersistenceService.deleteRequest(request.id);
      deleteRequestState(request.id);
      addToast({ type: 'info', message: 'Request purged.' });
    } catch (error) {
      addToast({ type: 'error', message: 'Purge sequence failed.' });
    }
  };

  const handleRename = async () => {
    if (editValue === request.name) {
      setIsEditing(false);
      return;
    }
    try {
      await PersistenceService.updateRequest(request.id, { name: editValue });
      updateRequest(request.id, { name: editValue });
      if (activeWorkspaceId) await fetchCollections(activeWorkspaceId);
      setIsEditing(false);
      addToast({ type: 'success', message: 'Request identity updated.' });
    } catch (error) {
      addToast({ type: 'error', message: 'Update failed.' });
      setEditValue(request.name);
      setIsEditing(false);
    }
  };

  const draggableId = request.folder_id ? `${request.collection_id}:${request.id}:${request.folder_id}` : `${request.collection_id}:${request.id}`;

  return (
    <Draggable draggableId={draggableId} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn("select-none", snapshot.isDragging && "opacity-50")}
        >
          <ConfirmModal
            isOpen={isConfirmDeleteOpen}
            onClose={() => setIsConfirmDeleteOpen(false)}
            onConfirm={handleConfirmedDelete}
            title="Delete Request"
            description={`Permanently delete "${request.name}"? This cannot be undone.`}
            confirmText="Delete"
            variant="danger"
          />
          <div 
            onClick={() => !isEditing && addTab(request)}
            className={cn(
              "group flex items-center px-4 py-1.5 hover:bg-[#1A1A1A] cursor-pointer transition-all border-r-2",
              isActive ? "bg-[#3ECF8E]/5 border-[#3ECF8E] text-white" : "border-transparent text-[#666666]"
            )}
          >
            <div {...provided.dragHandleProps} className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={10} className="text-[#333333]" />
            </div>
            
            <div className={cn(
              "text-[8px] font-black w-8 tracking-tighter shrink-0",
              request.method === 'GET' ? 'text-[#3ECF8E]' : 
              request.method === 'POST' ? 'text-yellow-500' :
              request.method === 'PUT' ? 'text-blue-500' :
              request.method === 'DELETE' ? 'text-red-500' : 'text-[#777777]'
            )}>
              {request.method}
            </div>
            
            <div className="flex-1 min-w-0 flex items-center gap-1">
              {isEditing ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                    if (e.key === 'Escape') {
                      setEditValue(request.name);
                      setIsEditing(false);
                    }
                  }}
                  className="text-[10px] font-bold bg-[#0A0A0A] border border-[#3ECF8E]/50 rounded px-1 flex-1 min-w-0 outline-none text-white focus:ring-1 ring-[#3ECF8E]/20"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="text-[10px] font-bold truncate flex-1 tracking-tight">
                    {request.name}
                  </span>
                  {isUnsaved && <div className="w-1 h-1 rounded-full bg-blue-500 shrink-0" />}
                </>
              )}
            </div>

            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all shrink-0">
              <div ref={menuRef} className="relative">
                <button
                  className="p-1 hover:text-white text-[#555555] transition-all"
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen(v => !v); }}
                >
                  <MoreVertical size={12} />
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-32 bg-[#111111] border border-[#222222] rounded-lg shadow-2xl py-1 z-[100]">
                    {canEdit && (
                      <button
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); setIsEditing(true); }}
                        className="w-full text-left px-3 py-2 text-[9px] font-black uppercase text-[#AAAAAA] hover:bg-[#1A1A1A] hover:text-white"
                      >
                        Rename
                      </button>
                    )}
                    <button
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); useStore.getState().duplicateRequest(request.id); }}
                      className="w-full text-left px-3 py-2 text-[9px] font-black uppercase text-[#3ECF8E] hover:bg-[#3ECF8E]/10"
                    >
                      Duplicate
                    </button>
                    {canEdit && (
                      <button
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsMenuOpen(false); handleDelete(e as any); }}
                        className="w-full text-left px-3 py-2 text-[9px] font-black uppercase text-red-500 hover:bg-red-500/10 hover:text-red-400"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default Sidebar;

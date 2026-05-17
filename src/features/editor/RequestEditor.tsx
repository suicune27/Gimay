import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send,
  Save,
  Trash2,
  Share2,
  Code2,
  Clock,
  Search,
  X,
  Plus,
  Play,
  Zap,
  ChevronDown,
  Cloud,
  CloudOff,
  RefreshCcw,
  Pencil,
  TerminalSquare,
  Layout,
  Columns,
  Check
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { RequestService } from '../../services/RequestService';
import { PersistenceService } from '../../services/PersistenceService';
import { ScriptLibraryService } from '../../services/ScriptLibraryService';
import { RequestData, Collection, EnvironmentTab, KeyValue, BodyType, RequestBody } from '../../types';
import { RequestUtils } from '../../utils/RequestUtils';
import { KVEditor } from '../../components/KVEditor';
import { NameModal } from '../../components/NameModal';
import { ScriptService } from '../../services/ScriptService';
import { AuthEditor } from '../../components/AuthEditor';
import { ResponseViewer } from './ResponseViewer';
import { CollectionEditor } from './CollectionEditor';
import { EnvironmentEditor } from './EnvironmentEditor';
import { VariableInput } from '../../components/VariableInput';
import { CollectionImportModal } from '../../components/CollectionImportModal';
import { VariableService } from '../../services/VariableService';
import { ScriptLibraryModal } from '../scripts/ScriptLibraryModal';
import { useScriptStore } from '../../store/scriptStore';
import { parseCurl } from '../../lib/curlParser';
import Editor from '@monaco-editor/react';

const parseUrlParams = (url: string): Array<{ key: string; value: string }> => {
  const hashIndex = url.indexOf('#');
  const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex === -1) return [];

  const rawQuery = withoutHash.slice(queryIndex + 1);
  if (!rawQuery) return [];

  const normalized = rawQuery
    .replace(/^&+/, '')
    .replace(/&{2,}/g, '&');

  const params = new URLSearchParams(normalized);
  const parsed: Array<{ key: string; value: string }> = [];
  params.forEach((value, key) => {
    parsed.push({ key, value });
  });

  return parsed;
};

const buildUrlWithParams = (currentUrl: string, params: KeyValue[]): string => {
  const hashIndex = currentUrl.indexOf('#');
  const hash = hashIndex >= 0 ? currentUrl.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? currentUrl.slice(0, hashIndex) : currentUrl;
  const queryIndex = withoutHash.indexOf('?');
  const base = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;

  const search = new URLSearchParams();
  params.forEach((param) => {
    if (!param.active) return;
    const key = (param.key || '').trim();
    if (!key) return;
    search.append(key, param.value || '');
  });

  const query = search.toString();
  const rebuilt = query ? `${base}?${query}` : base;
  return `${rebuilt}${hash}`;
};

const haveSameParamShape = (a: KeyValue[], b: KeyValue[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].key !== b[i].key) return false;
    if (a[i].value !== b[i].value) return false;
    if (a[i].active !== b[i].active) return false;
  }
  return true;
};

const mergeParsedParams = (existing: KeyValue[], parsed: Array<{ key: string; value: string }>): KeyValue[] => {
  const activeExisting = existing.filter((p) => p.active);
  const inactiveExisting = existing.filter((p) => !p.active);
  const usedActiveIndexes = new Set<number>();

  const mergedActive = parsed.map((item, parsedIndex) => {
    // Prefer same position to preserve identity/order with minimal churn.
    const positional = activeExisting[parsedIndex];
    if (positional && !usedActiveIndexes.has(parsedIndex)) {
      usedActiveIndexes.add(parsedIndex);
      return {
        ...positional,
        key: item.key,
        value: item.value,
        active: true,
      };
    }

    const fallbackIndex = activeExisting.findIndex((p, idx) => {
      if (usedActiveIndexes.has(idx)) return false;
      return p.key === item.key;
    });

    if (fallbackIndex >= 0) {
      usedActiveIndexes.add(fallbackIndex);
      return {
        ...activeExisting[fallbackIndex],
        value: item.value,
        active: true,
      };
    }

    return {
      id: Math.random().toString(36).substr(2, 9),
      key: item.key,
      value: item.value,
      active: true,
    };
  });

  // Keep disabled rows as-is so URL sync doesn't wipe user-staged params.
  return [...mergedActive, ...inactiveExisting];
};

export const RequestEditor: React.FC = () => {
  const {
    openTabs,
    activeTabId,
    closeTab,
    setActiveTab,
    updateTab,
    updateRequest,
    updateCollection,
    isSending,
    setIsSending,
    setLastResponse,
    addToast,
    environments,
    activeEnvId,
    collections,
    activeWorkspaceId,
    profile,
    canPerformAction,
    syncStatus,
    theme,
    setIsScriptLibraryOpen,
    settings,
    pendingSyncIds,
    syncResource,
    layoutOrientation,
    setLayoutOrientation
  } = useStore();

  const [activeSection, setActiveSection] = useState<'Parameters' | 'Authorization' | 'Headers' | 'Body' | 'Scripts' | 'Settings'>('Parameters');
  const [editingCollectionTabId, setEditingCollectionTabId] = useState<string | null>(null);
  const [collectionTabNameDraft, setCollectionTabNameDraft] = useState('');
  const [editingRequestTabId, setEditingRequestTabId] = useState<string | null>(null);
  const [requestTabNameDraft, setRequestTabNameDraft] = useState('');
  const [activeScriptTarget, setActiveScriptTarget] = useState<'pre_request_script' | 'test_script'>('pre_request_script');
  const { scripts } = useScriptStore();
  const [isImportDropdownOpen, setIsImportDropdownOpen] = useState(false);
  const [importSearchQuery, setImportSearchQuery] = useState('');

  const filteredLabScripts = useMemo(() => {
    const list = scripts || [];
    if (!importSearchQuery) return list;
    return list.filter((s) => s.name.toLowerCase().includes(importSearchQuery.toLowerCase()));
  }, [scripts, importSearchQuery]);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const paramUrlSyncSourceRef = useRef<'url' | 'params' | null>(null);

  const activeItem = openTabs.find(t => t.id === activeTabId);
  const isEnvironmentTab = !!activeItem && 'type' in activeItem && (activeItem as EnvironmentTab).type === 'environment-manager';
  const isCollection = !!activeItem && !isEnvironmentTab && 'requests' in activeItem;
  const activeRequest = isCollection || isEnvironmentTab ? null : (activeItem as RequestData);

  const isPending = !!activeRequest && pendingSyncIds.has(activeRequest.id);
  const showSaveButton = !settings.general.autoSave;

  const handleManualSave = async () => {
    if (!activeRequest) return;
    setIsSavingManual(true);
    try {
      const success = await (syncResource as any)('request', activeRequest.id);
      if (success) {
        addToast({ type: 'success', message: 'Sector synchronized manually.' });
      }
    } finally {
      setIsSavingManual(false);
    }
  };

  const collection = activeRequest
    ? collections.find(c => c.id === activeRequest.collection_id)
    : (isCollection ? activeItem as Collection : null);

  // Permissions: Default to editable if collection not found or user is owner
  const canEdit = useMemo(() => {
    if (!activeRequest || activeRequest.id.startsWith('temp-')) return true;
    if (!collection) return true; // Optimistic: allow editing if collection metadata hasn't synced yet
    return canPerformAction(collection, 'edit');
  }, [activeRequest, collection, canPerformAction]);

  const canExecute = useMemo(() => {
    if (!activeRequest) return false;
    if (!collection) return true;
    return canPerformAction(collection, 'execute');
  }, [activeRequest, collection, canPerformAction]);

  useEffect(() => {
    if (!editingCollectionTabId || !collectionTabNameDraft.trim()) return;
    const targetCollection = collections.find(c => c.id === editingCollectionTabId);
    if (!targetCollection || targetCollection.name === collectionTabNameDraft.trim()) return;

    const timer = window.setTimeout(() => {
      updateCollection(editingCollectionTabId, { name: collectionTabNameDraft.trim() });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [editingCollectionTabId, collectionTabNameDraft, collections, updateCollection]);

  useEffect(() => {
    if (!activeRequest) return;
    if (paramUrlSyncSourceRef.current === 'url') {
      paramUrlSyncSourceRef.current = null;
      return;
    }

    const rebuiltUrl = buildUrlWithParams(activeRequest.url || '', activeRequest.params || []);
    if (rebuiltUrl === activeRequest.url) return;

    paramUrlSyncSourceRef.current = 'params';
    updateRequest(activeRequest.id, { url: rebuiltUrl });
  }, [activeRequest?.id, activeRequest?.params]);

  useEffect(() => {
    if (!activeRequest) return;
    if (paramUrlSyncSourceRef.current === 'params') {
      paramUrlSyncSourceRef.current = null;
      return;
    }

    const parsedFromUrl = parseUrlParams(activeRequest.url || '');
    const mergedParams = mergeParsedParams(activeRequest.params || [], parsedFromUrl);
    if (haveSameParamShape(activeRequest.params || [], mergedParams)) return;

    paramUrlSyncSourceRef.current = 'url';
    updateRequest(activeRequest.id, { params: mergedParams });
  }, [activeRequest?.id, activeRequest?.url]);

  const handleSaveRequestTabName = useCallback((tabId: string, newName: string) => {
    const trimmed = newName.trim();
    setEditingRequestTabId(null);
    setRequestTabNameDraft('');
    if (!trimmed) return;
    const tab = openTabs.find(t => t.id === tabId) as RequestData | undefined;
    if (!tab || tab.name === trimmed) return;
    // updateRequest handles openTabs + collections tree + 5-second debounced sync in one call
    updateRequest(tabId, { name: trimmed });
  }, [openTabs, updateRequest]);

  const handleSend = async () => {
    if (!activeRequest || !profile) return;
    setIsSending(true);

    try {
      addToast({ type: 'info', message: 'Transmission initiated...' });

      const context = {
        environments,
        activeEnvId: activeEnvId,
        collections,
        collection,
        variables: VariableService.getResolvedVariableMap({
          environments,
          activeEnvId,
          collection: collection || null,
          variables: {}
        })
      };

      // 1. Pre-request Scripts (Global -> Environment -> Collection -> Request)
      let requestToExecute = activeRequest;
      const activeEnvironment = activeEnvId
        ? environments.find((env) => env.id === activeEnvId)
        : null;

      const preScripts = [
        activeEnvironment?.pre_request_script,
        collection?.pre_request_script,
        activeRequest.pre_request_script
      ].filter(Boolean) as string[];

      const preRequestOut = await ScriptService.executePreRequest(
        preScripts,
        requestToExecute,
        context
      );
      requestToExecute = preRequestOut.request;
      let executionLogs = preRequestOut.logs || [];

      // 2. Execute
      const response = await RequestService.execute(requestToExecute, context);

      const testScripts = [
        activeEnvironment?.test_script,
        collection?.test_script,
        activeRequest.test_script
      ].filter(Boolean) as string[];

      const testOut = await ScriptService.executeTests(
        testScripts,
        response,
        requestToExecute,
        context
      );

      const results = testOut.results;
      executionLogs = [...executionLogs, ...(testOut.logs || [])];

      setLastResponse({
        ...response,
        testResults: results,
        consoleLogs: executionLogs
      });

      addToast({
        type: results.some(r => r.status === 'fail') ? 'warning' : 'success',
        message: `Execution successful (${response.status})`
      });

      // Save to history
      await PersistenceService.saveHistory({
        workspace_id: activeWorkspaceId!,
        user_id: profile.id,
        request_id: activeRequest.id,
        request_name: activeRequest.name,
        method: activeRequest.method,
        url: activeRequest.url,
        status: response.status,
        time: response.time,
        size: response.size,
        request_data: activeRequest,
        response_data: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: response.body,
          time: response.time,
          size: response.size
        }
      });

      if (executionLogs.length > 0 && activeWorkspaceId) {
        ScriptLibraryService.logExecution({
          request_id: activeRequest.id,
          workspace_id: activeWorkspaceId,
          user_id: profile.id,
          logs: executionLogs,
          errors: executionLogs.filter(l => l.level === 'error'),
          duration: response.time,
          variables_changed: {}
        });
      }
    } catch (error) {
      addToast({ type: 'error', message: 'Transmission interrupted.' });
      setLastResponse(null);
    } finally {
      setIsSending(false);
    }
  };

  const [responseHeight, setResponseHeight] = useState(40); // percentage
  const [responseWidth, setResponseWidth] = useState(40); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    
    if (layoutOrientation === 'vertical') {
      const newHeight = ((containerRect.bottom - e.clientY) / containerRect.height) * 100;
      if (newHeight > 10 && newHeight < 80) {
        setResponseHeight(newHeight);
      }
    } else {
      const newWidth = ((containerRect.right - e.clientX) / containerRect.width) * 100;
      if (newWidth > 10 && newWidth < 80) {
        setResponseWidth(newWidth);
      }
    }
  }, [isResizing, layoutOrientation]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  if (!activeItem) {
    return <EmptyEditorState />;
  }

  return (
    <div ref={containerRef} className="flex-1 flex flex-col min-w-0 bg-[var(--bg-deep)] relative overflow-hidden">
      <div className="h-10 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center px-2 shrink-0 overflow-hidden">
        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
          {openTabs.map((tab) => {
            const isTabEnvironment = 'type' in tab && (tab as EnvironmentTab).type === 'environment-manager';
            const isTabCollection = !isTabEnvironment && 'requests' in tab;
            const isEditingThisTab = !isTabCollection && !isTabEnvironment && editingRequestTabId === tab.id;
            return (
              <div
                key={tab.id}
                draggable={isEditingThisTab ? false : undefined}
                onClick={() => !isEditingThisTab && setActiveTab(tab.id)}
                onDoubleClick={() => {
                  if (isTabCollection) {
                    setEditingCollectionTabId(tab.id);
                    setCollectionTabNameDraft(tab.name || '');
                  } else if (!isTabEnvironment) {
                    setActiveTab(tab.id);
                    setEditingRequestTabId(tab.id);
                    setRequestTabNameDraft(tab.name || '');
                  }
                }}
                className={cn(
                  "group h-8 min-w-[140px] max-w-[200px] flex items-center px-3 rounded-md transition-all cursor-pointer relative border shrink-0",
                  isEditingThisTab && "cursor-text",
                  activeTabId === tab.id
                    ? "bg-[var(--bg-elevated)] border-[var(--brand)]/20 text-[var(--brand)] shadow-lg shadow-black/20"
                    : "bg-transparent border-transparent text-[var(--text-dim)] hover:bg-[var(--bg-deep)] hover:text-[var(--text-muted)]"
                )}
              >
                {!isTabCollection && !isTabEnvironment ? (
                  <div className={cn(
                    "text-[8px] font-black mr-2 min-w-[32px]",
                    (tab as RequestData).method === 'GET' ? 'text-[var(--brand)]' :
                      (tab as RequestData).method === 'POST' ? 'text-yellow-500' :
                        (tab as RequestData).method === 'PUT' ? 'text-blue-500' :
                          (tab as RequestData).method === 'DELETE' ? 'text-red-500' : 'text-[var(--text-dim)]'
                  )}>
                    {(tab as RequestData).method}
                  </div>
                ) : isTabCollection ? (
                  <div className="text-[10px] mr-2 text-[var(--brand)]">
                    <Cloud size={10} />
                  </div>
                ) : (
                  <div className="text-[10px] mr-2 text-[var(--brand)]">
                    <RefreshCcw size={10} />
                  </div>
                )}
                {isTabCollection && editingCollectionTabId === tab.id ? (
                  <input
                    autoFocus
                    value={collectionTabNameDraft}
                    onChange={(e) => setCollectionTabNameDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => {
                      const targetCollection = collections.find(c => c.id === tab.id);
                      const trimmed = collectionTabNameDraft.trim();
                      if (targetCollection && trimmed && trimmed !== targetCollection.name) {
                        updateCollection(tab.id, { name: trimmed });
                      }
                      setEditingCollectionTabId(null);
                      setCollectionTabNameDraft('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const targetCollection = collections.find(c => c.id === tab.id);
                        const trimmed = collectionTabNameDraft.trim();
                        if (targetCollection && trimmed && trimmed !== targetCollection.name) {
                          updateCollection(tab.id, { name: trimmed });
                        }
                        setEditingCollectionTabId(null);
                        setCollectionTabNameDraft('');
                      }
                      if (e.key === 'Escape') {
                        setEditingCollectionTabId(null);
                        setCollectionTabNameDraft('');
                      }
                    }}
                    className="text-[10px] font-bold flex-1 uppercase tracking-tighter bg-[#0A0A0A] border border-[#3ECF8E]/30 rounded px-1 outline-none"
                  />
                ) : !isTabCollection && !isTabEnvironment && editingRequestTabId === tab.id ? (
                  <input
                    autoFocus
                    value={requestTabNameDraft}
                    onChange={(e) => {
                      setRequestTabNameDraft(e.target.value);
                      // Auto-size: sync width to content
                      const el = e.target as HTMLInputElement;
                      el.style.width = '0';
                      el.style.width = Math.min(Math.max(el.scrollWidth, 60), 140) + 'px';
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => handleSaveRequestTabName(tab.id, requestTabNameDraft)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleSaveRequestTabName(tab.id, requestTabNameDraft); }
                      if (e.key === 'Escape') { e.preventDefault(); setEditingRequestTabId(null); setRequestTabNameDraft(''); }
                    }}
                    style={{ width: Math.min(Math.max((requestTabNameDraft.length || 4) * 7, 60), 140) + 'px' }}
                    className="text-[10px] font-bold uppercase tracking-tighter bg-[#0A0A0A] border border-[#3ECF8E]/40 rounded px-1.5 outline-none text-[#3ECF8E] min-w-[60px] max-w-[140px] transition-[width] duration-75"
                  />
                ) : (
                  <>
                    <span className="text-[10px] font-bold truncate flex-1 uppercase tracking-tighter">
                      {tab.name || 'Untitled'}
                    </span>
                    {!isTabCollection && !isTabEnvironment && (
                      <button
                        title="Double-click or click to rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab(tab.id);
                          setEditingRequestTabId(tab.id);
                          setRequestTabNameDraft(tab.name || '');
                        }}
                        className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 text-current transition-opacity"
                      >
                        <Pencil size={9} />
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="ml-2 p-0.5 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
                {activeTabId === tab.id && (
                  <motion.div layoutId="active-tab-indicator" className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#3ECF8E]" />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2 border-l border-[var(--border-subtle)] pl-2">
          <button
            onClick={() => setLayoutOrientation('vertical')}
            className={cn(
              "p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-all",
              layoutOrientation === 'vertical' ? "text-[var(--brand)] bg-[var(--brand)]/10" : "text-[var(--text-dim)]"
            )}
            title="Vertical Layout"
          >
            <Layout size={14} />
          </button>
          <button
            onClick={() => setLayoutOrientation('horizontal')}
            className={cn(
              "p-1.5 rounded hover:bg-[var(--bg-elevated)] transition-all",
              layoutOrientation === 'horizontal' ? "text-[var(--brand)] bg-[var(--brand)]/10" : "text-[var(--text-dim)]"
            )}
            title="Horizontal Layout"
          >
            <Columns size={14} className="rotate-0" />
          </button>
        </div>
      </div>

      {isEnvironmentTab ? (
        <EnvironmentEditor tabId={activeTabId!} />
      ) : isCollection ? (
        <CollectionEditor collectionId={activeTabId!} />
      ) : (
        <div className={cn(
          "flex-1 flex min-h-0",
          layoutOrientation === 'vertical' ? "flex-col" : "flex-row"
        )}>
          <div
            className="overflow-y-auto custom-scrollbar flex-1 min-w-0"
            style={{ 
              height: layoutOrientation === 'vertical' ? `${100 - responseHeight}%` : '100%',
              width: layoutOrientation === 'horizontal' ? `${100 - responseWidth}%` : '100%'
            }}
          >
            <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">

              {/* URL & Send Module */}
              <div className="flex gap-2 p-1.5 bg-[#0F0F0F] border border-[#222222] rounded-xl shadow-2xl focus-within:border-[#3ECF8E]/30 transition-all">
                <div className="relative group min-w-[100px]">
                  <select
                    disabled={!canEdit}
                    value={activeRequest!.method}
                    onChange={(e) => updateRequest(activeRequest!.id, { method: e.target.value as any })}
                    className={cn(
                      "w-full bg-[#1A1A1A] text-[10px] font-black py-2 px-4 rounded-lg outline-none cursor-pointer appearance-none transition-all border border-[#222222] hover:border-[#333333] text-center",
                      activeRequest!.method === 'GET' && "text-[#3ECF8E] border-[#3ECF8E]/20 bg-[#3ECF8E]/5",
                      activeRequest!.method === 'POST' && "text-yellow-500 border-yellow-500/20 bg-yellow-500/5",
                      activeRequest!.method === 'PUT' && "text-blue-400 border-blue-400/20 bg-blue-400/5",
                      activeRequest!.method === 'PATCH' && "text-purple-400 border-purple-400/20 bg-purple-400/5",
                      activeRequest!.method === 'DELETE' && "text-red-400 border-red-400/20 bg-red-400/5",
                      !canEdit && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                    <option value="OPTIONS">OPTIONS</option>
                    <option value="HEAD">HEAD</option>
                  </select>
                  <ChevronDown size={10} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-current" />
                </div>
                <div className="flex-1 border-x border-[#1F1F1F] flex items-center px-4">
                  <VariableInput
                    disabled={!canEdit}
                    value={activeRequest!.url}
                    onChange={(val) => {
                      if (val.trim().toLowerCase().startsWith('curl ')) {
                        const parsed = parseCurl(val);
                        if (parsed) {
                          updateRequest(activeRequest!.id, {
                            url: parsed.url,
                            method: parsed.method,
                            headers: [...(activeRequest!.headers || []), ...parsed.headers],
                            params: [...(activeRequest!.params || []), ...parsed.params],
                            body: parsed.body,
                            bodyType: parsed.bodyType !== 'none' ? parsed.bodyType : activeRequest!.bodyType
                          });
                          addToast({ type: 'success', message: 'cURL parsed and applied' });
                          return;
                        }
                      }
                      updateRequest(activeRequest!.id, { url: val });
                    }}
                    placeholder="ENTER_REQUEST_URL_OR_PASTE_CURL..."
                    className={cn(
                      "w-full bg-transparent text-[13px] font-mono text-[#E0E0E0] outline-none placeholder:text-[#333333]",
                      !canEdit && "opacity-50 cursor-not-allowed"
                    )}
                  />
                </div>
                
                <AnimatePresence>
                  {showSaveButton && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={handleManualSave}
                      disabled={isSavingManual || !isPending}
                      className={cn(
                        "px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all",
                        isPending
                          ? "bg-[#3ECF8E]/10 border border-[#3ECF8E]/40 text-[#3ECF8E] hover:bg-[#3ECF8E]/20 hover:scale-[1.01] active:scale-[0.99] shadow-[0_0_15px_rgba(62,207,142,0.1)] cursor-pointer"
                          : "bg-[#1A1A1A] border border-[#222222] text-[#666666] cursor-not-allowed"
                      )}
                    >
                      {isSavingManual ? (
                        <RefreshCcw size={14} className="animate-spin text-[#3ECF8E]" />
                      ) : isPending ? (
                        <Save size={14} className="text-[#3ECF8E] animate-pulse" />
                      ) : (
                        <Check size={14} className="text-[#666666]" />
                      )}
                      {isSavingManual ? 'Saving' : isPending ? 'Save' : 'Saved'}
                    </motion.button>
                  )}
                </AnimatePresence>

                <button
                  onClick={handleSend}
                  disabled={isSending || !canExecute}
                  className={cn(
                    "px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg",
                    (isSending || !canExecute)
                      ? "bg-[#222222] text-[#444444] cursor-not-allowed"
                      : "bg-[#3ECF8E] hover:bg-[#34B37A] text-[#0A0A0A] shadow-[0_0_20px_rgba(62,207,142,0.15)] hover:shadow-[0_0_25px_rgba(62,207,142,0.3)] hover:scale-[1.01] active:scale-[0.99]"
                  )}
                >
                  {isSending ? <Zap size={13} className="animate-pulse" /> : <Play size={13} />}
                  {isSending ? 'Syncing' : 'Execute'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <div className={cn(
                      "flex items-center gap-1.5 px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest transition-all",
                      syncStatus === 'saving' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                        syncStatus === 'error' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                        syncStatus === 'pending' ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-500" :
                          "bg-[#3ECF8E]/10 border-[#3ECF8E]/20 text-[#3ECF8E]"
                    )}>
                      {syncStatus === 'saving' ? <RefreshCcw size={10} className="animate-spin" /> : 
                       syncStatus === 'pending' ? <Clock size={10} /> : <Cloud size={10} />}
                      {syncStatus === 'saving' ? 'Synchronizing' :
                        syncStatus === 'error' ? 'Sync Interrupted' :
                        syncStatus === 'pending' ? 'Changes Staged' :
                          syncStatus === 'saved' ? 'Sector Synced' : 'Sector Stored'}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 text-[8px] font-black uppercase tracking-widest">
                      <CloudOff size={10} />
                      Read-Only Stream
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-[9px] font-bold text-[#444444] uppercase tracking-widest">
                  <span>UUID: {activeRequest!.id.split('-')[0]}</span>
                  <div className="w-px h-3 bg-[#222222]" />
                  <span>Last Saved: {new Date(activeRequest!.updated_at || Date.now()).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Section Selector */}
              <div className="flex bg-[#0A0A0A] border border-[#1F1F1F] p-1 rounded-xl gap-1 shrink-0 overflow-x-auto no-scrollbar max-w-max">
                {(['Parameters', 'Authorization', 'Headers', 'Body', 'Scripts', 'Settings'] as const).map((section) => (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest relative transition-all duration-200 border",
                      activeSection === section 
                        ? "bg-[#1A1A1A] border-[#2A2A2A] text-[#3ECF8E] shadow-lg shadow-black/40" 
                        : "text-[#555555] hover:text-[#AAAAAA] hover:bg-white/5 border-transparent"
                    )}
                  >
                    {section}
                  </button>
                ))}
              </div>

              {/* Configuration Forms */}
              <div className={cn(
                "min-h-[300px] animate-in fade-in slide-in-from-bottom-2 duration-300",
                !canEdit && "opacity-60 grayscale-[0.5]"
              )}>
                {activeSection === 'Parameters' && (
                  <KVEditor
                    items={activeRequest!.params}
                    onChange={(params) => updateRequest(activeRequest!.id, { params })}
                    placeholderKey="QUERY_PARAM"
                  />
                )}

                {activeSection === 'Headers' && (
                  <KVEditor
                    items={activeRequest!.headers}
                    onChange={(headers) => updateRequest(activeRequest!.id, { headers })}
                    placeholderKey="HEADER_NAME"
                  />
                )}

                {activeSection === 'Body' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {[
                        'none', 
                        'json', 
                        'form-data', 
                        'urlencoded', 
                        'raw', 
                        'graphql', 
                        'xml', 
                        'binary'
                      ].map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            const newBody = RequestUtils.normalizeRequestBody(activeRequest!.body, type as BodyType);
                            updateRequest(activeRequest!.id, { 
                              bodyType: type as BodyType,
                              body: newBody
                            });
                          }}
                          className={cn(
                            "px-3 py-1 rounded border text-[8px] font-black uppercase tracking-widest transition-all",
                            activeRequest!.bodyType === type
                              ? "bg-[#3ECF8E]/20 text-[#3ECF8E] border-[#3ECF8E]/40"
                              : "border-[#222222] text-[#555555] hover:border-[#444444] hover:text-[#AAAAAA]"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    <div className="min-h-[300px]">
                      {activeRequest!.bodyType === 'none' && (
                        <div className="h-[300px] flex flex-col items-center justify-center border border-dashed border-[#222222] rounded-xl bg-[#0A0A0A]/50">
                          <CloudOff size={32} className="mb-3 opacity-10" />
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-20">No Transmission Payload</p>
                        </div>
                      )}

                      {(activeRequest!.bodyType === 'json' || activeRequest!.bodyType === 'raw' || activeRequest!.bodyType === 'xml') && (
                        <div className="border border-[#222222] rounded-xl bg-[#0F0F0F] overflow-hidden focus-within:border-[#3ECF8E]/30 transition-all">
                          <Editor
                            height="300px"
                            language={
                              activeRequest!.bodyType === 'json' ? 'json' : 
                              activeRequest!.bodyType === 'xml' ? 'xml' : 'text'
                            }
                            theme={theme === 'light' ? 'vs' : 'vs-dark'}
                            value={typeof activeRequest!.body === 'string' ? activeRequest!.body : (activeRequest!.body as RequestBody).content}
                            onChange={(val) => {
                              const body = typeof activeRequest!.body === 'string' 
                                ? RequestUtils.normalizeRequestBody(activeRequest!.body, activeRequest!.bodyType)
                                : activeRequest!.body as RequestBody;
                              
                              updateRequest(activeRequest!.id, { 
                                body: { ...body, content: val || '' } 
                              });
                            }}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 13,
                              fontFamily: 'JetBrains Mono',
                              lineNumbers: 'on',
                              scrollBeyondLastLine: false,
                              automaticLayout: true,
                              padding: { top: 16 }
                            }}
                          />
                        </div>
                      )}

                      {activeRequest!.bodyType === 'form-data' && (
                        <div className="space-y-4">
                          <KVEditor
                            items={(activeRequest!.body as RequestBody).formData || []}
                            isFormData={true}
                            onChange={(formData) => {
                              const body = activeRequest!.body as RequestBody;
                              updateRequest(activeRequest!.id, {
                                body: { ...body, formData: formData as any }
                              });
                            }}
                            placeholderKey="KEY"
                            placeholderValue="VALUE"
                          />
                        </div>
                      )}

                      {activeRequest!.bodyType === 'urlencoded' && (
                        <div className="space-y-4">
                          <KVEditor
                            items={(activeRequest!.body as RequestBody).urlencoded || []}
                            onChange={(urlencoded) => {
                              const body = activeRequest!.body as RequestBody;
                              updateRequest(activeRequest!.id, {
                                body: { ...body, urlencoded }
                              });
                            }}
                            placeholderKey="KEY"
                            placeholderValue="VALUE"
                          />
                        </div>
                      )}

                      {activeRequest!.bodyType === 'graphql' && (
                        <div className="grid grid-rows-2 gap-4 h-[500px]">
                          <div className="flex flex-col border border-[#222222] rounded-xl bg-[#0F0F0F] overflow-hidden">
                            <div className="px-4 py-2 border-b border-[#222222] bg-[#141414] text-[9px] font-black uppercase tracking-widest text-[#555555]">
                              GraphQL Query
                            </div>
                            <Editor
                              height="100%"
                              language="graphql"
                              theme={theme === 'light' ? 'vs' : 'vs-dark'}
                              value={(activeRequest!.body as RequestBody).graphql?.query || ''}
                              onChange={(val) => {
                                const body = activeRequest!.body as RequestBody;
                                updateRequest(activeRequest!.id, {
                                  body: { ...body, graphql: { ...body.graphql, query: val || '' } }
                                });
                              }}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                fontFamily: 'JetBrains Mono',
                                lineNumbers: 'on',
                                automaticLayout: true,
                              }}
                            />
                          </div>
                          <div className="flex flex-col border border-[#222222] rounded-xl bg-[#0F0F0F] overflow-hidden">
                            <div className="px-4 py-2 border-b border-[#222222] bg-[#141414] text-[9px] font-black uppercase tracking-widest text-[#555555]">
                              JSON Variables
                            </div>
                            <Editor
                              height="100%"
                              language="json"
                              theme={theme === 'light' ? 'vs' : 'vs-dark'}
                              value={(activeRequest!.body as RequestBody).graphql?.variables || ''}
                              onChange={(val) => {
                                const body = activeRequest!.body as RequestBody;
                                updateRequest(activeRequest!.id, {
                                  body: { ...body, graphql: { ...body.graphql, variables: val || '' } }
                                });
                              }}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                fontFamily: 'JetBrains Mono',
                                lineNumbers: 'on',
                                automaticLayout: true,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {activeRequest!.bodyType === 'binary' && (
                        <div className="h-[200px] flex flex-col items-center justify-center border border-dashed border-[#222222] rounded-xl bg-[#0A0A0A]/50">
                           <Save size={32} className="mb-3 opacity-10" />
                           <input 
                             type="file" 
                             className="hidden" 
                             id="binary-file-upload"
                             onChange={(e) => {
                               const file = e.target.files?.[0];
                               if (file) {
                                 const body = activeRequest!.body as RequestBody;
                                 updateRequest(activeRequest!.id, {
                                   body: { ...body, binary: { file, name: file.name } }
                                 });
                               }
                             }}
                           />
                           <label 
                             htmlFor="binary-file-upload"
                             className="px-6 py-2 bg-[#1A1A1A] border border-[#222222] rounded-lg text-[10px] font-black text-[#888888] hover:text-[#3ECF8E] hover:border-[#3ECF8E]/30 transition-all uppercase tracking-widest cursor-pointer"
                           >
                             {(activeRequest!.body as RequestBody).binary?.name || 'Select Binary Protocol File'}
                           </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSection === 'Authorization' && (
                  <AuthEditor
                    auth={activeRequest!.auth}
                    onChange={(auth) => updateRequest(activeRequest!.id, { auth })}
                  />
                )}

                {activeSection === 'Scripts' && (
                  <div className="space-y-6">
                    {/* Importer Panel Header */}
                    <div className="flex justify-between items-center bg-[#0D0D0D] border border-[#222222] p-4 rounded-xl relative">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Script Laboratory Integrator</span>
                        <span className="text-[8px] text-[#555555] font-mono">LINK CUSTOM LABORATORY SCRIPTS AND AUTOMATION PIPELINES</span>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setIsImportDropdownOpen(!isImportDropdownOpen)}
                          className="px-3.5 py-2 rounded-lg border border-[var(--brand)]/30 bg-[var(--brand)]/10 hover:bg-[var(--brand)]/20 text-[9px] font-black text-[var(--brand)] uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(62,207,142,0.05)] hover:shadow-[0_0_20px_rgba(62,207,142,0.15)]"
                        >
                          <Code2 size={12} />
                          Import from Script Laboratory
                        </button>

                        {isImportDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsImportDropdownOpen(false)} />
                            <div className="absolute right-0 top-9 w-72 bg-[#0A0A0A] border border-[#222222] rounded-xl shadow-2xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                              <div className="p-2 border-b border-[#222222] bg-[#0A0A0A]">
                                <input
                                  type="text"
                                  placeholder="Search scripts..."
                                  value={importSearchQuery}
                                  onChange={(e) => setImportSearchQuery(e.target.value)}
                                  className="w-full bg-[#141414] border border-[#222222] rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-[var(--brand)]/40 font-bold uppercase tracking-widest placeholder:text-[#555555]"
                                />
                              </div>
                              <div className="max-h-48 overflow-y-auto py-1">
                                {filteredLabScripts.length === 0 ? (
                                  <div className="px-4 py-3 text-[9px] font-bold text-[#555555] uppercase tracking-widest text-center">
                                    No scripts found
                                  </div>
                                ) : (
                                  filteredLabScripts.map((script) => (
                                    <button
                                      key={script.id}
                                      onClick={() => {
                                        const variableName = script.name
                                          .replace(/[^a-zA-Z0-9\s]/g, '')
                                          .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase())
                                          .replace(/\s+/g, '');
                                        const validVar = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(variableName) ? variableName : 'importedScript';
                                        
                                        // Auto-generated import structure with instantiation and invocation call
                                        const importStatement = `import ${validVar} from "${script.name}";\n${validVar}.Run();\n\n`;
                                        
                                        const current = activeRequest![activeScriptTarget] || '';
                                        updateRequest(activeRequest!.id, {
                                          [activeScriptTarget]: importStatement + current
                                        });
                                        
                                        addToast({
                                          type: 'success',
                                          message: `Imported '${script.name}' and added execution call!`
                                        });
                                        setIsImportDropdownOpen(false);
                                        setImportSearchQuery('');
                                      }}
                                      className="w-full px-4 py-2.5 hover:bg-[var(--brand)]/10 text-left transition-colors flex flex-col gap-0.5 group border-b border-[#111111] last:border-0"
                                    >
                                      <span className="text-[10px] font-black text-white group-hover:text-[var(--brand)] transition-colors uppercase tracking-widest truncate">
                                        {script.name}
                                      </span>
                                      <span className="text-[8px] text-[#555555] font-mono truncate max-w-full">
                                        {script.content.slice(0, 50).replace(/\n/g, ' ')}...
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Pre-Request Card */}
                      <div className={cn(
                        "flex flex-col bg-[#080808] border rounded-xl overflow-hidden transition-all duration-300",
                        activeScriptTarget === 'pre_request_script' 
                          ? "border-[var(--brand)]/40 shadow-[0_0_30px_rgba(62,207,142,0.03)]" 
                          : "border-[#1F1F1F] hover:border-[#333333]"
                      )}>
                        {/* Card Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-[#0D0D0D] border-b border-[#1F1F1F]">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full transition-all duration-300",
                              activeScriptTarget === 'pre_request_script' 
                                ? "bg-[var(--brand)] animate-pulse shadow-[0_0_10px_var(--brand)]" 
                                : "bg-[#444444]"
                            )} />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Pre-Request Protocol</span>
                            <span className="text-[8px] text-[#555555] font-mono bg-[#141414] px-1.5 py-0.5 rounded border border-[#222]">JS / GMY_API</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {/* Template Quick Injectors */}
                            <button
                              onClick={() => {
                                const template = `// HMAC SHA256 Signature Builder\nconst partnerId = gmy.request.headers.get("x-cb-partner-id") || "PARTNER_ID";\nconst timestamp = new Date().toISOString();\nconst payload = gmy.request.method === "GET" ? "" : gmy.request.body.raw;\n\nconst message = partnerId + timestamp + payload;\nconst secret = gmy.environment.get("hashing_key") || "SECRET_KEY";\n\nconst signature = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(message, secret));\ngmy.environment.set("signature", signature);\ngmy.environment.set("request_dt", timestamp);\n`;
                                const current = activeRequest!.pre_request_script || '';
                                updateRequest(activeRequest!.id, { pre_request_script: current + (current ? '\n' : '') + template });
                                addToast({ type: 'success', message: 'HMAC Template Injected' });
                              }}
                              className="px-2 py-0.5 rounded bg-[#111] hover:bg-[#222] border border-[#222] text-[8px] font-black text-white uppercase tracking-tighter transition-all"
                              title="HMAC Hashing Template"
                            >
                              + Signature
                            </button>
                            <button
                              onClick={() => {
                                const template = `// Asynchronous OAuth Token Fetcher\ngmy.sendRequest({\n  url: "https://api.example.com/oauth/token",\n  method: 'POST',\n  header: { 'Content-Type': 'application/x-www-form-urlencoded' },\n  body: {\n    mode: 'urlencoded',\n    urlencoded: [\n      { key: 'grant_type', value: 'client_credentials' },\n      { key: 'client_id', value: gmy.environment.get("client_id") },\n      { key: 'client_secret', value: gmy.environment.get("client_secret") }\n    ]\n  }\n}, function (err, res) {\n  if (!err && res.code === 200) {\n    gmy.environment.set("bearer_token", "Bearer " + res.json().access_token);\n    console.log("Bearer token resolved!");\n  }\n});\n`;
                                const current = activeRequest!.pre_request_script || '';
                                updateRequest(activeRequest!.id, { pre_request_script: current + (current ? '\n' : '') + template });
                                addToast({ type: 'success', message: 'OAuth Template Injected' });
                              }}
                              className="px-2 py-0.5 rounded bg-[#111] hover:bg-[#222] border border-[#222] text-[8px] font-black text-white uppercase tracking-tighter transition-all"
                              title="OAuth Flow Template"
                            >
                              + OAuth Flow
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Clear Pre-request protocol script?")) {
                                  updateRequest(activeRequest!.id, { pre_request_script: '' });
                                }
                              }}
                              className="p-1 text-[#555555] hover:text-[#FF4A4A] rounded hover:bg-[#1C1C1C] transition-all"
                              title="Clear Script"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Editor Wrapper */}
                        <div 
                          className="flex-1 min-h-[280px]"
                          onFocus={() => setActiveScriptTarget('pre_request_script')}
                        >
                          <Editor
                            height="280px"
                            language="javascript"
                            theme={theme === 'light' ? 'vs' : 'vs-dark'}
                            value={activeRequest!.pre_request_script || ''}
                            onChange={(val) => updateRequest(activeRequest!.id, { pre_request_script: val || '' })}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 11.5,
                              fontFamily: "'JetBrains Mono', monospace",
                              lineNumbers: 'on',
                              automaticLayout: true,
                              padding: { top: 12 },
                              smoothScrolling: true,
                              bracketPairColorization: { enabled: true }
                            }}
                          />
                        </div>
                      </div>

                      {/* Tests Card */}
                      <div className={cn(
                        "flex flex-col bg-[#080808] border rounded-xl overflow-hidden transition-all duration-300",
                        activeScriptTarget === 'test_script' 
                          ? "border-[var(--brand)]/40 shadow-[0_0_30px_rgba(62,207,142,0.03)]" 
                          : "border-[#1F1F1F] hover:border-[#333333]"
                      )}>
                        {/* Card Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-[#0D0D0D] border-b border-[#1F1F1F]">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-1.5 h-1.5 rounded-full transition-all duration-300",
                              activeScriptTarget === 'test_script' 
                                ? "bg-[var(--brand)] animate-pulse shadow-[0_0_10px_var(--brand)]" 
                                : "bg-[#444444]"
                            )} />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Post-Execution Validation (Tests)</span>
                            <span className="text-[8px] text-[#555555] font-mono bg-[#141414] px-1.5 py-0.5 rounded border border-[#222]">JS / ASSERTIONS</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {/* Template Quick Injectors */}
                            <button
                              onClick={() => {
                                const template = `gmy.test("Status code is 200 OK", function () {\n  gmy.expect(gmy.response.code).to.equal(200);\n});\n`;
                                const current = activeRequest!.test_script || '';
                                updateRequest(activeRequest!.id, { test_script: current + (current ? '\n' : '') + template });
                                addToast({ type: 'success', message: 'Status 200 Assertion Injected' });
                              }}
                              className="px-2 py-0.5 rounded bg-[#111] hover:bg-[#222] border border-[#222] text-[8px] font-black text-white uppercase tracking-tighter transition-all"
                              title="Assert Status 200"
                            >
                              + Status 200
                            </button>
                            <button
                              onClick={() => {
                                const template = `gmy.test("Response body parses to valid JSON status success", function () {\n  const data = gmy.response.json();\n  gmy.expect(data).to.be.an('object');\n  gmy.expect(data.status).to.equal('success');\n});\n`;
                                const current = activeRequest!.test_script || '';
                                updateRequest(activeRequest!.id, { test_script: current + (current ? '\n' : '') + template });
                                addToast({ type: 'success', message: 'JSON Validation Injected' });
                              }}
                              className="px-2 py-0.5 rounded bg-[#111] hover:bg-[#222] border border-[#222] text-[8px] font-black text-white uppercase tracking-tighter transition-all"
                              title="Assert JSON Schema"
                            >
                              + Schema Assert
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Clear post-execution tests script?")) {
                                  updateRequest(activeRequest!.id, { test_script: '' });
                                }
                              }}
                              className="p-1 text-[#555555] hover:text-[#FF4A4A] rounded hover:bg-[#1C1C1C] transition-all"
                              title="Clear Script"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Editor Wrapper */}
                        <div 
                          className="flex-1 min-h-[280px]"
                          onFocus={() => setActiveScriptTarget('test_script')}
                        >
                          <Editor
                            height="280px"
                            language="javascript"
                            theme={theme === 'light' ? 'vs' : 'vs-dark'}
                            value={activeRequest!.test_script || ''}
                            onChange={(val) => updateRequest(activeRequest!.id, { test_script: val || '' })}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 11.5,
                              fontFamily: "'JetBrains Mono', monospace",
                              lineNumbers: 'on',
                              automaticLayout: true,
                              padding: { top: 12 },
                              smoothScrolling: true,
                              bracketPairColorization: { enabled: true }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Resize Handle */}
          <div
            onMouseDown={startResizing}
            className={cn(
              "bg-[#1A1A1A] transition-all relative z-[60] flex items-center justify-center group/handle",
              layoutOrientation === 'vertical' ? "h-1.5 cursor-ns-resize" : "w-1.5 cursor-ew-resize",
              isResizing ? "bg-[#3ECF8E] shadow-[0_0_10px_rgba(62,207,142,0.3)]" : "hover:bg-[#3ECF8E]/50"
            )}
          >
            <div className={cn(
              "rounded-full bg-[#333333] group-hover/handle:bg-[#3ECF8E]/50 transition-colors",
              layoutOrientation === 'vertical' ? "w-12 h-1" : "h-12 w-1"
            )} />
            <div className={cn(
              "absolute",
              layoutOrientation === 'vertical' ? "inset-x-0 -top-2 -bottom-2" : "inset-y-0 -left-2 -right-2"
            )} />
          </div>

          <div
            style={{ 
              height: layoutOrientation === 'vertical' ? `${responseHeight}%` : '100%',
              width: layoutOrientation === 'horizontal' ? `${responseWidth}%` : '100%',
              minHeight: layoutOrientation === 'vertical' ? '150px' : 'auto',
              minWidth: layoutOrientation === 'horizontal' ? '300px' : 'auto'
            }}
            className="shrink-0 flex flex-col bg-[var(--bg-deep)] border-l border-[var(--border-subtle)]"
          >
            <ResponseViewer />
          </div>
        </div>
      )}
      {/* Removed ScriptLibraryModal */}
    </div>
  );
};

const EmptyEditorState = () => {
  const { activeWorkspaceId, profile, addToast } = useStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleConfirmRequest = async (name: string) => {
    if (!activeWorkspaceId || !profile?.id) return;
    await PersistenceService.createRequest({
      name,
      method: 'GET',
      url: 'https://api.example.com',
      workspace_id: activeWorkspaceId,
      user_id: profile.id,
      headers: [],
      params: [],
      body: '',
      bodyType: 'none',
      auth: { type: 'inherit' }
    });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[var(--bg-deep)]">
      <NameModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmRequest}
        title="Initialize New Mission"
        placeholder="REQUEST_NAME..."
      />
      <CollectionImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        workspaceId={activeWorkspaceId}
        userId={profile?.id}
        addToast={addToast}
      />
      <div className="w-24 h-24 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mb-8 shadow-[0_0_50px_var(--brand-muted)]">
        <Zap size={40} className="text-[var(--brand)] opacity-20" />
      </div>
      <h2 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-[0.3em] mb-2">Omni-Station Standby</h2>
      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest max-w-xs text-center leading-relaxed opacity-50">
        Select a protocol from the explorer or initialize a new transmission to begin sector operations.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-3">
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg text-[10px] font-black text-[var(--text-muted)] hover:text-[var(--brand)] hover:border-[var(--brand)]/30 transition-all uppercase tracking-widest"
        >
          New Request
        </button>
        <button
          onClick={() => setIsImportOpen(true)}
          className="px-6 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg text-[10px] font-black text-[var(--text-muted)] hover:text-[var(--brand)] hover:border-[var(--brand)]/30 transition-all uppercase tracking-widest"
        >
          Import Collection
        </button>
      </div>
    </div>
  );
};

import React, { useMemo } from 'react';
import {
  Search, ChevronDown, ChevronRight, Folder, FolderOpen,
  Database, Shield
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Collection, RequestData } from '../../types';

interface RequestTreePanelProps {
  collections: Collection[];
  selectedRequestIds: string[];
  isRunning: boolean;
  searchQuery: string;
  expandedNodes: Record<string, boolean>;
  onSearchChange: (query: string) => void;
  onToggleRequest: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onToggleFolder: (folder: any) => void;
  onToggleCollection: (col: Collection) => void;
  onToggleNode: (id: string) => void;
}

const getAllRequests = (node: any): RequestData[] => {
  const list: RequestData[] = [];
  const recurse = (item: any) => {
    if (item.requests) {
      item.requests.forEach((r: RequestData) => list.push(r));
    }
    if (item.folders) {
      item.folders.forEach((f: any) => recurse(f));
    }
  };
  recurse(node);
  return list;
};

const RequestNode: React.FC<{
  req: RequestData;
  isChecked: boolean;
  isRunning: boolean;
  paddingLeft: string;
  onToggle: (id: string) => void;
}> = ({ req, isChecked, isRunning, paddingLeft, onToggle }) => (
  <div
    className={cn(
      "flex items-center justify-between py-1 px-2 rounded-lg border border-transparent hover:border-white/[0.03] transition-all cursor-pointer select-none",
      isChecked ? "bg-[#3ECF8E]/[0.01]" : "hover:bg-white/[0.01]"
    )}
    style={{ paddingLeft }}
    onClick={() => onToggle(req.id)}
  >
    <div className="flex items-center gap-2 min-w-0">
      <span className={cn(
        "text-[6px] font-bold px-1 rounded font-mono uppercase tracking-tight shrink-0",
        req.method === 'GET' ? "bg-green-500/10 text-green-400 border border-green-500/10" :
        req.method === 'POST' ? "bg-blue-500/10 text-blue-400 border border-blue-500/10" :
        "bg-yellow-500/10 text-yellow-400 border border-yellow-500/10"
      )}>{req.method}</span>
      <span className="text-[10px] font-mono text-[#888] truncate group-hover:text-white">{req.name}</span>
    </div>
    <input
      type="checkbox"
      checked={isChecked}
      disabled={isRunning}
      onChange={() => onToggle(req.id)}
      onClick={(e) => e.stopPropagation()}
      className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
    />
  </div>
);

const RenderFolderNode: React.FC<{
  folder: any;
  depth: number;
  expandedNodes: Record<string, boolean>;
  selectedRequestIds: string[];
  isRunning: boolean;
  onToggleNode: (id: string) => void;
  onToggleRequest: (id: string) => void;
  onToggleFolder: (folder: any) => void;
}> = ({ folder, depth, expandedNodes, selectedRequestIds, isRunning, onToggleNode, onToggleRequest, onToggleFolder }) => {
  const folderReqs = getAllRequests(folder);
  const reqIds = folderReqs.map(r => r.id);
  if (reqIds.length === 0) return null;

  const isExpanded = !!expandedNodes[folder.id];
  const isAllChecked = reqIds.every(id => selectedRequestIds.includes(id));
  const isSomeChecked = reqIds.some(id => selectedRequestIds.includes(id)) && !isAllChecked;

  return (
    <div className="space-y-1 select-none">
      <div
        className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/[0.02] cursor-pointer group"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onToggleNode(folder.id)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[#555] hover:text-[#888] p-0.5">
            {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </span>
          {isExpanded ? (
            <FolderOpen size={11} className="text-[#3ECF8E]/80" />
          ) : (
            <Folder size={11} className="text-[#55555C]" />
          )}
          <span className="text-[10px] font-mono text-[#AAAAAF] truncate uppercase tracking-wider font-bold">
            {folder.name}
          </span>
        </div>
        <input
          type="checkbox"
          checked={isAllChecked}
          disabled={isRunning}
          ref={el => { if (el) el.indeterminate = isSomeChecked; }}
          onChange={(e) => { e.stopPropagation(); onToggleFolder(folder); }}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
        />
      </div>
      {isExpanded && (
        <div className="space-y-1">
          {folder.folders?.map((subFolder: any) => (
            <RenderFolderNode
              key={subFolder.id}
              folder={subFolder}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              selectedRequestIds={selectedRequestIds}
              isRunning={isRunning}
              onToggleNode={onToggleNode}
              onToggleRequest={onToggleRequest}
              onToggleFolder={onToggleFolder}
            />
          ))}
          {folder.requests?.map((req: RequestData) => (
            <RequestNode
              key={req.id}
              req={req}
              isChecked={selectedRequestIds.includes(req.id)}
              isRunning={isRunning}
              paddingLeft={`${(depth + 1) * 12 + 24}px`}
              onToggle={onToggleRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const RenderCollectionNode: React.FC<{
  collection: Collection;
  expandedNodes: Record<string, boolean>;
  selectedRequestIds: string[];
  isRunning: boolean;
  onToggleNode: (id: string) => void;
  onToggleRequest: (id: string) => void;
  onToggleFolder: (folder: any) => void;
  onToggleCollection: (col: Collection) => void;
}> = ({ collection, expandedNodes, selectedRequestIds, isRunning, onToggleNode, onToggleRequest, onToggleFolder, onToggleCollection }) => {
  const colReqs = getAllRequests(collection);
  if (colReqs.length === 0) return null;

  const isExpanded = !!expandedNodes[collection.id];
  const isAllChecked = colReqs.every(r => selectedRequestIds.includes(r.id));
  const isSomeChecked = colReqs.some(r => selectedRequestIds.includes(r.id)) && !isAllChecked;

  return (
    <div className="space-y-1 border-b border-[#151518]/30 pb-2 last:border-0">
      <div
        className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-[#09090B]/60 border border-[#151518] hover:border-[#222] cursor-pointer group"
        onClick={() => onToggleNode(collection.id)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[#555] hover:text-[#888] p-0.5">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <Database size={12} className="text-[#3ECF8E]" />
          <span className="text-[10px] font-mono text-[#E0E0E6] truncate uppercase tracking-widest font-black">
            {collection.name}
          </span>
        </div>
        <input
          type="checkbox"
          checked={isAllChecked}
          disabled={isRunning}
          ref={el => { if (el) el.indeterminate = isSomeChecked; }}
          onChange={(e) => { e.stopPropagation(); onToggleCollection(collection); }}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
        />
      </div>
      {isExpanded && (
        <div className="space-y-1 pl-2 border-l border-[#151518] ml-4 mt-1.5">
          {collection.requests?.filter(r => !r.folder_id).map((req: RequestData) => (
            <RequestNode
              key={req.id}
              req={req}
              isChecked={selectedRequestIds.includes(req.id)}
              isRunning={isRunning}
              paddingLeft="24px"
              onToggle={onToggleRequest}
            />
          ))}
          {collection.folders?.map((folder: any) => (
            <RenderFolderNode
              key={folder.id}
              folder={folder}
              depth={0}
              expandedNodes={expandedNodes}
              selectedRequestIds={selectedRequestIds}
              isRunning={isRunning}
              onToggleNode={onToggleNode}
              onToggleRequest={onToggleRequest}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const RequestTreePanel: React.FC<RequestTreePanelProps> = ({
  collections,
  selectedRequestIds,
  isRunning,
  searchQuery,
  expandedNodes,
  onSearchChange,
  onToggleRequest,
  onSelectAll,
  onClearAll,
  onToggleFolder,
  onToggleCollection,
  onToggleNode,
}) => {
  const flatRequestsList = useMemo(() => {
    const list: { request: RequestData; collectionName: string }[] = [];
    collections.forEach(col => {
      const colReqs = getAllRequests(col);
      colReqs.forEach(req => {
        list.push({ request: req, collectionName: col.name });
      });
    });
    return list;
  }, [collections]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery) return flatRequestsList;
    const query = searchQuery.toLowerCase();
    return flatRequestsList.filter(item =>
      item.request.name.toLowerCase().includes(query) ||
      item.request.url.toLowerCase().includes(query) ||
      item.request.method.toLowerCase().includes(query)
    );
  }, [flatRequestsList, searchQuery]);

  return (
    <div className="w-[300px] border-r border-[#151518] bg-[#08080A] flex flex-col relative">
      {isRunning && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-30 flex flex-col items-center justify-center p-4 text-center select-none">
          <Shield className="text-[#555] mb-2 animate-pulse" size={16} />
          <span className="text-[9px] font-mono font-black text-[#888] uppercase tracking-[0.2em]">Checklist Locked</span>
          <span className="text-[8px] font-mono text-[#444] mt-1">Cannot alter configurations during active deployment run.</span>
        </div>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-black text-[#555] uppercase tracking-wider font-mono">Scenarios Checklist</label>
          <span className="text-[9px] font-bold font-mono text-[#3ECF8E]">{selectedRequestIds.length} SELECTED</span>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
          <input
            type="text"
            placeholder="Search targets..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#050507] border border-[#151518] pl-8 pr-3 py-1.5 rounded-lg text-[10px] font-mono text-white outline-none focus:border-[#3ECF8E]/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={onSelectAll}
            disabled={isRunning}
            className="py-1 rounded bg-[#3ECF8E]/10 border border-[#3ECF8E]/25 text-[#3ECF8E] hover:bg-[#3ECF8E]/20 text-[9px] font-black text-center cursor-pointer font-mono"
          >
            SELECT ALL
          </button>
          <button
            onClick={onClearAll}
            disabled={isRunning}
            className="py-1 rounded bg-[#1C1C22]/30 border border-[#222226] text-[#888] hover:bg-[#1C1C22]/50 text-[9px] font-black text-center cursor-pointer font-mono"
          >
            CLEAR
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 no-scrollbar border-t border-[#151518]/50 pt-3">
        {searchQuery ? (
          filteredRequests.map(item => {
            const isChecked = selectedRequestIds.includes(item.request.id);
            return (
              <div
                key={item.request.id}
                className={cn(
                  "flex items-center justify-between py-1.5 px-2 rounded-xl border border-[#151518] bg-[#09090B]/40 hover:border-[#222] transition-all cursor-pointer select-none",
                  isChecked && "bg-[#3ECF8E]/[0.01]"
                )}
                onClick={() => onToggleRequest(item.request.id)}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-[6px] font-bold px-1 rounded font-mono uppercase tracking-tight shrink-0",
                      item.request.method === 'GET' ? "bg-green-500/10 text-green-400 border border-green-500/10" :
                      item.request.method === 'POST' ? "bg-blue-500/10 text-blue-400 border border-blue-500/10" :
                      "bg-yellow-500/10 text-yellow-400 border border-yellow-500/10"
                    )}>{item.request.method}</span>
                    <span className="text-[10px] font-mono text-[#E0E0E6] truncate">{item.request.name}</span>
                  </div>
                  <div className="text-[8px] text-[#55555C] font-mono truncate">{item.collectionName} &bull; {item.request.url}</div>
                </div>
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isRunning}
                  onChange={() => onToggleRequest(item.request.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border-[#222226] bg-[#0A0A0F] text-[#3ECF8E] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer ml-2"
                />
              </div>
            );
          })
        ) : (
          collections.map(col => (
            <RenderCollectionNode
              key={col.id}
              collection={col}
              expandedNodes={expandedNodes}
              selectedRequestIds={selectedRequestIds}
              isRunning={isRunning}
              onToggleNode={onToggleNode}
              onToggleRequest={onToggleRequest}
              onToggleFolder={onToggleFolder}
              onToggleCollection={onToggleCollection}
            />
          ))
        )}
        {((searchQuery && filteredRequests.length === 0) || (!searchQuery && collections.length === 0)) && (
          <div className="text-center py-16 text-[#444] italic font-mono text-[10px]">No scenarios target match</div>
        )}
      </div>
    </div>
  );
};

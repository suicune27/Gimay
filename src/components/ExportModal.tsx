import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileJson, 
  Check, 
  Download, 
  Filter,
  CheckCircle2,
  Terminal,
  FileCode,
  Package,
  Globe
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { Collection } from '../types';
import { CollectionExportService, ExportFormat } from '../services/CollectionExportService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedIds?: string[];
}

const FORMAT_OPTIONS: Array<{
  id: ExportFormat;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
}> = [
  {
    id: ExportFormat.POSTMAN,
    title: 'Postman',
    subtitle: 'Apidog / Thunder Compatible',
    icon: Package,
    color: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  },
  {
    id: ExportFormat.INSOMNIA,
    title: 'Insomnia',
    subtitle: 'v4 Resources',
    icon: Globe,
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
  },
  {
    id: ExportFormat.HOPPSCOTCH,
    title: 'Hoppscotch',
    subtitle: 'JSON Export',
    icon: CheckCircle2,
    color: 'text-green-500 bg-green-500/10 border-green-500/30',
  },
  {
    id: ExportFormat.BRUNO,
    title: 'Bruno',
    subtitle: 'Collection JSON',
    icon: FileCode,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  },
  {
    id: ExportFormat.JSON,
    title: 'Raw JSON',
    subtitle: 'Internal Schema',
    icon: FileJson,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  },
  {
    id: ExportFormat.JMETER,
    title: 'JMeter (.jmx)',
    subtitle: 'Performance Test Plan',
    icon: FileCode,
    color: 'text-red-500 bg-red-500/10 border-red-500/30',
  },
  {
    id: ExportFormat.CURL_BUNDLE,
    title: 'cURL Bundle',
    subtitle: 'Bash Script',
    icon: Terminal,
    color: 'text-slate-400 bg-slate-400/10 border-slate-400/30',
  },
];

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, initialSelectedIds = [] }) => {
  const { collections, addToast } = useStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
  const [searchQuery, setSearchQuery] = useState('');
  const [format, setFormat] = useState<ExportFormat>(ExportFormat.POSTMAN);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Initialize selected IDs if initialSelectedIds changes
  useEffect(() => {
    if (initialSelectedIds.length > 0) {
      setSelectedIds(new Set(initialSelectedIds));
    }
  }, [initialSelectedIds, isOpen]);

  const toggleExpand = (id: string) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const getAllNodeIds = (node: any): string[] => {
    let ids = [node.id];
    if (node.folders) {
      node.folders.forEach((f: any) => ids = [...ids, ...getAllNodeIds(f)]);
    }
    if (node.requests) {
      node.requests.forEach((r: any) => ids.push(r.id));
    }
    return ids;
  };

  const toggleNodeSelection = (node: any, checked: boolean) => {
    const nodeIds = getAllNodeIds(node);
    const next = new Set(selectedIds);
    if (checked) {
      nodeIds.forEach(id => next.add(id));
    } else {
      nodeIds.forEach(id => next.delete(id));
    }
    setSelectedIds(next);
  };

  const isNodeSelected = (node: any): boolean | 'indeterminate' => {
    const nodeIds = getAllNodeIds(node);
    const selectedCount = nodeIds.filter(id => selectedIds.has(id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === nodeIds.length) return true;
    return 'indeterminate';
  };

  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    
    const query = searchQuery.toLowerCase();
    
    const filterTree = (node: any): any | null => {
      const matchName = node.name.toLowerCase().includes(query);
      
      const filteredFolders = (node.folders || [])
        .map(filterTree)
        .filter(Boolean);
        
      const filteredRequests = (node.requests || [])
        .filter((r: any) => r.name.toLowerCase().includes(query) || matchName);

      if (matchName || filteredFolders.length > 0 || filteredRequests.length > 0) {
        return {
          ...node,
          folders: filteredFolders,
          requests: filteredRequests
        };
      }
      return null;
    };

    return collections.map(filterTree).filter(Boolean) as Collection[];
  }, [collections, searchQuery]);

  const handleSelectAll = () => {
    const next = new Set<string>();
    collections.forEach(c => getAllNodeIds(c).forEach(id => next.add(id)));
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) return;
    setIsExporting(true);
    
    try {
      // For now, we export each selected collection that has at least one selected item
      // In a real implementation, we would prune the collections based on selectedIds
      const collectionsToExport = collections.filter(c => {
        const nodeIds = getAllNodeIds(c);
        return nodeIds.some(id => selectedIds.has(id));
      });

      for (const col of collectionsToExport) {
        const pruned = CollectionExportService.pruneCollection(col, selectedIds);
        if (pruned) {
          if (format === ExportFormat.CURL_BUNDLE) {
            CollectionExportService.exportCurlBundle(pruned);
          } else {
            CollectionExportService.exportCollection(pruned, format);
          }
        }
      }
      
      addToast({ type: 'success', message: `Successfully exported ${collectionsToExport.length} collections.` });
      onClose();
    } catch (error) {
      addToast({ type: 'error', message: 'Export failed.' });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative w-full max-w-4xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl flex flex-col h-[85vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)]">
          <div>
            <h2 className="text-[13px] font-black text-[var(--text-main)] uppercase tracking-widest">Export Selection</h2>
            <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-tighter mt-1">
              Select items and format for backup or transfer
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--text-dim)] hover:text-[var(--text-main)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Side: Tree Selection */}
          <div className="flex-1 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-deep)]/30">
            <div className="p-4 border-b border-[var(--border-subtle)] space-y-3">
              <div className="relative group">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] group-focus-within:text-[var(--brand)] transition-colors" />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="SEARCH_ITEMS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg py-2 pl-10 pr-3 text-[11px] font-mono text-[var(--text-main)] outline-none focus:border-[var(--brand)]/50 transition-all"
                />
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                  {selectedIds.size} Items Selected
                </span>
                <div className="flex gap-3">
                  <button onClick={handleSelectAll} className="text-[9px] font-black text-[var(--brand)] uppercase hover:opacity-80">Select All</button>
                  <button onClick={handleClearSelection} className="text-[9px] font-black text-red-400 uppercase hover:opacity-80">Clear</button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {filteredCollections.map(col => (
                <TreeNode 
                  key={col.id}
                  node={col}
                  level={0}
                  selectedIds={selectedIds}
                  toggleNodeSelection={toggleNodeSelection}
                  isNodeSelected={isNodeSelected}
                  toggleExpand={toggleExpand}
                  expandedFolders={expandedFolders}
                />
              ))}
              {filteredCollections.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                  <Filter size={48} className="mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">No Matches Found</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Export Options */}
          <div className="w-[300px] flex flex-col bg-[var(--bg-elevated)]/50">
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Export Format</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {FORMAT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFormat(opt.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-all relative group overflow-hidden",
                    format === opt.id
                      ? opt.color
                      : "bg-[var(--bg-deep)] border-[var(--border-subtle)] hover:border-[var(--text-dim)]/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      format === opt.id ? "bg-white/10" : "bg-[var(--bg-elevated)]"
                    )}>
                      <opt.icon size={16} />
                    </div>
                    <div>
                      <div className={cn(
                        "text-[11px] font-black uppercase tracking-wide",
                        format === opt.id ? "" : "text-[var(--text-main)]"
                      )}>
                        {opt.title}
                      </div>
                      <div className={cn(
                        "text-[9px] uppercase tracking-tighter opacity-60",
                        format === opt.id ? "" : "text-[var(--text-dim)]"
                      )}>
                        {opt.subtitle}
                      </div>
                    </div>
                    {format === opt.id && (
                      <div className="ml-auto">
                        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                          <Check size={12} />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-deep)]/50 space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] uppercase tracking-tighter text-[var(--text-dim)]">
                  <span>Collections:</span>
                  <span className="font-bold text-[var(--text-main)]">
                    {collections.filter(c => selectedIds.has(c.id)).length}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] uppercase tracking-tighter text-[var(--text-dim)]">
                  <span>Selected Units:</span>
                  <span className="font-bold text-[var(--text-main)]">{selectedIds.size}</span>
                </div>
                <div className="flex justify-between text-[10px] uppercase tracking-tighter text-[var(--text-dim)]">
                  <span>Output Type:</span>
                  <span className="font-bold text-[var(--brand)]">{format.toUpperCase()}</span>
                </div>
              </div>

              <button
                onClick={handleExport}
                disabled={selectedIds.size === 0 || isExporting}
                className="w-full h-10 bg-[var(--brand)] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg flex items-center justify-center gap-2 text-[11px] font-black text-[var(--bg-deep)] uppercase tracking-widest transition-all shadow-lg active:scale-95"
              >
                {isExporting ? (
                  <>Exporting...</>
                ) : (
                  <>
                    <Download size={14} strokeWidth={3} />
                    Export Selected
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const TreeNode: React.FC<{
  node: any;
  level: number;
  selectedIds: Set<string>;
  toggleNodeSelection: (node: any, checked: boolean) => void;
  isNodeSelected: (node: any) => boolean | 'indeterminate';
  toggleExpand: (id: string) => void;
  expandedFolders: Set<string>;
}> = ({ node, level, selectedIds, toggleNodeSelection, isNodeSelected, toggleExpand, expandedFolders }) => {
  const isSelected = isNodeSelected(node);
  const isOpen = expandedFolders.has(node.id);
  const hasChildren = (node.folders?.length > 0 || node.requests?.length > 0);
  const isRequest = !node.folders && node.method;

  return (
    <div className="space-y-0.5">
      <div 
        className={cn(
          "flex items-center gap-2 py-1 px-2 rounded-md hover:bg-white/5 transition-colors group cursor-pointer",
          isSelected === true ? "bg-white/5" : ""
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (hasChildren) toggleExpand(node.id);
          else toggleNodeSelection(node, isSelected !== true);
        }}
      >
        <div 
          onClick={(e) => {
            e.stopPropagation();
            toggleNodeSelection(node, isSelected !== true);
          }}
          className={cn(
            "w-4 h-4 rounded border flex items-center justify-center transition-all",
            isSelected === true ? "bg-[var(--brand)] border-[var(--brand)]" : 
            isSelected === 'indeterminate' ? "bg-[var(--brand)]/30 border-[var(--brand)]/50" :
            "border-[var(--border-subtle)] bg-[var(--bg-deep)] group-hover:border-[var(--brand)]/50"
          )}
        >
          {isSelected === true && <Check size={10} className="text-[var(--bg-deep)]" />}
          {isSelected === 'indeterminate' && <div className="w-2 h-0.5 bg-[var(--brand)]" />}
        </div>

        {hasChildren ? (
          isOpen ? <ChevronDown size={14} className="text-[var(--text-dim)]" /> : <ChevronRight size={14} className="text-[var(--text-dim)]" />
        ) : (
          <div className="w-3.5" />
        )}

        {isRequest ? (
          <div className={cn(
            "text-[8px] font-black w-7 text-center shrink-0",
            node.method === 'GET' ? 'text-[var(--brand)]' : 
            node.method === 'POST' ? 'text-yellow-500' :
            node.method === 'PUT' ? 'text-blue-500' :
            node.method === 'DELETE' ? 'text-red-500' : 'text-[var(--text-dim)]'
          )}>
            {node.method}
          </div>
        ) : (
          <Folder size={12} className={cn(isSelected ? "text-[var(--brand)]" : "text-[var(--text-dim)]")} />
        )}

        <span className={cn(
          "text-[11px] truncate flex-1",
          isSelected ? "text-[var(--text-main)] font-bold" : "text-[var(--text-muted)]"
        )}>
          {node.name}
        </span>
      </div>

      {isOpen && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          {node.folders?.map((f: any) => (
            <TreeNode 
              key={f.id}
              node={f}
              level={level + 1}
              selectedIds={selectedIds}
              toggleNodeSelection={toggleNodeSelection}
              isNodeSelected={isNodeSelected}
              toggleExpand={toggleExpand}
              expandedFolders={expandedFolders}
            />
          ))}
          {node.requests?.map((r: any) => (
            <TreeNode 
              key={r.id}
              node={r}
              level={level + 1}
              selectedIds={selectedIds}
              toggleNodeSelection={toggleNodeSelection}
              isNodeSelected={isNodeSelected}
              toggleExpand={toggleExpand}
              expandedFolders={expandedFolders}
            />
          ))}
        </div>
      )}
    </div>
  );
};

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  ClipboardPaste, 
  FileJson, 
  X, 
  AlertTriangle, 
  Folder, 
  ChevronDown, 
  ChevronRight,
  Sparkles,
  Check,
  CircleDot
} from 'lucide-react';
import { cn } from '../lib/utils';
import { CollectionImportService, ImportFormat, ImportPreview, ImportNode } from '../services/CollectionImportService';

interface CollectionImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId?: string | null;
  userId?: string | null;
  onImported?: () => Promise<void> | void;
  addToast?: (toast: { type: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
}

type SourceOption = 'auto' | ImportFormat;

const SOURCE_CARDS: Array<{
  id: SourceOption;
  title: string;
  subtitle: string;
  mark: string;
  brandColor: string;
  bgGlow: string;
  borderColor: string;
  markClass: string;
  features: string;
}> = [
  {
    id: 'postman',
    title: 'Postman',
    subtitle: 'Collection v2+',
    mark: 'PM',
    brandColor: '#FF6C37',
    bgGlow: 'hover:shadow-[0_0_25px_rgba(255,108,55,0.06)] hover:bg-[#FF6C37]/5',
    borderColor: 'peer-checked:border-[#FF6C37]/50 active:border-[#FF6C37]/50',
    markClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    features: 'Folders, variables, pre-test scripts',
  },
  {
    id: 'apidog',
    title: 'API Dog',
    subtitle: 'Project JSON',
    mark: 'AD',
    brandColor: '#00B4D8',
    bgGlow: 'hover:shadow-[0_0_25px_rgba(0,180,216,0.06)] hover:bg-[#00B4D8]/5',
    borderColor: 'peer-checked:border-[#00B4D8]/50 active:border-[#00B4D8]/50',
    markClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    features: 'Folders, headers, query parameters',
  },
  {
    id: 'insomnia',
    title: 'Insomnia',
    subtitle: 'Resources',
    mark: 'IN',
    brandColor: '#5856D6',
    bgGlow: 'hover:shadow-[0_0_25px_rgba(88,86,214,0.06)] hover:bg-[#5856D6]/5',
    borderColor: 'peer-checked:border-[#5856D6]/50 active:border-[#5856D6]/50',
    markClass: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
    features: 'Groups, environment values',
  },
  {
    id: 'auto',
    title: 'Auto Detect',
    subtitle: 'Recommended',
    mark: 'AUTO',
    brandColor: '#3ECF8E',
    bgGlow: 'hover:shadow-[0_0_25px_rgba(62,207,142,0.08)] hover:bg-[#3ECF8E]/5',
    borderColor: 'peer-checked:border-[#3ECF8E]/50 active:border-[#3ECF8E]/50',
    markClass: 'bg-[#3ECF8E]/10 text-[#3ECF8E] border-[#3ECF8E]/20',
    features: 'Auto-detect Postman / API Dog / Insomnia',
  },
];

export const CollectionImportModal: React.FC<CollectionImportModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  userId,
  onImported,
  addToast,
}) => {
  const [source, setSource] = useState<SourceOption>('auto');
  const [raw, setRaw] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tree selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const canImport = !!workspaceId && !!userId && !!preview && selectedNodeIds.size > 0 && !isImporting;

  const selectedCard = useMemo(
    () => SOURCE_CARDS.find((card) => card.id === source) || SOURCE_CARDS[SOURCE_CARDS.length - 1],
    [source]
  );

  const resetState = () => {
    setRaw('');
    setPreview(null);
    setError(null);
    setIsPreviewing(false);
    setIsImporting(false);
    setSource('auto');
    setIsDragging(false);
    setSelectedNodeIds(new Set());
    setExpandedNodes({});
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Debounced auto-preview compiler
  useEffect(() => {
    if (!raw.trim()) {
      setPreview(null);
      setError(null);
      setSelectedNodeIds(new Set());
      return;
    }

    setIsPreviewing(true);
    const timer = setTimeout(() => {
      try {
        const p = CollectionImportService.previewImport(raw, source);
        setPreview(p);
        setError(null);

        // Populate tree checkbox state automatically
        const allIds: string[] = [];
        const collectIds = (nodes: ImportNode[]) => {
          nodes.forEach((n) => {
            if (n.id) allIds.push(n.id);
            if (n.type === 'folder') collectIds(n.children);
          });
        };
        collectIds(p.normalized.items);
        setSelectedNodeIds(new Set(allIds));
      } catch (e: any) {
        setPreview(null);
        setError(e?.message || 'Invalid export syntax or unsupported document format.');
      } finally {
        setIsPreviewing(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [raw, source]);

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      setRaw(text);
      setError(null);
    } catch {
      setError('Could not process the uploaded file. Ensure it is a valid text or JSON document.');
    }
  };

  const handleToggleNode = (node: ImportNode, isChecked: boolean) => {
    if (!preview) return;
    const nextSelected = new Set(selectedNodeIds);

    // 1. Cascade downwards
    const toggleDown = (n: ImportNode, checked: boolean) => {
      if (n.id) {
        if (checked) nextSelected.add(n.id);
        else nextSelected.delete(n.id);
      }
      if (n.type === 'folder') {
        n.children.forEach((child) => toggleDown(child, checked));
      }
    };
    toggleDown(node, isChecked);

    // 2. Resolve parents recursively upward
    const buildParentMap = () => {
      const parentMap = new Map<string, ImportNode>();
      const traverse = (n: ImportNode, parent?: ImportNode) => {
        if (n.id && parent) parentMap.set(n.id, parent);
        if (n.type === 'folder') {
          n.children.forEach((c) => traverse(c, n));
        }
      };
      preview.normalized.items.forEach((item) => traverse(item));
      return parentMap;
    };

    const parentMap = buildParentMap();

    if (isChecked) {
      // Checked leaves must hydrate parents
      let curr = node.id ? parentMap.get(node.id) : null;
      while (curr) {
        if (curr.id) nextSelected.add(curr.id);
        curr = curr.id ? parentMap.get(curr.id) : null;
      }
    } else {
      // Uncheck parent if all children are unchecked
      let curr = node.id ? parentMap.get(node.id) : null;
      while (curr) {
        if (curr.type === 'folder') {
          const hasSelectedChildren = curr.children.some((c) => c.id && nextSelected.has(c.id));
          if (!hasSelectedChildren && curr.id) {
            nextSelected.delete(curr.id);
          }
        }
        curr = curr.id ? parentMap.get(curr.id) : null;
      }
    }

    setSelectedNodeIds(nextSelected);
  };

  const handleSelectAll = () => {
    if (!preview) return;
    const allIds: string[] = [];
    const collectIds = (nodes: ImportNode[]) => {
      nodes.forEach((n) => {
        if (n.id) allIds.push(n.id);
        if (n.type === 'folder') collectIds(n.children);
      });
    };
    collectIds(preview.normalized.items);
    setSelectedNodeIds(new Set(allIds));
  };

  const handleSelectNone = () => {
    setSelectedNodeIds(new Set());
  };

  // Count active requests selected
  const selectedRequestsCount = useMemo(() => {
    if (!preview) return 0;
    let count = 0;
    const traverse = (nodes: ImportNode[]) => {
      nodes.forEach((n) => {
        if (n.id && selectedNodeIds.has(n.id)) {
          if (n.type === 'request') count++;
          else if (n.type === 'folder') traverse(n.children);
        }
      });
    };
    traverse(preview.normalized.items);
    return count;
  }, [preview, selectedNodeIds]);

  const handleImport = async () => {
    if (!canImport || !workspaceId || !userId) return;

    setIsImporting(true);
    setError(null);
    try {
      const selectedArray = Array.from(selectedNodeIds);
      const result = await CollectionImportService.importCollection(
        raw,
        workspaceId,
        userId,
        source,
        selectedArray
      );
      await onImported?.();
      addToast?.({
        type: 'success',
        message: `Successfully integrated '${result.collection.name}' (${selectedRequestsCount} requests established).`,
      });
      handleClose();
    } catch (e: any) {
      const message = e?.message || 'Import transaction failed. Structure may violate standard schema constraints.';
      setError(message);
      addToast?.({ type: 'error', message });
    } finally {
      setIsImporting(false);
    }
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: ImportNode, depth = 0) => {
    if (!node.id) return null;
    const isFolder = node.type === 'folder';
    const isExpanded = expandedNodes[node.id] ?? true;
    const isChecked = selectedNodeIds.has(node.id);

    const toggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.id) {
        setExpandedNodes((prev) => ({ ...prev, [node.id!]: !isExpanded }));
      }
    };

    const getMethodStyle = (method: string) => {
      const m = method.toUpperCase();
      if (m === 'GET') return 'text-[#3ECF8E] bg-[#3ECF8E]/8 border-[#3ECF8E]/15';
      if (m === 'POST') return 'text-[#FF9F0A] bg-[#FF9F0A]/8 border-[#FF9F0A]/15';
      if (m === 'PUT') return 'text-[#0A84FF] bg-[#0A84FF]/8 border-[#0A84FF]/15';
      if (m === 'PATCH') return 'text-[#BF5AF2] bg-[#BF5AF2]/8 border-[#BF5AF2]/15';
      if (m === 'DELETE') return 'text-[#FF453A] bg-[#FF453A]/8 border-[#FF453A]/15';
      return 'text-zinc-400 bg-zinc-500/8 border-zinc-500/15';
    };

    return (
      <div key={node.id} className="select-none text-[10px] uppercase font-bold tracking-wide">
        <div
          className={cn(
            'flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/[0.02] cursor-pointer transition-all duration-150 border border-transparent',
            isChecked ? 'text-white' : 'text-zinc-500'
          )}
          onClick={() => handleToggleNode(node, !isChecked)}
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
        >
          {/* Custom Checkbox indicator with elastic pops */}
          <div className="flex items-center justify-center transition-all duration-200">
            <div 
              className={cn(
                "w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-200",
                isChecked 
                  ? "bg-[#3ECF8E] border-[#3ECF8E] shadow-[0_0_10px_rgba(62,207,142,0.25)]" 
                  : "border-zinc-700 bg-zinc-950/80 hover:border-zinc-500"
              )}
            >
              {isChecked && <Check size={10} className="text-[#0A0A0A] stroke-[4]" />}
            </div>
          </div>

          {isFolder ? (
            <>
              <button
                onClick={toggleExpand}
                className="p-0.5 text-zinc-600 hover:text-white transition-colors flex items-center justify-center"
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
              <Folder size={13} className={cn(isChecked ? 'text-[#3ECF8E]' : 'text-zinc-600')} />
              <span className="truncate tracking-wide font-sans normal-case text-zinc-200">{node.name}</span>
            </>
          ) : (
            <>
              <span className="w-[18px]" />
              <span
                className={cn(
                  'px-1.5 py-0.5 text-[8px] font-black rounded border leading-none font-mono tracking-wider text-center w-12',
                  getMethodStyle(node.request.method)
                )}
              >
                {node.request.method}
              </span>
              <span className="truncate font-sans normal-case tracking-wide text-zinc-200">{node.name}</span>
              <span className="text-[8px] font-mono text-zinc-600 truncate normal-case tracking-tight ml-auto max-w-[260px] pl-3">
                {node.request.url || 'no endpoint'}
              </span>
            </>
          )}
        </div>

        {isFolder && isExpanded && (
          <div className="border-l border-zinc-800/40 ml-[23px] mt-0.5 mb-1 space-y-0.5">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-[#000000]/85 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        className="relative w-full max-w-4xl bg-[#0F0F11]/95 border border-white/[0.05] rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh] backdrop-blur-xl"
      >
        {/* Futuristic Background Gradients */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#3ECF8E]/[0.02] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/[0.01] rounded-full blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.04] flex items-center justify-between bg-black/25 shrink-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] animate-pulse" />
              <h2 className="text-[13px] font-black text-white uppercase tracking-[0.2em]">Import Collection</h2>
            </div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider mt-1">
              Supports Postman, Insomnia, and API Dog. Automatic parsing with interactive selective tree importing.
            </p>
          </div>
          <button 
            onClick={handleClose} 
            className="w-7 h-7 rounded-lg border border-white/[0.03] bg-white/[0.01] flex items-center justify-center text-zinc-500 hover:text-white hover:border-white/[0.1] hover:bg-white/[0.04] transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Main Content Area */}
        <div className="p-6 space-y-6 overflow-y-auto no-scrollbar flex-1 z-10 bg-transparent">
          {/* Integration source selector */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
            {SOURCE_CARDS.map((card) => (
              <button
                key={card.id}
                onClick={() => {
                  setSource(card.id);
                  setPreview(null);
                  setError(null);
                }}
                className={cn(
                  'relative text-left p-3.5 rounded-xl border transition-all duration-300',
                  source === card.id
                    ? 'border-white/[0.08] bg-white/[0.02] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]'
                    : 'border-white/[0.03] bg-black/40 hover:border-white/[0.06]',
                  card.bgGlow
                )}
              >
                {/* Active Indicator bar */}
                {source === card.id && (
                  <motion.div 
                    layoutId="activeGlowBar"
                    className="absolute inset-x-4 -bottom-px h-0.5 rounded-full"
                    style={{ backgroundColor: card.brandColor }}
                  />
                )}
                
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className={cn('px-1.5 py-0.5 text-[8px] font-black rounded border tracking-widest leading-none', card.markClass)}>
                    {card.mark}
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-white uppercase tracking-wider">{card.title}</div>
                    <div className="text-[8px] text-zinc-500 uppercase tracking-widest mt-0.5">{card.subtitle}</div>
                  </div>
                </div>
                <div className="text-[8px] text-zinc-400 font-sans tracking-wide leading-relaxed">{card.features}</div>
              </button>
            ))}
          </div>

          {/* Interactive Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={cn(
              'rounded-xl border-2 border-dashed p-4 transition-all duration-300 shrink-0 relative overflow-hidden',
              isDragging 
                ? 'border-[#3ECF8E] bg-[#3ECF8E]/[0.03]' 
                : 'border-white/[0.04] bg-black/35 hover:border-white/[0.07]'
            )}
          >
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between z-10 relative">
              <div className="flex items-center gap-3.5">
                <div className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center border transition-all duration-300",
                  isDragging ? "bg-[#3ECF8E]/10 border-[#3ECF8E]/20" : "bg-white/[0.01] border-white/[0.04]"
                )}>
                  <FileJson size={18} className={cn(isDragging ? "text-[#3ECF8E]" : "text-zinc-400")} />
                </div>
                <div>
                  <div className="text-[11px] font-black text-white uppercase tracking-widest">Drop JSON / Export Payload</div>
                  <div className="text-[8px] text-zinc-500 uppercase tracking-widest mt-0.5">
                    Drag collection exports here, or click to upload from disk
                  </div>
                </div>
              </div>
              
              <label className="px-4 py-2 rounded-lg border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] active:scale-95 cursor-pointer text-[9px] font-black text-zinc-300 hover:text-white uppercase tracking-wider transition-all">
                <input
                  type="file"
                  accept=".json,application/json,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.currentTarget.value = '';
                  }}
                />
                <span className="inline-flex items-center gap-2">
                  <Upload size={11} /> Browse File
                </span>
              </label>
            </div>

            {/* Pasting Editor Area */}
            <div className="mt-4 border border-white/[0.04] rounded-xl overflow-hidden bg-black/45 shadow-inner">
              <div className="px-3.5 py-2.5 bg-white/[0.01] border-b border-white/[0.04] flex items-center justify-between text-[9px] text-zinc-500 uppercase tracking-widest font-black">
                <span className="inline-flex items-center gap-2"><ClipboardPaste size={11} /> Raw Import Buffer</span>
                {raw.trim() && (
                  <button 
                    onClick={() => setRaw('')}
                    className="text-zinc-600 hover:text-rose-400 transition-colors"
                  >
                    Clear Buffer
                  </button>
                )}
              </div>
              <textarea
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setError(null);
                }}
                placeholder="Paste exported collection JSON schema payload... Parsing starts automatically."
                className="w-full h-28 bg-transparent p-3.5 text-[10px] font-mono text-zinc-300 placeholder:text-zinc-700 outline-none border-none resize-none no-scrollbar"
              />
            </div>
          </div>

          {/* Validation Parser Loading bar */}
          <AnimatePresence>
            {isPreviewing && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2.5 px-3.5 py-2 text-[8px] text-[#3ECF8E] font-black uppercase tracking-[0.25em] bg-[#3ECF8E]/[0.03] border border-[#3ECF8E]/10 rounded-lg shrink-0"
              >
                <CircleDot size={12} className="animate-pulse" />
                Validating Schema Infrastructure...
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selective Tree View Inspector panel */}
          <AnimatePresence>
            {preview && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-4.5 space-y-4 shrink-0 shadow-lg"
              >
                {/* Stats Dashboard Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-[8px] uppercase tracking-[0.15em] font-black text-zinc-500">
                  <div className="p-3 rounded-xl border border-white/[0.03] bg-black/25 flex items-center justify-between">
                    <span>Folders</span>
                    <span className="text-zinc-200 text-[10px] font-mono">{preview.stats.folders}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-white/[0.03] bg-black/25 flex items-center justify-between">
                    <span>Requests</span>
                    <span className="text-zinc-200 text-[10px] font-mono">{preview.stats.requests}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-white/[0.03] bg-black/25 flex items-center justify-between">
                    <span>Variables</span>
                    <span className="text-zinc-200 text-[10px] font-mono">{preview.stats.variables}</span>
                  </div>
                  <div className="p-3 rounded-xl border border-white/[0.03] bg-black/25 flex items-center justify-between">
                    <span>Scripts</span>
                    <span className="text-zinc-200 text-[10px] font-mono">{preview.stats.scripts}</span>
                  </div>
                </div>

                {/* Directory Title bar and selectors */}
                <div className="flex flex-wrap items-center justify-between border-b border-white/[0.04] pb-3 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#3ECF8E]/10 border border-[#3ECF8E]/25 text-[#3ECF8E] text-[8px] font-black uppercase tracking-widest leading-none">
                      {preview.format.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-zinc-200 font-bold tracking-wide truncate max-w-[240px]">
                      {preview.normalized.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="px-3 py-1 text-[8px] font-black uppercase tracking-widest border border-white/[0.03] hover:border-white/[0.1] bg-white/[0.01] hover:bg-white/[0.03] text-zinc-400 hover:text-white rounded-lg transition-all"
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleSelectNone}
                      className="px-3 py-1 text-[8px] font-black uppercase tracking-widest border border-white/[0.03] hover:border-rose-500/25 bg-white/[0.01] hover:bg-rose-500/5 text-zinc-500 hover:text-rose-400 rounded-lg transition-all"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Tree Explorer Container */}
                <div className="bg-[#070708] rounded-xl border border-white/[0.03] p-3 max-h-56 overflow-y-auto space-y-0.5 no-scrollbar shadow-inner">
                  {preview.normalized.items.length > 0 ? (
                    preview.normalized.items.map((node) => renderTreeNode(node, 0))
                  ) : (
                    <div className="text-[9px] text-[#555555] uppercase text-center py-6">
                      No importable endpoints resolved.
                    </div>
                  )}
                </div>

                {/* Warning Message Bar */}
                {preview.warnings.length > 0 && (
                  <div className="text-[8px] text-amber-500 uppercase tracking-widest flex items-center gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                    <AlertTriangle size={11} className="shrink-0" /> {preview.warnings[0]}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Validation Errors */}
          {error && !preview && (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3.5 text-[9px] text-rose-400 font-mono uppercase tracking-widest leading-relaxed">
              &gt; Compile Error: {error}
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="px-6 py-4.5 border-t border-white/[0.04] bg-black/25 flex flex-col md:flex-row gap-3 justify-between items-center shrink-0 z-10">
          <div className="text-[8px] text-zinc-500 uppercase tracking-[0.2em]">
            Parser Core: <span className="text-[#3ECF8E] font-black">{selectedCard.title}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-white/[0.04] bg-transparent text-[9px] font-black text-zinc-400 hover:text-white hover:bg-white/[0.02] transition-all uppercase tracking-widest"
            >
              Close
            </button>
            <button
              onClick={handleImport}
              disabled={!canImport}
              className="px-4.5 py-2.5 rounded-lg bg-[#3ECF8E] text-[#050505] text-[9px] font-black uppercase tracking-widest disabled:opacity-20 active:scale-[0.97] transition-all shadow-[0_4px_20px_rgba(62,207,142,0.15)] flex items-center gap-2 hover:bg-[#46e6a0]"
            >
              {isImporting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-[#050505]/30 border-t-[#050505] rounded-full animate-spin" />
                  Integrating Nodes...
                </>
              ) : (
                <>
                  <Sparkles size={11} />
                  Establish Integration ({selectedRequestsCount} Nodes)
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

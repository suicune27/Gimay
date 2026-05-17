import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, ClipboardPaste, FileJson, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { CollectionImportService, ImportFormat, ImportPreview } from '../services/CollectionImportService';

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
  markClass: string;
  features: string;
}> = [
  {
    id: 'postman',
    title: 'Postman',
    subtitle: 'Collection v2+',
    mark: 'PM',
    markClass: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    features: 'Requests, folders, variables, scripts',
  },
  {
    id: 'apidog',
    title: 'API Dog',
    subtitle: 'Project export JSON',
    mark: 'AD',
    markClass: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    features: 'Requests, folders, headers, params',
  },
  {
    id: 'insomnia',
    title: 'Insomnia',
    subtitle: 'Resources export',
    mark: 'IN',
    markClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    features: 'Requests, groups, environment values',
  },
  {
    id: 'auto',
    title: 'Auto Detect',
    subtitle: 'Recommended',
    mark: 'AUTO',
    markClass: 'bg-[#3ECF8E]/20 text-[#3ECF8E] border-[#3ECF8E]/40',
    features: 'Detect Postman / API Dog / Insomnia',
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

  const canImport = !!workspaceId && !!userId && !!preview && !isImporting;

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
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      setRaw(text);
      setPreview(null);
      setError(null);
    } catch {
      setError('Failed to read the selected file.');
    }
  };

  const handlePreview = async () => {
    if (!raw.trim()) {
      setError('Paste export JSON or choose a file first.');
      return;
    }

    setIsPreviewing(true);
    setError(null);
    try {
      const p = CollectionImportService.previewImport(raw, source);
      setPreview(p);
      if (p.warnings.length) {
        addToast?.({ type: 'warning', message: p.warnings[0] });
      }
    } catch (e: any) {
      setPreview(null);
      setError(e?.message || 'Unable to parse this file.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleImport = async () => {
    if (!canImport || !workspaceId || !userId) return;

    setIsImporting(true);
    setError(null);
    try {
      const result = await CollectionImportService.importCollection(raw, workspaceId, userId, source);
      await onImported?.();
      addToast?.({
        type: 'success',
        message: `Imported ${result.stats.requests} requests from ${result.format.toUpperCase()}.`,
      });
      handleClose();
    } catch (e: any) {
      const message = e?.message || 'Import failed. Please verify the export structure.';
      setError(message);
      addToast?.({ type: 'error', message });
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative w-full max-w-4xl theme-surface border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-5 border-b border-[#222222] flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-black text-white uppercase tracking-widest">Import Collection</h2>
            <p className="text-[10px] text-[#555555] uppercase tracking-tighter mt-1">
              Postman, API Dog, and Insomnia exports
            </p>
          </div>
          <button onClick={handleClose} className="p-1 text-[#444444] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {SOURCE_CARDS.map((card) => (
              <button
                key={card.id}
                onClick={() => {
                  setSource(card.id);
                  setPreview(null);
                  setError(null);
                }}
                className={cn(
                  'text-left p-3 rounded-xl border transition-all',
                  source === card.id
                    ? 'border-[#3ECF8E]/50 bg-[#3ECF8E]/10'
                    : 'border-[#222222] bg-[#111111] hover:border-[#3ECF8E]/25'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('px-2 py-1 text-[9px] font-black rounded-md border uppercase', card.markClass)}>
                    {card.mark}
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-white uppercase tracking-wide">{card.title}</div>
                    <div className="text-[9px] text-[#555555] uppercase tracking-wide">{card.subtitle}</div>
                  </div>
                </div>
                <div className="text-[9px] text-[#888888] uppercase tracking-wide">{card.features}</div>
              </button>
            ))}
          </div>

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
              'rounded-xl border-2 border-dashed p-5 transition-all',
              isDragging ? 'border-[#3ECF8E] bg-[#3ECF8E]/10' : 'border-[#222222] bg-[#0F0F0F]'
            )}
          >
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#141414] border border-[#222222] flex items-center justify-center">
                  <FileJson size={18} className="text-[#3ECF8E]" />
                </div>
                <div>
                  <div className="text-[11px] font-black text-white uppercase tracking-wide">Drop JSON export here</div>
                  <div className="text-[9px] text-[#555555] uppercase tracking-wide">
                    or select file / paste raw export below
                  </div>
                </div>
              </div>
              <label className="px-4 py-2 rounded-lg border border-[#222222] bg-[#111111] hover:border-[#3ECF8E]/40 cursor-pointer text-[10px] font-black text-[#AAAAAA] uppercase tracking-wide">
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
                  <Upload size={12} /> Choose File
                </span>
              </label>
            </div>

            <div className="mt-4 border border-[#222222] rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-[#111111] border-b border-[#222222] flex items-center gap-2 text-[9px] text-[#555555] uppercase tracking-wide">
                <ClipboardPaste size={12} /> Paste raw export data
              </div>
              <textarea
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setPreview(null);
                  setError(null);
                }}
                placeholder="Paste exported JSON from Postman / API Dog / Insomnia"
                className="w-full h-44 bg-[#0A0A0A] p-3 text-[11px] font-mono text-[#AAAAAA] placeholder:text-[#444444] outline-none"
              />
            </div>
          </div>

          <AnimatePresence>
            {preview && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="rounded-xl border border-[#222222] bg-[#0F0F0F] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#3ECF8E]/10 text-[#3ECF8E] text-[9px] font-black uppercase tracking-wide">
                    <CheckCircle2 size={11} /> {preview.format.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-white font-black uppercase tracking-wide">{preview.normalized.name}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[9px] uppercase tracking-wide">
                  <div className="p-2 rounded-lg bg-[#111111] border border-[#222222] text-[#AAAAAA]">Folders: {preview.stats.folders}</div>
                  <div className="p-2 rounded-lg bg-[#111111] border border-[#222222] text-[#AAAAAA]">Requests: {preview.stats.requests}</div>
                  <div className="p-2 rounded-lg bg-[#111111] border border-[#222222] text-[#AAAAAA]">Variables: {preview.stats.variables}</div>
                  <div className="p-2 rounded-lg bg-[#111111] border border-[#222222] text-[#AAAAAA]">Scripts: {preview.stats.scripts}</div>
                </div>
                {preview.warnings.length > 0 && (
                  <div className="text-[10px] text-yellow-400 uppercase tracking-wide flex items-center gap-2">
                    <AlertTriangle size={12} /> {preview.warnings[0]}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[10px] text-red-300 uppercase tracking-wide">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#222222] bg-[#101010] flex flex-col md:flex-row gap-2 justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg border border-[#222222] text-[10px] font-black text-[#AAAAAA] uppercase tracking-wide hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handlePreview}
            disabled={isPreviewing || !raw.trim()}
            className="px-4 py-2 rounded-lg border border-[#3ECF8E]/30 bg-[#3ECF8E]/10 text-[10px] font-black text-[#3ECF8E] uppercase tracking-wide disabled:opacity-50"
          >
            {isPreviewing ? 'Validating...' : 'Preview Import'}
          </button>
          <button
            onClick={handleImport}
            disabled={!canImport}
            className="px-4 py-2 rounded-lg bg-[#3ECF8E] text-[#0A0A0A] text-[10px] font-black uppercase tracking-wide disabled:opacity-50"
          >
            {isImporting ? 'Importing...' : 'Import Collection'}
          </button>
        </div>

        <div className="px-4 pb-4 text-[9px] text-[#555555] uppercase tracking-wide">
          Selected source: {selectedCard.title}
        </div>
      </motion.div>
    </div>
  );
};

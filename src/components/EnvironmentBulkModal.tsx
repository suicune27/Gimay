import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Globe, FileText, Check, AlertCircle, Eye, EyeOff, ShieldAlert,
  Settings, Info, Copy, UploadCloud, FileType, Columns, Sparkles, RefreshCw
} from 'lucide-react';
import { KeyValue } from '../types';
import { cn } from '../lib/utils';

interface EnvironmentBulkModalProps {
  isOpen: boolean;
  onClose: () => void;
  variables: KeyValue[];
  onApply: (variables: KeyValue[]) => void;
}

type EditTab = 'csv' | 'json' | 'env';
type ImportTab = 'apidog' | 'postman' | 'json' | 'env' | 'csv';

export const EnvironmentBulkModal: React.FC<EnvironmentBulkModalProps> = ({
  isOpen,
  onClose,
  variables,
  onApply
}) => {
  const [activeMode, setActiveMode] = useState<'edit' | 'import'>('edit');
  
  // Edit mode states
  const [editTab, setEditTab] = useState<EditTab>('csv');
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Import mode states
  const [importText, setImportText] = useState('');
  const [detectedFormat, setDetectedFormat] = useState<ImportTab>('apidog');
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Preview / Conflict Resolution States
  const [previewVariables, setPreviewVariables] = useState<KeyValue[]>([]);
  const [duplicateBehavior, setDuplicateBehavior] = useState<'overwrite' | 'skip'>('overwrite');
  const [showPreview, setShowPreview] = useState(false);
  const [maskedKeys, setMaskedKeys] = useState<Record<string, boolean>>({});

  const dropRef = useRef<HTMLDivElement>(null);

  // Custom CSV parser: Handles quotes, commas, escapes, spaces, and multiline cells perfectly.
  const parseCSV = (text: string): string[][] => {
    const result: string[][] = [];
    let row: string[] = [];
    let currentVal = '';
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentVal += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal);
        currentVal = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip '\n'
        }
        row.push(currentVal);
        result.push(row);
        row = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    
    if (currentVal || row.length > 0) {
      row.push(currentVal);
      result.push(row);
    }
    
    // Filter trailing empty lines
    return result.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
  };

  // Generate CSV representation of active variables
  const getVariablesAsCSV = (kvs: KeyValue[]): string => {
    // Format: key,value,enabled,description
    return kvs.map(v => {
      const quote = (val: string) => {
        const escaped = val.replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') ? `"${escaped}"` : escaped;
      };
      return `${quote(v.key)},${quote(v.value)},${v.active},${quote(v.description || '')}`;
    }).join('\n');
  };

  // Generate .env representation
  const getVariablesAsEnv = (kvs: KeyValue[]): string => {
    return kvs.map(v => {
      const needsQuote = v.value.includes(' ') || v.value.includes('#') || v.value.includes('"');
      const val = needsQuote ? `"${v.value.replace(/"/g, '\\"')}"` : v.value;
      const comment = v.description ? ` # ${v.description}` : '';
      return `${v.active ? '' : '# '}${v.key}=${val}${comment}`;
    }).join('\n');
  };

  // Sync edit text when edit mode or tab switches
  useEffect(() => {
    if (!isOpen) return;
    setEditError(null);
    if (editTab === 'csv') {
      setEditText(getVariablesAsCSV(variables));
    } else if (editTab === 'env') {
      setEditText(getVariablesAsEnv(variables));
    } else if (editTab === 'json') {
      setEditText(JSON.stringify(variables.map(v => ({
        key: v.key,
        value: v.value,
        active: v.active,
        description: v.description
      })), null, 2));
    }
  }, [editTab, variables, isOpen, activeMode]);

  // Sensitive Field Auto-Detection Check
  const isSensitive = (key: string): boolean => {
    const sensitiveWords = ['token', 'secret', 'password', 'key', 'bearer', 'private', 'auth', 'cred'];
    const normalized = key.toLowerCase();
    return sensitiveWords.some(w => normalized.includes(w));
  };

  // Smart Format Detection
  const detectImportFormat = (text: string): ImportTab => {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.values && Array.isArray(parsed.values)) return 'postman';
        return 'json';
      } catch (_) {}
    }
    
    // Match .env files
    const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const isEnv = lines.length > 0 && lines.every(line => /^[A-Za-z0-9_]+\s*=\s*/.test(line));
    if (isEnv) return 'env';

    // Match Apidog CSV vs Standard CSV
    const parsedCsv = parseCSV(trimmed);
    if (parsedCsv.length > 0) {
      const looksLikeApidog = parsedCsv.some(row => 
        row.length >= 4 && (row[1] === 'default' || row[3] === 'true' || row[3] === 'false')
      );
      if (looksLikeApidog) return 'apidog';
      return 'csv';
    }

    return 'csv';
  };

  // Auto-detect format on import text changes
  useEffect(() => {
    if (activeMode === 'import' && importText.trim()) {
      const format = detectImportFormat(importText);
      setDetectedFormat(format);
    }
  }, [importText, activeMode]);

  // Bulk Edit Validator & Compiler
  const handleApplyEdit = () => {
    try {
      setEditError(null);
      const newVariables: KeyValue[] = [];
      const now = new Date().toISOString();

      if (editTab === 'csv') {
        const parsed = parseCSV(editText);
        parsed.forEach((row, index) => {
          if (row.length === 0 || !row[0].trim()) return;
          const key = row[0].trim();
          const value = row[1] || '';
          const active = row[2] ? row[2].trim().toLowerCase() === 'true' : true;
          const description = row[3] || '';

          newVariables.push({
            id: Math.random().toString(36).substr(2, 9),
            key,
            value,
            active,
            enabled: active,
            description,
            masked: isSensitive(key),
            type: isSensitive(key) ? 'secret' : 'string',
            createdAt: now,
            updatedAt: now
          });
        });
      } else if (editTab === 'env') {
        const lines = editText.split('\n');
        lines.forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          
          let active = true;
          let content = trimmed;
          
          if (trimmed.startsWith('#')) {
            active = false;
            content = trimmed.substring(1).trim();
          }

          if (!content.includes('=')) return;
          
          const equalIndex = content.indexOf('=');
          const key = content.substring(0, equalIndex).trim();
          let rawVal = content.substring(equalIndex + 1);

          // Handle trailing comment if any
          let description = '';
          const commentIndex = rawVal.indexOf('#');
          if (commentIndex !== -1) {
            description = rawVal.substring(commentIndex + 1).trim();
            rawVal = rawVal.substring(0, commentIndex).trim();
          }

          // Strip wrapping quotes
          let value = rawVal.trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1).replace(/\\"/g, '"');
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
          }

          newVariables.push({
            id: Math.random().toString(36).substr(2, 9),
            key,
            value,
            active,
            enabled: active,
            description,
            masked: isSensitive(key),
            type: isSensitive(key) ? 'secret' : 'string',
            createdAt: now,
            updatedAt: now
          });
        });
      } else if (editTab === 'json') {
        const parsed = JSON.parse(editText);
        if (!Array.isArray(parsed)) {
          throw new Error('JSON structure must be an array of variable objects.');
        }
        parsed.forEach((item: any, index: number) => {
          if (!item.key) throw new Error(`Row ${index + 1} is missing a variable "key" name.`);
          newVariables.push({
            id: Math.random().toString(36).substr(2, 9),
            key: String(item.key).trim(),
            value: String(item.value ?? ''),
            active: item.active !== false,
            enabled: item.active !== false,
            description: String(item.description ?? ''),
            masked: isSensitive(item.key),
            type: isSensitive(item.key) ? 'secret' : 'string',
            createdAt: now,
            updatedAt: now
          });
        });
      }

      onApply(newVariables);
      onClose();
    } catch (e: any) {
      setEditError(e.message || 'Syntax validation failed. Please check your data formatting.');
    }
  };

  // Bulk Import Parser
  const handleParseImport = () => {
    try {
      const now = new Date().toISOString();
      const parsedList: KeyValue[] = [];
      const text = importText;

      if (detectedFormat === 'apidog') {
        const rows = parseCSV(text);
        rows.forEach((row) => {
          if (row.length === 0 || !row[0].trim()) return;
          
          // Mapping: key, scope, initialValue, enabled, currentValue, description
          const key = row[0].trim();
          const initialValue = row[2] || '';
          const active = row[3] ? row[3].trim().toLowerCase() === 'true' : true;
          const currentValue = row[4] || '';
          const description = row[5] || '';

          parsedList.push({
            id: Math.random().toString(36).substr(2, 9),
            key,
            value: currentValue || initialValue,
            initialValue,
            currentValue,
            active,
            enabled: active,
            description,
            masked: isSensitive(key),
            type: isSensitive(key) ? 'secret' : 'string',
            createdAt: now,
            updatedAt: now
          });
        });
      } else if (detectedFormat === 'csv') {
        const rows = parseCSV(text);
        rows.forEach((row) => {
          if (row.length === 0 || !row[0].trim()) return;
          const key = row[0].trim();
          const value = row[1] || '';
          const active = row[2] ? row[2].trim().toLowerCase() === 'true' : true;
          const description = row[3] || '';

          parsedList.push({
            id: Math.random().toString(36).substr(2, 9),
            key,
            value,
            active,
            enabled: active,
            description,
            masked: isSensitive(key),
            type: isSensitive(key) ? 'secret' : 'string',
            createdAt: now,
            updatedAt: now
          });
        });
      } else if (detectedFormat === 'env') {
        const lines = text.split('\n');
        lines.forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          
          let active = true;
          let content = trimmed;
          
          if (trimmed.startsWith('#')) {
            active = false;
            content = trimmed.substring(1).trim();
          }

          if (!content.includes('=')) return;
          const equalIndex = content.indexOf('=');
          const key = content.substring(0, equalIndex).trim();
          let rawVal = content.substring(equalIndex + 1);

          let description = '';
          const commentIndex = rawVal.indexOf('#');
          if (commentIndex !== -1) {
            description = rawVal.substring(commentIndex + 1).trim();
            rawVal = rawVal.substring(0, commentIndex).trim();
          }

          let value = rawVal.trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1).replace(/\\"/g, '"');
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
          }

          parsedList.push({
            id: Math.random().toString(36).substr(2, 9),
            key,
            value,
            active,
            enabled: active,
            description,
            masked: isSensitive(key),
            type: isSensitive(key) ? 'secret' : 'string',
            createdAt: now,
            updatedAt: now
          });
        });
      } else if (detectedFormat === 'json') {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (!item.key) return;
            parsedList.push({
              id: Math.random().toString(36).substr(2, 9),
              key: String(item.key).trim(),
              value: String(item.value ?? ''),
              active: item.active !== false,
              enabled: item.active !== false,
              description: String(item.description ?? ''),
              masked: isSensitive(item.key),
              type: isSensitive(item.key) ? 'secret' : 'string',
              createdAt: now,
              updatedAt: now
            });
          });
        } else {
          // Object key-value notation
          Object.keys(parsed).forEach((k) => {
            parsedList.push({
              id: Math.random().toString(36).substr(2, 9),
              key: k.trim(),
              value: String(parsed[k] ?? ''),
              active: true,
              enabled: true,
              masked: isSensitive(k),
              type: isSensitive(k) ? 'secret' : 'string',
              createdAt: now,
              updatedAt: now
            });
          });
        }
      } else if (detectedFormat === 'postman') {
        const parsed = JSON.parse(text);
        const vals = parsed.values || [];
        vals.forEach((v: any) => {
          if (!v.key) return;
          parsedList.push({
            id: Math.random().toString(36).substr(2, 9),
            key: String(v.key).trim(),
            value: String(v.value ?? ''),
            active: v.enabled !== false,
            enabled: v.enabled !== false,
            description: String(v.description ?? ''),
            masked: isSensitive(v.key),
            type: isSensitive(v.key) ? 'secret' : 'string',
            createdAt: now,
            updatedAt: now
          });
        });
      }

      if (parsedList.length === 0) {
        throw new Error('No valid variables were found. Please check your data source.');
      }

      setPreviewVariables(parsedList);
      
      // Initialize masked keys
      const initialMasks: Record<string, boolean> = {};
      parsedList.forEach(pv => {
        if (pv.masked) initialMasks[pv.key] = true;
      });
      setMaskedKeys(initialMasks);
      
      setShowPreview(true);
    } catch (e: any) {
      alert(`Import error: ${e.message || 'Formatting validation failed.'}`);
    }
  };

  // Commit dynamic bulk import with duplicate resolution rules
  const handleCommitImport = () => {
    const existingKeys = new Set(variables.map(v => v.key));
    let mergedVariables = [...variables];

    previewVariables.forEach((pv) => {
      const exists = existingKeys.has(pv.key);
      
      if (exists) {
        if (duplicateBehavior === 'overwrite') {
          // Replace matching variable
          mergedVariables = mergedVariables.map(v => v.key === pv.key ? {
            ...v,
            value: pv.value,
            initialValue: pv.initialValue,
            currentValue: pv.currentValue,
            active: pv.active,
            enabled: pv.active,
            description: pv.description || v.description,
            masked: pv.masked,
            type: pv.type,
            updatedAt: new Date().toISOString()
          } : v);
        }
        // If behavior is 'skip', we do absolutely nothing
      } else {
        mergedVariables.push(pv);
      }
    });

    onApply(mergedVariables);
    onClose();
    setShowPreview(false);
    setImportText('');
  };

  // Handle drag and drop files
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragOver(true);
    } else if (e.type === 'dragleave') {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#000000]/85 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        className="relative w-full max-w-5xl bg-[#0B0B0B] border border-[#222222] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Top Header */}
        <div className="p-6 border-b border-[#222222] bg-[#070707] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 flex items-center justify-center text-[#3ECF8E]">
              <Settings size={20} className="animate-spin duration-1000" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                Variable Bulk Hub <span className="text-[9px] bg-[#3ECF8E]/10 text-[#3ECF8E] px-2 py-0.5 rounded border border-[#3ECF8E]/20">Apidog-v2 Ready</span>
              </h2>
              <p className="text-[10px] text-[#555555] font-black uppercase tracking-tight mt-0.5">
                Multi-Mode Importer & Live Bulk Parameter Editor
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#444444] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Global Navigation Section Select */}
        {!showPreview && (
          <div className="flex px-6 border-b border-[#222222] bg-[#0E0E0E]">
            <button
              onClick={() => setActiveMode('edit')}
              className={cn(
                "flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest relative transition-all",
                activeMode === 'edit' ? "text-[#3ECF8E]" : "text-[#444444] hover:text-[#777777]"
              )}
            >
              <FileText size={13} />
              Bulk Edit Variable Table
              {activeMode === 'edit' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3ECF8E]" />}
            </button>
            <button
              onClick={() => setActiveMode('import')}
              className={cn(
                "flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest relative transition-all",
                activeMode === 'import' ? "text-[#3ECF8E]" : "text-[#444444] hover:text-[#777777]"
              )}
            >
              <UploadCloud size={13} />
              Smart Format Bulk Importer
              {activeMode === 'import' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3ECF8E]" />}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar min-h-[420px]">
          <AnimatePresence mode="wait">
            {showPreview ? (
              /* IMPORT PREVIEW TABLE UI SCREEN */
              <motion.div
                key="preview-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="p-4 bg-[#3ECF8E]/5 border border-[#3ECF8E]/10 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="text-[#3ECF8E]" size={20} />
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Configure Import Commit Parameters</h4>
                      <p className="text-[10px] text-[#888888] mt-0.5">
                        Verify parsed parameters. Sensitive credentials have been auto-masked for safety.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[9px] font-black text-[#555555] uppercase tracking-wider">Duplicate Key Action</label>
                    <select
                      value={duplicateBehavior}
                      onChange={(e) => setDuplicateBehavior(e.target.value as 'overwrite' | 'skip')}
                      className="bg-[#141414] border border-[#222222] text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] rounded-md px-3 py-1.5 outline-none focus:border-[#3ECF8E]/30"
                    >
                      <option value="overwrite">Overwrite Duplicates</option>
                      <option value="skip">Skip & Preserve Stored</option>
                    </select>
                  </div>
                </div>

                <div className="border border-[#222222] bg-[#0A0A0A] rounded-xl overflow-hidden">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead>
                      <tr className="bg-[#0D0D0D] border-b border-[#222222] text-[9px] font-black text-[#555555] uppercase tracking-widest">
                        <th className="p-4 w-12 text-center">Status</th>
                        <th className="p-4 w-1/4">Variable Name</th>
                        <th className="p-4 w-1/3">Target Value</th>
                        <th className="p-4">Description</th>
                        <th className="p-4 w-20 text-center">Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222222]">
                      {previewVariables.map((pv, idx) => {
                        const isDuplicate = variables.some(v => v.key === pv.key);
                        const isKeyEmpty = !pv.key.trim();
                        const showMasked = maskedKeys[pv.key];
                        
                        return (
                          <tr key={idx} className={cn(
                            "hover:bg-[#111111]/30 transition-all",
                            isKeyEmpty ? "bg-red-500/5" : (isDuplicate ? "bg-amber-500/5" : "")
                          )}>
                            <td className="p-4 text-center">
                              {isKeyEmpty ? (
                                <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded text-[9px] font-bold uppercase tracking-tight">Invalid</span>
                              ) : isDuplicate ? (
                                <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded text-[9px] font-bold uppercase tracking-tight">Duplicate</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[#3ECF8E] rounded text-[9px] font-bold uppercase tracking-tight">New</span>
                              )}
                            </td>
                            <td className="p-4 font-bold text-white flex items-center gap-2">
                              {pv.key}
                              {pv.masked && (
                                <span title="Automated security credential detected">
                                  <ShieldAlert size={12} className="text-[#3ECF8E]" />
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-between gap-2 max-w-sm bg-[#111111] border border-[#222222] rounded px-3 py-1">
                                <span className="truncate text-white">
                                  {showMasked ? '••••••••••••••••' : pv.value}
                                </span>
                                {pv.masked && (
                                  <button 
                                    onClick={() => setMaskedKeys(prev => ({ ...prev, [pv.key]: !prev[pv.key] }))}
                                    className="text-[#444444] hover:text-[#888888] transition-colors"
                                  >
                                    {showMasked ? <Eye size={12} /> : <EyeOff size={12} />}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-[#888888] truncate max-w-xs">{pv.description || <span className="text-[#333333] italic">No description</span>}</td>
                            <td className="p-4 text-center text-white">
                              {pv.active ? 'Yes' : 'No'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#222222]">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="px-6 py-2.5 border border-[#222222] hover:bg-[#141414] text-[#888888] text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                  >
                    Back to Config
                  </button>
                  <button
                    onClick={handleCommitImport}
                    className="px-8 py-2.5 bg-[#3ECF8E] hover:shadow-[0_0_20px_rgba(62,207,142,0.3)] text-[#0A0A0A] text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                  >
                    Commit {previewVariables.length} Parameters
                  </button>
                </div>
              </motion.div>
            ) : activeMode === 'edit' ? (
              /* BULK EDIT PANEL */
              <motion.div
                key="edit-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex p-1 bg-[#121212] rounded-lg border border-[#222222]">
                    {[
                      { id: 'csv', label: 'CSV Editor', icon: Columns },
                      { id: 'env', label: '.env Workflows', icon: FileFileType },
                      { id: 'json', label: 'JSON Model', icon: FileType }
                    ].map(tab => {
                      const Icon = tab.icon || FileText;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setEditTab(tab.id as EditTab)}
                          className={cn(
                            "flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all",
                            editTab === tab.id 
                              ? "bg-[#3ECF8E] text-[#0A0A0A] shadow" 
                              : "text-[#666666] hover:text-[#AAAAAA]"
                          )}
                        >
                          <Icon size={12} />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[9px] text-[#555555] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <Info size={12} className="text-[#3ECF8E]" />
                    Automatic syntax check performed on save
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder={
                      editTab === 'csv' 
                        ? "key,value,active,description\napi_url,https://api.github.com,true,API base URL" 
                        : editTab === 'env'
                        ? "# Environment file\nAPI_URL=https://api.github.com"
                        : "[\n  {\n    \"key\": \"api_url\",\n    \"value\": \"https://api.github.com\",\n    \"active\": true\n  }\n]"
                    }
                    className="w-full h-80 bg-[#090909] border border-[#222222] rounded-xl p-4 text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30 resize-none leading-relaxed custom-scrollbar"
                  />
                  {editError && (
                    <div className="absolute left-4 bottom-4 right-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-[10px] font-mono flex items-center gap-2">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{editError}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#222222]">
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 border border-[#222222] hover:bg-[#141414] text-[#888888] text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                  >
                    Abort
                  </button>
                  <button
                    onClick={handleApplyEdit}
                    className="px-8 py-2.5 bg-[#3ECF8E] hover:shadow-[0_0_20px_rgba(62,207,142,0.3)] text-[#0A0A0A] text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                  >
                    Apply Bulk Changes
                  </button>
                </div>
              </motion.div>
            ) : (
              /* SMART IMPORT PANEL */
              <motion.div
                key="import-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Drag and Drop Zone */}
                <div
                  ref={dropRef}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer",
                    isDragOver 
                      ? "border-[#3ECF8E] bg-[#3ECF8E]/5 scale-[0.99]" 
                      : "border-[#222222] hover:border-[#3ECF8E]/40 bg-[#090909]"
                  )}
                >
                  <input 
                    type="file" 
                    id="bulk-file-upload" 
                    className="hidden" 
                    accept=".csv,.txt,.json,.env"
                    onChange={handleFileChange}
                  />
                  <label htmlFor="bulk-file-upload" className="cursor-pointer flex flex-col items-center justify-center">
                    <UploadCloud size={32} className={cn("mb-3 transition-colors", isDragOver ? "text-[#3ECF8E]" : "text-[#444444]")} />
                    <span className="text-xs font-black text-white uppercase tracking-wider">Drag & Drop Import Files Here</span>
                    <span className="text-[10px] text-[#555555] uppercase tracking-tighter mt-1">
                      Supports Apidog CSV, Postman JSON, Insomnia, .env, or raw text config
                    </span>
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-[#555555] uppercase tracking-widest">
                      Paste Raw Environment Parameters
                    </label>
                    
                    {importText.trim() && (
                      <div className="flex items-center gap-1 text-[9px] font-black text-[#3ECF8E] uppercase tracking-widest animate-pulse">
                        <Sparkles size={12} />
                        Auto-detected: {detectedFormat.toUpperCase()} Format
                      </div>
                    )}
                  </div>

                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={`Paste CSV data here. Example Apidog row:\nhashing_key,default,Str2XS3CBEdxjgqG,true,Str2XS3CBEdxjgqG,`}
                    className="w-full h-48 bg-[#090909] border border-[#222222] rounded-xl p-4 text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/30 resize-none leading-relaxed custom-scrollbar"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#222222]">
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 border border-[#222222] hover:bg-[#141414] text-[#888888] text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                  >
                    Abort
                  </button>
                  <button
                    onClick={handleParseImport}
                    disabled={!importText.trim()}
                    className={cn(
                      "px-8 py-2.5 text-[#0A0A0A] text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2",
                      importText.trim() 
                        ? "bg-[#3ECF8E] hover:shadow-[0_0_20px_rgba(62,207,142,0.3)]" 
                        : "bg-[#222222] text-[#555555] cursor-not-allowed"
                    )}
                  >
                    <RefreshCw size={12} className={cn(!importText.trim() ? "" : "animate-spin")} />
                    Validate & Preview Import
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

// Internal Mock Lucide Icons for safety if not found globally
const FileFileType: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <FileType size={size} className={className} />
);

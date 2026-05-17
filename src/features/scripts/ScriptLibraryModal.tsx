import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../../store/useStore';
import { ScriptLibraryService } from '../../services/ScriptLibraryService';
import { ScriptCategory, ScriptTemplate } from '../../types';
import { Search, X, Star, TerminalSquare, Copy, CheckCircle2, ChevronRight, BookTemplate } from 'lucide-react';
import { cn } from '../../lib/utils';
import Editor from '@monaco-editor/react';

interface ScriptLibraryModalProps {
  onInsertScript?: (script: string) => void;
}

export const ScriptLibraryModal: React.FC<ScriptLibraryModalProps> = ({ onInsertScript }) => {
  const { isScriptLibraryOpen, setIsScriptLibraryOpen, profile, scriptLibrary, setScriptLibrary, scriptCategories, setScriptCategories, scriptFavorites, setScriptFavorites, theme } = useStore();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<ScriptTemplate | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isScriptLibraryOpen && scriptLibrary.length === 0) {
      loadData();
    }
  }, [isScriptLibraryOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, scripts] = await Promise.all([
        ScriptLibraryService.fetchCategories(),
        ScriptLibraryService.fetchTemplates()
      ]);
      setScriptCategories(cats);
      setScriptLibrary(scripts);
      if (profile) {
        const favs = await ScriptLibraryService.fetchFavorites(profile.id);
        setScriptFavorites(favs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsScriptLibraryOpen(false);
    setSelectedScript(null);
  };

  const toggleFavorite = async (scriptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile || !scriptFavorites) return;
    const isFav = Array.isArray(scriptFavorites) && scriptFavorites.includes(scriptId);
    try {
      await ScriptLibraryService.toggleFavorite(scriptId, profile.id, !isFav);
      if (isFav) {
        setScriptFavorites(scriptFavorites.filter(id => id !== scriptId));
      } else {
        setScriptFavorites([...(scriptFavorites || []), scriptId]);
      }
    } catch (error) {
      console.error('Failed to toggle favorite', error);
    }
  };

  const filteredScripts = useMemo(() => {
    const query = (searchQuery || '').toLowerCase();
    return scriptLibrary.filter(script => {
      const matchesSearch = (script.name || '').toLowerCase().includes(query) || 
                            (script.description || '').toLowerCase().includes(query);
      const matchesCategory = selectedCategoryId ? script.category_id === selectedCategoryId : true;
      return matchesSearch && matchesCategory;
    });
  }, [scriptLibrary, searchQuery, selectedCategoryId]);

  const handleCopy = () => {
    if (!selectedScript) return;
    navigator.clipboard.writeText(selectedScript.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (!selectedScript || !onInsertScript) return;
    onInsertScript(selectedScript.content);
    handleClose();
  };

  if (!isScriptLibraryOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-6xl h-[85vh] theme-surface border border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="h-14 border-b border-subtle flex items-center justify-between px-6 shrink-0 bg-deep">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <TerminalSquare size={16} />
            </div>
            <div>
              <h2 className="text-[13px] font-black text-main uppercase tracking-widest">Script Library</h2>
              <p className="text-[9px] text-muted uppercase tracking-widest">Community & Built-in Templates</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 text-dim hover:text-main transition-colors rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Categories */}
          <div className="w-64 border-r border-subtle bg-deep flex flex-col">
            <div className="p-4 border-b border-subtle">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search scripts..."
                  className="w-full bg-elevated border border-subtle rounded-lg pl-9 pr-4 py-2 text-[11px] font-mono text-main outline-none focus:border-brand/40 transition-colors"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                  selectedCategoryId === null ? "bg-brand/10 text-brand" : "text-muted hover:bg-elevated hover:text-muted"
                )}
              >
                <BookTemplate size={14} />
                <span className="text-[11px] font-bold uppercase tracking-widest flex-1">All Scripts</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--border-subtle)] text-muted">{scriptLibrary.length}</span>
              </button>
              
              <div className="pt-4 pb-2 px-3 text-[9px] font-black text-dim uppercase tracking-widest">Categories</div>
              {(scriptCategories || []).map(cat => {
                const count = scriptLibrary.filter(s => s.category_id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                      selectedCategoryId === cat.id ? "bg-brand/10 text-brand" : "text-muted hover:bg-elevated hover:text-muted"
                    )}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-widest flex-1 truncate">{cat.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[var(--border-subtle)] text-muted">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col bg-surface relative overflow-hidden">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin text-brand"><TerminalSquare size={32} /></div>
              </div>
            ) : selectedScript ? (
              <div className="flex-1 flex flex-col">
                <div className="p-6 border-b border-subtle bg-deep shrink-0">
                  <button 
                    onClick={() => setSelectedScript(null)}
                    className="flex items-center gap-1 text-[10px] font-black text-muted hover:text-main uppercase tracking-widest mb-4 transition-colors"
                  >
                    <ChevronRight size={12} className="rotate-180" /> Back to library
                  </button>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-xl font-black text-main uppercase tracking-tight">{selectedScript.name}</h1>
                        {selectedScript.is_builtin && (
                          <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">Official</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted max-w-2xl">{selectedScript.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopy}
                        className="px-4 py-2 rounded-lg border border-subtle bg-elevated hover:bg-elevated text-[10px] font-black text-main uppercase tracking-widest flex items-center gap-2 transition-all"
                      >
                        {copied ? <CheckCircle2 size={14} className="text-brand" /> : <Copy size={14} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      {onInsertScript && (
                        <button
                          onClick={handleInsert}
                          className="px-4 py-2 rounded-lg border border-brand/30 bg-brand/10 hover:bg-brand/20 text-[10px] font-black text-brand uppercase tracking-widest transition-all"
                        >
                          Insert Script
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedScript.tags && selectedScript.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {selectedScript.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 rounded-md bg-elevated border border-subtle text-[9px] font-bold text-muted uppercase tracking-widest">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 relative">
                  <Editor
                    height="100%"
                    language="javascript"
                    theme={theme === 'light' ? 'vs' : 'vs-dark'}
                    value={selectedScript.content}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: 'JetBrains Mono',
                      padding: { top: 20 },
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar h-full content-start">
                {(!filteredScripts || filteredScripts.length === 0) ? (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-50">
                    <TerminalSquare size={48} className="mb-4 text-dim" />
                    <h3 className="text-sm font-bold text-main uppercase tracking-widest">No scripts found</h3>
                    <p className="text-[11px] text-muted mt-2">Try adjusting your search or selected category.</p>
                  </div>
                ) : (
                  (filteredScripts || []).map(script => {
                    const isFav = Array.isArray(scriptFavorites) && scriptFavorites.includes(script.id);
                    return (
                      <div 
                        key={script.id}
                        onClick={() => setSelectedScript(script)}
                        className="group relative p-5 rounded-xl border border-subtle bg-elevated hover:bg-elevated hover:border-brand/30 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-2xl flex flex-col h-48"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-[12px] font-bold text-main uppercase tracking-tight line-clamp-1 pr-6">{script.name}</h3>
                          <button 
                            onClick={(e) => toggleFavorite(script.id, e)}
                            className="absolute top-4 right-4 p-1 rounded-md hover:bg-white/10 transition-colors"
                          >
                            <Star size={14} className={isFav ? "fill-yellow-500 text-yellow-500" : "text-dim"} />
                          </button>
                        </div>
                        <p className="text-[11px] text-muted line-clamp-3 mb-4 flex-1">
                          {script.description}
                        </p>
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center gap-2">
                            {script.is_builtin && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-brand/10 text-brand border border-brand/20">Official</span>
                            )}
                            <span className="text-[9px] font-mono text-dim">v{script.version}</span>
                          </div>
                          <ChevronRight size={14} className="text-dim group-hover:text-brand transition-colors" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

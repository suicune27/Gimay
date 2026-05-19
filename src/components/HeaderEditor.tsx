import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Edit3, HelpCircle, Variable, ShieldAlert, Sparkles, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { KeyValue, RequestData } from '../types';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import { VariableService } from '../services/VariableService';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderEditorProps {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  placeholderKey?: string;
  placeholderValue?: string;
}

export const HeaderEditor: React.FC<HeaderEditorProps> = ({
  items = [],
  onChange,
  placeholderKey = "header-name",
  placeholderValue = "value"
}) => {
  const [isBulkEdit, setIsBulkEdit] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  // Per-variable hover tooltip state
  const [hoveredVar, setHoveredVar] = useState<{
    rowIndex: number;
    varName: string;
    scope: string;
    value: string;
    sourceId?: string;
  } | null>(null);
  
  const [editingVarValue, setEditingVarValue] = useState('');
  const hideTimerRef = useRef<number | null>(null);

  const {
    environments,
    activeEnvId,
    collections,
    openTabs,
    activeTabId,
    updateEnvironment,
    updateCollection,
    addTab
  } = useStore();

  const containerRef = useRef<HTMLDivElement>(null);

  // Active Collection retrieval
  const activeTab = openTabs.find(t => t.id === activeTabId);
  const activeCollection = useMemo(() => {
    if (!activeTab) return null;
    if ('requests' in activeTab) return activeTab;
    return collections.find(c => c.id === (activeTab as any).collection_id) || null;
  }, [activeTab, collections]);

  const variableContext = useMemo(() => ({
    environments,
    activeEnvId,
    collection: activeCollection
  }), [environments, activeEnvId, activeCollection]);

  // Bulk edit management
  const startBulkEdit = () => {
    const text = (items || [])
      .filter(item => item && item.active)
      .map(item => `${item.key}: ${item.value}`)
      .join('\n');
    setBulkText(text);
    setIsBulkEdit(true);
  };

  const saveBulkEdit = () => {
    const lines = bulkText.split('\n');
    const newItems: KeyValue[] = lines
      .filter(line => line.trim() !== '')
      .map(line => {
        let separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) separatorIndex = line.indexOf('=');
        
        let key = '';
        let value = '';
        
        if (separatorIndex !== -1) {
          key = line.substring(0, separatorIndex).trim();
          value = line.substring(separatorIndex + 1).trim();
        } else {
          key = line.trim();
        }

        return {
          id: Math.random().toString(36).substr(2, 9),
          key,
          value,
          active: true
        };
      });
    
    onChange(newItems);
    setIsBulkEdit(false);
  };

  // List operations
  const handleItemChange = (id: string, updates: Partial<KeyValue>) => {
    onChange(items.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const addItem = () => {
    const newItem: KeyValue = {
      id: Math.random().toString(36).substr(2, 9),
      key: '',
      value: '',
      active: true
    };
    onChange([...items, newItem]);
  };

  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  // Variable parsing helper
  const parseVariables = (text: string) => {
    if (!text || typeof text !== 'string') return [];
    const matches = text.match(/{{(.*?)}}/g);
    if (!matches) return [];
    return matches.map(m => m.slice(2, -2).trim());
  };

  // Filtered headers to preserve layout speed
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      (item.key || '').toLowerCase().includes(query) || 
      (item.value || '').toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Click outside listener to dismiss popovers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setHoveredVar(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  const handlePersistQuickVar = (varName: string, val: string, scope: string, sourceId?: string) => {
    if (scope === 'environment' && activeEnvId) {
      const env = environments.find(e => e.id === activeEnvId);
      if (env) {
        const updatedVars = (env.variables || []).map(kv => 
          kv.key === varName ? { ...kv, value: val } : kv
        );
        updateEnvironment(activeEnvId, { variables: updatedVars });
      }
    } else if (scope === 'collection' && activeCollection) {
      const updatedVars = (activeCollection.variables || []).map(kv => 
        kv.key === varName ? { ...kv, value: val } : kv
      );
      updateCollection(activeCollection.id, { variables: updatedVars });
    }
    setHoveredVar(null);
  };

  const navigateToVariableSource = (scope: string, sourceId?: string) => {
    if (scope === 'environment' && sourceId) {
      addTab({
        id: 'tab-environments',
        type: 'environment-manager',
        name: 'Environments',
        environmentId: sourceId,
      } as any);
    } else if (scope === 'collection' && activeCollection) {
      addTab(activeCollection as any);
    }
  };

  return (
    <div ref={containerRef} className="space-y-4 w-full relative">
      {/* Sleek Tool Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-[#222222]">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-[#666666] uppercase tracking-widest">
            Headers ({items.length})
          </span>
          {!isBulkEdit && items.length > 5 && (
            <input
              type="text"
              placeholder="Search headers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#111111] border border-[#222222] text-[10px] text-white px-2 py-0.5 rounded outline-none focus:border-[#3ECF8E]/30 transition-all font-medium placeholder:text-[#444444]"
            />
          )}
        </div>
        <button
          onClick={isBulkEdit ? saveBulkEdit : startBulkEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black text-[#888888] hover:text-[#3ECF8E] transition-all uppercase tracking-widest bg-[#141414] border border-[#222222] rounded-lg shadow-lg hover:border-[#3ECF8E]/20"
        >
          {isBulkEdit ? (
            <><CheckCircle2 size={11} className="text-[#3ECF8E]" /> Save Bulk</>
          ) : (
            <><Edit3 size={11} /> Bulk Compiler</>
          )}
        </button>
      </div>

      {isBulkEdit ? (
        <div className="space-y-2 animate-in fade-in duration-200">
          <textarea
            autoFocus
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Host: api.gimay.com&#10;Authorization: Bearer {{token}}"
            className="w-full h-56 bg-[#090909] text-[11px] font-mono p-4 outline-none border border-[#222222] rounded-xl text-white placeholder:text-[#333333] resize-none focus:border-[#3ECF8E]/30 focus:bg-[#0C0C0C] transition-all"
          />
          <div className="text-[9px] text-[#555555] font-medium italic">
            Enter one Header Key: Value pair per line. Standard Postman variable mapping is fully supported.
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Header Row */}
          {filteredItems.length > 0 && (
            <div className="flex items-center gap-3 px-2 py-1 text-[9px] font-black text-[#444444] uppercase tracking-wider select-none border-b border-[#181818]">
              <div className="w-6 shrink-0" />
              <div className="flex-[0.4] px-1">Header Name</div>
              <div className="flex-[0.6] px-1">Value Configuration</div>
              <div className="w-8 shrink-0" />
            </div>
          )}

          {/* Rows */}
          {filteredItems.map((item, rowIndex) => {
            const variables = parseVariables(item.value);
            const variableSources = variables.map(v => {
              const lookup = VariableService.lookupVariable(v, variableContext);
              return { name: v, lookup };
            });

            const hasVariables = variables.length > 0;

            return (
              <div
                key={`header-row-${item.id || rowIndex}`}
                onMouseEnter={() => setHoveredRowId(item.id)}
                onMouseLeave={() => setHoveredRowId(null)}
                className={cn(
                  "flex items-center gap-3 px-2 py-1 rounded-xl transition-all border relative",
                  item.active 
                    ? "bg-[#0E0E0E]/60 border-[#1B1B1B] hover:border-[#2C2C2C] hover:bg-[#121212]/80"
                    : "bg-[#0A0A0A]/40 border-transparent opacity-40 hover:opacity-75"
                )}
              >
                {/* Active Checkbox */}
                <button
                  onClick={() => handleItemChange(item.id, { active: !item.active })}
                  className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-lg transition-colors border",
                    item.active 
                      ? "text-[#3ECF8E] bg-[#3ECF8E]/5 border-[#3ECF8E]/20" 
                      : "text-[#333333] border-[#222222] hover:border-[#444444]"
                  )}
                >
                  {item.active ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                </button>

                {/* Key Input */}
                <div className="flex-[0.4] min-w-0">
                  <input
                    type="text"
                    value={item.key}
                    onChange={(e) => handleItemChange(item.id, { key: e.target.value })}
                    placeholder={placeholderKey}
                    className="w-full bg-transparent text-[11px] font-semibold text-white px-2.5 py-1.5 outline-none rounded-lg border border-transparent hover:border-[#1F1F1F] focus:border-[#3ECF8E]/30 focus:bg-[#070707] transition-all font-mono"
                  />
                </div>

                {/* Value Input Area */}
                <div className="flex-[0.6] min-w-0 relative">
                  <div className="flex items-center relative group">
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => handleItemChange(item.id, { value: e.target.value })}
                      placeholder={placeholderValue}
                      className={cn(
                        "w-full bg-transparent text-[11px] text-[#A0A0A0] px-2.5 py-1.5 pr-8 outline-none rounded-lg border border-transparent hover:border-[#1F1F1F] focus:border-[#3ECF8E]/30 focus:bg-[#070707] transition-all font-mono focus:text-white",
                        hasVariables && "text-transparent caret-[#3ECF8E]"
                      )}
                    />

                    {/* Syntax Highlighted Variable overlay */}
                    {hasVariables && (
                      <div className="absolute inset-0 pointer-events-none text-[11px] font-mono px-2.5 py-1.5 flex items-center gap-0.5 select-none overflow-hidden whitespace-nowrap">
                        {item.value.split(/(\{\{[^}]+\}\})/g).map((part, index) => {
                          const partKey = `overlay-part-${item.id}-${index}`;
                          if (part.startsWith('{{') && part.endsWith('}}')) {
                            const varName = part.slice(2, -2).trim();
                            const vs = variableSources.find(s => s.name === varName);
                            const scope = vs?.lookup.scope || 'unresolved';

                            return (
                              <span
                                key={partKey}
                                onMouseEnter={() => {
                                  if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
                                  const val = vs?.lookup.value || '';
                                  setHoveredVar({
                                    rowIndex,
                                    varName,
                                    scope,
                                    value: val,
                                    sourceId: vs?.lookup.sourceId
                                  });
                                  setEditingVarValue(val);
                                }}
                                onMouseLeave={() => {
                                  hideTimerRef.current = window.setTimeout(() => {
                                    setHoveredVar(null);
                                  }, 200) as any;
                                }}
                                className={cn(
                                  "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tight border pointer-events-auto cursor-help transition-all duration-150",
                                  scope === 'environment' && "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 hover:bg-[#10B981]/25 hover:border-[#10B981]/40",
                                  scope === 'collection' && "bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 hover:bg-[#3B82F6]/25 hover:border-[#3B82F6]/40",
                                  scope === 'unresolved' && "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20 animate-pulse hover:bg-[#EF4444]/25"
                                )}
                              >
                                {part}
                              </span>
                            );
                          }
                          return <span key={partKey} className="text-[#A0A0A0]">{part}</span>;
                        })}
                      </div>
                    )}
                  </div>

                  {/* Per-variable tooltip card popover anchored to row */}
                  <AnimatePresence>
                    {hoveredVar && hoveredVar.rowIndex === rowIndex && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        onMouseEnter={() => {
                          if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
                        }}
                        onMouseLeave={() => {
                          hideTimerRef.current = window.setTimeout(() => {
                            setHoveredVar(null);
                          }, 200) as any;
                        }}
                        className="absolute z-50 left-2 top-full mt-2 w-[320px] bg-[#0A0A0C]/95 backdrop-blur-2xl border border-[#222222] rounded-xl shadow-2xl p-3.5 space-y-3.5"
                      >
                        {/* Header Details */}
                        <div className="flex items-center justify-between pb-1.5 border-b border-[#181818]">
                          <div className="flex items-center gap-1.5">
                            <Variable size={11} className="text-[#3ECF8E]" />
                            <span className="font-mono text-[10px] font-black text-white">
                              {hoveredVar.varName}
                            </span>
                          </div>
                          <span className={cn(
                            "text-[7px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider",
                            hoveredVar.scope === 'environment' && "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/20",
                            hoveredVar.scope === 'collection' && "bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/20",
                            hoveredVar.scope === 'unresolved' && "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/20 animate-pulse"
                          )}>
                            {hoveredVar.scope === 'environment' ? 'Environment' : hoveredVar.scope === 'collection' ? 'Collection' : 'Missing'}
                          </span>
                        </div>

                        {/* Resolved Value or Unresolved Warning */}
                        {hoveredVar.scope === 'unresolved' ? (
                          <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2.5 text-[9.5px] text-red-400 flex items-start gap-2">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            <div>
                              <div className="font-bold">Unresolved Variable</div>
                              <div className="opacity-75 mt-0.5">This parameter is not mapped in the active Environment or Collection. Gimay will transmit the raw literal text.</div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-[8px] font-black text-[#555] uppercase tracking-widest block">Resolved Value</label>
                              <div className="bg-[#050505] border border-[#161616] rounded-lg p-2 font-mono text-[10px] text-[#3ECF8E] break-all">
                                {hoveredVar.value || <span className="text-[#2B3A30] italic">Empty String</span>}
                              </div>
                            </div>

                            {/* Direct Modifier Form */}
                            <div className="space-y-1.5 pt-2 border-t border-[#181818]">
                              <label className="text-[8px] font-black text-[#555] uppercase tracking-widest block">Quick Modify Value</label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editingVarValue}
                                  onChange={(e) => setEditingVarValue(e.target.value)}
                                  className="flex-1 bg-[#050505] border border-[#1C1C1C] rounded-lg px-2 py-1.5 text-[10.5px] font-mono text-white outline-none focus:border-[#3ECF8E]/40 transition-colors"
                                  placeholder="Enter new value"
                                />
                                <button
                                  onClick={() => handlePersistQuickVar(hoveredVar.varName, editingVarValue, hoveredVar.scope, hoveredVar.sourceId)}
                                  className="p-1.5 rounded-lg bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[#3ECF8E] hover:bg-[#3ECF8E]/20 transition-all shadow-md"
                                  title="Save resolved value"
                                >
                                  <Check size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Navigation / Open Source button */}
                        {hoveredVar.scope !== 'unresolved' && (
                          <button
                            onClick={() => navigateToVariableSource(hoveredVar.scope, hoveredVar.sourceId)}
                            className="w-full px-2 py-1.5 rounded-lg border border-[#202020] text-[8px] font-black uppercase tracking-widest text-[#888888] hover:text-[#3ECF8E] hover:border-[#3ECF8E]/20 transition-all flex items-center justify-center gap-1.5 bg-[#121214]/50"
                          >
                            <ExternalLink size={10} />
                            Open Variable Source
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="w-8 h-8 flex items-center justify-center text-[#444444] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg shrink-0 hover:bg-red-500/5 hover:border hover:border-red-500/10 border border-transparent"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}

          <button
            onClick={addItem}
            className="mt-3 flex items-center gap-2 px-3 py-1.5 text-[9px] font-black text-[#777777] hover:text-[#3ECF8E] hover:bg-[#3ECF8E]/5 border border-dashed border-[#222222] hover:border-[#3ECF8E]/20 rounded-xl transition-all uppercase tracking-widest"
          >
            <Plus size={11} /> Add Header Field
          </button>
        </div>
      )}
    </div>
  );
};

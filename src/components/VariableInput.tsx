import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { Collection, RequestData } from '../types';
import { VariableService } from '../services/VariableService';
import { ExternalLink, AlertTriangle } from 'lucide-react';

interface VariableInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  masked?: boolean;
  disabled?: boolean;
  onNavigateVariable?: (name: string, scope: 'environment' | 'collection') => void;
}

export const VariableInput: React.FC<VariableInputProps> = ({ 
  value = '', 
  onChange, 
  placeholder, 
  className,
  autoFocus,
  masked = false,
  disabled = false,
  onNavigateVariable
}) => {
  const {
    environments,
    activeEnvId,
    collections,
    openTabs,
    activeTabId,
    updateEnvironment,
    updateCollection,
    addTab,
    globalVariables
  } = useStore();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [hoveredVariable, setHoveredVariable] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTooltipTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (inputRef.current && overlayRef.current) {
      overlayRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    handleScroll();
  }, [value]);

  const activeEnv = environments.find(e => e.id === activeEnvId);
  const activeTab = openTabs.find(t => t.id === activeTabId);
  const activeCollection = activeTab && 'requests' in activeTab 
    ? activeTab as Collection 
    : collections.find(c => c.id === (activeTab as RequestData)?.collection_id);

  const variableContext = {
    environments,
    activeEnvId,
    collection: activeCollection || null,
    globalVariables
  };

  const allVariables = (() => {
    const ordered = [
      ...(activeEnv?.variables || []),
      ...(activeCollection?.variables || []),
      ...(globalVariables || []),
    ].filter(v => v.active);

    const seen = new Set<string>();
    return ordered.filter((v) => {
      if (seen.has(v.key)) return false;
      seen.add(v.key);
      return true;
    });
  })();

  const filteredVars = allVariables.filter(v => {
    const safeValue = value || '';
    const match = safeValue.match(/\{\{([^}]*)$/);
    if (!match) return false;
    return (v.key || '').toLowerCase().includes(match[1].toLowerCase());
  });

  const hoveredLookup = hoveredVariable
    ? VariableService.lookupVariable(hoveredVariable, variableContext)
    : null;

  useEffect(() => {
    if (!hoveredLookup) {
      setEditingValue('');
      return;
    }
    setEditingValue(hoveredLookup.value || '');
  }, [hoveredLookup?.name, hoveredLookup?.value, hoveredLookup?.scope]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && filteredVars.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(prev => (prev + 1) % filteredVars.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(prev => (prev - 1 + filteredVars.length) % filteredVars.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectSuggestion(filteredVars[suggestionIndex].key);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };

  const selectSuggestion = (varName: string) => {
    const newValue = value.replace(/\{\{([^}]*)$/, `{{${varName}}}`);
    onChange(newValue);
    setShowSuggestions(false);
  };

  const persistHoveredVariableValue = () => {
    if (!hoveredLookup) return;
    const variableName = hoveredLookup.name;

    if (hoveredLookup.scope === 'environment' && hoveredLookup.sourceId) {
      const env = environments.find(e => e.id === hoveredLookup.sourceId);
      if (!env) return;
      const updatedVariables = (env.variables || []).map(v =>
        v.key === variableName && v.active ? { ...v, value: editingValue } : v
      );
      updateEnvironment(env.id, { variables: updatedVariables });
      return;
    }

    if (hoveredLookup.scope === 'collection' && activeCollection) {
      const updatedVariables = (activeCollection.variables || []).map(v =>
        v.key === variableName && v.active ? { ...v, value: editingValue } : v
      );
      updateCollection(activeCollection.id, { variables: updatedVariables });
    }
  };

  const navigateToVariableSource = () => {
    if (!hoveredLookup) return;
    if (hoveredLookup.scope !== 'environment' && hoveredLookup.scope !== 'collection') return;

    if (onNavigateVariable) {
      onNavigateVariable(hoveredLookup.name, hoveredLookup.scope);
      return;
    }

    if (hoveredLookup.scope === 'environment') {
      addTab({
        id: 'tab-environments',
        type: 'environment-manager',
        name: 'Environments',
        environmentId: hoveredLookup.sourceId,
      } as any);
      return;
    }

    if (hoveredLookup.scope === 'collection' && activeCollection) {
      addTab(activeCollection as any);
    }
  };

  const startHideTooltipTimer = () => {
    if (hideTooltipTimerRef.current) window.clearTimeout(hideTooltipTimerRef.current);
    hideTooltipTimerRef.current = window.setTimeout(() => {
      setHoveredVariable(null);
    }, 120);
  };

  const cancelHideTooltipTimer = () => {
    if (hideTooltipTimerRef.current) {
      window.clearTimeout(hideTooltipTimerRef.current);
      hideTooltipTimerRef.current = null;
    }
  };

  useEffect(() => {
    const match = value.match(/\{\{([^}]*)$/);
    setShowSuggestions(!!match);
    if (match) setSuggestionIndex(0);
  }, [value]);

  // Function to highlight variables in a div (simulating an input but with colors)
  const renderValueWithHighlights = () => {
    const parts = value.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) => {
      if (part.startsWith('{{') && part.endsWith('}}')) {
        const varName = part.slice(2, -2);
        const lookup = VariableService.lookupVariable(varName, variableContext);
        const exists = lookup.scope !== 'unresolved';
        const unresolved = lookup.scope === 'unresolved';
        return (
          <span 
            key={i} 
            onMouseEnter={() => {
              cancelHideTooltipTimer();
              setHoveredVariable(varName);
            }}
            onMouseLeave={startHideTooltipTimer}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              cancelHideTooltipTimer();
              setHoveredVariable(varName);
            }}
            className={cn(
              "px-1 rounded pointer-events-auto cursor-pointer border",
              exists ? "text-[#3ECF8E] bg-[#3ECF8E]/10 border-[#3ECF8E]/20" : "text-red-400 bg-red-400/10 border-red-500/30",
              unresolved && "animate-pulse"
            )}
            title={exists ? `${lookup.scope} variable` : 'Unresolved variable'}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div ref={containerRef} className="relative w-full group">
      <div className="relative">
        <input 
          ref={inputRef}
          onScroll={handleScroll}
          autoFocus={autoFocus}
          type={masked ? 'password' : 'text'}
          disabled={disabled}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setTimeout(handleScroll, 0);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setShowSuggestions((value || '').includes('{{'));
          }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          className={cn(
            "w-full bg-transparent text-[11px] font-mono py-1.5 px-2 outline-none border border-transparent rounded transition-all relative z-0",
            "focus:border-[#222222] focus:bg-[#0F0F0F]",
            value.includes('{{') && "text-transparent caret-white",
            disabled && "opacity-60 cursor-not-allowed",
            className
          )}
        />
        {/* Overlay for highlighting (Postman-style) */}
        {value.includes('{{') && (
           <div 
             ref={overlayRef}
             className="absolute inset-0 pointer-events-none text-[11px] font-mono py-1.5 px-2 whitespace-pre overflow-hidden flex items-center z-10"
           >
             {renderValueWithHighlights()}
           </div>
        )}
      </div>

      {hoveredVariable && hoveredLookup && (
        <div
          className="absolute z-[70] left-0 top-full mt-1 w-[320px] bg-[#141414] border border-[#222222] rounded-lg shadow-2xl p-3"
          onMouseEnter={cancelHideTooltipTimer}
          onMouseLeave={startHideTooltipTimer}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white">{hoveredLookup.name}</div>
              <div className={cn(
                'text-[9px] font-bold uppercase tracking-widest',
                hoveredLookup.scope === 'unresolved' ? 'text-red-400' : 'text-[#3ECF8E]'
              )}>
                Scope: {hoveredLookup.scope}
              </div>
            </div>
            {hoveredLookup.masked && (
              <div className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 uppercase font-black tracking-widest">
                Masked
              </div>
            )}
          </div>

          {hoveredLookup.scope === 'unresolved' ? (
            <div className="flex items-center gap-2 text-[10px] text-red-400 mb-2">
              <AlertTriangle size={12} />
              Variable is unresolved.
            </div>
          ) : (
            <>
              <label className="text-[8px] font-black text-[#777777] uppercase tracking-widest">Resolved Value</label>
              <input
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={persistHoveredVariableValue}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    persistHoveredVariableValue();
                    setHoveredVariable(null);
                  }
                }}
                type={hoveredLookup.masked ? 'password' : 'text'}
                className="mt-1 w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded px-2 py-1.5 text-[11px] font-mono text-white outline-none focus:border-[#3ECF8E]/40"
              />
            </>
          )}

          {(hoveredLookup.scope === 'environment' || hoveredLookup.scope === 'collection') && (
            <button
              onClick={navigateToVariableSource}
              className="mt-2 w-full px-2 py-1.5 rounded border border-[#2A2A2A] text-[9px] font-black uppercase tracking-widest text-[#AAAAAA] hover:text-[#3ECF8E] hover:border-[#3ECF8E]/30 transition-all flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={11} />
              Open Source Definition
            </button>
          )}
        </div>
      )}

      {showSuggestions && filteredVars.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full bg-[#141414] border border-[#222222] rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
          {filteredVars.map((v, i) => (
            <button
              key={v.id}
              onClick={() => selectSuggestion(v.key)}
              onMouseEnter={() => setSuggestionIndex(i)}
              className={cn(
                "w-full text-left px-3 py-2 text-[10px] font-mono flex items-center justify-between transition-colors",
                i === suggestionIndex ? "bg-[#1A1A1A] text-[#3ECF8E]" : "text-[#888888]"
              )}
            >
              <span>{v.key}</span>
              <span className="text-[8px] opacity-50">{(v.value || '').substring(0, 15)}{(v.value || '').length > 15 ? '...' : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

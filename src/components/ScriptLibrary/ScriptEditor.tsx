import React, { useEffect, useRef, Suspense } from 'react';
import type { OnMount } from '@monaco-editor/react';
import { Play, Save, X, FileCode } from 'lucide-react';
import { useScriptStore } from '../../store/scriptStore';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { registerGimayCompletions } from '../../services/monacoCompletion';
import { ScriptEngine } from '../../services/scriptEngine';
import { PersistenceService } from '../../services/PersistenceService';

const Editor = React.lazy(() => import('@monaco-editor/react'));

export const ScriptEditor: React.FC = () => {
  const { openTabs, activeTabId, closeTab, scripts, updateScript, setTabDirty } = useScriptStore();
  const { addToast } = useStore();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const disposablesRef = useRef<any[]>([]);

  const activeTab = openTabs.find(t => t.id === activeTabId);
  const activeScript = scripts.find(s => s.id === activeTab?.scriptId);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Clear old registrations
    disposablesRef.current.forEach(d => d.dispose());
    // Register optimized completions
    disposablesRef.current = registerGimayCompletions(monaco);
    
    updateEditorTheme();
  };

  const updateEditorTheme = () => {
    if (!monacoRef.current) return;
    
    const monaco = monacoRef.current;
    
    monaco.editor.defineTheme('gimay-custom', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '666666', fontStyle: 'italic' },
        { token: 'keyword', foreground: '3ECF8E' },
        { token: 'string', foreground: 'E0E0E0' },
        { token: 'variable', foreground: 'AAAAAA' },
      ],
      colors: {
        'editor.background': '#0F0F0F',
        'editor.lineHighlightBackground': '#1A1A1A',
        'editorLineNumber.foreground': '#333333',
        'editorLineNumber.activeForeground': 'var(--brand)',
        'editor.selectionBackground': '#3ECF8E33',
      }
    });
    
    monaco.editor.setTheme('gimay-custom');
  };

  useEffect(() => {
    updateEditorTheme();
  }, []);

  // Clean up completions on unmount
  useEffect(() => {
    return () => {
      disposablesRef.current.forEach(d => d.dispose());
    };
  }, []);

  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    if (!activeScript || !activeTab) {
      setIsSaving(false);
      return;
    }
    
    const content = editorRef.current?.getValue();
    if (content === undefined) {
      addToast({ type: 'warning', message: 'Editor not ready.' });
      setIsSaving(false);
      return;
    }

    try {
      await PersistenceService.updateScript(activeScript.id, { 
        content,
        name: activeScript.name 
      });
      updateScript(activeScript.id, { content });
      setTabDirty(activeTab.id, false);
      addToast({ type: 'success', message: 'Script saved.' });
    } catch (e) {
      addToast({ type: 'error', message: 'Save failed.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = () => {
    if (!activeScript) return;
    const content = editorRef.current?.getValue();
    ScriptEngine.execute(content);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeScript, activeTab, isSaving]);

  if (!activeTab || !activeScript) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-surface)] text-[var(--border-subtle)]">
        <FileCode size={64} className="mb-4 opacity-50 text-[var(--brand)] shadow-[0_0_30px_var(--brand-muted)]" />
        <h3 className="text-sm font-black uppercase tracking-[0.3em] opacity-50 text-[var(--text-dim)]">Select a script to edit</h3>
        <p className="text-[10px] mt-2 font-mono opacity-30 text-[var(--text-dim)]">Ctrl+N to create new</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-surface)]">
      {/* Tabs */}
      <div className="h-10 bg-[var(--bg-deep)] border-b border-[var(--border-subtle)] flex items-center px-1 gap-px overflow-x-auto no-scrollbar">
        {openTabs.map((tab) => {
          const script = scripts.find(s => s.id === tab.scriptId);
          if (!script) return null;
          return (
            <div 
              key={tab.id}
              onClick={() => useScriptStore.getState().setActiveTabId(tab.id)}
              className={cn(
                "h-full px-4 flex items-center gap-2 cursor-pointer transition-all border-t-2 text-[10px] font-bold min-w-[120px] max-w-[200px] shrink-0 group relative",
                activeTabId === tab.id 
                  ? "bg-[var(--bg-surface)] border-[var(--brand)] text-[var(--text-main)]" 
                  : "bg-[var(--bg-deep)] border-transparent text-[var(--text-dim)] hover:bg-[var(--bg-elevated)]"
              )}
            >
              <FileCode size={12} className={activeTabId === tab.id ? "text-[var(--brand)]" : ""} />
              <span className="truncate flex-1 pr-4">{script.name}</span>
              {tab.isDirty && <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] shrink-0 mr-1" />}
              <button 
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="p-1 hover:bg-[var(--bg-elevated)] rounded transition-all opacity-0 group-hover:opacity-100 absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="h-12 border-b border-[var(--border-subtle)] flex items-center justify-between px-6 shrink-0 bg-[var(--bg-elevated)]">
        <div className="flex items-center gap-4">
          <input 
            value={activeScript.name}
            onChange={(e) => updateScript(activeScript.id, { name: e.target.value })}
            className="bg-transparent border-none text-[12px] font-black text-[var(--text-main)] uppercase tracking-widest outline-none focus:text-[var(--brand)] transition-all"
          />
          {activeTab.isDirty && (
            <span className="text-[9px] font-black text-[var(--brand)] uppercase tracking-tighter bg-[var(--brand)]/10 px-2 py-0.5 rounded">Unsaved Changes</span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-[10px] font-black transition-all uppercase",
              isSaving ? "opacity-50 cursor-not-allowed" : "text-[var(--text-muted)] hover:text-[var(--brand)] hover:border-[var(--brand)]/30"
            )}
          >
            <Save size={14} className={isSaving ? "animate-spin text-[var(--brand)]" : ""} /> {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={handleRun}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[var(--brand)] text-[var(--bg-deep)] text-[10px] font-black hover:shadow-[0_0_15px_var(--brand-muted)] transition-all uppercase"
          >
            <Play size={14} fill="currentColor" /> Run Script
          </button>
        </div>
      </div>

      {/* Editor with Lazy Monaco */}
      <div className="flex-1 relative">
        <Suspense fallback={
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-surface)]">
            <div className="animate-spin text-[var(--brand)] mb-3">
              <FileCode size={36} className="shadow-[0_0_30px_var(--brand-muted)]" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-dim)]">Initializing Code Space...</span>
          </div>
        }>
          <Editor
            height="100%"
            defaultLanguage="javascript"
            value={activeScript.content}
            onMount={handleEditorMount}
            onChange={(val) => {
              if (!activeTab.isDirty) setTabDirty(activeTab.id, true);
            }}
            options={{
              minimap: { enabled: false },
              quickSuggestions: { other: true, comments: false, strings: false },
              parameterHints: { enabled: true },
              folding: false,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              lineHeight: 22,
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto'
              },
              padding: { top: 20 },
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              bracketPairColorization: { enabled: true },
              automaticLayout: true
            }}
          />
        </Suspense>
      </div>
    </div>
  );
};

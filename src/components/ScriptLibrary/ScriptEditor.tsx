import React, { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Play, Save, Trash2, X, ChevronRight, FileCode, CheckCircle2 } from 'lucide-react';
import { useScriptStore } from '../../store/scriptStore';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { registerPutmanCompletions } from '../../services/monacoCompletion';
import { ScriptEngine } from '../../services/scriptEngine';
import { PersistenceService } from '../../services/PersistenceService';

export const ScriptEditor: React.FC = () => {
  const { openTabs, activeTabId, closeTab, scripts, updateScript, setTabDirty } = useScriptStore();
  const { addToast, settings } = useStore();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const activeTab = openTabs.find(t => t.id === activeTabId);
  const activeScript = scripts.find(s => s.id === activeTab?.scriptId);

  const theme = settings.appearance.theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : settings.appearance.theme;

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerPutmanCompletions(monaco);
    updateEditorTheme();
  };

  const updateEditorTheme = () => {
    if (!monacoRef.current) return;
    
    const monaco = monacoRef.current;
    
    // Define custom theme
    monaco.editor.defineTheme('putman-custom', {
      base: theme === 'light' ? 'vs' : 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '666666', fontStyle: 'italic' },
        { token: 'keyword', foreground: theme === 'light' ? '008000' : '3ECF8E' },
        { token: 'string', foreground: theme === 'light' ? '000000' : 'E0E0E0' },
        { token: 'variable', foreground: theme === 'light' ? '000000' : 'AAAAAA' },
      ],
      colors: {
        'editor.background': theme === 'light' ? '#FFFFFF' : '#0F0F0F',
        'editor.lineHighlightBackground': theme === 'light' ? '#F3F4F6' : '#1A1A1A',
        'editorLineNumber.foreground': theme === 'light' ? '#9CA3AF' : '#333333',
        'editorLineNumber.activeForeground': theme === 'light' ? '#000000' : '#3ECF8E',
        'editor.selectionBackground': theme === 'light' ? '#3ECF8E44' : '#3ECF8E33',
      }
    });
    
    monaco.editor.setTheme('putman-custom');
  };

  useEffect(() => {
    updateEditorTheme();
  }, [theme]);

  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    console.log('[ScriptEditor] Save triggered', { activeScript, activeTab });
    
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
  }, [activeScript, activeTab, isSaving]); // Added isSaving to deps

  if (!activeTab || !activeScript) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface text-[var(--border-subtle)]">
        <FileCode size={64} className="mb-4 opacity-50" />
        <h3 className="text-sm font-black uppercase tracking-[0.3em] opacity-50 text-dim">Select a script to edit</h3>
        <p className="text-[10px] mt-2 font-mono opacity-30 text-dim">Ctrl+N to create new</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-surface">
      {/* Tabs */}
      <div className="h-10 bg-deep border-b border-subtle flex items-center px-1 gap-px overflow-x-auto no-scrollbar">
        {openTabs.map((tab) => {
          const script = scripts.find(s => s.id === tab.scriptId);
          if (!script) return null;
          return (
            <div 
              key={tab.id}
              onClick={() => useScriptStore.getState().setActiveTabId(tab.id)}
              className={cn(
                "h-full px-4 flex items-center gap-2 cursor-pointer transition-all border-t-2 text-[10px] font-bold min-w-[120px] max-w-[200px] shrink-0",
                activeTabId === tab.id 
                  ? "bg-surface border-brand text-main" 
                  : "bg-deep border-transparent text-dim hover:bg-elevated"
              )}
            >
              <FileCode size={12} className={activeTabId === tab.id ? "text-brand" : ""} />
              <span className="truncate flex-1">{script.name}</span>
              {tab.isDirty && <div className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />}
              <button 
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="p-1 hover:bg-elevated rounded transition-all opacity-0 group-hover:opacity-100"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="h-12 border-b border-subtle flex items-center justify-between px-6 shrink-0 bg-elevated">
        <div className="flex items-center gap-4">
          <input 
            value={activeScript.name}
            onChange={(e) => updateScript(activeScript.id, { name: e.target.value })}
            className="bg-transparent border-none text-[12px] font-black text-main uppercase tracking-widest outline-none focus:text-brand transition-all"
          />
          {activeTab.isDirty && (
            <span className="text-[9px] font-black text-brand uppercase tracking-tighter bg-brand/10 px-2 py-0.5 rounded">Unsaved Changes</span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg border border-subtle text-[10px] font-black transition-all uppercase",
              isSaving ? "opacity-50 cursor-not-allowed" : "text-muted hover:text-brand hover:border-brand/30"
            )}
          >
            <Save size={14} className={isSaving ? "animate-spin" : ""} /> {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={handleRun}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-brand text-[var(--bg-deep)] text-[10px] font-black hover:shadow-[0_0_15px_var(--brand-muted)] transition-all uppercase"
          >
            <Play size={14} fill="currentColor" /> Run Script
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={activeScript.content}
          onMount={handleEditorMount}
          onChange={(val) => {
            if (!activeTab.isDirty) setTabDirty(activeTab.id, true);
          }}
          options={{
            minimap: { enabled: true },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineHeight: 22,
            scrollbar: {
              vertical: 'hidden',
              horizontal: 'hidden'
            },
            padding: { top: 20 },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            bracketPairColorization: { enabled: true }
          }}
        />
      </div>
    </div>
  );
};

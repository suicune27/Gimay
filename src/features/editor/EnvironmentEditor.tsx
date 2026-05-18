import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { useDataSync } from '../../hooks/useDataSync';
import { PersistenceService } from '../../services/PersistenceService';
import { ScriptLibraryModal } from '../scripts/ScriptLibraryModal';
import { KVEditor } from '../../components/KVEditor';
import { ConfirmModal } from '../../components/ConfirmModal';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe,
  Variable,
  Code2,
  FileText,
  RefreshCcw,
  Cloud,
  Plus,
  Trash2,
  Eye,
  PenLine,
  ChevronDown,
  Save,
  Clock
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Editor from '@monaco-editor/react';

interface EnvironmentEditorProps {
  tabId: string;
}

export const EnvironmentEditor: React.FC<EnvironmentEditorProps> = ({ tabId }) => {
  const {
    environments,
    activeWorkspaceId,
    profile,
    updateEnvironment,
    updateTab,
    addToast,
    syncStatus,
    openTabs,
    settings,
    pendingSyncIds,
    syncResource,
    setIsScriptLibraryOpen
  } = useStore();
  const { fetchEnvironments } = useDataSync();

  const tab = openTabs.find((t) => t.id === tabId && 'type' in t && t.type === 'environment-manager') as
    | { id: string; type: 'environment-manager'; name: string; environmentId?: string }
    | undefined;

  const [activeSection, setActiveSection] = useState<'Variables' | 'Scripts' | 'Documentation'>('Variables');
  const [activeScriptTarget, setActiveScriptTarget] = useState<'pre_request_script' | 'test_script'>('pre_request_script');
  const [docMode, setDocMode] = useState<'edit' | 'preview'>('preview');
  const [isCreatingEnvironment, setIsCreatingEnvironment] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const creatingRef = useRef(false);

  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(tab?.environmentId || null);
  const [nameDraft, setNameDraft] = useState('');

  const selectedEnvironment = useMemo(() => {
    if (!selectedEnvironmentId) return null;
    return environments.find((env) => env.id === selectedEnvironmentId) || null;
  }, [environments, selectedEnvironmentId]);

  const isPending = !!selectedEnvironment && pendingSyncIds.has(selectedEnvironment.id);
  const showSaveButton = !settings.general.autoSave && isPending;

  const handleManualSave = async () => {
    if (!selectedEnvironment) return;
    setIsSavingManual(true);
    await syncResource('environment', selectedEnvironment.id);
    setIsSavingManual(false);
  };

  useEffect(() => {
    setSelectedEnvironmentId(tab?.environmentId || null);
  }, [tab?.environmentId]);

  useEffect(() => {
    if (selectedEnvironment) {
      setNameDraft(selectedEnvironment.name);
      updateTab(tabId, { name: `Env: ${selectedEnvironment.name}`, environmentId: selectedEnvironment.id } as any);
      return;
    }

    setNameDraft('');
    updateTab(tabId, { name: 'Environments', environmentId: undefined } as any);
  }, [selectedEnvironment?.id, selectedEnvironment?.name, tabId, updateTab]);

  useEffect(() => {
    if (!selectedEnvironment || !nameDraft.trim() || nameDraft === selectedEnvironment.name) return;

    const timer = window.setTimeout(() => {
      updateEnvironment(selectedEnvironment.id, { name: nameDraft.trim() });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [nameDraft, selectedEnvironment?.id, selectedEnvironment?.name, updateEnvironment]);

  const handleCreateEnvironment = async () => {
    if (!activeWorkspaceId || !profile?.id) return;
    if (creatingRef.current) return;

    creatingRef.current = true;
    setIsCreatingEnvironment(true);

    const baseName = 'New Environment';
    const existingNames = new Set(environments.map((e) => e.name.toLowerCase()));
    let count = 1;
    let name = baseName;
    while (existingNames.has(name.toLowerCase())) {
      count += 1;
      name = `${baseName} ${count}`;
    }

    try {
      const created = await PersistenceService.createEnvironment(activeWorkspaceId, profile.id, name, []);
      await fetchEnvironments(activeWorkspaceId);
      setSelectedEnvironmentId(created.id);
      addToast({ type: 'success', message: `Environment "${name}" created.` });
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to create environment.' });
    } finally {
      creatingRef.current = false;
      setIsCreatingEnvironment(false);
    }
  };

  const handleDeleteEnvironment = async () => {
    if (!selectedEnvironment || !activeWorkspaceId) return;
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmedDeleteEnvironment = async () => {
    if (!selectedEnvironment || !activeWorkspaceId) return;
    try {
      await PersistenceService.deleteEnvironment(selectedEnvironment.id);
      addToast({ type: 'info', message: `Environment "${selectedEnvironment.name}" deleted.` });
      await fetchEnvironments(activeWorkspaceId);
      setSelectedEnvironmentId(null);
    } catch (error) {
      addToast({ type: 'error', message: 'Failed to delete environment.' });
    }
    setIsConfirmDeleteOpen(false);
  };

  if (!tab) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#666666]">
        <p className="text-[11px] font-black uppercase tracking-widest">Environment tab unavailable.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0A0A0A] overflow-hidden">
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmedDeleteEnvironment}
        title="Delete Environment"
        description={`Delete "${selectedEnvironment?.name}" and all its variables? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
      <div className="px-8 py-6 border-b border-[#222222] bg-[#0F0F0F] flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="p-3 bg-[#3ECF8E]/10 rounded-xl">
            <Globe className="text-[#3ECF8E]" size={22} />
          </div>

          {selectedEnvironment ? (
            <div className="min-w-0 flex-1">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="w-full bg-transparent text-xl font-black text-[#E0E0E0] uppercase tracking-tighter outline-none border border-transparent focus:border-[#3ECF8E]/30 rounded-lg px-2 py-1"
              />
              <div className="text-[10px] text-[#555555] font-bold uppercase tracking-widest px-2">
                Inline rename with autosave
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-xl font-black text-[#E0E0E0] uppercase tracking-tighter">Environments</h1>
              <div className="text-[10px] text-[#555555] font-bold uppercase tracking-widest">Select an environment to manage</div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {showSaveButton && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={handleManualSave}
                disabled={isSavingManual}
                className="px-4 py-2 bg-[#3ECF8E] text-[#0A0A0A] rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#34B37A] transition-all"
              >
                {isSavingManual ? <RefreshCcw size={14} className="animate-spin" /> : <Save size={14} />}
                Save Environment
              </motion.button>
            )}
          </AnimatePresence>
          
          <div className="relative">
            <select
              value={selectedEnvironmentId || ''}
              onChange={(e) => setSelectedEnvironmentId(e.target.value || null)}
              className="appearance-none min-w-[220px] bg-[#141414] border border-[#222222] text-[10px] font-black uppercase tracking-widest text-[#AAAAAA] rounded-lg px-3 py-2 pr-8 outline-none focus:border-[#3ECF8E]/40"
            >
              <option value="">Select Environment</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555555] pointer-events-none" />
          </div>

          <button
            onClick={handleCreateEnvironment}
            disabled={isCreatingEnvironment}
            className={cn(
              'px-3 py-2 rounded-lg border border-[#222222] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2',
              isCreatingEnvironment
                ? 'text-[#555555] cursor-not-allowed'
                : 'text-[#3ECF8E] hover:bg-[#3ECF8E]/10'
            )}
          >
            <Plus size={12} />
            {isCreatingEnvironment ? 'Creating...' : 'New'}
          </button>

          <button
            onClick={handleDeleteEnvironment}
            disabled={!selectedEnvironment}
            className={cn(
              'px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2',
              selectedEnvironment
                ? 'border-red-500/40 text-red-500 hover:bg-red-500/10'
                : 'border-[#222222] text-[#444444] cursor-not-allowed'
            )}
          >
            <Trash2 size={12} />
            Delete
          </button>

          {syncStatus === 'saving' ? (
            <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest animate-pulse">
              <RefreshCcw size={12} className="animate-spin" /> Synchronizing
            </div>
          ) : syncStatus === 'error' ? (
            <div className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-widest">
              <Cloud size={12} className="text-red-500" /> Sync Interrupted
            </div>
          ) : syncStatus === 'pending' ? (
            <div className="flex items-center gap-2 text-[10px] font-black text-yellow-500 uppercase tracking-widest">
              <Clock size={12} className="text-yellow-500" /> Changes Staged
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[10px] font-black text-[#3ECF8E] uppercase tracking-widest">
              <Cloud size={12} /> {syncStatus === 'saved' ? 'Sector Synced' : 'Sector Stored'}
            </div>
          )}
        </div>
      </div>

      <div className="px-8 border-b border-[#222222] flex gap-8 bg-[#0F0F0F]">
        {([
          { id: 'Variables', icon: Variable },
          { id: 'Scripts', icon: Code2 },
          { id: 'Documentation', icon: FileText },
        ] as const).map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={cn(
              'flex items-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest relative transition-all',
              activeSection === id ? 'text-[#3ECF8E]' : 'text-[#555555] hover:text-[#AAAAAA]'
            )}
          >
            <Icon size={14} />
            {id}
            {activeSection === id && (
              <motion.div layoutId="environment-section-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3ECF8E]" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        {!selectedEnvironment ? (
          <div className="h-full flex items-center justify-center text-[#555555]">
            <div className="text-center">
              <Globe size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-[11px] font-black uppercase tracking-widest">No environment selected.</p>
              <p className="text-[10px] mt-2">Create one or select an existing environment.</p>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <AnimatePresence mode="wait">
              {activeSection === 'Variables' && (
                <motion.div
                  key="env-variables"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div>
                    <h3 className="text-sm font-black text-[#E0E0E0] uppercase tracking-widest mb-1">Environment Variables</h3>
                    <p className="text-[11px] text-[#555555]">Supports add/edit/delete, bulk edit, initial/current values, and masking for sensitive values.</p>
                  </div>
                  <div className="bg-[#111111] rounded-xl border border-[#222222] p-4">
                    <KVEditor
                      items={selectedEnvironment.variables || []}
                      onChange={(variables) => updateEnvironment(selectedEnvironment.id, { variables })}
                      placeholderKey="VARIABLE_NAME"
                      placeholderValue="CURRENT_VALUE"
                      isVariableEditor={true}
                      allowMasking={true}
                    />
                  </div>
                </motion.div>
              )}

              {activeSection === 'Scripts' && (
                <motion.div
                  key="env-scripts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-[#E0E0E0] uppercase tracking-widest mb-1">Environment Scripts</h3>
                      <p className="text-[11px] text-[#555555]">Scripts run before request execution and after response tests for every request while this environment is active.</p>
                    </div>
                    <button
                      onClick={() => setIsScriptLibraryOpen(true)}
                      className="px-3 py-1.5 rounded-lg border border-[#3ECF8E]/30 bg-[#3ECF8E]/10 hover:bg-[#3ECF8E]/20 text-[9px] font-black text-[#3ECF8E] uppercase tracking-widest flex items-center gap-1.5 transition-all"
                    >
                      <Code2 size={12} />
                      Open Script Library
                    </button>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-[#555555] uppercase tracking-widest">Environment Pre-request Script</label>
                    <div className="border border-[#222222] rounded-xl overflow-hidden bg-[#111111]">
                      <Editor
                        height="240px"
                        language="javascript"
                        theme="vs-dark"
                        value={selectedEnvironment.pre_request_script || ''}
                        onMount={(editor) => {
                          editor.onDidFocusEditorText(() => setActiveScriptTarget('pre_request_script'));
                        }}
                        onChange={(val) => updateEnvironment(selectedEnvironment.id, { pre_request_script: val || '' })}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          fontFamily: 'JetBrains Mono',
                          lineNumbers: 'on',
                          automaticLayout: true,
                          padding: { top: 16 },
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-[#555555] uppercase tracking-widest">Environment Test Script</label>
                    <div className="border border-[#222222] rounded-xl overflow-hidden bg-[#111111]">
                      <Editor
                        height="240px"
                        language="javascript"
                        theme="vs-dark"
                        value={selectedEnvironment.test_script || ''}
                        onMount={(editor) => {
                          editor.onDidFocusEditorText(() => setActiveScriptTarget('test_script'));
                        }}
                        onChange={(val) => updateEnvironment(selectedEnvironment.id, { test_script: val || '' })}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          fontFamily: 'JetBrains Mono',
                          lineNumbers: 'on',
                          automaticLayout: true,
                          padding: { top: 16 },
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeSection === 'Documentation' && (
                <motion.div
                  key="env-docs"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-[#E0E0E0] uppercase tracking-widest mb-1">Environment Documentation</h3>
                      <p className="text-[11px] text-[#555555]">Markdown documentation with live preview support.</p>
                    </div>

                    <div className="flex p-1 bg-[#1A1A1A] rounded-lg border border-[#333333]">
                      <button
                        onClick={() => setDocMode('preview')}
                        className={cn(
                          'px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 transition-all',
                          docMode === 'preview' ? 'bg-[#3ECF8E] text-[#0A0A0A]' : 'text-[#555555] hover:text-[#AAAAAA]'
                        )}
                      >
                        <Eye size={12} />
                        Preview
                      </button>
                      <button
                        onClick={() => setDocMode('edit')}
                        className={cn(
                          'px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 transition-all',
                          docMode === 'edit' ? 'bg-[#3ECF8E] text-[#0A0A0A]' : 'text-[#555555] hover:text-[#AAAAAA]'
                        )}
                      >
                        <PenLine size={12} />
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#111111] rounded-xl border border-[#222222] overflow-hidden min-h-[400px]">
                    {docMode === 'edit' ? (
                      <Editor
                        height="500px"
                        language="markdown"
                        theme="vs-dark"
                        value={selectedEnvironment.documentation || ''}
                        onChange={(val) => updateEnvironment(selectedEnvironment.id, { documentation: val || '' })}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 13,
                          fontFamily: 'JetBrains Mono',
                          lineNumbers: 'on',
                          automaticLayout: true,
                          wordWrap: 'on',
                          padding: { top: 16 },
                        }}
                      />
                    ) : (
                      <div className="p-8 prose prose-invert prose-emerald max-w-none prose-sm">
                        <ReactMarkdown>{selectedEnvironment.documentation || '*No environment documentation yet.*'}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      {selectedEnvironment && (
        <ScriptLibraryModal
          onInsertScript={(script) => {
            const current = selectedEnvironment[activeScriptTarget] || '';
            updateEnvironment(selectedEnvironment.id, {
              [activeScriptTarget]: current + (current ? '\n\n' : '') + script
            });
            addToast({ type: 'success', message: 'Script integrated into environment' });
          }}
        />
      )}
    </div>
  );
};

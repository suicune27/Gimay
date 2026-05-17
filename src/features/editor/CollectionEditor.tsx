import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { KeyValue, Collection } from '../../types';
import { KVEditor } from '../../components/KVEditor';
import { PersistenceService } from '../../services/PersistenceService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Variable, 
  FileText, 
  Code2, 
  Settings, 
  Save, 
  Trash2, 
  Eye, 
  PenLine,
  RefreshCcw,
  Cloud,
  ChevronRight,
  Key,
  Clock
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { AuthEditor } from '../../components/AuthEditor';

interface CollectionEditorProps {
  collectionId: string;
}

export const CollectionEditor: React.FC<CollectionEditorProps> = ({ collectionId }) => {
  const { 
    collections, 
    updateCollection, 
    updateTab,
    canPerformAction,
    syncStatus,
    settings,
    pendingSyncIds,
    syncResource
  } = useStore();

  const collection = collections.find(c => c.id === collectionId);
  const [activeSection, setActiveSection] = useState<'Variables' | 'Authorization' | 'Documentation' | 'Scripts'>('Variables');
  const [docMode, setDocMode] = useState<'edit' | 'preview'>('preview');
  const [isSavingManual, setIsSavingManual] = useState(false);

  const isPending = !!collection && pendingSyncIds.has(collection.id);
  const showSaveButton = !settings.general.autoSave && isPending;

  const handleManualSave = async () => {
    if (!collection) return;
    setIsSavingManual(true);
    await syncResource('collection', collection.id);
    setIsSavingManual(false);
  };

  if (!collection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-dim">
        <Trash2 size={48} className="mb-4 opacity-20" />
        <h2 className="text-xl font-black uppercase tracking-widest">Collection Expired</h2>
        <p className="text-sm">This resource is no longer reachable in this sector.</p>
      </div>
    );
  }

  const canEdit = canPerformAction(collection, 'edit');

  const handleUpdate = (updates: Partial<Collection>) => {
    if (!canEdit) return;
    
    // Optimistic update + Sync (handled by store)
    updateTab(collectionId, updates);
    updateCollection(collectionId, updates);
  };

  return (
    <div className="flex-1 flex flex-col bg-deep overflow-hidden">
      {/* Header Info */}
      <div className="px-8 py-6 border-b border-subtle bg-surface flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand/10 rounded-xl">
             <Variable className="text-brand" size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-black text-main uppercase tracking-tighter">
                {collection.name}
              </h1>
              <div className="px-2 py-0.5 rounded border border-brand/20 bg-brand/5 text-brand text-[8px] font-black uppercase tracking-widest">
                Collection Protocol
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold text-dim uppercase tracking-widest">
              <span>Variables Shared Across Requests</span>
              <ChevronRight size={10} />
              <span>Scripts Evaluated Globally</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <AnimatePresence>
            {showSaveButton && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onClick={handleManualSave}
                disabled={isSavingManual}
                className="px-4 py-2 bg-brand text-[var(--bg-deep)] rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#34B37A] transition-all"
              >
                {isSavingManual ? <RefreshCcw size={14} className="animate-spin" /> : <Save size={14} />}
                Save Collection
              </motion.button>
            )}
          </AnimatePresence>
          
          {syncStatus === 'saving' ? (
            <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest animate-pulse">
              <RefreshCcw size={12} className="animate-spin" />
              Synchronizing
            </div>
          ) : syncStatus === 'error' ? (
            <div className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-widest">
              <Cloud size={12} className="text-red-500" />
              Sync Interrupted
            </div>
          ) : syncStatus === 'pending' ? (
            <div className="flex items-center gap-2 text-[10px] font-black text-yellow-500 uppercase tracking-widest">
              <Clock size={12} className="text-yellow-500" />
              Changes Staged
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[10px] font-black text-brand uppercase tracking-widest">
              <Cloud size={12} />
              {syncStatus === 'saved' ? 'Sector Synced' : 'Sector Stored'}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-8 border-b border-subtle flex gap-8 bg-surface">
        {([
          { id: 'Variables', icon: Variable },
          { id: 'Authorization', icon: Key },
          { id: 'Documentation', icon: FileText },
          { id: 'Scripts', icon: Code2 }
        ] as const).map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id as any)}
            className={cn(
              "flex items-center gap-2 py-4 text-[10px] font-black uppercase tracking-widest relative transition-all",
              activeSection === id ? "text-brand" : "text-dim hover:text-muted"
            )}
          >
            <Icon size={14} />
            {id}
            {activeSection === id && (
              <motion.div 
                layoutId="collection-section-indicator" 
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" 
              />
            )}
          </button>
        ))}
      </div>

      {/* Workspace Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {activeSection === 'Variables' && (
              <motion.div
                key="variables"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-main uppercase tracking-widest mb-1">Collection Variables</h3>
                    <p className="text-[11px] text-dim">Inject these values using &#123;&#123;variable_name&#125;&#125; in any request within this collection.</p>
                  </div>
                </div>
                <div className={cn("bg-surface rounded-xl border border-subtle p-4", !canEdit && "opacity-50 pointer-events-none")}>
                  <KVEditor 
                    items={collection.variables || []} 
                    onChange={(variables) => handleUpdate({ variables })}
                    placeholderKey="VARIABLE_NAME"
                    placeholderValue="CURRENT_VALUE"
                    isVariableEditor={true}
                  />
                </div>
              </motion.div>
            )}

            {activeSection === 'Authorization' && (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-sm font-black text-main uppercase tracking-widest mb-1">Sector Clearances</h3>
                  <p className="text-[11px] text-dim">These credentials will be automatically disseminated to all nested requests using the 'Inherit' protocol.</p>
                </div>
                <div className={cn("bg-surface rounded-xl border border-subtle p-8", !canEdit && "opacity-50 pointer-events-none")}>
                  <AuthEditor 
                    auth={collection.auth} 
                    onChange={(auth) => handleUpdate({ auth })} 
                    hideInherit={true}
                  />
                </div>
              </motion.div>
            )}

            {activeSection === 'Documentation' && (
              <motion.div
                key="documentation"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-main uppercase tracking-widest mb-1">Collection Intelligence</h3>
                    <p className="text-[11px] text-dim">Maintain technical specifications and domain knowledge for this subsystem.</p>
                  </div>
                  {canEdit && (
                    <div className="flex p-1 bg-elevated rounded-lg border border-strong">
                      <button 
                        onClick={() => setDocMode('preview')}
                        className={cn(
                          "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 transition-all",
                          docMode === 'preview' ? "bg-brand text-[var(--bg-deep)]" : "text-dim hover:text-muted"
                        )}
                      >
                        <Eye size={12} />
                        Preview
                      </button>
                      <button 
                        onClick={() => setDocMode('edit')}
                        className={cn(
                          "px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter flex items-center gap-2 transition-all",
                          docMode === 'edit' ? "bg-brand text-[var(--bg-deep)]" : "text-dim hover:text-muted"
                        )}
                      >
                        <PenLine size={12} />
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-surface rounded-xl border border-subtle overflow-hidden min-h-[400px]">
                  {docMode === 'edit' && canEdit ? (
                    <Editor
                      height="500px"
                      language="markdown"
                      theme="vs-dark"
                      value={collection.documentation || ''}
                      onChange={(val) => handleUpdate({ documentation: val || '' })}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: 'JetBrains Mono',
                        lineNumbers: 'on',
                        automaticLayout: true,
                        wordWrap: 'on',
                        padding: { top: 16 }
                      }}
                    />
                  ) : (
                    <div className="p-8 prose prose-invert prose-emerald max-w-none prose-sm">
                      <ReactMarkdown>
                        {collection.documentation || '*No documentation available for this sector.*'}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeSection === 'Scripts' && (
              <motion.div
                key="scripts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-sm font-black text-main uppercase tracking-widest mb-1">Global Interceptors</h3>
                  <p className="text-[11px] text-dim">Scripts defined here run before every request or after every execution in this collection.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-dim uppercase tracking-widest">Global Pre-request Sequence</label>
                  </div>
                  <div className={cn("border border-subtle rounded-xl overflow-hidden bg-surface", !canEdit && "opacity-50 pointer-events-none")}>
                    <Editor
                      height="250px"
                      language="javascript"
                      theme="vs-dark"
                      value={collection.pre_request_script || ''}
                      onChange={(val) => handleUpdate({ pre_request_script: val || '' })}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: 'JetBrains Mono',
                        lineNumbers: 'on',
                        automaticLayout: true,
                        padding: { top: 16 }
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-dim uppercase tracking-widest">Global Post-Execution Tests</label>
                  </div>
                  <div className={cn("border border-subtle rounded-xl overflow-hidden bg-surface", !canEdit && "opacity-50 pointer-events-none")}>
                    <Editor
                      height="250px"
                      language="javascript"
                      theme="vs-dark"
                      value={collection.test_script || ''}
                      onChange={(val) => handleUpdate({ test_script: val || '' })}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: 'JetBrains Mono',
                        lineNumbers: 'on',
                        automaticLayout: true,
                        padding: { top: 16 }
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

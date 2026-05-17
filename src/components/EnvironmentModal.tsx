import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Globe, Plus, Trash2, Save, Download, Upload, Shield, Lock, Search, Code2, BookOpen } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useDataSync } from '../hooks/useDataSync';
import { PersistenceService } from '../services/PersistenceService';
import { KeyValue, Environment } from '../types';
import { KVEditor } from './KVEditor';
import { cn } from '../lib/utils';

interface EnvironmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  environment?: Environment;
  isGlobal?: boolean;
}

export const EnvironmentModal: React.FC<EnvironmentModalProps> = ({ isOpen, onClose, environment, isGlobal = false }) => {
  const { profile, activeWorkspaceId, addToast, updateEnvironment, environments, setEnvironments, globalVariables, setGlobalVariables } = useStore();
  const { fetchEnvironments } = useDataSync();
  
  const [activeTab, setActiveTab] = useState<'variables' | 'scripts' | 'docs'>('variables');
  const [name, setName] = useState(isGlobal ? 'Globals' : (environment?.name || ''));
  const [variables, setVariables] = useState<KeyValue[]>(isGlobal ? globalVariables : (environment?.variables || []));
  const [preRequestScript, setPreRequestScript] = useState(environment?.pre_request_script || '');
  const [testScript, setTestScript] = useState(environment?.test_script || '');
  const [documentation, setDocumentation] = useState(environment?.documentation || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const filteredVariables = useMemo(() => {
    if (!variables) return [];
    if (!searchQuery) return variables;
    const query = searchQuery.toLowerCase();
    return variables.filter(v => 
      (v.key || '').toLowerCase().includes(query) || 
      (v.value || '').toLowerCase().includes(query)
    );
  }, [variables, searchQuery]);

  const handleSave = async () => {
    if (!profile?.id) return;
    if (!isGlobal && (!name.trim() || !activeWorkspaceId)) return;
    
    setIsLoading(true);
    try {
      if (isGlobal) {
        setGlobalVariables(variables);
        addToast({ type: 'success', message: 'Global variables updated.' });
      } else if (environment?.id) {
        await PersistenceService.updateEnvironment(environment.id, { 
          name, 
          variables,
          pre_request_script: preRequestScript,
          test_script: testScript,
          documentation
        });
        updateEnvironment(environment.id, { name, variables });
        addToast({ type: 'success', message: 'Environment updated.' });
      } else {
        const created = await PersistenceService.createEnvironment(activeWorkspaceId!, profile.id, name, variables);
        setEnvironments([created, ...(environments || [])]);
        addToast({ type: 'success', message: `Environment "${name}" created.` });
      }
      onClose();
    } catch (error) {
      console.error('Environment save error:', error);
      addToast({ type: 'error', message: 'Failed to save environment settings.' });
    } finally {
      setIsLoading(false);
    }
  };

  const exportJson = () => {
    const data = {
      name,
      variables,
      exportedAt: new Date().toISOString(),
      type: isGlobal ? 'globals' : 'environment'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase().replace(/\s+/g, '_')}_env.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.variables) {
          setVariables(data.variables);
          if (data.name && !isGlobal) setName(data.name);
          addToast({ type: 'success', message: 'Environment data imported.' });
        }
      } catch (err) {
        addToast({ type: 'error', message: 'Invalid JSON file.' });
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-surface border border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-subtle flex items-center justify-between bg-deep">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center border",
              isGlobal ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-brand/10 border-brand/30 text-brand"
            )}>
              <Globe size={20} />
            </div>
            <div>
              <h2 className="text-[14px] font-black text-main uppercase tracking-widest flex items-center gap-2">
                {isGlobal ? 'Global Variable Registry' : (environment ? 'Configure Environment' : 'Initialize Environment')}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                 <span className="text-[9px] text-dim uppercase tracking-tighter">
                   {isGlobal ? 'Workspace-independent variables' : 'Scope: Active Workspace'}
                 </span>
                 <span className="text-main">|</span>
                 <span className="text-[9px] text-brand font-bold uppercase tracking-tighter">
                   {variables.length} active parameters
                 </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={exportJson} className="p-2 text-dim hover:text-brand transition-all" title="Export Configuration">
              <Download size={18} />
            </button>
            <label className="p-2 text-dim hover:text-brand transition-all cursor-pointer" title="Import Configuration">
              <Upload size={18} />
              <input type="file" className="hidden" accept=".json" onChange={importJson} />
            </label>
            <div className="w-px h-6 bg-[var(--border-subtle)] mx-2" />
            <button onClick={onClose} className="text-dim hover:text-main transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        {!isGlobal && (
          <div className="flex px-6 border-b border-subtle bg-surface">
            {[
              { id: 'variables', icon: Globe, label: 'Variables' },
              { id: 'scripts', icon: Code2, label: 'Execution Scripts' },
              { id: 'docs', icon: BookOpen, label: 'Documentation' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2",
                  activeTab === tab.id 
                    ? "border-brand text-brand bg-brand/5" 
                    : "border-transparent text-dim hover:text-muted"
                )}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {activeTab === 'variables' && (
            <div className="space-y-6">
              {!isGlobal && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-dim uppercase tracking-widest">Environment Designation</label>
                  <input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ENV_NAME (e.g. Production, Staging)..."
                    className="w-full bg-surface border border-subtle px-4 py-3 rounded-lg text-main font-mono text-[11px] focus:outline-none focus:border-brand transition-all"
                  />
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-dim uppercase tracking-widest">Variable Stack</label>
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--border-strong)]" />
                    <input 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search variables..."
                      className="bg-surface border border-subtle pl-8 pr-4 py-1.5 rounded-md text-[10px] text-main focus:outline-none focus:border-brand/30 w-48"
                    />
                  </div>
                </div>
                
                <div className="bg-deep border border-subtle rounded-xl p-2 min-h-[300px]">
                  <KVEditor 
                    items={variables}
                    onChange={setVariables}
                    isVariableEditor={true}
                    allowMasking={true}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scripts' && (
            <div className="space-y-6">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-dim uppercase tracking-widest">Pre-request Script</label>
                      <span className="text-[8px] text-brand font-mono">Run before all requests</span>
                    </div>
                    <textarea 
                      value={preRequestScript}
                      onChange={(e) => setPreRequestScript(e.target.value)}
                      className="w-full h-64 bg-deep border border-subtle rounded-xl p-4 text-[11px] font-mono text-main outline-none focus:border-brand/30 resize-none"
                      placeholder="pm.environment.set('timestamp', Date.now());"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-dim uppercase tracking-widest">Test Script</label>
                      <span className="text-[8px] text-brand font-mono">Run after all responses</span>
                    </div>
                    <textarea 
                      value={testScript}
                      onChange={(e) => setTestScript(e.target.value)}
                      className="w-full h-64 bg-deep border border-subtle rounded-xl p-4 text-[11px] font-mono text-main outline-none focus:border-brand/30 resize-none"
                      placeholder="pm.test('Status is 200', () => pm.response.to.have.status(200));"
                    />
                  </div>
               </div>
               <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                 <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest flex items-center gap-2 mb-2">
                   <Code2 size={14} /> Security Notice
                 </p>
                 <p className="text-[9px] text-muted leading-relaxed">
                   Environment scripts run in a sandboxed runtime. They have access to the <code className="text-amber-500">pm.*</code> API for variable manipulation and testing. Changes made via <code className="text-amber-500">pm.environment.set()</code> only persist during the active session unless committed manually.
                 </p>
               </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div className="space-y-4">
              <label className="text-[9px] font-black text-dim uppercase tracking-widest">Markdown Documentation</label>
              <textarea 
                value={documentation}
                onChange={(e) => setDocumentation(e.target.value)}
                className="w-full h-[400px] bg-deep border border-subtle rounded-xl p-6 text-[12px] text-main outline-none focus:border-brand/30 resize-none leading-relaxed"
                placeholder="# Environment Specifications\n\nUse this space to document security protocols, deployment stages, and variable schemas..."
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-subtle bg-deep flex items-center justify-between">
          <div className="text-[9px] text-[var(--border-strong)] font-mono uppercase tracking-widest">
            {environment?.updated_at ? `Last sync: ${new Date(environment.updated_at).toLocaleString()}` : 'Unsynchronized container'}
          </div>
          <div className="flex gap-3">
            <button
               onClick={onClose}
               className="px-8 py-3 border border-subtle text-dim text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-elevated hover:text-main transition-all"
            >
              Abort
            </button>
            <button
               onClick={handleSave}
               disabled={isLoading || (!isGlobal && !name.trim())}
               className={cn(
                 "px-10 py-3 text-[var(--bg-deep)] text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2",
                 isGlobal ? "bg-amber-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]" : "bg-brand hover:shadow-[0_0_20px_rgba(62,207,142,0.3)]",
                 isLoading && "opacity-50"
               )}
            >
              {isLoading ? 'Synchronizing...' : 'Commit Configuration'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

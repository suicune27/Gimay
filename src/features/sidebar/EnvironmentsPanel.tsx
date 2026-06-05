import React from 'react';
import { Globe, Edit3, Copy, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Environment } from '../../types';
import { PersistenceService } from '../../services/PersistenceService';

interface EnvironmentsPanelProps {
  environments: Environment[];
  activeEnvId: string | null;
  setActiveEnvId: (id: string | null) => void;
  setIsEnvModalOpen: (open: boolean) => void;
  setIsGlobalModalOpen: (open: boolean) => void;
  setSelectedEnv: (env: any) => void;
  profile: any;
  activeWorkspaceId: string | null;
  addToast: (toast: any) => void;
  fetchEnvironments: (workspaceId: string) => Promise<void>;
}

export const EnvironmentsPanel: React.FC<EnvironmentsPanelProps> = ({
  environments,
  activeEnvId,
  setActiveEnvId,
  setIsEnvModalOpen,
  setIsGlobalModalOpen,
  setSelectedEnv,
  profile,
  activeWorkspaceId,
  addToast,
  fetchEnvironments,
}) => {
  return (
    <div className="px-5 space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[#1A1A1E]/30 pb-2">
        <span className="text-[9px] font-black text-[#55555C] uppercase tracking-widest font-mono">Environments</span>
        <div className="flex gap-2">
          <button
            onClick={() => setIsGlobalModalOpen(true)}
            className="text-amber-500/70 text-[8px] font-black uppercase hover:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full transition-all tracking-wider"
          >
            Globals
          </button>
          <button
            onClick={() => { setSelectedEnv(null); setIsEnvModalOpen(true); }}
            className="text-[#3ECF8E] text-[8px] font-black uppercase tracking-wider border border-[#3ECF8E]/30 px-2 py-0.5 rounded-full hover:bg-[#3ECF8E]/10 transition-all"
          >
            + Environment
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {(environments || []).map(env => {
          const isActive = activeEnvId === env.id;
          return (
            <div
              key={env.id}
              onClick={() => setActiveEnvId(isActive ? null : env.id)}
              className={cn(
                "p-3.5 bg-[#0F0F12] border rounded-xl hover:bg-[#121216] transition-all cursor-pointer group/env relative overflow-hidden",
                isActive
                  ? "border-[#3ECF8E] shadow-[0_0_15px_rgba(62,207,142,0.06)]"
                  : "border-[#1A1A22] hover:border-[#22222E]"
              )}
            >
              {isActive && (
                <div className="absolute top-0 right-0 w-8 h-8 bg-[#3ECF8E]/10 rounded-bl-full flex items-center justify-end pr-2 pt-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E] shadow-[0_0_6px_#3ECF8E]" />
                </div>
              )}

              <div className="flex items-center justify-between mb-2 pr-4">
                <div className="text-[10px] font-black text-[#E0E0E6] uppercase tracking-wider font-mono">{env.name}</div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-[8px] text-[#55555C] font-black uppercase tracking-widest font-mono">
                  {env.variables?.length || 0} active variables
                </div>

                <div className="flex items-center gap-1.5 opacity-0 group-hover/env:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEnv(env);
                      setIsEnvModalOpen(true);
                    }}
                    className="p-1 hover:text-[#3ECF8E] text-[#55555C] hover:bg-white/[0.03] rounded transition-all"
                    title="Edit Environment"
                  >
                    <Edit3 size={11} />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!profile?.id || !activeWorkspaceId) return;
                      try {
                        addToast({ type: 'info', message: 'Duplicating registry unit...' });
                        await PersistenceService.createEnvironment(activeWorkspaceId, profile.id, `${env.name} (Copy)`, env.variables || []);
                        await fetchEnvironments(activeWorkspaceId);
                        addToast({ type: 'success', message: `Duplicated environment "${env.name}" successfully.` });
                      } catch {
                        addToast({ type: 'error', message: 'Duplication failed.' });
                      }
                    }}
                    className="p-1 hover:text-[#3ECF8E] text-[#55555C] hover:bg-white/[0.03] rounded transition-all"
                    title="Duplicate Environment"
                  >
                    <Copy size={11} />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await PersistenceService.deleteEnvironment(env.id);
                        if (activeEnvId === env.id) setActiveEnvId(null);
                        await fetchEnvironments(activeWorkspaceId!);
                        addToast({ type: 'info', message: 'Environment purged from registry.' });
                      } catch {
                        addToast({ type: 'error', message: 'Purge failed.' });
                      }
                    }}
                    className="p-1 hover:text-red-500 text-[#55555C] hover:bg-white/[0.03] rounded transition-all"
                    title="Delete Environment"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {(!environments || environments.length === 0) && (
          <div className="text-center py-16 border border-dashed border-[#1A1A22] rounded-2xl bg-[#09090B]/30">
            <Globe size={24} className="mx-auto text-[#1D1D22] mb-3" />
            <p className="text-[9px] font-black text-[#44444F] uppercase tracking-widest">No environments</p>
          </div>
        )}
      </div>
    </div>
  );
};

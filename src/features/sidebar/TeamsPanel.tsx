import React from 'react';
import { Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

interface TeamsPanelProps {
  teams: any[];
  selectedTeam: any;
  setSelectedTeam: (team: any) => void;
  setIsTeamModalOpen: (open: boolean) => void;
}

export const TeamsPanel: React.FC<TeamsPanelProps> = ({
  teams,
  selectedTeam,
  setSelectedTeam,
  setIsTeamModalOpen,
}) => {
  return (
    <div className="px-5 space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[#1A1A1E]/30 pb-2">
        <span className="text-[9px] font-black text-[#55555C] uppercase tracking-widest font-mono">Active Units</span>
        <button
          onClick={() => setIsTeamModalOpen(true)}
          className="text-[#3ECF8E] text-[18px] hover:scale-110 transition-transform leading-none font-bold"
        >
          +
        </button>
      </div>

      <div className="space-y-2">
        {(teams || []).map(team => (
          <div
            key={team.id}
            onClick={() => setSelectedTeam(selectedTeam?.id === team.id ? null : team)}
            className={cn(
              "p-3 border rounded-xl bg-[#0F0F12] text-[10px] font-black uppercase tracking-wider bg-[#0F0F12] hover:bg-[#121216] transition-all cursor-pointer relative",
              selectedTeam?.id === team.id ? "border-[#3ECF8E] shadow-[0_0_12px_rgba(62,207,142,0.05)]" : "border-[#1A1A22]"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[#E0E0E6] font-mono">{team.name}</span>
              <Users size={12} className={selectedTeam?.id === team.id ? "text-[#3ECF8E]" : "text-[#55555C]"} />
            </div>

            <AnimatePresence>
              {selectedTeam?.id === team.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginTop: 8 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="overflow-hidden border-t border-[#1A1A22] pt-2 space-y-2 text-[8px] font-bold text-[#88888F]"
                >
                  <div className="text-[7px] text-[#55555C] uppercase font-black tracking-widest">Channel Node Members:</div>
                  <div className="space-y-1">
                    {(team.team_members || []).map((m: any, mIdx: number) => (
                      <div key={mIdx} className="flex items-center justify-between bg-black/25 p-1 rounded px-2">
                        <span className="truncate pr-4 text-white">{m.profiles?.full_name || m.profiles?.email || 'Active Collaborator'}</span>
                        <span className="text-[7px] text-[#3ECF8E] border border-[#3ECF8E]/20 px-1 rounded uppercase tracking-tighter shrink-0">{m.role || 'Member'}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {(!teams || teams.length === 0) && (
          <div className="text-center py-12 border border-dashed border-[#1A1A22] rounded-2xl bg-[#09090B]/30">
            <Users size={24} className="mx-auto text-[#1D1D22] mb-3" />
            <p className="text-[9px] font-black text-[#44444F] uppercase tracking-widest">No active team segments</p>
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { motion } from 'motion/react';
import {
  LayoutGrid, Globe, Zap, Activity, Clock, Users, Settings, LogOut as LogOutIcon, Sparkles as SparklesIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { id: 'collections', icon: 'LayoutGrid', label: 'Collections', desc: 'Collection Tree' },
  { id: 'environments', icon: 'Globe', label: 'Environments', desc: 'API Environments' },
  { id: 'scripts', icon: 'Zap', label: 'Scripts', desc: 'Logic Library' },
  { id: 'smoke', icon: 'Activity', label: 'Smoke Testing', desc: 'Bulk Runner' },
  { id: 'history', icon: 'Clock', label: 'Logs', desc: 'Realtime Traffic' },
  { id: 'teams', icon: 'Users', label: 'Teams', desc: 'Collaborators' }
];

const NAV_ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  collections: LayoutGrid,
  environments: Globe,
  scripts: Zap,
  smoke: Activity,
  history: Clock,
  teams: Users,
};

interface SidebarNavBarProps {
  activeNav: string;
  setActiveNav: (nav: string) => void;
  setIsHoverExpanded: (expanded: boolean) => void;
  isExpanded: boolean;
  activeWorkspaceId: string | null;
  profile: any;
  logout: () => void;
  addTab: (tab: any) => void;
  setIsSettingsModalOpen: (open: boolean) => void;
  handleMouseEnterNav: () => void;
}

export const SidebarNavBar: React.FC<SidebarNavBarProps> = ({
  activeNav,
  setActiveNav,
  setIsHoverExpanded,
  isExpanded,
  activeWorkspaceId,
  profile,
  logout,
  addTab,
  setIsSettingsModalOpen,
  handleMouseEnterNav
}) => {
  return (
    <div
      onMouseEnter={handleMouseEnterNav}
      className="w-[50px] h-full bg-[#09090B] border-r border-[#151518] flex flex-col items-center py-4 justify-between select-none shrink-0"
    >
      <div className="flex flex-col items-center gap-3 w-full">
        <div className="w-8 h-8 rounded-lg bg-[var(--brand-muted)] flex items-center justify-center border border-[var(--brand-border)] mb-3 select-none">
          <SparklesIcon size={14} className="text-[var(--brand)] animate-pulse" />
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = NAV_ICON_MAP[item.id];
          const isActive = activeNav === item.id;
          return (
            <div key={item.id} className="relative group/nav-btn w-full flex justify-center">
              <button
                onClick={() => {
                  if (item.id === 'smoke') {
                    addTab({
                      id: 'tab-smoke-testing',
                      type: 'smoke-testing',
                      name: 'Smoke Testing Suite',
                      workspace_id: activeWorkspaceId || undefined
                    } as any);
                    return;
                  }
                  setActiveNav(item.id);
                  setIsHoverExpanded(true);
                }}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 relative group/btn",
                  isActive
                    ? "bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/20 shadow-[0_0_12px_rgba(62,207,142,0.1)]"
                    : "text-[#55555C] hover:text-[#E0E0E6] hover:bg-white/[0.02]"
                )}
              >
                {Icon && <Icon size={16} className="group-hover/btn:scale-105 transition-transform duration-200" />}
                {isActive && (
                  <motion.div
                    layoutId="active-nav-bullet"
                    className="absolute left-0 w-[3px] h-5 bg-[#3ECF8E] rounded-r-md top-1/2 -translate-y-1/2 shadow-[0_0_8px_#3ECF8E]"
                  />
                )}
              </button>

              {!isExpanded && (
                <div className="absolute left-[54px] top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#0F0F12] border border-[#1D1D22] text-[9px] font-black uppercase tracking-widest text-[#E0E0E6] rounded-md opacity-0 group-hover/nav-btn:opacity-100 translate-x-2 group-hover/nav-btn:translate-x-0 transition-all duration-200 pointer-events-none z-[100] whitespace-nowrap shadow-[8px_0_24px_rgba(0,0,0,0.8)] border-l-2 border-l-[#3ECF8E]">
                  <div className="font-bold">{item.label}</div>
                  <div className="text-[7px] text-[#55555C] font-mono mt-0.5">{item.desc}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3 w-full">
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#55555C] hover:text-[#E0E0E6] hover:bg-white/[0.02] transition-all duration-200"
          title="System Configuration"
        >
          <Settings size={15} />
        </button>

        <div className="w-8 h-8 rounded-full bg-[#1A1A1E] border border-[#26262B] flex items-center justify-center text-[10px] font-black text-[#88888F] uppercase cursor-pointer hover:border-[#3ECF8E]/40 hover:text-white transition-all duration-300 relative group/avatar">
          {profile?.full_name?.substring(0, 2) || 'U'}
          <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#3ECF8E] border-2 border-[#09090B] shadow-[0_0_5px_#3ECF8E]" />

          <div className="absolute left-full pl-2 bottom-0 hidden group-hover/avatar:flex flex-col w-48 z-[100] animate-in fade-in duration-200">
            <div className="bg-[#0F0F12] border border-[#1D1D22] rounded-xl shadow-2xl p-3 flex flex-col w-full backdrop-blur-xl">
              <div className="text-[9px] font-bold text-white uppercase tracking-wider truncate">{profile?.full_name || 'Protocol User'}</div>
              <div className="text-[8px] text-[#55555C] font-mono truncate mt-0.5">{profile?.email}</div>
              <div className="h-px bg-[#1D1D22] my-2" />
              <button
                onClick={() => logout()}
                className="w-full py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
              >
                <LogOutIcon size={10} /> Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

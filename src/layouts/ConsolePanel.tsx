import React from 'react';
import { motion } from 'motion/react';
import { Terminal } from 'lucide-react';

interface ConsolePanelProps {
  isOpen: boolean;
  onClose: () => void;
  profile: { email?: string } | null;
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: 180 }}
      exit={{ height: 0 }}
      className="border-t border-[#111111] bg-[#050505] overflow-hidden flex flex-col"
    >
      <div className="h-7 border-b border-[#1A1A1A] flex items-center justify-between px-3 bg-[#0A0A0A] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[8px] font-black text-[#666666] uppercase tracking-[0.3em] flex items-center gap-2">
            <Terminal size={10} className="text-[#3ECF8E]" />
            Protocol System Core
          </span>
          <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-[#3ECF8E] animate-pulse" />
            <div className="w-1 h-1 rounded-full bg-[#3ECF8E] opacity-10" />
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[7px] font-black text-[#555555] hover:text-[#3ECF8E] uppercase transition-colors tracking-[0.2em] px-2 py-0.5 rounded hover:bg-white/[0.03]"
        >
          Disconnect Terminal
        </button>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[9px] text-[#888888] divide-y divide-white/[0.02] custom-scrollbar bg-black/60">
        <div className="flex gap-4 px-4 py-1.5 hover:bg-white/[0.01] transition-colors">
          <span className="text-[#222222] shrink-0 font-medium tabular-nums border-r border-white/[0.02] pr-3 min-w-[70px] text-center">{new Date().toLocaleTimeString()}</span>
          <span className="text-[#3ECF8E] font-bold shrink-0">[KERN]</span>
          <span className="opacity-70 leading-normal">Uplink established; kernel version 2.4.0 active.</span>
        </div>
        <div className="flex gap-4 px-4 py-1.5 hover:bg-white/[0.01] transition-colors">
          <span className="text-[#222222] shrink-0 font-medium tabular-nums border-r border-white/[0.02] pr-3 min-w-[70px] text-center">{new Date().toLocaleTimeString()}</span>
          <span className="text-[#3ECF8E] font-bold shrink-0">[AUTH]</span>
          <span className="opacity-70 leading-normal">Handshake success: Node identity {profile?.email} validated.</span>
        </div>
        <div className="flex gap-4 px-4 py-1.5 hover:bg-white/[0.01] transition-colors text-yellow-500/60">
          <span className="text-[#222222] shrink-0 font-medium tabular-nums border-r border-white/[0.02] pr-3 min-w-[70px] text-center">{new Date().toLocaleTimeString()}</span>
          <span className="font-bold shrink-0">[SYNC]</span>
          <span className="leading-normal">Real-time delta channel initializing... heartbeat listening on sector 7.</span>
        </div>
        <div className="flex gap-4 px-4 py-1.5 hover:bg-white/[0.01] transition-colors text-[#3ECF8E]">
          <span className="text-[#222222] shrink-0 font-medium tabular-nums border-r border-white/[0.02] pr-3 min-w-[70px] text-center">{new Date().toLocaleTimeString()}</span>
          <span className="font-bold shrink-0">[SUCCESS]</span>
          <span className="font-medium leading-normal tracking-tight">System ready for packet routing.</span>
        </div>
      </div>
    </motion.div>
  );
};

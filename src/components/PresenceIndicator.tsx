import React from 'react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface PresenceData {
  id: string;
  name: string;
  activeTabId: string | null;
  online_at: string;
}

export const PresenceIndicator: React.FC<{ requestId?: string; className?: string }> = ({ requestId, className }) => {
  const { memberPresence, profile } = useStore();
  
  const others = Object.values(memberPresence as Record<string, PresenceData>).filter(p => p.id !== profile?.id);
  const activeHere = requestId ? others.filter(p => p.activeTabId === requestId) : others;

  if (activeHere.length === 0) return null;

  return (
    <div className={cn("flex -space-x-2 overflow-hidden", className)}>
      <AnimatePresence>
        {activeHere.slice(0, 5).map((person, _idx) => (
          <motion.div
            key={person.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="relative group"
          >
            <div 
              className="w-6 h-6 rounded-full border-2 border-[var(--bg-surface)] bg-[var(--bg-elevated)] flex items-center justify-center text-[8px] font-black uppercase ring-2 ring-[var(--brand)]/20"
              style={{ borderColor: 'var(--bg-surface)' }}
            >
              {person.name?.[0] || '?'}
            </div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded text-[8px] font-black uppercase tracking-widest text-[var(--text-main)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {person.name}
              {requestId && <span className="ml-1 text-[var(--brand)]">Editing</span>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {activeHere.length > 5 && (
        <div className="w-6 h-6 rounded-full border-2 border-[var(--bg-surface)] bg-[var(--bg-elevated)] flex items-center justify-center text-[8px] font-black text-[var(--text-dim)]">
          +{activeHere.length - 5}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface NameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  title: string;
  placeholder?: string;
  initialValue?: string;
}

export const NameModal: React.FC<NameModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  placeholder = "ENTER_NAME...",
  initialValue = ""
}) => {
  const [name, setName] = useState(initialValue);

  useEffect(() => {
    if (isOpen) setName(initialValue);
  }, [isOpen, initialValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-md bg-surface border border-subtle rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[11px] font-black text-brand uppercase tracking-[0.3em]">{title}</h2>
              <button 
                onClick={onClose}
                className="text-dim hover:text-main transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative group">
                <input 
                  autoFocus
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-deep border border-subtle rounded-xl py-3 px-4 text-xs font-mono text-main outline-none focus:border-brand/50 transition-all placeholder:text-main"
                />
              </div>

              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-transparent border border-subtle rounded-xl text-[10px] font-black text-dim hover:text-muted hover:border-strong transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!name.trim()}
                  className="flex-1 py-3 bg-brand rounded-xl text-[10px] font-black text-[var(--bg-deep)] hover:bg-[#34B37A] transition-all uppercase tracking-widest flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm <Check size={14} />
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

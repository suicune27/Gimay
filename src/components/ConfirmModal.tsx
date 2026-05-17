import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  preview?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  preview,
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter') handleConfirm();
  };

  if (!isOpen) return null;

  const iconColor =
    variant === 'danger' ? 'text-red-500' : variant === 'warning' ? 'text-yellow-500' : 'text-brand';
  const bgColor =
    variant === 'danger' ? 'bg-red-500/10' : variant === 'warning' ? 'bg-yellow-500/10' : 'bg-brand/10';
  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-600 text-main shadow-[0_0_20px_rgba(239,68,68,0.15)]'
      : variant === 'warning'
        ? 'bg-yellow-500 hover:bg-yellow-600 text-[var(--bg-deep)] shadow-[0_0_20px_rgba(234,179,8,0.15)]'
        : 'bg-brand hover:bg-[#34B37A] text-[var(--bg-deep)] shadow-[0_0_20px_rgba(62,207,142,0.15)]';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="relative w-full max-w-md bg-surface border border-subtle rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 flex items-start gap-4">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', bgColor)}>
            {variant === 'danger' ? (
              <Trash2 size={18} className={iconColor} />
            ) : (
              <AlertTriangle size={18} className={iconColor} />
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-[13px] font-black text-main uppercase tracking-widest leading-tight">{title}</h3>
            {description && (
              <p className="mt-1.5 text-[11px] text-muted leading-relaxed">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 text-dim hover:text-main transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Optional preview */}
        {preview && (
          <div className="mx-5 mb-4 p-3 bg-deep border border-subtle rounded-xl text-[10px] font-mono text-muted">
            {preview}
          </div>
        )}

        {/* Actions */}
        <div className="px-5 pb-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-subtle bg-deep hover:bg-elevated text-[10px] font-black text-muted uppercase tracking-widest transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={cn(
              'px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
              confirmBtnClass
            )}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

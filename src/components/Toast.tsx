import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useStore();

  return (
    <div className="fixed bottom-12 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem: React.FC<{ toast: any; onRemove: () => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(onRemove, 5000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const icons = {
    success: <CheckCircle2 size={16} className="text-[#3ECF8E]" />,
    error: <AlertCircle size={16} className="text-red-500" />,
    info: <Info size={16} className="text-blue-400" />,
    warning: <AlertTriangle size={16} className="text-yellow-500" />,
  };

  const borders = {
    success: 'border-[#3ECF8E]/20',
    error: 'border-red-500/20',
    info: 'border-blue-400/20',
    warning: 'border-yellow-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.9 }}
      layout
      className={cn(
        "pointer-events-auto flex items-center gap-4 px-4 py-3 bg-[#0F0F0F] border rounded-xl shadow-2xl min-w-[300px] max-w-sm",
        borders[toast.type as keyof typeof borders]
      )}
    >
      <div className="flex-shrink-0">
        {icons[toast.type as keyof typeof icons]}
      </div>
      <div className="flex-1 text-[11px] font-medium text-white/90">
        {toast.message}
      </div>
      <button 
        onClick={onRemove}
        className="text-[#444444] hover:text-white transition-colors"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};

import React, { useEffect, useState } from 'react';
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
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    const timer = setTimeout(onRemove, 5000);
    return () => clearTimeout(timer);
  }, [onRemove, isHovered]);

  const icons = {
    success: <CheckCircle2 size={16} className="text-brand" />,
    error: <AlertCircle size={16} className="text-red-500" />,
    info: <Info size={16} className="text-blue-400" />,
    warning: <AlertTriangle size={16} className="text-yellow-500" />,
  };

  const borders = {
    success: 'border-brand/20 hover:border-brand/30',
    error: 'border-red-500/20 hover:border-red-500/30',
    info: 'border-blue-400/20 hover:border-blue-400/30',
    warning: 'border-yellow-500/20 hover:border-yellow-500/30',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.9 }}
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onRemove}
      className={cn(
        "pointer-events-auto cursor-pointer flex items-center gap-4 px-4 py-3 bg-surface border rounded-xl shadow-2xl min-w-[300px] max-w-sm hover:bg-[#121212] active:scale-[0.98] transition-all select-none group",
        borders[toast.type as keyof typeof borders]
      )}
    >
      <div className="flex-shrink-0">
        {icons[toast.type as keyof typeof icons]}
      </div>
      <div className="flex-1 text-[11px] font-medium text-main/90 leading-normal">
        {toast.message}
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="text-dim group-hover:text-main hover:text-main transition-colors p-1 rounded-md hover:bg-white/5"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};

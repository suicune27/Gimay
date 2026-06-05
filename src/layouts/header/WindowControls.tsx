import React from 'react';
import { Plus } from 'lucide-react';

interface WindowControlsProps {
  isElectron: boolean;
  consoleCollapsed: boolean;
  onToggleConsole: () => void;
  layoutOrientation: string;
  onToggleOrientation: (orientation: string) => void;
  onClose: () => void;
}

export const WindowControls: React.FC<WindowControlsProps> = ({
  isElectron,
  consoleCollapsed,
  onToggleConsole,
  layoutOrientation,
  onToggleOrientation,
  onClose,
}) => {
  return (
    <div className="flex items-center gap-1 ml-1 titlebar-no-drag">
      <button
        onClick={() => {
          if (isElectron) {
            (window as any).electron?.minimize();
          } else {
            onToggleConsole();
          }
        }}
        className="p-1.5 rounded-lg hover:bg-white/5 text-[#55555C] hover:text-[var(--brand)] transition-all flex items-center justify-center border border-transparent hover:border-[var(--border-subtle)]"
        title={isElectron ? "Minimize Window" : "Toggle Terminal Simulation"}
      >
        <span className="w-2.5 h-[2px] bg-current rounded-full" />
      </button>
      <button
        onClick={() => {
          if (isElectron) {
            (window as any).electron?.maximize();
          } else {
            const newOrientation = layoutOrientation === 'vertical' ? 'horizontal' : 'vertical';
            onToggleOrientation(newOrientation);
          }
        }}
        className="p-1.5 rounded-lg hover:bg-white/5 text-[#55555C] hover:text-blue-400 transition-all flex items-center justify-center border border-transparent hover:border-[var(--border-subtle)]"
        title={isElectron ? "Maximize Window" : "Rotate UI Orientation Grid"}
      >
        <span className="w-2 h-2 border-2 border-current rounded-xs" />
      </button>
      <button
        onClick={onClose}
        className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#55555C] hover:text-red-500 transition-all flex items-center justify-center border border-transparent hover:border-red-500/20"
        title="Terminate Secure Session (Close)"
      >
        <Plus className="rotate-45" size={14} />
      </button>
    </div>
  );
};

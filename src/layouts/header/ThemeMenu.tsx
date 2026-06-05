import React from 'react';
import { Sun, Moon, Laptop, Palette, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AppSettings, Profile } from '../../types';
import { PersistenceService } from '../../services/PersistenceService';

interface ThemeMenuProps {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  activeAccent: string;
  onAccentChange: (accent: string) => void;
  profile: Profile | null;
}

const ACCENTS = [
  { id: 'emerald', color: '#3ECF8E', label: 'Emerald' },
  { id: 'sapphire', color: '#3B82F6', label: 'Sapphire' },
  { id: 'ruby', color: '#EF4444', label: 'Ruby' },
  { id: 'amber', color: '#F59E0B', label: 'Amber' },
  { id: 'amethyst', color: '#8B5CF6', label: 'Amethyst' },
];

const THEMES = [
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'system', label: 'System', icon: Laptop },
];

export const ThemeMenu: React.FC<ThemeMenuProps> = ({
  settings,
  updateSettings,
  activeAccent,
  onAccentChange,
  profile,
}) => {
  const handleThemeChange = (themeId: string) => {
    updateSettings({ appearance: { ...settings.appearance, theme: themeId as any } });
    if (profile) {
      PersistenceService.updateProfilePreferences(profile.id, {
        ...profile.preferences,
        theme: themeId as any
      });
    }
  };

  return (
    <div className="w-56 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-4 space-y-4">
      <div className="border-b border-[var(--border-subtle)] pb-2">
        <h3 className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Base Theme</h3>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {THEMES.map((t) => {
          const Icon = t.icon;
          const isActive = settings.appearance.theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleThemeChange(t.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all text-[8px] font-black uppercase tracking-widest",
                isActive
                  ? "bg-[var(--brand)]/10 border-[var(--brand)] text-[var(--brand)] shadow-[0_0_10px_var(--brand-muted)]"
                  : "bg-[var(--bg-deep)] border-[var(--border-subtle)] text-[#55555C] hover:border-[#333333] hover:text-white"
              )}
            >
              <Icon size={12} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="border-b border-[var(--border-subtle)] pt-1 pb-2">
        <h3 className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Accent Core</h3>
      </div>

      <div className="flex items-center justify-between px-1">
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              onAccentChange(a.id);
              localStorage.setItem('gmy_theme_accent', a.id);
            }}
            className={cn(
              "w-6 h-6 rounded-full border transition-all flex items-center justify-center relative",
              activeAccent === a.id
                ? "border-white scale-110 shadow-lg"
                : "border-transparent hover:scale-105"
            )}
            style={{ backgroundColor: a.color }}
            title={a.label}
          >
            {activeAccent === a.id && (
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

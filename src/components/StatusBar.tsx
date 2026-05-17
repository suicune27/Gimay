import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  PanelLeftOpen,
  Layout, 
  Shield, 
  Globe, 
  Settings, 
  RefreshCcw, 
  Clock, 
  Save, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export const StatusBar: React.FC = () => {
  const { 
    syncStatus, 
    syncMetadata, 
    settings, 
    activeWorkspaceId, 
    workspaces,
    layoutOrientation,
    sidebarMode,
    sidebarWidth,
    setSidebarMode,
    setLayoutOrientation
  } = useStore();
  const [time, setTime] = useState(new Date());

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!settings.appearance.showStatusBar) return null;

  return (
    <div className="h-7 bg-surface border-t border-subtle flex items-center justify-between px-3 text-[9px] font-black uppercase tracking-[0.15em] z-[100]">
      {/* Left Section: Context */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-muted">
          <Globe size={10} />
          <span>{activeWorkspace?.name || 'Local'}</span>
        </div>
        
        <div className="h-3 w-px bg-[var(--border-subtle)]" />
        
        <div className="flex items-center gap-1.5 text-muted">
          <Shield size={10} className="text-brand" />
          <span>SSL: Secure</span>
        </div>

        <div className="h-3 w-px bg-[var(--border-subtle)]" />
        
        <div className="flex items-center gap-1.5 text-muted">
          <Settings size={10} />
          <span>Proxy: Off</span>
        </div>
      </div>

      {/* Center Section: Sync Status */}
      <div className="flex items-center gap-4 absolute left-1/2 -translate-x-1/2">
        <div className={cn(
          "flex items-center gap-1.5 transition-all",
          syncStatus === 'saving' ? "text-blue-400 animate-pulse" :
          syncStatus === 'saved' ? "text-brand" :
          syncStatus === 'pending' ? "text-yellow-500" :
          syncStatus === 'error' ? "text-red-500" :
          syncMetadata.isOffline ? "text-red-400" :
          "text-dim"
        )}>
          {syncStatus === 'saving' && <RefreshCcw size={10} className="animate-spin" />}
          {syncStatus === 'saved' && <CheckCircle2 size={10} />}
          {syncStatus === 'pending' && <Clock size={10} />}
          {syncStatus === 'error' && <AlertCircle size={10} />}
          {syncMetadata.isOffline && <WifiOff size={10} />}
          
          <span>
            {syncMetadata.isOffline ? 'Offline Mode' : 
             syncStatus === 'saving' ? 'Synchronizing' :
             syncStatus === 'saved' ? 'Cloud Synced' :
             syncStatus === 'pending' ? 'Changes Staged' :
             syncStatus === 'error' ? 'Sync Interrupted' : 'System Ready'}
          </span>
        </div>

        {syncMetadata.lastSynced && (
          <div className="text-[8px] text-dim lowercase normal-case flex items-center gap-1">
            <Save size={9} />
            <span>last sync: {format(syncMetadata.lastSynced, 'HH:mm:ss')}</span>
          </div>
        )}
      </div>

      {/* Right Section: Time & Connectivity */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-muted">
          {syncMetadata.isOffline ? <WifiOff size={10} className="text-red-400" /> : <Wifi size={10} className="text-brand" />}
          <span>{syncMetadata.isOffline ? 'Disconnected' : 'Authenticated'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setSidebarMode(sidebarMode === 'hidden' ? 'expanded' : 'hidden')}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 transition-colors rounded hover:bg-elevated",
              sidebarMode !== 'hidden' ? "text-brand" : "text-dim"
            )}
            title="Toggle Sidebar (Ctrl+B)"
          >
            <PanelLeftOpen size={10} />
            {sidebarMode === 'hidden' && <span className="text-[8px]">Show Sidebar</span>}
          </button>
          <button 
            onClick={() => setLayoutOrientation(layoutOrientation === 'vertical' ? 'horizontal' : 'vertical')}
            className="flex items-center gap-1.5 px-2 py-0.5 text-dim hover:text-brand hover:bg-elevated transition-colors rounded"
            title="Toggle Layout Orientation"
          >
            <Layout size={10} className={cn(layoutOrientation === 'horizontal' ? "rotate-90" : "")} />
          </button>
        </div>

        <div className="h-3 w-px bg-[var(--border-subtle)]" />
        
        <div className="flex items-center gap-1.5 text-main tabular-nums">
          <Clock size={10} />
          <span>{format(time, 'HH:mm:ss')}</span>
        </div>
      </div>
    </div>
  );
};

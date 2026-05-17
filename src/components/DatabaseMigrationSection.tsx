import React, { useState } from 'react';
import { Database, Shield, Zap, AlertTriangle, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { DatabaseMigrationService } from '../services/DatabaseMigrationService';
import { useOnboardingStore } from '../store/onboardingStore';
import { refreshSupabaseClient } from '../lib/supabase';
import { cn } from '../lib/utils';

export const DatabaseMigrationSection: React.FC = () => {
  const { addToast } = useStore();
  const { setSupabaseConfig } = useOnboardingStore();
  
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleMigration = async () => {
    if (!url || !anonKey || !serviceKey) {
      addToast({ type: 'error', message: 'All connection details are required.' });
      return;
    }
    
    if (!url.startsWith('http')) {
      addToast({ type: 'error', message: 'Invalid Supabase URL format.' });
      return;
    }

    if (confirm('WARNING: This will extract your current workspace data and inject it into the target database. Are you sure you want to proceed?')) {
      setIsMigrating(true);
      setIsSuccess(false);
      setProgress(0);
      setStatusText('Initializing Migration Pipeline...');
      
      try {
        await DatabaseMigrationService.executeMigration({
          newSupabaseUrl: url,
          newAnonKey: anonKey,
          newServiceKey: serviceKey,
          onProgress: (step, percent) => {
            setStatusText(step);
            setProgress(percent);
          }
        });
        
        // 5. Update local configuration to permanently point to the new DB
        setSupabaseConfig(url, anonKey, serviceKey);
        refreshSupabaseClient();
        
        setIsSuccess(true);
        setStatusText('Migration Complete & Database Swapped!');
        addToast({ type: 'success', message: 'Successfully migrated to new database.' });
        
        setTimeout(() => {
          window.location.reload(); // Force full reload to refresh Zustand caches on the new DB
        }, 2000);
        
      } catch (err: any) {
        setStatusText(`Migration Failed: ${err.message}`);
        setProgress(0);
        setIsMigrating(false);
        addToast({ type: 'error', message: err.message || 'Migration failed.' });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-elevated border border-brand/30 rounded-xl p-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-brand/5 pointer-events-none" />
        
        <div className="flex items-start gap-4 relative z-10">
          <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand shrink-0">
            <Database size={20} />
          </div>
          
          <div>
            <h3 className="text-sm font-black text-main uppercase tracking-widest">BYOD Migration Engine</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Export all data from your current active workspace and automatically deploy it to your own self-hosted or dedicated Supabase instance.
            </p>
          </div>
        </div>
        
        <div className="mt-6 space-y-4 relative z-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-dim uppercase tracking-wider flex items-center gap-2">
              <GlobeIcon /> Target Supabase URL
            </label>
            <input 
              type="text" 
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://your-project.supabase.co" 
              className="w-full bg-deep border border-subtle rounded-lg px-4 py-2 text-xs text-main outline-none focus:border-brand transition-colors font-mono"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-dim uppercase tracking-wider flex items-center gap-2">
              <Zap size={12} /> Target Anon Key
            </label>
            <input 
              type="password" 
              value={anonKey}
              onChange={e => setAnonKey(e.target.value)}
              placeholder="eyJh..." 
              className="w-full bg-deep border border-subtle rounded-lg px-4 py-2 text-xs text-main outline-none focus:border-brand transition-colors font-mono"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-dim uppercase tracking-wider flex items-center gap-2">
              <Shield size={12} /> Target Service Role Key
            </label>
            <div className="relative">
              <input 
                type="password" 
                value={serviceKey}
                onChange={e => setServiceKey(e.target.value)}
                placeholder="eyJh..." 
                className="w-full bg-deep border border-subtle rounded-lg px-4 py-2 text-xs text-main outline-none focus:border-brand transition-colors font-mono"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[9px] text-amber-500 font-bold uppercase tracking-widest">
                <AlertTriangle size={10} /> Requires Bypass
              </div>
            </div>
            <p className="text-[9px] text-dim font-mono mt-1">The Service Role Key is required to bypass RLS during data injection.</p>
          </div>
        </div>

        {/* Progress Display */}
        {(isMigrating || isSuccess) && (
          <div className="mt-6 bg-deep border border-subtle rounded-lg p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-brand/5" />
            <div 
              className="absolute left-0 top-0 bottom-0 bg-brand/20 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
            <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-2">
              {isSuccess ? (
                <CheckCircle2 size={24} className="text-brand mb-1" />
              ) : (
                <Loader2 size={24} className="text-brand animate-spin mb-1" />
              )}
              <div className="text-xs font-mono font-bold text-brand uppercase tracking-widest">
                {statusText}
              </div>
              <div className="text-[10px] font-black text-muted tabular-nums">
                {progress}%
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end relative z-10">
          <button 
            onClick={handleMigration}
            disabled={isMigrating || isSuccess || !url || !anonKey || !serviceKey}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all",
              isMigrating || isSuccess || !url || !anonKey || !serviceKey
                ? "bg-subtle text-muted cursor-not-allowed"
                : "bg-brand text-[var(--bg-deep)] hover:brightness-110"
            )}
          >
            {isMigrating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Migrating...
              </>
            ) : (
              <>
                Initiate Migration <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const GlobeIcon = () => <Database size={12} />;

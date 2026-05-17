import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Copy, 
  Download, 
  Search, 
  Terminal,
  Activity,
  Clock,
  Database,
  Eye,
  FileCode,
  Layout
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import '../../themes/prism-putman.css';

export const ResponseViewer: React.FC = () => {
  const { lastResponse, isSending } = useStore();
  const [activeView, setActiveView] = useState<'pretty' | 'raw' | 'headers' | 'tests'>('pretty');

  if (isSending) {
    return <LoadingState />;
  }

  if (!lastResponse) {
    return <EmptyResponseState />;
  }

  const isSuccess = lastResponse.status >= 200 && lastResponse.status < 300;

  return (
    <div className="h-full flex flex-col bg-deep border-l border-subtle">
      {/* Response Metrics */}
      <div className="h-14 border-b border-subtle flex items-center px-6 justify-between bg-elevated">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isSuccess ? "bg-brand" : "bg-red-500"
            )} />
            <span className={cn(
              "text-[11px] font-black uppercase tracking-widest",
              isSuccess ? "text-brand" : "text-red-500"
            )}>
              {lastResponse.status} {lastResponse.statusText}
            </span>
          </div>
          <div className="flex items-center gap-2 text-dim">
            <Clock size={12} />
            <span className="text-[10px] font-mono">{lastResponse.time}ms</span>
          </div>
          <div className="flex items-center gap-2 text-dim">
            <Database size={12} />
            <span className="text-[10px] font-mono">{(lastResponse.size / 1024).toFixed(2)} KB</span>
          </div>
        </div>

        <div className="flex gap-1 bg-deep p-1 rounded-lg border border-subtle">
          {[
            { id: 'pretty', icon: Eye, label: 'PRETTY' },
            { id: 'raw', icon: FileCode, label: 'RAW' },
            { id: 'headers', icon: Layout, label: 'HEADERS' },
            { id: 'tests', icon: Terminal, label: 'TESTS' }
          ].map(view => (
            <button 
              key={view.id}
              onClick={() => setActiveView(view.id as any)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                activeView === view.id 
                  ? "bg-brand text-[var(--bg-deep)]" 
                  : "text-dim hover:text-muted"
              )}
            >
              <view.icon size={12} />
              <span className="hidden xl:inline">{view.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Response Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeView === 'pretty' && (
            <div className="font-mono text-xs text-muted">
              <Editor
                value={JSON.stringify(lastResponse.body, null, 2)}
                onValueChange={() => {}}
                highlight={(code) => highlight(code, languages.json, 'json')}
                padding={10}
                className="prism-editor bg-deep"
                readOnly
              />
            </div>
          )}

          {activeView === 'headers' && (
            <div className="space-y-2">
              {Object.entries(lastResponse.headers).map(([key, value]) => (
                <div key={key} className="flex border-b border-subtle py-2 group">
                  <span className="w-48 text-[10px] font-black text-dim uppercase tracking-wider">{key}</span>
                  <span className="flex-1 text-[11px] font-mono text-muted break-all">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="h-10 border-t border-subtle bg-surface px-4 flex items-center justify-between">
           <div className="text-[9px] font-mono text-[var(--border-strong)] uppercase">
             {lastResponse.contentType}
           </div>
           <div className="flex gap-4">
             <button className="text-dim hover:text-brand transition-all flex items-center gap-2">
               <Copy size={12} /> <span className="text-[9px] font-black uppercase tracking-widest">Copy Body</span>
             </button>
             <button className="text-dim hover:text-brand transition-all flex items-center gap-2">
               <Download size={12} /> <span className="text-[9px] font-black uppercase tracking-widest">Download</span>
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const LoadingState = () => (
  <div className="h-full flex flex-col items-center justify-center bg-deep">
    <div className="relative">
      <div className="w-16 h-16 border-2 border-brand/20 rounded-full" />
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-0 w-16 h-16 border-t-2 border-brand rounded-full"
      />
    </div>
    <p className="mt-8 text-[11px] font-black text-brand uppercase tracking-[0.3em] animate-pulse">
      Intercepting Payload...
    </p>
  </div>
);

const EmptyResponseState = () => (
  <div className="h-full flex flex-col items-center justify-center bg-deep p-12 text-center">
    <Activity size={48} className="text-[var(--bg-elevated)] mb-4" />
    <h3 className="text-[11px] font-black text-[var(--border-strong)] uppercase tracking-widest mb-2">No Passive Data</h3>
    <p className="text-[10px] text-main uppercase tracking-tighter max-w-xs">
      Execute a protocol to view real-time transmission analytics and payload extraction.
    </p>
  </div>
);

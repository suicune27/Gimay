import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Copy, 
  Download, 
  Search, 
  Terminal,
  Activity,
  Clock,
  Database,
  Layout,
  Sparkles,
  Eye,
  FileCode
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import '../../themes/prism-gimay.css';

export const ResponseViewer: React.FC = () => {
  const { lastResponse, isSending, addToast } = useStore();
  const [activeView, setActiveView] = useState<'pretty' | 'raw' | 'headers' | 'tests'>('pretty');
  const [shouldBeautify, setShouldBeautify] = useState(true);

  if (isSending) {
    return <LoadingState />;
  }

  if (!lastResponse) {
    return <EmptyResponseState />;
  }

  const getFormattedBody = () => {
    if (!lastResponse || !lastResponse.body) return '';
    const bodyStr = typeof lastResponse.body === 'object' 
      ? JSON.stringify(lastResponse.body, null, 2)
      : lastResponse.body;
      
    if (!shouldBeautify) {
      return bodyStr;
    }
    
    try {
      const parsed = typeof lastResponse.body === 'string' ? JSON.parse(lastResponse.body) : lastResponse.body;
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return bodyStr;
    }
  };

  const isSuccess = lastResponse.status >= 200 && lastResponse.status < 300;

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A] border-l border-[#222222]">
      {/* Response Metrics */}
      <div className="h-14 border-b border-[#222222] flex items-center px-6 justify-between bg-[#141414]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isSuccess ? "bg-[#3ECF8E]" : "bg-red-500"
            )} />
            <span className={cn(
              "text-[11px] font-black uppercase tracking-widest",
              isSuccess ? "text-[#3ECF8E]" : "text-red-500"
            )}>
              {lastResponse.status} {lastResponse.statusText}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#555555]">
            <Clock size={12} />
            <span className="text-[10px] font-mono">{lastResponse.time}ms</span>
          </div>
          <div className="flex items-center gap-2 text-[#555555]">
            <Database size={12} />
            <span className="text-[10px] font-mono">{(lastResponse.size / 1024).toFixed(2)} KB</span>
          </div>
        </div>

        <div className="flex gap-1 bg-[#0A0A0A] p-1 rounded-lg border border-[#222222]">
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
                  ? "bg-[#3ECF8E] text-[#0A0A0A]" 
                  : "text-[#444444] hover:text-[#AAAAAA]"
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
            <div className="font-mono text-xs text-[#AAAAAA]">
              <Editor
                value={getFormattedBody()}
                onValueChange={() => {}}
                highlight={(code) => highlight(code, languages.json, 'json')}
                padding={10}
                className="prism-editor bg-[#0A0A0A]"
                readOnly
              />
            </div>
          )}

          {activeView === 'raw' && (
            <div className="font-mono text-xs text-[#AAAAAA] whitespace-pre-wrap break-all bg-[#0A0A0A] p-4 rounded-xl border border-white/[0.03]">
              {typeof lastResponse.body === 'object' ? JSON.stringify(lastResponse.body) : lastResponse.body}
            </div>
          )}

          {activeView === 'headers' && (
            <div className="space-y-2">
              {Object.entries(lastResponse.headers).map(([key, value]) => (
                <div key={key} className="flex border-b border-[#222222] py-2 group">
                  <span className="w-48 text-[10px] font-black text-[#555555] uppercase tracking-wider">{key}</span>
                  <span className="flex-1 text-[11px] font-mono text-[#AAAAAA] break-all">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="h-10 border-t border-[#222222] bg-[#0F0F0F] px-4 flex items-center justify-between">
           <div className="text-[9px] font-mono text-[#333333] uppercase flex items-center gap-4">
             <span>{lastResponse.contentType}</span>
             {activeView === 'pretty' && (
               <button 
                 onClick={() => {
                   try {
                     const bodyStr = typeof lastResponse.body === 'object' 
                       ? JSON.stringify(lastResponse.body) 
                       : lastResponse.body;
                     JSON.parse(bodyStr);
                     setShouldBeautify(!shouldBeautify);
                     addToast({ 
                       type: 'success', 
                       message: shouldBeautify ? 'Beautifier disabled.' : 'Beautifier enabled.' 
                     });
                   } catch (e) {
                     addToast({ 
                       type: 'error', 
                       message: 'Response payload is not valid JSON.' 
                     });
                   }
                 }}
                 className={cn(
                   "px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm",
                   shouldBeautify 
                     ? "bg-[#3ECF8E]/20 text-[#3ECF8E] border-[#3ECF8E]/40" 
                     : "border-[#222222] text-[#555555] hover:border-[#444444]"
                 )}
               >
                 <Sparkles size={10} />
                 <span>Beautify</span>
               </button>
             )}
           </div>
           <div className="flex gap-4">
             <button className="text-[#444444] hover:text-[#3ECF8E] transition-all flex items-center gap-2">
               <Copy size={12} /> <span className="text-[9px] font-black uppercase tracking-widest">Copy Body</span>
             </button>
             <button className="text-[#444444] hover:text-[#3ECF8E] transition-all flex items-center gap-2">
               <Download size={12} /> <span className="text-[9px] font-black uppercase tracking-widest">Download</span>
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const LoadingState = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-[#0A0A0A] overflow-hidden select-none">
      <div className="relative w-40 h-40 flex items-center justify-center">
        {/* Outer Ring 1: Glowing Emerald dashed */}
        <div className="absolute inset-0 rounded-full border border-dashed border-[#3ECF8E]/40 animate-[spin_8s_linear_infinite]" />
        
        {/* Outer Ring 2: Electric Blue gradient line */}
        <div className="absolute inset-4 rounded-full border-2 border-transparent border-t-[#3ECF8E] border-b-blue-500 animate-[spin_3s_linear_infinite]" />
        
        {/* Ring 3: Deep blue pulse */}
        <div className="absolute inset-8 rounded-full border border-blue-400/20 animate-ping opacity-60" />
        
        {/* Center Orb: Glassmorphic sphere with glowing radial background */}
        <div className="absolute inset-12 rounded-full bg-gradient-to-tr from-[#3ECF8E]/20 to-blue-500/20 backdrop-blur-md border border-white/[0.08] shadow-[0_0_24px_rgba(62,207,142,0.3)] flex items-center justify-center">
          <Activity size={28} className="text-[#3ECF8E] animate-pulse" />
        </div>

        {/* Orbiting data packets */}
        <div className="absolute w-2 h-2 bg-[#3ECF8E] rounded-full shadow-[0_0_8px_#3ECF8E] animate-[orbit_2.5s_linear_infinite]" />
        <div className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_6px_#60A5FA] animate-[orbit_2.5s_linear_infinite_1.25s]" />
      </div>

      <div className="text-center mt-8 space-y-2 z-10">
        <h3 className="text-xs font-black text-white uppercase tracking-[0.3em] animate-pulse">
          Transmitting Packet
        </h3>
        <p className="text-[8px] text-[var(--text-dim)] uppercase tracking-widest font-mono">
          Model execution active • payload resolving
        </p>
      </div>

      <style>{`
        @keyframes orbit {
          0% { transform: rotate(0deg) translateX(70px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(70px) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
};

const EmptyResponseState = () => (
  <div className="h-full flex flex-col items-center justify-center bg-[#0A0A0A] p-12 text-center">
    <Activity size={48} className="text-[#141414] mb-4" />
    <h3 className="text-[11px] font-black text-[#333333] uppercase tracking-widest mb-2">No Passive Data</h3>
    <p className="text-[10px] text-[#222222] uppercase tracking-tighter max-w-xs">
      Execute a protocol to view real-time transmission analytics and payload extraction.
    </p>
  </div>
);

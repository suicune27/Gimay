import React from 'react';
import { motion } from 'motion/react';
import { 
  Zap, 
  Terminal, 
  Database, 
  Users, 
  Globe, 
  Download, 
  Play,
  Github,
  Monitor,
  Code2,
  Layers,
  WifiOff,
  FileJson
} from 'lucide-react';
import { toast } from 'sonner';
import { SampleSmokeTester } from './SampleSmokeTester';

interface LandingPageProps {
  onStart: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  const handleDownload = (platform: string) => {
    toast.info(`Preparing ${platform} download...`, {
      description: "Gimay Desktop will start downloading in a few seconds.",
      duration: 5000,
    });
  };

  return (
    <div className="fixed inset-0 bg-deep text-white overflow-y-auto overflow-x-hidden font-sans selection:bg-[var(--brand)]/30 custom-scrollbar">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/[0.03]">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-[var(--brand)] flex items-center justify-center shadow-[0_0_15px_rgba(var(--brand-rgb),0.3)]">
              <Terminal size={14} className="text-black" />
            </div>
            <span className="font-black text-[10px] tracking-widest uppercase italic">Gimay <span className="opacity-40 italic ml-1 font-medium">Node v1.0.0</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-[9px] font-black uppercase tracking-[0.2em] text-dim">
            <a href="#features" className="hover:text-[var(--brand)] transition-colors">Protocols</a>
            <a href="#teams" className="hover:text-[var(--brand)] transition-colors">Sector Sync</a>
            <a href="#download" className="hover:text-[var(--brand)] transition-colors">Uplink</a>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={onStart}
              className="px-3 py-1 text-[8px] font-black uppercase tracking-widest text-muted hover:text-white transition-all transform hover:scale-105"
            >
              Link Node
            </button>
            <button 
              onClick={onStart}
              className="px-4 py-1.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] shadow-[0_0_20px_rgba(var(--brand-rgb),0.2)] rounded text-[9px] font-black text-black uppercase tracking-widest transition-all active:scale-95"
            >
              Establish Socket
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6">
        {/* Technical Grid Overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--brand)]/5 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2" />
        
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-[var(--brand)]/20 bg-[var(--brand)]/5 mb-6"
          >
            <div className="w-1 h-1 rounded-full bg-[var(--brand)] animate-pulse" />
            <span className="text-[7px] font-black uppercase tracking-[0.3em] text-[var(--brand)]/80">System Status: Optimal</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-7xl font-black mb-6 leading-tight tracking-tighter"
          >
            Tactical API <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand)] to-blue-400">
              Command Suite.
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm md:text-base text-muted max-w-xl mb-10 leading-relaxed font-medium"
          >
            The high-performance workspace for elite engineering teams. 
            Scriptable, isolated, and built on a zero-trust architecture.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            id="download"
            className="scroll-mt-20 flex flex-wrap items-center justify-center gap-3"
          >
            <button 
              onClick={onStart}
              className="px-8 py-3 bg-[var(--brand)] text-black rounded font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(var(--brand-rgb),0.2)]"
            >
              <Terminal size={14} />
              Boot Environment
            </button>
            <a 
              href="https://github.com/suicune27/Gimay/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3 bg-[var(--brand)]/10 border border-[var(--brand)]/30 hover:bg-[var(--brand)]/25 rounded font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-2 transition-all cursor-pointer text-[var(--brand)] hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_15px_rgba(var(--brand-rgb),0.1)]"
            >
              <Download size={14} />
              Pull Desktop
            </a>
          </motion.div>

          {/* Live Interactive Smoke Tester Sandbox Showpiece */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-20 relative w-full max-w-4xl"
          >
            <SampleSmokeTester />
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 border-y border-white/[0.02] bg-white/[0.01]">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-4">
            <div className="max-w-md">
              <h2 className="text-2xl md:text-4xl font-black mb-4 tracking-tight">Deployment Protocols.</h2>
              <p className="text-dim text-xs font-black uppercase tracking-[0.4em]">Integrated Subsystems</p>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/5 to-transparent mx-8 hidden md:block" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1">
            {[
              {
                icon: <Zap size={18} className="text-[var(--brand)]" />,
                title: "Command Engine",
                desc: "High-frequency API request runner supporting param auto-sync, inline renaming, and bulk headers."
              },
              {
                icon: <Code2 size={18} className="text-blue-400" />,
                title: "Script Logic",
                desc: "Advanced JavaScript runtime supporting pre-request hooks, test assertions, and completions."
              },
              {
                id: "teams",
                icon: <Users size={18} className="text-purple-400" />,
                title: "Sector Sync",
                desc: "Real-time state synchronization across distributed networks with role-based permissions."
              },
              {
                icon: <Layers size={18} className="text-emerald-400" />,
                title: "Workspace Isolation",
                desc: "Clean workspace separation with hierarchical collection logic and custom environment scoping."
              },
              {
                icon: <Database size={18} className="text-orange-400" />,
                title: "Namespace Variables",
                desc: "Dynamic environment parameters and variables with {{variable}} hover preview and inline edit."
              },
              {
                icon: <WifiOff size={18} className="text-pink-400" />,
                title: "Offline Sandbox",
                desc: "Complete isolated offline runtime enabling authenticated entry and mock workspace generation."
              },
              {
                icon: <FileJson size={18} className="text-yellow-400" />,
                title: "Portability Importer",
                desc: "Auto-detects and normalizes API definitions from Postman, Insomnia, and API Dog with reviews."
              },
              {
                icon: <Globe size={18} className="text-cyan-400" />,
                title: "Routing & Tunnels",
                desc: "Strict SSL verification, OS Native proxy auto-detection, custom PAC scripts, and client certs."
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                id={feature.id}
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                className="scroll-mt-24 p-6 border border-white/[0.03] bg-black/20 group transition-all"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-8 h-8 rounded bg-white/[0.03] flex items-center justify-center group-hover:bg-[var(--brand)]/10 transition-colors border border-white/[0.05]">
                    {feature.icon}
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">{feature.title}</h3>
                </div>
                <p className="text-muted leading-relaxed text-[11px] font-medium">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 bg-black">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-[var(--brand)] flex items-center justify-center">
              <Terminal size={12} className="text-black" />
            </div>
            <span className="font-black text-[9px] tracking-widest uppercase italic">Gimay Tech</span>
          </div>
          
          <div className="flex gap-8 text-[8px] font-black uppercase tracking-[0.3em] text-dim">
            <a href="#" className="hover:text-[var(--brand)] transition-colors">Documentation</a>
            <a href="#" className="hover:text-[var(--brand)] transition-colors">Changelog</a>
            <a href="#" className="hover:text-[var(--brand)] transition-colors">Privacy</a>
          </div>

          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-dim">
            © 2026 Core Protocol
          </p>
        </div>
      </footer>
    </div>
  );
}

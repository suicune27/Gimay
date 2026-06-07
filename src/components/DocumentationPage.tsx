import React from 'react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import { Terminal, ArrowLeft, Book, Github } from 'lucide-react';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { readmeContent } from '../content/docs';

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match?.[1] || 'code';
  const code = String(children).replace(/\n$/, '');

  // For inline code, just render a <code> tag
  if (!match && !className) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[var(--brand)] text-[11px] font-mono">
        {children}
      </code>
    );
  }

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-white/[0.05]">
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/[0.03] border-b border-white/[0.05]">
        <span className="text-[8px] font-black uppercase tracking-wider text-dim font-mono">{lang}</span>
      </div>
      <pre className="m-0 p-4 text-[11px] font-mono leading-relaxed text-[#abb2bf] bg-[#0A0A0C] overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const markdownComponents: Components = {
  code({ className, children }) {
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
  h1({ children }) {
    return <h1 className="text-2xl md:text-3xl font-black text-white mb-6 mt-10 tracking-tight">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-lg md:text-xl font-black text-white mb-4 mt-8 tracking-tight border-b border-white/[0.05] pb-2">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm font-black text-white/90 mb-3 mt-6 tracking-tight flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] shrink-0" />
      {children}
    </h3>;
  },
  p({ children }) {
    return <p className="text-[13px] text-[var(--text-muted)] leading-relaxed mb-4">{children}</p>;
  },
  ul({ children }) {
    return <ul className="space-y-2 mb-4">{children}</ul>;
  },
  li({ children }) {
    return <li className="text-[13px] text-[var(--text-muted)] leading-relaxed flex items-start gap-2">
      <span className="text-[var(--brand)] mt-1 shrink-0">›</span>
      <span>{children}</span>
    </li>;
  },
  strong({ children }) {
    return <strong className="text-white font-bold">{children}</strong>;
  },
  hr() {
    return <hr className="border-white/[0.05] my-8" />;
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-4 rounded-lg border border-white/[0.05]">
        <table className="w-full text-[12px]">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-white/[0.03]">{children}</thead>;
  },
  th({ children }) {
    return <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-wider text-dim border-b border-white/[0.05]">{children}</th>;
  },
  td({ children }) {
    return <td className="px-4 py-2.5 text-[var(--text-muted)] border-b border-white/[0.03]">{children}</td>;
  },
  tr({ children }) {
    return <tr className="hover:bg-white/[0.01]">{children}</tr>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-[var(--brand)]/40 pl-4 py-2 my-4 bg-white/[0.02] rounded-r-lg text-[13px] text-[var(--text-muted)] italic">
        {children}
      </blockquote>
    );
  },
  a({ children, href }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] hover:underline font-medium">
        {children}
      </a>
    );
  },
};

interface DocumentationPageProps {
  onBack: () => void;
}

export function DocumentationPage({ onBack }: DocumentationPageProps) {
  return (
    <div className="fixed inset-0 bg-deep text-white overflow-y-auto overflow-x-hidden font-sans selection:bg-[var(--brand)]/30 custom-scrollbar">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none" />
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[var(--brand)]/5 rounded-full blur-[120px] -z-10 -translate-x-1/3 -translate-y-1/3" />

      <nav className="relative z-50 bg-black/60 backdrop-blur-xl border-b border-white/[0.03]">
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-[var(--brand)] flex items-center justify-center shadow-[0_0_15px_rgba(var(--brand-rgb),0.3)]">
              <Terminal size={14} className="text-black" />
            </div>
            <span className="font-black text-[10px] tracking-widest uppercase italic">Gimay <span className="opacity-40 italic ml-1 font-medium">Docs</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="flex items-center gap-2 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-dim hover:text-white border border-transparent hover:border-[var(--border-subtle)] rounded transition-all">
              <ArrowLeft size={12} />
              Back to Home
            </button>
            <a href="https://github.com/suicune27/Gimay" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest bg-[var(--brand)]/10 border border-[var(--brand)]/20 hover:bg-[var(--brand)]/20 text-[var(--brand)] rounded transition-all">
              <Github size={12} />
              Repository
            </a>
          </div>
        </div>
      </nav>

      <section className="relative pt-16 pb-8 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-[var(--brand)]/20 bg-[var(--brand)]/5 mb-6">
            <Book size={10} className="text-[var(--brand)]" />
            <span className="text-[7px] font-black uppercase tracking-[0.3em] text-[var(--brand)]/80">Protocol Documentation</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl md:text-5xl font-black mb-4 leading-tight tracking-tighter">
            System <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand)] to-blue-400">Documentation.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-sm text-muted max-w-xl leading-relaxed">
            Complete reference for the Gimay API Command Suite. Covers architecture, features, self-hosting, development workflows, and security principles.
          </motion.p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <Markdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
            {readmeContent}
          </Markdown>
        </div>
      </section>

      <footer className="py-12 px-6 bg-black border-t border-white/[0.02]">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-[var(--brand)] flex items-center justify-center">
              <Terminal size={12} className="text-black" />
            </div>
            <span className="font-black text-[9px] tracking-widest uppercase italic">Gimay Tech</span>
          </div>
          <div className="flex gap-6 text-[8px] font-black uppercase tracking-[0.3em] text-dim">
            <button onClick={onBack} className="hover:text-[var(--brand)] transition-colors cursor-pointer">Home</button>
            <a href="https://github.com/suicune27/Gimay" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--brand)] transition-colors">Repository</a>
            <a href="https://github.com/suicune27/Gimay/releases" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--brand)] transition-colors">Releases</a>
          </div>
          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-dim">© 2026 Core Protocol</p>
        </div>
      </footer>
    </div>
  );
}

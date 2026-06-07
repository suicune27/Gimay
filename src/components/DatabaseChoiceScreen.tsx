import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Cloud,
  Database,
  Terminal,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  ArrowLeft,
  Shield,
  Users,
  Infinity,
  Zap,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { SQLScriptGenerator } from '../lib/SQLScriptGenerator';

interface DatabaseChoiceScreenProps {
  onUseGimayCloud: () => void;
  onUseOwnDatabase: () => void;
}

export const DatabaseChoiceScreen: React.FC<DatabaseChoiceScreenProps> = ({
  onUseGimayCloud,
  onUseOwnDatabase,
}) => {
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  if (showSetupGuide) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center bg-deep overflow-hidden p-4 font-sans selection:bg-[var(--brand)]/20">
        {/* Ambient background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--brand)]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-[var(--bg-surface)]/90 border border-white/[0.04] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.8)] p-8 backdrop-blur-xl z-10 max-h-[90vh] overflow-y-auto"
        >
          {/* Top Glow Boundary */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--brand)]/20 to-transparent pointer-events-none" />

          {/* Back button */}
          <button
            type="button"
            onClick={() => setShowSetupGuide(false)}
            className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-all mb-6 cursor-pointer"
          >
            <ArrowLeft size={12} />
            Back to Database Selection
          </button>

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-11 h-11 bg-amber-500 rounded-xl shadow-[0_0_30px_rgba(251,191,36,0.15)] flex items-center justify-center">
              <Database size={22} className="text-black stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">
                Self-hosted <span className="text-amber-500">Supabase</span>
              </h1>
              <p className="text-[8px] text-zinc-500 font-mono uppercase tracking-[0.25em] font-black mt-1">
                BRING YOUR OWN DATABASE — UNLIMITED TEAM MEMBERS
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Step 1 */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand)]/10 border border-[var(--brand)]/20 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-black text-[var(--brand)]">1</span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Create a Free Supabase Project</h3>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    Start by creating an account and project on Supabase's platform.
                  </p>
                </div>
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--brand)]/10 hover:bg-[var(--brand)]/20 border border-[var(--brand)]/20 text-[var(--brand)] text-[8px] font-black uppercase tracking-widest transition-all shrink-0"
                >
                  Visit supabase.com <ExternalLink size={10} />
                </a>
              </div>
              <div className="pl-11 space-y-1.5">
                <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">→</span>
                  Sign up at <strong className="text-zinc-200">supabase.com</strong> (free tier is perfectly sufficient)
                </p>
                <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">→</span>
                  Create a <strong className="text-zinc-200">new organization</strong> and project — choose a region close to you
                </p>
                <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">→</span>
                  Wait ~2 minutes for database provisioning to complete
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-black text-blue-400">2</span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Get Your API Credentials</h3>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    Copy your project's URL and anonymous API key from the dashboard.
                  </p>
                </div>
                <a
                  href="https://supabase.com/dashboard/project/_/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[8px] font-black uppercase tracking-widest transition-all shrink-0"
                >
                  Open Settings <ExternalLink size={10} />
                </a>
              </div>
              <div className="pl-11 space-y-1.5">
                <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">→</span>
                  Go to <strong className="text-zinc-200">Project Settings → API</strong> in your Supabase dashboard
                </p>
                <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">→</span>
                  Copy your <strong className="text-[var(--brand)]">Project URL</strong> (looks like <code className="text-[9px] bg-black/60 px-1.5 py-0.5 rounded font-mono">https://xxxxx.supabase.co</code>)
                </p>
                <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">→</span>
                  Copy the <strong className="text-[var(--brand)]">anon public</strong> key (starts with <code className="text-[9px] bg-black/60 px-1.5 py-0.5 rounded font-mono">eyJ...</code>)
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-black text-purple-400">3</span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Initialize the Database Schema</h3>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    Run the SQL script in Supabase's SQL Editor to create all required tables.
                  </p>
                </div>
              </div>
              <div className="pl-11 space-y-3">
                <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">→</span>
                  Go to <strong className="text-zinc-200">SQL Editor</strong> in your Supabase dashboard
                </p>
                <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">→</span>
                  Click <strong className="text-zinc-200">New Query</strong> and paste the initialization script below
                </p>

                {/* SQL Script Box */}
                <div className="bg-black/60 border border-white/[0.05] rounded-xl overflow-hidden mt-2">
                  <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.05] flex items-center justify-between">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 font-mono">gimay-init.sql</span>
                    <button
                      type="button"
                      onClick={() => {
                        const script = SQLScriptGenerator.generateInitializationScript();
                        navigator.clipboard.writeText(script);
                        setSqlCopied(true);
                        setTimeout(() => setSqlCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/[0.05] text-zinc-500 hover:text-zinc-300 transition-all text-[8px] font-black uppercase tracking-widest cursor-pointer"
                    >
                      {sqlCopied ? <Check size={10} className="text-[var(--brand)]" /> : <Copy size={10} />}
                      {sqlCopied ? 'Copied!' : 'Copy SQL'}
                    </button>
                  </div>
                  <pre className="p-4 text-[9px] font-mono text-zinc-400 leading-relaxed overflow-x-auto max-h-[200px] overflow-y-auto">
{`-- Tables: profiles, teams, team_members,
--         workspaces, collections, environments
-- Including RLS policies for multi-tenant access

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text, full_name text, username text,
  avatar_url text, preferences jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null, description text,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  team_code text unique not null,
  secret_code_hash text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ... (see full script in clipboard)`}
                  </pre>
                </div>

                <p className="text-[8px] text-zinc-600 flex items-center gap-1.5">
                  <BookOpen size={10} />
                  Full SQL script copied to clipboard. Paste into SQL Editor and click <strong className="text-zinc-400">Run</strong>.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand)]/10 border border-[var(--brand)]/20 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-black text-[var(--brand)]">4</span>
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">Sign In &amp; Configure in Gimay</h3>
                  <p className="text-[9px] text-zinc-500 mt-0.5">
                    Sign in to Gimay and enter your Supabase credentials during onboarding.
                  </p>
                </div>
              </div>
              <div className="pl-11 space-y-1.5">
                <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">→</span>
                  Click <strong className="text-zinc-200">Continue to Sign In</strong> below
                </p>
                <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">→</span>
                  Create your Gimay account or sign in with your email
                </p>
                <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">→</span>
                  During onboarding, choose <strong className="text-amber-500">"Bring Your Own Database"</strong> and paste your Supabase URL + anon key
                </p>
                <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
                  <span className="text-[var(--brand)] mt-0.5">✓</span>
                  <strong className="text-[var(--brand)]">Done!</strong> Your team now has <strong className="text-white">unlimited members</strong> on your own infrastructure
                </p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-8 border-t border-white/[0.04]" />

          {/* CTA */}
          <motion.button
            type="button"
            onClick={onUseOwnDatabase}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black text-[9px] uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 cursor-pointer active:scale-[0.98]"
          >
            <Sparkles size={14} className="stroke-[2.5]" />
            <span>Continue to Sign In</span>
            <ChevronRight size={14} className="stroke-[2.5]" />
          </motion.button>

          <p className="text-[7px] text-zinc-600 text-center mt-3 font-mono uppercase tracking-wider">
            Make sure your Supabase project is provisioned before proceeding.
          </p>
        </motion.div>
      </div>
    );
  }

  // ====== CHOICE SCREEN ======
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-deep overflow-hidden p-4 font-sans selection:bg-[var(--brand)]/20">
      {/* Ambient background glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--brand)]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Technical grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-lg bg-[var(--bg-surface)]/90 border border-white/[0.04] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.8)] p-8 backdrop-blur-xl z-10 flex flex-col overflow-hidden"
      >
        {/* Top Glow Boundary */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--brand)]/20 to-transparent pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-11 h-11 bg-[var(--brand)] rounded-xl shadow-[0_0_30px_rgba(var(--brand-rgb),0.15)] flex items-center justify-center transition-all hover:scale-105">
            <Terminal size={22} className="text-[var(--bg-deep)] stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none flex items-center gap-1.5">
              Gimay <span className="text-[9px] py-0.5 px-1.5 rounded-full border border-[var(--brand)]/25 text-[var(--brand)] font-mono tracking-widest font-black bg-[var(--brand)]/5">CORE</span>
            </h1>
            <p className="text-[8px] text-zinc-500 font-mono uppercase tracking-[0.25em] font-black mt-1">DATABASE BACKEND SELECTION</p>
          </div>
        </div>

        <p className="text-[10px] text-zinc-500 leading-relaxed mb-6 font-medium">
          Choose where your team's data will be stored. You can change this later.
        </p>

        {/* Gimay Cloud Card */}
        <motion.button
          type="button"
          onClick={onUseGimayCloud}
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          className="w-full p-5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-[var(--brand)]/30 text-left transition-all group cursor-pointer mb-4"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--brand)]/10 border border-[var(--brand)]/20 flex items-center justify-center shrink-0 group-hover:bg-[var(--brand)]/15 group-hover:border-[var(--brand)]/30 transition-all">
              <Cloud size={24} className="text-[var(--brand)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Gimay Cloud</h3>
                <span className="text-[7px] py-0.5 px-1.5 rounded-full bg-[var(--brand)]/10 text-[var(--brand)] border border-[var(--brand)]/20 font-black uppercase tracking-widest">
                  Managed
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Free managed database hosted by Gimay. Get started instantly — no setup required.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-[8px] text-zinc-500">
                  <Zap size={10} className="text-[var(--brand)]" />
                  <span>Instant setup</span>
                </div>
                <div className="flex items-center gap-1.5 text-[8px] text-zinc-500">
                  <Users size={10} className="text-amber-500" />
                  <span>Max 3 members / team</span>
                </div>
              </div>
            </div>
            <ChevronRight size={16} className="text-zinc-600 group-hover:text-[var(--brand)] transition-all mt-2 shrink-0" />
          </div>
        </motion.button>

        {/* Self-hosted Supabase Card */}
        <motion.button
          type="button"
          onClick={() => setShowSetupGuide(true)}
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          className="w-full p-5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-amber-500/30 text-left transition-all group cursor-pointer"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:bg-amber-500/15 group-hover:border-amber-500/30 transition-all">
              <Database size={24} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Self-hosted Supabase</h3>
                <span className="text-[7px] py-0.5 px-1.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-black uppercase tracking-widest">
                  Unlimited
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Bring your own Supabase project. Full control over your data and scale.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-[8px] text-zinc-500">
                  <Shield size={10} className="text-amber-500" />
                  <span>Full data control</span>
                </div>
                <div className="flex items-center gap-1.5 text-[8px] text-zinc-500">
                  <Infinity size={10} className="text-amber-500" />
                  <span>Unlimited members</span>
                </div>
              </div>
            </div>
            <ChevronRight size={16} className="text-zinc-600 group-hover:text-amber-500 transition-all mt-2 shrink-0" />
          </div>
        </motion.button>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/[0.04] text-center">
          <p className="text-[7px] text-zinc-600 font-mono uppercase tracking-[0.2em]">
            You can switch your database backend at any time from settings.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

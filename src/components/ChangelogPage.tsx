import React from 'react';
import { motion } from 'motion/react';
import { Terminal, GitCommit, ArrowLeft, ExternalLink, Calendar, GitFork, Github } from 'lucide-react';

interface ChangelogEntry {
  hash: string;
  date: string;
  author: string;
  message: string;
}

const commits: ChangelogEntry[] = [
  { hash: "b6ee54a", date: "2026-06-07", author: "suicune27", message: "feat: SEO optimization — Google verification, OG image, sitemap, robots.txt" },
  { hash: "2479b9f", date: "2026-06-07", author: "suicune27", message: "feat: Gimay app icon — SVG source, multi-res ICO, PNG, favicon" },
  { hash: "744d2b2", date: "2026-06-07", author: "suicune27", message: "feat: Gimay app icon — SVG source, multi-res ICO, PNG, favicon" },
  { hash: "5eacab0", date: "2026-06-07", author: "SUICUNE", message: "Merge pull request #1 from suicune27/1.0.2" },
  { hash: "dadff8e", date: "2026-06-07", author: "suicune27", message: "chore: remove database selection, always use Gimay Cloud global env" },
  { hash: "fb6b4d7", date: "2026-06-07", author: "suicune27", message: "feat: database choice screen, AuthUI selector, sandbox auto-persist, desktop login fixes" },
  { hash: "cec4bc0", date: "2026-06-06", author: "suicune27", message: "Step 1: First refresh complete — observing DexieError" },
  { hash: "ac17286", date: "2026-06-06", author: "SUICUNE", message: "feat(smoke-suite): stabilize runner and env scripts" },
  { hash: "cf42f74", date: "2026-06-06", author: "suicune27", message: "chore(recovery): restore local workspace changes after git corruption" },
  { hash: "e090e40", date: "2026-06-05", author: "suicune27", message: "On main: backup before pull" },
  { hash: "01019d7", date: "2026-06-05", author: "suicune27", message: "index on main" },
  { hash: "5306418", date: "2026-06-05", author: "suicune27", message: "untracked files on main" },
  { hash: "aaa4bb3", date: "2026-06-05", author: "Gieremy Aron M. Romay", message: "fix linting issues including large files" },
  { hash: "49f17d1", date: "2026-06-05", author: "SUICUNE", message: "feat: improve offline mode and database resilience" },
  { hash: "8792143", date: "2026-05-20", author: "SUICUNE", message: "feat: Enhance API proxy and script execution safety" },
  { hash: "740387b", date: "2026-05-20", author: "SUICUNE", message: "Update README.md" },
  { hash: "0dbcf28", date: "2026-05-19", author: "suicune27", message: "webSecurity = false to remove macOS Blocking on supabase" },
  { hash: "3344371", date: "2026-05-19", author: "suicune27", message: "update macOS package only portable" },
  { hash: "825e35b", date: "2026-05-19", author: "suicune27", message: "feat: redesign AuthUI, remove email confirmation blockers, and optimize dynamic client connections" },
  { hash: "db3e771", date: "2026-05-19", author: "suicune27", message: "feat: expose database migration panel inside SettingsModal" },
  { hash: "97542ea", date: "2026-05-19", author: "suicune27", message: "feat: implement comprehensive database migration service and UI console" },
  { hash: "bec2957", date: "2026-05-19", author: "suicune27", message: "feat: implement automatic selective import tree and power-user request tab context menu" },
  { hash: "7f2ddf0", date: "2026-05-19", author: "suicune27", message: "feat: implement resilient offline synchronization and remove github sync" },
  { hash: "4670f41", date: "2026-05-19", author: "suicune27", message: "style: resolve native select dropdown option backgrounds in dark mode" },
  { hash: "61148a3", date: "2026-05-19", author: "suicune27", message: "feat: configure GitHub update pipeline and integrate frontend auto-update notifications" },
  { hash: "f3c3512", date: "2026-05-19", author: "suicune27", message: "fix: resolve autoUpdater memory leak and clean up temp debug files from root" },
  { hash: "7b006d0", date: "2026-05-19", author: "suicune27", message: "feat: modernize loading screen, refine offline sandbox mode, and optimize database schema sync updates" },
  { hash: "c8656f4", date: "2026-05-19", author: "suicune27", message: "feat: bypass database schema verification on landing page and execute solely on /app route" },
  { hash: "8919d21", date: "2026-05-19", author: "suicune27", message: "docs: point pull desktop app button to the main releases page" },
  { hash: "7219fa7", date: "2026-05-19", author: "suicune27", message: "feat: align team invite codes, optimize multi-tenant onboarding, establish real-time unit updates, and configure Vercel SPA routing" },
  { hash: "4e70541", date: "2026-05-19", author: "suicune27", message: "chore: brand migration to Gimay, borderless window & custom drag support, version 1.0.0, logout popover fix" },
  { hash: "473e5d1", date: "2026-05-19", author: "suicune27", message: "fix(vercel): remove explicit function runtime to resolve deployment error" },
  { hash: "754280c", date: "2026-05-19", author: "suicune27", message: "fix(vercel): remove explicit function runtime to resolve deployment error" },
  { hash: "9a55c73", date: "2026-05-19", author: "SUICUNE", message: "Update README.md" },
  { hash: "d656cac", date: "2026-05-19", author: "suicune27", message: "update title" },
  { hash: "ce5634e", date: "2026-05-19", author: "suicune27", message: "feat(desktop): implement dynamic port allocation, custom header controls, and electron-builder pipeline" },
  { hash: "ae667c0", date: "2026-05-19", author: "suicune27", message: "overhaul light theme" },
  { hash: "2dd710c", date: "2026-05-19", author: "suicune27", message: "fix(proxy): stringify URLSearchParams payload bodies forwarded to CORS proxy server" },
  { hash: "3e89622", date: "2026-05-19", author: "suicune27", message: "fix(script-engine): support implicitly active request params and Postman-style body normalization in sandbox runner" },
  { hash: "e009665", date: "2026-05-19", author: "suicune27", message: "feat(core): fix worker crash, prevent storage limit, and upgrade UI" },
  { hash: "6fdacbd", date: "2026-05-18", author: "suicune27", message: "feat(script-engine): add sandbox request mutation syncing and dynamic request injection" },
  { hash: "c1a4bb7", date: "2026-05-18", author: "suicune27", message: "remove dist_electron" },
  { hash: "646a642", date: "2026-05-18", author: "SUICUNE", message: "feat: Add script library and import functionality" },
  { hash: "6fe48b1", date: "2026-05-18", author: "SUICUNE", message: "feat: Implement sidebar pinning and resizing" },
  { hash: "ab9bcda", date: "2026-05-18", author: "SUICUNE", message: "feat: Increase modal z-index and refactor sidebar" },
  { hash: "3300822", date: "2026-05-18", author: "SUICUNE", message: "feat: Remove Electron specific configurations" },
  { hash: "08ae6e4", date: "2026-05-18", author: "SUICUNE", message: "feat(supabase): Use global client for auth and team operations" },
  { hash: "a40478b", date: "2026-05-18", author: "SUICUNE", message: "feat: Add team workspaces and self-healing" },
  { hash: "938ff41", date: "2026-05-18", author: "SUICUNE", message: "feat(build): Update project name and Electron build configuration" },
  { hash: "d0b77ea", date: "2026-05-17", author: "suicune27", message: "Clean repository and remove build artifacts" },
  { hash: "b8e4633", date: "2026-05-17", author: "suicune27", message: "chore: update files changed in the past hour" },
  { hash: "a611b50", date: "2026-05-17", author: "suicune27", message: "refactor(theme): implement dynamic CSS variable tokens and resolve build failures" },
  { hash: "3bd6d86", date: "2026-05-17", author: "suicune27", message: "refactor(theme): implement dynamic CSS variable tokens and resolve build failures" },
  { hash: "5a93d24", date: "2026-05-17", author: "suicune27", message: "feat: upgrade script syncing, environment hydration, APIdog CSV parsing, and manual save options" },
  { hash: "ae7b78f", date: "2026-05-17", author: "SUICUNE", message: "feat: Initialize Putman project with core setup" },
  { hash: "fdd71c0", date: "2026-05-17", author: "SUICUNE", message: "Initial commit" },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getTypeBadge(msg: string): { label: string; color: string } | null {
  const match = msg.match(/^(feat|fix|chore|docs|style|refactor|test|perf|ci|build)/);
  if (!match) return null;
  const type = match[1];
  const colors: Record<string, string> = {
    feat: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    fix: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    chore: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    docs: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    style: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    refactor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    test: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    perf: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    ci: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    build: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    revert: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return { label: type, color: colors[type] || 'bg-white/5 text-gray-400 border-white/10' };
}

interface ChangelogPageProps {
  onBack: () => void;
}

export function ChangelogPage({ onBack }: ChangelogPageProps) {
  // Group commits by date
  const grouped = commits.reduce<Record<string, ChangelogEntry[]>>((acc, commit) => {
    if (!acc[commit.date]) acc[commit.date] = [];
    acc[commit.date].push(commit);
    return acc;
  }, {});

  const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="fixed inset-0 bg-deep text-white overflow-y-auto overflow-x-hidden font-sans selection:bg-[var(--brand)]/30 custom-scrollbar">
      {/* Background tech grid */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--brand)]/5 rounded-full blur-[120px] -z-10 translate-x-1/3 -translate-y-1/3" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/[0.03]">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-[var(--brand)] flex items-center justify-center shadow-[0_0_15px_rgba(var(--brand-rgb),0.3)]">
              <Terminal size={14} className="text-black" />
            </div>
            <span className="font-black text-[10px] tracking-widest uppercase italic">Gimay <span className="opacity-40 italic ml-1 font-medium">Changelog</span></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest text-dim hover:text-white border border-transparent hover:border-[var(--border-subtle)] rounded transition-all"
            >
              <ArrowLeft size={12} />
              Back to Home
            </button>
            <a
              href="https://github.com/suicune27/Gimay/commits/main"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 text-[8px] font-black uppercase tracking-widest bg-[var(--brand)]/10 border border-[var(--brand)]/20 hover:bg-[var(--brand)]/20 text-[var(--brand)] rounded transition-all"
            >
              <Github size={12} />
              Full History
            </a>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="relative pt-32 pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-2 py-0.5 rounded border border-[var(--brand)]/20 bg-[var(--brand)]/5 mb-6"
          >
            <GitCommit size={10} className="text-[var(--brand)]" />
            <span className="text-[7px] font-black uppercase tracking-[0.3em] text-[var(--brand)]/80">{commits.length} Releases Tracked</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-black mb-4 leading-tight tracking-tighter"
          >
            Deployment <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand)] to-blue-400">Changelog.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-muted max-w-xl leading-relaxed"
          >
            Complete commit history for the Gimay API Command Suite. Track protocol updates, security patches, and new subsystem deployments in chronological order.
          </motion.p>
        </div>
      </section>

      {/* Stats Bar */}
      <div className="max-w-4xl mx-auto px-6 mb-12">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Commits', value: commits.length.toString(), icon: GitCommit },
            { label: 'Active Period', value: '21 Days', icon: Calendar },
            { label: 'Contributors', value: '3', icon: GitFork },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.05] flex items-center gap-3"
            >
              <stat.icon size={16} className="text-[var(--brand)] shrink-0" />
              <div>
                <div className="text-lg font-black text-white">{stat.value}</div>
                <div className="text-[7px] font-black text-dim uppercase tracking-[0.2em]">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Commit Timeline */}
      <section className="pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Timeline vertical line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-[var(--brand)]/40 via-white/[0.03] to-transparent hidden md:block" />

            {dateKeys.map((dateKey, dateIdx) => (
              <div key={dateKey}>
                {/* Date Header */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="relative mb-6 mt-10 first:mt-0"
                >
                  <div className="hidden md:block absolute left-[-9px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-[var(--brand)] border-[3px] border-deep shadow-[0_0_15px_rgba(var(--brand-rgb),0.3)]" />
                  <div className="md:pl-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white/[0.03] border border-white/[0.05]">
                      <Calendar size={10} className="text-[var(--brand)]" />
                      <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--brand)]">
                        {formatDate(dateKey)}
                      </span>
                      <span className="text-[8px] font-mono text-dim ml-1">
                        {grouped[dateKey].length} commit{grouped[dateKey].length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Commits for this date */}
                {grouped[dateKey].map((commit, i) => {
                  const badge = getTypeBadge(commit.message);
                  return (
                    <motion.div
                      key={commit.hash}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.03 }}
                      className="relative group"
                    >
                      <div className="md:pl-8 py-2">
                        <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.02] transition-colors border border-transparent hover:border-white/[0.03]">
                          {/* Timeline dot for mobile */}
                          <div className="md:hidden mt-1 w-2 h-2 rounded-full bg-[var(--brand)]/40 shrink-0" />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Commit hash */}
                              <code className="text-[9px] font-mono text-dim shrink-0">{commit.hash}</code>

                              {/* Type badge */}
                              {badge && (
                                <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${badge.color}`}>
                                  {badge.label}
                                </span>
                              )}

                              {/* Author */}
                              <span className="text-[8px] font-mono text-dim/60">
                                by {commit.author}
                              </span>
                            </div>

                            {/* Message */}
                            <p className="text-[11px] text-white/80 mt-0.5 leading-relaxed font-medium group-hover:text-white transition-colors">
                              {commit.message}
                            </p>
                          </div>

                          {/* GitHub link */}
                          <a
                            href={`https://github.com/suicune27/Gimay/commit/${commit.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.05] text-dim hover:text-[var(--brand)] transition-all"
                            title={`View commit ${commit.hash}`}
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-black border-t border-white/[0.02]">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-[var(--brand)] flex items-center justify-center">
              <Terminal size={12} className="text-black" />
            </div>
            <span className="font-black text-[9px] tracking-widest uppercase italic">Gimay Tech</span>
          </div>

          <div className="flex gap-6 text-[8px] font-black uppercase tracking-[0.3em] text-dim">
            <button onClick={onBack} className="hover:text-[var(--brand)] transition-colors cursor-pointer">
              Home
            </button>
            <a href="https://github.com/suicune27/Gimay" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--brand)] transition-colors">
              Repository
            </a>
            <a href="https://github.com/suicune27/Gimay/releases" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--brand)] transition-colors">
              Releases
            </a>
          </div>

          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-dim">
            © 2026 Core Protocol
          </p>
        </div>
      </footer>
    </div>
  );
}

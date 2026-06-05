import React, { useState } from 'react';
import { supabase, getSupabaseConfig, refreshSupabaseClient } from '../lib/supabase';
import { SecureConfigStorage } from '../lib/SecureConfigStorage';
import { 
  LogIn, 
  UserPlus, 
  Terminal, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ChevronRight,
  Database,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthUIProps {
  onOfflineMode?: () => void;
}

export const AuthUI: React.FC<AuthUIProps> = ({ onOfflineMode }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dbConfig, setDbConfig] = useState(() => {
    const config = getSupabaseConfig();
    const tenant = SecureConfigStorage.getSupabaseConfig();
    return {
      url: config.url || '',
      isTenant: Boolean(tenant)
    };
  });

  const handleResetToEnvDb = () => {
    SecureConfigStorage.clearConfiguration();
    refreshSupabaseClient();
    const freshConfig = getSupabaseConfig();
    setDbConfig({
      url: freshConfig.url || '',
      isTenant: false
    });
    setError(null);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Standardize redirection parameter for standard web contexts and Electron local file contexts
    const redirectTo = window.location.origin.startsWith('file:') 
      ? undefined 
      : `${window.location.origin  }/app`;

    const { error: authError } = isLogin 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ 
          email, 
          password,
          options: redirectTo ? { emailRedirectTo: redirectTo } : undefined
        });

    if (authError) {
      setError(authError.message);
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#050506] overflow-hidden p-4 font-sans selection:bg-[#3ECF8E]/20">
      {/* Ambient background glows like loading */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#3ECF8E]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Technical grid lines in the background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md bg-[#0C0C0E]/90 border border-white/[0.04] rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.8)] p-8 backdrop-blur-xl z-10 flex flex-col overflow-hidden"
      >
        {/* Top Glow Boundary Line */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[#3ECF8E]/20 to-transparent pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-11 h-11 bg-[#3ECF8E] rounded-xl shadow-[0_0_30px_rgba(62,207,142,0.15)] flex items-center justify-center transition-all hover:scale-105">
            <Terminal size={22} className="text-[#050506] stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none flex items-center gap-1.5">
              Gimay <span className="text-[9px] py-0.5 px-1.5 rounded-full border border-[#3ECF8E]/25 text-[#3ECF8E] font-mono tracking-widest font-black bg-[#3ECF8E]/5">CORE</span>
            </h1>
            <p className="text-[8px] text-zinc-500 font-mono uppercase tracking-[0.25em] font-black mt-1">Cortex API Uplink Engine</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Access and Sign Up Forms */}
          <motion.div
            key="auth-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Sliding Tab Selector */}
            <div className="p-1 bg-black/60 rounded-xl border border-white/[0.03] flex relative">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(true);
                  setError(null);
                }}
                className={`flex-1 text-center py-2 text-[9px] font-black uppercase tracking-widest relative z-10 transition-colors duration-300 ${isLogin ? 'text-black' : 'text-zinc-500'}`}
              >
                Establish Link
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(false);
                  setError(null);
                }}
                className={`flex-1 text-center py-2 text-[9px] font-black uppercase tracking-widest relative z-10 transition-colors duration-300 ${!isLogin ? 'text-black' : 'text-zinc-500'}`}
              >
                Register Node
              </button>
              
              <motion.div
                className="absolute top-1 bottom-1 rounded-lg bg-[#3ECF8E] z-0"
                animate={{
                  left: isLogin ? '4px' : 'calc(50% + 2px)',
                  right: isLogin ? 'calc(50% + 2px)' : '4px',
                }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              />
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {/* Email input field */}
              <div className="space-y-1.5">
                <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">Access Portal (Email)</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#050506] border border-white/[0.04] rounded-xl py-3 pl-11 pr-4 text-xs text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-[#3ECF8E]/40 focus:bg-white/[0.01] transition-all"
                    placeholder="operator@putment.io"
                    required
                  />
                </div>
              </div>

              {/* Password input field */}
              <div className="space-y-1.5">
                <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">Security Hash (Password)</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#050506] border border-white/[0.04] rounded-xl py-3 pl-11 pr-11 text-xs text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-[#3ECF8E]/40 focus:bg-white/[0.01] transition-all"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Cyber error log */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 bg-rose-500/[0.02] border border-rose-500/10 rounded-xl space-y-2 text-left"
                >
                  <div className="text-rose-500 text-[9px] font-mono leading-relaxed break-all">
                    &gt; SYSTEM ERROR: {error.toUpperCase()}
                  </div>
                  {error.toLowerCase().includes('api key') && (
                    <div className="text-[8px] text-zinc-500 font-mono border-t border-rose-500/10 pt-2 leading-relaxed">
                      Verify your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY config parameters in the workspace environment configuration.
                    </div>
                  )}
                </motion.div>
              )}

              {/* Command Action Button */}
              <button 
                disabled={loading}
                className="w-full bg-[#3ECF8E] hover:bg-[#46e6a0] disabled:bg-[#3ECF8E]/20 text-[#050506] font-black text-[9px] uppercase tracking-widest py-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shadow-lg shadow-[#3ECF8E]/10 cursor-pointer active:scale-[0.98]"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-[#050506]/30 border-t-[#050506] rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? <LogIn size={13} className="stroke-[2.5]" /> : <UserPlus size={13} className="stroke-[2.5]" />}
                    <span>{isLogin ? 'ESTABLISH LINK' : 'REGISTER NODE'}</span>
                    <ChevronRight size={13} className="stroke-[2.5]" />
                  </>
                )}
              </button>
            </form>

            {/* Sandbox Offline mode capsule */}
            {onOfflineMode && (
              <div className="pt-4 border-t border-white/[0.04] text-center">
                <button
                  type="button"
                  onClick={onOfflineMode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.01] hover:bg-white/[0.03] border border-white/[0.04] text-[8px] font-black text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-all cursor-pointer active:scale-[0.97]"
                >
                  <Sparkles size={11} className="text-[#3ECF8E]" /> Launch Offline Sandbox
                </button>
              </div>
            )}

            {/* Database Connection Node status */}
            <div className="pt-4 border-t border-white/[0.04] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Database size={11} className={dbConfig.isTenant ? 'text-amber-500' : 'text-[#3ECF8E]'} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Database Uplink Source</span>
                </div>
                <span className={`text-[7px] font-black tracking-widest px-1.5 py-0.5 rounded uppercase font-mono ${
                  dbConfig.isTenant ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/20'
                }`}>
                  {dbConfig.isTenant ? 'Tenant Override' : 'Global Env'}
                </span>
              </div>
              <div className="p-2.5 bg-black/60 border border-white/[0.03] rounded-lg flex items-center justify-between gap-3 overflow-hidden">
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-mono text-white truncate" title={dbConfig.url}>
                    {dbConfig.url || 'http://unconfigured-endpoint.co'}
                  </div>
                  <p className="text-[7.5px] text-zinc-600 font-mono uppercase mt-0.5 tracking-wider">
                    {dbConfig.isTenant 
                      ? 'Local overridden configuration active.' 
                      : 'Targeting default workspace environment database.'
                    }
                  </p>
                </div>
                {dbConfig.isTenant && (
                  <button
                    type="button"
                    onClick={handleResetToEnvDb}
                    className="shrink-0 px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 font-mono font-black text-[7.5px] tracking-widest uppercase transition-all cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw size={8} /> Reset to Env
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

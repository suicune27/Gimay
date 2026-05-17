import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus, Github, Terminal } from 'lucide-react';
import { motion } from 'motion/react';

export const AuthUI: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = isLogin 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-deep p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 rounded-xl border border-subtle bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 bg-brand rounded-xl shadow-[0_0_30px_rgba(62,207,142,0.1)] flex items-center justify-center">
            <Terminal size={28} className="text-[var(--bg-deep)]" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-main tracking-tighter uppercase leading-none">Gimay</h1>
            <p className="text-[10px] text-brand font-mono uppercase tracking-[0.3em] font-bold mt-1">v9.0.0 // PRODUCTION CORE</p>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-dim mb-2">Access Portal</label>
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-deep border border-subtle rounded-lg px-4 py-3 text-sm text-muted focus:border-brand focus:text-main outline-none transition-all placeholder:text-[var(--border-strong)]"
              placeholder="operator@gimay.io"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-dim mb-2">Security Hash</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-deep border border-subtle rounded-lg px-4 py-3 text-sm text-muted focus:border-brand focus:text-main outline-none transition-all placeholder:text-[var(--border-strong)]"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-red-500 text-[10px] font-mono leading-relaxed">
              &gt; FATAL ERROR: {error.toUpperCase()}
            </div>
          )}

          <button 
            disabled={loading}
            className="w-full bg-brand hover:bg-[#34B37A] text-[var(--bg-deep)] font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-[#3ECF8E1A]"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-[var(--bg-deep)]/30 border-t-[var(--bg-deep)] rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                <span className="tracking-tighter">{isLogin ? 'ESTABLISH LINK' : 'REGISTER NODE'}</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-subtle text-center">
          <p className="text-[10px] text-dim tracking-widest uppercase">
            {isLogin ? "No active credentials?" : "Credential set found?"}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-brand hover:text-main transition-colors"
            >
              {isLogin ? 'Request Access' : 'Authenticate'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

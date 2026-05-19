import React, { useState } from 'react';
import { globalSupabase } from '../lib/supabase';
import { LogIn, UserPlus, Terminal } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthUIProps {
  onOfflineMode?: () => void;
}

export const AuthUI: React.FC<AuthUIProps> = ({ onOfflineMode }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const { error: authError } = isLogin 
      ? await globalSupabase.auth.signInWithPassword({ email, password })
      : await globalSupabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: window.location.origin + '/app'
          }
        });

    if (authError) {
      setError(authError.message);
    } else if (!isLogin) {
      setSuccessMessage('A secure activation link has been dispatched to your email. Please click the link to verify your operator profile and activate your node.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 rounded-xl border border-[#222222] bg-[#0F0F0F] shadow-2xl"
      >
        <div className="flex items-center gap-4 mb-10">
          <div className="w-12 h-12 bg-[#3ECF8E] rounded-xl shadow-[0_0_30px_rgba(62,207,142,0.1)] flex items-center justify-center">
            <Terminal size={28} className="text-[#0A0A0A]" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Gimay</h1>
            <p className="text-[10px] text-[#3ECF8E] font-mono uppercase tracking-[0.3em] font-bold mt-1">v9.0.0 // PRODUCTION CORE</p>
          </div>
        </div>

        {successMessage ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 text-[#3ECF8E] rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(62,207,142,0.15)]">
              <UserPlus size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-[14px] font-black text-white uppercase tracking-widest">Verification Pending</h2>
              <p className="text-[11px] text-[#888888] font-mono leading-relaxed px-2">
                {successMessage}
              </p>
            </div>
            <button
              onClick={() => {
                setSuccessMessage(null);
                setIsLogin(true);
              }}
              className="w-full py-3 border border-[#222222] hover:border-[#3ECF8E]/30 text-[#888888] hover:text-[#3ECF8E] font-bold rounded-lg transition-all text-xs tracking-wider uppercase"
            >
              Return to Authenticate
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#555555] mb-2">Access Portal</label>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#222222] rounded-lg px-4 py-3 text-sm text-[#AAAAAA] focus:border-[#3ECF8E] focus:text-[#E0E0E0] outline-none transition-all placeholder:text-[#333333]"
                  placeholder="operator@putment.io"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#555555] mb-2">Security Hash</label>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#222222] rounded-lg px-4 py-3 text-sm text-[#AAAAAA] focus:border-[#3ECF8E] focus:text-[#E0E0E0] outline-none transition-all placeholder:text-[#333333]"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg space-y-2">
                  <div className="text-red-500 text-[10px] font-mono leading-relaxed">
                    &gt; FATAL ERROR: {error.toUpperCase()}
                  </div>
                  {error.toLowerCase().includes('api key') && (
                    <div className="text-[9px] text-[#888888] font-mono border-t border-red-500/10 pt-2">
                      <p>Check your <code className="text-[#3ECF8E]">VITE_SUPABASE_URL</code> and <code className="text-[#3ECF8E]">VITE_SUPABASE_ANON_KEY</code> in the environment settings.</p>
                      <p className="mt-1">The global infrastructure must be configured before authenticating.</p>
                    </div>
                  )}
                </div>
              )}

              <button 
                disabled={loading}
                className="w-full bg-[#3ECF8E] hover:bg-[#34B37A] text-[#0A0A0A] font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-[#3ECF8E1A]"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-[#0A0A0A]/30 border-t-[#0A0A0A] rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                    <span className="tracking-tighter">{isLogin ? 'ESTABLISH LINK' : 'REGISTER NODE'}</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-[#222222] text-center flex flex-col gap-3">
              <p className="text-[10px] text-[#555555] tracking-widest uppercase">
                {isLogin ? "No active credentials?" : "Credential set found?"}
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="ml-2 text-[#3ECF8E] hover:text-white transition-colors"
                >
                  {isLogin ? 'Request Access' : 'Authenticate'}
                </button>
              </p>
              {onOfflineMode && (
                <button
                  onClick={onOfflineMode}
                  className="text-[10px] text-[#888888] hover:text-[#E0E0E0] tracking-widest uppercase transition-colors"
                >
                  [ Launch Offline Sandbox ]
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

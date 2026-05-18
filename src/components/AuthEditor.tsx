import React from 'react';
import { AuthConfig, AuthType } from '../types';
import { cn } from '../lib/utils';
import { Shield, Key, Lock, User, Globe, ChevronDown, Zap } from 'lucide-react';

interface AuthEditorProps {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
  hideInherit?: boolean;
}

export const AuthEditor: React.FC<AuthEditorProps> = ({ auth, onChange, hideInherit }) => {
  if (!auth) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-[#222222] rounded-xl bg-[#0F0F0F] opacity-50">
        <Shield size={24} className="mb-2 text-[#555555]" />
        <p className="text-[10px] font-black uppercase tracking-widest text-[#555555]">Initializing Auth Protocol...</p>
      </div>
    );
  }

  const handleTypeChange = (type: AuthType) => {
    const newAuth = { ...auth, type };
    if (type === 'apikey' && !newAuth.apiKey) {
      newAuth.apiKey = { key: 'x-api-key', value: '', addTo: 'header' };
    }
    if (type === 'basic' && !newAuth.basic) {
      newAuth.basic = { username: '', password: '' };
    }
    if (type === 'oauth2' && !newAuth.oauth2) {
      newAuth.oauth2 = { accessToken: '', tokenType: 'Bearer' };
    }
    onChange(newAuth);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-col gap-2">
        <label className="text-[9px] font-black text-[#555555] uppercase tracking-[0.2em]">Auth Protocol</label>
        <div className="relative group">
          <select 
            value={auth.type}
            onChange={(e) => handleTypeChange(e.target.value as AuthType)}
            className="w-full bg-[#111111] border border-[#222222] rounded-lg px-4 py-3 text-[11px] font-bold text-white uppercase tracking-widest appearance-none focus:border-[#3ECF8E]/50 outline-none transition-all cursor-pointer"
          >
            <option value="none">No Auth</option>
            {!hideInherit && <option value="inherit">Inherit from parent</option>}
            <option value="bearer">Bearer Token</option>
            <option value="basic">Basic Auth</option>
            <option value="apikey">API Key</option>
            <option value="oauth2">OAuth 2.0</option>
          </select>
          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#444444] pointer-events-none" />
        </div>
      </div>

      <div className="p-6 bg-[#0F0F0F] border border-[#222222] rounded-xl space-y-6">
        {auth.type === 'none' && (
          <div className="flex flex-col items-center py-8 opacity-20">
            <Globe size={32} className="mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">Public Transmission</p>
          </div>
        )}

        {auth.type === 'inherit' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#3ECF8E]">
              <Shield size={14} />
              <p className="text-[11px] font-bold uppercase tracking-widest">Inheriting Sector Clearances</p>
            </div>
            <p className="text-[10px] text-[#555555] leading-relaxed">
              This request will use the authorization settings defined in the parent folder or collection.
            </p>
          </div>
        )}

        {auth.type === 'bearer' && (
          <div className="space-y-3">
            <label className="text-[9px] font-black text-[#555555] uppercase tracking-widest">Token</label>
            <div className="relative">
              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333333]" />
              <input 
                type="text"
                value={auth.bearer || ''}
                onChange={(e) => onChange({ ...auth, bearer: e.target.value })}
                placeholder="BEARER_TOKEN..."
                className="w-full bg-[#1A1A1A] border border-[#222222] rounded-lg pl-10 pr-4 py-3 text-[11px] font-mono text-white placeholder:text-[#333333] focus:border-[#3ECF8E]/50 outline-none transition-all"
              />
            </div>
          </div>
        )}

        {auth.type === 'oauth2' && (
          <div className="space-y-3">
            <label className="text-[9px] font-black text-[#555555] uppercase tracking-widest">Access Token</label>
            <div className="relative">
              <Zap size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333333]" />
              <input 
                type="text"
                value={auth.oauth2?.accessToken || ''}
                onChange={(e) => onChange({ ...auth, oauth2: { ...auth.oauth2, accessToken: e.target.value } as any })}
                placeholder="ACCESS_TOKEN..."
                className="w-full bg-[#1A1A1A] border border-[#222222] rounded-lg pl-10 pr-4 py-3 text-[11px] font-mono text-white placeholder:text-[#333333] focus:border-[#3ECF8E]/50 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
               <div className="px-2 py-1 bg-[#1A1A1A] border border-[#222222] rounded text-[8px] font-bold text-[#555555] uppercase">
                 Type: {auth.oauth2?.tokenType || 'Bearer'}
               </div>
               <p className="text-[9px] text-[#333333] uppercase italic">Advanced OAuth2 Handshake protocols coming soon...</p>
            </div>
          </div>
        )}

        {auth.type === 'basic' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[#555555] uppercase tracking-widest">Username</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333333]" />
                <input 
                  type="text"
                  value={auth.basic?.username || ''}
                  onChange={(e) => onChange({ ...auth, basic: { ...auth.basic, username: e.target.value } as any })}
                  placeholder="USERNAME..."
                  className="w-full bg-[#1A1A1A] border border-[#222222] rounded-lg pl-10 pr-4 py-3 text-[11px] font-mono text-white placeholder:text-[#333333] focus:border-[#3ECF8E]/50 outline-none transition-all"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[#555555] uppercase tracking-widest">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#333333]" />
                <input 
                  type="password"
                  value={auth.basic?.password || ''}
                  onChange={(e) => onChange({ ...auth, basic: { ...auth.basic, password: e.target.value } as any })}
                  placeholder="PASSWORD..."
                  className="w-full bg-[#1A1A1A] border border-[#222222] rounded-lg pl-10 pr-4 py-3 text-[11px] font-mono text-white placeholder:text-[#333333] focus:border-[#3ECF8E]/50 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {auth.type === 'apikey' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[#555555] uppercase tracking-widest">Key</label>
                <input 
                  type="text"
                  value={auth.apiKey?.key || ''}
                  onChange={(e) => onChange({ ...auth, apiKey: { ...auth.apiKey, key: e.target.value } as any })}
                  placeholder="x-api-key"
                  className="w-full bg-[#1A1A1A] border border-[#222222] rounded-lg px-4 py-3 text-[11px] font-mono text-white placeholder:text-[#333333] focus:border-[#3ECF8E]/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-[#555555] uppercase tracking-widest">Value</label>
                <input 
                  type="text"
                  value={auth.apiKey?.value || ''}
                  onChange={(e) => onChange({ ...auth, apiKey: { ...auth.apiKey, value: e.target.value } as any })}
                  placeholder="API_KEY_VALUE..."
                  className="w-full bg-[#1A1A1A] border border-[#222222] rounded-lg px-4 py-3 text-[11px] font-mono text-white placeholder:text-[#333333] focus:border-[#3ECF8E]/50 outline-none transition-all"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[#555555] uppercase tracking-widest">Add To</label>
              <div className="flex gap-2">
                {['header', 'query'].map((pos) => (
                  <button 
                    key={pos}
                    onClick={() => onChange({ ...auth, apiKey: { ...auth.apiKey, addTo: pos as any } as any })}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all",
                      auth.apiKey?.addTo === pos ? "bg-[#3ECF8E] text-[#111111] border-[#3ECF8E]" : "border-[#222222] text-[#555555] hover:border-[#444444]"
                    )}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

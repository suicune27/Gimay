import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings as SettingsIcon, 
  Moon, 
  Sun, 
  Monitor, 
  Shield, 
  Globe, 
  Zap, 
  Database, 
  Info, 
  X, 
  ChevronRight, 
  Lock, 
  Search,
  Eye,
  EyeOff,
  Terminal,
  Cpu,
  Clock,
  HardDrive,
  RefreshCw,
  Layout,
  Type,
  FlaskConical,
  Activity,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Github,
  CloudDownload
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { AppSettings } from '../types';
import { GitHubService } from '../services/GitHubService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = 'General' | 'Themes' | 'Proxy' | 'SSL/TLS' | 'Cookies' | 'Response & Network' | 'GitHub Sync' | 'Experimental' | 'Diagnostics' | 'About';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, resetSettings, activeWorkspaceId, profile, addToast } = useStore();
  const [activeSection, setActiveSection] = useState<SettingsSection>('General');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPulling, setIsPulling] = useState(false);

  const handleUpdate = (path: string, value: any) => {
    const parts = path.split('.');
    if (parts.length === 1) {
      updateSettings({ [parts[0]]: value });
    } else {
      const section = parts[0] as keyof AppSettings;
      updateSettings({
        [section]: {
          ...(settings[section] as any),
          [parts[1]]: value,
        },
      });
    }
  };

  const sections: { id: SettingsSection; icon: any; label: string; description?: string }[] = [
    { id: 'General', icon: SettingsIcon, label: 'General' },
    { id: 'Themes', icon: Layout, label: 'Appearance' },
    { id: 'Proxy', icon: Globe, label: 'Proxy' },
    { id: 'SSL/TLS', icon: Shield, label: 'SSL / TLS' },
    { id: 'Cookies', icon: Database, label: 'Cookies' },
    { id: 'Response & Network', icon: Zap, label: 'Network' },
    { id: 'GitHub Sync', icon: Github, label: 'GitHub Sync' },
    { id: 'Experimental', icon: FlaskConical, label: 'Experimental' },
    { id: 'Diagnostics', icon: Activity, label: 'Diagnostics' },
    { id: 'About', icon: Info, label: 'About' },
  ];

  const filteredSections = useMemo(() => {
    if (!searchQuery) return sections;
    const lowerQuery = searchQuery.toLowerCase();
    return sections.filter(s => 
      s.label.toLowerCase().includes(lowerQuery) || 
      s.id.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery]);

  const handleClearCache = () => {
    if (confirm('Are you sure you want to clear application cache and local storage? This will log you out.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleExportSettings = () => {
    const data = JSON.stringify(settings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `putman-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string);
        updateSettings(imported);
        alert('Settings imported successfully.');
      } catch (err) {
        alert('Invalid settings file.');
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl h-[650px] bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-2xl flex"
      >
        {/* Sidebar */}
        <div className="w-64 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col">
          <div className="p-6">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-dim)] mb-4">Operations Center</h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--border-strong)]" />
              <input 
                type="text"
                placeholder="Find Setting..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg pl-9 pr-4 py-2 text-[10px] font-bold text-[var(--text-main)] placeholder:text-[var(--border-strong)] focus:border-[var(--brand)]/50 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
            {filteredSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all group",
                  activeSection === section.id 
                    ? "bg-[var(--brand)]/10 text-[var(--brand)]" 
                    : "text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]"
                )}
              >
                <section.icon size={16} className={cn(
                  "transition-all",
                  activeSection === section.id ? "text-[var(--brand)]" : "text-[var(--border-strong)] group-hover:text-[var(--text-dim)]"
                )} />
                {section.label}
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-[var(--border-subtle)] flex flex-col gap-2">
            <button 
              onClick={() => {
                if(confirm('Reset all settings to default factory values?')) resetSettings();
              }}
              className="flex items-center gap-2 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/5 rounded-lg transition-all"
            >
              <RotateCcw size={14} />
              Reset All
            </button>
            <div className="flex items-center gap-2 px-3 opacity-30 mt-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse" />
              <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Mainframe Sync Active</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col bg-[var(--bg-deep)]">
          <div className="h-16 border-b border-[var(--border-subtle)] flex items-center justify-between px-8">
            <h1 className="text-sm font-black text-[var(--text-main)] uppercase tracking-[0.2em]">{activeSection}</h1>
            <button 
              onClick={onClose}
              className="p-2 text-[var(--text-dim)] hover:text-[var(--text-main)] transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeSection === 'General' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <Section title="Sync & Persistence">
                    <SettingToggle 
                      label="Automatic Save" 
                      description="Automatically synchronize all changes to collections, requests, and environments." 
                      enabled={settings.general.autoSave}
                      onChange={(v) => handleUpdate('general.autoSave', v)}
                    />
                  </Section>

                  <Section title="Network Protocol">
                    <div className="space-y-4">
                      <SettingSelect 
                        label="HTTP Version"
                        description="Select the preferred HTTP version for outgoing requests."
                        value={settings.general.httpVersion}
                        options={[
                          { value: 'auto', label: 'Auto (Recommended)' },
                          { value: 'http1.1', label: 'HTTP/1.1' },
                          { value: 'http2', label: 'HTTP/2' },
                          { value: 'http3', label: 'HTTP/3' }
                        ]}
                        onChange={(v) => handleUpdate('general.httpVersion', v)}
                      />
                      
                      <div className="grid grid-cols-2 gap-6">
                        <SettingInput 
                          label="Request Timeout" 
                          description="Interval in milliseconds (0 for none)." 
                          value={settings.general.requestTimeout.toString()}
                          type="number"
                          onChange={(v) => handleUpdate('general.requestTimeout', parseInt(v) || 0)}
                        />
                        <SettingInput 
                          label="Max Response Size" 
                          description="Limit in bytes (default 100MB)." 
                          value={settings.general.maxResponseSize.toString()}
                          type="number"
                          onChange={(v) => handleUpdate('general.maxResponseSize', parseInt(v) || 0)}
                        />
                      </div>
                    </div>
                  </Section>

                  <Section title="Retrieval Logic">
                    <div className="space-y-4">
                      <SettingToggle 
                        label="Follow Redirects" 
                        description="Automatically intercept and follow 3xx redirect status codes." 
                        enabled={settings.general.followRedirects}
                        onChange={(v) => handleUpdate('general.followRedirects', v)}
                      />
                      {settings.general.followRedirects && (
                        <SettingInput 
                          label="Max Redirects" 
                          value={settings.general.maxRedirects.toString()}
                          type="number"
                          onChange={(v) => handleUpdate('general.maxRedirects', parseInt(v) || 0)}
                        />
                      )}
                      <SettingToggle 
                        label="Connection Keep-Alive" 
                        description="Maintains persistent connections to reduce latency." 
                        enabled={settings.general.keepAlive}
                        onChange={(v) => handleUpdate('general.keepAlive', v)}
                      />
                    </div>
                  </Section>
                </motion.div>
              )}

              {activeSection === 'Themes' && (
                <motion.div
                  key="themes"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <Section title="Interface Style">
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { id: 'dark', icon: Moon, label: 'Obsidian' },
                        { id: 'light', icon: Sun, label: 'Luminous' },
                        { id: 'system', icon: Monitor, label: 'OS Sync' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleUpdate('appearance.theme', t.id)}
                          className={cn(
                            "flex flex-col items-center justify-center gap-3 p-6 rounded-xl border transition-all",
                            settings.appearance.theme === t.id 
                              ? "bg-[var(--brand)]/5 border-[var(--brand)] text-[var(--brand)]" 
                              : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:border-[var(--border-strong)]"
                          )}
                        >
                          <t.icon size={24} />
                          <span className="text-[10px] font-black uppercase tracking-widest">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </Section>

                  <Section title="Layout Configuration">
                    <div className="space-y-4">
                       <SettingSelect 
                        label="Density Mode"
                        description="Control the information density of the interface."
                        value={settings.appearance.layoutMode}
                        options={[
                          { value: 'compact', label: 'Compact (High Density)' },
                          { value: 'comfortable', label: 'Comfortable (Standard)' }
                        ]}
                        onChange={(v) => handleUpdate('appearance.layoutMode', v)}
                      />
                      <SettingToggle 
                        label="Show Status Bar"
                        description="Display the universal operations rail at the bottom."
                        enabled={settings.appearance.showStatusBar}
                        onChange={(v) => handleUpdate('appearance.showStatusBar', v)}
                      />
                      <div className="grid grid-cols-2 gap-6">
                        <SettingInput 
                          label="Font Size" 
                          value={settings.appearance.fontSize.toString()}
                          type="number"
                          onChange={(v) => handleUpdate('appearance.fontSize', parseInt(v) || 12)}
                        />
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Accent Chroma</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              value={settings.appearance.accentColor}
                              onChange={(e) => handleUpdate('appearance.accentColor', e.target.value)}
                              className="w-10 h-10 bg-transparent border-none cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">{settings.appearance.accentColor.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Section>
                </motion.div>
              )}

              {activeSection === 'Proxy' && (
                 <motion.div
                  key="proxy"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <Section title="Routing Proxy">
                     <SettingToggle 
                      label="Enable Proxy Systems" 
                      description="Reroute all requests through a secure proxy bridge." 
                      enabled={settings.proxy.enabled}
                      onChange={(v) => handleUpdate('proxy.enabled', v)}
                    />
                    {settings.proxy.enabled && (
                      <div className="mt-6 space-y-4 animate-in slide-in-from-top-2 duration-300">
                         <SettingToggle 
                          label="Use System Proxy" 
                          description="Override local settings with environment-defined proxies." 
                          enabled={settings.proxy.useSystemProxy}
                          onChange={(v) => handleUpdate('proxy.useSystemProxy', v)}
                        />
                        {!settings.proxy.useSystemProxy && (
                          <>
                            <SettingInput 
                              label="HTTP Proxy" 
                              placeholder="e.g. http://10.0.0.1:8080"
                              value={settings.proxy.httpProxy}
                              onChange={(v) => handleUpdate('proxy.httpProxy', v)}
                            />
                            <SettingInput 
                              label="HTTPS Proxy" 
                              placeholder="e.g. https://10.0.0.1:8080"
                              value={settings.proxy.httpsProxy}
                              onChange={(v) => handleUpdate('proxy.httpsProxy', v)}
                            />
                            <SettingInput 
                              label="SOCKS Proxy" 
                              placeholder="e.g. socks5://10.0.0.1:1080"
                              value={settings.proxy.socksProxy}
                              onChange={(v) => handleUpdate('proxy.socksProxy', v)}
                            />
                            <SettingInput 
                              label="Bypass List" 
                              description="Comma-separated hosts to reach directly."
                              placeholder="localhost, 127.0.0.1, internal.host"
                              value={settings.proxy.bypassList}
                              onChange={(v) => handleUpdate('proxy.bypassList', v)}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </Section>
                </motion.div>
              )}

              {activeSection === 'SSL/TLS' && (
                <motion.div
                  key="ssl"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <Section title="Encryption Protocol">
                    <div className="space-y-4">
                      <SettingToggle 
                        label="SSL Verification" 
                        description="Strictly validate server certificates. (Disable for self-signed development servers)" 
                        enabled={settings.ssl.verifySSL}
                        onChange={(v) => handleUpdate('ssl.verifySSL', v)}
                      />
                      <SettingSelect 
                        label="Minimum TLS Version"
                        value={settings.ssl.tlsVersion}
                        options={[
                          { value: 'auto', label: 'Auto (Recommended)' },
                          { value: 'TLSv1.1', label: 'TLS v1.1' },
                          { value: 'TLSv1.2', label: 'TLS v1.2' },
                          { value: 'TLSv1.3', label: 'TLS v1.3' }
                        ]}
                        onChange={(v) => handleUpdate('ssl.tlsVersion', v)}
                      />
                      <SettingToggle 
                        label="SSL/TLS Key Log" 
                        description="Log secret keys for network debuggers like Wireshark." 
                        enabled={settings.ssl.keyLogFile}
                        onChange={(v) => handleUpdate('ssl.keyLogFile', v)}
                      />
                    </div>
                  </Section>

                  <Section title="Certificates (PEM)">
                    <div className="space-y-4">
                       <SettingInput 
                          label="Custom CA Certificate" 
                          description="Path to your custom Root CA file."
                          placeholder="/path/to/ca.pem"
                          value={settings.ssl.customCA}
                          onChange={(v) => handleUpdate('ssl.customCA', v)}
                        />
                        <div className="grid grid-cols-2 gap-4">
                           <SettingInput 
                            label="Client Certificate" 
                            placeholder="/path/to/client.crt"
                            value={settings.ssl.clientCert}
                            onChange={(v) => handleUpdate('ssl.clientCert', v)}
                          />
                          <SettingInput 
                            label="Client Key" 
                            placeholder="/path/to/client.key"
                            value={settings.ssl.clientKey}
                            onChange={(v) => handleUpdate('ssl.clientKey', v)}
                          />
                        </div>
                    </div>
                  </Section>
                </motion.div>
              )}

              {activeSection === 'Cookies' && (
                <motion.div
                  key="cookies"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <Section title="Jar Management">
                    <div className="space-y-4">
                      <SettingToggle 
                        label="Global Cookie Capture" 
                        description="Enables automatic cookie management across all domains." 
                        enabled={settings.cookies.enabled}
                        onChange={(v) => handleUpdate('cookies.enabled', v)}
                      />
                      <SettingToggle 
                        label="Clear on Exit" 
                        description="Purge all session cookies when the application process terminates." 
                        enabled={settings.cookies.clearOnExit}
                        onChange={(v) => handleUpdate('cookies.clearOnExit', v)}
                      />
                      <SettingToggle 
                        label="Workspace Isolation" 
                        description="Keep cookies restricted to their specific workspace jar." 
                        enabled={settings.cookies.workspaceIsolation}
                        onChange={(v) => handleUpdate('cookies.workspaceIsolation', v)}
                      />
                    </div>
                  </Section>
                </motion.div>
              )}

              {activeSection === 'GitHub Sync' && (
                <motion.div
                  key="github"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <Section title="Authentication">
                    <SettingInput 
                      label="GitHub Personal Access Token" 
                      description="Create a token with 'repo' scope at github.com/settings/tokens"
                      placeholder="ghp_xxxxxxxxxxxx"
                      value={settings.github.token}
                      type="password"
                      onChange={(v) => handleUpdate('github.token', v)}
                    />
                  </Section>

                  <Section title="Repository Link">
                    <div className="space-y-4">
                      <SettingInput 
                        label="Target Repository" 
                        description="Format: owner/repo"
                        placeholder="whitehats27/api-collections"
                        value={settings.github.repo}
                        onChange={(v) => handleUpdate('github.repo', v)}
                      />
                      <div className="grid grid-cols-2 gap-6">
                        <SettingInput 
                          label="Branch" 
                          placeholder="main"
                          value={settings.github.branch}
                          onChange={(v) => handleUpdate('github.branch', v)}
                        />
                        <SettingInput 
                          label="Root Path" 
                          description="Directory for collections"
                          placeholder="collections"
                          value={settings.github.path}
                          onChange={(v) => handleUpdate('github.path', v)}
                        />
                      </div>
                    </div>
                  </Section>

                  <Section title="Operational Sync">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
                        <div>
                          <div className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-tight">Pull Remote Updates</div>
                          <div className="text-[10px] text-[var(--text-dim)] mt-0.5">Fetch latest collection nodes from specified repository.</div>
                          {settings.github.lastPulledAt && (
                            <div className="text-[8px] text-[var(--brand)] font-mono mt-1 uppercase tracking-tighter">
                              Last Pulled: {new Date(settings.github.lastPulledAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={async () => {
                            if (!activeWorkspaceId || !profile?.id) return;
                            setIsPulling(true);
                            try {
                              const count = await GitHubService.pullUpdates(activeWorkspaceId, profile.id);
                              addToast({ type: 'success', message: `Uplink successful: Imported ${count} nodes.` });
                            } catch (e: any) {
                              addToast({ type: 'error', message: `Uplink failed: ${e.message}` });
                            } finally {
                              setIsPulling(false);
                            }
                          }}
                          disabled={isPulling || !settings.github.token || !settings.github.repo}
                          className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--brand)] hover:bg-[var(--brand)]/10 rounded-lg transition-all disabled:opacity-20"
                        >
                          {isPulling ? <RefreshCw size={14} className="animate-spin" /> : <CloudDownload size={14} />}
                          Pull Updates
                        </button>
                      </div>

                      <SettingToggle 
                        label="Background Synchronization" 
                        description="Automatically push local changes to GitHub in intervals (Experimental)." 
                        enabled={settings.github.autoSync}
                        onChange={(v) => handleUpdate('github.autoSync', v)}
                      />
                    </div>
                  </Section>
                </motion.div>
              )}

              {activeSection === 'Experimental' && (
                <motion.div
                  key="experimental"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <Section title="Beta Features">
                    <div className="space-y-4">
                      <SettingToggle 
                        label="Enabled Experimental Subsystem" 
                        description="Unlock cutting-edge features that are still in development." 
                        enabled={settings.experimental.enabled}
                        onChange={(v) => handleUpdate('experimental.enabled', v)}
                      />
                      {settings.experimental.enabled && (
                        <>
                          <SettingToggle 
                            label="New Editor Core" 
                            description="Use the high-performance unified editor for all tabs." 
                            enabled={settings.experimental.useNewEditor}
                            onChange={(v) => handleUpdate('experimental.useNewEditor', v)}
                          />
                          <SettingToggle 
                            label="Verbose Debug Logs" 
                            description="Capture every internal operation and event trace." 
                            enabled={settings.experimental.debugLogs}
                            onChange={(v) => handleUpdate('experimental.debugLogs', v)}
                          />
                        </>
                      )}
                    </div>
                  </Section>
                </motion.div>
              )}

              {activeSection === 'Diagnostics' && (
                <motion.div
                  key="diagnostics"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <Section title="Maintenance & Health">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
                        <div>
                          <div className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-tight">Application Storage</div>
                          <div className="text-[10px] text-[var(--text-dim)] mt-0.5">Clear all locally cached data and settings.</div>
                        </div>
                        <button 
                          onClick={handleClearCache}
                          className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                          Purge Storage
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
                        <div>
                          <div className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-tight">Configuration Backup</div>
                          <div className="text-[10px] text-[var(--text-dim)] mt-0.5">Export or import your current operations setup.</div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={handleExportSettings}
                            className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--brand)] hover:bg-[var(--brand)]/10 rounded-lg transition-all"
                          >
                            <Download size={14} />
                            Export
                          </button>
                          <label className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--brand)] hover:bg-[var(--brand)]/10 rounded-lg transition-all cursor-pointer">
                            <Upload size={14} />
                            Import
                            <input type="file" className="hidden" accept=".json" onChange={handleImportSettings} />
                          </label>
                        </div>
                      </div>
                    </div>
                  </Section>

                  <Section title="System Trace">
                    <div className="bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg font-mono text-[10px] p-4 text-[var(--text-dim)] space-y-2 max-h-40 overflow-y-auto">
                      <p><span className="text-[var(--brand)]">[SYSTEM]</span> Initializing diagnostics module...</p>
                      <p><span className="text-[var(--brand)]">[SYSTEM]</span> Kernel version: Putman-OS-Core-9</p>
                      <p><span className="text-yellow-500">[WARN]</span> High memory latency detected in tab sector B</p>
                      <p><span className="text-[var(--brand)]">[SYSTEM]</span> Sync manager operational (IDLE)</p>
                      <p><span className="text-blue-400">[INFO]</span> Persistence link secured via Supabase-Tunnel-1</p>
                      <p><span className="text-[var(--brand)]">[SYSTEM]</span> Awaiting next operation sequence...</p>
                    </div>
                  </Section>
                </motion.div>
              )}

              {activeSection === 'About' && (
                <motion.div
                  key="about"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8 flex flex-col items-center justify-center py-10"
                >
                   <div className="w-24 h-24 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mb-6">
                      <Terminal size={48} className="text-[var(--brand)]" />
                   </div>
                   <div className="text-center space-y-2">
                     <h2 className="text-2xl font-black text-[var(--text-main)] tracking-tighter uppercase italic">PUTMAN <span className="text-[var(--brand)]">v0.5.0-ALPHA</span></h2>
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-dim)]">Cortex API Management Suite</p>
                   </div>

                   <div className="w-full max-w-sm space-y-2 mt-8">
                      <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
                        <div className="flex items-center gap-3">
                           <Cpu size={14} className="text-[var(--border-strong)]" />
                           <span className="text-[9px] font-black uppercase text-[var(--text-dim)]">Runtime</span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">v18.16.0 (Node.js)</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
                        <div className="flex items-center gap-3">
                           <Clock size={14} className="text-[var(--border-strong)]" />
                           <span className="text-[9px] font-black uppercase text-[var(--text-dim)]">Up-Cycle</span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">04:22:11:09</span>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
                        <div className="flex items-center gap-3">
                           <HardDrive size={14} className="text-[var(--border-strong)]" />
                           <span className="text-[9px] font-black uppercase text-[var(--text-dim)]">Identifier</span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">CORTEX-X-RAI</span>
                      </div>
                   </div>

                   <div className="flex items-center gap-6 mt-8">
                      <button className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--brand)] transition-all">Protocol</button>
                      <button className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--brand)] transition-all">Uplink</button>
                      <button className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--brand)] transition-all flex items-center gap-2">
                        <RefreshCw size={12} />
                        Sync Check
                      </button>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-4">
    <h3 className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-[0.2em]">{title}</h3>
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-6 space-y-6">
      {children}
    </div>
  </div>
);

const SettingToggle: React.FC<{ 
  label: string; 
  description?: string; 
  enabled: boolean; 
  onChange: (v: boolean) => void 
}> = ({ label, description, enabled, onChange }) => (
  <div className="flex items-center justify-between">
    <div className="flex-1 pr-4">
      <div className="text-[11px] font-bold text-[var(--text-main)] uppercase tracking-tight">{label}</div>
      {description && <div className="text-[10px] text-[var(--text-dim)] mt-0.5">{description}</div>}
    </div>
    <button 
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative w-10 h-5 rounded-full transition-all duration-300",
        enabled ? "bg-[var(--brand)]" : "bg-[var(--border-strong)]"
      )}
    >
      <div className={cn(
        "absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300",
        enabled ? "left-6" : "left-1"
      )} />
    </button>
  </div>
);

const SettingInput: React.FC<{ 
  label: string; 
  description?: string; 
  placeholder?: string;
  value: string; 
  type?: string;
  onChange: (v: string) => void 
}> = ({ label, description, placeholder, value, type = 'text', onChange }) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">{label}</label>
    <input 
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg px-4 py-2.5 text-[11px] font-mono text-[var(--text-muted)] placeholder:text-[var(--border-strong)] focus:border-[var(--brand)]/50 outline-none transition-all"
    />
    {description && <p className="text-[9px] text-[var(--border-strong)] uppercase italic">{description}</p>}
  </div>
);

const SettingSelect: React.FC<{ 
  label: string; 
  description?: string; 
  value: string; 
  options: { value: string; label: string }[];
  onChange: (v: any) => void 
}> = ({ label, description, value, options, onChange }) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">{label}</label>
    <div className="relative">
      <select 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg px-4 py-2.5 text-[11px] font-bold text-[var(--text-muted)] appearance-none outline-none focus:border-[var(--brand)]/50 transition-all cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[var(--border-strong)] pointer-events-none" />
    </div>
    {description && <p className="text-[9px] text-[var(--border-strong)] uppercase italic">{description}</p>}
  </div>
);


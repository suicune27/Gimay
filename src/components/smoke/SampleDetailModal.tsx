import React from 'react';
import { Activity, X } from 'lucide-react';

interface SampleDetailModalProps {
  sample: any;
  activeRequest: any;
  onClose: () => void;
}

export const SampleDetailModal: React.FC<SampleDetailModalProps> = ({ sample, activeRequest, onClose }) => {
  const [modalTab, setModalTab] = React.useState<'request' | 'response'>('request');

  if (!sample) return null;

  const truncateBody = (body: any, maxBytes: number = 100000) => {
    if (!body) return '';
    const rawString = typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body);
    if (rawString.length > maxBytes) {
      return `${rawString.slice(0, maxBytes)}\n\n... [Body truncated. Total size: ${(rawString.length / 1024).toFixed(1)} KB] ...`;
    }
    return rawString;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-deep)]/50">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Activity size={12} className="text-[#3ECF8E]" />
              Sample #{sample.id} Details
            </h3>
            <p className="text-[8px] text-[var(--text-dim)] uppercase tracking-widest mt-0.5">
              Executed at {sample.timestamp} | Latency: {sample.latency}ms
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-dim)] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-deep)]/20 px-4">
          <button
            onClick={() => setModalTab('request')}
            className={`px-4 py-2.5 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${
              modalTab === 'request' ? 'border-[#3ECF8E] text-[#3ECF8E]' : 'border-transparent text-[var(--text-dim)] hover:text-white'
            }`}
          >
            Request Context
          </button>
          <button
            onClick={() => setModalTab('response')}
            className={`px-4 py-2.5 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${
              modalTab === 'response' ? 'border-[#3ECF8E] text-[#3ECF8E]' : 'border-transparent text-[var(--text-dim)] hover:text-white'
            }`}
          >
            Response Context
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
          {modalTab === 'request' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Target URL</span>
                <div className="flex gap-2 items-center p-2.5 bg-[var(--bg-deep)]/60 border border-[var(--border-subtle)] rounded-lg font-mono text-[10px] text-white">
                  <span className="px-1.5 py-0.5 rounded bg-[#3ECF8E]/10 text-[#3ECF8E] font-black text-[9px]">
                    {sample.request?.method || 'GET'}
                  </span>
                  <span className="break-all">{sample.request?.url || activeRequest?.url || ''}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Request Headers</span>
                {sample.request?.headers && Object.keys(sample.request.headers).length > 0 ? (
                  <div className="border border-[var(--border-subtle)] rounded-lg overflow-hidden bg-[var(--bg-deep)]/20">
                    <table className="w-full text-left font-mono text-[9px] border-collapse">
                      <thead className="bg-[var(--bg-deep)] text-[8px] font-black uppercase border-b border-[var(--border-subtle)]">
                        <tr><th className="p-2 pl-3">Header Name</th><th className="p-2 pr-3">Header Value</th></tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]/50">
                        {Object.entries(sample.request.headers).map(([key, val]) => (
                          <tr key={key}>
                            <td className="p-2 pl-3 font-semibold text-[var(--text-dim)]">{key}</td>
                            <td className="p-2 pr-3 text-white break-all">{String(val)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-[9px] font-bold text-[var(--text-dim)] italic p-2 border border-dashed border-[var(--border-subtle)] rounded-lg text-center uppercase tracking-widest">
                    No Custom Headers Sent
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Request Body</span>
                {sample.request?.body ? (
                  <pre className="p-3 bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg font-mono text-[10px] text-white overflow-x-auto custom-scrollbar whitespace-pre-wrap max-h-40">
                    {truncateBody(sample.request.body)}
                  </pre>
                ) : (
                  <div className="text-[9px] font-bold text-[var(--text-dim)] italic p-2 border border-dashed border-[var(--border-subtle)] rounded-lg text-center uppercase tracking-widest">
                    No Request Payload Sent
                  </div>
                )}
              </div>
            </div>
          )}

          {modalTab === 'response' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">HTTP Status</span>
                <div className="flex gap-4 items-center p-2.5 bg-[var(--bg-deep)]/60 border border-[var(--border-subtle)] rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                      sample.success ? 'bg-[#3ECF8E]/10 text-[#3ECF8E] border border-[#3ECF8E]/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {sample.status}
                    </span>
                    <span className="text-[10px] font-bold text-white uppercase tracking-tight">
                      {sample.response?.statusText || (sample.success ? 'OK' : 'Error')}
                    </span>
                  </div>
                  <div className="w-px h-4 bg-[var(--border-subtle)]" />
                  <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest font-black">
                    Latency: <span className="text-white font-mono font-normal">{sample.latency}ms</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Response Headers</span>
                {sample.response?.headers && Object.keys(sample.response.headers).length > 0 ? (
                  <div className="border border-[var(--border-subtle)] rounded-lg overflow-hidden bg-[var(--bg-deep)]/20">
                    <table className="w-full text-left font-mono text-[9px] border-collapse">
                      <thead className="bg-[var(--bg-deep)] text-[8px] font-black uppercase border-b border-[var(--border-subtle)]">
                        <tr><th className="p-2 pl-3">Header Name</th><th className="p-2 pr-3">Header Value</th></tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]/50">
                        {Object.entries(sample.response.headers).map(([key, val]) => (
                          <tr key={key}>
                            <td className="p-2 pl-3 font-semibold text-[var(--text-dim)]">{key}</td>
                            <td className="p-2 pr-3 text-white break-all">{String(val)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-[9px] font-bold text-[var(--text-dim)] italic p-2 border border-dashed border-[var(--border-subtle)] rounded-lg text-center uppercase tracking-widest">
                    No Response Headers Returned
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Response Body</span>
                {sample.response?.body ? (
                  <pre className="p-3 bg-[var(--bg-deep)] border border-[var(--border-subtle)] rounded-lg font-mono text-[10px] text-white overflow-x-auto custom-scrollbar whitespace-pre-wrap max-h-60 max-w-full">
                    {truncateBody(sample.response.body)}
                  </pre>
                ) : (
                  <div className="text-[9px] font-bold text-[var(--text-dim)] italic p-2 border border-dashed border-[var(--border-subtle)] rounded-lg text-center uppercase tracking-widest">
                    No Response Body Returned
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex justify-end bg-[var(--bg-deep)]/30">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--bg-deep)] border border-[var(--border-subtle)] hover:border-[#3ECF8E]/30 rounded-lg text-[9px] font-black text-white hover:text-[#3ECF8E] uppercase tracking-widest transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

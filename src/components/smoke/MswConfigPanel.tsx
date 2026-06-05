import React from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { RequestService } from '../../services/RequestService';

interface MswConfigPanelProps {
  mswEnabled: boolean;
  mswStatus: number;
  mswLatency: number;
  mswResponseType: string;
  mswResponseBody: string;
  isRunning: boolean;
  onMswEnabledChange: (enabled: boolean) => void;
  onMswStatusChange: (status: number, statusText: string) => void;
  onMswLatencyChange: (latency: number) => void;
  onMswResponseBodyChange: (body: string) => void;
  onMswResponseTypeChange: (type: string) => void;
}

const syncMswConfig = (updates: Partial<typeof RequestService.mswConfig>) => {
  const updated = {
    enabled: updates.enabled !== undefined ? updates.enabled : RequestService.mswConfig.enabled,
    status: updates.status !== undefined ? updates.status : RequestService.mswConfig.status,
    statusText: updates.statusText !== undefined ? updates.statusText : RequestService.mswConfig.statusText,
    latency: updates.latency !== undefined ? updates.latency : RequestService.mswConfig.latency,
    responseType: updates.responseType !== undefined ? updates.responseType : RequestService.mswConfig.responseType,
    responseBody: updates.responseBody !== undefined ? updates.responseBody : RequestService.mswConfig.responseBody,
  };
  RequestService.saveMswConfig(updated);
};

const statusCodeToText = (code: number): string => {
  const map: Record<number, string> = {
    200: 'OK', 201: 'Created', 204: 'No Content',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
    404: 'Not Found', 429: 'Too Many Requests', 500: 'Internal Server Error',
  };
  return map[code] || 'OK';
};

export const MswConfigPanel: React.FC<MswConfigPanelProps> = ({
  mswEnabled,
  mswStatus,
  mswLatency,
  mswResponseType,
  mswResponseBody,
  isRunning,
  onMswEnabledChange,
  onMswStatusChange,
  onMswLatencyChange,
  onMswResponseBodyChange,
  onMswResponseTypeChange,
}) => {
  return (
    <div className="bg-[#09090B]/60 border border-[#151518] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "p-2 rounded-xl border transition-all duration-300",
            mswEnabled
              ? "bg-purple-500/10 border-purple-500/20 text-purple-400 animate-pulse"
              : "bg-[#101012] border-[#1C1C22] text-[#555]"
          )}>
            <Shield size={16} />
          </div>
          <div className="text-left">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#E4E4E7] font-mono flex items-center gap-1.5">
              Virtual MSW Network Interceptor
              {mswEnabled && (
                <span className="text-[7.5px] bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono px-1.5 py-0.5 rounded tracking-widest uppercase font-black animate-pulse">
                  Active Intercept
                </span>
              )}
            </h3>
            <p className="text-[8px] text-[#55555C] font-mono leading-relaxed uppercase mt-0.5">
              Replaces network socket fetches with instant, zero-latency micro-responses to prevent loop-based execution Out Of Memory (OOM) leaks.
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer select-none shrink-0 pl-4">
          <input
            type="checkbox"
            checked={mswEnabled}
            disabled={isRunning}
            onChange={(e) => onMswEnabledChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-8 h-4 bg-[#151518] rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-[#555] peer-checked:after:bg-purple-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500/10 border border-[#222] peer-checked:border-purple-400/30" />
        </label>
      </div>

      {mswEnabled && (
        <div className="pt-3 border-t border-[#121215] grid grid-cols-12 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="col-span-4 space-y-1.5 text-left">
            <label className="text-[9px] font-black text-purple-400 uppercase tracking-wider font-mono block">Mock HTTP Status</label>
            <select
              disabled={isRunning}
              value={mswStatus}
              onChange={(e) => {
                const code = parseInt(e.target.value) || 200;
                const text = statusCodeToText(code);
                onMswStatusChange(code, text);
                syncMswConfig({ status: code, statusText: text });
              }}
              className="w-full bg-[#050508] border border-[#151518] px-3 py-2 rounded-xl text-[11px] font-mono text-white outline-none focus:border-purple-500/30"
            >
              <option value={200}>200 OK</option>
              <option value={201}>201 Created</option>
              <option value={204}>204 No Content</option>
              <option value={400}>400 Bad Request</option>
              <option value={401}>401 Unauthorized</option>
              <option value={403}>403 Forbidden</option>
              <option value={404}>404 Not Found</option>
              <option value={429}>429 Too Many Requests</option>
              <option value={505}>500 Internal Server Error</option>
            </select>
            <p className="text-[8px] text-[#55555C] font-mono uppercase">Simulated status return</p>
          </div>

          <div className="col-span-4 space-y-1.5 text-left">
            <div className="flex justify-between items-center">
              <label className="text-[9px] font-black text-purple-400 uppercase tracking-wider font-mono">Mock Latency (ms)</label>
              <span className="text-[9px] font-mono font-bold text-white">{mswLatency}ms</span>
            </div>
            <input
              type="range"
              disabled={isRunning}
              min={0}
              max={100}
              step={5}
              value={mswLatency}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                onMswLatencyChange(val);
                syncMswConfig({ latency: val });
              }}
              className="w-full accent-purple-500 bg-[#050508] h-1.5 rounded-lg appearance-none cursor-pointer mt-2.5 border border-[#151518]"
            />
            <p className="text-[8px] text-[#55555C] font-mono uppercase">Keeps runs super fast and steady</p>
          </div>

          <div className="col-span-4 space-y-1.5 text-left">
            <label className="text-[9px] font-black text-purple-400 uppercase tracking-wider font-mono block">Preset Fast-Mock Payload</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: '🔐 AUTH', body: '{\n  "status": "success",\n  "msw_mocked": true,\n  "message": "Auth Session Active",\n  "token": "msw_jwt_mocked_token_sequence_xyz123"\n}' },
                { label: '👥 USERS', body: '{\n  "status": "success",\n  "count": 3,\n  "users": [\n    {"id": 1, "name": "John Doe", "role": "admin"},\n    {"id": 2, "name": "Jane Smith", "role": "editor"},\n    {"id": 3, "name": "Bob Martin", "role": "viewer"}\n  ]\n}' },
                { label: '💚 HEALTH', body: '{\n  "status": "healthy",\n  "uptime_secs": 18231,\n  "engine": "v8-isolated-context"\n}' },
                { label: '📄 PLAIN OK', body: 'OK', isText: true },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    onMswResponseBodyChange(preset.body);
                    if (preset.isText) {
                      onMswResponseTypeChange('text');
                      syncMswConfig({ responseBody: preset.body, responseType: 'text' });
                    } else {
                      onMswResponseTypeChange('json');
                      syncMswConfig({ responseBody: preset.body, responseType: 'json' });
                    }
                  }}
                  className="py-1 px-2 text-[8px] text-[#888] font-bold border border-[#1C1C22] bg-[#0A0A0E] rounded-md hover:text-purple-400 hover:border-purple-500/20 hover:bg-purple-500/5 transition-all text-ellipsis overflow-hidden whitespace-nowrap uppercase font-mono cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-12 space-y-1.5 pt-2 text-left">
            <label className="text-[9px] font-black text-purple-400 uppercase tracking-wider font-mono block">Custom MSW Intercepted Response JSON Body</label>
            <textarea
              disabled={isRunning}
              rows={3}
              value={mswResponseBody}
              onChange={(e) => {
                const body = e.target.value;
                onMswResponseBodyChange(body);
                syncMswConfig({ responseBody: body });
              }}
              className="w-full bg-[#050508] border border-[#151518] px-3.5 py-2.5 rounded-xl text-[10px] font-mono text-white outline-none focus:border-purple-500/30 no-scrollbar select-text leading-relaxed font-semibold transition-all"
              placeholder="Paste or write mock JSON response payload returned by MSW service handler..."
            />
            <div className="flex items-center justify-between text-[7.5px] text-[#555] font-mono uppercase">
              <span>* MSW intercept overrides actual request execution for loop tests</span>
              {mswResponseType === 'json' ? (
                <span className="text-purple-400/80 font-black">VALIDATED JSON CONTENTTYPE</span>
              ) : (
                <span className="text-amber-500/80 font-black">RAW TEXT CONTENTTYPE</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

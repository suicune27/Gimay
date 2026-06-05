import { PersistenceService } from './PersistenceService';
import { useStore } from '../store/useStore';

interface PersistSmokeLogInput {
  enabled: boolean;
  runLabel: string;
  requestId?: string;
  workspaceId?: string | null;
  fallbackUserId?: string;
  durationMs: number;
  samples: Array<any>;
  metadata?: Record<string, any>;
}

export class SmokeLogService {
  static async persistTemporaryRunLog(input: PersistSmokeLogInput): Promise<boolean> {
    if (!input.enabled) return false;

    try {
      const state = useStore.getState();
      const userId = state.profile?.id || input.fallbackUserId;
      const workspaceId = input.workspaceId || state.activeWorkspaceId;
      if (!userId || !workspaceId) return false;

      const compactSample = (s: any) => {
        const rawPreview = typeof s.responsePreview === 'string'
          ? s.responsePreview
          : (typeof s.responseBody === 'string' ? s.responseBody : '');
        return {
          id: s.id,
          timestamp: s.timestamp,
          latency: s.latency,
          status: s.status,
          statusCode: typeof s.statusCode === 'number' ? s.statusCode : (typeof s.status === 'number' ? s.status : null),
          success: !!s.success,
          error: s.error || undefined,
          responsePreview: rawPreview ? rawPreview.slice(0, 2000) : '',
          requestName: s.requestName || undefined,
          requestMethod: s.requestMethod || undefined
        };
      };

      const all = (input.samples || []).map(compactSample);
      const successTop50 = all.filter((s: any) => s.success).slice(-50);
      const failedTop50 = all.filter((s: any) => !s.success).slice(-50);
      const compactSamples = [...successTop50, ...failedTop50];

      const errors = failedTop50
        .map((s: any) => ({
          id: s.id,
          timestamp: s.timestamp,
          status: s.status,
          statusCode: s.statusCode,
          error: s.error || 'Request failed'
        }));

      const result = await PersistenceService.createScriptLog({
        user_id: userId,
        workspace_id: workspaceId,
        request_id: input.requestId,
        duration: Math.max(0, Math.round(input.durationMs || 0)),
        logs: [{
          type: 'smoke-temp-log',
          runLabel: input.runLabel,
          createdAt: new Date().toISOString(),
          samples: compactSamples,
          successTop50,
          failedTop50
        }],
        errors,
        variables_changed: {
          mode: 'temporary',
          ...input.metadata
        }
      });

      return !!result;
    } catch {
      return false;
    }
  }
}
import { isElectron } from '../../lib/platform';

let store: any = null;

export function registerPersistenceStore(s: any) {
  store = s;
}

export function getStore() {
  return store;
}

export function isOffline(): boolean {
  if (typeof window !== 'undefined' && !window.navigator.onLine) return true;
  return store?.getState()?.syncMetadata?.isOffline ?? false;
}

export function setOffline(offline: boolean) {
  if (store) {
    store.getState().updateSyncMetadata({ isOffline: offline });
    const { syncManager } = require('../SyncService');
    syncManager.setStatus(offline ? 'offline' : 'idle');
  }
}

export async function runResilientAction<T>(
  onlineAction: () => Promise<T>,
  offlineAction: () => T,
  enqueueAction: (offlineResult: T) => void
): Promise<T> {
  if (isElectron() || isOffline()) {
    console.log('[Persistence] Offline-First Priority Active (Desktop/Local Mode). Execution local-first.');
    const result = offlineAction();
    try { enqueueAction(result); } catch (syncErr) {
      console.warn('[Persistence] Async sync enqueuing failed:', syncErr);
    }
    return result;
  }

  try {
    return await onlineAction();
  } catch (err: any) {
    const isNetworkError = err.message?.includes('Network Error') ||
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('timeout') ||
      err.code === 'ECONNABORTED' ||
      err.status === 0;

    if (isNetworkError) {
      console.warn('[Persistence] Database write request timed out. Transitioning to local cache buffer.');
      setOffline(true);
      const result = offlineAction();
      enqueueAction(result);
      return result;
    }
    throw err;
  }
}

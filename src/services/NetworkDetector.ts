type NetworkCallback = (isOnline: boolean) => void;

class NetworkDetector {
  private listeners: Set<NetworkCallback> = new Set();
  private _isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private _wasOffline: boolean = false;
  private initialized = false;

  get isOnline(): boolean {
    return this._isOnline;
  }

  get wasOffline(): boolean {
    return this._wasOffline;
  }

  init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    window.addEventListener('online', () => {
      const wasOffline = !this._isOnline;
      this._isOnline = true;
      if (wasOffline) {
        this._wasOffline = true;
        console.log('[NetworkDetector] Connection restored. Notifying listeners.');
      }
      this.notify(true);
    });

    window.addEventListener('offline', () => {
      this._isOnline = false;
      console.log('[NetworkDetector] Connection lost.');
      this.notify(false);
    });

    // Periodic check for spotty connections
    setInterval(() => {
      const currentState = navigator.onLine;
      if (currentState !== this._isOnline) {
        this._isOnline = currentState;
        this.notify(currentState);
        if (currentState) {
          this._wasOffline = true;
        }
      }
    }, 5000);
  }

  onConnectionChange(callback: NetworkCallback): () => void {
    this.listeners.add(callback);
    // Fire immediately with current state
    callback(this._isOnline);
    return () => {
      this.listeners.delete(callback);
    };
  }

  clearReconnectionFlag(): void {
    this._wasOffline = false;
  }

  private notify(isOnline: boolean): void {
    this.listeners.forEach(cb => {
      try {
        cb(isOnline);
      } catch (err) {
        console.error('[NetworkDetector] Listener error:', err);
      }
    });
  }
}

export const networkDetector = new NetworkDetector();

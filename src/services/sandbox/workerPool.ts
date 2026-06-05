import { WORKER_SOURCE } from './workerSource';

let cachedWorkerUrl: string | null = null;

export class WorkerPool {
  private static pool: Worker[] = [];
  private static active: Set<Worker> = new Set();
  private static MAX_POOL_SIZE = 32;

  static acquire(): Worker {
    let worker: Worker;
    if (this.pool.length > 0) {
      worker = this.pool.pop()!;
      (worker as any).useCount = ((worker as any).useCount || 0) + 1;
    } else {
      if (!cachedWorkerUrl) {
        const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
        cachedWorkerUrl = URL.createObjectURL(blob);
      }
      worker = new Worker(cachedWorkerUrl);
      (worker as any).useCount = 1;
    }
    this.active.add(worker);
    return worker;
  }

  static release(worker: Worker) {
    this.active.delete(worker);
    delete (worker as any).onTerminate;
    worker.onerror = null;
    worker.onmessage = null;

    const count = (worker as any).useCount || 0;
    if (count < 100 && this.pool.length < this.MAX_POOL_SIZE) {
      this.pool.push(worker);
    } else {
      try { worker.terminate(); } catch {}
    }
  }

  static terminateWorker(worker: Worker) {
    this.active.delete(worker);
    delete (worker as any).onTerminate;
    worker.onerror = null;
    worker.onmessage = null;
    try { worker.terminate(); } catch {}
  }

  static clear() {
    while (this.pool.length > 0) {
      const worker = this.pool.pop();
      if (worker) {
        delete (worker as any).onTerminate;
        try { worker.terminate(); } catch {}
      }
    }

    const activeCopy = Array.from(this.active);
    activeCopy.forEach(worker => {
      if (typeof (worker as any).onTerminate === 'function') {
        try { (worker as any).onTerminate(); } catch {}
      } else {
        try { worker.terminate(); } catch {}
      }
    });
    this.active.clear();
  }
}

/**
 * SmokeTestPool — Zero-allocation primitives for high-throughput smoke testing.
 *
 * Eliminates GC pressure at 100 threads × 10000 loops by:
 *   - Pre-allocating a fixed-capacity sample ring buffer (no push/shift/splice)
 *   - Pooling + reusing request execution objects
 *   - Caching compiled scripts (avoid re-compiling with new Function() every iteration)
 *   - Providing a batch GC helper that yields between chunks
 */

import { RequestData } from '../types';

// ─── Sample Ring Buffer ──────────────────────────────────────────────────────

export interface Sample {
  id: number;
  timestamp: string;
  latency: number;
  status: number | string;
  success: boolean;
  error?: string;
  requestName?: string;
  requestMethod?: string;
}

export class SampleBuffer {
  private readonly buf: (Sample | null)[];
  private readonly cap: number;
  private write = 0;
  private _size = 0;

  constructor(capacity = 60) {
    this.cap = capacity;
    this.buf = new Array(capacity).fill(null);
  }

  /** Push a sample — never allocates after construction. */
  push(s: Sample): void {
    this.buf[this.write] = s;
    this.write = (this.write + 1) % this.cap;
    if (this._size < this.cap) this._size++;
  }

  /** Read all samples in insertion order — returns a new array (only allocation). */
  read(): Sample[] {
    const result: Sample[] = new Array(this._size);
    const start = this._size < this.cap ? 0 : this.write;
    for (let i = 0; i < this._size; i++) {
      result[i] = this.buf[(start + i) % this.cap]!;
    }
    return result;
  }

  /** Read up to `n` newest samples. */
  readLast(n: number): Sample[] {
    const count = Math.min(n, this._size);
    const result: Sample[] = new Array(count);
    const start = this._size < this.cap ? 0 : this.write;
    for (let i = 0; i < count; i++) {
      result[i] = this.buf[(start + this._size - count + i) % this.cap]!;
    }
    return result;
  }

  get size(): number { return this._size; }
  get capacity(): number { return this.cap; }

  /**
   * Zero-allocation push — reuses the existing object at the write slot.
   * After the buffer fills up (capacity pushes), this never allocates.
   */
  writeSample(
    id: number, timestamp: string, latency: number, status: number | string,
    success: boolean, error?: string, requestName?: string, requestMethod?: string,
    requestUrl?: string
  ): void {
    let slot = this.buf[this.write];
    if (slot) {
      // Reuse existing slot — mutate in place
      slot.id = id;
      slot.timestamp = timestamp;
      slot.latency = latency;
      slot.status = status;
      slot.success = success;
      slot.error = error;
      slot.requestName = requestName;
      slot.requestMethod = requestMethod;
    } else {
      // First fill — allocate exactly once per slot
      this.buf[this.write] = {
        id, timestamp, latency, status, success, error,
        requestName, requestMethod
      };
    }
    this.write = (this.write + 1) % this.cap;
    if (this._size < this.cap) this._size++;
  }

  clear(): void {
    this.write = 0;
    this._size = 0;
    // Don't null out — just reset pointers. Old samples become unreachable.
  }
}

// ─── Metrics Collector (mutable, never allocates) ────────────────────────────

export interface RunMetrics {
  completed: number;
  totalLatency: number;
  minLatency: number;
  maxLatency: number;
  successCount: number;
}

export function createMetrics(): RunMetrics {
  return { completed: 0, totalLatency: 0, minLatency: Infinity, maxLatency: -Infinity, successCount: 0 };
}

export function recordSample(metrics: RunMetrics, duration: number, success: boolean): void {
  metrics.completed++;
  metrics.totalLatency += duration;
  if (duration < metrics.minLatency) metrics.minLatency = duration;
  if (duration > metrics.maxLatency) metrics.maxLatency = duration;
  if (success) metrics.successCount++;
}

// ─── Request Object Pool ──────────────────────────────────────────────────────

const REQUEST_TEMPLATE: Partial<RequestData> = {
  method: 'GET',
  url: '',
  headers: [],
  params: [],
  settings: { followRedirects: true, timeout: 5000, maxRedirects: 10 },
  auth: { type: 'none' },
};

/**
 * A simple request object pool. Pre-allocates `size` entries.
 * acquire() returns a recycled entry — mutate it in-place.
 * release() resets fields to defaults so the next acquire() gets a clean slate.
 */
export class RequestPool {
  private pool: RequestData[] = [];

  constructor(size = 10) {
    for (let i = 0; i < size; i++) {
      this.pool.push(this.fresh());
    }
  }

  private fresh(): RequestData {
    return { ...REQUEST_TEMPLATE } as RequestData;
  }

  acquire(): RequestData {
    const req = this.pool.pop();
    if (req) return req;
    // Pool exhausted — create a fresh one (rare after warmup)
    return this.fresh();
  }

  release(req: RequestData): void {
    // Reset mutable fields to defaults
    req.id = '';
    req.name = '';
    req.method = 'GET';
    req.url = '';
    req.headers = [];
    req.params = [];
    req.settings = { followRedirects: true, timeout: 5000, maxRedirects: 10 };
    req.pre_request_script = '';
    req.test_script = '';
    req.collection_id = '';
    req.auth = { type: 'none' };
    this.pool.push(req);
  }

  get size(): number { return this.pool.length; }
}

// ─── Script Compilation Cache ────────────────────────────────────────────────

const scriptCache = new Map<string, (...args: any[]) => any>();

/**
 * Compile a script once, cache it forever. Avoids `new Function()` per iteration.
 */
export function compileScript(key: string, body: string): (...args: any[]) => any {
  const cached = scriptCache.get(key);
  if (cached) return cached;
  try {
    const fn = new Function('context', body) as (...args: any[]) => any;
    scriptCache.set(key, fn);
    return fn;
  } catch {
    // Return a no-op on parse error
    const noop = () => {};
    scriptCache.set(key, noop);
    return noop;
  }
}

export function clearScriptCache(): void {
  scriptCache.clear();
}

// ─── Batch GC Helper ─────────────────────────────────────────────────────────

/**
 * After `every` iterations, yield to the event loop so V8 can GC.
 * Calling `gc()` if exposed speeds up scavenging.
 */
export async function maybeGC(iteration: number, every = 500): Promise<void> {
  if (iteration % every !== 0) return;
  await new Promise(r => setTimeout(r, 0));
  if (typeof (globalThis as any).gc === 'function') {
    try { (globalThis as any).gc(); } catch { /* no-op */ }
  }
}

// ─── Pre-Allocated Strings ──────────────────────────────────────────────────

/** Static string used for payload/body fields to avoid allocating the same string repeatedly. */
export const PAYLOAD_TRUNCATED = '[Detailed payload logging suspended for memory optimization]';

// ─── Cancel Token (replaces per-iteration AbortController) ──────────────────

export interface CancelToken {
  aborted: boolean;
}

export function createCancelToken(): CancelToken {
  return { aborted: false };
}

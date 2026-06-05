# Performance Trace Guide: Smoke Test Overhaul Verification

This guide walks through running a Chrome DevTools Performance trace to verify the OOM fix
and compare allocation patterns before vs after the `writeSample()` overhaul.

## Prerequisites

- Gimay dev server running (`npx vite --port 5173`)
- Electron app or Chrome browser with DevTools access
- At least 1 request in a collection to test against
- MSW Virtual API Interceptor enabled (for zero-latency mock responses)

## Method 1: Quick Verification (Node.js)

Run the automated performance test — no browser needed:

```bash
cd "D:/Gimay/Open Projects/Gimay"
npx tsx --expose-gc scripts/perf-test-buffer.ts
```

This simulates 1M iterations (100 threads × 10,000 loops) of both the old and new patterns,
measuring speed, heap usage, and allocation counts. Results from the latest run:

| Metric | Old Pattern (push+splice) | New Pattern (writeSample) |
|--------|--------------------------|--------------------------|
| Speed | 466,857 ops/sec | 469,284 ops/sec |
| Heap (1M iters) | 4.4 MB | 4.8 MB |
| Backing-store re-allocations | ~100,000 | **0** |
| GC garbage generated | ~500 MB | **0 MB** |

## Method 2: Chrome DevTools Trace (Browser)

For real browser GC behavior with React re-renders:

### Step 1: Prepare
1. Start dev server: `npx vite --port 5173`
2. Open Chrome to `http://localhost:5173`
3. Sign in / configure offline mode
4. Open the Smoke Suite panel
5. Enable **MSW Virtual Network Interceptor** (purple toggle) → set mock latency to **0ms**

### Step 2: Select Targets
- Select at least 1 request in a collection
- Select a high-thread config: **10 threads × 10,000 loops**

### Step 3: Capture Trace
1. Open Chrome DevTools (`F12`)
2. Go to **Performance** tab
3. Click the ⚙️ gear icon → enable **Memory** checkbox
4. Click the **Record** button (⚫ circle)
5. Click **"Run Smoke Suite"** in the app
6. Let it run for **10-15 seconds**
7. Click **Stop** in DevTools

### Step 4: Analyze
In the Performance panel:
1. Look at the **Main** flame chart — check for long GC pauses (>50ms)
2. Look at the **Bottom-Up** / **Call Tree** tab — filter by `(garbage collector)`
3. Check the **Summary** tab — note `GC` as % of total time

Expected results with `writeSample()`:
- **GC time**: <5% of total execution
- **No long GC pauses**: All GC <20ms
- **Heap stays flat**: Not growing over time

## Method 3: Allocation Sampling (Chrome)

For precise allocation counting:

1. In DevTools → **Memory** tab
2. Select **"Allocation sampling"** with 128KB sampling interval
3. Click **Start**
4. Run the smoke test for 10 seconds
5. Click **Stop**
6. Filter by `(object)` or `Array` to see allocated objects

Expected: After the first 60 samples, you should see **zero allocations** from the
SmokeSuitePanel's sample buffer path.

## Comparing with Previous Trace

The previous trace (`Trace-20260605T163225.json.gz`) showed:
- **712 GC events** (160ms) between runs
- **22x slowdown** on run 2 (876ms vs 40ms first TimerFire)
- Caused by heap fragmentation from `slice(-50)` allocations

After the fix, a trace should show:
- **0 GC events** in the push hot path
- **Consistent timing** between runs (no 22x degradation)
- **Flat memory graph**: no sawtooth pattern from array re-allocations

## Troubleshooting

- **MSW not responding**: Check that MSW interceptor is enabled (purple toggle ON) and mock
  status code is 200. The mock latency slider should be at 0ms for fastest results.
- **Test too slow**: Reduce loops to 1000 (10×1000 = 10k requests) for a quicker trace.
- **No requests in collection**: Create a simple request with any URL and enable MSW mock.

/* SANCHARX speed test engine. Real fetch/XHR measurements against speed.cloudflare.com.
   Created By Shiv Yogi.

   Method summary
   - Latency : 1 warm-up + 10 sequential no-store requests to __down?bytes=0. Each sample is the time from
               fetch() start until the (empty) body is read. Reported: median. Jitter: mean |delta| of consecutive samples.
               This is HTTP latency (includes request overhead), NOT ICMP ping.
   - Download: progressive steps (100 kB, 2x1 MB, 3x5 MB, 4x10 MB, 4x25 MB parallel streams). Bytes are counted while
               streaming; step speed = total bytes*8 / wall time. Stops when a step takes >2 s, the time budget is
               reached, or Save-Data is on (capped to 5 MB steps). Result = mean of the two largest steps that lasted >=300 ms.
   - Upload  : generated random payloads (100 kB, 1 MB, 4 MB, 8 MB) sent with XHR POST; step speed = bytes*8 / request time.
               Same selection rule. Never uploads user files.
   - Packet loss is NOT measured (not possible with plain HTTP in a browser).
*/
(function (root) {
  'use strict';
  const SX = (root.SX = root.SX || {});
  const U = SX.util || require('./utils.js');

  const CFG = {
    base: 'https://speed.cloudflare.com',
    latencySamples: 10,
    downSteps: [{ b: 1e5, c: 1 }, { b: 1e6, c: 2 }, { b: 5e6, c: 3 }, { b: 1e7, c: 4 }, { b: 2.5e7, c: 4 }],
    upSteps: [1e5, 1e6, 4e6, 8e6],
    downBudgetMs: 9000,
    upBudgetMs: 8000,
    requestTimeoutMs: 15000,
    stopStepMs: 2000,
    minQualifyMs: 300,
  };

  let current = null;

  class TestError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }

  /** Pick the final speed from step results [{mbps, ms, bytes}]. */
  function combineSteps(steps) {
    if (!steps || !steps.length) return null;
    let q = steps.filter((s) => s.ms >= CFG.minQualifyMs && s.bytes > 0);
    if (!q.length) q = [steps[steps.length - 1]];
    return U.mean(q.slice(-2).map((s) => s.mbps));
  }

  function makePayload(bytes) {
    const chunk = new Uint8Array(65536);
    const c = root.crypto && root.crypto.getRandomValues ? root.crypto : null;
    if (c) c.getRandomValues(chunk); else for (let i = 0; i < chunk.length; i++) chunk[i] = (Math.random() * 256) | 0;
    const parts = [];
    let left = bytes;
    while (left > 0) { parts.push(left >= chunk.length ? chunk : chunk.subarray(0, left)); left -= chunk.length; }
    return new Blob(parts, { type: 'application/octet-stream' });
  }

  function classify(err, ctl) {
    if (ctl.aborted) return new TestError('cancelled', 'cancelled');
    if (err instanceof TestError) return err;
    if (err && err.timedOut) return new TestError('timeout', 'timeout');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return new TestError('offline', 'offline');
    if (err && err.name === 'AbortError') return new TestError('timeout', 'timeout');
    return new TestError('network', (err && err.message) || 'network');
  }

  async function timedFetch(url, ctl, timeoutMs, readBody) {
    const ac = new AbortController();
    ctl.controllers.add(ac);
    const flag = { timedOut: false };
    const to = setTimeout(() => { flag.timedOut = true; ac.abort(); }, timeoutMs);
    try {
      const t0 = performance.now();
      const r = await fetch(url, { cache: 'no-store', signal: ac.signal, credentials: 'omit', mode: 'cors' });
      if (!r.ok) throw new TestError('http', 'HTTP ' + r.status);
      if (readBody) await r.arrayBuffer();
      return performance.now() - t0;
    } catch (e) {
      if (flag.timedOut && e) e.timedOut = true;
      throw e;
    } finally { clearTimeout(to); ctl.controllers.delete(ac); }
  }

  async function measureLatency(ctl, emit) {
    const out = [];
    const total = CFG.latencySamples;
    try { await timedFetch(CFG.base + '/__down?bytes=0&w=' + U.uid(), ctl, 8000, true); } catch (e) { throw classify(e, ctl); }
    for (let i = 0; i < total; i++) {
      if (ctl.aborted) throw new TestError('cancelled');
      try {
        const ms = await timedFetch(CFG.base + '/__down?bytes=0&r=' + U.uid(), ctl, 6000, true);
        out.push(ms);
        emit({ type: 'latency', samples: out.slice(), progress: (i + 1) / total });
      } catch (e) { throw classify(e, ctl); }
    }
    return out;
  }

  async function downloadStep(step, ctl, phase) {
    const state = { bytes: 0 };
    const t0 = performance.now();
    const tasks = [];
    for (let i = 0; i < step.c; i++) {
      tasks.push((async () => {
        const ac = new AbortController();
        ctl.controllers.add(ac);
        const flag = { timedOut: false };
        const to = setTimeout(() => { flag.timedOut = true; ac.abort(); }, CFG.requestTimeoutMs + 5000);
        try {
          const r = await fetch(CFG.base + '/__down?bytes=' + step.b + '&r=' + U.uid(), { cache: 'no-store', signal: ac.signal, credentials: 'omit', mode: 'cors' });
          if (!r.ok) throw new TestError('http', 'HTTP ' + r.status);
          if (!r.body || !r.body.getReader) { const buf = await r.arrayBuffer(); state.bytes += buf.byteLength; return; }
          const rd = r.body.getReader();
          for (;;) { const { done, value } = await rd.read(); if (done) break; state.bytes += value.byteLength; }
        } catch (e) { if (flag.timedOut && e) e.timedOut = true; throw e; }
        finally { clearTimeout(to); ctl.controllers.delete(ac); }
      })());
    }
    // live sampling from bytes actually received so far
    let lastB = 0, lastT = t0;
    const timer = setInterval(() => {
      const now = performance.now(), dB = state.bytes - lastB, dT = now - lastT;
      if (dT > 0 && dB > 0) phase.emit({ type: 'sample', phase: 'download', mbps: U.mbps(dB, dT), t: now - phase.t0 });
      lastB = state.bytes; lastT = now;
    }, 200);
    try { await Promise.all(tasks); } finally { clearInterval(timer); }
    const ms = performance.now() - t0;
    // final partial window: guarantees every step yields at least one real sample, even on very fast links
    const tailB = state.bytes - lastB, tailT = performance.now() - lastT;
    if (tailB > 0 && tailT >= 20) phase.emit({ type: 'sample', phase: 'download', mbps: U.mbps(tailB, tailT), t: performance.now() - phase.t0 });
    return { bytes: state.bytes, ms, mbps: U.mbps(state.bytes, ms) };
  }

  async function measureDownload(ctl, emit, opts) {
    const steps = [];
    const phase = { emit, t0: performance.now() };
    for (const st of CFG.downSteps) {
      if (opts.saveData && st.b > 5e6) break;
      if (ctl.aborted) throw new TestError('cancelled');
      if (performance.now() - phase.t0 > CFG.downBudgetMs) break;
      let r;
      try { r = await downloadStep(st, ctl, phase); } catch (e) {
        if (steps.length && !ctl.aborted && !(e && e.code === 'http')) break;
        throw classify(e, ctl);
      }
      steps.push(r);
      emit({ type: 'step', phase: 'download', mbps: r.mbps, progress: U.clamp((performance.now() - phase.t0) / CFG.downBudgetMs, 0, 1) });
      if (r.ms > CFG.stopStepMs) break;
    }
    if (!steps.length) throw new TestError('network');
    return { mbps: combineSteps(steps), bytes: steps.reduce((s, x) => s + x.bytes, 0), steps };
  }

  function uploadOnce(bytes, ctl, phase) {
    return new Promise((resolve, reject) => {
      const XHR = root.XMLHttpRequest;
      if (!XHR) return reject(new TestError('unsupported'));
      const x = new XHR();
      ctl.xhrs.add(x);
      const blob = makePayload(bytes);
      let t0 = 0, lastL = 0, lastT = 0;
      x.open('POST', CFG.base + '/__up?r=' + U.uid());
      x.timeout = CFG.requestTimeoutMs;
      x.upload.onprogress = (e) => {
        const now = performance.now();
        if (!lastT) { lastT = now; lastL = e.loaded; return; }
        if (now - lastT >= 200) {
          phase.emit({ type: 'sample', phase: 'upload', mbps: U.mbps(e.loaded - lastL, now - lastT), t: now - phase.t0 });
          lastT = now; lastL = e.loaded;
        }
      };
      x.onload = () => {
        ctl.xhrs.delete(x);
        if (x.status >= 200 && x.status < 300) {
          const ms = performance.now() - t0;
          if (!lastT) phase.emit({ type: 'sample', phase: 'upload', mbps: U.mbps(bytes, ms), t: performance.now() - phase.t0 }); // no progress events fired: use whole-request figure
          resolve({ bytes, ms, mbps: U.mbps(bytes, ms) });
        }
        else reject(new TestError('http', 'HTTP ' + x.status));
      };
      x.onerror = () => { ctl.xhrs.delete(x); reject(new TestError('network')); };
      x.ontimeout = () => { ctl.xhrs.delete(x); reject(new TestError('timeout')); };
      x.onabort = () => { ctl.xhrs.delete(x); reject(new TestError(ctl.aborted ? 'cancelled' : 'timeout')); };
      t0 = performance.now();
      x.send(blob);
    });
  }

  async function measureUpload(ctl, emit) {
    const steps = [];
    const phase = { emit, t0: performance.now() };
    for (const b of CFG.upSteps) {
      if (ctl.aborted) throw new TestError('cancelled');
      if (performance.now() - phase.t0 > CFG.upBudgetMs) break;
      let r;
      try { r = await uploadOnce(b, ctl, phase); } catch (e) {
        if (steps.length && !ctl.aborted && !(e && e.code === 'http')) break;
        throw classify(e, ctl);
      }
      steps.push(r);
      emit({ type: 'step', phase: 'upload', mbps: r.mbps, progress: U.clamp((performance.now() - phase.t0) / CFG.upBudgetMs, 0, 1) });
      if (r.ms > CFG.stopStepMs) break;
    }
    if (!steps.length) throw new TestError('network');
    return { mbps: combineSteps(steps), bytes: steps.reduce((s, x) => s + x.bytes, 0), steps };
  }

  /**
   * Run a full test. emit(evt) receives: state, latency, sample, step, progress.
   * Resolves with a result object (never rejects for measurement problems).
   */
  async function run(emit, opts) {
    opts = opts || {};
    if (current) current.cancel('replaced');
    const ctl = {
      aborted: false, controllers: new Set(), xhrs: new Set(),
      cancel(reason) { ctl.aborted = true; ctl.reason = reason; ctl.controllers.forEach((c) => c.abort()); ctl.xhrs.forEach((x) => x.abort()); },
    };
    current = ctl;
    const safeEmit = (e) => { if (current === ctl) { try { emit(e); } catch (err) { /* UI errors must not break measurement */ } } };
    const T0 = performance.now();
    const res = {
      id: U.uid(), ts: Date.now(), status: 'failed', download: null, upload: null, latency: null, jitter: null,
      latencySamples: [], packetLoss: null, durationMs: 0, bytesDown: 0, bytesUp: 0, errors: {}, endpoint: 'speed.cloudflare.com',
      conn: opts.conn || null,
    };
    const finish = (status) => {
      res.status = status; res.durationMs = performance.now() - T0;
      const wasCurrent = current === ctl;
      if (wasCurrent) current = null;
      if (wasCurrent || status === 'cancelled') { try { emit({ type: 'state', state: status }); } catch (e) { /* ignore */ } }
      return res;
    };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return finish('offline');
    if (typeof fetch !== 'function' || typeof AbortController === 'undefined') return finish('unsupported');

    safeEmit({ type: 'state', state: 'initializing' });
    safeEmit({ type: 'progress', progress: 0 });
    let cancelled = false;
    const phases = [
      ['latency', 'measuringLatency', 0.12, async () => {
        const s = await measureLatency(ctl, (e) => safeEmit({ ...e, progress: 0.12 * e.progress }));
        res.latencySamples = s; res.latency = U.median(s); res.jitter = U.jitter(s);
      }],
      ['download', 'measuringDownload', 0.62, async () => {
        const d = await measureDownload(ctl, (e) => safeEmit(e.type === 'step' ? { ...e, progress: 0.12 + 0.5 * e.progress } : e), opts);
        res.download = d.mbps; res.bytesDown = d.bytes;
      }],
      ['upload', 'measuringUpload', 0.95, async () => {
        const u = await measureUpload(ctl, (e) => safeEmit(e.type === 'step' ? { ...e, progress: 0.62 + 0.33 * e.progress } : e));
        res.upload = u.mbps; res.bytesUp = u.bytes;
      }],
    ];
    for (const [name, state, end, fn] of phases) {
      if (ctl.aborted) { cancelled = true; break; }
      safeEmit({ type: 'state', state });
      try { await fn(); } catch (e) {
        const err = classify(e, ctl);
        if (err.code === 'cancelled') { cancelled = true; break; }
        res.errors[name] = err.code;
        if (err.code === 'offline') break;
      }
      safeEmit({ type: 'progress', progress: end });
    }
    if (cancelled || ctl.aborted) return finish('cancelled');
    safeEmit({ type: 'state', state: 'finalizing' });
    if (Object.values(res.errors).includes('offline')) return finish('offline');
    const got = [res.download, res.upload, res.latency].filter((v) => v !== null).length;
    if (got === 3) { safeEmit({ type: 'progress', progress: 1 }); return finish('completed'); }
    if (got === 0) {
      const codes = Object.values(res.errors);
      return finish(codes.length && codes.every((c) => c === 'timeout') ? 'timeout' : 'failed');
    }
    safeEmit({ type: 'progress', progress: 1 });
    return finish('partial');
  }

  function cancel() { if (current) current.cancel('user'); }
  function isRunning() { return !!current; }

  SX.speed = { CFG, run, cancel, isRunning, combineSteps, makePayload };
  if (typeof module !== 'undefined' && module.exports) module.exports = SX.speed;
})(typeof window !== 'undefined' ? window : globalThis);

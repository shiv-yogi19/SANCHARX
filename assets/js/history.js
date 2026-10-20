/* SANCHARX test history: browser-local only, never sent anywhere. Created By Shiv Yogi. */
(function (root) {
  'use strict';
  const SX = (root.SX = root.SX || {});
  const U = SX.util || require('./utils.js');
  const KEY = 'history.v1';
  const MAX = 50;

  function sanitize(e) {
    if (!e || typeof e !== 'object') return null;
    const n = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
    if (typeof e.ts !== 'number') return null;
    return {
      id: typeof e.id === 'string' ? e.id.slice(0, 40) : U.uid(), ts: e.ts,
      status: e.status === 'completed' ? 'completed' : 'partial',
      download: n(e.download), upload: n(e.upload), latency: n(e.latency), jitter: n(e.jitter),
      packetLoss: null, durationMs: n(e.durationMs) || 0, endpoint: 'speed.cloudflare.com',
      conn: e.conn && typeof e.conn === 'object' ? {
        type: typeof e.conn.type === 'string' ? e.conn.type : null, effectiveType: typeof e.conn.effectiveType === 'string' ? e.conn.effectiveType : null,
        downlink: n(e.conn.downlink), rtt: n(e.conn.rtt), saveData: typeof e.conn.saveData === 'boolean' ? e.conn.saveData : null,
      } : null,
    };
  }

  const H = {
    /** Returns {items, corrupted}. Corrupted storage never throws. */
    load() {
      const raw = SX.store.get(KEY, []);
      if (!Array.isArray(raw)) return { items: [], corrupted: true };
      const items = raw.map(sanitize).filter(Boolean);
      return { items: items.sort((a, b) => b.ts - a.ts), corrupted: items.length !== raw.length };
    },
    /** Only completed or partial results can be saved (never failed/cancelled). */
    save(result) {
      if (!result || (result.status !== 'completed' && result.status !== 'partial')) return { ok: false, err: 'notSavable' };
      const e = sanitize(result);
      if (!e) return { ok: false, err: 'invalid' };
      const { items } = H.load();
      if (items.some((x) => x.id === e.id)) return { ok: false, err: 'duplicate' };
      items.unshift(e);
      const ok = SX.store.set(KEY, items.slice(0, MAX));
      return { ok, err: ok ? null : 'storage' };
    },
    remove(id) { const { items } = H.load(); return SX.store.set(KEY, items.filter((x) => x.id !== id)); },
    clear() { SX.store.remove(KEY); },
    /** Compare two entries. Returns delta per metric: {value, pct}. */
    compare(a, b) {
      const d = {};
      ['download', 'upload', 'latency', 'jitter'].forEach((k) => {
        if (a[k] === null || b[k] === null) { d[k] = null; return; }
        d[k] = { diff: a[k] - b[k], pct: b[k] ? ((a[k] - b[k]) / b[k]) * 100 : null };
      });
      return d;
    },
    /** best / average / worst for each metric across entries with valid values. */
    summary(items) {
      const out = {};
      ['download', 'upload', 'latency', 'jitter'].forEach((k) => {
        const v = items.map((x) => x[k]).filter((x) => x !== null);
        const lowerBetter = k === 'latency' || k === 'jitter';
        out[k] = v.length ? { n: v.length, best: lowerBetter ? Math.min(...v) : Math.max(...v), worst: lowerBetter ? Math.max(...v) : Math.min(...v), avg: U.mean(v) } : null;
      });
      return out;
    },
    /** Trend needs >= 3 valid points: compares the average of the newest half with the oldest half. */
    trend(items, key) {
      const v = items.map((x) => x[key]).filter((x) => x !== null).reverse(); // oldest -> newest
      if (v.length < 3) return null;
      const h = Math.floor(v.length / 2), old = U.mean(v.slice(0, h)), neu = U.mean(v.slice(v.length - h));
      if (!old) return null;
      const pct = ((neu - old) / old) * 100;
      return { pct, dir: Math.abs(pct) < 5 ? 'flat' : pct > 0 ? 'up' : 'down', n: v.length };
    },
  };

  SX.history = H;
  if (typeof module !== 'undefined' && module.exports) module.exports = H;
})(typeof window !== 'undefined' ? window : globalThis);

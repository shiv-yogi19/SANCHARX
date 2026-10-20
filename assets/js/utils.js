/* SANCHARX utils: statistics, safe storage, DOM helpers. Created By Shiv Yogi */
(function (root) {
  'use strict';
  const SX = (root.SX = root.SX || {});

  const U = {
    /** Median of a numeric array (null when empty). */
    median(a) {
      if (!a || !a.length) return null;
      const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    },
    mean(a) { return a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; },
    stdev(a) {
      if (!a || a.length < 2) return null;
      const m = U.mean(a);
      return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1));
    },
    /**
     * Jitter estimate = mean absolute difference between consecutive latency samples.
     * Needs >= 2 samples. Not a carrier-grade measurement.
     */
    jitter(a) {
      if (!a || a.length < 2) return null;
      let t = 0;
      for (let i = 1; i < a.length; i++) t += Math.abs(a[i] - a[i - 1]);
      return t / (a.length - 1);
    },
    /** Throughput in megabits per second (decimal, 1 Mbps = 1,000,000 bit/s). */
    mbps(bytes, ms) { return ms > 0 ? (bytes * 8) / (ms / 1000) / 1e6 : 0; },
    fmt(n, d) {
      if (n === null || n === undefined || !isFinite(n)) return '—';
      d = d === undefined ? (n >= 100 ? 0 : n >= 10 ? 1 : 2) : d;
      return Number(n).toFixed(d);
    },
    clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); },
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
    $(sel, ctx) { return (ctx || document).querySelector(sel); },
    $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); },
    /** Safe element builder: text goes through textContent, never innerHTML. */
    el(tag, attrs, kids) {
      const e = document.createElement(tag);
      for (const k in attrs || {}) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'text') e.textContent = v;
        else if (k === 'class') e.className = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
      (kids || []).forEach((c) => c != null && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
      return e;
    },
    pad(n) { return String(n).padStart(2, '0'); },
    fmtDate(ts) {
      const d = new Date(ts);
      return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()) + ' ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + ':' + U.pad(d.getSeconds());
    },
  };

  /** localStorage wrapper that never throws. */
  const mem = {};
  let ok = null;
  function usable() {
    if (ok !== null) return ok;
    try { const k = '__sx_t'; root.localStorage.setItem(k, '1'); root.localStorage.removeItem(k); ok = true; } catch (e) { ok = false; }
    return ok;
  }
  const P = 'sancharx.';
  SX.store = {
    get available() { return usable(); },
    get(key, def) {
      try {
        const raw = usable() ? root.localStorage.getItem(P + key) : mem[key];
        return raw === null || raw === undefined ? def : JSON.parse(raw);
      } catch (e) { return def; }
    },
    set(key, val) {
      try {
        const s = JSON.stringify(val);
        if (usable()) root.localStorage.setItem(P + key, s); else mem[key] = s;
        return true;
      } catch (e) { mem[key] = JSON.stringify(val); return false; }
    },
    remove(key) { try { if (usable()) root.localStorage.removeItem(P + key); delete mem[key]; } catch (e) { /* ignore */ } },
    clearAll() {
      try {
        if (usable()) Object.keys(root.localStorage).filter((k) => k.startsWith(P)).forEach((k) => root.localStorage.removeItem(k));
        for (const k in mem) delete mem[k];
      } catch (e) { /* ignore */ }
    },
  };

  SX.util = U;
  if (typeof module !== 'undefined' && module.exports) module.exports = U;
})(typeof window !== 'undefined' ? window : globalThis);

/* SANCHARX network tools: pure logic + browser requests (no DOM). Created By Shiv Yogi. */
(function (root) {
  'use strict';
  const SX = (root.SX = root.SX || {});
  const U = SX.util || require('./utils.js');
  const N = {};

  /* ---------- Connection Intelligence (Network Information API, where available) ---------- */
  N.connectionInfo = function () {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const c = nav.connection || nav.mozConnection || nav.webkitConnection || null;
    return {
      online: nav.onLine !== false,
      apiSupported: !!c,
      type: c && c.type ? c.type : null,
      effectiveType: c && c.effectiveType ? c.effectiveType : null,
      downlink: c && typeof c.downlink === 'number' ? c.downlink : null,
      rtt: c && typeof c.rtt === 'number' ? c.rtt : null,
      saveData: c && typeof c.saveData === 'boolean' ? c.saveData : null,
    };
  };

  /* ---------- Stability Monitor ---------- */
  N.STABILITY = { intervalMs: 1000, maxSamples: 60, minForVerdict: 8, jitterBad: 30, jitterFair: 15, stdevBad: 50, stdevFair: 25, failBad: 0.1 };

  N.stabilityStats = function (samples, failures) {
    const T = N.STABILITY;
    const ok = samples.filter((v) => v !== null);
    const total = ok.length + failures;
    const s = {
      count: ok.length, failures, mean: U.mean(ok), median: U.median(ok), min: ok.length ? Math.min(...ok) : null,
      max: ok.length ? Math.max(...ok) : null, stdev: U.stdev(ok), jitter: U.jitter(ok), failRate: total ? failures / total : 0, verdict: 'collecting',
    };
    if (total >= T.minForVerdict) {
      if (s.failRate >= T.failBad || (s.jitter !== null && s.jitter > T.jitterBad) || (s.stdev !== null && s.stdev > T.stdevBad)) s.verdict = 'unstable';
      else if (s.failures > 0 || (s.jitter !== null && s.jitter > T.jitterFair) || (s.stdev !== null && s.stdev > T.stdevFair)) s.verdict = 'fair';
      else s.verdict = 'stable';
    }
    return s;
  };

  async function pingOnce(timeoutMs) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const t0 = performance.now();
      const r = await fetch('https://speed.cloudflare.com/__down?bytes=0&m=' + U.uid(), { cache: 'no-store', signal: ac.signal, credentials: 'omit', mode: 'cors' });
      if (!r.ok) throw new Error('http');
      await r.arrayBuffer();
      return performance.now() - t0;
    } finally { clearTimeout(to); }
  }
  N.pingOnce = pingOnce;

  /** Repeated latency sampling. Stops on stop(), when the page is hidden, or after maxSamples. */
  N.StabilityMonitor = class {
    constructor(onUpdate, onStop) { this.onUpdate = onUpdate; this.onStop = onStop; this.running = false; this.samples = []; this.failures = 0; this.timer = null; this._vis = () => { if (document.hidden) this.stop('hidden'); }; }
    start() {
      if (this.running) return;
      this.running = true; this.samples = []; this.failures = 0;
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._vis);
      this._tick();
    }
    async _tick() {
      if (!this.running) return;
      let v = null;
      try { v = await pingOnce(5000); } catch (e) { this.failures++; }
      if (!this.running) return;
      if (v !== null) this.samples.push(v);
      const t = this.samples.length + this.failures;
      this.onUpdate(this.samples.slice(), N.stabilityStats(this.samples, this.failures));
      if (t >= N.STABILITY.maxSamples) return this.stop('done');
      this.timer = setTimeout(() => this._tick(), N.STABILITY.intervalMs);
    }
    stop(reason) {
      if (!this.running) return;
      this.running = false; clearTimeout(this.timer);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._vis);
      if (this.onStop) this.onStop(reason || 'user');
    }
  };

  /* ---------- Data and Download Calculator ---------- */
  N.UNITS = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 1024, MiB: 1048576, GiB: 1073741824, TiB: 1099511627776 };
  N.parseNum = function (v, opts) {
    opts = opts || {};
    const s = String(v === undefined || v === null ? '' : v).trim();
    if (s === '') return { ok: false, err: 'empty' };
    const n = Number(s);
    if (!isFinite(n)) return { ok: false, err: 'invalid' };
    if (n < 0) return { ok: false, err: 'negative' };
    if (n === 0 && opts.positive) return { ok: false, err: 'zero' };
    if (n > 1e15) return { ok: false, err: 'tooLarge' };
    return { ok: true, value: n };
  };
  N.convertSize = (v, from, to) => (v * N.UNITS[from]) / N.UNITS[to];
  N.mbpsToMBps = (v) => v / 8;
  N.MBpsToMbps = (v) => v * 8;
  /** seconds to move `size` of `unit` at `mbps` (decimal megabits per second, ideal, no protocol overhead) */
  N.transferSeconds = (size, unit, mbps) => (size * N.UNITS[unit] * 8) / (mbps * 1e6);
  N.dataTransferred = (mbps, seconds) => (mbps * 1e6 / 8) * seconds; // bytes
  N.fmtDuration = function (sec) {
    if (!isFinite(sec)) return '—';
    if (sec < 1) return (sec * 1000).toFixed(0) + ' ms';
    if (sec < 60) return sec.toFixed(1) + ' s';
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
    return [d ? d + ' d' : '', h ? h + ' h' : '', m ? m + ' min' : '', !d && s ? s + ' s' : ''].filter(Boolean).join(' ');
  };
  N.fmtBytes = function (b, binary) {
    const base = binary ? 1024 : 1000, names = binary ? ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'] : ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];
    let i = 0, v = b;
    while (v >= base && i < names.length - 1) { v /= base; i++; }
    return (i === 0 ? v.toFixed(0) : v.toFixed(2)) + ' ' + names[i];
  };

  /* ---------- IPv4 validator and subnet calculator ---------- */
  N.parseIPv4 = function (s) {
    s = String(s === undefined || s === null ? '' : s).trim();
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
    if (!m) return { ok: false, err: 'format' };
    const o = m.slice(1).map((x) => x);
    for (const x of o) { if (x.length > 1 && x[0] === '0') return { ok: false, err: 'leadingZero' }; if (Number(x) > 255) return { ok: false, err: 'range' }; }
    const n = o.map(Number);
    return { ok: true, value: ((n[0] << 24) | (n[1] << 16) | (n[2] << 8) | n[3]) >>> 0, octets: n };
  };
  N.ipToStr = (v) => [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.');
  N.cidrToMask = (c) => (c === 0 ? 0 : (0xffffffff << (32 - c)) >>> 0);
  /** Accepts "24", "/24" or dotted mask "255.255.255.0". Returns {ok, cidr, mask}. */
  N.parseMask = function (s) {
    s = String(s === undefined || s === null ? '' : s).trim();
    if (!s) return { ok: false, err: 'empty' };
    if (/^\/?\d{1,2}$/.test(s)) {
      const c = Number(s.replace('/', ''));
      return c >= 0 && c <= 32 ? { ok: true, cidr: c, mask: N.cidrToMask(c) } : { ok: false, err: 'cidrRange' };
    }
    const p = N.parseIPv4(s);
    if (!p.ok) return { ok: false, err: 'maskFormat' };
    const inv = (~p.value) >>> 0;
    if ((inv & ((inv + 1) >>> 0)) !== 0) return { ok: false, err: 'maskNotContiguous' };
    let c = 0; for (let v = p.value; v & 0x80000000; v = (v << 1) >>> 0) c++;
    return { ok: true, cidr: c, mask: p.value };
  };
  N.ipKind = function (v) {
    const a = v >>> 24, b = (v >>> 16) & 255;
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'private';
    if (a === 127) return 'loopback';
    if (a === 169 && b === 254) return 'linkLocal';
    if (a === 100 && b >= 64 && b <= 127) return 'cgnat';
    if (a >= 224 && a <= 239) return 'multicast';
    if (a >= 240) return 'reserved';
    if (a === 0) return 'thisNetwork';
    return 'public';
  };
  N.subnet = function (ipStr, maskStr) {
    const ip = N.parseIPv4(ipStr);
    if (!ip.ok) return { ok: false, field: 'ip', err: ip.err };
    const mk = N.parseMask(maskStr);
    if (!mk.ok) return { ok: false, field: 'mask', err: mk.err };
    const net = (ip.value & mk.mask) >>> 0, bc = (net | (~mk.mask >>> 0)) >>> 0, size = Math.pow(2, 32 - mk.cidr);
    let hosts, first = null, last = null;
    if (mk.cidr === 32) { hosts = 1; first = last = net; }
    else if (mk.cidr === 31) { hosts = 2; first = net; last = bc; }
    else { hosts = size - 2; first = net + 1; last = bc - 1; }
    return {
      ok: true, cidr: mk.cidr, mask: N.ipToStr(mk.mask), wildcard: N.ipToStr((~mk.mask) >>> 0), network: N.ipToStr(net),
      broadcast: mk.cidr >= 31 ? null : N.ipToStr(bc), hosts, total: size, first: N.ipToStr(first), last: N.ipToStr(last), kind: N.ipKind(ip.value),
      point: mk.cidr === 31 ? 'p2p' : mk.cidr === 32 ? 'host' : null,
    };
  };

  /* ---------- DNS over HTTPS ---------- */
  N.RESOLVERS = {
    cloudflare: { name: 'Cloudflare DNS (cloudflare-dns.com)', url: 'https://cloudflare-dns.com/dns-query' },
    google: { name: 'Google Public DNS (dns.google)', url: 'https://dns.google/resolve' },
  };
  N.DNS_TYPES = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 257: 'CAA' };
  N.DNS_STATUS = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' };
  N.validateDomain = function (input) {
    let d = String(input === undefined || input === null ? '' : input).trim().toLowerCase().replace(/\.$/, '');
    if (!d) return { ok: false, err: 'empty' };
    if (/[\s/:@?#]/.test(d)) return { ok: false, err: 'format' };
    try { if (/[^\x00-\x7f]/.test(d)) d = new URL('http://' + d).hostname; } catch (e) { return { ok: false, err: 'format' }; }
    if (d.length > 253) return { ok: false, err: 'length' };
    const labels = d.split('.');
    if (labels.length < 2) return { ok: false, err: 'format' };
    for (const l of labels) if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l)) return { ok: false, err: 'format' };
    if (/^\d+$/.test(labels[labels.length - 1])) return { ok: false, err: 'format' };
    return { ok: true, domain: d };
  };
  N.dnsLookup = async function (domain, type, resolverKey) {
    const v = N.validateDomain(domain);
    if (!v.ok) { const e = new Error(v.err); e.code = 'invalid'; throw e; }
    const rs = N.RESOLVERS[resolverKey] || N.RESOLVERS.cloudflare;
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 8000);
    const t0 = performance.now();
    try {
      const r = await fetch(rs.url + '?name=' + encodeURIComponent(v.domain) + '&type=' + encodeURIComponent(type), { headers: { accept: 'application/dns-json' }, cache: 'no-store', credentials: 'omit', signal: ac.signal });
      if (r.status === 429) { const e = new Error('rate'); e.code = 'rate'; throw e; }
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.code = 'http'; throw e; }
      const j = await r.json();
      if (typeof j !== 'object' || j === null || typeof j.Status !== 'number') { const e = new Error('bad'); e.code = 'badResponse'; throw e; }
      return {
        resolver: rs.name, domain: v.domain, type, status: j.Status, statusText: N.DNS_STATUS[j.Status] || String(j.Status), ms: performance.now() - t0,
        answers: (Array.isArray(j.Answer) ? j.Answer : []).map((a) => ({ name: String(a.name), type: N.DNS_TYPES[a.type] || String(a.type), ttl: a.TTL, data: String(a.data) })),
      };
    } catch (e) {
      if (e.code) throw e;
      const err = new Error(e.name === 'AbortError' ? 'timeout' : 'network'); err.code = err.message; throw err;
    } finally { clearTimeout(to); }
  };

  /* ---------- Public IP (external service: ipify.org) ---------- */
  N.IP_PROVIDERS = [{ name: 'ipify.org', url: 'https://api.ipify.org?format=json' }, { name: 'ipify.org (api64)', url: 'https://api64.ipify.org?format=json' }];
  N.publicIP = async function () {
    let last = null;
    for (const p of N.IP_PROVIDERS) {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 6000);
      try {
        const r = await fetch(p.url, { cache: 'no-store', credentials: 'omit', signal: ac.signal });
        if (!r.ok) throw new Error('http');
        const j = await r.json();
        const ip = j && typeof j.ip === 'string' ? j.ip : '';
        if (!/^[0-9a-fA-F:.]{3,45}$/.test(ip)) throw new Error('bad');
        return { ip, provider: p.name };
      } catch (e) { last = e; } finally { clearTimeout(to); }
    }
    const err = new Error(last && last.name === 'AbortError' ? 'timeout' : 'network'); err.code = err.message; throw err;
  };

  /* ---------- HTTP endpoint latency checker ---------- */
  N.validateTargetUrl = function (input, allowHttp) {
    let s = String(input === undefined || input === null ? '' : input).trim();
    if (!s) return { ok: false, err: 'empty' };
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return { ok: false, err: 'scheme' };
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    let u;
    try { u = new URL(s); } catch (e) { return { ok: false, err: 'format' }; }
    if (u.protocol !== 'https:' && !(allowHttp && u.protocol === 'http:')) return { ok: false, err: u.protocol === 'http:' ? 'httpsOnly' : 'scheme' };
    if (u.username || u.password) return { ok: false, err: 'credentials' };
    const h = u.hostname.toLowerCase();
    const v4 = N.parseIPv4(h);
    const bad = h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.startsWith('[') || (v4.ok && ['private', 'loopback', 'linkLocal', 'thisNetwork', 'cgnat'].includes(N.ipKind(v4.value))) || !h.includes('.') ;
    if (bad) return { ok: false, err: 'local' };
    return { ok: true, url: u.toString(), host: h };
  };
  /** Measures time-to-response with no-cors (opaque). Cannot read status; only reachability + timing. */
  N.checkEndpoint = async function (url, samples, onSample) {
    const out = []; let failed = 0;
    for (let i = 0; i < (samples || 3); i++) {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 8000);
      try {
        const sep = url.includes('?') ? '&' : '?';
        const t0 = performance.now();
        await fetch(url + sep + '_sx=' + U.uid(), { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ac.signal });
        out.push(performance.now() - t0);
      } catch (e) { failed++; } finally { clearTimeout(to); }
      if (onSample) onSample(out.slice(), failed);
    }
    return { samples: out, failed, median: U.median(out), min: out.length ? Math.min(...out) : null, max: out.length ? Math.max(...out) : null };
  };

  /* ---------- Gaming & streaming advisor (estimates from measured values only) ---------- */
  N.ADVISOR = {
    browsing: { name: 'browsing', needs: ['download', 'latency'], good: (r) => r.download >= 5 && r.latency <= 150, fair: (r) => r.download >= 2 && r.latency <= 300 },
    hd: { name: 'hd', needs: ['download'], good: (r) => r.download >= 8, fair: (r) => r.download >= 5 },
    uhd: { name: 'uhd', needs: ['download'], good: (r) => r.download >= 25, fair: (r) => r.download >= 15 },
    calls: { name: 'calls', needs: ['download', 'upload', 'latency', 'jitter'], good: (r) => r.download >= 5 && r.upload >= 3 && r.latency <= 100 && r.jitter <= 30, fair: (r) => r.download >= 2 && r.upload >= 1.5 && r.latency <= 200 && r.jitter <= 60 },
    gaming: { name: 'gaming', needs: ['download', 'latency', 'jitter'], good: (r) => r.download >= 10 && r.latency <= 50 && r.jitter <= 15, fair: (r) => r.download >= 5 && r.latency <= 100 && r.jitter <= 30 },
    large: { name: 'large', needs: ['download'], good: (r) => r.download >= 50, fair: (r) => r.download >= 15 },
  };
  /** Returns [{id, level: good|fair|poor|unknown}] */
  N.advise = function (r, stability) {
    return Object.keys(N.ADVISOR).map((id) => {
      const a = N.ADVISOR[id];
      if (!r || a.needs.some((k) => r[k] === null || r[k] === undefined)) return { id, level: 'unknown' };
      let level = a.good(r) ? 'good' : a.fair(r) ? 'fair' : 'poor';
      if (stability && stability.verdict === 'unstable' && (id === 'gaming' || id === 'calls') && level === 'good') level = 'fair';
      return { id, level };
    });
  };

  SX.net = N;
  if (typeof module !== 'undefined' && module.exports) module.exports = N;
})(typeof window !== 'undefined' ? window : globalThis);

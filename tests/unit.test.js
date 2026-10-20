// Unit + mocked-network tests (Node). Mock data is used ONLY here, never in the production UI.
global.window = global; global.SX = {};
const store = {}; global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, get length() { return Object.keys(store).length; }, key: (i) => Object.keys(store)[i] };
Object.defineProperty(global.localStorage, 'keys', { value: () => Object.keys(store) });
['utils', 'translations', 'speed-test', 'network-tools', 'history', 'faq-data', 'content-data', 'reports', 'assistant'].forEach((m) => require('../assets/js/' + m + '.js'));
const U = SX.util, N = SX.net, H = SX.history, A = SX.assistant;
let pass = 0, fail = 0;
const T = async (name, fn) => { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); };
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol) throw new Error((m || '') + ' expected ~' + b + ' got ' + a); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setNav = (v) => Object.defineProperty(global, 'navigator', { value: v, configurable: true, writable: true });

(async () => {
  await T('stats: median/mean/stdev', () => { eq(U.median([3, 1, 2]), 2); eq(U.median([1, 2, 3, 4]), 2.5); eq(U.median([]), null); near(U.mean([1, 2, 3]), 2, 1e-9); near(U.stdev([2, 4, 4, 4, 5, 5, 7, 9]), 2.138, 0.01); });
  await T('jitter = mean |consecutive diff|', () => { near(U.jitter([10, 12, 9, 15]), (2 + 3 + 6) / 3, 1e-9); eq(U.jitter([5]), null); eq(U.jitter([]), null); });
  await T('mbps formula', () => { near(U.mbps(1e6, 1000), 8, 1e-9); near(U.mbps(12.5e6, 1000), 100, 1e-9); eq(U.mbps(100, 0), 0); });
  await T('combineSteps uses largest qualifying steps', () => { const r = SX.speed.combineSteps([{ mbps: 5, ms: 50, bytes: 1 }, { mbps: 40, ms: 500, bytes: 1 }, { mbps: 60, ms: 900, bytes: 1 }]); near(r, 50, 1e-9); eq(SX.speed.combineSteps([]), null); });

  await T('calculator: Mbps<->MB/s, sizes, time, data', () => {
    near(N.mbpsToMBps(80), 10, 1e-9); near(N.MBpsToMbps(10), 80, 1e-9);
    near(N.convertSize(1, 'GB', 'MB'), 1000, 1e-9); near(N.convertSize(1, 'GiB', 'MiB'), 1024, 1e-9); near(N.convertSize(1, 'GB', 'GiB'), 0.9313, 1e-3);
    near(N.transferSeconds(100, 'MB', 80), 10, 1e-9); near(N.dataTransferred(8, 10), 1e7, 1e-3);
  });
  await T('calculator: invalid input handling', () => {
    eq(N.parseNum('').err, 'empty'); eq(N.parseNum('abc').err, 'invalid'); eq(N.parseNum('-5').err, 'negative'); eq(N.parseNum('0', { positive: true }).err, 'zero'); eq(N.parseNum('1e20').err, 'tooLarge'); eq(N.parseNum('Infinity').err, 'invalid'); eq(N.parseNum('0').ok, true); eq(N.parseNum(' 12.5 ').value, 12.5);
  });
  await T('fmtDuration / fmtBytes', () => { eq(N.fmtDuration(0.5), '500 ms'); eq(N.fmtDuration(90), '1 min 30 s'); eq(N.fmtBytes(1500), '1.50 kB'); eq(N.fmtBytes(1536, true), '1.50 KiB'); });

  await T('IPv4 validation', () => {
    eq(N.parseIPv4('192.168.1.10').ok, true); eq(N.parseIPv4('256.1.1.1').err, 'range'); eq(N.parseIPv4('1.2.3').err, 'format'); eq(N.parseIPv4('01.2.3.4').err, 'leadingZero'); eq(N.parseIPv4('a.b.c.d').err, 'format'); eq(N.parseIPv4('').err, 'format'); eq(N.parseIPv4('1.2.3.4.5').err, 'format');
  });
  await T('subnet /24', () => { const r = N.subnet('192.168.1.10', '/24'); eq([r.network, r.broadcast, r.hosts, r.first, r.last, r.mask, r.wildcard, r.kind], ['192.168.1.0', '192.168.1.255', 254, '192.168.1.1', '192.168.1.254', '255.255.255.0', '0.0.0.255', 'private']); });
  await T('subnet dotted mask + /26 + /30 + /31 + /32 + /0', () => {
    let r = N.subnet('10.0.0.77', '255.255.255.192'); eq([r.cidr, r.network, r.broadcast, r.hosts], [26, '10.0.0.64', '10.0.0.127', 62]);
    r = N.subnet('172.16.5.9', '30'); eq([r.network, r.broadcast, r.hosts, r.first, r.last], ['172.16.5.8', '172.16.5.11', 2, '172.16.5.9', '172.16.5.10']);
    r = N.subnet('10.1.1.1', '/31'); eq([r.hosts, r.broadcast, r.point], [2, null, 'p2p']);
    r = N.subnet('8.8.8.8', '/32'); eq([r.hosts, r.first, r.point, r.kind], [1, '8.8.8.8', 'host', 'public']);
    r = N.subnet('1.2.3.4', '/0'); eq([r.network, r.broadcast, r.total], ['0.0.0.0', '255.255.255.255', 4294967296]);
  });
  await T('subnet errors', () => { eq(N.subnet('1.2.3.400', '/24').field, 'ip'); eq(N.subnet('1.2.3.4', '/33').err, 'cidrRange'); eq(N.subnet('1.2.3.4', '255.0.255.0').err, 'maskNotContiguous'); eq(N.subnet('1.2.3.4', 'abc').err, 'maskFormat'); eq(N.subnet('1.2.3.4', '').err, 'empty'); });
  await T('ipKind classes', () => { const k = (s) => N.ipKind(N.parseIPv4(s).value); eq(k('10.1.2.3'), 'private'); eq(k('172.31.0.1'), 'private'); eq(k('172.32.0.1'), 'public'); eq(k('127.0.0.1'), 'loopback'); eq(k('169.254.1.1'), 'linkLocal'); eq(k('100.64.0.1'), 'cgnat'); eq(k('224.0.0.1'), 'multicast'); });

  await T('domain validation', () => { eq(N.validateDomain('Example.COM').domain, 'example.com'); eq(N.validateDomain('example.com.').domain, 'example.com'); eq(N.validateDomain('http://example.com').err, 'format'); eq(N.validateDomain('nodot').err, 'format'); eq(N.validateDomain('-bad.com').err, 'format'); eq(N.validateDomain('').err, 'empty'); eq(N.validateDomain('a b.com').err, 'format'); eq(N.validateDomain('x'.repeat(64) + '.com').err, 'format'); eq(N.validateDomain('1.2.3.4').err, 'format'); });
  await T('URL validation blocks dangerous/local targets', () => {
    eq(N.validateTargetUrl('example.com').ok, true); eq(N.validateTargetUrl('https://example.com/a?b=1').ok, true);
    eq(N.validateTargetUrl('javascript:alert(1)').err, 'scheme'); eq(N.validateTargetUrl('file:///etc/passwd').err, 'scheme'); eq(N.validateTargetUrl('ftp://x.com').err, 'scheme'); eq(N.validateTargetUrl('data:text/html,hi').err, 'scheme');
    eq(N.validateTargetUrl('http://example.com').err, 'httpsOnly'); eq(N.validateTargetUrl('http://example.com', true).ok, true);
    eq(N.validateTargetUrl('https://localhost').err, 'local'); eq(N.validateTargetUrl('https://192.168.1.1').err, 'local'); eq(N.validateTargetUrl('https://127.0.0.1').err, 'local'); eq(N.validateTargetUrl('https://10.0.0.5').err, 'local'); eq(N.validateTargetUrl('https://[::1]/').err, 'local'); eq(N.validateTargetUrl('https://user:pw@example.com').err, 'credentials'); eq(N.validateTargetUrl('').err, 'empty'); eq(N.validateTargetUrl('https://intranet').err, 'local');
  });

  await T('stability thresholds', () => {
    eq(N.stabilityStats([20, 21, 20], 0).verdict, 'collecting');
    eq(N.stabilityStats([20, 21, 20, 22, 21, 20, 21, 20], 0).verdict, 'stable');
    eq(N.stabilityStats([20, 60, 20, 70, 20, 80, 20, 90], 0).verdict, 'unstable');
    eq(N.stabilityStats([20, 21, 20, 22, 21, 20, 21, 20, 21, 20, 21, 20, 21, 20, 21, 20, 21, 20, 21, 20], 1).verdict, 'fair');
    eq(N.stabilityStats([20, 21, 20, 22, 21, 20, 21, 20], 1).verdict, 'unstable'); // 1/9 failures >= 10%
    eq(N.stabilityStats([20, 21, 20, 22, 21, 20, 21], 3).verdict, 'unstable');
  });
  await T('advisor uses only measured values', () => {
    const none = N.advise(null); eq(none.every((x) => x.level === 'unknown'), true);
    const fast = N.advise({ download: 100, upload: 40, latency: 20, jitter: 3 }); eq(fast.every((x) => x.level === 'good'), true);
    const slow = N.advise({ download: 1, upload: 0.5, latency: 300, jitter: 80 }); eq(slow.find((x) => x.id === 'gaming').level, 'poor'); eq(slow.find((x) => x.id === 'hd').level, 'poor');
    const noJit = N.advise({ download: 100, upload: 40, latency: 20, jitter: null }); eq(noJit.find((x) => x.id === 'gaming').level, 'unknown'); eq(noJit.find((x) => x.id === 'hd').level, 'good');
    eq(N.advise({ download: 100, upload: 40, latency: 20, jitter: 3 }, { verdict: 'unstable' }).find((x) => x.id === 'gaming').level, 'fair');
  });

  await T('history: save/load/delete/compare/summary/trend', () => {
    H.clear();
    const mk = (i, d, u, l, j) => ({ id: 'id' + i, ts: 1000 + i, status: 'completed', download: d, upload: u, latency: l, jitter: j, durationMs: 9000 });
    [mk(1, 10, 5, 50, 5), mk(2, 20, 6, 40, 4), mk(3, 30, 7, 30, 3), mk(4, 40, 8, 20, 2)].forEach((e) => eq(H.save(e).ok, true));
    eq(H.save(mk(4, 1, 1, 1, 1)).err, 'duplicate'); eq(H.save({ status: 'failed', ts: 1 }).ok, false); eq(H.save({ status: 'cancelled', ts: 1 }).ok, false);
    const { items } = H.load(); eq(items.length, 4); eq(items[0].id, 'id4');
    const d = H.compare(items[0], items[3]); near(d.download.diff, 30, 1e-9); near(d.download.pct, 300, 1e-9);
    const s = H.summary(items); eq([s.download.best, s.download.worst, s.latency.best, s.latency.worst], [40, 10, 20, 50]); near(s.download.avg, 25, 1e-9);
    eq(H.trend(items, 'download').dir, 'up'); eq(H.trend(items, 'latency').dir, 'down'); eq(H.trend(items.slice(0, 2), 'download'), null);
    H.remove('id2'); eq(H.load().items.length, 3); H.clear(); eq(H.load().items.length, 0);
    eq(H.save({ id: 'p', ts: 5, status: 'partial', download: 5, upload: null, latency: 10, jitter: 1 }).ok, true); eq(H.load().items[0].upload, null);
  });
  await T('history: corrupted storage handled', () => {
    store['sancharx.history.v1'] = '{not json'; eq(H.load().items.length, 0);
    store['sancharx.history.v1'] = JSON.stringify([{ ts: 1, status: 'completed', download: 5 }, 'junk', null, { id: 'x' }]); const r = H.load(); eq(r.items.length, 1); eq(r.corrupted, true);
    store['sancharx.history.v1'] = JSON.stringify({ a: 1 }); eq(H.load().corrupted, true); H.clear();
  });

  await T('assistant search: English/Hindi/keywords/fallback', () => {
    eq(A.search('why is my wifi slow')[0].id, 'WR-01'); eq(A.search('what is jitter')[0].id, 'ST-04'); eq(A.search('buffering')[0].id, 'GS-03'); eq(A.search('मोबाइल डेटा धीमा')[0].c, 'mobile'); eq(A.search('captive portal')[0].c !== undefined, true);
    eq(A.search('who won the cricket match yesterday').length, 0); eq(A.search('').length, 0); eq(A.search('   ').length, 0);
    eq(A.intent('please explain my result'), 'explain'); eq(A.intent('how do i improve speed'), 'improve'); eq(A.intent('hello'), null);
    eq(A.suggestIssues(null).length, 0); eq(A.suggestIssues({ download: 2, upload: 1, latency: 200, jitter: 50 }).join(), 'slowDown,slowUp,latency,unstable');
  });
  await T('every FAQ question finds itself via its own English text', () => { SX.FAQ.forEach((f) => { const hits = A.search(f.q.en, 5).map((x) => x.id); if (!hits.includes(f.id)) throw new Error(f.id + ' not found by its own question; got ' + hits); }); });
  await T('troubleshooter diagnose uses real values; no data message otherwise', () => {
    const d = SX.diagnose('slowDown', { download: 2, errors: {} }, 'en'); eq(/low/.test(d.observations[0]), true); eq(d.steps.length >= 3, true);
    eq(/No completed measurement/.test(SX.diagnose('latency', null, 'en').observations[0]), true); eq(SX.diagnose('nope', null, 'en'), null); eq(SX.content.ISSUES.length, 10); eq(SX.content.SAFETY.length, 7);
    SX.content.ISSUES.forEach((i) => { eq(i.s.en.length, i.s.hi.length); });
  });
  await T('report analysis never invents values', () => {
    const a = SX.reports.analyse({ download: null, upload: null, latency: null, jitter: null, status: 'partial' }, 'en'); eq(a.interp.length, 1); eq(/partial/.test(a.interp[0]), true);
    const rows = SX.reports.rows({ download: null, upload: 5, latency: null, jitter: null, status: 'partial', durationMs: 0 }, 'en', SX.i18n.t); eq(rows[0][1], 'Unavailable'); eq(rows[4][1], 'Not measured by this browser test');
    eq(SX.reports.FILE_NAME, 'Speed-Test-Report_SANCHARX_Shiv-Yogi');
  });

  /* ---------- mocked network ---------- */
  const mockFetch = (opts) => async (url, init) => {
    opts = opts || {};
    if (init && init.signal && init.signal.aborted) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
    if (opts.fail) throw new TypeError('Failed to fetch');
    if (opts.http) return { ok: false, status: opts.http };
    if (/speed\.cloudflare\.com\/__down/.test(url)) {
      const bytes = Number(/bytes=(\d+)/.exec(url)[1]);
      await new Promise((res, rej) => { const t = setTimeout(res, opts.fixedDelay !== undefined ? opts.fixedDelay : 3 + bytes / 1e6 * 8); if (init && init.signal) init.signal.addEventListener('abort', () => { clearTimeout(t); const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }); });
      let sent = false;
      return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(bytes), body: { getReader: () => ({ read: async () => { if (sent || bytes === 0) return { done: true }; sent = true; return { done: false, value: { byteLength: bytes } }; } }) } };
    }
    if (/api(64)?\.ipify\.org/.test(url)) return { ok: true, status: 200, json: async () => ({ ip: opts.ip || '203.0.113.9' }) };
    if (/dns-query|dns\.google/.test(url)) { if (opts.dnsStatus) return { ok: false, status: opts.dnsStatus }; return { ok: true, status: 200, json: async () => opts.dnsJson || { Status: 0, Answer: [{ name: 'example.com.', type: 1, TTL: 60, data: '93.184.216.34' }] } }; }
    return { ok: true, type: 'opaque' };
  };
  class MockXHR {
    constructor() { this.upload = {}; MockXHR.last = this; }
    open(m, url) { this.method = m; this.url = url; }
    send(blob) {
      if (MockXHR.mode === 'fail') { this.t = setTimeout(() => this.onerror && this.onerror(), 5); return; }
      if (MockXHR.mode === 'http') { this.t = setTimeout(() => { this.status = 403; this.onload(); }, 5); return; }
      this.t = setTimeout(() => { this.upload.onprogress && this.upload.onprogress({ loaded: 1 }); this.status = 200; this.onload(); }, 5 + blob.size / 1e6 * 4);
    }
    abort() { clearTimeout(this.t); this.onabort && this.onabort(); }
  }
  global.XMLHttpRequest = MockXHR; setNav({ onLine: true });

  await T('speed test: full success with mocked endpoint', async () => {
    global.fetch = mockFetch(); MockXHR.mode = 'ok';
    const states = [], samples = [], prog = [];
    const r = await SX.speed.run((e) => { if (e.type === 'state') states.push(e.state); if (e.type === 'sample') samples.push(e); if (e.type === 'progress') prog.push(e.progress); });
    eq(r.status, 'completed'); eq(r.latencySamples.length, 10); eq(r.download > 0 && r.upload > 0 && r.latency >= 0 && r.jitter >= 0, true); eq(r.packetLoss, null);
    eq(states.includes('measuringLatency') && states.includes('measuringDownload') && states.includes('measuringUpload') && states.includes('finalizing') && states[states.length - 1] === 'completed', true, 'states ' + states);
    eq(prog.every((p, i) => i === 0 || p >= prog[i - 1] - 1e-9), true, 'progress monotonic'); eq(SX.speed.isRunning(), false); eq(r.bytesDown > 0 && r.bytesUp > 0, true);
  });
  await T('speed test: upload rejected => partial, no substituted value', async () => {
    global.fetch = mockFetch(); MockXHR.mode = 'http';
    const r = await SX.speed.run(() => {}); eq(r.status, 'partial'); eq(r.upload, null); eq(r.errors.upload, 'http'); eq(r.download > 0, true);
  });
  await T('speed test: upload network error => partial', async () => { global.fetch = mockFetch(); MockXHR.mode = 'fail'; const r = await SX.speed.run(() => {}); eq(r.status, 'partial'); eq(r.errors.upload, 'network'); });
  await T('speed test: all endpoints fail => failed, no fake numbers', async () => {
    global.fetch = mockFetch({ fail: true }); MockXHR.mode = 'fail'; const r = await SX.speed.run(() => {});
    eq(r.status, 'failed'); eq([r.download, r.upload, r.latency, r.jitter], [null, null, null, null]);
  });
  await T('speed test: HTTP 503 on download => honest failure', async () => { global.fetch = mockFetch({ http: 503 }); MockXHR.mode = 'http'; const r = await SX.speed.run(() => {}); eq(r.status, 'failed'); eq(r.errors.latency, 'http'); });
  await T('speed test: offline state', async () => { setNav({ onLine: false }); const r = await SX.speed.run(() => {}); eq(r.status, 'offline'); eq(r.download, null); setNav({ onLine: true }); });
  await T('speed test: unsupported (no fetch)', async () => { const f = global.fetch; global.fetch = undefined; const r = await SX.speed.run(() => {}); eq(r.status, 'unsupported'); global.fetch = f; });
  await T('speed test: cancel aborts requests and records nothing', async () => {
    global.fetch = mockFetch({ fixedDelay: 200 }); MockXHR.mode = 'ok';
    const p = SX.speed.run(() => {}); await sleep(100); eq(SX.speed.isRunning(), true); SX.speed.cancel(); const r = await p;
    eq(r.status, 'cancelled'); eq(SX.speed.isRunning(), false);
  });
  await T('speed test: starting a new test cancels the old one (no overlap)', async () => {
    global.fetch = mockFetch({ fixedDelay: 150 }); MockXHR.mode = 'ok';
    const a = SX.speed.run(() => {}); await sleep(80); const b = SX.speed.run(() => {}); const ra = await a; eq(ra.status, 'cancelled'); SX.speed.cancel(); const rb = await b; eq(['cancelled', 'completed'].includes(rb.status), true);
    eq(SX.speed.isRunning(), false);
  });
  await T('speed test: Save-Data caps step size', async () => {
    let maxBytes = 0; const base = mockFetch(); global.fetch = async (u, i) => { const m = /bytes=(\d+)/.exec(u); if (m) maxBytes = Math.max(maxBytes, Number(m[1])); return base(u, i); }; MockXHR.mode = 'ok';
    await SX.speed.run(() => {}, { saveData: true }); eq(maxBytes <= 5e6, true, 'max ' + maxBytes);
  });
  await T('DNS lookup: success / NXDOMAIN / rate limit / network / invalid', async () => {
    global.fetch = mockFetch(); let r = await N.dnsLookup('example.com', 'A', 'cloudflare'); eq([r.statusText, r.answers[0].type, r.answers[0].data], ['NOERROR', 'A', '93.184.216.34']); eq(/Cloudflare/.test(r.resolver), true);
    r = await N.dnsLookup('example.com', 'A', 'google'); eq(/Google/.test(r.resolver), true);
    global.fetch = mockFetch({ dnsJson: { Status: 3 } }); r = await N.dnsLookup('nope.example', 'A', 'cloudflare'); eq([r.statusText, r.answers.length], ['NXDOMAIN', 0]);
    global.fetch = mockFetch({ dnsStatus: 429 }); try { await N.dnsLookup('example.com', 'A', 'cloudflare'); throw new Error('no throw'); } catch (e) { eq(e.code, 'rate'); }
    global.fetch = mockFetch({ fail: true }); try { await N.dnsLookup('example.com', 'A', 'cloudflare'); throw new Error('no throw'); } catch (e) { eq(e.code, 'network'); }
    global.fetch = mockFetch({ dnsJson: { weird: 1 } }); try { await N.dnsLookup('example.com', 'A', 'cloudflare'); throw new Error('no throw'); } catch (e) { eq(e.code, 'badResponse'); }
    try { await N.dnsLookup('bad domain', 'A', 'cloudflare'); throw new Error('no throw'); } catch (e) { eq(e.code, 'invalid'); }
  });
  await T('Public IP: success / failure / malformed response rejected', async () => {
    global.fetch = mockFetch(); let r = await N.publicIP(); eq([r.ip, r.provider], ['203.0.113.9', 'ipify.org']);
    global.fetch = mockFetch({ ip: '<script>alert(1)</script>' }); try { await N.publicIP(); throw new Error('no throw'); } catch (e) { eq(e.code, 'network'); }
    global.fetch = mockFetch({ fail: true }); try { await N.publicIP(); throw new Error('no throw'); } catch (e) { eq(e.code, 'network'); }
  });
  await T('endpoint check: reachable timing and unreachable', async () => {
    global.fetch = mockFetch(); let r = await N.checkEndpoint('https://example.com', 3); eq([r.samples.length, r.failed], [3, 0]);
    global.fetch = mockFetch({ fail: true }); r = await N.checkEndpoint('https://example.com', 3); eq([r.samples.length, r.failed, r.median], [0, 3, null]);
  });
  await T('StabilityMonitor start/stop lifecycle', async () => {
    global.fetch = mockFetch({ fixedDelay: 1 }); global.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
    let n = 0, stopped = null; const m = new N.StabilityMonitor(() => { n++; }, (r) => { stopped = r; }); N.STABILITY.intervalMs = 5; m.start(); await sleep(120); m.stop('user'); const c = n; await sleep(60);
    eq(stopped, 'user'); eq(n, c, 'no samples after stop'); eq(c >= 3, true); eq(m.running, false);
  });
  await T('connectionInfo reflects browser API only when present', () => {
    setNav({ onLine: true }); eq(N.connectionInfo().apiSupported, false); eq(N.connectionInfo().downlink, null);
    setNav({ onLine: true, connection: { effectiveType: '4g', downlink: 9.5, rtt: 50, saveData: false, type: 'cellular' } }); const c = N.connectionInfo(); eq([c.apiSupported, c.effectiveType, c.downlink, c.saveData], [true, '4g', 9.5, false]);
  });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();

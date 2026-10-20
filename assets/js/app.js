/* SANCHARX app controller. Created By Shiv Yogi. */
(function () {
  'use strict';
  const SX = window.SX, U = SX.util, N = SX.net, H = SX.history, R = SX.reports;
  const $ = (id) => document.getElementById(id);
  const t = (k, v) => SX.i18n.t(k, v);
  const lang = () => SX.i18n.lang;
  const E = U.el;
  const APP_VERSION = R.VERSION;

  const S = { result: null, session: [], settings: Object.assign({ motion: 'auto', autosave: false }, SX.store.get('settings', {})), favs: SX.store.get('favs', []), tool: 'stability', view: 'home', running: false, stab: null, stabState: null, selected: [], statusKey: 'idle' };
  if (!Array.isArray(S.favs)) S.favs = [];
  const saveSettings = () => SX.store.set('settings', S.settings);

  /* ---------- motion ---------- */
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => S.settings.motion === 'reduce' || (S.settings.motion === 'auto' && mq.matches);
  function applyMotion() { document.documentElement.setAttribute('data-motion', S.settings.motion); }

  /* ---------- toast / confirm / copy ---------- */
  function toast(msg, err) {
    const el = E('div', { class: 'toast' + (err ? ' err' : '') }, [E('svg', { class: 'ico' }), msg]);
    el.firstChild.remove();
    const svgNS = 'http://www.w3.org/2000/svg', s = document.createElementNS(svgNS, 'svg'), u = document.createElementNS(svgNS, 'use');
    s.setAttribute('class', 'ico'); u.setAttribute('href', err ? '#i-info' : '#i-check'); s.appendChild(u); el.insertBefore(s, el.firstChild);
    $('toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2800);
  }
  function confirmDlg(msg) {
    return new Promise((res) => {
      const d = $('dlg-confirm'); $('conf-msg').textContent = msg; d.returnValue = '';
      d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true }); d.showModal();
    });
  }
  async function copyText(text, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      try { const ta = E('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) { ok = false; }
    }
    if (ok) { toast(t('toast.copied')); if (btn) { btn.classList.add('copied'); setTimeout(() => btn.classList.remove('copied'), 700); } } else toast(t('toast.copyFail'), true);
  }

  /* ---------- gauge ---------- */
  const gv = { shown: 0, target: 0, raf: 0 };
  function paintGauge() {
    $('g-value').textContent = U.fmt(gv.shown, 1);
    const frac = U.clamp(Math.log10(1 + gv.shown) / Math.log10(1001), 0, 1);
    $('arc').style.strokeDashoffset = String(453 * (1 - frac));
  }
  function gaugeStep() {
    gv.shown += (gv.target - gv.shown) * 0.25;
    if (Math.abs(gv.target - gv.shown) < 0.02) { gv.shown = gv.target; gv.raf = 0; } else gv.raf = requestAnimationFrame(gaugeStep);
    paintGauge();
  }
  function setGauge(v) {
    gv.target = v;
    if (reduced() || document.hidden) { gv.shown = v; paintGauge(); return; }
    if (!gv.raf) gv.raf = requestAnimationFrame(gaugeStep);
  }
  function setRing(p) { $('ring').style.strokeDashoffset = String(754 * (1 - U.clamp(p, 0, 1))); $('g-progress').textContent = p > 0 && p < 1 ? t('gauge.progress', { p: Math.round(p * 100) }) : ''; }

  /* ---------- graph ---------- */
  const G = { dl: [], ul: [], raf: 0 };
  function drawGraph() {
    G.raf = 0;
    const all = G.dl.concat(G.ul), max = Math.max(10, ...all) * 1.1, n = G.dl.length + G.ul.length;
    const pts = (arr, off) => arr.map((v, i) => ((off + i) / Math.max(1, n - 1) * 400).toFixed(1) + ',' + (158 - (v / max) * 150).toFixed(1)).join(' ');
    $('g-dl').setAttribute('points', pts(G.dl, 0));
    $('g-ul').setAttribute('points', pts(G.ul, G.dl.length));
    $('graph-empty').hidden = n > 0;
  }
  function queueGraph() { if (!G.raf) G.raf = requestAnimationFrame(drawGraph); }
  function resetGraph() { G.dl = []; G.ul = []; drawGraph(); }

  /* ---------- test UI ---------- */
  const STATE_CLASS = { idle: '', initializing: 'run', measuringLatency: 'run', measuringDownload: 'run', measuringUpload: 'run', finalizing: 'run', completed: 'ok', partial: 'warn', cancelled: 'warn', offline: 'bad', failed: 'bad', unsupported: 'bad', timeout: 'bad' };
  function setState(key) {
    S.statusKey = key;
    $('state-text').textContent = t('state.' + key);
    $('state-msg').className = 'state-msg ' + (STATE_CLASS[key] || '');
    const ph = key === 'measuringLatency' ? 'latency' : key === 'measuringDownload' ? 'download' : key === 'measuringUpload' ? 'upload' : ['completed', 'partial'].includes(key) ? 'done' : key === 'idle' ? 'idle' : 'init';
    $('g-phase').textContent = t('gauge.p.' + ph);
    $('arc').classList.toggle('upload', ph === 'upload');
  }
  function setTile(id, v, d) { const b = $(id).querySelector('[data-val]'); b.textContent = v === null || v === undefined ? '—' : U.fmt(v, d); }
  function renderResultTiles(r) {
    setTile('m-down', r ? r.download : null); setTile('m-up', r ? r.upload : null); setTile('m-lat', r ? r.latency : null); setTile('m-jit', r ? r.jitter : null);
    $('m-lat-sub').textContent = r && r.latencySamples && r.latencySamples.length ? t('m.samples', { n: r.latencySamples.length }) : '';
    $('r-duration').textContent = r && r.durationMs ? (r.durationMs / 1000).toFixed(1) + ' s' : '—';
    $('r-time').textContent = r ? U.fmtDate(r.ts) : '—';
    $('r-status').textContent = r ? t('status.' + r.status) : '—';
  }
  function setRunning(on) {
    S.running = on;
    $('btn-start').hidden = on; $('btn-cancel').hidden = !on;
    $('btn-help').disabled = false;
    updateButtons();
  }
  function updateButtons() {
    const has = !!S.result && (S.result.status === 'completed' || S.result.status === 'partial');
    const saved = has && H.load().items.some((x) => x.id === S.result.id);
    $('btn-save').disabled = !has || saved || S.running;
    $('btn-save').textContent = saved ? t('btn.saved') : t('btn.save');
    $('btn-report').disabled = !has; $('btn-clear').disabled = !S.result || S.running;
    const st = S.statusKey;
    $('btn-start').textContent = ['failed', 'timeout', 'offline', 'unsupported', 'cancelled'].includes(st) ? t('btn.retry') : S.result ? t('btn.again') : t('btn.start');
  }
  function showError(res) {
    const box = $('error-box');
    const codes = Object.entries(res.errors || {});
    let msg = '';
    if (res.status === 'offline') msg = t('err.offline');
    else if (res.status === 'unsupported') msg = t('err.unsupported');
    else if (res.status === 'cancelled') msg = t('err.cancelled');
    else if (res.status === 'timeout') msg = t('err.timeout');
    else if (res.status === 'failed') msg = t('err.failed') + ' ' + codes.map(([k, v]) => t('phase.' + k) + ': ' + t('err.' + v)).join('; ');
    else if (res.status === 'partial') msg = t('err.partial') + ' ' + codes.map(([k, v]) => t('phase.' + k) + ': ' + t('err.' + v)).join('; ');
    box.textContent = msg; box.hidden = !msg;
  }

  async function startTest() {
    if (S.running) return;
    S.result = S.result && ['completed', 'partial'].includes(S.result.status) ? S.result : null;
    $('error-box').hidden = true;
    resetGraph(); renderResultTiles(null); setRing(0); setGauge(0);
    const conn = N.connectionInfo();
    setRunning(true); setState('initializing');
    const res = await SX.speed.run((e) => {
      if (e.type === 'state') { if (S.running) setState(e.state); }
      else if (e.type === 'progress') setRing(e.progress);
      else if (e.type === 'latency') { setTile('m-lat', U.median(e.samples)); setTile('m-jit', U.jitter(e.samples)); $('m-lat-sub').textContent = t('m.samples', { n: e.samples.length }); setRing(e.progress); }
      else if (e.type === 'sample') { (e.phase === 'download' ? G.dl : G.ul).push(e.mbps); queueGraph(); setGauge(e.mbps); }
      else if (e.type === 'step') { setTile(e.phase === 'download' ? 'm-down' : 'm-up', e.mbps); setRing(e.progress); }
    }, { saveData: conn.saveData === true, conn: { type: conn.type, effectiveType: conn.effectiveType, downlink: conn.downlink, rtt: conn.rtt, saveData: conn.saveData } });
    // a replaced run returns 'cancelled' for the old one; ignore if a newer run is active
    if (SX.speed.isRunning()) return;
    setRunning(false);
    finishTest(res);
  }
  function finishTest(res) {
    setState(res.status); showError(res);
    if (res.status === 'completed' || res.status === 'partial') {
      S.result = res; S.session.unshift(res);
      renderResultTiles(res); setGauge(res.download !== null ? res.download : 0); setRing(1);
      ['g-dl', 'g-ul'].forEach((id) => { const l = $(id); l.classList.remove('draw'); void l.getBoundingClientRect(); l.classList.add('draw'); });
      if (S.settings.autosave) { const r = H.save(res); if (r.ok) toast(t('toast.saved')); else if (r.err === 'storage') toast(t('toast.storageFail'), true); }
      toast(t('toast.done'));
    } else { renderResultTiles(res.status === 'cancelled' ? null : res); setGauge(0); setRing(0); }
    updateButtons(); renderLab(); renderAdvisor(); renderHistory(); renderReportSources();
  }
  async function clearResults() {
    if (S.result && !(await confirmDlg(t('confirm.clearResults')))) return;
    S.result = null; renderResultTiles(null); resetGraph(); setGauge(0); setRing(0); setState('idle'); $('error-box').hidden = true;
    updateButtons(); renderAdvisor(); renderReportSources(); renderLab();
  }

  /* ---------- connection + lab ---------- */
  function renderConn() {
    const c = N.connectionInfo(), box = $('conn-list'), na = t('conn.na');
    box.textContent = '';
    const rows = [
      [t('conn.online'), c.online ? t('yes') : t('no')],
      [t('conn.api'), c.apiSupported ? t('yes') : t('no')],
      [t('conn.type'), c.type || na], [t('conn.eff'), c.effectiveType || na],
      [t('conn.downlink'), c.downlink !== null ? c.downlink + ' Mbps' : na], [t('conn.rtt'), c.rtt !== null ? c.rtt + ' ms' : na],
      [t('conn.save'), c.saveData === null ? na : c.saveData ? t('yes') : t('no')],
    ];
    rows.forEach(([k, v]) => box.appendChild(E('div', {}, [E('dt', { text: k }), E('dd', { text: v })])));
  }
  function labItems() {
    const saved = H.load().items, map = new Map();
    S.session.concat(saved).forEach((x) => { if (x && !map.has(x.id)) map.set(x.id, x); });
    return Array.from(map.values()).sort((a, b) => b.ts - a.ts);
  }
  function renderLab() {
    const items = labItems(), sm = H.summary(items), body = $('lab-table').querySelector('tbody');
    body.textContent = '';
    const units = { download: 'Mbps', upload: 'Mbps', latency: 'ms', jitter: 'ms' };
    const names = { download: t('m.down'), upload: t('m.up'), latency: t('m.lat'), jitter: t('m.jit') };
    const enough = items.length >= 2;
    Object.keys(units).forEach((k) => {
      const s = sm[k]; const c = (v) => (enough && s ? U.fmt(v) + ' ' + units[k] : '—');
      body.appendChild(E('tr', {}, [E('td', { text: names[k] }), E('td', { text: s ? c(s.best) : '—' }), E('td', { text: s ? c(s.avg) : '—' }), E('td', { text: s ? c(s.worst) : '—' })]));
    });
    $('lab-note').textContent = enough ? t('lab.n', { n: items.length }) : t('lab.need');
  }

  /* ---------- router ---------- */
  const VIEWS = ['home', 'tools', 'reports', 'ai'];
  const TOOLS = ['stability', 'troubleshoot', 'calc', 'subnet', 'dns', 'ip', 'endpoint', 'advisor', 'safety'];
  function route(focus) {
    const parts = (location.hash || '#home').slice(1).split('/');
    const v = VIEWS.includes(parts[0]) ? parts[0] : 'home';
    if (v !== S.view && S.view === 'tools') stopStability('left');
    VIEWS.forEach((id) => {
      const sec = $('view-' + id), on = id === v;
      if (on && sec.hidden) { sec.hidden = false; sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter'); }
      else if (!on) { sec.hidden = true; sec.classList.remove('enter'); }
    });
    S.view = v;
    U.$$('[data-nav]').forEach((a) => { if (a.dataset.nav === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.querySelector('.nav-pill').style.setProperty('--i', String(VIEWS.indexOf(v)));
    if (v === 'tools') selectTool(TOOLS.includes(parts[1]) ? parts[1] : S.tool, false);
    if (v === 'reports') { renderHistory(); renderReportSources(); }
    if (v === 'ai') SX.assistant.start();
    if (focus) { window.scrollTo(0, 0); $('main').focus({ preventScroll: true }); }
  }
  function go(h) { if (location.hash === h) route(true); else location.hash = h; }

  /* ---------- tools: tabs + favorites ---------- */
  function selectTool(id, pushHash) {
    if (S.tool === 'stability' && id !== 'stability') stopStability('left');
    S.tool = id;
    U.$$('#tool-tabs [role=tab]').forEach((b) => { const on = b.dataset.tool === id; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; if (on && pushHash !== false) b.scrollIntoView({ block: 'nearest', inline: 'center' }); });
    U.$$('.tool-panel').forEach((p) => { const on = p.dataset.toolPanel === id; if (on && p.hidden) { p.hidden = false; p.classList.remove('enter'); void p.offsetWidth; p.classList.add('enter'); } else if (!on) p.hidden = true; });
    if (id === 'advisor') renderAdvisor();
    if (id === 'troubleshoot') renderTroubleshoot();
    if (pushHash !== false && location.hash !== '#tools/' + id) history.replaceState(null, '', '#tools/' + id);
  }
  function renderFavs() {
    U.$$('.fav-btn').forEach((b) => b.setAttribute('aria-pressed', S.favs.includes(b.dataset.fav) ? 'true' : 'false'));
    const chips = $('fav-chips'); chips.textContent = '';
    S.favs.filter((f) => TOOLS.includes(f)).forEach((f) => chips.appendChild(E('button', { type: 'button', class: 'chip', text: t('tool.' + f), onclick: () => selectTool(f) })));
    $('fav-bar').hidden = !S.favs.length;
  }
  function toggleFav(id, btn) {
    const i = S.favs.indexOf(id);
    if (i >= 0) S.favs.splice(i, 1); else S.favs.push(id);
    SX.store.set('favs', S.favs); renderFavs();
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
  }

  /* ---------- stability ---------- */
  function drawStab(samples) {
    const max = Math.max(50, ...samples) * 1.1;
    $('stab-line').setAttribute('points', samples.map((v, i) => (i / Math.max(1, N.STABILITY.maxSamples - 1) * 400).toFixed(1) + ',' + (96 - (v / max) * 90).toFixed(1)).join(' '));
  }
  function renderStabStats(s) {
    $('st-n').textContent = String(s.count); $('st-med').textContent = U.fmt(s.median); $('st-jit').textContent = U.fmt(s.jitter); $('st-sd').textContent = U.fmt(s.stdev); $('st-max').textContent = U.fmt(s.max); $('st-fail').textContent = String(s.failures);
    const v = $('stab-verdict'); v.textContent = t('stab.v.' + s.verdict); v.style.color = s.verdict === 'stable' ? 'var(--emerald)' : s.verdict === 'unstable' ? 'var(--danger)' : s.verdict === 'fair' ? 'var(--amber)' : 'var(--muted)';
  }
  function startStability() {
    if (S.stab && S.stab.running) return;
    $('stab-start').hidden = true; $('stab-stop').hidden = false;
    S.stab = new N.StabilityMonitor((samples, stats) => { S.stabState = stats; drawStab(samples); renderStabStats(stats); renderAdvisor(); }, (reason) => {
      $('stab-start').hidden = false; $('stab-stop').hidden = true;
      if (reason === 'hidden') toast(t('stab.pausedHidden'));
    });
    S.stab.start();
  }
  function stopStability(reason) { if (S.stab && S.stab.running) S.stab.stop(reason); }

  /* ---------- troubleshooter ---------- */
  function renderTroubleshoot() {
    const sel = $('ts-issue'), cur = sel.value;
    if (!sel.options.length || sel.dataset.lang !== lang()) {
      sel.textContent = '';
      SX.content.ISSUES.forEach((i) => sel.appendChild(E('option', { value: i.id, text: i.t[lang()] })));
      sel.dataset.lang = lang(); if (cur) sel.value = cur;
    }
    const d = SX.diagnose(sel.value, S.result, lang()), out = $('ts-out');
    out.textContent = '';
    out.appendChild(E('h3', { text: d.title }));
    out.appendChild(E('p', { class: 'muted small', text: t('ts.evidence') }));
    out.appendChild(E('ul', { class: 'plain' }, d.observations.map((o) => E('li', { text: o }))));
    out.appendChild(E('p', { class: 'muted small', text: t('ts.steps') }));
    out.appendChild(E('ol', { class: 'steps' }, d.steps.map((s) => E('li', { text: s }))));
  }

  /* ---------- calculators ---------- */
  const unitList = Object.keys(N.UNITS);
  function calcMsg(err) { return t('err.num.' + err); }
  function calc1() {
    const p = N.parseNum($('c1-val').value), o = $('c1-out');
    if ($('c1-val').value.trim() === '') { o.textContent = ''; return; }
    if (!p.ok) { o.textContent = calcMsg(p.err); return; }
    o.textContent = $('c1-dir').value === 'a' ? U.fmt(p.value, 3) + ' Mbps = ' + U.fmt(N.mbpsToMBps(p.value), 3) + ' MB/s' : U.fmt(p.value, 3) + ' MB/s = ' + U.fmt(N.MBpsToMbps(p.value), 3) + ' Mbps';
  }
  function calc2() {
    const p = N.parseNum($('c2-val').value), o = $('c2-out');
    if ($('c2-val').value.trim() === '') { o.textContent = ''; return; }
    if (!p.ok) { o.textContent = calcMsg(p.err); return; }
    const v = N.convertSize(p.value, $('c2-from').value, $('c2-to').value);
    o.textContent = p.value + ' ' + $('c2-from').value + ' = ' + (v >= 1e6 || (v < 0.001 && v > 0) ? v.toExponential(4) : String(+v.toFixed(6))) + ' ' + $('c2-to').value;
  }
  function calc3() {
    const o = $('c3-out');
    if ($('c3-size').value.trim() === '' && $('c3-speed').value.trim() === '') { o.textContent = ''; return; }
    const a = N.parseNum($('c3-size').value), b = N.parseNum($('c3-speed').value, { positive: true });
    if (!a.ok) { o.textContent = t('calc.size') + ': ' + calcMsg(a.err); return; }
    if (!b.ok) { o.textContent = t('calc.speedMbps') + ': ' + calcMsg(b.err); return; }
    o.textContent = t('calc.ideal') + ': ' + N.fmtDuration(N.transferSeconds(a.value, $('c3-unit').value, b.value));
  }
  function calc4() {
    const o = $('c4-out');
    if ($('c4-speed').value.trim() === '' && $('c4-dur').value.trim() === '') { o.textContent = ''; return; }
    const a = N.parseNum($('c4-speed').value), b = N.parseNum($('c4-dur').value);
    if (!a.ok) { o.textContent = t('calc.speedMbps') + ': ' + calcMsg(a.err); return; }
    if (!b.ok) { o.textContent = t('calc.duration') + ': ' + calcMsg(b.err); return; }
    const bytes = N.dataTransferred(a.value, b.value * Number($('c4-unit').value));
    o.textContent = N.fmtBytes(bytes) + ' (' + N.fmtBytes(bytes, true) + ')';
  }

  /* ---------- subnet ---------- */
  function calcSubnet() {
    const ip = $('sn-ip').value, mk = $('sn-mask').value, err = $('sn-err'), tb = $('sn-table'), body = tb.querySelector('tbody');
    body.textContent = '';
    if (!ip.trim() && !mk.trim()) { err.hidden = true; tb.hidden = true; return; }
    const r = N.subnet(ip, mk);
    if (!r.ok) { err.hidden = false; err.textContent = (r.field === 'ip' ? t('sub.ip') : t('sub.mask')) + ': ' + t('err.sn.' + r.err); tb.hidden = true; return; }
    err.hidden = true; tb.hidden = false;
    const rows = [[t('sub.valid'), t('yes')], [t('sub.type'), t('ipkind.' + r.kind)], ['CIDR', '/' + r.cidr], [t('sub.maskDotted'), r.mask], [t('sub.wildcard'), r.wildcard], [t('sub.network'), r.network],
      [t('sub.broadcast'), r.broadcast || t('sub.noBroadcast')], [t('sub.hosts'), r.hosts.toLocaleString()], [t('sub.range'), r.first + (r.first === r.last ? '' : ' – ' + r.last)], [t('sub.total'), r.total.toLocaleString()]];
    if (r.point) rows.push([t('sub.note'), t('sub.' + r.point)]);
    rows.forEach(([k, v]) => body.appendChild(E('tr', {}, [E('th', { scope: 'row', text: k }), E('td', { text: v })])));
  }

  /* ---------- DNS / IP / endpoint ---------- */
  function loading(box) { box.textContent = ''; box.appendChild(E('span', { class: 'skeleton' })); box.appendChild(E('span', { class: 'skeleton', style: 'width:60%' })); }
  async function doDns() {
    const out = $('dns-out'), btn = $('dns-go');
    const v = N.validateDomain($('dns-domain').value);
    if (!v.ok) { out.textContent = ''; out.appendChild(E('p', { class: 'notice warn', text: t('err.dom.' + v.err) })); return; }
    btn.disabled = true; loading(out);
    try {
      const r = await N.dnsLookup(v.domain, $('dns-type').value, $('dns-resolver').value);
      out.textContent = '';
      out.appendChild(E('p', { class: 'muted small', text: t('dns.resolverUsed') + ': ' + r.resolver + ' · ' + t('dns.status') + ': ' + r.statusText + ' · ' + Math.round(r.ms) + ' ms' }));
      if (!r.answers.length) out.appendChild(E('p', { class: 'notice info', text: r.status === 3 ? t('dns.nxdomain') : t('dns.noAnswers') }));
      else out.appendChild(E('div', { class: 'table-scroll' }, [E('table', { class: 'table' }, [E('thead', {}, [E('tr', {}, [t('dns.name'), t('dns.type'), 'TTL', t('dns.data')].map((h) => E('th', { text: h })))]), E('tbody', {}, r.answers.map((a) => E('tr', {}, [E('td', { text: a.name }), E('td', { text: a.type }), E('td', { text: String(a.ttl) }), E('td', { text: a.data, style: 'white-space:normal;word-break:break-all' })])))])]));
      out.appendChild(E('p', { class: 'muted small', text: t('dns.cache') }));
    } catch (e) { out.textContent = ''; out.appendChild(E('p', { class: 'notice warn', role: 'alert', text: t('err.dns.' + (e.code || 'network')) })); }
    btn.disabled = false;
  }
  async function doIp() {
    const out = $('ip-out'), btn = $('ip-go'); btn.disabled = true; loading(out);
    try {
      const r = await N.publicIP(); out.textContent = '';
      out.appendChild(E('p', {}, [E('strong', { text: r.ip, style: 'font-size:1.4rem;word-break:break-all' })]));
      out.appendChild(E('p', { class: 'muted small', text: t('ip.provider') + ': ' + r.provider }));
      out.appendChild(E('div', { class: 'controls wrap' }, [E('button', { type: 'button', class: 'btn small', text: t('btn.copy'), onclick: (ev) => copyText(r.ip, ev.currentTarget) })]));
      out.appendChild(E('p', { class: 'muted small', text: t('ip.geo') }));
    } catch (e) { out.textContent = ''; out.appendChild(E('p', { class: 'notice warn', role: 'alert', text: t('err.ip.' + (e.code || 'network')) })); }
    btn.disabled = false;
  }
  async function doEndpoint() {
    const err = $('ep-err'), out = $('ep-out'), btn = $('ep-go');
    const v = N.validateTargetUrl($('ep-url').value, $('ep-http').checked);
    if (!v.ok) { err.hidden = false; err.textContent = t('err.url.' + v.err); out.textContent = ''; return; }
    err.hidden = true; btn.disabled = true; loading(out);
    const r = await N.checkEndpoint(v.url, 3);
    out.textContent = '';
    out.appendChild(E('p', { class: 'muted small', text: v.host }));
    if (!r.samples.length) out.appendChild(E('p', { class: 'notice warn', role: 'alert', text: t('ep.unreachable') }));
    else {
      out.appendChild(E('p', {}, [E('strong', { text: t('ep.reachable') })]));
      out.appendChild(E('p', { text: t('ep.timing', { med: U.fmt(r.median), min: U.fmt(r.min), max: U.fmt(r.max), n: r.samples.length, f: r.failed }) }));
      out.appendChild(E('p', { class: 'muted small', text: t('ep.opaque') }));
    }
    btn.disabled = false;
  }

  /* ---------- advisor + safety ---------- */
  function renderAdvisor() {
    const box = $('adv-out'); if (!box) return;
    box.textContent = '';
    if (!S.result) box.appendChild(E('p', { class: 'empty', text: t('adv.empty') }));
    const items = N.advise(S.result, S.stabState);
    const sym = { good: '✓', fair: '~', poor: '✕', unknown: '?' };
    items.forEach((it) => box.appendChild(E('div', { class: 'adv-item' }, [E('div', { class: 'row' }, [E('strong', { text: t('adv.' + it.id) }), E('span', { class: 'lvl ' + it.level, text: sym[it.level] + ' ' + t('lvl.' + it.level) })]), E('span', { class: 'muted small', text: t('adv.' + it.id + '.d') })])));
  }
  function renderSafety() {
    const box = $('safe-out'); box.textContent = '';
    SX.content.SAFETY.forEach((s) => box.appendChild(E('details', { class: 'safe-item' }, [E('summary', { text: s.t[lang()] }), E('p', { class: 'muted', text: s.b[lang()], style: 'padding-bottom:10px' })])));
  }

  /* ---------- history + reports ---------- */
  function sparkline(vals) {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), pl = document.createElementNS(ns, 'polyline');
    svg.setAttribute('viewBox', '0 0 200 40'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'spark'); svg.setAttribute('aria-hidden', 'true');
    const max = Math.max(...vals), min = Math.min(...vals), span = max - min || 1;
    pl.setAttribute('points', vals.map((v, i) => (i / Math.max(1, vals.length - 1) * 200).toFixed(1) + ',' + (36 - ((v - min) / span) * 32).toFixed(1)).join(' '));
    pl.setAttribute('class', 'g-line dl'); svg.appendChild(pl); return svg;
  }
  function renderHistory() {
    const { items, corrupted } = H.load();
    const list = $('hist-list'); list.textContent = '';
    $('hist-warn').hidden = !(corrupted || !SX.store.available);
    $('hist-warn').textContent = !SX.store.available ? t('hist.noStorage') : t('hist.corrupt');
    $('hist-clear').disabled = !items.length;
    S.selected = S.selected.filter((id) => items.some((x) => x.id === id));
    if (!items.length) list.appendChild(E('li', { class: 'empty', text: t('hist.empty') }));
    items.forEach((x) => {
      const cb = E('input', { type: 'checkbox', 'aria-label': t('hist.select'), checked: S.selected.includes(x.id) ? true : null, onchange: (ev) => {
        if (ev.target.checked) { S.selected.push(x.id); if (S.selected.length > 2) { const old = S.selected.shift(); const o = list.querySelector('[data-id="' + old + '"] input'); if (o) o.checked = false; } } else S.selected = S.selected.filter((i) => i !== x.id);
        renderCompare(items);
      } });
      const li = E('li', { class: 'hist-item', 'data-id': x.id }, [cb,
        E('div', {}, [E('div', { class: 'when', text: U.fmtDate(x.ts) + (x.status === 'partial' ? ' · ' + t('status.partial') : '') }), E('div', { class: 'vals', text: '↓ ' + U.fmt(x.download) + '  ↑ ' + U.fmt(x.upload) + ' Mbps · ' + U.fmt(x.latency) + ' ms · ' + t('m.jit') + ' ' + U.fmt(x.jitter) + ' ms' })]),
        E('button', { type: 'button', class: 'icon-btn', 'aria-label': t('hist.delete'), onclick: () => { H.remove(x.id); renderHistory(); renderReportSources(); renderLab(); updateButtons(); toast(t('toast.deleted')); } }, [])]);
      const b = li.querySelector('button'); const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); s.setAttribute('class', 'ico'); u.setAttribute('href', '#i-trash'); s.appendChild(u); b.appendChild(s);
      list.appendChild(li);
    });
    const tr = $('hist-trend'); tr.textContent = '';
    ['download', 'latency'].forEach((k) => {
      const trd = H.trend(items, k);
      if (!trd) return;
      const vals = items.map((x) => x[k]).filter((v) => v !== null).reverse();
      tr.appendChild(E('div', {}, [E('p', { class: 'small', text: (k === 'download' ? t('m.down') : t('m.lat')) + ': ' + t('trend.' + trd.dir, { pct: Math.abs(trd.pct).toFixed(0) }) }), sparkline(vals)]));
    });
    if (items.length && items.length < 3) tr.appendChild(E('p', { class: 'muted small', text: t('trend.need') }));
    renderCompare(items);
  }
  function renderCompare(items) {
    const box = $('hist-compare'); box.textContent = '';
    if (S.selected.length !== 2) { if (items.length >= 2) box.appendChild(E('p', { class: 'muted small', text: t('cmp.hint') })); return; }
    const [a, b] = S.selected.map((id) => items.find((x) => x.id === id)).sort((p, q) => q.ts - p.ts);
    const d = H.compare(a, b), unit = { download: 'Mbps', upload: 'Mbps', latency: 'ms', jitter: 'ms' }, names = { download: t('m.down'), upload: t('m.up'), latency: t('m.lat'), jitter: t('m.jit') };
    const rows = Object.keys(unit).map((k) => {
      let verdict = '—';
      if (d[k]) { const better = unit[k] === 'Mbps' ? d[k].diff > 0 : d[k].diff < 0; verdict = Math.abs(d[k].diff) < 1e-9 ? t('cmp.same') : (better ? '▲ ' + t('cmp.better') : '▼ ' + t('cmp.worse')) + (d[k].pct !== null ? ' (' + (d[k].pct > 0 ? '+' : '') + d[k].pct.toFixed(0) + '%)' : ''); }
      return E('tr', {}, [E('td', { text: names[k] }), E('td', { text: U.fmt(a[k]) }), E('td', { text: U.fmt(b[k]) }), E('td', { text: verdict })]);
    });
    box.appendChild(E('p', { class: 'small muted', text: t('cmp.note', { a: U.fmtDate(a.ts), b: U.fmtDate(b.ts) }) }));
    box.appendChild(E('div', { class: 'table-scroll' }, [E('table', { class: 'table' }, [E('thead', {}, [E('tr', {}, [t('lab.metric'), t('cmp.newer'), t('cmp.older'), t('cmp.change')].map((h) => E('th', { text: h })))]), E('tbody', {}, rows)])]));
  }
  function currentReportEntry() {
    const v = $('rep-source').value;
    if (v === 'last') return S.result && ['completed', 'partial'].includes(S.result.status) ? S.result : null;
    return H.load().items.find((x) => x.id === v) || null;
  }
  function renderReportSources() {
    const sel = $('rep-source'), cur = sel.value; sel.textContent = '';
    const hasLast = S.result && ['completed', 'partial'].includes(S.result.status);
    if (hasLast) sel.appendChild(E('option', { value: 'last', text: t('rep.latest') + ' (' + U.fmtDate(S.result.ts) + ')' }));
    H.load().items.forEach((x) => sel.appendChild(E('option', { value: x.id, text: U.fmtDate(x.ts) + ' · ↓' + U.fmt(x.download) + ' ↑' + U.fmt(x.upload) })));
    if (!sel.options.length) sel.appendChild(E('option', { value: '', text: t('rep.none') }));
    if (cur && Array.from(sel.options).some((o) => o.value === cur)) sel.value = cur;
    renderReport();
  }
  function renderReport() {
    const sh = $('report-sheet'); R.render(sh, currentReportEntry(), lang(), t);
    sh.classList.remove('refresh'); void sh.offsetWidth; sh.classList.add('refresh');
    $('rep-print').disabled = $('rep-copy').disabled = !currentReportEntry();
  }
  function printReport() {
    if (!currentReportEntry()) return;
    const old = document.title; document.title = R.FILE_NAME; document.body.classList.add('printing-report');
    const done = () => { document.body.classList.remove('printing-report'); document.title = old; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { try { window.print(); } catch (e) { done(); toast(t('toast.printFail'), true); } }, 60);
  }

  /* ---------- settings ---------- */
  function diagText() {
    const c = N.connectionInfo();
    return ['SANCHARX v' + APP_VERSION, 'Language: ' + lang(), 'Motion: ' + S.settings.motion + ' (reduced now: ' + reduced() + ')', 'Online: ' + c.online, 'Network Information API: ' + c.apiSupported,
      'Local storage available: ' + SX.store.available, 'Speed endpoint: speed.cloudflare.com', 'Viewport: ' + innerWidth + 'x' + innerHeight, 'User agent: ' + navigator.userAgent].join('\n');
  }
  function openSettings() {
    $('set-lang').value = lang(); $('set-motion').value = S.settings.motion; $('set-autosave').checked = !!S.settings.autosave; $('diag-out').textContent = diagText();
    $('dlg-settings').showModal();
  }

  /* ---------- language ---------- */
  function setLang(l) {
    SX.i18n.setLang(l); $('lang-select').value = l; document.documentElement.lang = l;
    SX.i18n.apply(document); rerender();
  }
  function rerender() {
    setState(S.statusKey); renderConn(); renderLab(); renderFavs(); renderTroubleshoot(); renderAdvisor(); renderSafety(); renderHistory(); renderReportSources(); updateButtons();
    $('ts-issue').dataset.lang = ''; renderTroubleshoot();
    if (S.stabState) renderStabStats(S.stabState); else $('stab-verdict').textContent = '';
    renderResultTiles(S.result && ['completed', 'partial'].includes(S.result.status) ? S.result : null);
    if (SX.assistant.refresh) SX.assistant.refresh();
    calc1(); calc2(); calc3(); calc4(); calcSubnet();
  }

  /* ---------- intro ---------- */
  function intro() {
    const el = $('intro'); let seen = false;
    try { seen = sessionStorage.getItem('sx.intro') === '1'; } catch (e) { /* ignore */ }
    if (seen) return;
    el.hidden = false;
    const close = () => { if (el.hidden) return; try { sessionStorage.setItem('sx.intro', '1'); } catch (e) { /* ignore */ } el.classList.add('leaving'); setTimeout(() => { el.hidden = true; el.classList.remove('leaving'); }, reduced() ? 0 : 550); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    $('intro-skip').addEventListener('click', close); el.addEventListener('click', close);
    setTimeout(close, reduced() ? 900 : 3300);
  }

  /* ---------- init ---------- */
  function init() {
    applyMotion();
    SX.i18n.init();
    $('lang-select').value = lang(); document.documentElement.lang = lang(); SX.i18n.apply(document);

    unitList.forEach((u) => { ['c2-from', 'c2-to', 'c3-unit'].forEach((id) => $(id).appendChild(E('option', { value: u, text: u }))); });
    $('c2-from').value = 'MB'; $('c2-to').value = 'MiB'; $('c3-unit').value = 'MB';

    $('btn-start').addEventListener('click', startTest);
    $('btn-cancel').addEventListener('click', () => SX.speed.cancel());
    $('btn-clear').addEventListener('click', clearResults);
    $('btn-save').addEventListener('click', () => { const r = H.save(S.result); if (r.ok) toast(t('toast.saved')); else toast(t(r.err === 'duplicate' ? 'toast.alreadySaved' : 'toast.storageFail'), true); updateButtons(); renderLab(); });
    $('btn-report').addEventListener('click', () => { go('#reports'); renderReportSources(); $('rep-source').value = 'last'; renderReport(); });
    $('btn-help').addEventListener('click', () => { go('#ai'); SX.assistant.openHelp(); });

    window.addEventListener('hashchange', () => route(true));
    U.$$('#tool-tabs [role=tab]').forEach((b, i, all) => {
      b.addEventListener('click', () => selectTool(b.dataset.tool));
      b.addEventListener('keydown', (e) => { const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (k) { e.preventDefault(); const n = all[(i + k + all.length) % all.length]; n.focus(); selectTool(n.dataset.tool); } if (e.key === 'Home') { e.preventDefault(); all[0].focus(); selectTool(all[0].dataset.tool); } if (e.key === 'End') { e.preventDefault(); all[all.length - 1].focus(); selectTool(all[all.length - 1].dataset.tool); } });
    });
    U.$$('.fav-btn').forEach((b) => b.addEventListener('click', () => toggleFav(b.dataset.fav, b)));

    $('stab-start').addEventListener('click', startStability); $('stab-stop').addEventListener('click', () => stopStability('user'));
    $('ts-issue').addEventListener('change', renderTroubleshoot);
    ['c1-val', 'c1-dir'].forEach((id) => $(id).addEventListener('input', calc1));
    ['c2-val', 'c2-from', 'c2-to'].forEach((id) => $(id).addEventListener('input', calc2));
    ['c3-size', 'c3-unit', 'c3-speed'].forEach((id) => $(id).addEventListener('input', calc3));
    ['c4-speed', 'c4-dur', 'c4-unit'].forEach((id) => $(id).addEventListener('input', calc4));
    $('c3-dl').addEventListener('click', () => { if (S.result && S.result.download !== null) { $('c3-speed').value = U.fmt(S.result.download, 2); calc3(); } else toast(t('calc.noResult'), true); });
    $('c3-ul').addEventListener('click', () => { if (S.result && S.result.upload !== null) { $('c3-speed').value = U.fmt(S.result.upload, 2); calc3(); } else toast(t('calc.noResult'), true); });
    ['sn-ip', 'sn-mask'].forEach((id) => $(id).addEventListener('input', calcSubnet));
    $('dns-go').addEventListener('click', doDns); $('dns-domain').addEventListener('keydown', (e) => { if (e.key === 'Enter') doDns(); });
    $('ip-go').addEventListener('click', doIp);
    $('ep-go').addEventListener('click', doEndpoint); $('ep-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') doEndpoint(); });

    $('hist-clear').addEventListener('click', async () => { if (await confirmDlg(t('confirm.clearHist'))) { H.clear(); S.selected = []; renderHistory(); renderReportSources(); renderLab(); updateButtons(); toast(t('toast.cleared')); } });
    $('rep-source').addEventListener('change', renderReport);
    $('rep-print').addEventListener('click', printReport);
    $('rep-copy').addEventListener('click', (e) => copyText(R.summaryText(currentReportEntry(), lang(), t), e.currentTarget));

    $('btn-settings').addEventListener('click', openSettings);
    $('lang-select').addEventListener('change', (e) => setLang(e.target.value));
    $('set-lang').addEventListener('change', (e) => setLang(e.target.value));
    $('set-motion').addEventListener('change', (e) => { S.settings.motion = e.target.value; saveSettings(); applyMotion(); });
    $('set-autosave').addEventListener('change', (e) => { S.settings.autosave = e.target.checked; saveSettings(); });
    $('set-clear-hist').addEventListener('click', async () => { if (await confirmDlg(t('confirm.clearHist'))) { H.clear(); renderHistory(); renderReportSources(); renderLab(); updateButtons(); toast(t('toast.cleared')); } });
    $('set-clear-all').addEventListener('click', async () => { if (await confirmDlg(t('confirm.clearAll'))) { SX.store.clearAll(); S.settings = { motion: 'auto', autosave: false }; S.favs = []; applyMotion(); setLang(SX.i18n.detect()); renderFavs(); renderHistory(); renderReportSources(); renderLab(); updateButtons(); toast(t('toast.cleared')); } });
    $('diag-copy').addEventListener('click', (e) => copyText(diagText(), e.currentTarget));

    window.addEventListener('online', () => { renderConn(); toast(t('toast.online')); });
    window.addEventListener('offline', () => { renderConn(); toast(t('toast.offline'), true); });
    const c = navigator.connection; if (c && c.addEventListener) c.addEventListener('change', renderConn);
    document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));
    window.addEventListener('pagehide', () => { SX.speed.cancel(); stopStability('left'); });

    SX.assistant.init({ t, lang, setLang, result: () => S.result, reduced });
    setState('idle'); setGauge(0); setRing(0); renderResultTiles(null); resetGraph(); rerender();
    selectTool('stability', false);
    route(false); intro();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

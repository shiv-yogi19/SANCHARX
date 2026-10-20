/* SANCHARX rule-based assistant. Deterministic matching over 50 predefined FAQs. NOT generative AI.
   Created By Shiv Yogi. */
(function (root) {
  'use strict';
  const SX = (root.SX = root.SX || {});
  const U = SX.util || require('./utils.js');
  const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'my', 'i', 'to', 'of', 'in', 'it', 'do', 'does', 'how', 'what', 'why', 'can', 'me', 'and', 'for', 'on', 'क्या', 'है', 'मेरा', 'मेरी', 'कैसे', 'क्यों', 'को', 'में', 'का', 'की', 'से', 'और', 'हो', 'हूँ']);

  const tokenize = (s) => String(s || '').toLowerCase().split(/[^\p{L}\p{M}\p{N}.]+/u).map((x) => x.replace(/^\.+|\.+$/g, '')).filter((x) => x && !STOP.has(x));

  /** Score a query against one FAQ entry. Pure and deterministic. */
  function score(entry, q, toks) {
    let s = 0;
    const kws = entry.k.map((k) => k.toLowerCase());
    const qtext = (entry.q.en + ' ' + entry.q.hi).toLowerCase();
    kws.forEach((k) => { if (k.length > 2 && q.includes(k)) s += 5; });
    toks.forEach((t) => {
      if (kws.includes(t)) s += 3;
      else if (t.length > 2 && qtext.includes(t)) s += 1.2;
    });
    return s;
  }
  const THRESHOLD = 2.5;

  /** Returns up to `limit` entries ordered by score, only those above threshold. */
  function search(query, limit) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return [];
    const toks = tokenize(q);
    return SX.FAQ.map((e) => ({ e, s: score(e, q, toks) })).filter((x) => x.s >= THRESHOLD).sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id)).slice(0, limit || 3).map((x) => x.e);
  }
  const byCategory = (c) => SX.FAQ.filter((e) => e.c === c);

  /** Recognised intents that use measured values. */
  function intent(query) {
    const q = String(query || '').toLowerCase();
    if (/(explain|understand|meaning of).*(result|report|value|number)|my result|नतीजा समझ|रिज़ल्ट समझ|result samjha/.test(q)) return 'explain';
    if (/improve|boost|increase (my )?speed|speed (badh|increase)|स्पीड बढ़ा|सुधार/.test(q)) return 'improve';
    return null;
  }

  /** Which troubleshooting playbooks fit the measured values (never guesses without data). */
  function suggestIssues(r) {
    if (!r) return [];
    const out = [];
    if (r.download !== null && r.download < 10) out.push('slowDown');
    if (r.upload !== null && r.upload < 3) out.push('slowUp');
    if (r.latency !== null && r.latency > 80) out.push('latency');
    if (r.jitter !== null && r.jitter > 25) out.push('unstable');
    if (!out.length) out.push('router');
    return out.slice(0, 4);
  }

  const A = { tokenize, score, search, byCategory, intent, suggestIssues, THRESHOLD };

  /* ---------------- UI controller (browser only) ---------------- */
  A.init = function (ctx) {
    const $ = (id) => document.getElementById(id);
    const log = $('chat-log'), cats = $('ai-cats'), sug = $('ai-suggest'), form = $('chat-form'), input = $('chat-input');
    const t = ctx.t;
    const ss = { get(k) { try { return root.sessionStorage.getItem('sx.' + k); } catch (e) { return null; } }, set(k, v) { try { root.sessionStorage.setItem('sx.' + k, v); } catch (e) { /* ignore */ } } };
    let step = ss.get('ai.done') === '1' ? 'ready' : 'lang';
    let name = ss.get('ai.name') || '';
    let started = false;
    let lastSug = [];

    const scroll = () => { log.scrollTop = log.scrollHeight; };
    function bubble(who, text, buttons) {
      const m = U.el('div', { class: 'msg ' + who }, [text]);
      if (buttons && buttons.length) m.appendChild(U.el('div', { class: 'btnrow' }, buttons.map((b) => U.el('button', { type: 'button', class: 'chip', text: b.label, onclick: b.fn }))));
      log.appendChild(m); scroll(); return m;
    }
    function botSay(text, buttons, delay) {
      const typing = U.el('div', { class: 'msg bot', 'aria-label': t('ai.typing') }, [U.el('span', { class: 'typing' }, [U.el('i'), U.el('i'), U.el('i')])]);
      log.appendChild(typing); scroll();
      return new Promise((res) => setTimeout(() => { typing.remove(); bubble('bot', text, buttons); res(); }, ctx.reduced() ? 0 : delay || 450));
    }
    function renderChips(box, items) {
      box.textContent = '';
      items.forEach((it) => box.appendChild(U.el('button', { type: 'button', class: 'chip', text: it.label, 'aria-pressed': it.pressed ? 'true' : null, onclick: it.fn })));
    }
    function answerFaq(e) {
      const l = ctx.lang();
      bubble('user', e.q[l]);
      botSay(e.a[l]);
      showSuggest(A.byCategory(e.c).filter((x) => x.id !== e.id).slice(0, 4));
    }
    function showSuggest(list) {
      lastSug = list; const l = ctx.lang();
      renderChips(sug, list.map((e) => ({ label: e.q[l], fn: () => answerFaq(e) })));
    }
    function showCategory(c) {
      bubble('user', t('cat.' + c));
      botSay(t('ai.pickQuestion', { cat: t('cat.' + c) }));
      showSuggest(A.byCategory(c)); renderCats(c);
    }
    function renderCats(active) {
      renderChips(cats, SX.FAQ_CATEGORIES.map((c) => ({ label: t('cat.' + c.id) + ' (' + c.count + ')', pressed: active === c.id, fn: () => showCategory(c.id) })));
    }
    function diagnose(issueId) {
      const d = SX.diagnose(issueId, ctx.result(), ctx.lang());
      if (!d) return;
      bubble('user', d.title);
      botSay(d.observations.join('\n') + '\n\n' + d.steps.map((s, i) => (i + 1) + '. ' + s).join('\n'), null, 500);
    }
    function offerIssues() {
      const r = ctx.result(), l = ctx.lang();
      const ids = A.suggestIssues(r);
      const btns = ids.map((id) => ({ label: SX.content.ISSUES.find((x) => x.id === id).t[l], fn: () => diagnose(id) }));
      const lead = r ? t('ai.helpWith') : t('ai.helpNoData');
      return botSay(lead, btns.concat(SX.FAQ_CATEGORIES.slice(0, 0)));
    }
    function explain() {
      const r = ctx.result();
      if (!r) return botSay(t('ai.noResult'));
      const { interp } = SX.reports.analyse(r, ctx.lang());
      return botSay(interp.join('\n'));
    }
    function fallback() {
      botSay(t('ai.fallback'), SX.FAQ_CATEGORIES.map((c) => ({ label: t('cat.' + c.id), fn: () => showCategory(c.id) })));
    }
    function ready() {
      step = 'ready'; ss.set('ai.done', '1');
      renderCats(null);
      const hello = name ? t('ai.helloName', { name }) : t('ai.hello');
      return botSay(hello + ' ' + t('ai.ready'), SX.FAQ_CATEGORIES.map((c) => ({ label: t('cat.' + c.id), fn: () => showCategory(c.id) }))).then(() => { if (A.pendingHelp) { A.pendingHelp = false; offerIssues(); } });
    }
    function askName() {
      step = 'name';
      botSay(t('ai.askName'), [{ label: t('ai.skip'), fn: () => { bubble('user', t('ai.skip')); ready(); } }]);
    }
    function askLang() {
      step = 'lang';
      bubble('bot', t('ai.askLang') + '\nChoose your language / अपनी भाषा चुनें', [
        { label: 'English', fn: () => pickLang('en') }, { label: 'हिन्दी', fn: () => pickLang('hi') },
      ]);
    }
    function pickLang(l) { bubble('user', l === 'en' ? 'English' : 'हिन्दी'); ctx.setLang(l); askName(); }

    function handle(text) {
      text = text.trim().slice(0, 200);
      if (!text) return;
      if (step === 'lang') { const l = /hindi|हिन्दी|हिंदी/i.test(text) ? 'hi' : /english|अंग्रेज़ी|अंग्रेजी/i.test(text) ? 'en' : null; if (l) { pickLang(l); } else { bubble('user', text); botSay(t('ai.langPrompt')); } return; }
      if (step === 'name') { bubble('user', text); name = text.replace(/[<>]/g, '').slice(0, 30); ss.set('ai.name', name); ready(); return; }
      bubble('user', text);
      const it = A.intent(text);
      if (it === 'explain') { explain(); return; }
      if (it === 'improve') { offerIssues(); return; }
      const hits = A.search(text, 3), l = ctx.lang();
      if (!hits.length) { fallback(); return; }
      botSay(hits[0].a[l]);
      showSuggest(hits.slice(1).concat(A.byCategory(hits[0].c).filter((x) => x.id !== hits[0].id)).slice(0, 4));
    }

    form.addEventListener('submit', (ev) => { ev.preventDefault(); const v = input.value; input.value = ''; handle(v); });

    A.start = function () {
      if (started) return; started = true;
      if (step === 'ready') { renderCats(null); botSay((name ? t('ai.helloName', { name }) : t('ai.hello')) + ' ' + t('ai.ready')); } else askLang();
    };
    A.clear = function () { log.textContent = ''; sug.textContent = ''; started = false; A.start(); };
    A.refresh = function () { if (step === 'ready') { renderCats(null); if (lastSug.length) showSuggest(lastSug); } };
    A.openHelp = function () { A.start(); if (step === 'ready') offerIssues(); else A.pendingHelp = true; };
    $('ai-clear').addEventListener('click', A.clear);
  };

  SX.assistant = A;
  if (typeof module !== 'undefined' && module.exports) module.exports = A;
})(typeof window !== 'undefined' ? window : globalThis);

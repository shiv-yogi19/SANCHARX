/* SANCHARX branded report: built only from actual results. Created By Shiv Yogi. */
(function (root) {
  'use strict';
  const SX = (root.SX = root.SX || {});
  const U = SX.util || require('./utils.js');
  const VERSION = '1.0.0';
  const FILE_NAME = 'Speed-Test-Report_SANCHARX_Shiv-Yogi';
  const pick = (o, l) => o[l] || o.en;
  const f = (n) => U.fmt(n);

  /** Interpretation and recommendations based on values present in the entry. */
  function analyse(r, lang) {
    const interp = [], recs = [];
    const add = (arr, en, hi) => arr.push(pick({ en, hi }, lang));
    if (r.download !== null) {
      if (r.download < 5) { add(interp, 'Download speed is low: ' + f(r.download) + ' Mbps. Basic browsing may work, but video and large downloads will struggle.', 'डाउनलोड स्पीड कम है: ' + f(r.download) + ' Mbps। सामान्य ब्राउज़िंग चल सकती है, पर वीडियो और बड़े डाउनलोड में दिक़्क़त होगी।'); add(recs, 'Test next to the router or on a cable, pause other downloads, then compare with your plan speed.', 'राउटर के पास या तार से टेस्ट करें, बाक़ी डाउनलोड रोकें, फिर अपने प्लान की स्पीड से तुलना करें।'); }
      else if (r.download < 25) add(interp, 'Download speed is moderate: ' + f(r.download) + ' Mbps, suitable for browsing, HD video and calls for a few users.', 'डाउनलोड स्पीड मध्यम है: ' + f(r.download) + ' Mbps, ब्राउज़िंग, HD वीडियो और कुछ यूज़र की कॉल के लिए ठीक।');
      else add(interp, 'Download speed is high: ' + f(r.download) + ' Mbps, enough for 4K streaming and large downloads at the time of the test.', 'डाउनलोड स्पीड ज़्यादा है: ' + f(r.download) + ' Mbps, टेस्ट के समय 4K स्ट्रीमिंग और बड़े डाउनलोड के लिए काफ़ी।');
    }
    if (r.upload !== null) {
      if (r.upload < 2) { add(interp, 'Upload speed is low: ' + f(r.upload) + ' Mbps, which can affect video calls and backups.', 'अपलोड स्पीड कम है: ' + f(r.upload) + ' Mbps, इससे वीडियो कॉल और बैकअप प्रभावित हो सकते हैं।'); add(recs, 'Pause cloud backups during calls and consider a plan with higher upload if this is typical.', 'कॉल के दौरान क्लाउड बैकअप रोकें; यह सामान्य हो तो ज़्यादा अपलोड वाले प्लान पर विचार करें।'); }
      else add(interp, 'Upload speed is ' + f(r.upload) + ' Mbps.', 'अपलोड स्पीड ' + f(r.upload) + ' Mbps है।');
    }
    if (r.latency !== null) {
      if (r.latency > 100) { add(interp, 'HTTP latency is high (' + f(r.latency) + ' ms); interactive use such as gaming may feel delayed.', 'HTTP latency ज़्यादा है (' + f(r.latency) + ' ms); गेमिंग जैसे इंटरैक्टिव उपयोग में देरी लग सकती है।'); add(recs, 'Use a cable, stop heavy transfers while playing or calling, and restart the router.', 'तार इस्तेमाल करें, खेलते या कॉल करते समय भारी ट्रांसफ़र रोकें और राउटर रीस्टार्ट करें।'); }
      else add(interp, 'HTTP latency is ' + f(r.latency) + ' ms.', 'HTTP latency ' + f(r.latency) + ' ms है।');
    }
    if (r.jitter !== null) {
      if (r.jitter > 30) { add(interp, 'Jitter estimate is high (' + f(r.jitter) + ' ms), suggesting an unsteady connection.', 'Jitter अनुमान ज़्यादा है (' + f(r.jitter) + ' ms), जो अस्थिर कनेक्शन का संकेत है।'); add(recs, 'Run the Stability Monitor and compare Wi-Fi with a cable to locate the cause.', 'Stability Monitor चलाएँ और कारण खोजने के लिए Wi-Fi की तुलना तार से करें।'); }
      else add(interp, 'Jitter estimate is ' + f(r.jitter) + ' ms.', 'Jitter अनुमान ' + f(r.jitter) + ' ms है।');
    }
    if (r.status === 'partial') add(interp, 'This was a partial result: some measurements failed and are shown as unavailable.', 'यह आंशिक नतीजा है: कुछ माप फ़ेल हुए और उपलब्ध नहीं दिखाए गए हैं।');
    if (!recs.length) add(recs, 'No problems were indicated by these values. Repeat the test at different times for a fuller picture.', 'इन मानों से कोई समस्या नहीं दिखी। पूरी तस्वीर के लिए अलग-अलग समय पर टेस्ट दोहराएँ।');
    return { interp, recs };
  }

  function rows(r, lang, t) {
    const na = t('rep.unavailable');
    return [
      [t('m.down'), r.download !== null ? f(r.download) + ' Mbps' : na],
      [t('m.up'), r.upload !== null ? f(r.upload) + ' Mbps' : na],
      [t('m.lat'), r.latency !== null ? f(r.latency) + ' ms' : na],
      [t('m.jit'), r.jitter !== null ? f(r.jitter) + ' ms' : na],
      [t('m.loss'), t('m.lossNA')],
      [t('m.duration'), r.durationMs ? (r.durationMs / 1000).toFixed(1) + ' s' : na],
      [t('m.status'), t('status.' + r.status)],
    ];
  }

  function connRows(r, t) {
    const c = r.conn;
    if (!c) return [];
    const out = [];
    if (c.type) out.push([t('conn.type'), c.type]);
    if (c.effectiveType) out.push([t('conn.eff'), c.effectiveType]);
    if (c.downlink !== null) out.push([t('conn.downlink'), c.downlink + ' Mbps (' + t('conn.estimate') + ')']);
    if (c.rtt !== null) out.push([t('conn.rtt'), c.rtt + ' ms (' + t('conn.estimate') + ')']);
    if (c.saveData !== null) out.push([t('conn.save'), c.saveData ? t('yes') : t('no')]);
    return out;
  }

  /** Renders the report into `container` using safe DOM building (no innerHTML). */
  function render(container, r, lang, t) {
    container.textContent = '';
    if (!r) { container.appendChild(U.el('p', { class: 'empty', text: t('rep.empty') })); return; }
    const { interp, recs } = analyse(r, lang);
    const E = U.el;
    const table = (data) => E('table', {}, [E('tbody', {}, data.map(([k, v]) => E('tr', {}, [E('th', { scope: 'row', text: k }), E('td', { text: v })])))]);
    const list = (arr) => E('ul', {}, arr.map((x) => E('li', { text: x })));
    const kids = [
      E('div', { class: 'wm', 'aria-hidden': 'true', text: 'SHIV YOGI' }),
      E('h3', {}, ['SANCHAR', E('span', { class: 'rs-x', text: 'X' })]),
      E('p', { class: 'rs-sub', text: t('rep.sheetTitle') + ' · Created By Shiv Yogi' }),
      E('p', { class: 'rs-sub', text: t('rep.generated') + ': ' + U.fmtDate(Date.now()) + ' · ' + t('rep.tested') + ': ' + U.fmtDate(r.ts) }),
      E('h4', { text: t('rep.results') }), table(rows(r, lang, t)),
    ];
    const cr = connRows(r, t);
    if (cr.length) kids.push(E('h4', { text: t('rep.conn') }), table(cr));
    kids.push(E('h4', { text: t('rep.interp') }), list(interp), E('h4', { text: t('rep.recs') }), list(recs),
      E('h4', { text: t('rep.method') }), E('p', { class: 'rs-sub', text: t('rep.methodText') }),
      E('p', { class: 'rs-foot', text: 'SANCHARX v' + VERSION + ' · ' + t('rep.endpoint') + ': ' + (r.endpoint || 'speed.cloudflare.com') + ' · ID ' + String(r.id).slice(0, 8) }));
    kids.forEach((k) => container.appendChild(k));
  }

  function summaryText(r, lang, t) {
    if (!r) return '';
    const lines = ['SANCHARX — ' + t('rep.sheetTitle') + ' (Created By Shiv Yogi)', t('rep.tested') + ': ' + U.fmtDate(r.ts)];
    rows(r, lang, t).forEach(([k, v]) => lines.push(k + ': ' + v));
    return lines.join('\n');
  }

  SX.reports = { VERSION, FILE_NAME, analyse, render, summaryText, rows };
  if (typeof module !== 'undefined' && module.exports) module.exports = SX.reports;
})(typeof window !== 'undefined' ? window : globalThis);

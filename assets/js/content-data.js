/* SANCHARX rule-based content: troubleshooting playbooks, safety guide, diagnosis rules. Created By Shiv Yogi. */
(function (root) {
  'use strict';
  const SX = (root.SX = root.SX || {});
  const I = (id, te, th, se, sh) => ({ id, t: { en: te, hi: th }, s: { en: se, hi: sh } });

  const ISSUES = [
    I('slowDown', 'Slow downloads', 'डाउनलोड धीमा है',
      ['Test close to the router, or on a cable, to separate Wi-Fi problems from plan problems.', 'Pause other downloads, streams and cloud backups on all devices.', 'Restart the router and modem, wait a few minutes, then test again.', 'Test at a different time of day. If speed is always far below your plan, contact your provider with your test results.'],
      ['Wi-Fi की दिक़्क़त और प्लान की दिक़्क़त अलग करने के लिए राउटर के पास या तार से टेस्ट करें।', 'सभी डिवाइस पर बाक़ी डाउनलोड, स्ट्रीम और क्लाउड बैकअप रोकें।', 'राउटर और मॉडेम रीस्टार्ट करें, कुछ मिनट रुककर दोबारा टेस्ट करें।', 'दिन के अलग समय पर टेस्ट करें। स्पीड हमेशा प्लान से बहुत कम हो तो अपने टेस्ट नतीजों के साथ प्रदाता से संपर्क करें।']),
    I('slowUp', 'Slow uploads', 'अपलोड धीमा है',
      ['Many plans have much lower upload than download. Compare with your plan\'s stated upload speed.', 'Pause cloud backups, photo sync and video uploads that may be using upload bandwidth.', 'Use a cable or sit closer to the router for large uploads.', 'If upload is far below the plan on several tests, contact your provider.'],
      ['कई प्लान में अपलोड डाउनलोड से बहुत कम होता है। अपने प्लान की बताई अपलोड स्पीड से तुलना करें।', 'क्लाउड बैकअप, फ़ोटो सिंक और वीडियो अपलोड रोकें जो अपलोड बैंडविड्थ ले रहे हों।', 'बड़े अपलोड के लिए तार इस्तेमाल करें या राउटर के पास बैठें।', 'कई टेस्ट में अपलोड प्लान से बहुत कम रहे तो प्रदाता से संपर्क करें।']),
    I('latency', 'High latency', 'latency ज़्यादा है',
      ['Use a cable if possible; Wi-Fi adds delay and variation.', 'Stop heavy uploads or downloads: a saturated line makes latency rise.', 'Disconnect VPNs or proxies and test again.', 'Restart the router. If latency stays high on a cable, the cause is likely the provider route or server distance.'],
      ['हो सके तो तार इस्तेमाल करें; Wi-Fi देरी और उतार-चढ़ाव जोड़ता है।', 'भारी अपलोड या डाउनलोड रोकें: भरी हुई लाइन latency बढ़ा देती है।', 'VPN या प्रॉक्सी बंद करके दोबारा टेस्ट करें।', 'राउटर रीस्टार्ट करें। तार पर भी latency ज़्यादा रहे तो कारण प्रदाता का रूट या सर्वर की दूरी हो सकती है।']),
    I('unstable', 'Unstable connection', 'कनेक्शन अस्थिर है',
      ['Run the Stability Monitor for a minute and note whether spikes or failures appear.', 'Compare Wi-Fi with a cable to see whether the Wi-Fi link is the cause.', 'Move away from microwaves, cordless phones and thick walls; try another Wi-Fi channel or the 5 GHz band.', 'Update router firmware and restart it. Persistent drops on a cable should be reported to your provider.'],
      ['एक मिनट Stability Monitor चलाएँ और देखें कि उछाल या फ़ेल रिक्वेस्ट दिखते हैं या नहीं।', 'Wi-Fi की तुलना तार से करें ताकि पता चले कि दिक़्क़त Wi-Fi की है या नहीं।', 'माइक्रोवेव, कॉर्डलेस फ़ोन और मोटी दीवारों से दूर रहें; दूसरा Wi-Fi चैनल या 5 GHz बैंड आज़माएँ।', 'राउटर का फ़र्मवेयर अपडेट करके रीस्टार्ट करें। तार पर भी लगातार ड्रॉप हों तो प्रदाता को बताएँ।']),
    I('buffering', 'Video buffering', 'वीडियो बफ़र हो रहा है',
      ['Lower the video quality to match your measured download speed.', 'Pause other streams and downloads in the house.', 'Move closer to the router or use a cable for the TV or computer.', 'If speed is fine but buffering continues, test latency and stability, and try another app or time.'],
      ['अपनी मापी गई डाउनलोड स्पीड के हिसाब से वीडियो क्वालिटी घटाएँ।', 'घर में बाक़ी स्ट्रीम और डाउनलोड रोकें।', 'राउटर के पास जाएँ या TV/कंप्यूटर के लिए तार इस्तेमाल करें।', 'स्पीड ठीक हो फिर भी बफ़रिंग हो तो latency और स्थिरता जाँचें, और दूसरा ऐप या समय आज़माएँ।']),
    I('gaming', 'Gaming lag', 'गेमिंग में लैग',
      ['Use a wired connection and close background downloads.', 'Pick the nearest game server and avoid peak hours.', 'Run the Stability Monitor during play and watch for latency spikes.', 'Restart the router; disable VPN unless the game needs it.'],
      ['तार वाला कनेक्शन इस्तेमाल करें और बैकग्राउंड डाउनलोड बंद करें।', 'सबसे नज़दीकी गेम सर्वर चुनें और व्यस्त समय से बचें।', 'खेलते समय Stability Monitor चलाकर latency के उछाल देखें।', 'राउटर रीस्टार्ट करें; ज़रूरत न हो तो VPN बंद रखें।']),
    I('dns', 'DNS resolution problems', 'DNS resolve की समस्या',
      ['Use the DNS Lookup tool to check whether the domain resolves via Cloudflare and Google.', 'If the public resolvers work but your browser does not, restart the router and device and clear the browser DNS cache.', 'Try setting a public DNS resolver in your device or router settings.', 'Note: SANCHARX cannot see your router\'s own DNS settings or cache.'],
      ['DNS Lookup टूल से देखें कि डोमेन Cloudflare और Google से resolve होता है या नहीं।', 'पब्लिक resolver काम करें पर ब्राउज़र न करे तो राउटर व डिवाइस रीस्टार्ट करें और ब्राउज़र का DNS कैश साफ़ करें।', 'अपने डिवाइस या राउटर सेटिंग्स में कोई पब्लिक DNS resolver सेट करके देखें।', 'ध्यान दें: SANCHARX आपके राउटर की अपनी DNS सेटिंग्स या कैश नहीं देख सकता।']),
    I('website', 'A website will not connect', 'कोई वेबसाइट कनेक्ट नहीं हो रही',
      ['Try the site on another network (for example mobile data) to see whether the problem is only on this network.', 'Use the Endpoint Latency Checker; remember that a failed check can come from browser security limits and is not proof of an outage.', 'Check the DNS Lookup result for the domain.', 'Clear the site\'s cookies and cache, or try another browser.'],
      ['साइट को दूसरे नेटवर्क (जैसे मोबाइल डेटा) पर आज़माएँ ताकि पता चले कि दिक़्क़त सिर्फ़ इसी नेटवर्क पर है या नहीं।', 'Endpoint Latency Checker इस्तेमाल करें; याद रखें कि फ़ेल चेक ब्राउज़र सुरक्षा सीमाओं से भी आ सकता है और आउटेज का सबूत नहीं है।', 'डोमेन के लिए DNS Lookup का नतीजा देखें।', 'साइट की कुकी और कैश साफ़ करें या दूसरा ब्राउज़र आज़माएँ।']),
    I('captive', 'Captive portal issues', 'Captive portal की समस्या',
      ['Forget and rejoin the Wi-Fi network.', 'Turn off VPN and private DNS temporarily.', 'Open a plain http:// page such as http://neverssl.com to trigger the login page.', 'If it still does not appear, ask the venue staff; the portal may be down.'],
      ['Wi-Fi नेटवर्क को भूलकर दोबारा जुड़ें।', 'VPN और private DNS कुछ देर के लिए बंद करें।', 'लॉगिन पेज लाने के लिए http://neverssl.com जैसा साधारण http:// पेज खोलें।', 'फिर भी न दिखे तो जगह के स्टाफ़ से पूछें; पोर्टल बंद हो सकता है।']),
    I('router', 'Possible router or local Wi-Fi issue', 'राउटर या लोकल Wi-Fi की संभावित समस्या',
      ['Compare a test next to the router with a test in the problem room; a big gap points to Wi-Fi coverage.', 'Reposition the router to a central, open, elevated place.', 'Try 5 GHz near the router and 2.4 GHz for far rooms; consider a less crowded channel.', 'Update firmware, restart, and consider a mesh system or wired access point for large homes. SANCHARX cannot inspect your router remotely.'],
      ['राउटर के पास और समस्या वाले कमरे में टेस्ट की तुलना करें; बड़ा अंतर Wi-Fi कवरेज की ओर इशारा करता है।', 'राउटर को बीच की, खुली और ऊँची जगह पर रखें।', 'राउटर के पास 5 GHz और दूर के कमरों में 2.4 GHz आज़माएँ; कम भीड़ वाला चैनल चुनें।', 'फ़र्मवेयर अपडेट व रीस्टार्ट करें; बड़े घर में mesh सिस्टम या वायर्ड एक्सेस पॉइंट पर विचार करें। SANCHARX आपका राउटर दूर से जाँच नहीं सकता।']),
  ];

  const SAFETY = [
    { id: 'https', t: { en: 'HTTPS', hi: 'HTTPS' }, b: { en: 'Prefer sites that start with https://. The lock icon means the connection is encrypted, not that the site is honest. Never enter passwords on pages that warn about an invalid certificate.', hi: 'https:// से शुरू होने वाली साइटें चुनें। लॉक आइकन का मतलब कनेक्शन एन्क्रिप्टेड है, साइट ईमानदार है ऐसा नहीं। सर्टिफ़िकेट की चेतावनी वाले पेज पर कभी पासवर्ड न डालें।' } },
    { id: 'public', t: { en: 'Public Wi-Fi', hi: 'पब्लिक Wi-Fi' }, b: { en: 'Avoid banking and sensitive logins on open Wi-Fi, keep your device updated, turn off automatic file sharing and forget the network when you leave.', hi: 'खुले Wi-Fi पर बैंकिंग और संवेदनशील लॉगिन से बचें, डिवाइस अपडेट रखें, ऑटोमैटिक फ़ाइल शेयरिंग बंद करें और वहाँ से जाने पर नेटवर्क को भूल जाएँ।' } },
    { id: 'captive', t: { en: 'Captive portals', hi: 'Captive portals' }, b: { en: 'Only sign in on the portal page that appears for the venue\'s own network. Do not install apps or certificates the portal asks for, and avoid reusing important passwords.', hi: 'सिर्फ़ उसी जगह के अपने नेटवर्क के पोर्टल पेज पर साइन इन करें। पोर्टल जो ऐप या सर्टिफ़िकेट माँगे उन्हें इंस्टॉल न करें और अहम पासवर्ड दोबारा इस्तेमाल न करें।' } },
    { id: 'downloads', t: { en: 'Suspicious downloads', hi: 'संदिग्ध डाउनलोड' }, b: { en: 'Download software from official stores or the maker\'s site. Be wary of cracked apps, unexpected attachments and links that create urgency. Keep security software updated.', hi: 'सॉफ़्टवेयर आधिकारिक स्टोर या निर्माता की साइट से डाउनलोड करें। क्रैक्ड ऐप, अनपेक्षित अटैचमेंट और जल्दबाज़ी कराने वाले लिंक से सावधान रहें। सिक्योरिटी सॉफ़्टवेयर अपडेट रखें।' } },
    { id: 'dns', t: { en: 'DNS privacy', hi: 'DNS privacy' }, b: { en: 'DNS over HTTPS hides name lookups from people on your local network, but the resolver still sees them. Choose a resolver you trust and read its privacy policy.', hi: 'DNS over HTTPS आपके लोकल नेटवर्क के लोगों से नाम-लुकअप छिपाता है, पर resolver उन्हें देखता है। भरोसेमंद resolver चुनें और उसकी प्राइवेसी नीति पढ़ें।' } },
    { id: 'router', t: { en: 'Router security', hi: 'राउटर सुरक्षा' }, b: { en: 'Change default admin credentials, use WPA2/WPA3, update firmware, disable remote administration and WPS when unused, and create a guest network for visitors.', hi: 'डिफ़ॉल्ट एडमिन क्रेडेंशियल बदलें, WPA2/WPA3 इस्तेमाल करें, फ़र्मवेयर अपडेट करें, ज़रूरत न हो तो रिमोट एडमिन व WPS बंद करें और मेहमानों के लिए गेस्ट नेटवर्क बनाएँ।' } },
    { id: 'safe', t: { en: 'Safe troubleshooting', hi: 'सुरक्षित ट्रबलशूटिंग' }, b: { en: 'Change one thing at a time and note the result. Do not factory-reset a router without saving its settings. Only follow support instructions from your real provider, never from unsolicited calls or pop-ups. This guide is educational; SANCHARX is not a vulnerability scanner.', hi: 'एक बार में एक ही चीज़ बदलें और नतीजा नोट करें। सेटिंग्स सहेजे बिना राउटर फ़ैक्टरी रीसेट न करें। सपोर्ट के निर्देश सिर्फ़ अपने असली प्रदाता से मानें, अनचाहे कॉल या पॉप-अप से नहीं। यह गाइड शैक्षिक है; SANCHARX कोई vulnerability स्कैनर नहीं है।' } },
  ];

  /** Observations from real measurements, bilingual. Returns [{en,hi}]. */
  function observations(issueId, r) {
    const f = (n) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));
    if (!r) return [{ en: 'No completed measurement is available yet. Run a speed test for advice that uses your own numbers.', hi: 'अभी कोई पूरा माप उपलब्ध नहीं है। अपने नंबरों पर आधारित सलाह के लिए स्पीड टेस्ट चलाएँ।' }];
    const out = [];
    const want = {
      slowDown: ['download'], slowUp: ['upload'], latency: ['latency', 'jitter'], unstable: ['jitter', 'latency'],
      buffering: ['download', 'jitter'], gaming: ['latency', 'jitter', 'download'], router: ['download', 'latency'],
    }[issueId] || ['download', 'latency'];
    const add = (en, hi) => out.push({ en, hi });
    if (want.includes('download') && r.download !== null) {
      if (r.download < 5) add('Measured download is low (' + f(r.download) + ' Mbps).', 'मापी गई डाउनलोड स्पीड कम है (' + f(r.download) + ' Mbps)।');
      else if (r.download < 25) add('Measured download is moderate (' + f(r.download) + ' Mbps).', 'मापी गई डाउनलोड स्पीड मध्यम है (' + f(r.download) + ' Mbps)।');
      else add('Measured download is healthy (' + f(r.download) + ' Mbps), so the cause may lie elsewhere.', 'मापी गई डाउनलोड स्पीड अच्छी है (' + f(r.download) + ' Mbps), इसलिए कारण कहीं और हो सकता है।');
    }
    if (want.includes('upload') && r.upload !== null) {
      if (r.upload < 2) add('Measured upload is low (' + f(r.upload) + ' Mbps).', 'मापी गई अपलोड स्पीड कम है (' + f(r.upload) + ' Mbps)।');
      else add('Measured upload is ' + f(r.upload) + ' Mbps.', 'मापी गई अपलोड स्पीड ' + f(r.upload) + ' Mbps है।');
    }
    if (want.includes('latency') && r.latency !== null) {
      if (r.latency > 100) add('HTTP latency is high (' + f(r.latency) + ' ms).', 'HTTP latency ज़्यादा है (' + f(r.latency) + ' ms)।');
      else add('HTTP latency is ' + f(r.latency) + ' ms.', 'HTTP latency ' + f(r.latency) + ' ms है।');
    }
    if (want.includes('jitter') && r.jitter !== null) {
      if (r.jitter > 30) add('Jitter estimate is high (' + f(r.jitter) + ' ms), which suggests an unsteady connection.', 'Jitter अनुमान ज़्यादा है (' + f(r.jitter) + ' ms), जो अस्थिर कनेक्शन का संकेत है।');
      else add('Jitter estimate is ' + f(r.jitter) + ' ms.', 'Jitter अनुमान ' + f(r.jitter) + ' ms है।');
    }
    const errs = Object.keys(r.errors || {});
    if (errs.length) add('Some parts of the last test failed (' + errs.join(', ') + '); results may be incomplete.', 'पिछले टेस्ट के कुछ हिस्से फ़ेल हुए (' + errs.join(', ') + '); नतीजे अधूरे हो सकते हैं।');
    if (!out.length) add('The last test has no values relevant to this issue.', 'पिछले टेस्ट में इस समस्या से जुड़े मान नहीं हैं।');
    return out;
  }

  SX.content = { ISSUES, SAFETY, observations };
  SX.diagnose = (issueId, r, lang) => {
    const it = ISSUES.find((x) => x.id === issueId);
    if (!it) return null;
    return { title: it.t[lang] || it.t.en, observations: observations(issueId, r).map((o) => o[lang] || o.en), steps: it.s[lang] || it.s.en };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SX.content;
})(typeof window !== 'undefined' ? window : globalThis);

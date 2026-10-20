# SANCHARX — Network Intelligence & Internet Speed Test
**CONNECT. MEASURE. CREATE.** · YOUR DIGITAL WORLD, REDEFINED. · **Created By Shiv Yogi**

A static, mobile-first website (HTML, CSS, vanilla JavaScript, no build step, no dependencies) that measures your real internet connection from the browser and offers network tools, history, branded reports and a rule-based bilingual (English/Hindi) assistant.

## What it does
- **Speed test**: real download, upload, HTTP latency (median of 10 samples) and jitter estimate against `speed.cloudflare.com`; live gauge + graph; start / cancel / retry / test again / clear.
- **Network tools**: Stability Monitor, Troubleshooter, Data Calculator, IPv4 & Subnet calculator, DNS lookup (DNS-over-HTTPS), Public IP lookup, HTTP endpoint latency checker, Gaming & Streaming advisor, Safety guide.
- **History & reports**: browser-local history, comparison, trends, branded report with print / "Save as PDF" layout.
- **Assistant**: deterministic, rule-based, exactly 50 bilingual FAQs. It is **not** generative AI and calls no AI service.
- Packet loss is **not measured** (a browser cannot do it reliably) and is shown as such.

## Run locally
Any static server works, e.g. `python3 -m http.server 8080` in this folder, then open http://localhost:8080/. (Opening `index.html` directly also works, but browsers may restrict some network features on `file://`.)

## Deploy (GitHub Pages)
1. Create a repository and upload the contents of this folder (so `index.html` is at the repository root).
2. Settings → Pages → Deploy from branch → `main` / root.
3. Open `https://<user>.github.io/<repo>/`. All paths are relative, so sub-path hosting works. HTTPS is required for clipboard and the secure external requests.
Any other static HTTPS host works the same way. No backend, database, API key or Node runtime is needed.

## Supported browsers
Current Chrome/Edge/Firefox/Safari (needs `fetch`, `AbortController`, `XMLHttpRequest`, `<dialog>`). The Network Information API (connection card) exists mainly in Chromium browsers; elsewhere it shows "not available".

## External dependencies (contacted only when used)
| Service | Used for | When |
|---|---|---|
| speed.cloudflare.com (`/__down`, `/__up`) | download, upload, latency, stability | speed test, Stability Monitor |
| cloudflare-dns.com / dns.google | DNS-over-HTTPS | DNS Lookup, resolver you pick |
| api.ipify.org / api64.ipify.org | public IP | only when you press the button |
| URL you type | timing | Endpoint Latency Checker |
No fonts, scripts, analytics or CDNs are loaded. If an endpoint is blocked (firewall, VPN, ad blocker) the app reports an honest failure instead of a number. The speed endpoints' public availability, CORS policy and usage terms are controlled by Cloudflare and were **not verifiable from the development sandbox**; see TEST_REPORT.md.

## Measurement formulas (also documented in `assets/js/speed-test.js`)
- Throughput (Mbps) = bytes × 8 / seconds / 1,000,000.
- HTTP latency = median of 10 request times (after 1 warm-up). Not ICMP ping.
- Jitter estimate = mean absolute difference of consecutive latency samples.
- Download: progressive parallel streams; Upload: generated random payloads via XHR; the final figure is the mean of the two largest steps that lasted ≥ 300 ms. Save-Data mode caps download steps at 5 MB.

## Report → PDF
Reports → pick a result → "Print / Save as PDF" → choose "Save as PDF". The page title is set to `Speed-Test-Report_SANCHARX_Shiv-Yogi` so browsers suggest that file name. This is browser print-to-PDF, not an in-app PDF generator.

## Structure
`index.html`, `assets/css/{styles,animations}.css`, `assets/js/{utils,translations,speed-test,network-tools,history,faq-data,content-data,reports,assistant,app}.js`, `assets/icons/icon.svg`, `tests/`, and the documents listed in this folder.

## Tests
`node tests/static-check.js`, `node tests/unit.test.js`, `python3 tests/browser-test.py` (needs Playwright + Chromium; it mocks the external hosts inside the script only).

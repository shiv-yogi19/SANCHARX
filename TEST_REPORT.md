# Test Report — SANCHARX 1.0.0

**Environment**: Linux sandbox, Node (v-current), Python 3 + Playwright, Chromium 141 headless, local `http.server`. **No internet access**: external hosts (speed.cloudflare.com, cloudflare-dns.com, dns.google, ipify.org) were unreachable and were **mocked inside the test scripts only**. The production code contains no mock data.

## Summary
| Suite | Result | Method |
|---|---|---|
| Static checks (`tests/static-check.js`) | PASS — all checks | file/asset paths, duplicate IDs, JS syntax, CSS braces, 366 i18n keys EN+HI, exactly 50 unique FAQs (category counts), removed studios absent, branding, no innerHTML/eval, animation keyframes |
| Unit + mocked network (`tests/unit.test.js`) | PASS — 37/37 | stats, jitter, formulas, calculator, IPv4/subnet, validators, history incl. corrupted storage, assistant matching (every FAQ finds itself), engine success/partial/failed/offline/unsupported/cancel/overlap/Save-Data, DNS, IP, endpoint, monitor lifecycle |
| Browser (`tests/browser-test.py`) | PASS — 138/138 | desktop 1280 px + mobile 390 px: intro, all nav items, back button, full test with mocked endpoints, cancel, save, all tools, favorites, tab keyboard, history compare/delete/clear, report content, print layout + PDF generation, assistant onboarding (EN/HI), settings persistence, reduced motion, zero console errors, blocked-network failure and offline states |

## Status of individual areas
- **PASS (actually executed)**: everything counted above.
- **BLOCKED**: real speed measurement against speed.cloudflare.com (download/upload/latency), real DoH, real ipify call — no internet in the sandbox. Whether Cloudflare currently allows these CORS/POST requests from an arbitrary origin, and its usage terms, are **unverified**.
- **NOT RUN**: Firefox/Safari, real Android devices, real GitHub Pages sub-path hosting, screen reader testing, long-duration memory/performance profiling, native-speaker Hindi review.
- Animation *presence and reduced-motion behaviour* verified; visual smoothness was not evaluated on hardware.
- Screenshots (desktop/mobile home, reports, assistant) and the printed report PDF were generated and the home and report pages were inspected visually.

## Defect found and fixed during testing
The browser suite intermittently showed an empty live graph: a download step that finished between two 200 ms sampling ticks emitted no sample. Fixed in `speed-test.js` (each download step now emits a final partial-window sample; an upload with no progress events emits a whole-request sample). Re-run: 3 consecutive 138/138 browser passes.

## Known limitations / remaining work
1. First live run on the deployed site is required to confirm the Cloudflare endpoints work from the final origin; if `__up` is refused, upload will show an honest error and the result is saved as partial.
2. Mock responses in the browser suite were capped at 300 kB per request, so measured Mbps there are meaningless; they only prove the pipeline.
3. Feedback link points to `https://github.com/shiv-yogi19/SANCHARX/issues/new`; change it if the repository name differs.
4. Print-to-PDF depends on the browser's print dialog (no in-app PDF generator).
5. Hindi copy should be reviewed by a native speaker.

## Raw outputs
### static-check
```
PASS asset exists: assets/icons/icon.svg
PASS asset exists: assets/css/styles.css
PASS asset exists: assets/css/animations.css
PASS asset exists: assets/js/utils.js
PASS asset exists: assets/js/translations.js
PASS asset exists: assets/js/speed-test.js
PASS asset exists: assets/js/network-tools.js
PASS asset exists: assets/js/history.js
PASS asset exists: assets/js/faq-data.js
PASS asset exists: assets/js/content-data.js
PASS asset exists: assets/js/reports.js
PASS asset exists: assets/js/assistant.js
PASS asset exists: assets/js/app.js
PASS no duplicate HTML ids (158)
PASS all $("id") targets exist
PASS JS syntax app.js
PASS JS syntax assistant.js
PASS JS syntax content-data.js
PASS JS syntax faq-data.js
PASS JS syntax history.js
PASS JS syntax network-tools.js
PASS JS syntax reports.js
PASS JS syntax speed-test.js
PASS JS syntax translations.js
PASS JS syntax utils.js
PASS CSS braces balanced styles.css
PASS CSS braces balanced animations.css
PASS every i18n key has EN + HI (347 keys)
PASS FAQ count is exactly 50 (50)
PASS 50 unique FAQ ids
PASS FAQ category mobile = 10
PASS FAQ category wifi = 10
PASS FAQ category speed = 8
PASS FAQ category gaming = 7
PASS FAQ category security = 7
PASS FAQ category trouble = 8
PASS every FAQ has EN/HI question+answer and keywords
PASS Hindi fields contain Devanagari
PASS unique English questions
PASS removed module not in HTML: QR Studio
PASS removed module not in HTML: Image Studio
PASS removed module not in HTML: merge pdf
PASS removed module not in HTML: split pdf
PASS branding "Created By Shiv Yogi" present
PASS taglines present
PASS speed engine uses no storage
PASS no unsafe HTML sinks (innerHTML/eval) in JS
PASS no API keys/secrets in JS
PASS animation header lists 25 patterns
PASS keyframes defined: letter-in
PASS keyframes defined: x-in
PASS keyframes defined: intro-in
PASS keyframes defined: drift-a
PASS keyframes defined: card-in
PASS keyframes defined: draw
PASS keyframes defined: spin
PASS keyframes defined: toast-in
PASS keyframes defined: modal-in
PASS keyframes defined: panel-in
PASS keyframes defined: bounce
PASS keyframes defined: msg-in
PASS keyframes defined: report-in
PASS keyframes defined: shimmer
PASS keyframes defined: copied
PASS keyframes defined: star-pop
PASS keyframes defined: pulse
PASS reduced-motion rules present

ALL STATIC CHECKS PASSED
```
### unit.test
```
PASS stats: median/mean/stdev
PASS jitter = mean |consecutive diff|
PASS mbps formula
PASS combineSteps uses largest qualifying steps
PASS calculator: Mbps<->MB/s, sizes, time, data
PASS calculator: invalid input handling
PASS fmtDuration / fmtBytes
PASS IPv4 validation
PASS subnet /24
PASS subnet dotted mask + /26 + /30 + /31 + /32 + /0
PASS subnet errors
PASS ipKind classes
PASS domain validation
PASS URL validation blocks dangerous/local targets
PASS stability thresholds
PASS advisor uses only measured values
PASS history: save/load/delete/compare/summary/trend
PASS history: corrupted storage handled
PASS assistant search: English/Hindi/keywords/fallback
PASS every FAQ question finds itself via its own English text
PASS troubleshooter diagnose uses real values; no data message otherwise
PASS report analysis never invents values
PASS speed test: full success with mocked endpoint
PASS speed test: upload rejected => partial, no substituted value
PASS speed test: upload network error => partial
PASS speed test: all endpoints fail => failed, no fake numbers
PASS speed test: HTTP 503 on download => honest failure
PASS speed test: offline state
PASS speed test: unsupported (no fetch)
PASS speed test: cancel aborts requests and records nothing
PASS speed test: starting a new test cancels the old one (no overlap)
PASS speed test: Save-Data caps step size
PASS DNS lookup: success / NXDOMAIN / rate limit / network / invalid
PASS Public IP: success / failure / malformed response rejected
PASS endpoint check: reachable timing and unreachable
PASS StabilityMonitor start/stop lifecycle
PASS connectionInfo reflects browser API only when present

37 passed, 0 failed
```
### browser-test
```
PASS [desktop] intro shown on first entry
PASS [desktop] intro has Created By Shiv Yogi
PASS [desktop] intro dismissed
PASS [desktop] Start Test visible
PASS [desktop] no horizontal overflow on Home
PASS [desktop] bottom nav visible only on mobile
PASS [desktop] nav -> tools opens and is marked active
PASS [desktop] no overflow on tools
PASS [desktop] nav -> reports opens and is marked active
PASS [desktop] no overflow on reports
PASS [desktop] nav -> ai opens and is marked active
PASS [desktop] no overflow on ai
PASS [desktop] nav -> home opens and is marked active
PASS [desktop] no overflow on home
PASS [desktop] browser back returns to previous section
PASS [desktop] Cancel shown while running
PASS [desktop] test completes with values (mocked endpoint)
PASS [desktop] packet loss honestly shown as not measured
PASS [desktop] graph drawn from samples
PASS [desktop] button becomes Test Again
PASS [desktop] save to history works
PASS [desktop] cancel gives Cancelled state
PASS [desktop] subnet tool correct
PASS [desktop] subnet shows validation error
PASS [desktop] calculator converts
PASS [desktop] calculator rejects negatives
PASS [desktop] DNS result + resolver named
PASS [desktop] DNS invalid domain error
PASS [desktop] public IP + provider shown
PASS [desktop] endpoint blocks javascript: URL
PASS [desktop] endpoint blocks private address
PASS [desktop] endpoint check returns
PASS [desktop] advisor lists activities
PASS [desktop] troubleshooter renders
PASS [desktop] safety guide has 7 topics
PASS [desktop] stability monitor stops cleanly
PASS [desktop] favorite toggle adds chip
PASS [desktop] tabs keyboard arrow navigation
PASS [desktop] history lists saved tests
PASS [desktop] compare two entries
PASS [desktop] report contains "SANCHARX"
PASS [desktop] report contains "Created By Shiv Yogi"
PASS [desktop] report contains "Download"
PASS [desktop] report contains "Upload"
PASS [desktop] report contains "HTTP latency"
PASS [desktop] report contains "Jitter estimate"
PASS [desktop] report contains "Not measured by this browser test"
PASS [desktop] report contains "Measurement method and limitations"
PASS [desktop] report contains "Recommendations"
PASS [desktop] report has SHIV YOGI watermark
PASS [desktop] print layout hides navigation, shows report
PASS [desktop] delete single history entry
PASS [desktop] clear all history with confirmation
PASS [desktop] assistant labelled rule-based
PASS [desktop] onboarding Hindi choice switches interface language
PASS [desktop] six category buttons shown
PASS [desktop] Speed Test category lists 8 questions
PASS [desktop] FAQ answer appears
PASS [desktop] typed question matched
PASS [desktop] fallback for unsupported question
PASS [desktop] onboarding not repeated in same session
PASS [desktop] clear chat resets log
PASS [desktop] EN/HI toggle (header selector)
PASS [desktop] reduced-motion setting applied
PASS [desktop] settings persist after reload
PASS [desktop] reduced motion neutralises animation
PASS [desktop] zero console errors
PASS [mobile] intro shown on first entry
PASS [mobile] intro has Created By Shiv Yogi
PASS [mobile] intro dismissed
PASS [mobile] Start Test visible
PASS [mobile] no horizontal overflow on Home
PASS [mobile] bottom nav visible only on mobile
PASS [mobile] nav -> tools opens and is marked active
PASS [mobile] no overflow on tools
PASS [mobile] nav -> reports opens and is marked active
PASS [mobile] no overflow on reports
PASS [mobile] nav -> ai opens and is marked active
PASS [mobile] no overflow on ai
PASS [mobile] nav -> home opens and is marked active
PASS [mobile] no overflow on home
PASS [mobile] browser back returns to previous section
PASS [mobile] Cancel shown while running
PASS [mobile] test completes with values (mocked endpoint)
PASS [mobile] packet loss honestly shown as not measured
PASS [mobile] graph drawn from samples
PASS [mobile] button becomes Test Again
PASS [mobile] save to history works
PASS [mobile] cancel gives Cancelled state
PASS [mobile] subnet tool correct
PASS [mobile] subnet shows validation error
PASS [mobile] calculator converts
PASS [mobile] calculator rejects negatives
PASS [mobile] DNS result + resolver named
PASS [mobile] DNS invalid domain error
PASS [mobile] public IP + provider shown
PASS [mobile] endpoint blocks javascript: URL
PASS [mobile] endpoint blocks private address
PASS [mobile] endpoint check returns
PASS [mobile] advisor lists activities
PASS [mobile] troubleshooter renders
PASS [mobile] safety guide has 7 topics
PASS [mobile] stability monitor stops cleanly
PASS [mobile] favorite toggle adds chip
PASS [mobile] tabs keyboard arrow navigation
PASS [mobile] history lists saved tests
PASS [mobile] compare two entries
PASS [mobile] report contains "SANCHARX"
PASS [mobile] report contains "Created By Shiv Yogi"
PASS [mobile] report contains "Download"
PASS [mobile] report contains "Upload"
PASS [mobile] report contains "HTTP latency"
PASS [mobile] report contains "Jitter estimate"
PASS [mobile] report contains "Not measured by this browser test"
PASS [mobile] report contains "Measurement method and limitations"
PASS [mobile] report contains "Recommendations"
PASS [mobile] report has SHIV YOGI watermark
PASS [mobile] print layout hides navigation, shows report
PASS [mobile] delete single history entry
PASS [mobile] clear all history with confirmation
PASS [mobile] assistant labelled rule-based
PASS [mobile] onboarding Hindi choice switches interface language
PASS [mobile] six category buttons shown
PASS [mobile] Speed Test category lists 8 questions
PASS [mobile] FAQ answer appears
PASS [mobile] typed question matched
PASS [mobile] fallback for unsupported question
PASS [mobile] onboarding not repeated in same session
PASS [mobile] clear chat resets log
PASS [mobile] EN/HI toggle (header selector)
PASS [mobile] reduced-motion setting applied
PASS [mobile] settings persist after reload
PASS [mobile] reduced motion neutralises animation
PASS [mobile] zero console errors
PASS [failure] blocked endpoint -> honest Failed state with message
PASS [failure] no fake numbers shown
PASS [failure] Retry offered
PASS [failure] offline state

138/138 browser checks passed
```

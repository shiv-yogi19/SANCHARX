# Feature Matrix (status as of v1.0.0)
Legend — **Verified (mock)**: implemented and exercised in Node/Chromium tests where external hosts were replaced by test mocks. **Not run live**: never executed against the real external endpoint because the build sandbox has no internet. See TEST_REPORT.md.

| Requirement | Status | Notes |
|---|---|---|
| Real download test | Implemented · Verified (mock) · **Not run live** | speed.cloudflare.com `__down`, streamed byte counting, no-store, abort on cancel |
| Real upload test | Implemented · Verified (mock) · **Not run live** | generated random payload via XHR POST to `__up`; failure never substituted by a guess |
| HTTP latency (median) / sample count | Implemented · Verified (mock) | labelled HTTP latency, not ICMP |
| Jitter estimate | Implemented · Verified (unit) | formula documented; labelled an estimate |
| Packet loss | Intentionally not measured | shown as "Not measured by this browser test" |
| Live graph + gauge | Implemented · Verified (mock) | graph points come from measured samples; ring = progress, arc = speed |
| Start / Cancel / Retry / Test Again / Clear | Implemented · Verified | cancel and overlapping-run protection tested |
| Test states (idle … timed out) | Implemented · Verified (mock + blocked network) | offline, failed, unsupported, timeout, cancelled, partial |
| Connection Intelligence | Implemented | uses Network Information API only when present; labelled estimates |
| Stability Monitor | Implemented · Verified (mock) | stops on Stop, tool/tab change, page hidden, 60 samples |
| Troubleshooter | Implemented · Verified | 10 rule-based playbooks, EN/HI, uses last measurement |
| Data/Download calculator | Implemented · Verified (unit + browser) | decimal vs binary units; invalid/zero/negative/huge handled |
| IPv4 validator + subnet calculator | Implemented · Verified (unit + browser) | /0–/32, dotted masks, /31, /32 |
| DNS lookup (DoH) | Implemented · Verified (mock) · **Not run live** | Cloudflare or Google; resolver named; errors handled |
| Public IP lookup | Implemented · Verified (mock) · **Not run live** | ipify.org; provider shown; no geolocation |
| HTTP endpoint checker | Implemented · Verified (mock) | https by default; blocks javascript:/file:/data:/localhost/private IPs/credentials; opaque-response limits explained |
| Gaming & Streaming advisor | Implemented · Verified (unit) | clearly labelled estimates from measured values only |
| Network Safety Guide | Implemented | 7 educational topics, EN/HI |
| History + compare + trends + delete | Implemented · Verified | corrupt/unavailable storage handled |
| Branded report | Implemented · Verified (Chromium print/PDF) | print layout; "Save as PDF" via print dialog (not an in-app PDF library) |
| Rule-based assistant, exactly 50 FAQs | Implemented · Verified | 10/10/8/7/7/8, unique IDs, EN+HI, session onboarding, fallback, clear chat |
| "Get Help to Improve Internet Speed" | Implemented | opens assistant, offers playbooks from last result |
| English / Hindi | Implemented · Verified (functional) | 366 UI keys checked for both languages; Hindi text not reviewed by a native speaker |
| Favorites, settings, copy, feedback, errors | Implemented · Verified | feedback opens a GitHub issue page (confirm the repository URL) |
| Premium identity + intro + tricolor X | Implemented · screenshots reviewed | |
| 25 animation patterns | Implemented · keyframes/transitions verified present; reduced-motion verified in browser | playback smoothness not measured on a real mid-range Android device |
| Reduced motion | Implemented · Verified (computed style) | system preference + manual setting |
| Responsive desktop/mobile, bottom nav, safe areas | Implemented · Verified at 1280 px and 390 px | no overflow on any section; real devices not tested |
| Navigation + back button | Implemented · Verified | hash routing, aria-current, keyboard tabs |
| Static hosting, relative paths | Implemented · Verified over local HTTP | sub-path hosting not exercised on real GitHub Pages |
| Removed scope (QR, image studio, PDF editing) | Removed | not present in UI or code |
| PWA / offline | Not implemented | not required by this scope; real speed tests need connectivity anyway |

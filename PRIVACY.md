# SANCHARX Privacy
- No account, no login, no analytics, no tracking, no cookies set by SANCHARX.
- **Stored in your browser (localStorage)**: language, motion and auto-save settings, favorite tools, and saved test history (download, upload, latency, jitter, time, and the browser's own connection estimates). Session-only (sessionStorage): that the intro was shown and the assistant onboarding choice/name. Nothing is sent to any server by SANCHARX.
- Never stored: passwords, keys, personal files, IP addresses.
- **External requests, only when you use the feature**: speed test / stability monitor → speed.cloudflare.com; DNS lookup → the resolver you choose (Cloudflare or Google); Public IP → ipify.org (it sees your IP in order to return it); Endpoint checker → the URL you typed. These services have their own privacy policies and may log requests.
- Upload tests send randomly generated data only, never your files.
- Local history disappears if you clear site data, use private browsing, or press the in-app clear buttons. If storage is unavailable the app keeps working without saving.
- Settings → "Clear all saved data" removes everything SANCHARX stored.
- The feedback button only opens a GitHub issue page in a new tab; it sends nothing automatically. (Change `href` of `#feedback-link` in `index.html` if your repository differs.)

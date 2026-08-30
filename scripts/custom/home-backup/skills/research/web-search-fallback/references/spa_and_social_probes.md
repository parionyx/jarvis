# SPA bundle extraction & social-handle probes

Condensed, reusable recipes from a no-web-API research session (Koncept Law Associates, 2026-08).

## 1) Vite/React SPA has no JSON-LD → parse the JS bundle
Sites built with Vite + React often ship an `index.html` that is ~470 bytes: just `<div id="root">` + `<script src="/assets/index-<hash>.js">`. No server-side content, no JSON-LD. All visible text is in the JS bundle.

Steps (all CLI / `execute_code`, no browser):
1. `curl -sL <site>` → get `index.html`; regex `/assets/index-[\w-]+\.js`.
2. `curl -sL <site>/assets/index-<hash>.js` → save bundle (~100–200 KB, minified).
3. Extract rendered text:
   `re.findall(r'children:"((?:[^"\\]|\\.)*)"', js)`  (+ the `'...'` variant)
   This recovers headings, addresses, phone, email, service names, hours — everything.
4. Emails: `re.findall(r'[\w.%+-]+@[\w.-]+\.\w{2,}', js)`
   Phones: `re.findall(r'\+?91[-\s]?\d{10}|\b\d{10}\b', js)`
   Social URLs: `re.findall(r'https?://[^\s"\']+(?:linkedin|facebook|instagram|twitter|x\.com)[^\s"\']*', js)`
5. Ignore noise: `react.dev/errors`, `w3.org`/`MathML`/`SVG` namespaces, React/HTML object literals.

Caveat: on a Vite SPA, `/sitemap.xml` and `/robots.txt` ALSO return the SPA shell — do not trust them for a real URL list. Check subpaths with `curl -o /dev/null -w "%{http_code}"` to confirm they 200, but content still comes from the bundle.

## 2) Social-handle existence probes — HTTP codes are misleading
When verifying if `instagram.com/<h>`, `facebook.com/<h>`, `x.com/<h>`, `linkedin.com/company/<h>` exist:

| Platform | Code | Meaning |
|---|---|---|
| Instagram | 200 | **NOT proof** — serves generic app shell for ANY username (even nonsense). Read body for "page not found" / "this page isn't available". |
| Facebook  | 200 | **NOT proof** — same as IG; generic shell. Verify body. |
| X/Twitter | 404 | **Reliable absence** — handle does not exist. |
| LinkedIn  | 999 | **Bot-blocked** — cannot conclude present/absent. |

Probe loop (bash):
```bash
for h in konceptlaw konceptlawassociates; do
  for net in "https://www.instagram.com/" "https://www.facebook.com/" "https://x.com/" "https://www.linkedin.com/company/"; do
    code=$(curl -sL -o /dev/null -w "%{http_code}" -A "Mozilla/5.0" "$net$h")
    echo "$net$h -> $code"
  done
done
```
Rule of thumb: **404 = trustworthy (absent); IG/FB 200 = unconfirmed (verify body); 999 = blocked.**

## 3) Search engines that blocked scripted access (this session)
- `html.duckduckgo.com/html/` and `lite.duckduckgo.com/lite/` → anti-bot "anomaly" challenge page (no results).
- `www.bing.com/search` → 200 but unrelated/drifted snippets (query terms absent from results).
- `searx.be` → "Verifying your browser…" interstitial.
- Yahoo Search (per main skill) remains the reliable discovery engine.

---
name: web-search-fallback
description: "Web research via terminal when Firecrawl search is down."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Research, Search, Fallback, Terminal, urllib, Yahoo, JSON-LD]
    related_skills: [blocked-page-recovery, grounded-citations]
---

# Web-Search Fallback (no managed provider)

When `web_search` / `web_extract` return **"Web tools are not configured. Set
FIRECRAWL_API_KEY … no usable paid credits"**, the managed search path is dead.
You can still do real web research from the terminal — no API key needed. This
is a *discovery* fallback (find URLs + facts), complementary to
`blocked-page-recovery` (recover a URL you already know).

## Diagnose first
Confirm the failure mode before switching paths:
- `web_search` / `web_extract` → "Web tools are not configured" / "no usable paid credits" → use this skill.
- A specific *page* is blocked (403/WAF/paywall) → use `blocked-page-recovery` instead.

## Rung 0 — Exa MCP (preferred, no terminal needed)
If `mcp__exa__web_search_exa` is in the available toolset, call it FIRST. It needs
no API key in the agent context (the server holds it) and returns clean,
structured, citation-backed results — often better than the terminal ladder.
```text
tool_call mcp__exa__web_search_exa num_results=10 query="dermatologist Sector 69 Gurgaon contact number address"
```
**Strongest for:** local-business / doctor / clinic / directory lookups. Exa indexes
Google Maps + clinic sites (Practo, Lybrate, DocGenie, 1mg, Apollo247, myUpchar),
so a single call yields **addresses, phone numbers, hours, and map coordinates**
without any HTML parsing. It also works for general factual/research queries.
Only fall through to the terminal ladder below if Exa is NOT available or returns nothing.

## The terminal ladder
**Tool-selection order (user-stated preference): Exa MCP → terminal/curl (+ `execute_code` for parsing) → browser tool (`browser_exec`) → `computer_use` (CUA desktop) LAST.** Lead every research task with CLI/MCP; only reach for GUI desktop automation when the scriptable paths are exhausted. `computer_use` is slow, needs approval, and burns context — reserve it.
```text
1. Search-engine HTML scrape  — Yahoo Search (works), parse organic results
2. Direct site fetch           — urllib/curl the discovered URL; SPA sites still emit JSON-LD
3. JSON-LD extraction          — company/Org facts live in <script type="application/ld+json">
4. JS-bundle extraction        — see "SPA with no JSON-LD" below (recover JSX text when JSON-LD absent)
5. Browser tool (browser_exec)— only if (a) allowed and (b) not blocked by a permission popup
6. computer_use (CUA desktop) — ABSOLUTE LAST RESORT: GUI automation; slow, approval-gated, context-heavy
```

Run discovery in one shot with the bundled script:
```bash
python scripts/yahoo_search.py search "Parionyx Tech Solution"
python scripts/yahoo_search.py ld "https://www.parionyx.in/about"
```
(On some Hermes Windows/MSYS hosts `python3` is absent — use `python`; the
script is pure stdlib, no pip needed.)

## Engine notes (what actually works)
- **Yahoo Search** — `https://search.yahoo.com/search?p=QUERY` returns parseable
  organic results. Real target URLs are wrapped in Yahoo's redirect:
  `https://r.search.yahoo.com/.../RU=<percent-encoded-url>/RK=...`. Decode the
  `RU=` param with `urllib.parse.unquote`. Titles + snippets sit in the
  `<div class="dd algo ...">` blocks. **This is the reliable engine.**
- **DuckDuckGo HTML** (`html.duckduckgo.com/html/`) and **Lite**
  (`lite.duckduckgo.com/lite/`) → returned an **anti-bot "anomaly" challenge**
  page, not results. Do NOT rely on them; they look like a 200 but ship a
  challenge form. Skip.
- **Bing** (`www.bing.com/search?q=`) → returned HTTP 200 but **unrelated cached
  results** that drifted from the query (e.g. "models" for a tech-company
  query). If you must use it, verify each snippet actually contains the query
  terms before trusting it. Unreliable.
- **Ecosia** → 403 Forbidden. Skip.
- **Searx.be** (`searx.be/search`) → "Verifying your browser…" interstitial, even with `format=json`. Skip.
- **Mojeek** (`www.mojeek.com/search`) → 365-byte empty response. Skip.

### SPA with no JSON-LD → parse the JS bundle
Some Vite/React SPAs ship **no JSON-LD** and a near-empty `index.html` (just `<div id="root">`). All visible text lives in the hashed JS bundle. Recover it by fetching `/assets/index-<hash>.js` and extracting `children:"..."` string literals — this surfaces headings, addresses, phones, emails, and service names. See `references/spa_and_social_probes.md` for the full recipe. (Note: on such SPAs `/sitemap.xml` and `/robots.txt` also return the SPA shell — don't trust them.)

### Social-handle existence probes
HTTP status alone is misleading: Instagram/Facebook return **200 for any username** (generic app shell — verify the body), X/Twitter **404 = genuinely absent**, LinkedIn **999 = bot-blocked** (inconclusive). Probe recipe + table in `references/spa_and_social_probes.md`.

## JSON-LD is the jackpot for company facts
SPA sites (React Router, etc.) render almost nothing server-side, but they
almost always embed structured data in `<script type="application/ld+json">`.
For a company you typically get an `Organization` node with: `name`, `url`,
`description`, `contactPoint.telephone`, `contactPoint.contactType`, and
`sameAs` (LinkedIn / Twitter / etc.). Parse that — it's cleaner than scraping
the visible (often empty) DOM. See `scripts/yahoo_search.py ld <url>`.

## Verification discipline
- Treat a 200 as suspicious until the body contains query-specific strings.
  Search-engine challenge pages and Bing drift both return 200 with wrong
  content.
- Prefer official/structured sources (site JSON-LD, LinkedIn/Clutch/GoodFirms
  listings) over scraped forum text.
- When you can't confirm a fact (founder names, legal entity type, headcount,
  revenue), say so explicitly — don't infer from thin signal.
- Note provenance: clearly mark data scraped from a search-engine copy vs. a
  live site fetch.

## Pitfalls
- Don't loop on DuckDuckGo HTML/Lite — it serves a challenge, not results.
- Don't trust Bing's first page without content checks.
- Browser tool may be blocked by a Chrome "Allow remote debugging?" popup
  (cua-driver). That's a separate blocker; if it appears, tell the user to
  click Allow rather than retrying blindly.
- Don't hard-code "web tools do not work" as a permanent conclusion — the
  managed provider can be re-enabled with credits; this skill is the fallback
  for when it isn't.

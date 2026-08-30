# MCP Server Recipes (Hermes) — Windows host

Working commands captured 2026-08-22 (Windows 11, Hermes CLI `hy3-free`).
General rule: `hermes mcp add` is interactive — PIPE the auth + tool-enable answers or it hangs/cancels.

## Canva (remote, OAuth) — 33 tools
```
echo "Y" | hermes mcp add canva --url https://mcp.canva.com/mcp --auth oauth
```
Opens a browser OAuth window. Scopes: design meta/content, brand templates, assets, brand kits, comments, help. Server saves before you finish authorizing; real calls need the browser grant.

## Context7 (remote, no auth) — 2 tools
```
printf "n\nY\n" | hermes mcp add context7 --url https://mcp.context7.com/mcp
```
Tools: `resolve-library-id`, `query-docs`. Auth prompt → answer `n`.

## DeepWiki (remote, no auth) — 3 tools
```
printf "n\nY\n" | hermes mcp add deepwiki --url https://mcp.deepwiki.com/mcp
```
Tools: `read_wiki_contents`, `read_wiki_structure`, `ask_question`.

## Exa (remote HTTP, OAUTH — NO API key) — 2 tools  ← CANONICAL (docs.exa.ai/reference/exa-mcp)
```
hermes mcp remove exa                          # if a stale npx/API-key entry exists
printf "n\nY\n" | hermes mcp add exa --url https://mcp.exa.ai/mcp
hermes mcp login exa                            # opens browser OAuth (required; non-interactive env fails)
```
Tools: `web_search_exa`, `web_fetch_exa`. Optionally enable advanced: `?tools=web_search_exa,web_fetch_exa,web_search_advanced_exa` on the URL.
**DO NOT use `npx -y exa-mcp-server` + `EXA_API_KEY`** — that is the deprecated/keyed path; it connects but is the wrong setup per Exa's own MCP docs. Exa MCP is OAuth, no key needed.
⚠️ `hermes mcp login exa` must run in an INTERACTIVE terminal (it opens a browser). In a non-interactive/headless shell it errors: `non-interactive environment and no cached tokens found`. Workaround: save the URL-only config first (`hermes mcp add exa --url https://mcp.exa.ai/mcp`, answer `n` to auth, `Y` to enable), then run `login` separately in a TTY.

## Sequential Thinking (stdio, broken npm pkg → local install) — 1 tool
The published `@modelcontextprotocol/server-sequential-thinking` fails with:
`ERR_MODULE_NOT_FOUND: Cannot find package 'zod'`.
Fix with a local install that pulls the missing dep, then add via the Windows `.cmd` wrapper:
```
mkdir -p scratch && cd scratch && npm init -y && npm install @modelcontextprotocol/server-sequential-thinking zod
hermes mcp remove sequential-thinking   # if a broken entry exists
hermes mcp add sequential-thinking --command "C:/Users/works_ar/AppData/Local/hermes/mcp_servers/sequential-thinking/node_modules/.bin/mcp-server-sequential-thinking.cmd"
```
Tools: `sequentialthinking`. (Raw binary → WinError 193; must use `.cmd`.)

## Apify (remote HTTP, OAuth/Bearer) — India real-estate + any Store actor — pay-per-result
Apify exposes ONE hosted MCP: `https://mcp.apify.com`. Attach specific Store actors via the `?tools=` param (comma-separated `username/actor-name`). Needs an Apify account (free tier = $5/mo credit, no card; runs pause when credit runs out, never billed). Auth = browser OAuth OR `Authorization: Bearer <APIFY_TOKEN>` from console.apify.com/settings/integrations.
```
# India property trio (recommended):
printf "n\nY\n" | hermes mcp add apify --url "https://mcp.apify.com/?tools=thirdwatch/acres99-scraper,unfenced-group/housing-scraper,automation-lab/olx-india-classifieds-scraper"
hermes mcp login apify        # interactive browser OAuth (same headless caveat as Exa)
```
Verified India actors (all pay-per-result, free-tier friendly):
- `thirdwatch/acres99-scraper` — 99acres, 40+ fields (RERA, lat/long, amenities)
- `themineworks/99acres-scraper` — 99acres, 28 fields, no login
- `unfenced-group/housing-scraper` — Housing.com, ~$0.8/1K, GPS + verified status
- `automation-lab/olx-india-classifieds-scraper` — OLX India, price/location/seller
Note: there is NO official 99acres/Housing/OLX MCP and NO India-supporting OLX MCP from the open-source `olx-mcp` repos (those are Europe-only: olx.pl/pt/bg/ro/ua). Use Apify for India data.

## Generic remote
`hermes mcp add <name> --url <url>` (+ `--auth oauth` if the server needs it). Pipe `printf "n\nY\n"`.

## Generic stdio npx
`printf "Y\n" | hermes mcp add <name> --command npx --args -y <pkg>` (+ `--env KEY=VAL` as needed).

## Pollinations (stdio npx, NO API KEY) — image/audio/video generation — 12 tools
Keyless, anonymous, rate-limited (free tier). Berlin-based open-source `gen.pollinations.ai`.
```bash
printf "Y\n" | hermes mcp add pollinations --command npx --args -y @pollinations/model-context-protocol
```
Tools include `generateImageUrl`, `generateImage` (base64), `generateVideo`, `sayText` (TTS audio), `describeImage`, `listImageModels`. No `POLLINATIONS_API_KEY` needed for anonymous use; set one via `--env POLLINATIONS_API_KEY=pk_...` only if you hit rate limits. Loads in a new session.

## social-media-manager-mcp (stdio npx, NO key) — 8 tools
Hashtag strategy, content calendar, caption frameworks, engagement playbook, metric interpretation, client-report template.
```bash
printf "Y\n" | hermes mcp add social-media --command npx --args -y social-media-manager-mcp
```
Tools: `get_posting_cadence`, `build_content_calendar`, `get_caption_framework`, `get_hashtag_strategy`, `get_engagement_playbook`, `interpret_metric`, `get_client_report_template`, `get_full_pack`.

## xtapdown-mcp (stdio npx, ZERO auth) — 14 tools
X/Twitter creator toolkit: hashtags by niche, viral-tweet finder, advanced-search-operator cheatsheet. No auth, no rate-limit on data tools (uses X public syndication endpoint).
```bash
printf "Y\n" | hermes mcp add xtapdown --command npx --args -y xtapdown-mcp
```
Tools include `get_x_hashtags`, `find_viral_tweets_for_niche`, `get_x_search_operators_cheatsheet`.

## Verify
```
hermes mcp list | grep -i <name>     # expect ✓ enabled
hermes mcp test <name>               # expect ✓ Connected + ✓ Tools discovered
```
Then RESTART the Hermes session/app — new tools only load in a fresh session.

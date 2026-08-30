---
name: hermes-mcp-connections
description: Wire up Hermes MCP servers (OAuth, npx) and fix failures.
---

# Hermes MCP Connections

## When to use
User wants to connect an MCP server NOT in the `hermes mcp catalog` (e.g. Canva, Context7, DeepWiki, Exa, Sequential Thinking, **Apify**) — "X ki mcp add kr", "connect Y MCP". Covers remote HTTP/OAuth and stdio npx/local servers plus the interactive-prompt and Windows gotchas. Also covers **Apify Store actors wired as a single remote MCP** (India real-estate scraping: 99acres/Housing/OLX — there is no standalone official MCP for those; use Apify).

## Two add paths
1. **Catalog install** — ONLY Nous-approved entries: `hermes mcp install <name>` (figma, notion, vercel...). List with `hermes mcp catalog`.
2. **Custom add** — any other server: `hermes mcp add <name> ...`. `hermes mcp install <x>` for a non-catalog name errors: `"<x>" is not in the catalog`.

## CRITICAL: Exa is REMOTE OAUTH, not npx+API-key
Canonical source: https://docs.exa.ai/reference/exa-mcp. The correct setup is `hermes mcp add exa --url https://mcp.exa.ai/mcp --auth oauth` (+ `hermes mcp login exa` in a TTY). Exa MCP uses OAuth — NO API key. The `npx -y exa-mcp-server` + `EXA_API_KEY` path is DEPRECATED and wrong; it connects but is not the documented setup. If you already added the npx/keyed version, `hermes mcp remove exa` then re-add as remote OAuth.
The command prompts and waits forever (timeout=exit 124) or cancels (no save) if stdin is empty:
- `Does this server require authentication? [Y/n]`
- `Enable all N tools? [Y/n/select]` — MUST answer `Y`, else the server is NOT written to config (later `grep` of config returns nothing).

Pipe input (foreground, non-interactive):
- Remote no-auth (Context7, DeepWiki): `printf "n\nY\n" | hermes mcp add <name> --url <url>`
- Remote OAuth (Canva, Figma): `echo "Y" | hermes mcp add <name> --url <url> --auth oauth` — opens browser OAuth; saves even before you authorize; real calls need the browser grant.
- Stdio npx: `printf "Y\n" | hermes mcp add <name> --command npx --args -y <pkg>`

## Remote (HTTP) servers
`hermes mcp add <name> --url https://<host>/mcp [--auth oauth]`.
Known-good: Canva `https://mcp.canva.com/mcp`, Context7 `https://mcp.context7.com/mcp`, DeepWiki `https://mcp.deepwiki.com/mcp`, Figma `https://mcp.figma.com/mcp`.

## Stdio (npx / local)
`hermes mcp add <name> --command npx --args -y <pkg>`.
- **Windows gotcha:** `command` must be a `.cmd`/`.ps1` wrapper, NOT a raw binary → else `WinError 193 %1 is not a valid Win32 application`. Use the `.cmd` from `node_modules/.bin/`.
- Env vars: `--env KEY=VALUE` (e.g. `EXA_API_KEY=...`). Server connects even with a dummy key, but every call 401s until a real key is set.

## User constraint: no clone, no local server maintenance
When the user says "local server maintain na krna pade" / "no repo clone" / "remote only", they want **npx stdio** or **hosted HTTP** servers that Hermes runs as a background subprocess — NOT something they install, git-clone, or keep running manually. Prefer:
- Npx packages: `hermes mcp add <name> --command npx --args -y <pkg>` (Hermes manages the process; nothing for the user to maintain).
- Hosted remote URLs with `--auth oauth` or no-auth.
AVOID recommending local-first servers that need a manually-run daemon (e.g. a user-hosted ComfyUI, a local Postgres-backed app) unless the user explicitly accepts the maintenance burden. Remote "cloud" MCPs that still require a paid subscription (e.g. Comfy Cloud) are NOT free — see reality-check below.

## "Free unlimited" generation MCP — reality check
Users often ask for "free unlimited image/audio generation MCP". Honest answer:
- **Genuinely free + unlimited = LOCAL GPU only** (self-hosted ComfyUI). That breaks the no-clone/no-maintain constraint above.
- **Remote generation MCPs are metered**: Comfy Cloud needs a subscription (only ~5 free runs); Suno/Udio are paid.
- **Keyless remote generation DOES exist but is rate-limited**: Pollinations (`@pollinations/model-context-protocol`) generates image/audio/video with NO API key, but anonymous use is IP-rate-limited per hour. Fine for normal use, not bulk production.
- **Strategy/manager MCPs are usually free + no-key**: social-media hashtag/calendar tools, X/Twitter hashtag tools — these are rule-based, no external AI billing.
When scoping, state this trade-off up front instead of promising "free unlimited remote generation".

## Verified free, no-key, npx MCPs (no clone, no maintain)
All three added successfully 2026-08-24 via `printf "Y\n" | hermes mcp add ... --command npx --args -y <pkg>`:
- `pollinations` → `@pollinations/model-context-protocol` — image/audio/video generation, NO key, rate-limited. (See references/recipes.md.)
- `social-media` → `social-media-manager-mcp` — hashtag strategy, content calendar, captions, engagement playbook, client reports. No key.
- `xtapdown` → `xtapdown-mcp` — X/Twitter hashtags by niche, viral-tweet finder, search-operator cheatsheet. Zero auth, zero rate-limit on data tools.
These load only in a NEW session ("Start a new session to use these tools").

## Broken-npx-package fallback
If `npx -y <pkg>` fails with a module-resolution error (e.g. `ERR_MODULE_NOT_FOUND: Cannot find package 'zod'`), the published package may be broken upstream. Fix: local `npm install <pkg> <missing-dep>` in a scratch dir, then `hermes mcp add <name> --command <scratch>/node_modules/.bin/<bin>.cmd`. (See references/recipes.md — Sequential Thinking case.)

## Config is NOT hand-editable
`~/AppData/Local/hermes/config.yaml` is security-protected — direct writes/patch are REFUSED ("Agent cannot modify security-sensitive configuration"). Manage servers ONLY via `hermes mcp add` / `hermes mcp remove`. To replace a broken entry: `hermes mcp remove <name>` then re-`add`.

## Verify + activate
- `hermes mcp list` → server shows `✓ enabled`.
- `hermes mcp test <name>` → confirms transport, auth, tool discovery (`✓ Connected (2313ms)`, `✓ Tools discovered: 33`).
- **Restart session / app** — added tools only load in a NEW session ("Start a new session to use these tools").

## Pitfalls (frequency order)
- `hermes mcp install` for non-catalog server → not-in-catalog error. Use `add`.
- Forgetting to pipe `Y` to the tool-enable prompt → server silently NOT saved.
- OAuth servers report "Connected! Found N tools" before browser authorization — expected; real calls still need the grant.
- **HEADLESS OAuth fails**: `hermes mcp add ... --auth oauth` (and `hermes mcp login <name>`) need an INTERACTIVE terminal that can open a browser. In a non-interactive/headless shell they error `non-interactive environment and no cached tokens found`. Workaround: add with URL-only (`printf "n\nY\n" | hermes mcp add <name> --url <url>`, answer `n` to auth), then run `hermes mcp login <name>` in a real TTY.
- **Exa wrong path**: do NOT use `npx -y exa-mcp-server` + `EXA_API_KEY`. Canonical Exa MCP is remote OAuth at `https://mcp.exa.ai/mcp` — no key needed (docs.exa.ai/reference/exa-mcp).
- Windows raw binary `command` → WinError 193; always use `.cmd`.
- Server not ready in current session — needs a restart to load.
- **Apify**: one hosted MCP `https://mcp.apify.com` with actors attached via `?tools=username/actor-name`. Needs a free Apify account; no official 99acres/Housing/OLX MCP exists elsewhere — use Apify for India property data.
- **"Free unlimited" remote generation MCP does not exist**: Comfy Cloud (already in catalog as `comfy-cloud`, enabled) needs a paid subscription — only ~5 free runs. Suno/Udio are paid. Local ComfyUI is the only truly-free-unlimited image/audio path, but it needs a user-run GPU daemon (violates the no-clone/no-maintain constraint). Use Pollinations keyless npx for free-but-rate-limited generation.
- **No-clone/no-local-maintain constraint**: prefer npx or hosted-oauth servers; never recommend a manually-run local daemon unless the user accepts it.

## References
- `references/recipes.md` — copy-paste command recipes for Canva, Context7, DeepWiki, Exa (remote OAuth), Sequential Thinking (incl. broken-package local-install fix), and Apify real-estate MCP on Windows.

# AiSensy on the JARVIS Windows Host — Environment Limitation & Reliable Path

Captured from a live session (2026-08-15). The desktop-automation route in the parent
SKILL.md is **not viable here** — do not attempt it as the primary path:

- AiSensy is a heavy SPA; its page content is **absent from the Windows accessibility (AX) tree**,
  so `computer_use` element-index or coordinate clicks cannot target page controls.
- Background `key`/`type` input is **dropped by Edge** (`Chrome_WidgetWin_1` window class).
  Foreground keystrokes work, but without pixel vision on the current model, clicks can't be verified.
- Binding the typed-browser (CDP) reader to the existing Edge profile is **refused** unless
  `--grant existing-profile` / an authorization host is configured (not set up on this host).

## Validated fallback (recommended)
1. Ask the user to do ONE manual click: Ads Manager → Leads → **Export CSV**
   (top-right of the leads table). File lands at `~/Downloads/lead-submissions-<PROJECT_ID>-YYYY-MM-DD.csv`.
2. Run `scripts/parse_aisensy_leads.py` (defaults to the newest such CSV + today IST) to count
   today's leads and list name/phone/ad.

## Critical gotcha
The CSV is **cumulative** — the filename date is the *export* date, not a filter. Count by parsing
`Last Submission At` (UTC ISO, `Z` suffix) → IST (+5:30), bucket by calendar day. See
`references/aisensy_leads_export.md` for schema and worked example.

## If you later want full automation
Configure browser consent (`--grant existing-profile` or set an embedding authorization host),
re-run `computer_use` `cua_browser_prepare` with the exact `pid`+`window_id` of the logged-in Edge,
then use `cua_browser_*` actions to navigate and export. Until then, the CSV-drop fallback is it.

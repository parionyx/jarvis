---
name: google-workspace-ops
description: "Use when auditing Google Workspace via API on Windows."
version: 1.0.0
author: JARVIS
license: MIT
metadata:
  hermes:
    tags: [google, workspace, gmail, drive, calendar, docs, sheets, api, windows]
---

# Google Workspace Ops (Windows host)

Read-only and write operations against Gmail / Calendar / Drive / Docs / Sheets
using the authenticated `google-workspace` skill's `google_api.py` wrapper.

Full command semantics live in the bundled `google-workspace` skill — this skill
adds the **Windows-host invocation realities and the Sheets structure-inspection
workaround** that the bundled skill does NOT cover. Load `google-workspace` for
the complete sub-command list; load this skill whenever you actually RUN the
script on this Windows machine.

## When to Use
- "check my emails" / "today's emails" (see also `gmail-daily-summary`)
- Read-only verification of Calendar, Drive, Docs, or Sheets
- "open / inspect my Google Doc / Sheet / Drive file"
- Any task that needs `google_api.py` to actually execute (not just described)

## CRITICAL: How to invoke (Windows host)
The wrapper lives at:
`C:/Users/works_ar/AppData/Local/hermes/skills/productivity/google-workspace/scripts/google_api.py`

```bash
# CORRECT — native Windows forward-slash path under `python`
python C:/Users/works_ar/AppData/Local/hermes/skills/productivity/google-workspace/scripts/google_api.py <subcommand> ...
```

PITFALLS (all three were hit and cost round-trips this session):
- ❌ Relative `python scripts/google_api.py ...` → FAILS. The agent's CWD is not the skill dir.
- ❌ MSYS path `python /c/Users/works_ar/.../google_api.py` → FAILS under `python` on this host (path not translated).
- ✅ Native `C:/Users/works_ar/...` forward-slash path → works.
- Resolve dynamically when portable: `${HERMES_HOME:-$HOME/.hermes}/skills/productivity/google-workspace/scripts/google_api.py`

## Sub-command quick reference
| Area | Command |
|------|---------|
| Gmail search | `... gmail search "query" --max N` |
| Gmail read | `... gmail get MESSAGE_ID` |
| Calendar | `... calendar list --start ISO --end ISO` |
| Drive search | `... drive search "mimeType='...'" --raw-query --max N` |
| Drive metadata | `... drive get FILE_ID` |
| Docs content | `... docs get DOC_ID` |
| Sheets values | `... sheets get SHEET_ID "Tab!A1:Z10"` (range is POSITIONAL, not `--range`) |

## Sheets structure inspection (the bundled skill can't do this)
`sheets get` returns ONLY cell values — no tab names, no grid dimensions. To
inspect tabs / used range, call the Sheets API `spreadsheets().get` directly
(reuse the wrapper's `build_service`). See `references/sheets-structure-probe.py`
for a ready-to-run read-only script. Key lesson: the `fields` mask MUST NOT
include `data.lastRow` (invalid → HTTP 400); compute used rows from
`len(sheets[].data[].rowData)`.

## Guardrails
- Read-only verification: never send/modify/delete/archive/move without explicit ask.
- Never expose OAuth tokens, client secrets, or `google_token.json` contents.
- Auth check: `python .../setup.py --check` → expects `AUTHENTICATED`.

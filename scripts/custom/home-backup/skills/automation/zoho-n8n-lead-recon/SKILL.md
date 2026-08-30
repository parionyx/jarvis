---
name: zoho-n8n-lead-recon
description: Reconcile 99acres/Housing leads across Zoho CRM and n8n.
version: 1
author: JARVIS
license: MIT
metadata:
  hermes:
    tags: [zoho, n8n, real-estate, leads, daily-report, automation]
    related_skills: [n8n-execution-audit, crm-dual-sync]
---

## When to Use
- "kal kitni leads aayi", "check 99acres/Housing leads", "Zoho + n8n lead report"
- Building an Excel of yesterday's portal leads.
- Proving the lead pipeline is healthy (no lead dropped between n8n webhook and Zoho CRM).
- Setting up / maintaining the recurring daily Telegram lead report cron job.

# Zoho + n8n Lead Reconciliation / Daily Report

Use for: "kal kitni leads aayi", "check leads from Zoho and n8n", "daily lead report",
"build an Excel of yesterday's leads" for the 99acres / Housing → Zoho CRM + AiSensy + n8n
real-estate pipeline. Also for proving the pipeline is healthy (no dropped leads between n8n and Zoho).

## Architecture (this stack)
Two webhook-triggered n8n workflows ingest raw portal leads and fan out to Zoho CRM + AiSensy + Sheets:
- **99acres → Zoho CRM + AiSensy**: workflow id `UcBDsKpwo4YC4cDn`
- **Housing.com → Zoho CRM + AiSensy**: workflow id `GbKgTPIHF81RsFXP`

Separate **"Lead Action Engine"** (id `3uOweb3mQBZPwRT2`) polls Calls + Lead Status every 15 min
and sends WhatsApp follow-ups — it is NOT a lead source. Do NOT count its runs as leads.

Zoho CRM "Leads" module stores each lead with `Lead_Source` = `"99acress"` (note the typo) or `"Housing"`.

## Steps
1. Pull n8n executions for each portal workflow, filtered by the IST day → UTC window (see below).
2. Pull Zoho Leads module data, filter by `Created_Time` in the same IST window, split by `Lead_Source`.
3. Cross-check: n8n webhook fires should ≈ Zoho leads (1:1). Flag any mismatch or non-`success` status.
4. (Optional) Build an Excel workbook from the filtered Zoho records.

## CRITICAL PITFALLS

### Spillover-file trap (Zoho get_module_data)
`mcp__zoho_crm__get_module_data` returns up to 200 records and can be HUGE (>450KB). The MCP
server saves it to a spillover file path printed in the tool result (e.g.
`...\cache\spillover\chatcmpl-<id>.txt`) and returns only a 1500-char preview.
**Do NOT re-call the API.** Read the file with `execute_code`:
```python
import json
path = r"<spillover path from tool output>"
raw = open(path, encoding='utf-8').read()
obj = json.loads(raw[raw.find('{"result"'):])   # strip any wrapper text
leads = json.loads(obj["result"])["data"]
```
Then filter by date in Python. NOTE: the 200-record dump is the MOST RECENT leads only — if the
earliest `Created_Time` in the dump is AFTER your window end, the data is truncated and older leads
are invisible from this call. Say so explicitly; never report 0 when the dump simply can't see back that far.

### IST ↔ UTC date window
The user thinks in IST (Asia/Kolkata, UTC+5:30). n8n `startedAfter`/`startedBefore` are UTC ISO with `Z`.
For "yesterday IST":
- `startedAfter` = (day before yesterday) **18:30:00Z**
- `startedBefore` = (yesterday) **18:30:00Z**
Zoho `Created_Time` is already IST (`+05:30`). Parse with `datetime.fromisoformat`.

### Lead_Source typo
Zoho stores 99acres as `"99acress"` (double-s, missing 'e'). Match the exact string `"99acress"` and `"Housing"`.
The email is often masked as `<phone>@99acres.com`; Housing leads may have a null email.

## Daily report automation
Use `cronjob` create with schedule `0 9 * * *` (9 AM IST) and deliver `origin` (user's Telegram).
The cron prompt must compute the IST window, call BOTH MCPs, and report counts + mismatch in Hinglish.
Reference prompt pattern: `references/cron-prompt.md`.

## Support files
- `references/known-workflows.md` — portal → workflow id map + node roles.
- `references/cron-prompt.md` — copy-paste cron prompt that does the full daily report.
- `references/excel-template.md` — openpyxl sheet layout (color-coded, 2 sheets).

## Overlap note
Adjacent to `n8n-execution-audit` (audits within-n8n branch failures). This skill is the
n8n↔Zoho *cross-system* bridge + recurring report; keep both.

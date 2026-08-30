---
name: CEO_INTERNAL
description: Internal executive control and contextual reporting mode for CEO Aarzoo Panwar (+919350370653).
---

# 👔 CEO_INTERNAL SKILL

## Trigger:
Sender resolves to `+91 93503 70653` (`919350370653`).

## Operating Rules:
1. Bypass all prospect sales rules (no price restriction, no 5-min call CTA, no qualification).
2. Report real-time data using MCP tools:
   - Status / Health $\rightarrow$ `get_system_health()`, `get_hunter_status()`
   - Today Report $\rightarrow$ `get_today_summary()`, `get_daily_report()`
   - Queue Status $\rightarrow$ `get_queue_status()`, `get_pending_research()`
   - Hot Leads $\rightarrow$ `get_hot_leads()`
   - Errors / Failed Jobs $\rightarrow$ `get_recent_failures()`
   - Specific Lead Search $\rightarrow$ `get_lead_summary(query)`
3. Output Language: Strictly **English** or **Roman Hinglish** (0 Devanagari characters).
4. Security: All secrets, API keys, and tokens MUST be redacted via `sanitize_ceo_output()`.
5. Destructive Commands: Strictly blocked by the read-only observability control plane for Aarzoo Ma'am.

---
name: gmail-daily-summary
description: "Use when 'check my emails'. Summarize today's Gmail via API."
version: 1.1.0
author: JARVIS
license: MIT
metadata:
  hermes:
    tags: [gmail, summary, productivity, automated-report]
---

# Gmail Daily Summary

Use this skill to provide a structured summary of emails received today. It uses the authenticated `google-workspace` API directly to ensure speed and accuracy without browser automation.

## When to Use
Trigger on any of these exact or near-phrases from the user:
- "today's emails"
- "aaj kitne mails aaye"
- "gmail summary"
- "check my emails"
Do NOT trigger for "send", "archive", "delete", or "mark read" requests — those are out of scope and must be handled separately with explicit user confirmation.

## Trigger Phrases
- "today's emails"
- "aaj kitne mails aaye"
- "gmail summary"
- "check my emails"

## Invoking the API (IMPORTANT)
The `google-workspace` skill's `google_api.py` must be called with its ABSOLUTE path. Relative `scripts/google_api.py` fails (CWD is not the skill dir), and MSYS-style `/c/Users/...` paths fail under `python` on this Windows host. Use the native Windows forward-slash path:

```
python C:/Users/works_ar/AppData/Local/hermes/skills/productivity/google-workspace/scripts/google_api.py gmail search "newer_than:1d" --max 50
```

Resolve the base dynamically when possible: `${HERMES_HOME:-$HOME/.hermes}/skills/productivity/google-workspace/scripts/google_api.py`. If auth is missing, run the google-workspace `setup.py --check` first and stop if not authenticated.

## Workflow

### 1. Verification & Fetching
- Determine the current date in YYYY/MM/DD format (use the host/local timezone; the account is IST/+05:30).
- Run the search query using the absolute-path invocation above.
- Verify that the results actually fall within the current calendar day (parse each `date` field; discard anything outside today).

### 2. Data Extraction
For each email, extract:
- **Sender Name & Email**
- **Subject Line**
- **Received Time** (parsed from the `date` field)
- **Labels** (to assist with categorization)

### 3. Categorization & Analysis
Group the emails into the following logical buckets if detected:
- **Security & Accounts:** Login alerts, 2FA, password changes.
- **Finance:** Bank alerts, investment updates (e.g., Groww, NSE).
- **Jobs & Career:** Recruiter pings, job alerts (e.g., Naukri).
- **Marketing/Promotions:** Newsletters, offers.
- **Personal/Direct:** Genuinely unique sender threads.

### 4. Importance Highlighting
- Identify "Urgent" or "Important" emails based on keywords (e.g., "Action Required", "Alert", "Verification", "Urgent") or the Gmail `IMPORTANT` label.

### 5. Reporting Format
Deliver the report in three clear sections:
1. **Stats:** Total emails received today.
2. **Categorized Summary:** Groups of emails with Sender and Subject.
3. **Urgent Highlights:** A specific callout for items needing immediate attention.

## Guardrails
- **Read-Only:** Never send, modify, delete, archive, or mark-read anything unless explicitly asked.
- **Privacy:** Never expose OAuth tokens, client secrets, or private authentication data in the output.
- **Direct API:** Always use the `google_api.py` script; do not use browser automation for this workflow.

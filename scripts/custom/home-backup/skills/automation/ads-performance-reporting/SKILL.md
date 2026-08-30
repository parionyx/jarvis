---
name: ads-performance-reporting
description: Daily Meta + AiSensy ads reporting.
---

# Ads Performance Reporting

Use when the user asks for a daily ads report, Meta Ads report, lead report, AiSensy report, or any variation of "how are my Click-to-WhatsApp ads performing today."

## Objective

Collect live data from Meta Ads Manager and AiSensy, cross-check leads, analyze performance, and deliver a concise but complete daily ads report.

## Core Workflow

### 1. Browser Access

- Open Microsoft Edge.
- If Edge is minimized or hidden, restore it using the PowerShell script at `references/restore_edge.ps1`.
- Do not rely on sidebar/hamburger clicks in AiSensy; use direct URL navigation.

### 2. AiSensy Navigation

- Direct URL pattern: `https://www.app.aisensy.com/projects/<PROJECT_ID>/advertisement/ads-manager`
- If the user provides a direct link, use it exactly.
- If the project ID is unknown, open `https://app.aisensy.com/login` and use the active session.

### 3. Meta Ads Manager

- Open `https://adsmanager.facebook.com` in the same Edge session.
- If a new tab is needed, use Ctrl+T or click the tab bar.
- Select the correct ad account if prompted.
- Navigate to the relevant Click-to-WhatsApp campaigns.
- Set date range to: Today, Yesterday, and current campaign reporting period.

### 4. Data Collection

Collect from both platforms:

**Meta Ads Manager:**
- Total leads today / yesterday / overall
- Campaign name, status, spend, leads, CPL, CTR, CPC, CPM
- Ad-set and ad-level metrics where available
- Budget type (daily/lifetime)
- WhatsApp conversations started
- Messaging contacts/leads

**AiSensy:**
- Total leads received
- Today's leads and yesterday's leads
- Lead timestamps
- Source/campaign attribution if visible
- Number of leads reaching AiSensy

### 5. Cross-Check

- Compare Meta-reported leads vs AiSensy-reported leads.
- Note discrepancies explicitly.
- Do not assume they must match; explain possible reasons if data supports it.

### 6. Report Format

Return in this exact structure:

```
META ADS DAILY REPORT
Date: [DATE]

EXECUTIVE SUMMARY
- Total leads today:
- Total spend today:
- Overall CPL:
- Best campaign:
- Worst campaign:
- Key change vs yesterday:

LEADS
- Meta leads today:
- AiSensy leads today:
- Difference:
- Total leads overall:
- Yesterday's leads:

CAMPAIGN PERFORMANCE

Campaign | Status | Spend | Leads | CPL | CTR | CPC | CPM | Assessment

AD SET PERFORMANCE

Ad Set | Campaign | Spend | Leads | CPL | Assessment

AD PERFORMANCE

Ad | Campaign | Spend | Leads | CPL | CTR | Assessment

THREE KEY INSIGHTS
1.
2.
3.

RECOMMENDED ACTIONS
1.
2.
3.

DATA ISSUES / DISCREPANCIES
- Mention anything unusual or unavailable.
```

## Analysis Guidelines

- Distinguish clearly between: FACTS FROM ADS MANAGER, FACTS FROM AISENSY, YOUR ANALYSIS, RECOMMENDATIONS.
- Do not mix assumptions with factual metrics.
- For every active campaign, determine: performing well or poorly, trend direction, wasted spend signs, optimization opportunity.
- Do not make aggressive recommendations from insufficient data.

## Technical Notes

### Edge Window Management

- When Edge is minimized, use `references/restore_edge.ps1` with the window handle from PowerShell: `Get-Process msedge | Select-Object Id, MainWindowHandle`.
- `ShowWindow(hwnd, 9)` restores; `SetForegroundWindow(hwnd)` brings to front.

### Input Routing

- For typing in Edge address bar or page content, use `delivery_mode: "foreground"` if background fails.
- **Clicking page elements:** `computer_use` with a bare `element` index is refused by Cua Driver 0.17 ("pass element_token or snapshot_id with element_index"). Fall back to **coordinate clicks** (`action: click, coordinate: [x,y]`) in background mode, deriving the point from the element's native `bounds` center. AX `bounds` are native desktop coordinates — use them directly as the coordinate.

### AiSensy Quirks

- Sidebar/hamburger menu often does not respond to background clicks.
- Direct URL navigation is the reliable path.
- The Ads Manager table may be truncated in accessibility tree; use full capture and scroll if needed.

## Reference: Getting today's leads from AiSensy

The Leads UI only shows **cumulative** totals — there is no date filter and the AX tree hides lead-row text. To count today's leads, use **Export CSV** and parse `Last Submission At` (UTC → IST +5:30). Full procedure, CSV schema, and worked example: `references/aisensy_leads_export.md`.

## User Preferences

- Direct action over explanation. Do not narrate every click.
- If blocked, state the exact blocker and ask for specific input (screenshot, credentials, manual navigation).
- Never expose or save passwords.
- Do not ask for permission for harmless reversible actions.

---
name: notion-personal
description: "Access and manage the user's personal Life OS Notion workspace (Study Abroad, Italy CS Bachelor, goals, tasks, journals, habit trackers) via the notion-personal MCP server or direct REST API."
version: 1.0.0
author: user
license: MIT
platforms: [linux, macos, windows]
prerequisites:
  env_vars: [NOTION_PERSONAL_API_KEY]
metadata:
  hermes:
    tags: [Notion, Personal, LifeOS, StudyAbroad, Italy, Tasks, Goals, Journal, Habits, Productivity]
    homepage: https://notion.so
---

# notion-personal — Personal Life OS

This skill gives Jarvis full read/write access to the **user's personal Notion workspace**, called **"Life OS"**.

---

## Workspace Context

| Field | Value |
|---|---|
| **Workspace Name** | Life OS |
| **Bot Name** | Jarvis |
| **Token** | `NOTION_PERSONAL_API_KEY` = `ntn_REDACTED_REPLACE_WITH_YOUR_KEY` |
| **MCP Server** | `notion-personal` |
| **MCP Tool Prefix** | `mcp__notion_personal__` |

> **IMPORTANT:** This is the user's **personal** workspace. It is completely separate from the Parionyx Tech Solutions workspace. Always use `notion-personal` tools (not `notion`) when accessing personal data like Study Abroad, personal notes, goals, or journals.

---

## Known Page & Database IDs (Pre-Verified)

| Item | ID | Notes |
|---|---|---|
| Study Abroad (page) | `75b47f42-fe44-8322-a59c-810a8b78399f` | Main planning page in Life OS |
| CS and ML program in Italy (DB) | `ba347f42-fe44-8349-bfcb-01176dffb15e` | Tracks university programmes |
| Tasks Tracker (DB) | `33c47f42-fe44-800a-bc8f-d02a13c3921f` | General tasks inside Study Abroad |

> **Always use these IDs directly** instead of searching for the page name — it's faster and avoids wrong workspace errors.

---

## Key Content: Study Abroad — Italy CS Bachelor

The user is planning to pursue a **Bachelor of Science in Computer Science in Italy**. Key planning areas:

- **Target Universities:** Sapienza (Roma), Politecnico di Milano, Politecnico di Torino, University of Milan, University of Bologna (UniBo), University of Trento
- **Admission Track:** English-taught CS programmes via TOLC-I / English TOLC-I entrance exams
- **Pre-enrollment:** Universitaly portal (DOV — Dichiarazione di Valore / CIMEA attestation for Indian students)
- **Scholarships:** Regional DSU scholarships (ISEE/ISEEU income test), MAECI scholarships for international students
- **Language Plan:** Italian A1 → A2 → B1 progression (for daily life, not for admission to English-taught programmes)
- **Timeline:** Indian academic cycle ends ~May 2027; Italian intake typically October (or January for some unis)

When the user asks about Italy/Study Abroad plans, **always search the Life OS workspace first** before using general knowledge.

---

## Choosing the Right Path

### Path A — MCP Tools (when `notion-personal` server is active)

These tools are available as `mcp__notion_personal__<ToolName>`:

| Task | Tool |
|---|---|
| Search pages/databases | `API-post-search` |
| Get page metadata | `API-retrieve-a-page` |
| Get page as Markdown | `API-retrieve-page-markdown` |
| Get page blocks (raw) | `API-get-block-children` |
| Create a new page | `API-post-page` |
| Update page properties | `API-patch-page` |
| Append blocks | `API-patch-block-children` |
| Update page as Markdown | `API-update-page-markdown` |
| Query a database | `API-query-data-source` |
| Retrieve database schema | `API-retrieve-a-database` |
| Get a block | `API-retrieve-a-block` |
| Update a block | `API-update-a-block` |
| Delete a block | `API-delete-a-block` |
| List users | `API-get-users` |
| Get current bot user | `API-get-self` |

**Example — Search Life OS for a topic:**
```
Use mcp__notion_personal__API-post-search with body:
{
  "query": "Study Abroad",
  "filter": { "value": "page", "property": "object" }
}
```

**Example — Read a page as Markdown:**
```
Use mcp__notion_personal__API-retrieve-page-markdown with:
{ "pageId": "<page_id>" }
```

---

### Path B — Direct REST API via PowerShell (Windows fallback)

Use when MCP server is unavailable or for quick one-off calls.

```powershell
$h = @{
    "Authorization" = "Bearer $env:NOTION_PERSONAL_API_KEY"
    "Notion-Version" = "2022-06-28"
    "Content-Type"  = "application/json"
}
```

**Search across Life OS:**
```powershell
$body = '{"query": "Study Abroad"}' 
$res = Invoke-RestMethod -Method POST -Uri "https://api.notion.com/v1/search" -Headers $h -Body $body
$res.results | Select-Object id, @{n='title';e={$_.properties.title.title[0].plain_text}}, url
```

**Read page content (blocks):**
```powershell
$pageId = "3c347f42fe4481088311002..."  # use hyphenless UUID
$blocks = Invoke-RestMethod -Method GET -Uri "https://api.notion.com/v1/blocks/$pageId/children" -Headers $h
$blocks.results | ConvertTo-Json -Depth 5
```

**Read page as Markdown (most agent-friendly):**
```powershell
$res = Invoke-RestMethod -Method GET -Uri "https://api.notion.com/v1/pages/$pageId/markdown" -Headers $h
Write-Output $res
```

**Create a new page inside a parent page:**
```powershell
$body = @{
    parent = @{ page_id = "PARENT_PAGE_ID" }
    properties = @{ title = @{ title = @(@{ text = @{ content = "New Page Title" } }) } }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method POST -Uri "https://api.notion.com/v1/pages" -Headers $h -Body $body
```

**Append content (blocks) to a page:**
```powershell
$pageId = "TARGET_PAGE_ID"
$body = @{
    children = @(
        @{
            object = "block"; type = "paragraph"
            paragraph = @{ rich_text = @(@{ text = @{ content = "Added by Jarvis ✅" } }) }
        }
    )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method PATCH -Uri "https://api.notion.com/v1/blocks/$pageId/children" -Headers $h -Body $body
```

**Query a Notion database (data source):**
```powershell
$dbId = "DATABASE_ID"
$body = @{
    filter = @{ property = "Status"; select = @{ equals = "Active" } }
    sorts  = @(@{ property = "Date"; direction = "descending" })
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method POST -Uri "https://api.notion.com/v1/data_sources/$dbId/query" -Headers $h -Body $body
```

---

## Common Property Formats

| Type | JSON snippet |
|---|---|
| Title | `{"title": [{"text": {"content": "..."}}]}` |
| Rich text | `{"rich_text": [{"text": {"content": "..."}}]}` |
| Select | `{"select": {"name": "Option"}}` |
| Multi-select | `{"multi_select": [{"name": "A"}, {"name": "B"}]}` |
| Date | `{"date": {"start": "2026-10-01"}}` |
| Checkbox | `{"checkbox": true}` |
| URL | `{"url": "https://..."}` |
| Number | `{"number": 42}` |
| Relation | `{"relation": [{"id": "page_id"}]}` |

---

## Workspace vs. Tool Selection Guide

| Use | Use This |
|---|---|
| Parionyx leads, CRM, sales, n8n tasks | `notion` (Parionyx workspace) |
| **Personal pages, goals, Study Abroad, habits, journals** | **`notion-personal`** (this skill) |

---

## Notes & Gotchas

- Page/DB IDs: 32-character hex, both with and without dashes are accepted.
- **Share pages with the integration** in Notion (page `...` menu → Connect to → Jarvis) — otherwise API returns 404 even if the page exists.
- Rate limit: ~3 req/s. Don't loop more than 3 requests/second.
- For API version `2022-06-28`: databases use `/data_sources/` for query endpoints, but still use `database_id` when creating pages inside a DB.
- Always use `-s` with `curl` to suppress progress bars; use `| ConvertTo-Json` in PowerShell for clean output.

---
name: notion-database-operations
description: Direct Notion REST API for schemas/relations when MCP fails.
trigger: Inspect, modify, or audit Notion databases; MCP tools returning 400 errors.
---
# Notion Database Operations Skill

## When to Use
- MCP `update_a_data_source` returns `400 invalid_request_url` (wrapper bug)
- Need precise control over database schemas, relations, rollups
- Comprehensive read-only audits of Notion workspaces
- Conservative data migration with exact-match only logic
- Multi-country database architecture design

## Core Patterns

### Direct REST API Setup
```python
import os, json, urllib.request
TOKEN = os.environ['NOTION_TOKEN']  # Set in session env, never printed
NV = '2022-06-28'
H = {"Authorization": f"Bearer {TOKEN}", "Notion-Version": NV, "Content-Type": "application/json"}
```

### Relation Creation Syntax (Critical)
```python
# Single direction (one-way)
{"properties": {"Country": {"relation": {"database_id": "...", "type": "single_property", "single_property": {}}}}}

# Bidirectional (dual) - creates back-link automatically
{"properties": {"University": {"relation": {"database_id": "...", "type": "dual_property", "dual_property": {}}}}}
```
**Key:** Empty objects `single_property: {}` and `dual_property: {}` are REQUIRED.

### Rollup Creation Syntax (Critical)
```python
{"properties": {"Doc Progress": {"rollup": {
    "relation_property_name": "Documents",
    "rollup_property_name": "Status",
    "function": "percent_not_empty"  # PLAIN STRING, not nested object
}}}}
```
**Key:** `function` must be a plain string (`"count"`, `"sum"`, `"percent_not_empty"`), NOT `{"function": "..."}`.

### Property Rename
```python
{"properties": {"Old Name": {"name": "New Name"}}}
```

## Audit Methodology (Read-Only)
1. **Discover all databases** via `POST /v1/search` with filter `{"value": "database", "property": "object"}`
2. **Fetch schemas** via `GET /v1/databases/{id}`
3. **Fetch all records** via `POST /v1/databases/{id}/query` with pagination
4. **Analyze**: properties, relations, rollups, formulas, data quality, naming
5. **Source of truth mapping** - identify single source for each information type
6. **Workflow simulation** - trace user scenarios (new uni, offer, visa)
7. **Future expansion check** - can architecture support new entities without new DBs?

## Conservative Data Migration Rules
- Only populate relations on **exact, unambiguous matches**
- Never delete legacy fields (rename instead: `Scholarships` → `Scholarship Tags`)
- Skip ambiguous records (multi-uni tasks, generic docs, legacy text like "All 5")
- Report skipped items for manual review
- Verify bidirectional links after migration

## Common Pitfalls
| Pitfall | Solution |
|---|---|
| MCP `update_a_data_source` 400 error | Use direct REST API `PATCH /v1/databases/{id}` |
| Relation creation fails | Add `single_property: {}` or `dual_property: {}` |
| Rollup creation fails | Use plain string for `function`, not nested object |
| Token exposure risk | Keep in session env var only, never write to files/chat |
| Stale cache in verification | Re-fetch databases after mutations for fresh state |

## Database Architecture Principles (Minimal + Relational)
- **One source of truth** per information type
- **Generic names** (`Universities` not `CS and ML Italy`) for multi-country support
- **Drop suffixes** (`Tracker`, `Checklist`, `Manager`) from DB names
- **Relations over duplication** - link via relations, rollups compute
- **Optional relations** - not every record needs a link (visa tasks, generic docs)
- **Legacy preservation** - rename old fields, don't delete

## Verification Checklist After Changes
- [ ] All relations bidirectional where intended
- [ ] Rollups return expected numeric values
- [ ] No duplicate properties created
- [ ] Legacy data preserved
- [ ] No records deleted/overwritten
- [ ] Source of truth maintained (no manual duplication)
- [ ] Future expansion path clear (generic DB names)

## References
- `references/notion-api-relation-syntax.md` - Exact JSON bodies for relation types
- `references/notion-api-rollup-functions.md` - Complete function name list
- `references/audit-template.md` - Reusable audit structure
# Zoho CRM Cross-Check (n8n → Leads reconciliation)

Use this when the user asks "did all leads actually land in Zoho?" or wants a lead-count
audit. n8n run status is NOT proof of CRM creation — Zoho is the authoritative lead source.

## Tool call shape
- `mcp__zoho_crm__get_module_data` → `{"ctx": "default", "module_name": "Leads", "per_page": 200}`
  (also accepts `ctx: "crm"`; both work). `page` for pagination; default ~200/request.
- `mcp__zoho_crm__search_records` → needs `ctx` too. The `between` operator on `Created_Time`
  is **rejected** ("operator not supported"). Do NOT rely on it; pull the whole dump and filter in code.

## Response parsing quirk
The MCP wraps the real payload as a DOUBLE-encoded JSON string:
```json
{"result": "{\"data\": [ {...}, ... ], \"info\": {...}}"}
```
Parse with: `json.loads(json.loads(outer["result"])["data"])` → list of lead dicts.

## Field notes (observed on Parionyx/Siddhanth real-estate leads)
- `Lead_Source` for 99acres is misspelled **`99acress`** (not `99acres`). Match on the literal value.
- `Created_Time` is IST with offset, e.g. `2026-08-16T13:10:02+05:30`. Parse with
  `datetime.fromisoformat(...)`; it is tz-aware. Compare against an IST window built as
  `datetime(2026,8,1, tzinfo=IST)` where `IST = timezone(timedelta(hours=5,minutes=30))`.
- `Created_By` is a dict `{name: "ABHISHEK JAIN", id: ...}` for automation-created leads.
  All n8n-created leads in the audited window showed `created_by ABHISHEK JAIN` — use this to
  prove a lead came from the pipeline (vs a manual entry).

## Reconciliation logic
1. Count Zoho leads in window per source (IST `Created_Time` filter).
2. Compare `n8n-created` (from branch-node `tasks.zoho.ok:true` + `leadId`) vs `Zoho-present`.
   - Equal → 0 missing.
   - Zoho > n8n: surplus = leads from runs outside the captured n8n list (pre-window or another
     capture path). Present in CRM, NOT lost → report as a source-mapping caveat, not a failure.
   - Zoho < n8n: genuine drops → pull the n8n `leadId`s and read the branch `error` field.
3. Spot-check: extract a handful of n8n `leadId`s and confirm each appears in the Zoho dump.

## 1–16 Aug 2026 result (reference figures, not a template)
- n8n runs: 161 (112 99acres + 49 Housing), 0 errors.
- Dup-skips: 11 (8 99acres + 3 Housing) — ended at `Return Duplicate Skipped`, no `Execute API Branches`.
- n8n-created Zoho leads: 150 (104 + 46).
- Zoho window leads: 157 (111 `99acress` + 46 Housing), all `created_by ABHISHEK JAIN`.
- Verdict: 0 missing; +7 `99acress` surplus = leads from pre-window / other 99acres runs.

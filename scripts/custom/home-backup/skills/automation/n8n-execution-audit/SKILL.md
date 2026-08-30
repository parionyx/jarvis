---
name: n8n-execution-audit
description: Audit n8n runs for hidden branch failures and dropped leads.
category: automation
version: 1
author: jarvis
license: mit
metadata:
  hermes:
    tags: [n8n, automation, lead-pipeline, forensics, monitoring]
    related_skills: [ads-performance-reporting, hermes-cron-ops]
---

# n8n Execution Audit & Failure Forensics

## When to use
- "n8n workflow ki executions nikal, error aaye h kya"
- "kitni leads fail hui" / "did any leads fail"
- Any ask to assess n8n workflow health, error rate, or whether leads silently dropped.
Triggers on workflowId references from the `n8n-mcp` server (tools: `mcp__n8n_mcp__search_executions`, `mcp__n8n_mcp__get_execution`).

## Core pitfall (read first)
**n8n marks a run `status: success` even when individual branches fail.** Fan-out workflows (webhook → clean/validate → call Zoho + AiSensy + Google Sheets + Team WA) usually catch branch errors and continue. So the workflow-level status is GREEN while a Zoho call returned 400 or an AiSensy send failed. A `search_executions` result of "all success" is NOT proof of zero failures.

The real per-lead success signal lives inside a node's *output JSON* — you must open executions and inspect the branch results.

## Technique
1. **List executions** for the workflow:
   `mcp__n8n_mcp__search_executions` with `workflowId`, `limit: 200` (max — the API errors on `limit>200`, so never exceed 200; rely on `count`+`estimated:false`). Note `count` and whether `estimated: false` (complete) vs `true` (truncated — paginate with `lastId`).
   **⏱ IST/UTC window trap:** the `startedAfter`/`startedBefore` params are **UTC**. If the user gives an IST calendar window (e.g. "1 Aug to 16 Aug"), a literal `startedAfter: 2026-08-01T00:00:00.000Z` actually starts at **Aug 1 05:30 IST** and silently drops the 00:00–05:30 IST runs. Convert: `IST 2026-08-01 00:00` = `UTC 2026-07-31T18:30:00Z`. Use `startedAfter` = window-start − 5h30m and `startedBefore` = window-end + 5h30m to guarantee full IST-day coverage, THEN filter Zoho-side by IST `Created_Time`. After the re-pull, verify the earliest returned run is ≤ the IST window start; if runs exist before your window, your bounds were too tight.
2. **Learn the branch-result node name.** Open ONE full run (`get_execution`, `includeData: true`) and find the node that fans out to external APIs. In the Parionyx lead workflows it is named **"Execute API Branches"**, but names vary — confirm before bulk-fetching.
3. **Bulk-inspect only that node.** `get_execution` with `includeData: true`, `nodeNames: ["<branches node>"]`, `truncateData: 1` (keeps payloads tiny). Batch many calls in parallel — they are independent.
4. **Read the success flag.** The node output carries a per-lead result, e.g.:
   ```json
   "tasks": {
     "aisensy": {"ok": true, "msgId": "..."},
     "team":   {"ok": true, "sent": 3, "total": 3, "error": null},
     "zoho":   {"ok": true, "operation": "created", "leadId": "...", "error": null}
   },
   "allOk": true
   ```
   A lead is **fully processed** only if `allOk: true`. Any `*.ok: false` or non-null `error` = that branch failed the lead, even though the run is `success`.
5. **Distinguish silently dropped leads from duplicate skips (node-presence, not duration).** A sub-second run is **NOT automatically a drop**. In the Parionyx/99acres/Housing workflows:
   - **Duplicate skip (expected, not a failure):** run ends at `Return Duplicate Skipped` / `Is Duplicate Lead`, has `duplicateCount: 1`, and the `Execute API Branches` node **never appears** in `runData`. Duration << 1.5s. This is intentional dedup — count it separately, do NOT treat as a drop.
   - **Created lead:** run has `Execute API Branches` in `runData` with `tasks.zoho.ok: true` + `leadId` present; duration 3–32s.
   - **Silent drop (real failure):** run `status: success` but the branch node output shows `tasks.zoho.ok: false` / non-null `error`, OR the webhook was received yet `Execute API Branches` never ran AND there is no `Return Duplicate Skipped` terminal node. Investigate the raw webhook payload.
   To classify cheaply across many runs: call `get_execution` with `nodeNames: ["Execute API Branches", "Return Duplicate Skipped", "Is Duplicate Lead"]` and inspect which nodes fired — no `Execute API Branches` + `Return Duplicate Skipped` present = dup-skip; no `Execute API Branches` + no dup node = investigate.
   **Lead count ≠ run count.** Total leads = (created in Zoho) + (duplicate skips). Use the Zoho CRM lead list (step 8) as the authoritative lead count, not the n8n run count.
6. **Check the error-handler blind spot.** If the workflow has an `errorWorkflow`, search that workflow's executions. `count: 0` means no global failure alert ever fired — consistent with branch errors being swallowed internally rather than raising a real error.
7. **One execution ≈ one lead** in webhook-triggered flows (a "Mark Lead Processed" DB id increments per run). Use this to convert counts to lead counts — but remember duplicate-skips break the 1:1 mapping (see step 5).

8. **Cross-check against Zoho CRM (authoritative lead truth).** The user's real question is "did every lead land in Zoho?" — n8n run status cannot prove this. Pull Zoho Leads and reconcile:
   - `mcp__zoho_crm__get_module_data` with `ctx: "default"` (or `"crm"`), `module_name: "Leads"`, `per_page: 200`. **The response is double-encoded**: `{"result": "<json-string>"}` — `json.loads` it twice.
   - `search_records` with a `between` criterion on `Created_Time` is **rejected** by Zoho — instead pull the full dump and filter client-side by IST `Created_Time` (parse the `+05:30` offset, compare against the IST window).
   - Reconcile by `Lead_Source` + `Created_Time` + `Created_By.name`. All automation leads show `created_by ABHISHEK JAIN`. Note the source value is misspelled **`99acress`** (not `99acres`) — match on the literal value.
   - Verdict: count Zoho leads in window per source; if `n8n-created == Zoho-present` → 0 missing. If Zoho shows *more* than n8n created, the surplus is usually leads from runs outside your captured n8n list (pre-window or another capture path) — present in CRM, **not lost**; flag as a source-mapping caveat, not a failure. If Zoho shows *fewer*, those are genuine drops → extract their n8n `leadId`s and read the branch `error`. See `references/zoho-crosscheck.md`.

## Reporting format (for the user)
Give: total executions, sampled vs full, branch-failure count, silent-drop count, error-handler fires, and an explicit caveat that workflow-level `success` hides branch failures. Offer a full 100% scan if only a sample was checked.

## Reference files
- `references/lead-workflow-audit-example.md` — real workflow IDs / node names from a prior audit.
- `references/zoho-crosscheck.md` — Zoho MCP reconciliation: double-encoded response, `99acress` typo, IST `Created_Time` filter, surplus-vs-missing verdict logic.
- `references/ist-window.md` — IST⇄UTC date-bound conversion (n8n windows are UTC; shift by ±5h30m).

## Scaling notes
- Sampling 15–25% is fine for a health signal; a full scan (every execution's branch node) is needed for an exact failure count.
- The n8n-mcp tools expose only execution metadata + node data; there is no "list failed branches" API. The forensics above is the only reliable path.

## Pitfalls
- Never trust `search_executions` `status` alone. Always open ≥1 run first to learn the branch-node name and the `allOk` shape.
- `nodeNames` + `truncateData` are essential on large scans — a full `includeData: true` over 100+ runs is enormous. Fetch the branch node only.
- **Sub-second run ≠ drop.** Confirm via node presence (`Execute API Branches` absent + `Return Duplicate Skipped` present = expected dup-skip; absent + no dup node = real drop). Duration alone is misleading.
- **Date windows are UTC.** Shift IST calendar bounds by −5h30m / +5h30m before calling `search_executions`; verify the earliest returned run covers the IST window start.
- **Zoho as ground truth.** n8n run counts and statuses do NOT prove leads landed in CRM. Always pull Zoho and reconcile by source + `Created_Time` (IST) + `created_by`. Handle the double-encoded response and the `99acress` typo.
- **🔒 Redact credentials.** n8n execution payloads embed plaintext Zoho tokens, AI Sensy tokens, and Groq keys in `waitingExecution`. Never echo full execution JSON to the user or logs. Use `nodeNames` filtering so secrets stay out of the fetched slice.
- `limit` on `search_executions` must be ≤ 200; larger values error.
- `search_records` `between` on `Created_Time` is rejected by Zoho — pull the full module dump and filter in code.

# Reference: Parionyx lead-workflow audit (14 Aug 2026)

Real findings from auditing two active lead-routing workflows on `n8n.parionyx.in`.
Use as a concrete worked example of the technique in SKILL.md.

## Workflows audited
| Workflow | ID | Executions (31 Jul–14 Aug) | Notable |
|---|---|---|---|
| 99acres → Zoho CRM + AiSensy | `UcBDsKpwo4YC4cDn` | 119 | all `success` at run level |
| Housing.com → Zoho CRM + AiSensy | `GbKgTPIHF81RsFXP` | 41 | all `success` at run level |
| OneX — Error Handler (Alert Webhook) | `P4Sifq6jRVzDMaB6` | **0** | global error alert never fired |

## Branch-result node
Named **"Execute API Branches"**. Output shape per lead:
```json
{
  "tasks": {
    "aisensy": {"ok": true, "msgId": "..."},
    "team":   {"ok": true, "sent": 3, "total": 3, "error": null},
    "zoho":   {"ok": true, "operation": "created", "leadId": "...", "error": null}
  },
  "allOk": true,
  "leadDate": "14 August 2026", "leadTime": "10:26 AM"
}
```

## Sample result (≈15% of runs inspected)
- 99acres: 15 runs opened → all `allOk: true`.
- Housing: 10 runs opened → all `allOk: true`.
- Branch-level failures detected in sample: **0**.

## Anomalies — silently dropped leads (99acres)
Two runs ended in <0.5s with **empty `runData`** (only "Log Raw Lead Event" ran):
| Execution | Started (UTC) | Duration | Symptom |
|---|---|---|---|
| `67872` | 2026-08-13T11:40:53 | 0.31s | empty runData, no branch node |
| `67858` | 2026-08-13T09:07:10 | 0.36s | empty runData, no branch node |

Normal runs take 4–13s. These received the webhook + logged raw payload but the
"Execute API Branches" node never executed → lead likely dropped (not a duplicate
skip, which ends at "Return Duplicate Skipped"). The raw webhook payload should be
pulled to confirm whether they were duplicates or true drops.

## Contrast: genuine duplicate skip (expected, NOT a failure)
Housing run `67829` (2026-08-13T06:53:36) ended in 0.29s at node
"Return Duplicate Skipped" with empty runData — this is correct dedup behavior,
not a drop.

## Takeaways
- Workflow-level `success` on both flows gave a false "all green" impression.
- The only reliable failure signal was `tasks.allOk` inside "Execute API Branches".
- A global error handler with 0 fires confirms branch errors are swallowed internally.
- For an EXACT failure count, scan 100% of runs (not just the 15% sample done here).

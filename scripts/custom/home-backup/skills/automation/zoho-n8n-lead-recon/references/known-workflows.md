# Known n8n Workflows — Real-Estate Lead Stack

All active unless noted. Confirm current status via `mcp__n8n_mcp__search_workflows` before trusting IDs.

| n8n Workflow Name | ID | Trigger | Role | Count as lead? |
|---|---|---|---|---|
| 99acres → Zoho CRM + AiSensy | `UcBDsKpwo4YC4cDn` | webhook | Clean 99acres lead → fan-out AiSensy Cust / Team WA / Zoho / Google Sheets | **YES** |
| Housing.com → Zoho CRM + AiSensy | `GbKgTPIHF81RsFXP` | webhook | Same for Housing.com | **YES** |
| Lead Action Engine | `3uOweb3mQBZPwRT2` | every 15 min | Polls Calls + Lead Status; routes WhatsApp (call not pickup), status-only, delete+junk backup | NO — operational, not a lead source |
| AiSensy Meta Lead → WhatsApp Notification | `FbR2umGhy1MMr5oC` | webhook | Meta Click-to-WhatsApp lead → internal WA notify | (Meta, separate) |
| OneX — 99acres Lead Webhook | `UPmJgO4wz6QGDfKh` | webhook | Legacy 99acres webhook | legacy |
| OneX — Housing Lead Webhook | `Csdw3APfNfma40dT` | webhook | Legacy Housing webhook | legacy |
| OneX — Email Lead Parser | `Rm8sP5GKCQfMNdsa` | webhook | Email lead parser | legacy |
| OneX — Error Handler (Alert Webhook) | `P4Sifq6jRVzDMaB6` | webhook | Error alert sink | no |
| bdutt notification | `984KYA6bxpXCyFrl` | — | inactive | no |
| OneX — Broadcast Queue Worker | `NrvEMZ0CcjI4xV5z` | — | inactive | no |

## Count rule
Only the two portal workflows (`UcBDsKpwo4YC4cDn`, `GbKgTPIHF81RsFXP`) produce lead records.
Each webhook `success` execution = ~1 Zoho lead. The 15-min "Lead Action Engine" runs ~96×/day
regardless of lead volume — never sum it into lead counts.

## Zoho field notes
- Module: `Leads`. Key fields: `Lead_Source` ("99acress"|"Housing"), `Created_Time` (IST +05:30),
  `Full_Name`, `Phone`, `Email` (masked `<phone>@99acres.com`), `Company` (property query string),
  `Owner` (dict w/ name), `Lead_Status`.
- `get_module_data` returns max 200 most-recent records; large responses spill to a file.

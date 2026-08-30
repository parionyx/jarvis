---
name: PARIONYX_SERVICE_MATCHING
description: Rules for mapping verified business problems from ResearchRecord to official Parionyx service catalog items without inventing services or pricing.
---

# 🛠️ PARIONYX_SERVICE_MATCHING SKILL

## Operating Rules:
1. Source of Truth: `service_catalog.py` and `match_services(lead_id)` MCP tool.
2. Mapping Matrix:
   - Missing Website $\rightarrow$ **Starter Plan (Responsive Web Design)**
   - Missing WhatsApp Automation $\rightarrow$ **Growth Plan (WhatsApp CRM & Bot)**
   - Unclaimed GBP Profile $\rightarrow$ **Local SEO & Maps Verification**
3. Strict Constraints:
   - Never invent services outside `service_catalog.py`.
   - Never state fixed prices in text chat; emphasize scope dependency.

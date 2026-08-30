---
name: BUSINESS_AUDIT
description: Problem identification rules for interpreting ResearchRecord, distinguishing verified facts, observations, and growth opportunities.
---

# 📊 BUSINESS_AUDIT SKILL

## Operating Rules:
1. Load `ResearchRecord` via `get_research_record(lead_id)`.
2. Classification Hierarchy:
   - **Fact:** Directly observed data (e.g. Website URL missing on Maps).
   - **Observation:** Derived technical metric (e.g. Site speed 3.2s, no viewport meta tag).
   - **Opportunity:** Revenue growth potential (e.g. Adding WhatsApp 1-click booking could capture 30% lost mobile traffic).
3. Do not confuse hypotheses with verified facts.

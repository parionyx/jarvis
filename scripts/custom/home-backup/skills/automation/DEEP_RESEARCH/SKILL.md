---
name: DEEP_RESEARCH
description: Business deep research workflow, evidence classification, website/social/GBP inspection, ResearchRecord creation, and zero-hallucination policy.
---

# 🔍 DEEP_RESEARCH SKILL

## Operating Rules:
1. Trigger: Call `research_lead(lead_id)` MCP tool before initiating outreach.
2. Evidence Grounding: Inspect website health, SSL, WhatsApp CTA, Google rating, review count, GBP claim status, and social presence.
3. Persistence: Save complete findings in `ResearchRecordStore` via `research_record.py`.
4. Zero Fabrication: If a website or review count is missing, state it as an observed fact. Never invent metrics or false claims.

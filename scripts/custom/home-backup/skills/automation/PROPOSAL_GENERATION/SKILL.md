---
name: PROPOSAL_GENERATION
description: Rules for generating 1-Page PDF Diagnostic Proposals using proposal_generator.py and ResearchRecord data.
---

# 📄 PROPOSAL_GENERATION SKILL

## Operating Rules:
1. Tool: Call `generate_proposal(lead_id)` MCP tool.
2. Layout Requirements: Exactly 1 A4 page, zero prices shown upfront, clean single-column geometry.
3. Content Structure:
   - Client Digital Presence Audit
   - Key Observations & Technical Gaps
   - Recommended Growth Solution & Implementation Roadmap
4. Output: Returns PDF file path for WhatsApp or Email dispatch.

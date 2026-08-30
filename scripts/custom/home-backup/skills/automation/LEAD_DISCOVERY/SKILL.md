---
name: LEAD_DISCOVERY
description: Lead discovery workflow rules, target 20-30 leads/day, multi-Apify routing, deduplication, qualification, and queue insertion.
---

# 🎯 LEAD_DISCOVERY SKILL

## Operating Rules:
1. Target: 20–30 high-fit verified local business leads per day in Gurgaon.
2. Planner: Use `weekly_planner.py` to get today's target niche and sector.
3. Execution: Call `discover_leads(search_term, location, max_results)` MCP tool.
4. Failover: System automatically uses multi-Apify token pool and fallback web extraction.
5. Deduplication: Check `already_exists(phone)` and `is_suppressed(phone)`.
6. Queueing: Push valid leads to `research_queue.py` for automated background processing.

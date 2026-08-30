---
name: gurgaon-weather-check
description: Use on Gurgaon/India weather. Cross-check MCP with news.
version: 1.0
author: jarvis
license: mit
metadata:
  hermes:
    tags: [weather, gurgaon, india, monsoon, news-verify]
    related_skills: [hunter-v2-workflow]
---

# Gurgaon / India Weather Check

## When to Use
- Abhishek asks ANY Gurgaon / NCR / Haryana / India weather question: "aaj mausam kaisa hai", "barish aayegi?", "weather kaisa hai".
- Commute / travel / WFH planning that depends on weather.
- Any "is it raining / will it rain" check during Jun–Sep monsoon.
- Do NOT use for non-India locations where Open-Meteo alerts work (US/Canada/EU).

Use when Abhishek asks about Gurgaon, NCR, Haryana, or India weather.

## Why this skill exists
On 2026-08-24 the weather MCP (`@dangahagan/weather-mcp`, Open-Meteo source) reported Gurgaon as
"Mainly clear, 33°C, 58% humidity" — but heavy rain + waterlogging actually hit Gurgaon that day
(IMD red alert for Delhi; orange/yellow for Gurugram; HT reported ~115mm rainfall choked the city).
Open-Meteo is model-interpolated, not station observations, and routinely misses Indian convective
monsoon downpours. For India, live news is the authoritative ground truth.

## Procedure (always all steps)
1. Baseline from weather MCP — get_current_conditions + get_forecast for Gurgaon (lat 28.4595, lon 77.0266).
   If weather MCP is NOT in the live tool registry this session ("not a deferrable tool"), run the bridge:
   `node C:/jarvis/weather_mcp_bridge.js 28.4595 77.0266 all`
   (drives cached entry point via NDJSON stdio; do NOT use npx.cmd, it breaks stdio piping).
   To get weather MCP as a native callable tool, restart Hermes so MCP tools re-inject.
2. MANDATORY live-news cross-check (parallel) — tavily + exa + web_search for:
   "Gurgaon rain today", "Gurugram heavy rainfall <today's date>", "IMD alert Gurugram Delhi NCR",
   "Delhi NCR waterlogging traffic". Prefer IMD, Times of India, Hindustan Times, India.com, newsdrum.
3. Reconcile — for India treat news ground truth (actual rainfall mm, IMD alert level, waterlogging,
   traffic) as AUTHORITATIVE; weather MCP model data is secondary. If they conflict, report the news
   and note the MCP discrepancy.
4. Report — current condition, temp (°C + °F), actual rainfall if reported, IMD alert level,
   waterlogging/traffic impact, 7-day trend. Cite a source URL for every claim.
5. Commute/travel flag — warn about recurring flood hotspots per HT/TOI: Medanta underpass (NH-48),
   Sohna Road, Golf Course Road, Narsinghpur (NH-48), Rajiv Chowk underpass, Sector 10/14/15, Old Delhi Road.
   WFH advisories are common during heavy spells.

## Pitfalls
- get_alerts returns "alerts not yet available for India" — never rely on it; get IMD alerts from news.
- Open-Meteo "mainly clear / partly cloudy" in Jun–Sep does NOT mean no rain. Always cross-check news.
- MCP may fail to inject into session tool registry (observed 2026-08-24); bridge script is reliable fallback.
- Before answering, confirm >=1 dated-today news result. If none, say so and fall back to MCP with uncertainty note.

## Verification
- Answer cites >=1 live news source dated today (or states none found).
- State MCP-vs-news reconciliation explicitly when they differ.

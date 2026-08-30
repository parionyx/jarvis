---
name: rera-project-research
description: Use for researching Indian RERA real-estate projects.
---

# RERA Real-Estate Project Research

Recurring workflow: Abhishek researches Gurgaon/NCR projects (e.g. Anantraj Sector 63A) to arm broker clients with official-source-verified intelligence. Deliverable chain: deep report → client pitch sheet → shareable HTML/PDF dossier → downloaded photos/plans → reconfirm on doubt.

## Source Hierarchy (STRICT)
1. **PRIMARY — Exchange filings**: NSE/BSE Reg-30 disclosures. Found via `web_search` on company name + event keywords; `nsearchives.nseindia.com/corporate/*.pdf` and `bseindia.com/xml-data/corpfiling/AttachLive/*.pdf` URLs surface directly in search results with full letter text extractable. These confirm launch dates, RERA reg numbers, built-up area, segment, target markets.
2. **PRIMARY — State RERA portal**: Full Form REP-I (Part A–H) is machine-extractable — see `references/haryana-rera-portal.md` for exact URL patterns and field map. Contains land area, license no., FAR, project cost breakdown, quarterly construction plan, unit carpet-area mix, promoter contacts, hearing proceedings.
3. **SECONDARY — Developer official site**: marketing specs, gallery images (scrape `<img>`/upload paths with curl).
4. **TERTIARY — Channel Partner (CP) sites**: pricing hints (EOI amounts, BSP estimates) — ALWAYS label as unverified. CP sites frequently display STALE or WRONG RERA numbers (copied from earlier phases of same township) — never quote a RERA number without checking tier 1/2.

## Workflow
1. Identify candidate project name from market chatter → verify existence via exchange filing search FIRST (cheapest authoritative confirmation).
2. Pull RERA record: parse the registration ID (`RERA-<AUTH>-<No>-<Year>` → portal search fields Authority/Project No/Year). Get `project_preview_open/<id>` for full Form A–H.
3. Cross-check every marketing claim against filings; build a discrepancy table (e.g. tower counts, unit counts, config mix, possession dates). Flag each as ✅ verified / ⚠️ unverified / ❌ contradicts filing.
4. Download media: hero/gallery images from developer uploads, master plan, DTCP layout plan. Convert `.webp`→`.jpg` with PIL (some downloads corrupt → catch UnidentifiedImageError, delete, continue).
5. Produce broker-ready dossier: dark-theme HTML artifact written in ~4KB chunks (`chunk1.html`… then `cat` into final file — single large write_file calls time out mid-stream), embed local photos by relative path, open via open_preview. Include: metric cards, unit-mix table, financials, construction phasing, diligence flags, micro-market rate comparison, contacts, source-tier footer.
6. Reconfirm anything doubtful against primary sources before final delivery; cite official URLs inline (user cross-checks everything himself).

## Pitfalls
- Possession date in marketing ≠ RERA-filed completion deadline — always quote the filed date and note buffer separately.
- Unit totals differ between marketing (main apartments only) and RERA DPI (includes servant quarters/service units) — reconcile before quoting "total units".
- Land area may be under amendment (hearing notes record parcel inclusions) — quote filed area plus pending-change note.
- Never present CP pricing as official; mark every estimate with * and source tier.

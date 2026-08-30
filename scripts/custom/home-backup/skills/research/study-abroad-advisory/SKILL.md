---
name: study-abroad-advisory
description: Use when evaluating study abroad, scholarships, or visas.
---

# Study Abroad Advisory & Scholarship Evaluation

Guide for evaluating international education options, scholarships, visa financial requirements, and post-study career pipelines for students (especially low-budget / fully-funded applicants).

## Core Principles

1. **Separate Embassy Visa Financial Rules from Scholarship Awards:**
   - A scholarship award is an institutional grant. An embassy visa approval requires independent proof of financial means as defined by the host nation's consulate checklist (e.g., Italian Consulate €10,179.85/yr proof).
   - Never claim a scholarship automatically guarantees visa issuance without verifying the consulate's explicit proof-of-funds policy.

2. **Differentiate Direct Award Letters vs Post-Arrival Regional Grants:**
   - **Type A (Direct Award Letter = Visa Proof):** Scholarships like Türkiye Bursları or Stipendium Hungaricum (Hungary) issue official award letters that consulates accept as 100% proof of funds with zero personal bank balance required.
   - **Type B (Post-Arrival Regional Grants):** Regional grants like Italy's DSU / ER.GO are awarded or disbursed AFTER arrival in the host country (Sept–Nov). Consulates require pre-arrival proof of funds (bank statements, loan sanction letters, sponsor accounts).

3. **Evaluate Full Lifecycle Pipeline:**
   - Do not evaluate destinations solely on tuition cost or initial departure budget.
   - Assess: **Admission → Scholarship Probability → Embassy Visa Financial Proof → Post-Study Work Permit → Tech/Industry Job Market → PR / Long-term Residency**.

4. **Verify Official Consulate Checklists:**
   - Always verify annual consulate living expense thresholds, ISEE/ISPE income ceilings, and document legalisation/apostille requirements before making claims.

## Working Rules (enforced by user feedback, 2026 session)

- **Official-source-only, zero assumption:** Every factual claim (deadlines, amounts, eligibility, language of instruction, visa proof) MUST be pulled from the official body's site — government scholarship portal, regional DSU body, university course page (with codice), or consulate PDF. Never generalise from memory or from another country's rule. If a source was not checked, state 'not yet verified' — do NOT fill the gap with an assumption.
- **Simple, legible output:** User asked for 'easy way me samjha' / 'kuch samjh nhi aaya'. Default to short Hinglish prose + compact tables. One row per item with a status column (✅ open / ❌ closed / ❓ verify). Avoid walls of text.
- **Separate the three dates before advising a route:** (1) scholarship **application deadline** (e.g. ER.GO 24 Aug), (2) **result/ranking** date (e.g. Nov), (3) **visa deadline** (e.g. 30 Nov). Map all three on a timeline. The 'scholarship-first vs visa-first' decision depends entirely on these.
- **Verify language of instruction per course:** A degree title is NOT proof of language. Open the specific university course page (codice) and confirm 'Teaching Language'. Example from 2026: Bologna CS (6640) and Modena CS are Italian-only; Pisa CS (L-31) is fully English (free access); Torino Computer Engineering has an English pathway (needs TIL test + B2 cert).

## Tool path for web research (enforced by user correction, 2026-08-19)
- **Web research = web-scraping MCP, NOT desktop GUI.** User explicitly said: "Computer use nhi krna sirf web scrabing mcp use krni h" and "official orginal sourse se details fetch kia kr". Do NOT drive Chrome via `computer_use` for research/fetch tasks. Use the available web MCP and cite the official `.gov`/scholarship-portal source.
- **Firecrawl (`web_search`/`web_extract`) is often unconfigured** (no API key/credits → "Web tools are not configured"). When it fails, fall back to **Tavily MCP** (available in this profile):
  - `mcp__tavily__tavily_search` with `include_domains:["<official-site>"]` returns exact official factsheet text fragments — best for official-source pulls. Works even on JS SPAs (Stipendium Hungaricum, OIF Hungarian pages) where `tavily_extract` returns blank/poor data.
  - `mcp__tavily__tavily_research` requires a PAID API key (keyless supports Search + Extract only) — do not rely on it.
  - `mcp__tavily__tavily_extract` works for static HTML pages; poor on SPAs.
- **Exa MCP (`mcp__exa__web_search_exa`)** is referenced in older notes but is NOT configured in this profile. Do not assume an MCP exists — run `tool_search` to confirm available web tools before relying on a named server.
- `browser_exec` can still load primary `.gov` pages but the user prefers MCP scraping; reserve `browser_exec` only when the MCP cannot reach a needed page.

## Italy DSU — Regional Structure (critical structural fact)

- Italy has NO single national merit scholarship. 'Diritto allo Studio Universitario' (DSU) is run by **20 regional bodies**, each with its own bando, deadlines, ISEE/ISPE thresholds, and university coverage.
- ANDISU (national association) covers ~95% of bodies; MUR open-data confirms all 20 regions operate DSU.
- Means-tested via **ISEE Parificato** (foreign income translated + verified by Italian CAF). Low family income required — NOT automatically granted.
- Housing (free hostel) is capacity-based, not guaranteed. Cash grant is the core benefit.
- Verified 2026/27 bodies + windows (details in references/italy-2026-verified.md):
  - Emilia-Romagna → **ER.GO** (er-go.it), window 23 Jun–24 Aug 2026
  - Piemonte → **EDISU Piemonte** (edisu.piemonte.it), 22 Jul–04 Sep 2026
  - Toscana → **ARDSU Toscana** (dsu.toscana.it), 20 Jul–07 Sep 2026
  - Lazio → **Lazio DiSCo** (laziodisco.it), closed 22 Jul 2026
- For a low-budget Indian CS applicant wanting English-taught Bachelor's + scholarship-first route: **Pisa (ARDSU)** is the strongest 2026 fit (CS fully English, free access, enroll by 30 Sep, scholarship open to 7 Sep). Bologna/Modena CS are Italian-only → rejected for the English requirement.

## Italy English-taught CS/AI Bachelor's 2027 — Verified Shortlist

For a low-budget Indian applicant (Hindi-medium 12th, low income), only **5 public universities** offer viable English-taught CS/AI Bachelor's. Full verified table, DSU bodies per city, and the visa-IELTS insight are in `references/italy-english-cs-bachelor-2027.md`.

- **Ca' Foscari Venice** = OPEN ACCESS, **no entrance test** (easiest entry).
- **Pavia** = SAT ≥979 (no IELTS for admission); EDiSU Pavia max band €8,274/yr.
- **Sapienza** = SAT or TOLC-I; **Trento** = English TOLC-I; **PoliMi** = TOLC-I + IELTS 5.0 (backup).
- **REJECTED (Italian-only bachelor's):** Bologna, Pisa, Padova, Torino, PoliTo, Milano Statale, Bozen-Bolzano.
- **Hindi-medium 12th → IELTS compulsory for the student visa** even where admission needs no English cert. English-medium applicants (MOI) avoid this at most Italian unis.

## English-Speaking PR-Track Evaluation (Canada / Switzerland / Singapore / UK, 2026)

For users who explicitly require an **English-speaking** destination with a realistic **PR/settlement** path and a **low-income** budget:

- **Canada = preferred anchor.** Spouse of a full-time student gets an open work permit (both can work); Post-Graduation Work Permit (PGWP) up to 3 yrs; PR via Canadian Experience Class (Express Entry). The higher-degree partner (master's) should be the visa anchor to bring the other as a dependant. *(Prior knowledge — verify current figures on canada.ca; the Canada page 404'd mid-session.)*
- **Switzerland = reject for this profile.** (1) Not English-speaking (official DE/FR/IT/RM). (2) Swiss Government Excellence Scholarships are for those who *already hold a Master's* (early-career researchers, max age 35) — no bachelor's / fresh-grad coverage *(VERIFIED sbfi.admin.ch, 2026-08-19)*. (3) Settlement Permit C needs ~10 yrs residence + language — very slow. (4) Cost of living among world's highest.
- **UK = weak for 'study together + PR'.** Student-visa dependant allowed ONLY for postgraduate (RQF 7+) courses of 9+ months or government-sponsored students; a bachelor's (RQF 6) does NOT permit a dependant partner *(VERIFIED gov.uk, 2026-08-19)*.
- **Singapore = English ✓ but PR uncertain.** ICA PR is discretionary (EP/S-Pass holder, or student who passed a national exam; a student pass generally does NOT sponsor a spouse). MOE Tuition Grant cuts undergrad fees but carries a ~3-yr bond *(ICA eligibility VERIFIED ica.gov.sg, 2026-08-19; TG bond detail = prior knowledge)*.
- **Hungary = non-English but FULLY-FUNDED master's/bachelor's via Stipendium Hungaricum (Type A, India eligible).** Spouse-reunification BLOCKED during study (see rule below); PR needs ~5 yrs legal residence or EU Blue Card 2 yrs. 2026/27 deadline (15 Jan 2026) already passed — next intake 2027/28 (apply ~Nov 2026–Jan 2027). Verified facts in references/hungary-sh-2026-27.md.
- **Budget reality:** ₹1 lakh is seed money, not a visa budget. Proof-of-funds for one student runs roughly Canada ~CAD 20,635 + 1st-yr tuition; Australia ~AUD 24,505 + tuition; UK tuition + £907–1,136/mo ×9. A low-income applicant typically needs an India-built corpus of ₹20–25L before applying *(proof-of-funds figures = prior knowledge — re-verify annually on the official site)*.

## Spouse-during-study structural rule (verified SG + HU, 2026-08-19)
A student / residence-permit-for-studies holder generally CANNOT sponsor a spouse via family reunification DURING the study period. Confirmed officially for:
- **Singapore:** ICA LTVP eligibility lists parent/grandparent of a Student Pass holder — spouse NOT listed.
- **Hungary:** `oif.gov.hu` factsheet (Residence of the student, pupil) + EU Commission: *"A third-country national holding or applying for a residence permit for the purpose of studies shall NOT be granted a residence permit for the purpose of family reunification."* Exception only: child born in Hungary during the permit's validity.
**Reunification path:** the studying partner must first finish studies and obtain a post-grad permit — Hungary: "residence permit for seeking a job or starting a business" (apply in HU ≥15 days before study-permit expiry, job/business matches study level); THEN the spouse can be sponsored. For a couple wanting to be together, prefer BOTH partners applying as independent students (each gets own permit → blocker avoided).
**Canada remains the only English-track studied so far where the spouse gets an open work permit IMMEDIATELY (no study-period delay).**

See `references/english-speaking-pr-2026.md` for the condensed verified fact bank.

## Reference Guides

|- `references/italy-2026-verified.md`: Verified 2026/27 Italy regional DSU bodies (Type B post-arrival grants), deadlines, grant amounts, CS English-taught Bachelor's programs, and consulate proof-of-funds (€10,179.85). Condensed official excerpts — re-verify annually.
|- `references/turkey-hungary-2027.md`: Verified Type-A government scholarships (Türkiye Bursları + Stipendium Hungaricum) — fully-funded, no-IELTS-friendly entry paths for low-budget Indian applicants: UGC 60% cutoff, no passport-at-apply (ID card ok), age limits, and the two-stage Hungary process (Tempus + UGC). — re-verify annually.
|- `references/hungary-sh-2026-27.md`: Condensed verified Stipendium Hungaricum 2026/27 facts (India eligible, provisions HUF amounts, deadline passed, student-permit spouse blockade, post-grad reunification path, PR horizon). Pulled from stipendiumhungaricum.hu + oif.gov.hu + EU Commission, 2026-08-19.
|- `references/italy-english-cs-bachelor-2027.md`: Verified 2027 Italy English-taught CS/AI Bachelor's shortlist (5 viable unis, entrance-test burden, DSU body per city, Hindi-medium→IELTS visa requirement, departure cost). Pulled from official course pages + Bachelorsportal, 2026-08-22.

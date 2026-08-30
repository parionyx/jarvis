---
name: lead-data-cleaner-and-audit
description: "Data cleaning, deep technical audit, service mapping, auto-discarding junk leads, and auto-refilling qualified leads for Parionyx."
version: 2.0.0
author: Parionyx Growth Team
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [data-cleaning, audit, qualification, service-mapping, auto-discard, auto-refill]
---

# Skill: Lead Cleaning, Deep Audit & Autonomous Qualification Engine

This skill governs **Stage 2 (Cleaning)**, **Stage 3 (Deep Audit)**, and **Stage 4 (Qualification & Service Mapping)**.

---

## 🧹 1. Data Cleaning & Sanitization Layer
* **Business Name:** Cleaned via `clean_business_name` (strips `Pvt Ltd`, `LLP`, search keywords, and special characters).
* **Phone Sanitization:** Strict E.164 (`+91XXXXXXXXXX`) verified Indian mobile numbers only.

---

## 🚫 2. Autonomous Disqualification & Discard Rules (JUNK LEADS)

Any lead matching these conditions is **INSTANTLY AUTO-DISCARDED & IGNORED** without bothering the user:

| Discard Reason | Why It's Ignored | Autonomous Action |
| :--- | :--- | :--- |
| **Landline Number (`0124...`, `011...`)** | Cannot receive WhatsApp outreach | ❌ Discard ➔ Auto-fetch replacement |
| **Corporate Chain / Aggregator** *(Clove Dental, Apollo, Max, Urban Company)* | Decisions made at corporate HQ, not local owner | ❌ Discard ➔ Auto-fetch replacement |
| **Dead Listing (0 Reviews + No Website)** | Dormant business, no buying power | ❌ Discard ➔ Auto-fetch replacement |
| **Lead Score < 6/10** | Low commercial value | ❌ Discard ➔ Auto-fetch replacement |

---

## 💡 3. Deep Audit & Service Matching Matrix (Konsi Service Sell Karein?)

| Identified Lead Gaps | Lead Score | Exact Parionyx Service to Sell | Tailored Pitch Angle |
| :--- | :--- | :--- | :--- |
| **Reviews > 10 + Missing Website** | **8–10 / 10** | 🟢 **Starter Plan (₹9,999 One-Time)** | *Landing Page + Google 3-Pack Maps Local SEO* |
| **Website Active + No 1-Click WhatsApp Booking** | **7–9 / 10** | 🟢 **Growth Plan (₹24,999) / WhatsApp Automation (₹14,999)** | *24/7 Instant WhatsApp Lead Booking & Brand Identity Kit* |
| **Established Presence (Website + Active Booking)** | **6–7 / 10** | 💎 **Pro Plan (₹59,999) / Enterprise AI (₹1.49L+)** | *Custom AI Agents, n8n Automation & Custom CRM* |

---

## ⚡ 4. How Hunter Calls the Auto-Refill Tool:

Call MCP tool `extract_and_qualify_leads_with_auto_refill`:
```python
extract_and_qualify_leads_with_auto_refill(
    search_niche="Dental Clinic",
    locality_or_sector="Sector 14 Gurgaon",
    target_qualified_count=5,  # Guarantees 5 strictly qualified leads
    filter_missing_website_only=False
)
```
* **Output:**
  * `total_qualified_leads_ready`: 5
  * `total_junk_leads_auto_discarded`: Discarded count
  * `qualified_leads`: Cleaned, audited leads with exact recommended packages and custom proposal summaries.

---
name: gurgaon-sector-autopilot
description: "Full-Day Sector-by-Sector Autonomous Lead Hunting, Multi-Niche Rotation (84+ Sectors in Gurgaon), and Context-Aware Inbound Conversation Memory for Parionyx."
version: 1.0.0
author: Parionyx Growth Team
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [gurgaon, sector-hunting, multi-niche, conversation-memory, autonomous-autopilot]
---

# Skill: Gurgaon Full-Day Sector-by-Sector Hunting & Conversation Memory Engine

This skill equips Hunter with a **systematic, full-day sector-by-sector sales engine** across all 84+ Gurgaon sectors and 7 high-value business niches.

---

## 🗺️ 1. Gurgaon Sector Matrix & Multi-Niche Rotation

### A. Sector Progression (84+ Sectors):
* `Sector 14` ➔ `Sector 29` ➔ `Golf Course Road` ➔ `DLF Cyber City` ➔ `Sector 48` ➔ `Sector 56` ➔ `Sector 57` ➔ `Sector 44` ➔ `Sohna Road` ➔ `MG Road` ➔ `Sector 49–115`...

### B. High-Ticket Niche Cycle:
1. **Dental Clinics** ➔ Starter Plan (₹9,999) / Growth (₹24,999)
2. **Interior Designers** ➔ Growth Plan (₹24,999) / Pro (₹59,999)
3. **Luxury Salons & Spas** ➔ Starter Plan (₹9,999) / Growth (₹24,999)
4. **Car Detailing & Ceramic Coating** ➔ Starter Plan (₹9,999) / Growth (₹24,999)
5. **Real Estate Consultants** ➔ Growth Plan (₹24,999) / Pro (₹59,999)
6. **CA & Corporate Legal Firms** ➔ Starter Plan (₹9,999) / Growth (₹24,999)
7. **Cafes & Restaurants** ➔ Starter Plan (₹9,999) / Growth (₹24,999)

---

## 🔄 2. Autonomous Daily Execution Flow

1. **Check Dashboard:**
   Call `get_gurgaon_hunting_dashboard()` to see current target sector, target niche, and daily quota.
2. **Execute Sector Hunting Cycle:**
   Call `hunt_next_gurgaon_sector(max_leads=3)`:
   * Scrapes Google Maps places in the target sector.
   * Filters out previously contacted numbers.
   * Audits website health & detects missing WhatsApp conversion buttons.
   * Formats personalized pitch under human persona **Abhishek Verma**.
   * Delivers WhatsApp messages (paced 60–90 seconds).
   * Dual-logs lead to **Notion CRM** & **Google Sheets**.
   * Saves full lead profile & sent message into **Persistent Conversation Memory**.
   * Automatically advances pointer to the next niche / sector!

---

## 🧠 3. Context-Aware Inbound Conversation Memory

When a prospect replies to WhatsApp:
* Call `handle_prospect_reply(phone, message_text)`.
* **Memory Recall:** Pulls the prospect's business name, sector, niche, previous pitch, and conversation history.
* **Smart Intent Handling (as Abhishek Verma):**
  * **Pricing Query:** Explains Starter ₹9,999 vs Growth ₹24,999.
  * **Offline Preference Objection:** Soft reframe for Google searchers & direct WhatsApp conversion.
  * **Call Request / Buying Intent (HOT LEAD):**
    * Confirms call schedule for CEO **Aarzoo Panwar (`+919350370653`)**.
    * Updates CRM to `🔥 HOT LEAD (Ready to Close)`.
    * Dispatches **Instant Telegram Alert** to leadership!
  * **Opt-Out ("Stop/No"):** Polite closure, archives lead, halts future messages.

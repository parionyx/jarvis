---
name: crm-dual-sync
description: "Simultaneous dual-synchronization of B2B leads across Notion CRM Database and Google Sheets CRM Pipeline."
version: 1.0.0
author: Parionyx Growth Team
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [notion, google-sheets, crm, pipeline-management, dual-sync]
---

# Skill: CRM Dual-Synchronization Engine

This skill governs **Stage 5 (CRM Logging)**, **Stage 8 (Pipeline Tracking)**, and **Stage 9 (Hot Lead Stage)** of the Parionyx Sales Engine.

---

## 📊 1. Connected Databases & Live URLs

* **Notion CRM Database (Live Operational Leads):**  
  👉 `https://app.notion.com/p/3c22c1506fb3811da092fa85532d04cc` (Database ID: `3c22c150-6fb3-811d-a092-fa85532d04cc`)
* **Google Sheets CRM (Backup & Reporting Pipeline):**  
  👉 `https://docs.google.com/spreadsheets/d/1vLUYLP7V0CMQi-oykzYd-r6blBC6xm9KHu1XfDwtAus/edit` (Sheet ID: `1vLUYLP7V0CMQi-oykzYd-r6blBC6xm9KHu1XfDwtAus`)

---

## ⚡ 2. How to Log Leads Simultaneously:

Always use the native MCP tool `log_lead_to_crm(...)`:

```python
log_lead_to_crm(
    business_name="Smile Dental Care",
    phone="+919350370653",
    category="Dental / Medical Clinic",
    locality="Sector 14, Gurgaon",
    website_status="Missing Website (Top Target)",
    lead_score=8,
    outreach_status="🔵 Contacted via WhatsApp",
    pitch_angle="Starter Plan Landing Page & Google Maps SEO",
    client_notes="Active listing with 25 reviews, website missing",
    action_owner="Aarzoo Panwar (CEO)"
)
```

---

## 🔄 3. Standard Pipeline Status Progression:

1. `🟡 Scraped / Verified` (Extracted from Google Maps, dedup passed)
2. `🔵 Contacted via WhatsApp` (Outreach message sent)
3. `🟣 Follow-Up Pending` (No reply after 48h, value-add queued)
4. `🔥 HOT LEAD (Ready to Close)` (Prospect interested / call requested)
5. `🟢 Deal Closed / Won` (50% Advance paid, project confirmed)
6. `⚫ Archived / Not Interested` (Opted out or uncontactable)

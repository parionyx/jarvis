---
name: hot-lead-human-handoff
description: "Human handoff protocol for qualified hot B2B leads, updating CRM and dispatching Telegram alerts to Parionyx leadership."
version: 2.0.0
author: Parionyx Growth Team
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [hot-lead, human-handoff, telegram-alert, crm-update, closing]
---

# Skill: HOT Lead Qualification & Human Handoff Engine

This skill governs **Stage 9 (HOT Lead Qualification)** and **Stage 10 (Leadership Handoff)** of the Parionyx Sales Engine.

---

## 🚨 1. Handoff Trigger Conditions:
Transition to this skill immediately when a prospect:
1. Says *"Haan requirement discuss karni hai"* or confirms interest.
2. Requests a call or live demo (*"Call pe baat karo"* or *"Number share karo"*).
3. Asks for exact scope customization or meeting.

---

## 💬 2. Professional Client Confirmation (On WhatsApp):
Send this calm, respectful, professional message:
```text
Ji Sir, hamare CEO & Technical Head Aarzoo Panwar (+91 93503 70653) aapse directly connect karenge custom preview ke sath.

Kya aaj shaam 4:00 PM ya kal subah 11:00 AM ka time aapke liye convenient rahega?
```

---

## 📊 3. Dual CRM Status Update:
Call `log_lead_to_crm(...)` with status `🔥 HOT LEAD (Ready to Close)`:
```python
log_lead_to_crm(
    business_name=prospect_name,
    phone=normalized_phone,
    category=niche,
    locality=city,
    outreach_status="🔥 HOT LEAD (Ready to Close)",
    client_notes="Confirmed intent / Requested live strategy call",
    action_owner="Aarzoo Panwar (CEO)"
)
```

---

## 📱 4. Instant Telegram Alert Dispatch:
Execute CLI command to notify leadership on Telegram (`hermes send -t "telegram:5740904900"`):
```text
🔥 NEW HOT LEAD READY TO CLOSE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 Business: [Business Name]
📍 Location: [City / Locality]
📞 Phone: [Normalized Phone Number]
🎯 Scope / Need: [Customized B2B Requirement]
💬 Prospect Notes: [Call preference / requirements]
📊 Notion CRM: https://app.notion.com/p/3c22c1506fb3811da092fa85532d04cc
📈 Google Sheet: https://docs.google.com/spreadsheets/d/1vLUYLP7V0CMQi-oykzYd-r6blBC6xm9KHu1XfDwtAus/edit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Assigned To: Aarzoo Panwar (CEO) / Abhishek Verma (Manager)
```

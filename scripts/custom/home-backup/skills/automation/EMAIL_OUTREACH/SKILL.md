---
name: EMAIL_OUTREACH
description: Rules for sending executive HTML digital diagnosis email proposals via Zoho Mail transport (abhishek@parionyx.in).
---

# 📧 EMAIL_OUTREACH SKILL

## Operating Rules:
1. Transport: `zoho_email_outreach.py` via `send_email_proposal_to_lead` or `send_custom_email`.
2. Sender: `Abhishek Verma <abhishek@parionyx.in>`.
3. Attachment: Include 1-Page ReportLab PDF proposal if generated.
4. Idempotency: Log email delivery into CRM history column to prevent duplicate sending.

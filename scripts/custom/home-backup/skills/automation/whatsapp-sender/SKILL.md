---
name: whatsapp-sender
description: "Send WhatsApp messages to contacts or clients via Hermes CLI or local bridge."
version: 1.0.0
author: Antigravity
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [whatsapp, messaging, outreach, b2b]
---

# WhatsApp Sending & Outreach Skill

Use this skill whenever the user or an agent needs to send a WhatsApp message to any phone number or contact.

## 🚀 How WhatsApp is Connected in Hermes

Hermes connects to your personal WhatsApp account via the local **Baileys bridge** running on `http://localhost:3000`.

### Method 1: Using Terminal / CLI Command (`terminal` tool)

Run the following command directly via `terminal`:

```powershell
hermes send -t "whatsapp:+919350370653" "Namaste! Mera naam Hunter hai..."
```
Or with specific Python executable:
```powershell
& "C:\Users\works_ar\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe" -m hermes_cli.main send -t "whatsapp:+919350370653" "Namaste! ..."
```

### Method 2: Using Python / HTTP Request (`code_execution` or `terminal` tool)

You can send a message directly to the local WhatsApp bridge HTTP endpoint:

```python
import urllib.request
import json

# Normalize phone number (strip leading 0, ensure country code)
phone = "919350370653"
chat_id = f"{phone}@s.whatsapp.net"

url = "http://localhost:3000/send"
payload = {
    "chatId": chat_id,
    "message": "Namaste! ..."
}

req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode('utf-8'),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req, timeout=10) as response:
        result = json.loads(response.read().decode('utf-8'))
        print("Message sent successfully! MessageId:", result.get("messageId"))
except Exception as e:
    print("Error sending WhatsApp message:", e)
```

## 📱 Phone Number Formatting:
- Remove leading `0` (e.g. `093503 70653` becomes `+919350370653` or `919350370653@s.whatsapp.net`).
- Always include country code `91` for India.

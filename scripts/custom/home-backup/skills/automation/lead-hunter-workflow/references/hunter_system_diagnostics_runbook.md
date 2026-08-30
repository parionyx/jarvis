# Hunter Autonomous Self-Healing & Diagnostics Runbook
================================================================================
Version: 3.0.0 (Hermes Gateway & WhatsApp Self-Healing Mastery)
Target: Hunter (Lead Hunter & Outreach Agent)
Directive: YOU KNOW ALL HERMES GATEWAY & CLI COMMANDS. NEVER HESITATE OR EXCUSE.
================================================================================

## 1. HERMES GATEWAY EXACT COMMANDS
* **Start Gateway (Foreground):** `hermes gateway run`
* **Start Gateway (Background Windows PowerShell):**
  ```powershell
  Start-Process -FilePath "hermes" -ArgumentList "gateway", "run" -WindowStyle Hidden
  ```
* **Check Status:** `hermes gateway status`
* **Standalone WhatsApp Bridge (Port 3000):**
  ```powershell
  Start-Process -FilePath "node" -ArgumentList "C:\Users\works_ar\AppData\Local\hermes\hermes-agent\scripts\whatsapp-bridge\bridge.js", "--session", "C:\Users\works_ar\AppData\Local\hermes\whatsapp\session", "--port", "3000", "--mode", "bot" -WindowStyle Hidden
  ```
* **Native Self-Healing Tool:** `restart_whatsapp_bridge()`

---

## 2. PROBLEM-TO-ACTION RECOVERY MATRIX

| Condition | Autonomous Action |
| :--- | :--- |
| **"Hermes gateway kaise start hoga"** | Direct answer: `hermes gateway run` ya background launch command. |
| **Port 3000 / Bridge Down** | Call `restart_whatsapp_bridge()` ➔ Verify status ➔ Send message. |
| **Un-normalized Phone Number** | Clean to E.164 (`+91XXXXXXXXXX`) ➔ Proceed. |
| **Notion / Sheets Token Sync** | Retry with auto-refresh credentials in `google_token.json` and `.env`. |
| **Opt-Out Request ("Stop/No")** | Send polite closure ➔ Mark `Archived` in CRM ➔ Halt outreach to this lead. |
| **Call / Quote Request** | Mark `🔥 HOT LEAD` in CRM ➔ Alert Aarzoo Panwar (`+919350370653`) via Telegram. |

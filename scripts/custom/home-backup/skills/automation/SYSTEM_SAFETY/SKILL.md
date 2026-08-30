---
name: SYSTEM_SAFETY
description: System safety protocols, test-mode allowlist (+917599574231), suppression gate, idempotency, secret masking, and production safeguards.
---

# 🛡️ SYSTEM_SAFETY SKILL

## Safety Rules:
1. **Test-Mode Allowlist:** While `_TEST_MODE = True`, ONLY `+91 7599574231` is approved to receive real WhatsApp test messages. All other non-approved numbers MUST be blocked.
2. **Suppression Gate:** Check `is_suppressed(phone)` before any outbound WhatsApp or email communication. If suppressed, block delivery immediately.
3. **Idempotency:** Pass unique idempotency keys (`idem_key`) for every dispatch call to prevent duplicate delivery.
4. **Secret Isolation:** Never expose Notion tokens (`ntn_...`), Telegram bot tokens, API keys, passwords, or credentials in outputs or tool responses.
5. **No Duplicate Logic:** MCP tools must remain thin wrappers over established Python modules.

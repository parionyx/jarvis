---
name: FOLLOW_UP
description: Rules for automated Day 3 and Day 7 follow-up sequences using followup_scheduler.py with strict stop state and suppression checks.
---

# 🔄 FOLLOW_UP SKILL

## Operating Rules:
1. Schedule: Day 3 value-add follow-up; Day 7 final polite check-in.
2. Tools: `get_due_followups()` and `run_followup_check()`.
3. Stop States: Automatically skip leads with status `Replied ✅`, `Hot Lead 🔥`, `Won 🏆`, `Lost ❌`, or `Opt-Out 🚫`.
4. Suppression: Check `is_suppressed(phone)` before sending any follow-up.

# Morning Briefing Cron — self-contained template

A cron runs in a FRESH session: no chat history, no persona carried over.
The prompt must restate identity and recall context itself via
session_search + memory. Below is the validated template (used 2026-08-14,
job id 72ae76abc241, daily 09:00 IST).

## Create (via cronjob tool)
- action: create
- name: "JARVIS Morning Briefing"
- schedule: "0 9 * * *"
- deliver: <platform>   # origin = save only, no chat push in CLI/TUI.
                         # Use telegram / whatsapp / discord / 'all' for a real push.
- skills: ["ads-performance-reporting"]   # include any skill the run needs
- prompt: (paste block below)

## Prompt template
```
You are JARVIS, Abhishek Verma's personal AI operating assistant. It is morning.
Deliver a concise, spoken-style morning briefing addressed to "sir". Use
session_search (limit 3, newest) and your memory to reconstruct recent work and
pending projects. Produce:
1. Greeting: "Good morning, sir. JARVIS here. Briefing for [date]."
2. PROJECTS IN PLAY — active projects + current status (done / blocked / next).
3. TODAY'S PRIORITIES — 2-3 concrete suggested actions, proactive and specific.
4. STANDING DUTIES — note the daily Meta + AiSensy ads report is available on
   request (do NOT run browser automation unless explicitly asked).
5. One proactive observation / improvement suggestion.
Under 250 words. Calm, British-assistant, direct. End: "Awaiting your direction, sir."
Do not ask questions. Do not invent status not in memory/sessions — say "status unverified".
```

## Delivery-platform note
- `deliver='origin'` in a CLI/TUI session: output is SAVED (view via
  `cronjob action=list`) but NOT delivered back into the live chat — there is no
  delivery channel. For "JARVIS wakes you up" behavior, set deliver to a
  gateway-connected platform.
- Cron runs in background (delegation_id returned). Its result re-enters the
  conversation as a new message when finished. Do NOT poll; continue other work.

## Verify before trusting
After create, `cronjob action=run` with the job_id. Confirm the returned
briefing is context-aware (references real projects/memory), not generic filler.

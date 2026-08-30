---
name: proactive-voice-assistant
description: Set up Hermes as a JARVIS-style voice + proactive assistant.
version: 1.0.0
author: JARVIS
license: MIT
platforms: [linux, macos, windows]
---

# Proactive Voice Assistant (JARVIS-style on Hermes)

Use when the user wants Hermes to *feel* like a personal AI operator — voice output, a persona, and autonomous/proactive behavior (the "JARVIS" experience). This is the validated setup path; every phase below was executed and verified on Windows + Hermes.

## The three pillars (in priority order)
1. **Voice** — TTS out + STT in. Biggest "feels like JARVIS" multiplier.
2. **Persona** — calm, concise, proactive tone, addressed to "sir".
3. **Proactive brain** — scheduled self-driven briefings/alerts via cron + memory.

Desktop control, smart home, HUD, and integrations layer on top but come AFTER voice + autonomy. When the user asks "what should I add for a JARVIS feel", don't stop at a plan — start implementing phase-by-phase and verify each phase with real tool output before claiming it done.

## Phase 1 — Voice layer

### TTS (text → speech)
Edge TTS is free and needs **no API key** — prefer it over ElevenLabs (which is silent without a key).

```bash
hermes config set tts.provider edge
hermes config set tts.edge.voice en-GB-RyanNeural   # British male, closest to JARVIS
```

Other good British voices: `en-GB-ThomasNeural` (deeper). Verify the voice actually renders:

```bash
cd "$LOCALAPPDATA/Temp"   # Windows; use /tmp on linux/mac
edge-tts --voice en-GB-RyanNeural --text "Good morning, sir. JARVIS online." --write-media jarvis_test.mp3
file jarvis_test.mp3      # expect: MPEG ADTS, layer III
```

Then in chat use `/voice on` (voice-to-voice) or `/voice tts` (always speak replies).

### STT (speech → text)
Usually already enabled with the local faster-whisper model:
```bash
hermes config get stt     # expect enabled: true, provider: local
pip show faster-whisper   # must be installed for local STT
```
Mic access is required (sounddevice / pyaudio). Auto-detect priority: local faster-whisper → Groq → OpenAI → Mistral Voxtral.

## Phase 2 — Persona / tone
Bake identity into the system prompt for interactive sessions. For **fresh-session crons**, the persona MUST be restated inside the cron prompt itself (see Phase 3) — a cron has no chat history.

Tone rules that read as "JARVIS": calm, British-assistant register, concise, direct action over narration, proactive suggestions, confirm only before risky/irreversible actions.

## Phase 3 — Proactive brain (morning briefing cron)
A cron runs in a **fresh session with no conversation history**. It must recall context itself.

```text
# Shape of the cron prompt
You are JARVIS, <user>'s personal AI assistant. Morning briefing.
1. Use session_search(limit=3, newest) + memory to reconstruct recent work & pending projects.
2. Output: greeting → projects in play (status) → today's priorities → standing duties → one proactive observation.
3. Under 250 words. End: "Awaiting your direction, sir."
4. Do NOT ask questions. Do NOT invent status not in memory/sessions — say "status unverified".
```

Create it (via the `cronjob` tool): `action=create`, `schedule="0 9 * * *"`, `deliver=<platform>`, `skills=["ads-performance-reporting"]` (or relevant). Then immediately `cronjob action=run` to verify it produces a real, context-aware summary (not garbage) before trusting it.

## Pitfalls (learned the hard way)
- **ElevenLabs default = silent.** If TTS provider is `elevenlabs` but no `ELEVENLABS_API_KEY`, Hermes produces no audio. Switch to `edge`.
- **Never hand-edit config.yaml** — a stray indent breaks the live gateway. Use `hermes config set section.key value`.
- **Cron = fresh session.** It cannot see this chat. Restate identity + use session_search/memory inside the prompt, or the briefing will be empty/generic.
- **Local-only cron delivery.** `deliver='origin'` in a CLI/TUI session saves output but does NOT push it back into the chat. For a real "JARVIS wakes you up" push, set `deliver` to a gateway-connected platform (telegram / whatsapp / discord / 'all').
- **Verify, don't assume.** After setting TTS, actually generate an mp3 and check it's valid audio before telling the user voice is live.

## Verification checklist
- [ ] `hermes config get tts.provider` → edge
- [ ] `hermes config get tts.edge.voice` → en-GB-RyanNeural (or chosen)
- [ ] edge-tts produced a valid .mp3 (MPEG ADTS)
- [ ] `hermes config get stt` → enabled: true, provider local
- [ ] faster-whisper installed
- [ ] cron created + test-run returned a context-aware briefing

## References
- `references/voice-config.md` — exact commands + verified output, TTS provider table, STT details.
- `references/morning-briefing-cron.md` — full self-contained cron prompt template + delivery-platform notes.

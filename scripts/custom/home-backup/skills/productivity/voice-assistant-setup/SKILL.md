---
name: voice-assistant-setup
description: "Set up free TTS/STT voice I/O for Hermes assistant personas."
version: 1.0.0
author: JARVIS
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [voice, tts, stt, assistant, automation]
    related_skills: [hermes-cron-ops]
---

# Voice Assistant Setup (Hermes)

Use when the user wants Hermes to speak and/or listen — a voice-driven personal assistant, "JARVIS feel", voice persona, TTS/STT enablement.

## When to Use

- Adding voice I/O to a Hermes persona / "assistant feel".
- Fixing "Hermes won't talk" (often ElevenLabs-without-key silent default).
- Setting up `/voice on` / `/voice tts` for the user.

## TTS (Hermes speaks)

- Prefer **Edge TTS** — free, no API key, installed via `edge-tts` (verify: `pip show edge-tts`).
- Set it:
  `hermes config set tts.provider edge`
  `hermes config set tts.edge.voice en-GB-RyanNeural`  (British male, closest to a JARVIS tone).
- Other British options: `en-GB-ThomasNeural` (deeper), `en-GB-NovelNeural`.
- PITFALL: `elevenlabs` is sometimes the shipped default TTS provider but requires `ELEVENLABS_API_KEY`; with no key it is **SILENT** (no error). If "Hermes won't talk", check `tts.provider` isn't elevenlabs-without-key — switch to edge.
- Verify by generating a clip directly:
  `edge-tts --voice en-GB-RyanNeural --text "Good morning, sir. JARVIS online." --write-media out.mp3`
  then deliver the file as `MEDIA:/path/out.mp3` so the user can hear it before committing.

## STT (Hermes listens)

- Local is default and free: faster-whisper. Verify install `pip show faster-whisper`; check `hermes config get stt` shows `enabled: true`, `provider: local`.
- Mic access: `python -c "import sounddevice; print('ok')"` (sounddevice present).
- Voice input in chat: `/voice on` (voice-to-voice), `/voice tts` (always speak replies, text in), `/voice off`.

## Persona note

Voice alone gives ~70% of the "assistant feel". Pair with a concise, direct, proactive system persona (address user as "sir" if desired) and a proactive morning-briefing cron (see `hermes-cron-ops`) for the remaining 30%.

## Verification

Generate the test mp3 and confirm it is a valid MPEG audio file (`file out.mp3` → "MPEG ADTS, layer III"). Deliver it so the user can hear the chosen voice before committing.

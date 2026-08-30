---
name: hermes-personalization
description: "Rebrand Hermes into a named persona: voice, wake word, cron."
version: 1.0.0
author: JARVIS / Hermes
license: MIT
metadata:
  hermes:
    tags: [hermes, personalization, tts, voice, wake-word, cron, jarvis]
    related_skills: [hermes-agent, proactive-voice-assistant]
---

# Hermes Personalization (persona / rebrand)

Turn a stock Hermes install into a named, characterful assistant. The user's
"JARVIS" build is the reference implementation. Four high-impact, reusable
changes, in priority order:

1. Character voice (free, no API key)
2. Custom wake word (real trigger, not just a label)
3. Instant spoken greeting on wake
4. Proactive duties via cron (plus the `Gemini 404` trap)

## When to use
- "make Hermes feel like JARVIS / Jarvis" or any persona rebrand.
- "change Hey Hermes to Hey <X>" / custom wake phrase.
- Set a character TTS voice (British male, etc.) without paying for ElevenLabs.
- Add a proactive morning briefing or standing duty via cron.
- Diagnose cron subagent failures (`Gemini returned HTTP 404`).

## 1. Character voice (free, no key)
Hermes TTS defaults can be silent (e.g. ElevenLabs selected with no API key).
Use Edge TTS instead:
```bash
hermes config set tts.provider edge
hermes config set tts.edge.voice en-GB-RyanNeural   # British male, closest to JARVIS
```
Verify by generating a clip (needs `edge-tts` pip package):
```bash
cd "$LOCALAPPDATA/Temp" && edge-tts --voice en-GB-RyanNeural \
  --text "Good morning, sir. JARVIS online." --write-media jarvis_test.mp3
file jarvis_test.mp3   # expect MPEG ADTS layer III
```
STT: `stt.enabled: true`, `stt.provider: local` (faster-whisper, free). Mic
must be accessible — test with `python -c "import sounddevice; print('ok')"`.
Chat commands: `/voice on` (voice-to-voice), `/voice tts` (always speak).

## 2. Wake word relabel (real trigger, not just text)
openWakeWord ships built-in phrase models. Relabel "Hey Hermes" -> "Hey Jarvis":
```bash
hermes config set wake_word.phrase "hey jarvis"
hermes config set wake_word.openwakeword.model hey_jarvis
```
`hey_jarvis` auto-downloads (ONNX + TFLite) on first use — VERIFIED working via
`from openwakeword.utils import download_models; download_models(['hey_jarvis'])`.
The mic then triggers on "Hey Jarvis" for real.

Source labels/fallbacks to keep consistent (cosmetic; engine keys off config):
- `tools/wake_word.py`: `_DEFAULTS["phrase"]`, `wake_phrase()` fallback, the
  sherpa-engine fallback `str(_get(cfg,"phrase") or "hey hermes")` -> `"hey jarvis"`,
  and the module docstring.
- Desktop UI fallbacks: `apps/desktop/src/app/chat/composer/controls.tsx`
  (`const phrase = wake.phrase || 'hey hermes'`) and
  `apps/desktop/src/app/session/hooks/use-prompt-actions/slash.ts`
  (`Phrase: "${status.phrase?.trim() || 'hey hermes'}"`).

## 3. Instant "Hello sir" greeting on wake
In `apps/desktop/src/app/contrib/wiring.tsx`, the `wake.detected` handler calls
`playWakeSound()`. Inject a spoken ack immediately after it:
```ts
import { speakText } from '@/hermes'
// ...inside `if (event.type === 'wake.detected') {` after playWakeSound():
void speakText('Hello sir').catch(() => undefined)
```
`speakText` hits the gateway `/api/audio/speak` (your configured Edge TTS).
Best-effort — a TTS failure must NEVER block voice capture.

## 4. CRITICAL — packaged desktop needs a rebuild
The shipped `Hermes.exe` runs **compiled JS from `app.asar`**
(`apps/desktop/release/win-unpacked`). Edits to `*.tsx` source do NOT take
effect until rebuilt:
```bash
cd apps/desktop && npm run build   # vite build + electron main bundle + native deps
```
Or run dev mode (`npm run dev`) for hot-reload. **Config changes**
(`hermes config set`) and **Python module edits** (`tools/*.py` loaded by the
gateway) need only an app/gateway RESTART — not a rebuild. The gateway loads
`tools/wake_word.py` from the same venv dir as the `hermes` launcher; there is
only one copy, so source edits to it propagate after restart.

## 5. Proactive duties via cron (and the Gemini-404 trap)
A morning-briefing cron is the simplest "JARVIS proactivity". The single most
common way a fresh cron dies is `Gemini returned HTTP 404` — see
`references/cron-model-resolution.md` for root cause + fix + verification.

## Pitfalls
- **Config ≠ source**: `hermes config set` is live after a gateway restart;
  `.tsx` UI edits require a full `npm run build`.
- **Cron model_snapshot fails-closed**: after changing `model.default`, an
  EXISTING cron keeps its stale snapshot and errors. Remove + recreate the job.
- **Don't attach browser skills to non-browser crons** (e.g.
  `ads-performance-reporting` on a text briefing) — bloats the prompt and can
  trigger unwanted automation.
- **Auto-TTS vs wake greeting**: `voice.auto_tts` speaks replies; the wake
  greeting is a separate `speakText` call in the `wake.detected` handler.

## References
- `references/wake-word-relabel.md` — exact edits + verification for the wake-word
  rename and the "Hello sir" injection.
- `references/cron-model-resolution.md` — diagnosing `Gemini returned HTTP 404`
  on cron runs; root cause, fix, and verification.

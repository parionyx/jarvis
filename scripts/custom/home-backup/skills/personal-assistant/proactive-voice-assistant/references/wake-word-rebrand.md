# Rebranding the Hermes wake word (e.g. "Hey Hermes" → "Hey Jarvis")

Use when the user wants the hands-free trigger phrase changed from the default
"Hey Hermes" to a custom phrase (their assistant's name). This is a REAL wake
word change, not just a text relabel — openWakeWord ships a `hey_jarvis` model,
and the sherpa engine is open-vocabulary.

## Why it matters
The wake-word phrase is used in TWO places:
1. The detection MODEL (acoustic) — must match the spoken sound.
2. Cosmetic UI labels (ear-icon tooltip, `/wake` status) — display only.

If you only relabel the UI text, the mic still triggers on "Hey Hermes". Both
must change for a consistent experience.

## Config (functional trigger)
```bash
hermes config set wake_word.phrase "hey jarvis"
hermes config set wake_word.openwakeword.model hey_jarvis
```
- `hey_jarvis` auto-downloads (ONNX + TFLite) via openWakeWord's
  `download_models(['hey_jarvis'])` — verified working, no API key.
- Open-vocabulary alternative: `wake_word.provider: sherpa` + any `wake_word.phrase`
  (tokenized at runtime, no model download).

## Source patches (cosmetic + fallback correctness)
File: `<hermes>/tools/wake_word.py`
- module docstring: "Hey Hermes" → "Hey Jarvis"
- `_DEFAULTS["phrase"]`: "hey hermes" → "hey jarvis"
- `wake_phrase()` fallback: `or "hey hermes"` → `or "hey jarvis"`
- sherpa path fallback (~line 689): `or "hey hermes"` → `or "hey jarvis"`

Desktop UI fallbacks (display only, patch for consistency):
- `apps/desktop/src/app/chat/composer/controls.tsx` line ~329:
  `const phrase = wake.phrase || 'hey hermes'` → `'hey jarvis'`
- `apps/desktop/src/app/session/hooks/use-prompt-actions/slash.ts` line ~91:
  `status.phrase?.trim() || 'hey hermes'` → `'hey jarvis'`

Note: the backend `wake.status` handler returns `reqs["phrase"]` = `wake_phrase(cfg)`,
so once config is correct the UI shows the new phrase without the UI-fallback
patches — those are a safety net for an empty backend response.

## CRITICAL: restart the running app/gateway
Config and source edits do NOT affect the already-running process. The desktop
app + its Python gateway loaded config and `wake_word.py` at startup.
- Close Hermes completely (all windows) and reopen, OR restart the gateway.
- After restart: `/wake on` enables the listener; the mic triggers on "Hey Jarvis".

## Verification
```bash
# model downloads + resolves
python -c "from openwakeword.utils import download_models; download_models(['hey_jarvis']); print('ok')"
# module returns new phrase
python -c "import importlib.util as u; s=u.spec_from_file_location('w',r'<hermes>/tools/wake_word.py'); m=u.module_from_spec(s); s.loader.exec_module(m); print(m.wake_phrase())"
# expect: hey jarvis
```
Only ONE `wake_word.py` exists (no bundled duplicate under `release/`), so the
edited source is the only copy the gateway loads.

## Remaining cosmetic-only strings (optional sweep)
These still say "Hey Hermes" and are display-only; safe to leave:
`voice-stop-word.ts` (the "stop" command address prefixes like "hey hermes stop"),
`cli_commands_mixin.py` `/wake` help text, and docs (`slash-commands.md`). They do
NOT affect the trigger.

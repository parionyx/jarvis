# Wake-word relabel: "Hey Hermes" -> "Hey Jarvis"

Verified procedure from the JARVIS build. openWakeWord ships built-in phrase
models, so the rename is a REAL trigger, not just a label.

## Config (live after gateway restart)
```bash
hermes config set wake_word.phrase "hey jarvis"
hermes config set wake_word.openwakeword.model hey_jarvis
```
## Verify the model is fetchable (run once)
```python
from openwakeword.utils import download_models
download_models(['hey_jarvis'])   # downloads .onnx + .tflite, ~1.3 MB each
print("OK")
```
## Source edits (cosmetic; engine keys off config)
- `tools/wake_word.py`
  - `_DEFAULTS["phrase"]`: `"hey hermes"` -> `"hey jarvis"`
  - `wake_phrase()` fallback: `or "hey hermes"` -> `or "hey jarvis"`
  - sherpa path (~line 689): `str(_get(cfg,"phrase") or "hey hermes")` -> `"hey jarvis"`
  - docstring line 1 + line 12 "bundled \"hey hermes\""
- `apps/desktop/src/app/chat/composer/controls.tsx` (line ~329):
  `const phrase = wake.phrase || 'hey hermes'` -> `'hey jarvis'`
- `apps/desktop/src/app/session/hooks/use-prompt-actions/slash.ts` (line ~91):
  `Phrase: "${status.phrase?.trim() || 'hey hermes'}"` -> `'hey jarvis'`

## Instant "Hello sir" greeting on wake
File: `apps/desktop/src/app/contrib/wiring.tsx`
Inside `if (event.type === 'wake.detected') {`, right after `playWakeSound()`:
```ts
import { speakText } from '@/hermes'
// ...
void speakText('Hello sir').catch(() => undefined)
```
`speakText` -> gateway `/api/audio/speak` (uses configured Edge TTS voice).
Best-effort: must never block voice capture.

## Gotchas
- The running `Hermes.exe` is the PACKAGED build (compiled JS in `app.asar`).
  `.tsx` edits need `cd apps/desktop && npm run build` (or `npm run dev`).
- Config + `tools/*.py` edits need only an app/gateway RESTART.
- Only ONE `tools/wake_word.py` exists (no bundled duplicate), so Python edits
  propagate after restart.
- A still-running stale gateway process (started before edits) will keep showing
  "Hey Hermes" until restarted — that is NOT a failed edit.

#!/usr/bin/env python3
"""Voice-ectomy batch 2: wiring, submit, slash, assistant-message, jarvis-core,
use-hermes-config, toolset-config-panel, prompt-actions tests."""
import re
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "apps/desktop/src"


def patch(path: str, fixes, optional=False):
    p = SRC / path
    t = p.read_text(encoding="utf-8")
    changed = False
    for old, new in fixes:
        if old in t:
            t = t.replace(old, new)
            changed = True
        elif not optional:
            print(f"  MISS [{path}]: {old[:70]!r}")
    if changed or True:
        p.write_text(t, encoding="utf-8", newline="")
    print(path, "ok")


# ---- wiring.tsx: remove wake handler block + imports ----
p = SRC / "app/contrib/wiring.tsx"
t = p.read_text(encoding="utf-8")
for imp in [
    "import { playSpeechText } from '@/lib/voice-playback'\n",
    "import { activateWakeIndicator } from '@/lib/wake-indicator'\n",
    "import { playWakeSound } from '@/lib/wake-sound'\n",
    "import { stopClientCapture } from '@/store/wake-word'\n",
]:
    t = t.replace(imp, "")

# wake.detected handler inside handleDesktopGatewayEvent callback
m = re.search(r"\n      if \(event\.type === 'wake\.detected'\) \{.*?\n      \}\n", t, re.S)
if m:
    t = t[: m.start()] + "\n" + t[m.end():]
else:
    print("  MISS wiring wake.detected block")

t = re.sub(r"\n{4,}", "\n\n\n", t)
p.write_text(t, encoding="utf-8", newline="")
print("wiring.tsx ok")

# ---- use-prompt-actions/slash.ts: wake.start passthrough entry ----
p = SRC / "app/session/hooks/use-prompt-actions/slash.ts"
t = p.read_text(encoding="utf-8")
m = re.search(r"\n  'wake\.start',", t)
t = re.sub(r"\n  'wake\.start',", "", t, count=1)
# also any wake.start handling branch
t = re.sub(r".*wake\.start.*\n", "", t, count=0) if "'wake.start'" in t else t
p.write_text(t, encoding="utf-8", newline="")
print("slash.ts ok")

# ---- use-hermes-config: strip voice-prefs sync ----
p = SRC / "app/session/hooks/use-hermes-config.ts"
t = p.read_text(encoding="utf-8")
print("  hermes-config voice refs:", len(re.findall(r"voice-prefs|autoSpeak|\$voice", t)))

# ---- submit.ts: drop voice-playback import + usages ----
p = SRC / "app/session/hooks/use-prompt-actions/submit.ts"
t = p.read_text(encoding="utf-8")
for frag in [
    "import {\n  isVoicePlaybackActive,\n  markVoicePlaybackInterrupted,\n  stopVoicePlayback,\n  takeVoicePlaybackInterrupted\n} from '@/lib/voice-playback'\n",
]:
    if frag in t:
        t = t.replace(frag, "")
    else:
        print("  submit import variant miss — inspecting…")
# usage lines
t = re.sub(r"^\s*(stopVoicePlayback|markVoicePlaybackInterrupted|takeVoicePlaybackInterrupted)\([^;]*\)\n", "", t, flags=re.M)
t = re.sub(r"[^\n]*isVoicePlaybackActive[^\n]*\n", "", t, flags=re.M)
p.write_text(t, encoding="utf-8", newline="")
print("submit.ts ok (verify compile)")

# ---- assistant-message.tsx: speak button removal ----
p = SRC / "components/assistant-ui/thread/assistant-message.tsx"
t = p.read_text(encoding="utf-8")
t = t.replace("import { speakText, stopSpeech } from '@/lib/voice-playback'\n", "")
t = t.replace("import { isVoicePlaybackActive } from '@/lib/voice-playback'\n", "")
t = re.sub(r"import \{[^}]*\} from '@/(lib|store)/voice-playback'\n", "", t)
print("assistant-message imports stripped (usages next pass by tsc)")

# ---- jarvis-core.tsx: strip voice-playback + wake-word imports/usages ----
p = SRC / "components/chat/jarvis-core.tsx"
t = p.read_text(encoding="utf-8")
t = re.sub(r"import \{[^}]*\} from '@/store/voice-playback'\n", "", t)
t = re.sub(r"import \{[^}]*\} from '@/store/wake-word'\n", "", t)
print("jarvis-core imports stripped (usages next pass)")

# ---- settings toolset-config-panel: remove VoiceProviderFields render/import ----
p = SRC / "app/settings/toolset-config-panel.tsx"
t = p.read_text(encoding="utf-8")
t = t.replace("import { VoiceProviderFields } from './voice-provider-fields'\n", "")
t = re.sub(r"<VoiceProviderFields[^/]*/>\n?", "", t)
t = re.sub(r"<VoiceProviderFields[\s\S]*?</VoiceProviderFields>\n?", "", t)
p.write_text(t, encoding="utf-8", newline="")
print("toolset-config-panel ok")

# ---- index.test.tsx: delete (heavy voice/wake assertions) ----
pt = SRC / "app/session/hooks/use-prompt-actions/index.test.tsx"
if pt.exists():
    pt.unlink()
    print("index.test.tsx deleted (voice-heavy)")

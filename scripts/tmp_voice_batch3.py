#!/usr/bin/env python3
"""Batch: remove remaining voice/wake references across slash.ts,
desktop-slash-commands.ts, use-hermes-config, assistant-message, jarvis-core,
main.tsx, desktop-slash-commands specs."""
from pathlib import Path
import re

SRC = Path(__file__).resolve().parent.parent / "apps/desktop/src"


def patch(path, fixes):
    p = SRC / path
    t = p.read_text(encoding="utf-8")
    for old, new in fixes:
        if old in t:
            t = t.replace(old, new)
        else:
            print(f"  miss [{path}]: {old[:70]!r}")
    p.write_text(t, encoding="utf-8", newline="")
    print(path, "ok")


# ---- slash.ts: remove wake-word import block remnants + 'wake' from action ids/types/registry lists ----
p = SRC / "app/session/hooks/use-prompt-actions/slash.ts"
t = p.read_text(encoding="utf-8")
t = re.sub(r"import \{\n  applyWakeStartResult,\n  applyWakeStatus,\n  applyWakeStopResult,\n  type WakeInputDeviceStatus,\n  type WakeStartResponse,\n  type WakeStatusResponse,\n  type WakeStopResponse\n\} from '@/store/wake-word'\n\n", "", t)
# remove 'wake' entries in typed arrays/unions
t = re.sub(r"\n\s*'wake',", "", t)
t = re.sub(r"\n\s*wake,", "", t)
p.write_text(t, encoding="utf-8", newline="")
print("slash.ts cleaned")

# ---- use-hermes-config.ts: strip voice-prefs import + usage ----
p = SRC / "app/session/hooks/use-hermes-config.ts"
t = p.read_text(encoding="utf-8")
print("  refs before:", len(re.findall(r"voice|Voice|autoSpeak", t)))

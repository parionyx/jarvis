#!/usr/bin/env python3
"""Batch 4: use-hermes-config, assistant-message, jarvis-core, main.tsx."""
from pathlib import Path
import re

SRC = Path(__file__).resolve().parent.parent / "apps/desktop/src"

# ---- use-hermes-config.ts ----
p = SRC / "app/session/hooks/use-hermes-config.ts"
t = p.read_text(encoding="utf-8")
print("--- hermes-config voice context ---")
for i, l in enumerate(t.splitlines(), 1):
    if re.search(r"voice|Voice|autoSpeak|AutoSpeak", l):
        print(i, l.strip()[:110])

# JARVIS - Install Guide (Other Device)

Repo: https://github.com/parionyx/jarvis (private - needs GitHub access)

## Quick Install (Other Device)

### Windows (PowerShell - Recommended)
```powershell
# 1. Clone
git clone https://github.com/parionyx/jarvis.git
cd jarvis

# 2. Install Hermes runtime (uv, Python, Node)
# Use official installer - it will detect local checkout
iex (irm https://hermes-agent.nousresearch.com/install.ps1)

# 3. Or install from checkout directly
.\scripts\install.ps1
```

### Linux / macOS / WSL2
```bash
git clone https://github.com/parionyx/jarvis.git
cd jarvis
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
# or
./setup-hermes.sh
```

### Desktop App Build
```bash
cd apps/desktop
npm install
npm run build
npm run dist:win   # Windows
npm run dist:mac   # macOS
npm run dist:linux # Linux
# Output in apps/desktop/release/
```

### Auth (after install)
```bash
hermes setup          # interactive wizard
hermes model          # choose model
hermes gateway setup  # Telegram/Discord etc
```

## What's in this build
- Engineering Artifact Studio (3D viewport, component palette, flight sim, circuit wiring, BOM/analysis/test modes)
- JARVIS theme (arc reactor cyan + amber) - built-in skin
- Optimized bundle (6.0 MB, i18n minimal)
- Voice/multilingual removed, English-only

## Original source
Fork of https://github.com/NousResearch/hermes-agent (MIT)
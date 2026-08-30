---
name: wifi-coverage-survey
description: "WiFi 3D heatmap + read-only LAN device discovery."
version: 1.0.0
author: JARVIS
license: MIT
---

# WiFi Coverage Survey & LAN Presence Mapping

Build a 3D WiFi coverage heatmap + live device-count dashboard, and discover router/client
info in **read-only** mode. Designed for single-AP home networks (e.g. Jio AirFiber) where
true per-room occupancy is impossible without mesh hardware.

## When to use
- "WiFi ki range use karke dekho kis room mein kitne log h"
- WiFi coverage heatmap / dead-zone map request
- "Router mein kitne device connected h" / router admin discovery
- Home/lab network awareness, presence detection

## HARD PHYSICAL CONSTRAINTS (state these BEFORE building)
- **Single AP cannot localize a device to a room.** Room-level needs ≥3 APs (trilateration)
  or **1 mesh node per room**. With one router, "kis room mein kitne log" is technically impossible.
- **RSSI = signal strength, NOT people.** Occupancy is inferred from connected client *devices*
  (1 phone ≈ 1 person, minus known IoT). Never present RSSI as a headcount.
- Deliverable split: **3D coverage heatmap** (real, works via manual survey) + **total live-device
  count** (real, via LAN sweep) + **per-room people = N/A** (needs mesh).

## READ-ONLY DISCOVERY WORKFLOW (never touch config, never handle creds)
Embed this as a hard rule for any router task:
- **Do NOT change any router setting.** Discovery only.
- **Do NOT ask the user for the router password in chat/terminal. Do NOT save, print, log,
  screenshot, or transmit the password.** If auth is needed, let the user type it into the
  browser UI themselves (see Pitfalls for the CUA pattern).
- Probes that need no creds:
  - `netsh wlan show interfaces` → connected SSID, BSSID, band, channel, **Rssi**
  - `arp -a` → live IP↔MAC on the subnet (credential-free device proxy)
  - TCP port probe (`/dev/tcp` or `Test-NetConnection`) → which admin ports are open
  - `curl -sk https://<gateway>/` → login page often self-identifies vendor/model
- If web_search has no credits (this env), identify vendor from **OUI** (first 3 MAC octets)
  + the router's own login-page HTML, not an external lookup.

## BUILD THE 3D TOOL
1. `floorplan.json` — rooms as `{name,x,y,w,d,h}` in meters (template provided).
2. `survey_walk.py` — stand at each grid point with the scanner PC; it reads RSSI via
   `netsh wlan show interfaces` and appends `{x,y,rssi,band}` to `survey.json`.
3. `server.py` — local stdlib HTTP server exposing `/api/floorplan`, `/api/coverage`,
   `/api/devices`. The devices endpoint runs the read-only LAN sweep (see scripts/lan_sweep.py).
4. `index.html` — Three.js dashboard: orbitable room boxes + IDW RSSI surface (red→green) +
   live device-count card. **Sanitize any scan data with `textContent`/`replaceChildren`,
   never `innerHTML`** (XSS lint flag).
- IDW field: `r(x,y)=Σ(rssi_i/d_i²)/Σ(1/d_i²)`, d=distance+0.5. Map RSSI [-75,-35]→color hue.

## LIVE DEVICE COUNT (credential-free proxy)
Run `scripts/lan_sweep.py <subnet_base>` (e.g. `192.168.31`): ICMP ping of /24 (parallel via
threading) then parse `arp -a`. Returns live IP+MAC. Subtract router + this PC's own adapters
→ ≈ people. Verified: returned 17 live hosts on a real Jio /24 this session.

## PITFALLS
- **Windows terminal `&` backgrounding is blocked.** Use `terminal(background=true)` or a
  Python threading script for parallel pings — do NOT shell-background with `&`.
- **Chrome address-bar typing needs `delivery_mode:"foreground"`** in computer_use. The driver
  returns `background_unavailable` for text_input on `Chrome_WidgetWin_1`; retry foreground
  (briefly raises the window, then restores). Same applies to any credential UI you want the
  user to type into — never type secrets yourself.
- **`netsh` RSSI is client-side only.** The host adapter sees its own link RSSI, not other
  devices' RSSI. Per-device RSSI requires router admin access (creds) — not available read-only.
- **Jio/AirFiber admin** is a JS SPA behind login; guest/status endpoints 404. Authoritative
  client list only via sticker-password login (user does it). See references/router-discovery-readonly.md.
- **Web search unavailable here** — rely on OUI + page introspection, not Firecrawl.

## VERIFICATION
- Start `server.py`, `curl http://localhost:8787/api/devices` → real JSON with live hosts.
- `curl /api/floorplan` and `/api/coverage` serve the JSON files.
- Open dashboard in browser; confirm rooms render and device count populates.

## References
- `references/router-discovery-readonly.md` — Jio AirFiber findings + generic read-only technique.
- `references/build-3d-dashboard.md` — condensed Three.js + server build recipe.
## Templates
- `templates/floorplan.json` — starter floor plan to edit.
## Scripts
- `scripts/lan_sweep.py` — verified read-only LAN live-device sweep.

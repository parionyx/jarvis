---
name: wifi-indoor-sensing
description: "WiFi/LAN dashboard: 3D RSSI heatmap, device count, self-loc"
version: 1.0.0
author: JARVIS
license: MIT
platforms: [windows]
---

# WiFi Indoor / Local-Network Sensing

Build dashboards that fuse a floor plan with live WiFi/LAN data: RSSI coverage heatmap,
live device count, and (single-AP) self-localization. All read-only, no router creds, stdlib only.

## Trigger
User asks to map WiFi coverage, count devices/people per room, locate themselves or devices
in a space, or "build a 3D diagram of the house/room from WiFi signal".

## HARD CONSTRAINTS — lead with these, never fabricate feasibility
- **RSSI = signal strength, NOT occupancy.** 1 connected device ≈ 1 person minus known IoT.
- **Single AP = NO per-room localization.** A device's room cannot be inferred from one AP's RSSI.
  Needs ≥3 APs (trilateration), 1 node/room (mesh), OR a pre-built floor plan + fingerprint walk.
- **Guest/public WiFi: client isolation + MAC randomization** → you cannot see other devices and
  cannot auto-map a building. That requires venue-owned multi-AP infra. Do NOT build "track strangers" tools.
- **A 3D building diagram needs an actual floor plan** (blueprint or manual dims in meters).
  RF signal does NOT reveal wall geometry. Be explicit: the map comes from `floorplan.json`, not from signal.

Workflow rule: **state the limit first, then immediately attempt the best available no-extra-hardware
path.** The user expects you to *try* (e.g. "mesh ke bina ho jaye") before concluding impossible.

## Three buildable paths (pick by feasibility)
**A. 3D coverage heatmap** — walk floor plan, scan RSSI per grid point, render IDW surface in Three.js.
**B. Live device count** — read-only LAN ping+ARP sweep (/24), join with `registry.json` MAC→room/person.
Total only on single AP; per-room only via manual registry mapping.
**C. Self-localization (no mesh)** — `calibrate.py` fingerprint walk; server matches live 2-adapter RSSI
to nearest point → "YOU" marker. This is the one thing that works single-AP. See scripts/selfloc_server.py.

## Key techniques
- Read RSSI per interface: `netsh wlan show interfaces` → parse `Rssi` + `Band`. Two adapters = two vectors
  (better fingerprint). Reference: references/windows-wifi-probes.md
- LAN device enumeration: threaded `ping -n 1 -w 300` each IP in /24, then `arp -a`, drop `ff-ff-ff-ff-ff-ff`.
- Fingerprint match: nearest neighbor on RSSI vector (Euclidean distance over union of interface keys).
- Router read-only discovery: probe ports, fetch login page (self-identifies model), OUI from ARP.
  Never auth, never change config, never expose creds.

## Pitfalls (learned this session)
- **`http.server` is SINGLE-THREADED** — a ~10s LAN sweep endpoint blocks ALL other requests (HTTP 000
  timeouts). Use `ThreadingHTTPServer`. See scripts/selfloc_server.py.
- **Windows terminal via Hermes blocks `&` backgrounding** — use `terminal(background=true)` then poll/wait.
- **Inline heredoc python is flagged/timeout-prone** — write script via `write_file`, then `python script.py`.
- **computer_use: Chrome address-bar typing needs `delivery_mode:"foreground"`** — background drops
  text_input on `Chrome_WidgetWin_1`. For router login, let the USER type creds; never capture/screenshot password.
- **No `innerHTML` with scan data** (XSS) — use `textContent` / `replaceChildren`.
- Single gateway found: `192.168.31.1` Jio AirFiber, OUI `9c:d4:a6`/`1e:d4:a6`. One AP, no mesh.

## Support files
- references/windows-wifi-probes.md — netsh/arp commands + ThreadingHTTPServer note
- references/physics-limits.md — why single AP / guest WiFi can't do per-room people
- scripts/wifi_probe.py — read RSSI vector from all interfaces
- scripts/lan_sweep.py — threaded /24 ping + ARP device list
- scripts/selfloc_server.py — ThreadingHTTPServer dashboard skeleton (fingerprint self-loc + rooms + devices)
- templates/floorplan.json — room dims (x,y,w,d,h meters)
- templates/registry.json — MAC → room/person mapping

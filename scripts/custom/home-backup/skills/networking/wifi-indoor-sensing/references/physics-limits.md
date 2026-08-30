# Why single-AP / guest WiFi cannot do per-room people

## RSSI != occupancy
RSSI is received signal strength (dBm). It tells you a device is within range and roughly how
close. It does NOT count humans. Assumption: 1 phone ≈ 1 person, minus known IoT = estimate only.

## One AP cannot localize a room
To place a device in (x,y) you need ≥3 APs (trilateration) OR one AP per room (mesh, where
"which AP" = which room). With a single AP, RSSI only says "near the router" — no room.
Workaround: pre-built floor plan + RSSI **fingerprint walk** (still only localizes THIS scanner,
not arbitrary clients, since clients don't report their RSSI to you).

## Guest / public WiFi
- **Client isolation**: guests can't see each other's MAC/IP/ARP. You see only your own device.
- **MAC randomization**: phones rotate MACs, so even seeing a device, you can't track a person.
- **No building geometry from RF**: walls/rooms are not derivable from signal alone.
Result: a "mall auto 3D map + everyone's location" from free WiFi is physically impossible client-side.

## What IS possible (own infra)
- 3D coverage heatmap: manual walk + RSSI grid → IDW surface.
- Self-localization: your scanner, fingerprint walk, nearest-neighbor match → "YOU" dot.
- Per-room people: only with venue-owned multi-AP OR manual MAC→room registry mapping.
- Total device count: LAN ARP sweep (read-only) as a people proxy.

## Ethics
Do not build tools that track strangers without consent. Venue crowd analytics is operated by
the venue owner under privacy law, on their own AP infrastructure — not by a guest.

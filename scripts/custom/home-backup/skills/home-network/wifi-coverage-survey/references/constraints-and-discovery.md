# Constraints & Router Discovery (reference)

## Physics constraints (always state these)
- **Single AP ⇒ no per-room localization.** Trilateration needs ≥3 APs with known
  positions, or 1 AP per room (mesh). One router = total device count only.
- **RSSI is signal strength, not occupancy.** Use 1 phone ≈ 1 person as a proxy
  after excluding known IoT MACs. Never claim RSSI counts humans.
- **Floor shape ≠ signal.** Walls/rooms come from user `floorplan.json`, not RSSI.
- **True per-room occupancy = mesh upgrade** (1 node/room) OR manual MAC→room map.

## Read-only router fingerprinting (Windows)
```
netsh wlan show interfaces        # SSID, BSSID, RSSI, Band, Channel, Radio type
netsh wlan show drivers            # NIC model, bands, hosted-network support
arp -a                             # gateway MAC (OUI hints vendor)
```
TCP port probe (read-only connect, no banner grab that could be intrusive):
```
for p in 23 53 80 443 8080 8443 7547; do
  (exec 3<>/dev/tcp/<GW>/$p) 2>/dev/null && echo "OPEN $p" || echo "closed $p"
done
```
HTTPS HEAD + GET `/` (read meta/title, no auth):
```
curl -sk -m 6 -I https://<GW>/ | head -20
curl -sk -m 6 https://<GW>/ | grep -ioE "<title>[^<]*</title>|content=\"[^\"]*\""
```

## Vendor fingerprints seen
- **JioFiber / JioAirFiber**: SSID `AirFiber-*`, OUI `1E:D4:A6` / `9C:D4:A6`
  (gateway MAC), login page `<meta name="description" content="Jio application">`
  (React SPA). Ports 53/80(→307 HTTPS)/443/8080(UPnP "Service Unavailable")/8443.
  No credential-free client-list API (all status endpoints 404). True client list
  only via router login (sticker password). Single AP, no mesh.
- Generic: many consumer routers expose `/api/v1/status` or `/cgi-bin/luci` only
  behind auth; treat as 404 until proven.

## Live device enumeration without creds
Ping sweep primes ARP, then read `arp -a`. Exclude router + self. The AP's own
MAC in ARP is the gateway; this PC's adapters show as `---` interface entries.
Count of remaining dynamic entries ≈ total live devices.

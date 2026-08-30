# Read-only router discovery — technique & real findings

## Generic read-only probe sequence (no creds, no config change)
1. `netsh wlan show interfaces` — connected SSID, BSSID, band, channel, **Rssi** (host link only).
2. `netsh interface ip show config` — find DHCP-assigned IP + **default gateway** (the router).
3. `arp -a` — live IP↔MAC on the subnet. Router = `.1` typically. Credential-free device proxy.
4. TCP port probe: `for p in 23 53 80 443 8080 8443 1900 7547; do (exec 3<>/dev/tcp/<gw>/$p) 2>/dev/null && echo OPEN $p; done`
5. `curl -sk https://<gw>/` — login page HTML often self-identifies vendor/model (e.g. `<meta name="description" content="Jio application">`).
6. Probe common guest/status endpoints (`/status`, `/info`, `/api/v1/status`, `/userRpm/*`, `/cgi-bin/luci`) — most return 404 on consumer SPA routers.

## Jio AirFiber / JioFiber findings (this session, real)
- SSID: `AirFiber-siddhanth` (BSSID `1e:d4:a6:b9:f5:53`, gateway MAC `9c:d4:a6:b9:f5:51` → **Jio OUI**).
- Gateway `192.168.31.1`. Single AP, **no mesh**.
- Open ports: 53 (DNS), 80 (→307→HTTPS), 443 (login SPA), 8080 (UPnP/IGD, "Service Unavailable"), 8443.
- Login UI = React SPA; guest status endpoints all 404. Authoritative client list only via sticker-password login.
- **Per-device RSSI needs router admin.** `netsh` RSSI is client-side (host link) only.
- Live /24 sweep result: 17 hosts (router + this PC with 2 adapters + ~15 clients).

## Hard constraints to restate to user
- Single AP cannot localize a device to a room. RSSI is signal strength, not people.
- Per-room occupancy requires 1 mesh node/room or ≥3 APs (trilateration).

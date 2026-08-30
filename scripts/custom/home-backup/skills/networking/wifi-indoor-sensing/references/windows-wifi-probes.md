# Windows WiFi / LAN probe commands

## RSSI per interface (client-side, read-only)
```
netsh wlan show interfaces
```
Parse: `Rssi   : -41`, `Band   : 5 GHz`, `SSID`, `BSSID`, `Name` (interface).
Two adapters (e.g. Realtek RTL8822CE = "Wi-Fi" + 8821CU USB = "Wi-Fi 3") give two RSSI
vectors → better fingerprint for self-localization.

## Connected AP / gateway discovery
```
netsh wlan show interfaces          # SSID, BSSID, band, channel, RSSI
ipconfig                            # IPv4 + gateway (192.168.31.1)
arp -a                              # maps live IP->MAC on each interface
```
OUI hint: Jio AirFiber = `9c:d4:a6` / `1e:d4:a6`. SSID `AirFiber-*`. Single AP, no mesh.

## Read-only router discovery (NO auth, NO config change)
- Probe ports: `for p in 23 53 80 443 8080 8443; do (exec 3<>/dev/tcp/GW/$p) ...`
- `curl -sk -I https://GW/` → login page self-identifies (e.g. "Jio application")
- Common status endpoints (`/status`,`/api/v1/status`,`/cgi-bin/luci`) → 404 on Jio SPA.
  Client list needs login → skip; use LAN sweep for a proxy instead.

## LAN live device enumeration (no creds)
```
ping -n 1 -w 300 192.168.31.X      # threaded for all X in /24
arp -a                              # collect IP->MAC, drop ff-ff-ff-ff-ff-ff
```
Router IP + this-host IPs excluded = approx people.

## ThreadingHTTPServer (critical)
`http.server.HTTPServer` is SINGLE-THREADED. A ~10s sweep endpoint will block every other
request (client sees HTTP 000 / timeout). Always use `ThreadingHTTPServer` for dashboards
that mix a slow sweep endpoint with fast ones.

#!/usr/bin/env python3
"""ThreadingHTTPServer skeleton for a WiFi/LAN 3D dashboard.
Endpoints: /api/floorplan, /api/coverage, /api/devices (LAN sweep),
/api/rooms (tally via registry.json), /api/selfloc (fingerprint self-loc).
Uses ThreadingHTTPServer (single-thread blocks on the ~10s sweep)."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json, os, re, subprocess, threading, time, math

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = {"devices": None, "ts": 0}
CACHE_TTL = 30

def load_json(name, default):
    p = os.path.join(HERE, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else default

def get_interfaces():
    out = subprocess.run(["netsh", "wlan", "show", "interfaces"],
                         capture_output=True, text=True).stdout
    return {m.group(1).strip(): int(m.group(2)) for m in re.finditer(r"Name\s*:\s*(.+?)\s.*?Rssi\s*:\s*(-?\d+)", out, re.S)}

def sweep(base="192.168.31"):
    def ping(i):
        subprocess.run(["ping", "-n", "1", "-w", "300", f"{base}.{i}"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
    ts = [threading.Thread(target=ping, args=(i,)) for i in range(1, 255)]
    [t.start() for t in ts]; [t.join() for t in ts]
    arp = subprocess.run(["arp", "-a"], capture_output=True, text=True).stdout
    rows = re.findall(rf"({base}\.\d+)\s+([0-9a-f-]+)\s+(\w+)", arp, re.I)
    seen = {ip: mac for ip, mac, typ in rows if mac != "ff-ff-ff-ff-ff-ff"}
    return [{"ip": ip, "mac": mac} for ip, mac in sorted(seen.items())]

def get_devices(force=False):
    now = time.time()
    if force or CACHE["devices"] is None or now - CACHE["ts"] > CACHE_TTL:
        CACHE["devices"] = sweep(); CACHE["ts"] = now
    return CACHE["devices"]

def selfloc():
    fps = load_json("fingerprints.json", {"fingerprints": []}).get("fingerprints", [])
    if not fps:
        return {"x": None, "y": None, "error": "no fingerprints"}
    live = get_interfaces()
    best, bestd = None, 1e9
    for f in fps:
        keys = set(live) | set(f["rssi"])
        d = sum((live.get(k, -95) - f["rssi"].get(k, -95)) ** 2 for k in keys) ** 0.5
        if d < bestd:
            bestd, best = d, f
    return {"x": best["x"], "y": best["y"], "best": round(bestd, 1)}

class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        self.send_response(code); self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers()
        self.wfile.write(body.encode() if isinstance(body, str) else body)
    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/api/selfloc":
            self._send(200, json.dumps(selfloc()))
        elif p == "/api/devices":
            self._send(200, json.dumps({"count": len(get_devices()), "devices": get_devices()}))
        elif p == "/api/floorplan":
            self._send(200, json.dumps(load_json("floorplan.json", {})))
        else:
            self._send(404, json.dumps({"error": "not found"}))
    def log_message(self, *a): pass

if __name__ == "__main__":
    print("dashboard on http://localhost:8787 (ThreadingHTTPServer)")
    ThreadingHTTPServer(("0.0.0.0", 8787), H).serve_forever()

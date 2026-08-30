#!/usr/bin/env python3
"""Local read-only dashboard server (stdlib only). Endpoints:
 /                dashboard   /api/floorplan   /api/coverage
 /api/devices     live LAN list (cached 30s, ping+ARP)
 /api/rooms       AUTO per-room tally: live sweep joined with registry.json
No router login, no creds, no config change."""
import json, os, re, subprocess, threading, time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = {"devices": None, "ts": 0}; CACHE_TTL = 30; _lock = threading.Lock()

def load_json(name, default):
    p = os.path.join(HERE, name)
    if os.path.exists(p):
        try: return json.load(open(p, encoding="utf-8"))
        except Exception: return default
    return default

def sweep_devices():
    base = "192.168.31"
    def ping(i):
        subprocess.run(["ping", "-n", "1", "-w", "300", f"{base}.{i}"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
    ts = [threading.Thread(target=ping, args=(i,)) for i in range(1, 255)]
    for t in ts: t.start()
    for t in ts: t.join()
    arp = subprocess.run(["arp", "-a"], capture_output=True, text=True).stdout
    seen = {}
    for ip, mac, typ in re.findall(rf"({base}\.\d+)\s+([0-9a-f-]+)\s+(\w+)", arp, re.I):
        if mac == "ff-ff-ff-ff-ff-ff": continue
        if typ == "dynamic" or ip in seen: seen[ip] = mac
    return [{"ip": ip, "mac": mac} for ip, mac in sorted(seen.items())]

def get_devices(force=False):
    now = time.time()
    with _lock:
        if force or CACHE["devices"] is None or now - CACHE["ts"] > CACHE_TTL:
            try: CACHE["devices"] = sweep_devices()
            except Exception: CACHE["devices"] = CACHE["devices"] or []
            CACHE["ts"] = now
        return CACHE["devices"]

def room_tally():
    reg = load_json("registry.json", {"devices": [], "exclude": []})
    fp = load_json("floorplan.json", {"rooms": []})
    live = get_devices()
    exclude = {e.lower() for e in reg.get("exclude", [])}
    by_mac = {e["mac"].lower(): e for e in reg.get("devices", [])}
    rooms = {r["name"]: {"devices": 0, "people_set": set(), "members": []}
             for r in fp.get("rooms", [])}
    rooms["Unassigned"] = {"devices": 0, "people_set": set(), "members": []}
    for d in live:
        mac = d["mac"].lower()
        if mac in exclude or d["mac"] == "---": continue
        e = by_mac.get(mac); room = (e or {}).get("room", "Unassigned")
        if room not in rooms: rooms[room] = {"devices": 0, "people_set": set(), "members": []}
        rooms[room]["devices"] += 1
        person = (e or {}).get("person", "")
        if person: rooms[room]["people_set"].add(person)
        rooms[room]["members"].append(f"{d['ip']} {('('+person+')' if person else '')}")
    return {"as_of": int(time.time()), "rooms": [
        {"room": n, "devices": v["devices"],
         "people": len(v["people_set"]) if v["people_set"] else (v["devices"] if n != "Unassigned" else 0),
         "members": v["members"]} for n, v in rooms.items()], "total_live": len(live)}

class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        self.send_response(code); self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers()
        self.wfile.write(body.encode() if isinstance(body, str) else body)
    def do_GET(self):
        p = urlparse(self.path).path
        if p in ("/", "/index.html"):
            self._send(200, open(os.path.join(HERE, "dashboard.html"), encoding="utf-8").read(), "text/html")
        elif p == "/api/floorplan":
            self._send(200, open(os.path.join(HERE, "floorplan.json"), encoding="utf-8").read())
        elif p == "/api/coverage":
            self._send(200, open(os.path.join(HERE, "survey.json"), encoding="utf-8").read())
        elif p == "/api/devices":
            self._send(200, json.dumps({"count": len(get_devices("refresh=1" in self.path)),
                                        "devices": get_devices("refresh=1" in self.path),
                                        "as_of": int(time.time())}))
        elif p == "/api/rooms":
            self._send(200, json.dumps(room_tally()))
        else: self._send(404, json.dumps({"error": "not found"}))
    def log_message(self, *a): pass

if __name__ == "__main__":
    print("WiFi 3D dashboard: http://localhost:8787")
    HTTPServer(("0.0.0.0", 8787), H).serve_forever()

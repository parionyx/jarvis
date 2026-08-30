#!/usr/bin/env python3
"""Read-only LAN device enumeration: threaded /24 ping + arp. No creds, no config change.
Returns list of {ip, mac}. Excludes broadcast ff-ff-ff-ff-ff-ff."""
import re, subprocess, threading

def sweep(base="192.168.31"):
    def ping(i):
        subprocess.run(["ping", "-n", "1", "-w", "300", f"{base}.{i}"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
    threads = [threading.Thread(target=ping, args=(i,)) for i in range(1, 255)]
    for t in threads: t.start()
    for t in threads: t.join()
    arp = subprocess.run(["arp", "-a"], capture_output=True, text=True).stdout
    rows = re.findall(rf"({base}\.\d+)\s+([0-9a-f-]+)\s+(\w+)", arp, re.I)
    seen = {}
    for ip, mac, typ in rows:
        if mac == "ff-ff-ff-ff-ff-ff":
            continue
        if typ == "dynamic" or ip in seen:
            seen[ip] = mac
    return [{"ip": ip, "mac": mac} for ip, mac in sorted(seen.items())]

if __name__ == "__main__":
    import json
    print(json.dumps(sweep(), indent=2))

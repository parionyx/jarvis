#!/usr/bin/env python3
"""lan_sweep.py — read-only live-device enumerator (no router creds).
Threaded /24 ICMP ping sweep (primes ARP) then parse `arp -a`.
Usage: python lan_sweep.py [subnet_base]   e.g. python lan_sweep.py 192.168.31
Prints JSON list of {ip, mac}. Backgrounding via & is blocked in some shells,
so this uses threading instead."""
import json, re, subprocess, sys, threading

BASE = sys.argv[1] if len(sys.argv) > 1 else "192.168.31"

def ping(i):
    subprocess.run(["ping", "-n", "1", "-w", "300", f"{BASE}.{i}"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)

def sweep():
    ts = [threading.Thread(target=ping, args=(i,)) for i in range(1, 255)]
    for t in ts: t.start()
    for t in ts: t.join()
    arp = subprocess.run(["arp", "-a"], capture_output=True, text=True).stdout
    seen = {}
    for ip, mac, typ in re.findall(rf"({BASE}\.\d+)\s+([0-9a-f-]+)\s+(\w+)", arp, re.I):
        if mac == "ff-ff-ff-ff-ff-ff":
            continue
        if typ == "dynamic" or ip in seen:
            seen[ip] = mac
    return [{"ip": ip, "mac": mac} for ip, mac in sorted(seen.items())]

if __name__ == "__main__":
    print(json.dumps(sweep(), indent=2))

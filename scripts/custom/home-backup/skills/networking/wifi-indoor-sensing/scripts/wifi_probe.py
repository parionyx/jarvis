#!/usr/bin/env python3
"""Read RSSI vector from every connected WiFi interface (read-only, no creds)."""
import re, subprocess

def get_interfaces():
    out = subprocess.run(["netsh", "wlan", "show", "interfaces"],
                         capture_output=True, text=True).stdout
    blocks = re.split(r"\n\s*(?=Name\s+:)", out)
    res = []
    for b in blocks:
        name = re.search(r"Name\s*:\s*(.+)", b)
        rssi = re.search(r"Rssi\s*:\s*(-?\d+)", b)
        band = re.search(r"Band\s*:\s*(\S+)", b)
        ssid = re.search(r"SSID\s*:\s*(.+)", b)
        if name and rssi:
            res.append({"name": name.group(1).strip(),
                        "rssi": int(rssi.group(1)),
                        "band": band.group(1) if band else "?",
                        "ssid": ssid.group(1).strip() if ssid else ""})
    return res

def rssi_vector():
    return {d["name"]: d["rssi"] for d in get_interfaces()}

if __name__ == "__main__":
    import json
    print(json.dumps(rssi_vector(), indent=2))

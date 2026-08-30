#!/usr/bin/env python3
"""Manual WiFi RSSI site-survey walker. Read-only: reads netsh on the scanner PC.
Usage: edit floorplan.json, then `python survey_walk.py`, stand at each prompt."""
import json, re, subprocess, os
HERE = os.path.dirname(os.path.abspath(__file__))
STEP = 1.0

def read_rssi():
    out = subprocess.run(["netsh", "wlan", "show", "interfaces"],
                         capture_output=True, text=True).stdout
    rssi = re.search(r"Rssi\s*:\s*(-?\d+)", out)
    band = re.search(r"Band\s*:\s*(\S+)", out)
    return (int(rssi.group(1)) if rssi else None, (band.group(1) if band else "?"))

def points_in_room(room):
    x0, y0, w, d = room["x"], room["y"], room["w"], room["d"]
    xi = max(1, int(w / STEP)); yi = max(1, int(d / STEP))
    return [(round(x0 + w*i/xi, 2), round(y0 + d*j/yi, 2))
            for i in range(xi+1) for j in range(yi+1)]

def main():
    fp = json.load(open(os.path.join(HERE, "floorplan.json")))
    survey = {"note": "auto", "samples": []}
    for room in fp["rooms"]:
        for (px, py) in points_in_room(room):
            input(f"Stand at ({px}, {py}) m in '{room['name']}' and press Enter...")
            rssi, band = read_rssi()
            print(f"  RSSI={rssi} band={band}")
            survey["samples"].append({"x": px, "y": py, "rssi": rssi, "band": band})
    json.dump(survey, open(os.path.join(HERE, "survey.json"), "w"), indent=2)
    print(f"Saved {len(survey['samples'])} samples to survey.json")

if __name__ == "__main__":
    main()

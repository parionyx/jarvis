#!/usr/bin/env python3
"""Count AiSensy leads for a given IST day from the cumulative export CSV.

Usage:
  python parse_aisensy_leads.py [--csv PATH] [--date YYYY-MM-DD] [--tz-hours 5.5]

By default picks the newest lead-submissions-*.csv in ~/Downloads and uses today IST.
Timestamps in 'Last Submission At' are UTC ISO (...Z); converted to IST (+tz).
The CSV is cumulative — count by timestamp, never by the filename date.
"""
import argparse, csv, glob, os, sys
from collections import Counter
from datetime import datetime, timezone, timedelta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv")
    ap.add_argument("--date")
    ap.add_argument("--tz-hours", type=float, default=5.5)
    args = ap.parse_args()
    ist = timezone(timedelta(hours=args.tz_hours))

    if args.csv:
        path = args.csv
    else:
        dl = os.path.join(os.path.expanduser("~"), "Downloads")
        cands = glob.glob(os.path.join(dl, "lead-submissions-*.csv"))
        if not cands:
            print("No lead-submissions-*.csv found in ~/Downloads. Pass --csv PATH.",
                  file=sys.stderr)
            return 1
        path = max(cands, key=os.path.getmtime)

    today = (datetime.strptime(args.date, "%Y-%m-%d").date()
             if args.date else datetime.now(ist).date())

    rows = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for r in reader:
            ts = (r.get("Last Submission At") or "").strip()
            if not ts:
                continue
            ts = ts.replace("Z", "+00:00")
            try:
                dt = datetime.fromisoformat(ts)
            except ValueError:
                continue
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            r["_ist"] = dt.astimezone(ist)
            rows.append(r)

    today_rows = [r for r in rows if r["_ist"].date() == today]
    bd = Counter(r["_ist"].date() for r in rows)

    print(f"CSV: {path}")
    print(f"Total leads in file (with timestamp): {len(rows)}")
    print("Received by IST day:")
    for d in sorted(bd):
        print(f"  {d} : {bd[d]}")
    print(f"\nTODAY ({today}) leads: {len(today_rows)}")
    for r in sorted(today_rows, key=lambda x: x["_ist"]):
        name = (r.get("Name") or "").strip()
        phone = (r.get("Phone Number") or "").strip()
        ad = (r.get("Last Ad Name") or "").strip()
        print(f"  {r['_ist'].strftime('%H:%M')} | {name} | {phone} | {ad}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

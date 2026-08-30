# Read-only Sheets structure probe — reuse the google-workspace auth.
# Run:  python <this file> SHEET_ID
# Prints title, tab names, sheetIds, grid size, approx used rows, and the
# first (header) row of each tab. NO cell writes. Safe for verification tasks.
import sys, json
sys.path.insert(0, "C:/Users/works_ar/AppData/Local/hermes/skills/productivity/google-workspace/scripts")
from google_api import build_service

sid = sys.argv[1]
svc = build_service("sheets", "v4")
# NOTE: do NOT request data.lastRow — it is an invalid field path and 400s.
meta = svc.spreadsheets().get(
    spreadsheetId=sid,
    fields="properties.title,sheets(properties(title,sheetId,gridProperties(rowCount,columnCount)),data(startColumn,startRow,rowData(values(userEnteredValue))))",
).execute()

out = {"title": meta["properties"]["title"], "sheets": []}
for s in meta.get("sheets", []):
    p = s["properties"]
    grid = p.get("gridProperties", {})
    data = s.get("data", [{}])[0] if s.get("data") else {}
    rowdata = data.get("rowData", []) if data else []
    used = (data.get("startRow", 0) + len(rowdata)) if rowdata else None
    header = []
    if rowdata:
        for c in (rowdata[0].get("values", []) if rowdata[0] else []):
            v = c.get("userEnteredValue", {})
            header.append(v.get("stringValue") or v.get("numberValue"))
    out["sheets"].append({
        "name": p["title"],
        "sheetId": p.get("sheetId"),
        "grid_rows": grid.get("rowCount"),
        "grid_cols": grid.get("columnCount"),
        "approx_used_rows": used,
        "first_row": header,
    })
print(json.dumps(out, indent=2, ensure_ascii=False))

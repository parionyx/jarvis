# Excel Export Layout (openpyxl) — Yesterday's Leads

Verified approach: filter Zoho `Leads` dump by IST window in Python, then build workbook.

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from datetime import datetime, timezone, timedelta
import json

ist = timezone(timedelta(hours=5, minutes=30))
# leads = [...] from spillover file (see SKILL.md)
# filter: d21_start <= parse_time(Created_Time) < d22_start

wb = Workbook(); ws = wb.active; ws.title = "21 Aug Leads"
headers = ["S.No","Source","Full Name","Phone","Email","Lead Status",
           "Property Query / Company","Owner","Created Time (IST)",
           "Modified Time (IST)","Lead Type","Annual Revenue"]
hdr_fill = PatternFill("solid", fgColor="1F4E78")
hdr_font = Font(bold=True, color="FFFFFF", size=11)
thin = Side(style="thin", color="BFBFBF")
border = Border(left=thin,right=thin,top=thin,bottom=thin)
src_fill = {"99acress": PatternFill("solid", fgColor="DDEBF7"),
            "Housing":  PatternFill("solid", fgColor="E2EFDA")}
for c,h in enumerate(headers,1):
    cell=ws.cell(1,c,h); cell.fill=hdr_fill; cell.font=hdr_font
    cell.alignment=Alignment(horizontal="center",vertical="center",wrap_text=True); cell.border=border
for i,l in enumerate(leads,1):
    src=l.get("Lead_Source") or "other"
    owner=(l.get("Owner") or {}).get("name","")
    row=[i,src,l.get("Full_Name",""),l.get("Phone",""),l.get("Email",""),
         l.get("Lead_Status",""),l.get("Company",""),owner,
         (parse_time(l.get("Created_Time")) or datetime.min).strftime("%Y-%m-%d %H:%M:%S"),
         (parse_time(l.get("Modified_Time")) or datetime.min).strftime("%Y-%m-%d %H:%M:%S"),
         l.get("Lead_Type",""), l.get("Annual_Revenue","")]
    for c,v in enumerate(row,1):
        cell=ws.cell(i+1,c,v); cell.border=border
        cell.alignment=Alignment(vertical="center",wrap_text=True)
        if src in src_fill: cell.fill=src_fill[src]
ws.freeze_panes="A2"

# Summary sheet
ws2=wb.create_sheet("Summary")
ws2["A1"]="Daily Lead Report — 21 August 2026 (IST)"; ws2["A1"].font=Font(bold=True,size=14,color="1F4E78")
ws2["A3"]="Total Leads"; ws2["B3"]=len(leads)
ws2["A4"]="99acres (99acress)"; ws2["B4"]=sum(1 for l in leads if l.get("Lead_Source")=="99acress")
ws2["A5"]="Housing"; ws2["B5"]=sum(1 for l in leads if l.get("Lead_Source")=="Housing")
for r in (3,4,5): ws2.cell(r,1).font=Font(bold=True)

out=r"C:\Users\works_ar\AppData\Local\hermes\cron\output\leads_21aug2026.xlsx"
wb.save(out)
```
Notes: column widths ~[6,12,16,14,22,12,50,16,20,20,12,14]; row1 height 30.
Email is masked `<phone>@99acres.com`; Housing may be null. Generic names ("USER"/"Name") come from portal.

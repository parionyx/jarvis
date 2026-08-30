# AiSensy Leads — Export & Date Parsing

The AiSensy Leads UI shows only **cumulative** totals (Total leads / CTWA leads / Form submissions). There is no visible date filter, and the accessibility tree does not expose individual lead-row text (DataItem labels are empty). To get today's leads, export the CSV and parse timestamps.

## Path to the Leads table
Dashboard → left rail **Ads Manager** (clicking the section expands it) → click **Leads** (button in the Ads Manager sub-rail). Sub-rail buttons: Ads Manager, Leads, Forms, Audiences, Events, Setup.
- The Leads view header shows: Total leads, Form submissions, CTWA leads (all cumulative).
- Controls present: **Export CSV**, **Sync from Meta** (re-pull from Meta if stale), search box, "Form: All Forms", "Ad: All Ads" filters, tabs: All Leads / Lead Form Submissions / CTWA Leads.
- Click the actual **Button** element, not the adjacent text label (clicking the label alone may not navigate).

## Export CSV
- Click **Export CSV** (top-right of the leads table).
- Downloads `lead-submissions-<PROJECT_ID>-YYYY-MM-DD.csv` to `~/Downloads`.
- ⚠️ The filename date is the export date, NOT a filter. The file contains ALL cumulative leads, not just today's. Count by parsing timestamps, never by assuming file contents == today.

## CSV schema
```
Phone Number, Name, Email, Lead Type, Last Ad Name, Last Form Name, Submission Count, Last Submission At, First Submission At
```
- `Lead Type`: `ctwa` for Click-to-WhatsApp ads, blank/empty for form leads.
- `Last Submission At` / `First Submission At`: ISO-8601 **UTC**, e.g. `2026-08-14T10:59:00.000Z`.
- `Last Ad Name`: e.g. `DAXIN_VISTAS_10/08/2026`.

## UTC → IST conversion
Timestamps are UTC (`Z`). Indian Standard Time = UTC + 5:30.
- `2026-08-14T10:59:00.000Z` → IST `2026-08-14 16:29`
- `2026-08-14T05:37:40.000Z` → IST `2026-08-14 11:07`
To count today's leads: convert `Last Submission At` to IST, filter rows where IST date == today.

## Worked example (2026-08-14)
8 cumulative CTWA leads from ad `DAXIN_VISTAS_10/08/2026`:

| IST date | count |
|----------|-------|
| 11 Aug | 2 |
| 12 Aug | 2 |
| 13 Aug | 2 |
| 14 Aug (today) | 2 |

Today (14 Aug) = 2 leads: raghvendra Singh (11:07 IST), Harish Chander (16:29 IST).

## computer_use click quirk (Cua Driver 0.17)
`computer_use` **element-index** clicks are refused: *"pass element_token or snapshot_id with element_index"*. Use **coordinate clicks** (`action: click, coordinate: [x,y]`) in background mode instead, deriving the point from the element's native `bounds` center. AX `bounds` are in native desktop coordinates (not screenshot px) — use them directly as the coordinate.

# IST vs UTC date-window handling for n8n audits

The user (Abhishek) operates on **Indian Standard Time** and gives calendar windows in
DD/MM/YYYY (e.g. "1/08/2026 se 16/08/2026 tak"). n8n `search_executions` bounds are **UTC**.

## The trap
`startedAfter: 2026-08-01T00:00:00.000Z` is **Aug 1 05:30 IST**, not midnight. Any n8n run
between IST Aug 1 00:00 and 05:30 is silently excluded — even though its Zoho lead (created in
IST) falls inside the user's window. This produces a false "complete" run set.

## Conversion rule
```
IST datetime  = UTC datetime + 5h30m
UTC window start = IST window start − 5h30m
UTC window end   = IST window end   + 5h30m
```
For "1 Aug → 16 Aug 2026" (full IST days):
- `startedAfter`  = `2026-07-31T18:30:00.000Z`
- `startedBefore` = `2026-08-16T18:30:00.000Z`  (16 Aug 23:59 IST = 16 Aug 18:29 UTC next day)

## Verification after pull
- Check the earliest returned run's `startedAt`. If it is ≥ the IST window start, your bounds
  were correct. If runs exist *before* your window, the IST window start is still covered — good.
- If the earliest run is *after* the IST window start (e.g. first run is Aug 2), you dropped the
  first-day early runs → widen `startedAfter`.
- Filter Zoho-side strictly by IST `Created_Time` (see zoho-crosscheck.md); do NOT trust n8n
  UTC `startedAt` as the CRM-creation timestamp — they differ (n8n fires, then Zoho creates).

## Do NOT
- Pass `limit > 200` to `search_executions` — the API errors. Stick to 200 and use `count`/`estimated`.

---
name: spreadsheet-merge-dedupe
description: "Merge lead exports into one clean deduped sheet."
---

# Merge & Dedupe Multi-Source Spreadsheet Exports

Recurring task: the user drops 2+ raw export files (portal responses, CRM pulls, scraped leads) and wants a single clean Excel/CSV with a fixed header, duplicates removed, and some columns (often email) dropped.

## Workflow
1. **Determine each file's REAL format** before parsing (extension lies — see Pitfalls).
2. Load each file into a DataFrame. Inspect `df.shape`, `df.columns`, and a few sample values per column.
3. **Build an explicit column map** from each source's columns to the user's requested target header. Don't guess — print the source columns and confirm the mapping.
4. **Normalize the dedup key** (usually phone) to a comparable form across sources.
5. **Reconcile divergent formats** (dates, prices) into one consistent representation.
6. Concatenate all per-source row dicts into one DataFrame.
7. **Dedupe** on the normalized key with `keep='first'`.
8. **Drop** the helper key column and any columns the user asked to remove (e.g. email).
9. **Re-number** with an explicit `Sr.` (or `Sno`) column starting at 1.
10. **Verify** the output (see Verification) before reporting done.

## Target-header pattern
When the user supplies an exact header, honor it verbatim. Typical real-estate lead header:
`Sr. | date | time | name | number | project | BHK | source | other | Price | Business Segment | Response From | remark`
Map freely: source CSV "Product Type" → `source`; "Assigned To" → `remark`; "Service Type" Rent/Resale → `Business Segment`. Put leftover context (Locality, City, IDs) into a catch-all `other` column joined by ` | `.

## Pitfalls (read before parsing!)
- **FAKE `.xls` = tab-separated text.** A file named `*.xls` may actually be TSV. `pd.read_excel` then fails with `Excel file format cannot be determined, you must specify an engine manually` and xlrd raises `Unsupported format, or corrupt file: Expected BOF record; found b'Service '`. FIX: read with `pd.read_csv(path, sep='\t')`. Detect up front: `head = open(path,'rb').read(8)` — real legacy xls starts `D0CF11E0`, xlsx starts `PK\x03\x04`, but tab/csv starts with printable ASCII text (e.g. `b'Service '`). When in doubt, try `sep='\t'`, then `pd.read_excel`.
- **Cross-source phone formats.** One file: `91-8796649995`; another: `(+91)-9982013333`. Normalize: strip all non-digits, drop a leading `91`, take the **last 10 digits** as the dedup key; display as `91-XXXXXXXXXX`. This is the single most important step — without it, "duplicate numbers" span both files silently.
- **Date formats differ per source.** CSV portal: `MM/DD/YYYY HH:MM`. Scraped XLS: `DD/MM/YYYY`. Parse with explicit `pd.to_datetime(s, format=..., errors='coerce')`. Heuristic to detect DD/MM: if the first numeric part of the date ever exceeds 12, it's DD/MM. Split date and time into separate columns for the target header.
- **Email column removal.** Don't assume it exists in every source — confirm, then drop only from the combined frame. One source may have no email at all.
- **Keep a helper column, drop it last.** Carry `number_key` through merge/dedupe, then `df.drop(columns=['number_key'])` before writing. Forgetting to drop leaves a stray column.
- **Blank/anonymous names.** Portal exports sometimes anonymize as `USER` / `Name`. Leave as-is unless asked to flag — don't invent data.

## Verification (run before declaring done)
Re-open the written file and assert:
- `len(df) == df['number'].nunique()` (dedupe worked, no blanks)
- `'email' not in [c.lower() for c in df.columns]` (dropped)
- `list(df.columns) == requested_header`
- Print `total_combined`, `dups_removed`, `final_rows` so the user sees the math.

See `references/gotchas.md` for copy-paste code snippets (format detection, phone normalization, date reconciliation, the merge script skeleton).

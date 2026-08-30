# Gotchas & Copy-Paste Snippets — spreadsheet-merge-dedupe

## 1. Detect real file format (extension lies)
```python
with open(path, 'rb') as f:
    head = f.read(8)
print(head.hex(), repr(head[:20]))
# D0CF11E0 -> legacy .xls (xlrd)
# 504B0304 ('PK\x03\x04') -> .xlsx (openpyxl)
# printable ASCII like b'Service ' / b'col1\tcol2' -> CSV/TSV
```
If `pd.read_excel` throws `Excel file format cannot be determined` or xlrd `Expected BOF record; found b'Service '`, the file is TSV/CSV:
```python
df = pd.read_csv(path, sep='\t')      # for the fake-xls TSV case
# or
df = pd.read_csv(path)                # for normal CSV
```

## 2. Normalize phone for cross-source dedup
```python
import re
def norm_num(raw):
    if pd.isna(raw):
        return ("", "")
    digits = re.sub(r'\D', '', str(raw))     # '(+91)-9982013333' -> '919982013333'
    if digits.startswith('91') and len(digits) >= 12:
        digits = digits[2:]                  # drop country code
    key = digits[-10:] if len(digits) >= 10 else digits
    return (f"91-{key}" if key else "", key) # (display, dedup_key)
```
`91-8796649995` and `(+91)-8796649995` both collapse to key `8796649995`.

## 3. Reconcile date formats
```python
def norm_mmddyyyy(s):   # CSV portal: '08/21/2026 16:50'
    dt = pd.to_datetime(str(s), format="%m/%d/%Y %H:%M", errors='coerce')
    if pd.isna(dt): dt = pd.to_datetime(str(s), errors='coerce')
    return (dt.strftime("%d/%m/%Y"), dt.strftime("%H:%M")) if not pd.isna(dt) else ("","")

def norm_ddmmyyyy(s):   # scraped XLS: '01/08/2026'
    dt = pd.to_datetime(str(s), format="%d/%m/%Y", errors='coerce')
    return (dt.strftime("%d/%m/%Y"), "") if not pd.isna(dt) else ("","")
```
DD/MM detector: if any date's first slash-part > 12, the source is DD/MM.

## 4. Merge + dedupe skeleton
```python
rows = []
# append per-source dicts: {date, time, name, number, number_key, project, BHK,
#                            source, other, Price, Business Segment, Response From, remark}
df = pd.DataFrame(rows)
total = len(df)
df = df.drop_duplicates(subset=['number_key'], keep='first').copy()
dups = total - len(df)
df = df.drop(columns=['number_key'])
df.insert(0, 'Sr.', range(1, len(df)+1))
df.to_excel(out_path, index=False)
print(total, dups, len(df))   # math for the user
```

## 5. Verification asserts
```python
chk = pd.read_excel(out_path)
assert len(chk) == chk['number'].nunique()
assert 'email' not in [c.lower() for c in chk.columns]
assert list(chk.columns) == requested_header
```

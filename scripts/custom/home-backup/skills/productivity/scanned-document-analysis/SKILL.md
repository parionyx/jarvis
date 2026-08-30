---
name: scanned-document-analysis
description: "Extract data from scanned PDFs via vision/OCR pipeline."
version: 1.0.0
author: JARVIS
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [PDF, OCR, Vision, Document-Analysis, Scanned-Documents]
    related_skills: [ocr-and-documents, pdf, computer-use]
---

# Scanned Document Analysis

Use when you need to extract structured information from **scanned PDFs, image-based PDFs, or multi-page document images** where no text layer exists.

This skill covers the full pipeline: PDF → images → vision/OCR → structured extraction → synthesis.

## When to Use

- PDF has no extractable text (scanned, photographed, or image-based)
- Multi-page documents requiring page-by-page analysis
- Facebook Ads Library exports, receipts, forms, reports, contracts
- Any document where `read_file` returns "PDF has no extractable text" warning

## Pipeline Overview

```
PDF (scanned)
    │
    ├─► pdftoppm → PNG pages (Step 1)
    │
    ├─► Vision Model Analysis (PRIMARY) → Structured JSON/text (Step 2a)
    │       │
    │       └─► If vision fails: OCR Fallback (Step 2b)
    │
    └─► Synthesis & Aggregation (Step 3)
```

---

## Step 1: PDF → Images (Required)

```bash
# Convert all pages to high-res PNG
pdftoppm -png -r 200 "input.pdf" "output_prefix"

# Specific pages only
pdftoppm -png -r 200 -f 1 -l 3 "input.pdf" "output_prefix"

# Output: output_prefix-1.png, output_prefix-2.png, ...
```

**Windows/Git Bash**: Use forward-slash paths for output: `C:/Users/.../output_prefix`

---

## Step 2a: Vision Model Analysis (Preferred)

**Primary method** — use `vision_analyze` on each page image:

```python
# For each page image:
vision_analyze(
    image_url="path/to/page-N.png",
    question="Extract all visible structured data: advertiser names, campaign IDs, dates, pricing, metrics, CTA buttons, platform icons. Return as structured list."
)
```

**Prompt template for Ads Library pages:**
> "This is a Facebook Ads Library screenshot. Extract all visible campaign/advertiser information: company names, Library IDs, launch dates, platforms (FB/IG/WhatsApp), number of ad variants using same creative, ad copy text, pricing, property details, CTA buttons. Return as structured data per ad card."

### Vision Model Requirements

- Active model MUST support vision (image input)
- Current models with vision: `gpt-4o`, `gemini-2.0-flash`, `claude-3.5-sonnet`, `gpt-4o-mini`
- Models WITHOUT vision: `nemotron-3-ultra`, `mimo-v2.5-free`, most local models
- **Check first**: if `vision_analyze` returns "No endpoints found that support image input", the active model lacks vision

---

## Step 2b: OCR Fallback (When Vision Unavailable)

Use when vision model is not available or fails.

### Option A: Tesseract CLI
```bash
# Single page
tesseract "page-N.png" "output" -l eng

# Batch
for i in {1..8}; do tesseract "page-$i.png" "page-$i" -l eng; done
```

### Option B: Python + pytesseract
```bash
pip install pytesseract pillow
# Also requires system: tesseract-ocr (Windows: UB Mannheim installer)

python -c "
from PIL import Image
import pytesseract
for i in range(1, 9):
    img = Image.open(f'page-{i}.png')
    text = pytesseract.image_to_string(img)
    print(f'=== PAGE {i} ===')
    print(text)
"
```

### Option C: marker-pdf (High-quality, handles layout)
```bash
pip install marker-pdf
# First run downloads ~2.5GB models

marker_single "input.pdf" --output_dir ./output
# Produces markdown + images + metadata
```

---

## Step 3: Synthesis & Aggregation

After extracting data from all pages, combine into structured output:

### For Facebook Ads Library:
```markdown
## Campaign Summary

| Advertiser | Ads Seen | Date Range | Platforms | Key Metrics |
|------------|----------|------------|-----------|-------------|
| Godrej Samaris, Gurugram | 12+ | Aug 5-13 | FB + IG | 3-5 variants each |
| Godrej Properties | 8+ | Aug 6-13 | FB + IG | 3-4 variants each |
| ... | ... | ... | ... | ... |

**Total Active Ads**: ~140 (per search results)
**Property**: Godrej Samaris, Sector 53B, Golf Course Road
**Pricing**: 3BHK ₹9.68Cr | 4BHK ₹12.29Cr
```

---

## Common Pitfalls & Solutions

| Issue | Solution |
|-------|----------|
| `vision_analyze` fails with 404 | Switch to vision-capable model OR use OCR fallback |
| pdftoppm "Could not write image" | Use absolute Windows path: `C:/Users/.../prefix` not `/tmp/...` |
| Tesseract not installed | `pip install pytesseract` + system tesseract-ocr |
| marker-pdf OOM / slow | Use CPU mode, reduce pages, or use vision instead |
| Partial page captures | Increase `-r 300` for higher DPI |

---

## Reference Files

- `references/facebook-ads-library-pdf-workflow.md` — Worked example from Godrej Samaris analysis
- `scripts/pdf_to_images.sh` — Batch conversion helper
- `scripts/batch_vision_extract.py` — Batch vision analysis (when model supports it)
- `scripts/batch_ocr_extract.py` — Batch OCR fallback

---

## Quick Start Checklist

- [ ] Confirm PDF is scanned (no text layer)
- [ ] Run `pdftoppm -png -r 200 "file.pdf" "prefix"`
- [ ] Test `vision_analyze` on page 1
- [ ] If vision works: batch analyze all pages
- [ ] If vision fails: install OCR (tesseract or marker-pdf)
- [ ] Synthesize cross-page results
- [ ] Save reference file for future similar documents
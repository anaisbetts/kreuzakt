# bug: pdf-oxide paints blank pages when Image XObject `/Height` is an indirect reference

## Summary

With `force_ocr = true` and the `vlm` OCR backend, Xberg returns:

```text
OCR error: VLM OCR returned no content (model=…)
```

for image-only scanned PDFs whose embedded JPEG XObjects declare `/Height` (and often `/Length`) as **indirect object references**.

This is **not** a VLM refusal. pdf-oxide rasterizes the page as a blank white PNG; the VLM correctly reports “no text” and returns empty content. The same JPEG works when `/Height` is a direct integer.

Related: #1355 fixed the case where image XObject decode **errors**. Here decode/render **succeeds** with a blank canvas, so the “OCR the raw embedded image” fallback never runs.

## Environment

- `@xberg-io/xberg` **1.0.14** (current npm latest)
- linux x64
- VLM via OpenRouter (`google/gemini-3.7-flash`) — any vision model reproduces; the page image sent upstream is blank

## Root cause

Brother scanner firmware (and possibly other producers) emit Image XObjects like:

```
<</Type/XObject/Subtype/Image/Filter/DCTDecode/BitsPerComponent 8
  /ColorSpace/DeviceRGB/Width 2447/Height 8 0 R/Length 9 0 R>>
stream
…JPEG…
endstream
```

where object `8 0` is the integer `3469`.

pdf-oxide appears not to resolve `/Height N 0 R` when painting the XObject. The page render is an all-white bitmap at the expected aspect ratio. VLM OCR then follows its prompt (“if no text, return empty string”) → Xberg surfaces `VLM OCR returned no content`.

`pypdf` preserves the indirect `/Height` when copying pages, so rewriting the PDF with pypdf does **not** fix it. Inlining `/Height` as a direct integer does.

## Minimal reproduction (PII-free)

Two PDFs that embed the **same** JPEG bytes; only `/Height` encoding differs.

### A. Direct `/Height` — works

```
/Width 1200 /Height 1600 /Length …
```

Result: VLM extracts marker text `EXPECT_VISIBLE_TEXT_ABC123`.

### B. Indirect `/Height` — fails

```
/Width 1200 /Height 6 0 R /Length …
…
6 0 obj
1600
endobj
```

Result within ~2–3s:

```text
OCR error: VLM OCR returned no content (model=google/gemini-3.7-flash)
```

Intercepting the VLM request shows a blank white PNG (~1225×1736, 100% white pixels). Gemini reasoning: “image is entirely blank”.

### Fixture generation (Python)

```python
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

img = Image.new("RGB", (1200, 1600), "white")
d = ImageDraw.Draw(img)
d.text((80, 120), "XBERG REPRO FIXTURE", fill="black")
d.text((80, 360), "Marker text: EXPECT_VISIBLE_TEXT_ABC123", fill=(0, 0, 180))
jpg = Path("page.jpg"); img.save(jpg, quality=85)
jpg_bytes = jpg.read_bytes(); w, h = img.size
page_w, page_h = 612, 816
content = f"q\n{page_w} 0 0 {page_h} 0 0 cm\n/Im0 Do\nQ\n".encode()

def write_pdf(path: str, height_expr: str, extra=None):
    parts = []
    def emit(p): parts.append(p); return len(parts)
    emit(b"<< /Type /Catalog /Pages 2 0 R >>")
    emit(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    emit((
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_w} {page_h}] "
        f"/Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 5 0 R >> >> "
        f"/Contents 4 0 R >>"
    ).encode())
    emit(b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream")
    emit((
        f"<< /Type /XObject /Subtype /Image /Width {w} /Height {height_expr} "
        f"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode "
        f"/Length {len(jpg_bytes)} >>\nstream\n"
    ).encode() + jpg_bytes + b"\nendstream")
    if extra:
        for o in extra: emit(o)
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"); xref = {0: 0}
    for i, p in enumerate(parts, 1):
        xref[i] = len(out)
        out.extend(f"{i} 0 obj\n".encode()); out.extend(p); out.extend(b"\nendobj\n")
    xref_pos = len(out)
    out.extend(f"xref\n0 {len(parts)+1}\n".encode())
    out.extend(b"0000000000 65535 f \n")
    for i in range(1, len(parts)+1):
        out.extend(f"{xref[i]:010d} 00000 n \n".encode())
    out.extend(
        f"trailer\n<< /Size {len(parts)+1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    )
    Path(path).write_bytes(out)

write_pdf("direct-height.pdf", "1600")
write_pdf("indirect-height.pdf", "6 0 R", [b"1600"])
```

### Xberg extract config

```js
import { extract } from "@xberg-io/xberg";

const config = {
  forceOcr: true,
  images: { maxImageDimension: 1200, includePageRasters: true },
  ocr: {
    backend: "vlm",
    vlmConfig: {
      model: "google/gemini-3.7-flash", // any vision model
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_KEY,
      timeoutSecs: 120,
    },
  },
};

await extract({ kind: "uri", uri: "indirect-height.pdf" }, config);
// => OCR error: VLM OCR returned no content

await extract({ kind: "uri", uri: "direct-height.pdf" }, config);
 // => content includes EXPECT_VISIBLE_TEXT_ABC123
```

## Real-world trigger

Observed on scans from **Brother ADS-1700W** (`/Creator` / `/Producer`: `Brother Scanner System`). Example image dict from a 5-page scan:

```
/Width 2447 /Height 8 0 R /Length 9 0 R
```

with `8 0 obj → 3469`. All five pages use indirect `/Height` + `/Length`. pdf.js / Poppler / `pdf-to-img` render these pages correctly; Xberg VLM path does not.

Control: wrapping the **same** Brother JPEG bytes into a PDF with direct `/Height 3469` makes Xberg OCR succeed (~15k+ chars/page).

## Expected behavior

1. Resolve indirect `/Height` (and `/Width` / `/Length` / `/BitsPerComponent` / etc.) when painting Image XObjects, **or**
2. If resolution/paint fails, treat it like #1355: fall back to OCR of the raw embedded image and emit a `ProcessingWarning` — never silently send a blank page to the VLM.

## Actual behavior

- Page raster is blank white (verified via request proxy and `includePageRasters`)
- No processing warning
- Extraction fails with `VLM OCR returned no content`
- Completes in ~2s (VLM “sees” empty page)

## Suggested fix location

PDF image XObject dimension resolution in pdf-oxide’s rasterizer (the path used for VLM page renders). Add a regression test with `/Height N 0 R` and `/Length M 0 R` on a DCTDecode image-only page.

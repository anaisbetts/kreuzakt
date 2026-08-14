# Xberg repro fixtures: indirect `/Height` blank page render

Attachments for an upstream Xberg bug report.

| File | Purpose |
|------|---------|
| `indirect-height.pdf` | Fails: `VLM OCR returned no content` |
| `direct-height.pdf` | Control: same JPEG, direct `/Height`, OCR works |
| `indirect-height-vlm-input-blank.png` | Blank white page Xberg sent to the VLM |
| `direct-height-page-raster.png` | Correct raster when `/Height` is direct |
| `BUG_REPORT.md` | Full upstream bug write-up |

See `BUG_REPORT.md` for root cause (Image XObject `/Height N 0 R`).

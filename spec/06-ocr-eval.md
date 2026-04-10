# Docs-AI — OCR Evaluation Framework

## Purpose

Before committing to a default OCR backend, we need empirical data from our actual documents — not published benchmarks run against someone else's test set. This tool runs a curated set of test PDFs through every available Kreuzberg backend, then uses a powerful judge LLM to score the results against the original document.

The output is a markdown report with per-document scores, per-backend averages, cost data, and a clear recommendation.

## Project Structure

```
eval/
  fixtures/           # Curated test PDFs — 10-20 representative documents
  results/            # Output directory (gitignored, generated per run)
    cache/            # Cached extraction results by {file_hash}_{backend}
    2026-04-10_report.md   # Generated report
  evaluate.ts         # Main entry point
  extract.ts          # Runs Kreuzberg extraction per backend
  judge.ts            # Sends results to judge LLM for scoring
  report.ts           # Generates the markdown report
  types.ts            # Shared type definitions
  config.ts           # Backend definitions and model configuration
```

## Pipeline

```
fixtures/*.pdf
     │
     ▼
┌─────────────┐     For each backend:
│  extract.ts │     - Tesseract (free, local)
│             │     - PaddleOCR (free, local)
│  Kreuzberg  │     - VLM: Qwen 3.5 122B A10B
│  extraction │     - VLM: Claude Sonnet
│             │     - VLM: GPT-4o
└──────┬──────┘
       │  extracted text per backend (cached)
       ▼
┌─────────────┐
│  judge.ts   │     Claude Opus 4.6 via OpenRouter
│             │     receives: original PDF as images + extracted text
│  Scores     │     scores: completeness, accuracy, structure, overall
│  each result│
└──────┬──────┘
       │  scores per document per backend
       ▼
┌─────────────┐
│  report.ts  │     Markdown report with tables,
│             │     averages, cost data, recommendation
└─────────────┘
```

## Fixture Selection

Curate ~10-20 test documents from the existing paperless-ngx archive, covering:

- Clean typed documents (should be easy for all backends)
- Scanned documents with good quality
- Scanned documents with poor quality / noise
- Documents with tables or structured layouts
- Documents with mixed text and images
- Handwritten notes (if any exist)
- Multi-page documents
- Digital PDFs with embedded text layers (baseline — extraction should be perfect)

The fixtures should be representative of the actual archive. Label each fixture with its expected difficulty level in the report.

## Extraction

For each fixture file, run Kreuzberg extraction with every configured backend:

```typescript
import { extractFile } from '@kreuzberg/node';

const backends = [
    { name: 'tesseract', config: { ocr: { backend: 'tesseract' } } },
    { name: 'paddleocr', config: { ocr: { backend: 'paddle-ocr' } } },
    { name: 'vlm:qwen', config: { forceOcr: true, ocr: { backend: 'vlm', vlmConfig: { model: 'qwen/qwen3.5-122b-a10b' } } } },
    { name: 'vlm:claude', config: { forceOcr: true, ocr: { backend: 'vlm', vlmConfig: { model: 'anthropic/claude-sonnet-4' } } } },
    { name: 'vlm:gpt4o', config: { forceOcr: true, ocr: { backend: 'vlm', vlmConfig: { model: 'openai/gpt-4o' } } } },
];
```

VLM backends use `forceOcr: true` to ensure they process the document as images even if a text layer exists. This tests their OCR capability specifically.

### Caching

Extraction results are cached by `{sha256_of_file}_{backend_name}.json` in `results/cache/`. Re-running the evaluation skips already-extracted files, making it cheap to re-judge after tweaking the scoring rubric or adding new fixtures.

Each cached result stores:

```typescript
interface CachedExtraction {
    file_hash: string;
    backend: string;
    extracted_text: string;
    extraction_time_ms: number;
    token_usage?: { input: number; output: number };
    timestamp: string;
}
```

## Judging

The judge LLM receives the original document and each extraction result, then scores the extraction quality.

### Judge Model

Claude Opus 4.6 via a configurable OpenAI-compatible endpoint, using the `openai` SDK:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
    baseURL: process.env.OPENAI_BASE_URL ?? 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENAI_API_KEY ?? 'local-llm',
});

const response = await openai.chat.completions.create({
    model: 'anthropic/claude-4.6-opus',
    messages: [
        { role: 'system', content: JUDGE_SYSTEM_PROMPT },
        {
            role: 'user',
            content: [
                { type: 'text', text: `Evaluate this OCR extraction.\n\nBackend: ${backend}\n\nExtracted text:\n${extractedText}` },
                ...pdfPageImages.map(img => ({
                    type: 'image_url' as const,
                    image_url: { url: `data:image/png;base64,${img}` },
                })),
            ],
        },
    ],
    response_format: { type: 'json_object' },
});
```

### Judge Prompt

The system prompt instructs the judge to score on three dimensions:

```
You are an OCR quality evaluator. You will receive:
1. Images of the original document pages
2. Text extracted from that document by an OCR system

Score the extraction on three dimensions (0-10 each):

COMPLETENESS (0-10): Is all visible text from the original captured?
- 10: Every word, number, and symbol is present
- 7-9: Minor omissions (headers, footers, watermarks)
- 4-6: Significant text is missing
- 0-3: Most text is missing

ACCURACY (0-10): Is the extracted text correct?
- 10: Perfect transcription, no errors
- 7-9: Minor typos or character substitutions
- 4-6: Frequent errors but still readable
- 0-3: Garbled, hallucinated, or mostly wrong

STRUCTURE (0-10): Is the document structure preserved?
- 10: Paragraphs, tables, lists, and reading order are correct
- 7-9: Minor structural issues
- 4-6: Structure is partially lost (merged columns, scrambled order)
- 0-3: No meaningful structure preserved

Return JSON:
{
    "completeness": <number>,
    "accuracy": <number>,
    "structure": <number>,
    "overall": <number>,  // weighted: 0.4 * accuracy + 0.35 * completeness + 0.25 * structure
    "notes": "<brief explanation of major issues, if any>"
}
```

### PDF to Images

To send the original PDF to the judge, each page is rendered as a PNG image. Kreuzberg can handle this via its PDF rendering capability, or we use a lightweight tool like `pdf-img-convert` or `sharp` with `pdf-to-img`. The images are base64-encoded for the OpenAI vision API format.

## Report Generation

The report is a markdown file written to `results/{date}_report.md`. Format:

```markdown
# OCR Evaluation Report — 2026-04-10

## Summary

| Backend | Avg Completeness | Avg Accuracy | Avg Structure | Avg Overall | Est. Cost/Page |
|---------|-----------------|-------------|--------------|------------|----------------|
| tesseract | 6.2 | 5.8 | 5.5 | 5.8 | $0.00 |
| paddleocr | 7.1 | 6.9 | 6.3 | 6.8 | $0.00 |
| vlm:qwen | 9.1 | 9.3 | 8.8 | 9.1 | $0.00017 |
| vlm:claude | 9.4 | 9.5 | 9.1 | 9.4 | $0.006 |
| vlm:gpt4o | 9.5 | 9.6 | 9.0 | 9.4 | $0.0075 |

**Recommendation:** vlm:qwen — best cost/quality ratio. 95% of vlm:gpt4o
quality at 2% of the cost.

## Per-Document Scores

### fixture-01: clean_invoice.pdf (Easy)
| Backend | Complete | Accuracy | Structure | Overall | Notes |
|---------|----------|----------|-----------|---------|-------|
| tesseract | 8 | 7 | 7 | 7.3 | Missed table alignment |
| ... | ... | ... | ... | ... | ... |

### fixture-02: blurry_scan.jpg (Hard)
...

## Cost Analysis

| Backend | Total Tokens (Input) | Total Tokens (Output) | Total Cost | Per-Page Cost |
|---------|---------------------|----------------------|------------|---------------|
| vlm:qwen | 45,000 | 12,000 | $0.043 | $0.0017 |
| ... | ... | ... | ... | ... |

## Raw Data

Cached extractions and judge responses are in results/cache/.
```

## CLI Interface

```bash
# Run full evaluation (extract + judge + report)
npx tsx eval/evaluate.ts

# Only specific backends
npx tsx eval/evaluate.ts --backends tesseract,vlm:qwen,vlm:gpt4o

# Re-judge without re-extracting (uses cached extractions)
npx tsx eval/evaluate.ts --judge-only

# Only extract, skip judging (useful for caching before a long judge run)
npx tsx eval/evaluate.ts --extract-only

# Specify output directory
npx tsx eval/evaluate.ts --output ./eval/results
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_BASE_URL` | No | OpenAI-compatible endpoint for judge calls; defaults to OpenRouter and can point at a local gateway |
| `OPENAI_API_KEY` | Conditional | API key for the configured endpoint; use a placeholder value if your local endpoint ignores auth |

The same OpenAI-compatible client configuration can be used for judge calls whether the endpoint is OpenRouter or a local gateway. OCR backends remain independently configurable through Kreuzberg's VLM model settings.

## What This Tells Us

After running the evaluation, we'll know:

1. **Is VLM OCR actually better than Tesseract for our documents?** The answer is almost certainly yes, but by how much?
2. **Which VLM provider gives the best results?** Qwen 3.5 122B A10B may be 95% as good as GPT-4o at 2% of the cost — or the gap might be larger for our specific document types.
3. **Are there document types where traditional OCR is good enough?** Maybe clean typed PDFs don't benefit from VLM at all, and we can save the API call.
4. **What's the real cost?** Published benchmarks use different page sizes and densities. Our actual documents will give us a real per-page cost.

This data directly informs the `OCR_VLM_MODEL` default and whether we should implement a hybrid strategy (traditional OCR for easy documents, VLM for hard ones) or just VLM everything.

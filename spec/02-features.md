# Docs-AI — Feature Inventory

## Search & Browse

### F-01: Full-Text Search

The primary interaction with the system. Type a query, get ranked results.

- FTS5 with porter stemming and BM25 ranking
- Searches across title, description, full extracted text, and original filename
- Results ordered by relevance score
- Pagination for large result sets (20 results per page)
- Empty query returns recent documents (see F-05)
- Search is fast — FTS5 on SQLite handles thousands of documents without perceptible latency

### F-02: Document Viewer

View a document's content and metadata without downloading the original.

- **PDF files:** inline PDF viewer (browser-native or pdf.js)
- **Images (JPEG, PNG, TIFF):** inline image viewer with zoom
- **Other formats:** display the extracted text as formatted plaintext
- Metadata panel showing: title, description, document date, added at, original filename
- The extracted text is always available as a fallback view regardless of format
- Direct link/URL to each document for bookmarking or sharing within Tailscale

### F-03: Document Download

Download the original file exactly as it was ingested.

- Serves the file from `originals/` with the original filename (not the hash-prefixed stored name)
- Correct `Content-Type` and `Content-Disposition` headers
- Works from both the web UI and the MCP server

### F-04: Search Result Snippets

Search results show context around the matching terms.

- Each result card shows: thumbnail, title, document date, and a text snippet
- Snippets highlight the matching terms within surrounding context
- FTS5's `snippet()` function provides this natively with configurable context length
- Snippet source prioritizes title and description matches, falls back to content matches

### F-05: Recent Documents

The landing state before any search query is entered.

- Shows the most recently added documents as cards
- Same card format as search results (thumbnail, title, date, description)
- Sorted by `added_at` descending
- Provides an immediate sense of what's in the archive without requiring a query
- Doubles as a "what was just ingested" view

---

## Ingest & Processing

### F-06: Folder Watching

The ingest folder is continuously monitored for new files.

- Chokidar v5 watches the `ingest/` directory for new files
- File stabilization delay (2 seconds of no writes) before processing begins, to handle large file copies
- Supports PDF, JPEG, PNG, TIFF, DOCX, and any other format Kreuzberg can handle (91+ formats)
- Recursive watching — subdirectories within `ingest/` are also monitored
- On application startup, any files already present in `ingest/` are queued for processing (crash recovery)

### F-07: Document Extraction

Text extraction via Kreuzberg with intelligent backend routing.

- **Digital PDFs** with embedded text: direct extraction from the PDF structure, no OCR needed
- **Scanned PDFs and images**: VLM OCR backend renders each page as an image and sends it to a vision LLM
- **Office documents** (DOCX, XLSX, etc.): native Kreuzberg extractors
- **Hybrid PDFs** (mix of text and scanned pages): Kreuzberg OCRs only the pages that lack a text layer
- Page count is extracted where applicable
- The VLM model is configurable via `OCR_VLM_MODEL` environment variable (default: `qwen/qwen3.5-122b-a10b`)

### F-08: LLM Metadata Generation

AI-derived metadata from the extracted text.

- After extraction, the full text is sent to a text LLM to derive:
  - **Title** — concise, descriptive (e.g. "Deutsche Telekom Invoice — March 2026")
  - **Description** — 1-2 sentences summarizing the document's content and nature
  - **Document Date** — the date the document pertains to (not the ingest date), nullable if unclear
- The LLM receives plain text, not images — this is a separate concern from OCR
- Uses structured JSON output for reliable parsing
- Model is configurable via `METADATA_LLM_MODEL` (default: `qwen/qwen3.5-122b-a10b`)
- Metadata generation uses an OpenAI-compatible endpoint configured via `OPENAI_BASE_URL`, so it can target OpenRouter or a local LLM
- A cheap/fast model is sufficient here since the input is already clean extracted text

### F-09: Duplicate Detection

Prevent the same document from being archived twice.

- SHA-256 hash of the file content is computed before any processing
- Hash is checked against `documents.file_hash` in the database
- Duplicates are logged and the file is removed from the ingest folder
- Detection happens at step 2 of the pipeline, before any expensive OCR calls

### F-10: Processing Status Visibility

See what's happening in the ingest pipeline.

- Processing queue shows: filename, status (pending/processing/completed/failed), timestamps
- Failed items show the error message
- Manual retry for failed items (re-queues the file for processing)
- Accessible from a status page in the web UI (S-03)
- Recent activity log showing the last N processed documents

### F-11: Bulk Import

One-time migration from an existing paperless-ngx archive.

- Import script that reads the paperless-ngx originals directory
- Each file is processed through the standard ingest pipeline (extract → metadata → persist)
- Progress reporting during bulk import
- Can also be used for any batch of existing documents — not paperless-specific
- Re-OCRs everything through Kreuzberg regardless of any existing text, since the whole point is better extraction

---

## MCP Server

### F-12: search_documents Tool

Full-text search accessible to AI assistants.

- Input: `query` (string, required), `limit` (number, optional, default 10)
- Returns: array of results with id, title, description, document_date, added_at, original_filename, relevance snippet
- Uses the same FTS5 search as the web UI
- Results are ranked by BM25 relevance
- MCP tools should be bulk-first where possible so assistants can minimize round trips

### F-13: get_document Tool

Fetch complete metadata and extracted text for one or more documents.

- Input: `ids` (number[], preferred) or `id` (number, convenience form)
- Returns: array of full document records — all metadata fields plus the complete extracted text
- Primary use case: AI assistant wants to read several documents it found via search without making N tool calls

### F-14: get_document_content Tool

Return only the full extracted text of one or more documents.

- Input: `ids` (number[], preferred) or `id` (number, convenience form)
- Returns: array of `{ id, content }` objects
- Lighter than `get_document` when the assistant only needs the content, not metadata
- Useful for feeding document text from multiple documents into further LLM processing

### F-15: list_recent_documents Tool

List recently added or modified documents.

- Input: `limit` (number, optional, default 10), `since` (ISO 8601 string, optional)
- Returns: array of document summaries (id, title, description, document_date, added_at)
- Sorted by `added_at` descending
- The `since` parameter filters to documents added after a given timestamp

### F-16: Document Resources

Expose documents as MCP resources for direct access.

- Each document is addressable as `document://{id}`
- Resource content is the document metadata + extracted text
- Resources support the MCP `resources/list` and `resources/read` operations
- Enables AI assistants that prefer resource-based access over tool calls

### F-17: download_document Tool

Provide access to one or more original files.

- Input: `ids` (number[], preferred) or `id` (number, convenience form)
- Returns: array of download objects, each with a URL pointing to the original file download endpoint (`/api/documents/:id/original`)
- The AI assistant can present this URL to the user or fetch the file itself
- The URL is only accessible within the Tailscale network

---

## Infrastructure

### F-18: Health Check

Basic health endpoint for monitoring.

- `GET /api/health` returns 200 with status information
- Checks: database is accessible, originals directory exists, ingest directory exists
- Used by Docker health checks and uptime monitoring

### F-19: Configurable Paths

All file system paths are configurable via environment variables.

- `DATA_DIR` — root data directory
- `INGEST_DIR` — ingest folder path
- `ORIGINALS_DIR` — originals archive path
- `THUMBNAILS_DIR` — thumbnail storage path
- `DB_PATH` — SQLite database file path
- Sensible defaults for both Docker (`/data/`) and development (`./data/`) environments

### F-20: Thumbnail Generation

Preview images for search result cards.

- Generated from the first page of PDFs or from the image itself for image files
- Stored in `thumbnails/` as JPEG files named by document ID
- Generated at the end of the ingest pipeline (step 7)
- Regenerable — thumbnails can be deleted and recreated without data loss
- Reasonable dimensions for card display (~300px wide)

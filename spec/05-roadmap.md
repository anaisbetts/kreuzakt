# Docs-AI — Roadmap

## Phase 0: Storage, Search, and OCR Evaluation

**Goal:** Stand up the data layer, get basic search working against manually-inserted data, and empirically determine the best OCR backend using the evaluation framework.

**Duration:** ~1 week

### Deliverables

- [ ] Initialize Next.js project with TypeScript, Tailwind CSS, Kysely, better-sqlite3
- [ ] SQLite schema: `documents` table, `documents_fts` virtual table (FTS5, porter tokenizer), `processing_queue` table
- [ ] FTS sync triggers (insert, update, delete)
- [ ] Kysely type definitions matching the schema
- [ ] Database initialization on first run (create tables, set WAL mode, pragmas)
- [ ] `GET /api/search` — FTS5 search with BM25 ranking, pagination, snippets
- [ ] `GET /api/documents` — list recent documents with pagination
- [ ] `GET /api/documents/:id` — single document with full metadata and content
- [ ] `GET /api/documents/:id/original` — serve original file from originals/
- [ ] `GET /api/health` — basic health check
- [ ] Search UI (S-01): centered search bar, recent documents grid, search results list with snippets
- [ ] Document viewer (S-02): document content display, metadata sidebar, download button
- [ ] Originals folder management: hash computation, hash-prefixed file naming, dedup check
- [ ] **OCR Evaluation Framework** — the `eval/` CLI tool (see `06-ocr-eval.md`)
- [ ] Curate ~10-20 test fixtures from the existing paperless archive
- [ ] Run evaluation across Tesseract, PaddleOCR, Qwen 3.5 122B A10B, Claude Sonnet, GPT-4o
- [ ] Generate evaluation report and choose default VLM provider

### Definition of Done

You can insert a document record into SQLite (via a seed script or direct SQL), search for it by typing a query, view its content and metadata, and download the original file. The OCR evaluation report exists and the default VLM provider has been chosen based on empirical data from your actual documents.

---

## Phase 1: Ingest Pipeline

**Goal:** Drop a file in the ingest folder and have it appear in search results — fully processed, with AI-derived metadata — within seconds.

**Duration:** ~1-2 weeks

### Deliverables

- [ ] Chokidar file watcher on the ingest directory with stabilization delay
- [ ] Pipeline orchestrator: detect → dedup → extract → metadata → persist → move → thumbnail
- [ ] Kreuzberg integration with configurable VLM backend (`OCR_VLM_MODEL` env var)
- [ ] LLM metadata generation: title, description, document_date from extracted text (`METADATA_LLM_MODEL` env var)
- [ ] OpenAI-compatible metadata endpoint configuration (`OPENAI_BASE_URL`, `OPENAI_API_KEY`) for OpenRouter or local LLMs
- [ ] SHA-256 dedup check against existing documents
- [ ] Processing queue: insert `pending` on detect, update through `processing` → `completed`/`failed`
- [ ] Failure handling: file stays in ingest/, error recorded in queue, retry on restart
- [ ] Thumbnail generation from first page (PDF) or original image
- [ ] `GET /api/queue` — processing queue status
- [ ] `POST /api/queue/:id/retry` — retry failed items
- [ ] Status page (S-03): system health, queue visibility, retry button
- [ ] Startup recovery: process any files already present in ingest/ on boot

### Definition of Done

Drop a PDF, scanned image, or DOCX into the ingest folder. Within seconds, the document appears in search results with an AI-generated title, description, and date. Failed documents show in the status page with an error and can be retried.

---

## Phase 2: MCP Server

**Goal:** AI assistants can search, read, and retrieve documents from the archive via MCP.

**Duration:** ~1 week

### Deliverables

- [ ] MCP Streamable HTTP transport mounted at `/mcp`
- [ ] `search_documents` tool — full-text search with ranked results
- [ ] Bulk-first MCP tool design — use array inputs/outputs wherever the operation naturally supports batching
- [ ] `get_document` tool — fetch metadata + full text by ID or `ids[]`, returning an array
- [ ] `get_document_content` tool — fetch raw text by ID or `ids[]`, returning an array
- [ ] `list_recent_documents` tool — recent documents with optional `since` filter
- [ ] `download_document` tool — return download URLs for one or more original files
- [ ] Document resources: `document://{id}` URIs via `resources/list` and `resources/read`
- [ ] Test with at least two MCP clients (e.g. Claude Desktop / Cursor, and Red via mbfai)
- [ ] Verify tool descriptions are clear enough for AI assistants to use without documentation

### Definition of Done

An AI assistant configured with the Docs-AI MCP server can: search for documents by natural language query, fetch multiple documents or document contents in a single tool call, list what was recently added, and provide download links for one or more original files. Tested with real queries against the archive.

---

## Phase 3: Migration and Polish

**Goal:** Migrate the existing paperless-ngx archive, polish the search UI, and package for deployment.

**Duration:** ~1 week

### Deliverables

- [ ] Bulk import script: reads a directory of files, processes each through the ingest pipeline
- [ ] Progress reporting during bulk import (file count, estimated time, errors)
- [ ] Import the ~500 documents from the existing paperless-ngx originals directory
- [ ] Search UI polish: highlighted snippets, keyboard navigation (arrow keys + Enter), responsive layout
- [ ] Search debounce and URL query parameter sync (`?q=invoice+telekom`)
- [ ] Error handling polish: friendly error states, retry UX, empty state messaging
- [ ] Dockerfile: single container with Node.js, Tesseract (fallback), and Kreuzberg system dependencies
- [ ] `docker-compose.yml`: volume mounts for `/data/`, environment variable configuration, health check
- [ ] Verify the full loop: ingest → search → view → download → MCP access, all running from Docker

### Definition of Done

The existing paperless-ngx archive is fully migrated, searchable, and accessible via both the web UI and MCP. A single `docker compose up` starts the entire application. Search feels responsive and results are relevant.

---

## Dependency Summary

### npm Packages

| Package | Purpose | Phase |
|---------|---------|-------|
| `next` | Web framework, UI, API routes | 0 |
| `react`, `react-dom` | UI rendering | 0 |
| `kysely` | Type-safe SQL query builder | 0 |
| `better-sqlite3` | SQLite driver (native, synchronous) | 0 |
| `tailwindcss` | CSS framework | 0 |
| `@kreuzberg/node` | Document text extraction + VLM OCR | 1 |
| `chokidar` | File system watching | 1 |
| `openai` | LLM calls for metadata generation via an OpenAI-compatible endpoint | 1 |
| `@modelcontextprotocol/sdk` | MCP server SDK | 2 |
| `tsx` | TypeScript execution for eval scripts and import tooling | 0 |

### System Dependencies (Docker)

| Dependency | Purpose |
|------------|---------|
| `tesseract-ocr` | Fallback OCR engine (Kreuzberg default) |
| `tesseract-ocr-eng` | English language data for Tesseract |

Kreuzberg's VLM backend needs no system dependencies — it makes HTTP calls to cloud APIs. Tesseract is included as a fallback for when VLM is unavailable or for cost-free extraction of simple documents.

---

## Resolved Decisions

1. **Single flat documents table.** No separate metadata table. All fields on one row. AI-derived fields (title, description, document_date) are stored alongside system fields and the full extracted text.
2. **No authentication.** Tailscale is the security boundary. The application has no concept of users.
3. **No tags or taxonomy.** The description field absorbs what structured tags would have been. FTS makes it searchable without formal categories.
4. **Two-model strategy.** OCR (VLM, vision model on images) and metadata generation (text model on extracted text) are separate pipeline steps with independently configurable models, and metadata calls go through a configurable OpenAI-compatible endpoint.
5. **File stays in ingest until success.** The original is only moved to originals/ after all processing succeeds. This makes failure recovery trivial.
6. **FTS5 over vector search.** BM25 full-text search is sufficient for a personal archive of this size. Vector search is not planned.
7. **Kreuzberg over Docling/LlamaParse.** Native Node.js bindings, 91+ formats, VLM backend support, no Python sidecar.
8. **Qwen 3.5 122B A10B as default VLM.** Best cost/accuracy ratio for OCR. Configurable via environment variable. Decision validated (or overridden) by the OCR evaluation framework in Phase 0.

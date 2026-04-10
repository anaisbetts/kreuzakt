# Docs-AI — Architecture

## System Context

```
┌──────────────┐         ┌──────────────────────────────────────────┐
│              │  HTTP    │               Docs-AI                    │
│   Browser    │◄────────►│                                          │
│   (Search)   │         │  ┌──────────┐  ┌───────────┐            │
│              │         │  │ Next.js  │  │ MCP Server│            │
└──────────────┘         │  │ UI + API │  │ (HTTP)    │            │
                         │  └────┬─────┘  └─────┬─────┘            │
┌──────────────┐         │       │              │                   │
│  AI Assistant│  MCP    │       ▼              ▼                   │
│  (Red, Claude│◄────────►│  ┌──────────────────────┐              │
│   etc.)      │         │  │   Application Layer   │              │
└──────────────┘         │  │  (Kysely + Kreuzberg) │              │
                         │  └───────┬───────┬───────┘              │
┌──────────────┐         │          │       │                       │
│ Ingest Folder│         │          ▼       ▼                       │
│ (chokidar)   │────────►│  ┌──────────┐ ┌───────────┐            │
│              │         │  │  SQLite   │ │ File      │            │
└──────────────┘         │  │  (FTS5)   │ │ System    │            │
                         │  └──────────┘ │ originals/│            │
                         │               │ thumbnails│            │
                         │               └───────────┘            │
                         └──────────────────────────────────────────┘
```

Three entry points into the same application:

1. **Browser** — hits Next.js pages and API routes for search and document viewing
2. **AI Assistant** — hits the MCP server at `/mcp` for programmatic document access
3. **File System** — chokidar watches the ingest folder and triggers the processing pipeline

All three share the same SQLite database and originals folder. There is one process, one database, one data directory.

## Folder Layout

```
/data/
  originals/           # Immutable archive — files are never modified after placement
  thumbnails/          # Generated preview images (regenerable)
  docs-ai.db           # SQLite database (schema + FTS5 index)
  docs-ai.db-wal       # WAL file (appears at runtime)
  docs-ai.db-shm       # Shared memory file (appears at runtime)
  ingest/              # Drop zone — new files here trigger the processing pipeline
```

All paths are configurable via environment variables, defaulting to `/data/` in Docker and `./data/` in development.

## Ingest Pipeline

The pipeline processes one document at a time, strictly sequentially per file:

```
1. DETECT        chokidar sees a new file in ingest/
                 Wait for file to stabilize (no writes for 2s)
       │
       ▼
2. DEDUP         Compute SHA-256 hash of the file
                 Check against documents.file_hash in SQLite
                 If duplicate → log, delete from ingest/, stop
       │
       ▼
3. EXTRACT       Kreuzberg reads the file
                 Digital PDFs → direct text layer extraction (free, instant)
                 Scanned PDFs / images → VLM OCR backend (paid, ~2-3s/page)
                 Other formats (DOCX, etc.) → native Kreuzberg extractors
       │
       ▼
4. METADATA      Send extracted plain text to a text LLM
                 Derive: title, description, document_date
                 This step receives TEXT, not images — uses a cheap/fast model
       │
       ▼
5. PERSIST       Insert row into documents table
                 FTS5 index updates automatically via triggers
       │
       ▼
6. MOVE          Move original file from ingest/ to originals/
                 Rename to {sha256_prefix}_{original_filename}
       │
       ▼
7. THUMBNAIL     Render first page as image, save to thumbnails/
```

### Failure Semantics

If any step fails, the file **remains in the ingest folder** and the error is recorded in the `processing_queue` table. The file is only moved to `originals/` after step 5 succeeds. On application restart, the watcher re-discovers files still in `ingest/` and retries them.

The `processing_queue` table tracks every file that enters the pipeline:

- `pending` — detected, waiting to process
- `processing` — currently being worked on
- `completed` — successfully processed and moved to originals
- `failed` — error occurred, file remains in ingest for retry

### OCR Strategy

Kreuzberg handles format detection and routing automatically. The key configuration is the OCR backend for scanned content:

```typescript
import { extractFile } from '@kreuzberg/node';

const result = await extractFile(filePath, null, {
    forceOcr: false,  // let Kreuzberg decide based on text layer presence
    ocr: {
        backend: 'vlm',
        vlmConfig: {
            model: process.env.OCR_VLM_MODEL ?? 'google/gemini-2.5-flash',
        },
    },
});
```

With `forceOcr: false`, Kreuzberg extracts embedded text from digital PDFs (free, instant) and only invokes the VLM for pages that lack a text layer. The VLM model is configurable via `OCR_VLM_MODEL` environment variable.

### Metadata Generation

After text extraction, a separate LLM call derives structured metadata from the plain text:

```typescript
const response = await openai.chat.completions.create({
    model: process.env.METADATA_LLM_MODEL ?? 'google/gemini-2.5-flash',
    messages: [{
        role: 'system',
        content: `Extract metadata from the following document text.
Return JSON: { "title": "...", "description": "...", "document_date": "YYYY-MM-DD" | null }
- title: A concise, descriptive title for the document
- description: 1-2 sentences describing the document's content and purpose
- document_date: The date the document pertains to (not today's date), or null if unclear`,
    }, {
        role: 'user',
        content: extractedText,
    }],
    response_format: { type: 'json_object' },
});
```

This step operates on **plain text**, not images, so it can use a fast/cheap text model even when the OCR step used an expensive vision model. The model is independently configurable via `METADATA_LLM_MODEL`.

---

## Data Model

### documents

The primary table. One row per document in the archive.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-incrementing ID |
| `original_filename` | TEXT NOT NULL | The filename as it was when ingested |
| `stored_filename` | TEXT NOT NULL UNIQUE | Hash-prefixed filename in originals/ |
| `mime_type` | TEXT NOT NULL | Detected MIME type |
| `file_hash` | TEXT NOT NULL UNIQUE | SHA-256 hash of the original file (dedup key) |
| `file_size` | INTEGER NOT NULL | File size in bytes |
| `page_count` | INTEGER | Number of pages (null for non-paginated formats) |
| `title` | TEXT NOT NULL | AI-derived document title |
| `description` | TEXT NOT NULL | AI-derived 1-2 sentence description |
| `document_date` | TEXT | AI-derived date (ISO 8601), nullable |
| `content` | TEXT NOT NULL | Full extracted text |
| `added_at` | TEXT NOT NULL | ISO 8601 timestamp when the file entered the archive |
| `created_at` | TEXT NOT NULL DEFAULT (datetime('now')) | Row creation time |
| `updated_at` | TEXT NOT NULL DEFAULT (datetime('now')) | Row last update time |

### documents_fts

FTS5 virtual table for full-text search. Content-synced with the `documents` table via triggers.

```sql
CREATE VIRTUAL TABLE documents_fts USING fts5(
    title,
    description,
    content,
    original_filename,
    content='documents',
    content_rowid='id',
    tokenize='porter unicode61'
);
```

The `porter` tokenizer enables stemming ("invoices" matches "invoice", "scanning" matches "scan"). BM25 ranking is used for result ordering:

```sql
SELECT d.*, rank
FROM documents_fts fts
JOIN documents d ON d.id = fts.rowid
WHERE documents_fts MATCH ?
ORDER BY rank;
```

### processing_queue

Tracks every file that enters the ingest pipeline.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | Auto-incrementing ID |
| `filename` | TEXT NOT NULL | Original filename from ingest folder |
| `status` | TEXT NOT NULL DEFAULT 'pending' | pending, processing, completed, failed |
| `error` | TEXT | Error message if status is failed |
| `document_id` | INTEGER | FK to documents.id if completed |
| `created_at` | TEXT NOT NULL DEFAULT (datetime('now')) | When the file was detected |
| `completed_at` | TEXT | When processing finished |

### FTS Sync Triggers

Triggers keep the FTS index in sync with the documents table:

```sql
CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
    INSERT INTO documents_fts(rowid, title, description, content, original_filename)
    VALUES (new.id, new.title, new.description, new.content, new.original_filename);
END;

CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, title, description, content, original_filename)
    VALUES ('delete', old.id, old.title, old.description, old.content, old.original_filename);
END;

CREATE TRIGGER documents_au AFTER UPDATE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, title, description, content, original_filename)
    VALUES ('delete', old.id, old.title, old.description, old.content, old.original_filename);
    INSERT INTO documents_fts(rowid, title, description, content, original_filename)
    VALUES (new.id, new.title, new.description, new.content, new.original_filename);
END;
```

---

## Persistence

SQLite is configured with WAL (Write-Ahead Logging) mode for concurrent read/write access:

```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;  -- 64MB cache
PRAGMA foreign_keys = ON;
```

WAL mode allows the search API to serve read queries while the ingest pipeline writes new documents. The `busy_timeout` prevents immediate failures if a write lock is briefly held.

### Kysely Configuration

```typescript
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

const db = new Kysely<DB>({
    dialect: new SqliteDialect({
        database: new Database(process.env.DB_PATH ?? './data/docs-ai.db'),
    }),
});
```

Kysely provides type-safe queries without the overhead of a full ORM. Database types are defined manually to match the schema, keeping the dependency footprint minimal.

---

## File Naming

Originals are stored as `{sha256_prefix}_{original_filename}` where `sha256_prefix` is the first 12 characters of the file's SHA-256 hash. This prevents filename collisions while keeping the stored name human-readable:

```
originals/
  a1b2c3d4e5f6_Invoice_March_2026.pdf
  f7e8d9c0b1a2_Lease_Agreement.pdf
  3c4d5e6f7a8b_photo_scan.jpg
```

The full hash is stored in the database for dedup; the prefix in the filename is just for quick visual identification.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `./data` | Root directory for all data (originals, thumbnails, database) |
| `INGEST_DIR` | `$DATA_DIR/ingest` | Directory to watch for new files |
| `ORIGINALS_DIR` | `$DATA_DIR/originals` | Directory for archived original files |
| `THUMBNAILS_DIR` | `$DATA_DIR/thumbnails` | Directory for generated thumbnails |
| `DB_PATH` | `$DATA_DIR/docs-ai.db` | Path to the SQLite database file |
| `OCR_VLM_MODEL` | `google/gemini-2.5-flash` | Kreuzberg VLM model for OCR on scanned docs |
| `METADATA_LLM_MODEL` | `google/gemini-2.5-flash` | LLM model for metadata derivation |
| `OPENROUTER_API_KEY` | — | API key for OpenRouter (used by both OCR VLM and metadata LLM) |
| `PORT` | `3000` | HTTP server port |

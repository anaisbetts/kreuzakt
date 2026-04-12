# Kreuzakt — Project Overview

## What This Is

Kreuzakt is a personal document management system that replaces paperless-ngx with modern OCR, simple full-text search, and first-class AI access via the Model Context Protocol (MCP).

Paperless-ngx was a reasonable starting point for digitizing a personal document archive, but it has real problems. Tesseract produces bad OCR text — garbled output on anything that isn't pristine typed text. The stack is heavy: four Docker containers, PostgreSQL, Redis, a task queue, all for what amounts to "store PDFs and search them." And there's no native way for an AI assistant to query the archive — you're stuck with a web UI designed for humans clicking through pages of results.

Kreuzakt fixes all of that. It's a single Next.js application backed by SQLite that:

- Uses Kreuzberg with a VLM backend to actually extract text correctly, including from scanned documents, handwritten notes, and complex layouts
- Provides a Google-style search interface — just a search bar, type a query, see your documents
- Exposes the entire archive to AI assistants via a remote MCP server, so an assistant can search, read, and retrieve documents programmatically
- Watches an ingest folder for new files and processes them automatically
- Runs in a single Docker container with no external dependencies

## Why It Matters

The existing paperless-ngx instance has ~500 documents with bad OCR and bad metadata. The text extraction is unreliable enough that searching for "invoice" might miss half the actual invoices because Tesseract read them as "lnvoice" or "inv0ice" or just garbage. The metadata (titles, dates, correspondents) was either manually entered or auto-generated poorly.

The insight behind Kreuzakt is that modern vision LLMs have made document extraction a solved problem — GPT-4o, Claude, and Qwen can read scanned documents with near-human accuracy at trivial cost. For a ~500 document personal archive, re-OCR'ing everything costs less than $10. The bottleneck is no longer extraction quality; it's having a simple system that puts good extraction to work.

## Goals

1. **Accurate text extraction.** This is the core pain point. Scanned documents should produce clean, correct text via VLM-powered OCR. Digital PDFs should have their embedded text extracted directly.
2. **Fast, relevant search.** SQLite FTS5 with BM25 ranking. Type a query, get results. No complex filtering UI, no tag hierarchies — just search.
3. **AI-native access via MCP.** An AI assistant should be able to search the archive, read document text, fetch metadata, and download originals — all through a standard MCP server.
4. **Zero-config ingest.** Drop a file in the ingest folder. It gets OCR'd, metadata generated, and indexed automatically.
5. **Single-container deployment.** One Docker image, one SQLite database, one data directory. No PostgreSQL, no Redis, no task queue.

## Non-Goals

- **Multi-user or authentication.** This is personal software. Tailscale provides network-level access control; the app itself has no concept of users or login.
- **Complex tagging or taxonomy.** No tags, no correspondents, no document types as structured fields. AI-generated descriptions absorb what those would have been, and FTS makes them searchable.
- **Email integration or workflow routing.** Documents enter through the ingest folder. That's it.
- **Mobile app.** The web UI is responsive enough for phone use. No native app.
- **App Store distribution.** This runs on your own infrastructure behind Tailscale.

## Key Principles

### Originals are sacred

The original file is never modified, never re-encoded, never touched after it enters the archive. It is copied to the originals folder with a hash-prefixed filename and stays there forever. Everything else — extracted text, metadata, thumbnails — is derived and regenerable.

### Search over browse

If search is good, you don't need folders, tags, or hierarchies. The entire UI is built around a single search bar. Type what you're looking for, find it. The system should make manual organization unnecessary by extracting enough text and metadata that natural language queries just work.

### AI-first metadata

Document titles, descriptions, and dates are derived by an LLM from the extracted text at ingest time. This produces better metadata than manual entry for most documents — an LLM reading an invoice will generate a title like "Deutsche Telekom Invoice — March 2026" and extract the correct date, which is more useful than whatever the scanner named the file. Metadata calls go through an OpenAI-compatible endpoint so the same pipeline can target OpenRouter or a local LLM.

### One container, one database

SQLite in WAL mode handles concurrent reads (search) and writes (ingest) without external infrastructure. The entire application — web server, API, MCP server, file watcher, background processor — runs in a single Bun process. Deployment is `docker compose up`.

## Technical Foundation

The application is built on:

- **Next.js** for the web UI and API routes
- **Kysely** as a type-safe SQL query builder over SQLite (via `bun:sqlite` and a Bun SQLite dialect)
- **SQLite FTS5** for full-text search with BM25 ranking
- **Kreuzberg** (`@kreuzberg/node`) for document text extraction, with a VLM backend for scanned documents
- **Chokidar** for watching the ingest folder
- **MCP SDK** for the remote MCP server (Streamable HTTP transport)
- **Tailwind CSS** for the search UI

No ORM, no external database, no message queue, no task runner. The complexity ceiling is deliberately low.

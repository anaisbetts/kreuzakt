# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**docs-ai** is an AI-powered document management system — a lightweight Paperless replacement. It ingests documents via a watched folder or drag-drop upload, uses Vision Language Models (VLMs) for OCR, generates metadata (title, description, date) via LLM, stores everything in SQLite, and exposes a full-text search UI plus an MCP server for integration with Claude Desktop, Cursor, etc.

## Commands

```bash
bun dev                   # Start Next.js dev server (port 3000)
bun run check             # TypeScript type checking + Biome lint
bun run f                 # Format & auto-fix (Biome --unsafe)
bun run build             # Production build (standalone output)
bun test                  # Run unit tests
bun run test:integration  # Integration tests (needs DOCS_AI_RUN_INTEGRATION=1)
bun run storybook         # UI component dev server (port 6006)
bun run eval              # Run evaluation suite
```

Tests are discovered automatically by the Bun test runner (`*.test.ts` alongside source files). Integration tests are in `*.integration.bun.test.ts`.

## Architecture

### Request flow

The app is a Next.js App Router project. Server components fetch data directly; client components (suffixed `Client.tsx`) use hooks for interactivity. All API routes are under `src/app/api/` and use `runtime = "nodejs"` (not Edge).

### Document ingestion pipeline

Files arrive either via the chokidar-watched `/ingest/` folder or via `POST /api/upload`. Both paths drop files into the ingest folder, which `src/lib/ingest/watcher.ts` picks up. Processing is **serial** (not parallel) to manage LLM API load:

1. Hash file → check for duplicates
2. OCR via Kreuzberg VLM (`src/lib/ingest/extract.ts`)
3. Generate title/description/date via LLM (`src/lib/ingest/metadata.ts`)
4. Insert into SQLite `documents` table + FTS virtual table
5. Move original to `/originals/` (immutable archive)
6. Generate thumbnail via sharp (`src/lib/ingest/thumbnail.ts`)
7. Queue entry updated to `completed`

The orchestrator is `src/lib/ingest/pipeline.ts`.

### Database

SQLite accessed via Kysely with the `kysely-bun-sqlite` dialect. Schema types are in `src/lib/db/schema.ts`; table creation is in `src/lib/db/migrate.ts`. The DB instance is a lazy singleton in `src/lib/db/connection.ts`. Full-text search uses SQLite FTS5 (`documents_fts` virtual table, indexing title, description, content, original_filename).

### Search

`src/lib/documents.ts` contains `searchDocuments()` which runs FTS queries. Before querying, `src/lib/query-expansion.ts` optionally calls an LLM to suggest related terms and ORs them into the FTS query. Snippets/highlighting are generated in `src/lib/snippets.ts`.

### MCP server

`src/lib/mcp/server.ts` defines MCP tools (`search_documents`, `list_recent_documents`, `get_document`, `get_document_content`, `download_document`) exposed via Streamable HTTP at `/api/mcp`. This is what Claude Desktop / Cursor connect to.

### Configuration

All runtime config comes from env vars, read in `src/lib/config.ts`. Key vars:

- `OPENROUTER_KEY` or `OPENAI_API_KEY` — required for LLM features
- `OCR_VLM_MODEL` — model for OCR (default: `openai/gpt-4.1-mini`)
- `METADATA_LLM_MODEL` — model for metadata generation (default: `openai/gpt-4.1`)
- `DATA_DIR` — root for all persistent data (default: `./data`)

### Path aliases

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Code conventions

- **Biome** handles both linting and formatting (2-space indent, double quotes). Run `bun run f` to auto-fix.
- Components are co-located with their Storybook stories (`.stories.tsx`).
- Originals are never mutated after archival — all derived data (thumbnails, metadata) is regenerable from scratch.
- Zod is used for runtime validation at API boundaries and MCP tool output schemas.

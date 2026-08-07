# Kreuzakt — Paperless, but smaller, and the OCR is a VLM

Kreuzakt takes the good ideas from [Paperless](https://docs.paperless-ngx.com), swaps Tesseract for a vision-language model, and throws out almost everything else. One container, one SQLite file, and a search box that actually finds the document you were looking for — in any of 24+ languages. Optionally, let Claude or Cursor read your archive over MCP and answer questions for you.

<img width="2000" height="655" alt="image" src="https://github.com/user-attachments/assets/feeff8dc-80e2-4a7a-814c-a1d13e32f906" />

### What's different

- **One container, one SQLite file.** No Redis, no Postgres, no broker, no workers to babysit. The Docker image is a single `oven/bun` process serving Next.js, with everything (DB, originals, thumbnails, ingest) under one `/data` volume.
- **VLM OCR instead of Tesseract.** Extraction runs through [Kreuzberg](https://kreuzberg.dev) (a Rust CLI built from `kreuzberg` 4.9.8 with bundled PDFium, office, Excel, email, HTML, archives, and OCR support), which calls an OpenAI-compatible vision model to read pages. This is *drastically* more accurate than classical OCR — especially on scans, handwriting, and non-Latin scripts — and that accuracy flows straight into search.
- **A real remote MCP server.** Point Claude Desktop, Cursor, or any MCP client at `/mcp` and your archive becomes a tool the model can search, read, and link to. Seven tools, session-managed Streamable HTTP — details below.
- **Zero-curation metadata.** Every document gets an LLM-generated title, one-to-two-sentence description, document date, and detected language the moment it's ingested. No tagging, no manual sorting.
- **Metadata is always regenerable.** Titles, descriptions, dates, and even the extracted text can be rebuilt from the originals at any time — per-document rescan or bulk reindex-all. The originals themselves are never modified, so migrating is "copy the `originals` folder."

### What's the same

- **Originals are sacred.** Kreuzakt never edits your source files. It copies them into an archive and deletes the ingest copy after processing.
- **Drop-and-forget ingest.** Put files in the `ingest` folder; a watcher picks them up and processes them, just like Paperless's consume folder.

---

## Quick start with Docker Compose

```yaml
services:
  kreuzakt:
    image: ghcr.io/anaisbetts/kreuzakt:latest
    ports:
      - "3000:3000"
    environment:
      OPENROUTER_KEY: ${OPENROUTER_KEY}
      TZ: Europe/Berlin  # Set your local timezone
    volumes:
      - ./docs:/data
    restart: unless-stopped
```

Drop that in a `docker-compose.yml`, set `OPENROUTER_KEY` in your environment or a `.env` file, and `docker compose up -d`. The web UI is at `http://localhost:3000`.

The `./docs` folder is initialized on first run with `./docs/ingest`, `./docs/originals`, `./docs/thumbnails`, and the SQLite DB.

### Ok, now what do I do?

1. `docker compose up -d`.
2. Drop your documents into the ingest folder. They'll process and move to `originals`; watch progress at `/settings` (a big backlog can take a while).
3. Got an existing Paperless install? Run the importer from `/settings`.
4. You can also just drag-and-drop a pile of files onto the main page.

### How much will this cost me?

I'm too lazy to do per-page math, but for reference: importing 440 documents from Paperless (a few up to 80 pages long) cost about **$5** in model calls. Individual documents are typically on the order of cents.

---

## How a document flows through the system

When a file lands in `ingest`, the pipeline (`src/lib/ingest/pipeline.ts`) does this, in order:

1. **Hash & dedupe** — SHA the file; if an archived original already has that hash, skip it (no double-ingest).
2. **VLM extract** — Kreuzberg reads the file with `force_ocr` and a vision model, returning plain text, mime type, and page count. If every OCR backend fails transiently (rate limits, network), it retries once.
3. **LLM metadata** — the extracted text goes to a second LLM call (JSON mode) that returns a title, description, document date, and ISO 639-1 language code. The system prompt honors your preferred UI language, so titles/descriptions come out in the language you read.
4. **Insert + index** — a row goes into SQLite, and a stemmed copy goes into the FTS5 table so search matches word variants, not just exact strings.
5. **Archive & clean up** — the original is copied into `originals/` (named by hash, so collisions are impossible), the ingest copy is deleted, and a `sharp` thumbnail is generated.
6. **Queue tracks it all** — every step is recorded in `processing_queue`, visible at `/settings`. Failures stay marked `failed` and can be retried.

**No API key?** The app still runs. OCR is skipped, the title falls back to a title-cased version of the filename, and search works over whatever's there. Drop in a key later and rescan to fill in the blanks.

---

## Search that actually finds things

Kreuzakt's search is SQLite FTS5 with a few deliberate upgrades:

- **Stemmed indexing and querying.** Text is Snowball-stemmed at index time in the document's detected language (24+ languages supported: English, German, French, Spanish, Italian, Portuguese, Dutch, Swedish, Czech, Russian, Arabic, and more). Queries are stemmed multilingually across common European languages, so `Rechnungen` finds `Rechnung` and `insurance` finds `insured`.
- **BM25 blended with recency.** Results are ranked by `BM25` combined with an exponential recency decay (30-day half-life), so a freshly added "tax" document outranks a 3-year-old one with the same relevance score.
- **LLM query expansion (optional).** Flip on `?expand=1` (or the toggle in the UI) and Kreuzberg asks the LLM to expand your query with synonyms, abbreviations, and translations into every language present in your corpus — then ORs those terms into the FTS match. Great for multilingual archives where "invoice" might be stored as *Rechnung*, *facture*, or *fattura*.
- **Snippets.** Each hit comes back with a highlighted excerpt around the matching terms, not just a title.

---

## Ask your archive questions: MCP

Kreuzakt exposes a remote MCP endpoint at **`/mcp`** (Streamable HTTP, session-managed). Replace the hostname with wherever you serve the app — e.g. `https://docs.your-tailnet.ts.net/mcp` over [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve). Most clients won't talk to plain HTTP, so terminate TLS (Serve, a reverse proxy, etc.).

<details>
<summary><strong>Claude Desktop</strong> — <code>npx mcp-remote@latest …</code></summary>

[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridges the HTTP endpoint for clients that expect a local process.

```json
{
  "mcpServers": {
    "docs": {
      "command": "npx",
      "args": ["mcp-remote@latest", "https://docs.your-tailnet.ts.net/mcp"]
    }
  }
}
```

</details>

<details>
<summary><strong>Cursor</strong> — <code>type: "http"</code> in MCP config</summary>

Add to `.cursor/mcp.json` or your project's MCP settings.

```json
{
  "mcpServers": {
    "docs": {
      "type": "http",
      "url": "https://docs.your-tailnet.ts.net/mcp"
    }
  }
}
```

</details>

### MCP tools

| Tool | Description |
|---|---|
| `search_documents` | Search the archive by natural-language query; returns ranked matches with snippets. |
| `get_document` | Fetch one or more documents with full metadata and complete extracted text. |
| `get_document_content` | Fetch just the extracted text for one or more documents (lighter weight). |
| `list_recent_documents` | List recently added documents, newest first; optional `limit` and `since` (ISO 8601). |
| `download_document` | Get absolute URLs to download the original files directly. |
| `get_document_link_for_user` | Get shareable links to the in-app viewer (not the raw file). |
| `get_upload_command` | Return a ready-to-run `curl` command that uploads a new file to Kreuzakt. |

### Example prompts

- "Find invoices from Deutsche Telekom."
- "What was my health insurance number again?"
- "How much did I pay in taxes last year?"

---

## Bring your Paperless archive with you

`POST /api/import/paperless` streams an import over Server-Sent Events: Kreuzakt pulls your Paperless document list via the Paperless API, downloads each original into a staging (`import`) folder, and enqueues it through the normal pipeline — preserving the original `addedAt` timestamp so your timeline stays intact. Trigger it from the **Paperless import** panel on `/settings`; progress streams live in the browser.

---

## HTTP API reference

Every route below is implemented in `src/app/api/**/route.ts`.

| Method & path | Purpose |
|---|---|
| `GET /api/health` | Liveness + config snapshot (document count, dirs, configured models). |
| `GET /api/search?q=&page=&limit=` | FTS5 search. (LLM query expansion is a UI toggle on `/` via `?expand=1`, not an API param.) |
| `GET /api/documents?page=&limit=&since=` | List documents, newest first; `since` is an ISO 8601 cutoff. |
| `POST /api/upload` | Multipart upload (`files=@…`); queues each file for ingest. |
| `GET /api/documents/:id` | Full document metadata + extracted text. |
| `DELETE /api/documents/:id` | Delete a document (DB row, FTS entry, original, thumbnails). |
| `GET /api/documents/:id/original` | Download the original file. |
| `GET /api/documents/:id/thumbnail` | Document thumbnail (PNG). |
| `GET /api/documents/:id/pages/:page/image` | Full-resolution page image. |
| `GET /api/documents/:id/pages/:page/thumbnail` | Page thumbnail. |
| `POST /api/documents/:id/rescan` | Re-extract and regenerate metadata for one document from its original. |
| `POST /api/documents/export-text` | Download every document's extracted text as a ZIP of `.txt` files (YAML frontmatter + body). Returns `400` if nothing's exportable. |
| `GET /api/queue` | Current processing-queue entries and status counts. |
| `POST /api/queue/:id/retry` | Re-enqueue a failed (or reindex) queue entry. |
| `GET /api/reindex-all` | Status of the latest bulk reindex job. |
| `POST /api/reindex-all` | Queue a bulk re-extract + re-metadata of every document (from originals). |
| `GET /api/settings` | Read app settings (currently: preferred UI language). |
| `PATCH /api/settings` | Update app settings (`{ "preferredLanguage": "de" }`). |
| `POST /api/import/paperless` | Start a Paperless import; streams SSE progress events. |
| `POST/GET/DELETE /mcp` | The MCP endpoint (Streamable HTTP). |

### Text export

```bash
curl -X POST http://localhost:3000/api/documents/export-text -o export.zip
```

Each file in the ZIP is named `{id}-{sanitized-title}.txt` and begins with YAML frontmatter (`original_filename`, `document_url`, `original_url`) followed by the extracted body.

---

## Configuration

All path variables resolve relative to the working directory unless absolute. `DATA_DIR` is the single knob the Docker image uses; the rest let you split storage across mounts.

### Volume / path variables

| Variable | Default (Docker) | Description |
|---|---|---|
| `DATA_DIR` | `/data` | Root for everything below when the specific vars are unset. |
| `INGEST_DIR` | `/data/ingest` | Watched folder for new documents. |
| `IMPORT_DIR` | `/data/import` | Staging folder for orchestrated imports (Paperless); not watched. |
| `ORIGINALS_DIR` | `/data/originals` | Stored original files. |
| `THUMBNAILS_DIR` | `/data/thumbnails` | Generated thumbnails. |
| `DB_PATH` | `/data/docs-ai.db` | SQLite database file. |

### Optional environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_KEY` | — | API key for [OpenRouter](https://openrouter.ai) (recommended). |
| `OPENAI_API_KEY` | — | Alternative: a direct OpenAI key. |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` | Any OpenAI-compatible base URL (e.g. Ollama at `http://host.docker.internal:11434/v1`). |
| `OCR_VLM_MODEL` | `qwen/qwen3.7-flash` | Model used for OCR / extraction. |
| `METADATA_LLM_MODEL` | `openai/gpt-5.4` | Model used for title/description/date extraction. |
| `PORT` | `3000` | Port inside the container. |
| `TZ` | `UTC` | Timezone for date display (any [tz database name](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)). Datetimes are stored UTC and rendered local via luxon, so this controls what you see, not what's stored. |
| `INGEST_WATCH_POLL` | `false` | Poll `INGEST_DIR` instead of inotify. Enable on NFS, SMB, or FUSE mounts — inotify can't see remote-side changes. |
| `INGEST_WATCH_POLL_INTERVAL_MS` | `2000` | Poll interval when polling is enabled. |
| `SQLITE_MAINTENANCE_INTERVAL_MS` | `1800000` | Periodic WAL checkpoint interval; `0` disables the timer. |
| `SQLITE_VACUUM_INTERVAL_MS` | `0` | Optional periodic `VACUUM` (compaction); `0` disables. |

---

## Local development

Prerequisites: [Bun](https://bun.sh) and a Rust toolchain (for the Kreuzberg extraction CLI).

1. **Install deps:** `bun install`
2. **Build the extraction CLI:** `cargo build -p kreuzakt-kreuzberg`
3. **Configure env:** copy `.env.local.example` to `.env.local` and set at least one way to reach an OpenAI-compatible API — usually `OPENROUTER_KEY`. For a local LLM (so dev doesn't cost money), set the dev-only overrides `OPENAI_DEV_URL`, `OPENAI_DEV_API_KEY`/`OPENAI_DEV_KEY`, and optionally `OCR_VLM_DEV_MODEL` / `METADATA_LLM_DEV_MODEL`; these win over the production vars when running under `bun dev`.
4. **Run it:** `bun dev` — app on port 3000, runtime data under `./data`.

Other useful commands:

- `bun test` — unit tests (no API keys needed).
- `cargo test` — Rust extraction CLI tests.
- `bun run test:integration` — integration tests (loads `.env.local` via `--env-file`; needs valid keys).
- `bun run check` — Biome lint + `tsgo --noEmit` type check.
- `bun storybook` — UI component development on port 6006.
- `bun run eval` — the OCR-quality evaluation harness in `eval/`: extracts a set of fixtures with selectable backends and uses an LLM judge to score them, writing a report under `eval/results`.

---

## So… why's it called "Kreuzakt"?

It uses the library **Kreuzberg**, and it's a tool to help you with your **Akte** (German for files/documents). Just like *Berghain* is a portmanteau of *Kreuzberg* and *Friedrichshain*, the two Berlin districts it sits between. (Today you learn!)

---

## License

Kreuzakt is licensed under the [GNU Affero General Public License v3.0](./COPYING).

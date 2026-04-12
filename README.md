# docs-ai - a simple replacement for Paperless

docs-ai is a project that takes the best parts of Paperless, drastically improves the OCR using VLLMs, and throws out 99% of the complexity.

<img width="2000" height="655" alt="image" src="https://github.com/user-attachments/assets/c04fd7dd-fccd-4c2f-a5b1-70c94b637e19" />

### What's Different:

- docs-ai uses a single Docker container with an SQLite database, there aren't a ton of moving parts
- Rather than use Tesseract, docs-ai uses LLMs to do OCR (by default via OpenRouter but Ollama/Local LLMs work as well) via [Kreuzberg](https://kreuzberg.dev). This *drastically* improves OCR accuracy, and by extension, search accuracy.
- docs-ai provides a remote MCP server - connect Claude Desktop, Cursor, or any other MCP client to docs-ai and ask questions about your documents
- docs-ai uses an LLM to also derive a title / description / original date for every document, out of the box. Zero manual curation / toil work.
- Metadata can always be regenerated from the source documents, the only thing you need to migrate is the originals

### What's the Same:

- docs-ai **always** preserves your original documents, it never edits them directly
- Ingestion based on file watches works the same, drop documents into the 'ingest' folder and it will automatically be processed

## Self-hosting with Docker Compose

```yaml
services:
  docs-ai:
    image: ghcr.io/anaisbetts/docs-ai:latest
    ports:
      - "3000:3000"
    environment:
      OPENROUTER_KEY: ${OPENROUTER_KEY}
    volumes:
      - ./docs:data
    restart: unless-stopped
```

Drop this in a `docker-compose.yml`, set `OPENROUTER_KEY` in your environment or a `.env` file, and run `docker compose up -d`. The web UI is at `http://localhost:3000`.

The `./docs` folder will be initialized with directories including `./data/ingest`, `./data/originals`, and `./data/thumbnails`. 

### Ok now what do I do?

1. `docker-compose up -d`
2. Drop all of your documents into the ingest folder - they will eventually all move to the originals folder. You can see the progress at `/settings` - if you have a lot of documents it might take a bit.
3. If you've got an existing Paperless install, you can run the import
4. You can also simply drag-drop a bunch of files onto the main page

### How much is this gonna cost me?

I'm too lazy to do the math on exactly how much per-page it costs, but for perspective, importing 440 documents from Paperless (a few of which were up to 80pgs long), cost me ~$5.

### Volume mounts

Everything lives under `/data` by default — the SQLite database, originals, thumbnails, and the ingest folder. If you want to split things up, override with individual env vars and mount each path separately:

| Variable | Default | Description |
|---|---|---|
| `INGEST_DIR` | `/data/ingest` | Watched folder for new documents |
| `IMPORT_DIR` | `/data/import` | Staging folder for orchestrated imports (e.g. Paperless); not watched |
| `ORIGINALS_DIR` | `/data/originals` | Stored original files |
| `THUMBNAILS_DIR` | `/data/thumbnails` | Generated thumbnails |
| `DB_PATH` | `/data/docs-ai.db` | SQLite database |

### Optional environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_KEY` | — | API key for [OpenRouter](https://openrouter.ai) (recommended) |
| `OPENAI_API_KEY` | — | Alternative: direct OpenAI key |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` | Base URL for any OpenAI-compatible API (e.g. Ollama at `http://host.docker.internal:11434/v1`) |
| `OCR_VLM_MODEL` | `openai/gpt-5.4-mini` | Model used for OCR |
| `METADATA_LLM_MODEL` | `openai/gpt-5.4` | Model used for title/description extraction |
| `PORT` | `3000` | Port inside the container |

## MCP setup

docs-ai exposes a remote MCP endpoint at **`/mcp`** (Streamable HTTP). Replace the hostname in the snippets below with wherever you serve the app — for example `https://docs.your-tailnet.ts.net/mcp` when using [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve). Most clients will not talk to plain `http`, so terminating TLS (Serve, a reverse proxy, etc.) is the usual approach.

<details>
<summary><strong>Claude Desktop</strong> — <code>npx mcp-remote@latest …</code></summary>

[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) bridges the HTTP MCP endpoint for clients that expect a local process.

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

Add to `.cursor/mcp.json` or your project’s MCP settings.

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

### What the MCP server exposes

- Tools:
  - `search_documents`
  - `get_document`
  - `get_document_content`
  - `list_recent_documents`
  - `download_document`

### What to expect

Once connected, your assistant can:

- search the archive by natural language
- fetch one or more full documents in a single call
- fetch only extracted text when metadata is unnecessary
- list recently added documents
- generate download links for original files

### Example prompts

- "Find invoices from Deutsche Telekom."
- "What was my health insurance number again?"
- "How much did I pay in taxes last year"

## Local development

Prerequisites: [Bun](https://bun.sh) (the project runs Next.js and scripts through Bun; see `package.json`).

1. Install dependencies: `bun install`
2. Copy `.env.local.example` to `.env.local` and set at least one way to reach an OpenAI-compatible API. The usual choice is `OPENROUTER_KEY`. For a local LLM, set `OPENAI_DEV_URL`, `OPENAI_DEV_KEY`, and optionally `OCR_VLM_DEV_MODEL` / `METADATA_LLM_DEV_MODEL`. See `.env.local.example` for all variables the app and tooling recognize.
3. Start the dev server: `bun dev`. The app listens on port 3000 by default (`PORT`). Runtime data defaults to `./data` (SQLite, ingest, originals, thumbnails) unless you override `DATA_DIR` or individual path variables.

Other useful commands:

- `bun test` — unit tests
- `bun run test:integration` — integration tests (loads `.env.local` via `--env-file`; requires Paperless-related vars when those tests run)
- `bun storybook` — UI development on port 6006

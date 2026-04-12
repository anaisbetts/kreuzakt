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

The `./docs` folder will be initialized with three directories - `./data/ingest`, `./data/originals`, and `./data/thumbnails`. To get started, drop all of your documents into the ingest folder - they will eventually all move to the originals folder. You can see the progress at `http://localhost:3000/status` - if you have a lot of documents it might take a bit.

### Volume mounts

Everything lives under `/data` by default — the SQLite database, originals, thumbnails, and the ingest folder. If you want to split things up, override with individual env vars and mount each path separately:

| Variable | Default | Description |
|---|---|---|
| `INGEST_DIR` | `/data/ingest` | Watched folder for new documents |
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

If your MCP client supports remote Streamable HTTP servers, point it at the `/mcp` URL directly. A typical config looks like this:

```json
{
  "mcpServers": {
    "docs-ai": {
      "url": "https://docs-ai.tailnet.ts.net/mcp"
    }
  }
}
```

Because most MCP clients refuse to connect to servers over `http`, it is recommended to use [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve) - this will give Docs AI an HTTPS endpoint but not expose it to the public Internet.

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
- "Show me the full text of documents 12 and 14."
- "What documents were added in the last week?"
- "Give me a download link for document 42."

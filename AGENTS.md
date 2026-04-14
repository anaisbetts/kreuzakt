## Cursor Cloud specific instructions

- **Runtime**: Bun is installed at `~/.bun/bin/bun`. Ensure `~/.bun/bin` is on `PATH` (the update script handles this).
- **No external services needed**: SQLite is embedded via `bun:sqlite`; no database server to start. The `./data` directory (DB, ingest, originals, thumbnails) is auto-created on first run.
- **LLM API key is optional for dev**: Without `OPENROUTER_KEY` or `OPENAI_API_KEY`, the app starts and runs normally. Document ingestion falls back to filename-based metadata (no OCR/LLM enrichment). To enable full LLM features, copy `.env.local.example` to `.env.local` and set at least `OPENROUTER_KEY`.
- **Dev server**: `bun dev` starts Next.js on port 3000. The server auto-creates the SQLite DB and data directories on startup.
- **Lint + type check**: `bun run check` runs Biome lint followed by `tsgo --noEmit`.
- **Unit tests**: `bun test` — all 24 unit tests should pass without any env vars or API keys.
- **Integration tests**: `bun run test:integration` requires `.env.local` with valid API keys and sets `KREUZAKT_RUN_INTEGRATION=1` automatically.
- **Upload test**: `curl -X POST http://localhost:3000/api/upload -F "files=@/path/to/file"` to verify document ingestion end-to-end.
- **Search test**: `curl "http://localhost:3000/api/search?q=<term>"` to verify FTS search works.

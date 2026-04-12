# docs-ai - a simple replacement for Paperless

docs-ai is a project that takes the best parts of Paperless, drastically improves the OCR using VLLMs, and throws out 99% of the complexity.

### What's Different:

- docs-ai uses a single Docker container with an SQLite database, there aren't a ton of moving parts
- Rather than use Tesseract, docs-ai uses LLMs to do OCR (by default via OpenRouter but Ollama/Local LLMs work as well). This *drastically* improves OCR accuracy, and by extension, search accuracy.
- docs-ai provides a remote MCP server - connect Claude Desktop, Cursor, or any other MCP client to docs-ai and ask questions about your documents
- docs-ai uses an LLM to also derive a title / description / original date for every document, out of the box
- Metadata can always be regenerated from the source documents, the only thing you need to migrate is the originals

### What's the Same:

- docs-ai always preserves your original documents, it never edits them directly
- Ingestion based on file watches works the same, drop documents into the 'ingest' folder and it will automatically be processed

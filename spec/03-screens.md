# Docs-AI — Screens

## S-01: Search

The primary screen. Inspired by Google Search — a centered search bar that expands into results.

### Empty State (no query)

```
┌─────────────────────────────────────────────────────┐
│                                            [⚙ Status]│
│                                                      │
│                                                      │
│                                                      │
│                      Docs-AI                         │
│                                                      │
│          ┌──────────────────────────────┐            │
│          │  Search your documents...    │            │
│          └──────────────────────────────┘            │
│                                                      │
│                                                      │
│           ── Recent Documents ──                     │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐│
│  │ ┌────┐       │  │ ┌────┐       │  │ ┌────┐     ││
│  │ │thumb│ Title │  │ │thumb│ Title │  │ │thumb│Title││
│  │ └────┘       │  │ └────┘       │  │ └────┘     ││
│  │ Mar 15, 2026 │  │ Mar 12, 2026 │  │ Mar 10     ││
│  │ Description  │  │ Description  │  │ Desc...    ││
│  └──────────────┘  └──────────────┘  └────────────┘│
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐│
│  │ ...          │  │ ...          │  │ ...        ││
│  └──────────────┘  └──────────────┘  └────────────┘│
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Behavior:**

- The search bar is vertically centered with generous whitespace above and below
- Below the search bar, recent documents are shown as a grid of cards
- Each card shows: thumbnail, title, document date, and a truncated description
- Clicking a card navigates to S-02 (Document Viewer) for that document
- The status icon (top right) links to S-03

### Active Search (query entered)

```
┌─────────────────────────────────────────────────────┐
│  Docs-AI   ┌────────────────────────────┐  [⚙]     │
│            │  invoice telekom     [×]   │           │
│            └────────────────────────────┘           │
│                                                      │
│  12 results                                          │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ┌────┐  Deutsche Telekom Invoice — Mar 2026  │   │
│  │ │thumb│  March 15, 2026                       │   │
│  │ └────┘  ...monthly **invoice** for mobile     │   │
│  │         service from **Telekom**...           │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ┌────┐  Deutsche Telekom Invoice — Feb 2026  │   │
│  │ │thumb│  February 15, 2026                    │   │
│  │ └────┘  ...your **Telekom** mobile plan       │   │
│  │         **invoice** for February...           │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ ...                                          │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│                   [1] 2  3  Next →                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Behavior:**

- On typing, the layout transitions: search bar moves to the top, results appear below
- Results are a vertical list of cards (not a grid — list is better for scanning text snippets)
- Each card shows: thumbnail, title, document date, and a snippet with highlighted match terms
- Matching terms are bold in the snippet (via FTS5 `snippet()` or `highlight()`)
- Result count shown above the list
- Pagination at the bottom (20 results per page)
- Clicking a result navigates to S-02
- Clear button (×) in the search bar resets to the empty state
- Search is triggered on Enter or after a short debounce (~300ms) while typing
- Keyboard navigation: arrow keys to move through results, Enter to open

### Responsive Behavior

- **Desktop (>768px):** cards in the empty state are a 3-column grid; search results are a single-column list with thumbnails on the left
- **Mobile (<768px):** cards stack vertically in the empty state; search results are full-width cards with thumbnail above title

---

## S-02: Document Viewer

Shows a single document's content and metadata.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  ← Back to search                          [⚙]     │
│                                                      │
│  ┌─────────────────────────┬────────────────────┐   │
│  │                         │                    │   │
│  │                         │  Title             │   │
│  │                         │  Deutsche Telekom   │   │
│  │                         │  Invoice — Mar 2026 │   │
│  │                         │                    │   │
│  │    [ Document View ]    │  Description       │   │
│  │                         │  Monthly mobile     │   │
│  │    PDF viewer /         │  service invoice    │   │
│  │    image viewer /       │  from Deutsche      │   │
│  │    extracted text       │  Telekom for the    │   │
│  │                         │  billing period     │   │
│  │                         │  March 2026.        │   │
│  │                         │                    │   │
│  │                         │  Document Date     │   │
│  │                         │  March 15, 2026    │   │
│  │                         │                    │   │
│  │                         │  Added             │   │
│  │                         │  March 20, 2026    │   │
│  │                         │                    │   │
│  │                         │  Original File     │   │
│  │                         │  scan_20260315.pdf │   │
│  │                         │                    │   │
│  │                         │  ┌──────────────┐  │   │
│  │                         │  │  ⬇ Download  │  │   │
│  │                         │  └──────────────┘  │   │
│  │                         │                    │   │
│  │                         │  ┌──────────────┐  │   │
│  │                         │  │  📄 View Text│  │   │
│  │                         │  └──────────────┘  │   │
│  └─────────────────────────┴────────────────────┘   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Behavior:**

- Two-panel layout: document content on the left, metadata sidebar on the right
- The left panel renders based on MIME type:
  - **PDF:** browser-native PDF viewer or pdf.js embed
  - **Image:** zoomable image viewer
  - **Other:** the extracted text displayed as formatted plaintext
- The "View Text" button toggles the left panel to show the extracted text regardless of format (useful for verifying OCR quality)
- "Download" serves the original file with its original filename
- "Back to search" returns to S-01, preserving the previous search query and scroll position

### Responsive Behavior

- **Desktop (>768px):** side-by-side two-panel layout as shown
- **Mobile (<768px):** stacked layout — metadata panel appears above or below the document view, collapsible

---

## S-03: Status / Admin

Processing queue visibility and system health. Not a primary navigation target — accessible via a small icon in the header of S-01 and S-02.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  ← Back                                             │
│                                                      │
│  System Status                                       │
│  ─────────────                                       │
│  Database: ✓ OK (487 documents)                      │
│  Originals: ✓ /data/originals/ (2.3 GB)             │
│  Ingest: ✓ /data/ingest/ (watching)                  │
│  OCR Model: qwen/qwen3.5-122b-a10b                   │
│  Metadata Model: qwen/qwen3.5-122b-a10b              │
│  LLM Endpoint: http://localhost:11434/v1             │
│                                                      │
│  Processing Queue                                    │
│  ─────────────────                                   │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │ ● scan_0412.pdf     processing   just now     │  │
│  │ ✓ invoice_march.pdf completed    2 min ago    │  │
│  │ ✓ contract.pdf      completed    5 min ago    │  │
│  │ ✗ blurry_scan.jpg   failed       10 min ago   │  │
│  │   "VLM extraction timeout"       [↻ Retry]    │  │
│  │ ✓ receipt.png       completed    1 hour ago   │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  Showing 5 of 24 queue entries     [Show all]        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Behavior:**

- Top section shows system health: database status, directory status, configured models, and the active OpenAI-compatible endpoint
- Processing queue shows recent pipeline activity
- Status indicators: ● processing, ✓ completed, ✗ failed
- Failed items show the error message and a retry button
- Clicking retry re-queues the original file for processing
- Default view shows the last 5 entries; "Show all" expands to the full queue
- Auto-refreshes while the page is open (polling or SSE)

---

## Navigation

The application has minimal navigation. There are effectively two modes:

1. **Search** (S-01) — where you spend 95% of your time
2. **View** (S-02) — opened from search results

The status page (S-03) is a maintenance/monitoring view, not part of the primary flow.

```
S-01 Search ──── click result ────► S-02 Document Viewer
     │                                     │
     │                                     │
     └──── status icon ──► S-03 Status ◄───┘
```

### URL Structure

| Route | Screen | Description |
|-------|--------|-------------|
| `/` | S-01 | Search (empty state or with `?q=...` query parameter) |
| `/documents/:id` | S-02 | Document viewer |
| `/status` | S-03 | Processing queue and system health |

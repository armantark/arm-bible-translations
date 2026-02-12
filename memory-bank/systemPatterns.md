# System Patterns

## Architecture
- **Data:** JSON files in `data/`, one per book. These are the source of truth.
- **Frontend:** Svelte 5 + TypeScript + Vite SPA. Components in `src/components/`.
- **Dev API:** Vite plugin (`bibleApiPlugin` in `vite.config.ts`) handles read/write.
- **Prod API:** Bun server (`server.ts`) serves static build + JSON API.
- **Import:** One-time Python script (`scripts/import_docx.py`) bootstraps data from DOCX.

## Data Contract
Each book file (`data/{book-id}.json`) contains:
```json
{
  "id": "genesis",
  "name": { "english": "Genesis", "armenian": "ԾԱԴDELAYS", "classical": "" },
  "chapters": [{
    "number": 1,
    "content": [
      { "kind": "heading", "armenian": "...", "english": "...", "classical": "" },
      { "kind": "verse", "number": 1, "armenian": "...", "english": "...", "classical": "", "footnotes": [], "indentLevel": 1 }
    ]
  }]
}
```

## Key Patterns
- **Immutable store updates:** `updateVerse()` in `stores.ts` produces new objects via spread.
- **Debounced auto-save:** Changes trigger a 1.5s debounce timer; saves via PUT to API.
- **Click-to-edit:** Verses show plain text; clicking opens a textarea; blur commits.
- **Type guards:** `isVerse()` and `isHeading()` discriminate `ChapterItem` union.
- **Retry with backoff:** API calls use `fetchWithRetry()` with 3 attempts.
- **Poetry rendering:** When `verse.poetry === true`, text is split into punctuation-based clauses and rendered as one line per clause with hanging-indent CSS; optional imported `indentLevel` applies as a base override.

## Component Hierarchy
```
App.svelte
├── Header.svelte      (column toggles, save button)
├── Sidebar.svelte     (book list with search)
├── ChapterView.svelte (book title, chapter heading, column headers [fixed], verse scroll area)
│   └── VerseRow.svelte (per-verse display + edit)
└── ChapterNav.svelte  (chapter buttons)
```

## Layout Pattern
- **Fixed header zone:** Book title, chapter heading, poetry bar, and column headers stay fixed at top.
- **Scrollable verse zone:** Only the verse grid scrolls (inside `.chapter-scroll` wrapper).
- This prevents z-index stacking conflicts with dnd-kit sortable items during drag operations.

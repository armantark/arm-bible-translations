# Tech Context

## Stack
- **Runtime:** Bun 1.3.9
- **Framework:** Svelte 5 (with runes: `$state`, `$derived`, `$effect`, `$props`)
- **Language:** TypeScript 5.9 (strict mode)
- **Build:** Vite 6.4
- **Package Manager:** Bun
- **DnD Library:** `@dnd-kit-svelte/svelte`
- **Fonts:** Google Fonts (Noto Serif Armenian, Noto Serif, Inter)

## Project Structure
```
├── data/              # JSON book files (source of truth)
├── scripts/
│   └── import_docx.py # One-time DOCX→JSON importer (Python 3, stdlib)
├── src/
│   ├── main.ts        # Entry point
│   ├── App.svelte     # Root component
│   ├── app.css        # Global dark theme styles
│   ├── lib/
│   │   ├── types.ts   # BookData, Chapter, Verse, etc.
│   │   ├── api.ts     # fetch helpers with retry
│   │   ├── stores.ts  # Svelte stores, auto-save, mutations, options, undo wiring
│   │   ├── undoStack.ts # Snapshot history (undo/redo)
│   │   └── locales/   # Centralized UI localization files (EN/HY/GR)
│   └── components/    # UI components
├── server.ts          # Production Bun server
├── vite.config.ts     # Vite + Svelte + API plugin
├── index.html         # HTML shell
└── memory-bank/       # Project documentation
```

## Commands
- `bun run dev`    — Start Vite dev server (http://localhost:5173)
- `bun run build`  — Production build to `dist/`
- `bun run serve`  — Production Bun server (http://localhost:3000)
- `bun run check`  — Run svelte-check for type errors
- `bun run import` — One-time DOCX import (python3)

## Constraints
- Must preserve Unicode Armenian text faithfully.
- No heavy frameworks beyond Svelte.
- Local-first: all data persists to filesystem JSON files.
- IDE linter shows Svelte 5 rune warnings; `svelte-check` passes cleanly.
- All user-facing copy must come from locale files; avoid hardcoded UI strings.

## Interaction/State Patterns
- All book-content mutations route through `stores.ts` helpers so undo snapshots and autosave stay consistent.
- Undo stack is snapshot-based (`structuredClone`), capped at 50 history entries.
- Global undo/redo shortcuts are handled in `App.svelte` and ignored while typing in inputs/textareas/selects.
- Sortable UI uses `SortableItem.svelte` with `useSortable` from `@dnd-kit-svelte/svelte`.
- Sidebar book ordering preference is persisted in `localStorage` under `armenian-bible-book-order`.

## Data Notes
- Footnotes are per-language and per-word:
  - `VerseFootnotes = { armenian: WordFootnote[], english: WordFootnote[], classical: WordFootnote[] }`
  - `WordFootnote = { id: string, text: string, anchorWord: number }`
- Import script (`scripts/import_docx.py`) preserves inline footnote positions and maps them to `anchorWord`.
- `_anchor_word_from_offset` now uses `text[:offset].rstrip().split()` semantics to avoid whitespace off-by-one anchors.
- Import script now reads DOCX paragraph indentation metadata (`w:pPr/w:ind`) and stores optional `indentLevel` on verse records for poetry indentation overrides.

## API Notes
- `GET /api/books` returns summaries from `data/*.json`.
- `GET /api/books/:id` reads a book JSON file.
- `PUT /api/books/:id` overwrites a book JSON file.
- `POST /api/books` creates a new book JSON file (validated `id`, conflict-safe).

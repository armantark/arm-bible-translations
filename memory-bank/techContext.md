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

## Branching Strategy

Three distinct branch categories exist and must never be conflated:

- **`main`** — the perpetual integration branch. Receives all changes that should be permanently part of the codebase. Every completed unit of work — including UI hotfixes, CSS refinements, and infrastructure changes — must be committed directly to `main` (or merged into it via PR) before any downstream branch picks them up. No work lives on `main` in progress; it is always in a releasable state.

- **Feature branches** (e.g. `feature/search`, `feature/export-docx`) — scoped development branches for discrete, potentially multi-session engineering tasks. They diverge from `main`, accumulate commits for the duration of their feature, and are merged back to `main` via PR upon completion. They must not carry translation data changes.

- **Translation branches** (e.g. `translation-2025-02-18`) — short-lived working branches for active translation sessions. They are named by date, diverge from `main` at session start, and accumulate edits to `data/*.json` files only. When a translation session ends, the branch is committed and merged (or PR'd) into `main`. They must not carry UI/code changes — any UI fixes discovered during a translation session are committed to `main` first, then merged down into the translation branch before continuing.

**Hotfix rule:** UI, CSS, and logic fixes discovered at any time — including mid-translation-session — go to `main` immediately. The translation branch is then fast-forward merged with `main` to receive them before the translation session resumes.

## Constraints
- Must preserve Unicode Armenian text faithfully.
- No heavy frameworks beyond Svelte.
- Local-first: all data persists to filesystem JSON files.
- IDE linter shows Svelte 5 rune warnings; `svelte-check` passes cleanly.
- All user-facing copy must come from locale files; avoid hardcoded UI strings.
- **`:global()` is not valid CSS outside Svelte `<style>` blocks.** All edit-mode selectors in `app.css` must use plain `.edit-mode` descendant combinators, not `:global(.edit-mode)`, which browsers silently discard.

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
- Import script now reads DOCX paragraph indentation metadata (`w:pPr/w:ind`) and stores:
  - optional `indentLevel` for poetry indentation overrides
  - optional `firstLineIndent` (em) derived from `firstLine` / `hanging` (`*Chars` preferred when available)
- UI applies `firstLineIndent` to non-poetry verses using CSS `text-indent`.

## API Notes
- `GET /api/books` returns summaries from `data/*.json`.
- `GET /api/books/:id` reads a book JSON file.
- `PUT /api/books/:id` overwrites a book JSON file.
- `POST /api/books` creates a new book JSON file (validated `id`, conflict-safe).

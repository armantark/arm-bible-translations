# Armenian Bible Translations Editor

In-browser editor for Armenian Bible translation work, with side-by-side multilingual text, local JSON persistence, and drag-and-drop organization tools.

## What This Project Does

- Replaces a DOCX-first workflow with a local-first web editor.
- Uses JSON files in `data/` as the source of truth (one file per book).
- Shows Armenian and English side-by-side, with an optional Classical Armenian column.
- Supports click-to-edit, auto-save, per-word footnotes, chapter/book management, and undo/redo snapshots.

## Core Features

- Side-by-side chapter view (Armenian, English, optional Classical Armenian).
- Edit mode toggle with inline editing and auto-save.
- Drag-and-drop reordering for:
  - books
  - chapters
  - chapter content rows (verses/headings)
  - verse footnotes
- Snapshot undo/redo (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`).
- Per-word, per-language footnotes with tooltip or superscript display mode.
- Poetry formatting with clause-based line splitting and hanging indents.
- Centralized UI localization (`english`, `armenian`, `classical` locale files).

## Tech Stack

- Svelte 5 + TypeScript (strict)
- Vite (dev server + dev API middleware)
- Bun (production server runtime)
- JSON file storage (`data/*.json`)
- Python import script for one-time DOCX to JSON conversion (`scripts/import_docx.py`)

## Quick Start

### Prerequisites

- Bun (1.3+ recommended)
- Python 3 (for DOCX import only)

### Install

```bash
bun install
```

### Run Development Server

```bash
bun run dev
```

Open `http://localhost:5173`.

## Commands

- `bun run dev` - Start Vite dev server.
- `bun run build` - Build production assets to `dist/`.
- `bun run preview` - Preview the production build with Vite.
- `bun run serve` - Start Bun production server on `http://localhost:3000`.
- `bun run check` - Run `svelte-check` type and Svelte diagnostics.
- `bun run import` - Run one-time DOCX to JSON import script.

## Data Model

Each book is stored at `data/<book-id>.json`.

```json
{
  "id": "genesis",
  "name": {
    "english": "Genesis",
    "armenian": "Ծննդոց",
    "classical": ""
  },
  "chapters": [
    {
      "number": 1,
      "content": [
        {
          "kind": "heading",
          "armenian": "...",
          "english": "...",
          "classical": ""
        },
        {
          "kind": "verse",
          "number": 1,
          "armenian": "...",
          "english": "...",
          "classical": "",
          "footnotes": {
            "armenian": [],
            "english": [],
            "classical": []
          },
          "indentLevel": 1
        }
      ]
    }
  ]
}
```

Notes:

- `indentLevel` is optional and used for poetry indentation overrides.
- Footnotes are word-anchored with objects shaped as:
  - `{ "id": "note-id", "text": "note text", "anchorWord": 3 }`

## API

Both dev and production expose the same JSON API:

- `GET /api/books` - list book summaries.
- `GET /api/books/:id` - read full book JSON.
- `PUT /api/books/:id` - overwrite book JSON.
- `POST /api/books` - create new book file (`id` must match `^[a-z0-9_-]+$`).

## Project Structure

```text
data/                JSON source-of-truth files
scripts/             import tooling (DOCX -> JSON)
src/
  components/        Svelte UI components
  lib/
    api.ts           fetch helpers with retry
    stores.ts        state, mutations, autosave, undo wiring
    undoStack.ts     snapshot-based undo/redo
    locales/         localized UI strings
server.ts            Bun production server
vite.config.ts       Vite config + dev API middleware
memory-bank/         project context documentation
```

## Workflow Notes

- All user-facing UI copy should come from locale files in `src/lib/locales/`.
- Book content mutations should route through store helpers in `src/lib/stores.ts` to preserve undo/autosave behavior.
- Edit mode is currently client-toggle and should be protected by authentication before deployment.

## Attribution Request (Non-Binding)

Attribution is appreciated for both code and translation/editorial work, but it is not required by the content license used here.

If you reuse this project, a suggested courtesy credit is:

- "Based on Armenian Bible Translations Editor by Arman Tarkhanian."

## License

This repository uses split licensing:

- **Code** (for example `src/`, `server.ts`, `vite.config.ts`, tooling scripts unless noted): MIT License.
- **Translation/content data and documentation contributions** (for example `data/`, prose docs): CC0 1.0 Universal (public domain dedication).

Important:

- The license in this repository applies only to original contributions made here.
- Underlying scripture/source materials may carry separate rights or status in some jurisdictions.

## Known Content Caveats

Some source DOCX content has known omissions/mismatches (for example, missing verses in specific books and merged content anomalies). These are source-data issues, not editor rendering bugs.

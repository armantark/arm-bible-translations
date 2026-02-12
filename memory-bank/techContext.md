# Tech Context

## Stack
- **Runtime:** Bun 1.3.9
- **Framework:** Svelte 5 (with runes: `$state`, `$derived`, `$effect`, `$props`)
- **Language:** TypeScript 5.9 (strict mode)
- **Build:** Vite 6.4
- **Package Manager:** Bun
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
│   │   └── stores.ts  # Svelte stores, auto-save, mutations
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

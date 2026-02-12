# Project Brief

## Project
An in-browser Armenian Bible translation editor with side-by-side multilingual display and local persistence.

## Goals
- One-time import of existing DOCX translations into JSON data files.
- Web-based editor becomes the source of truth for ongoing translation work.
- Side-by-side Armenian and English columns, with optional Classical Armenian third column.
- Book/chapter navigation with section headings and footnote support.
- Easy to update: edit in browser, auto-saves to local JSON files.

## Scope
- Static Svelte + TypeScript frontend served by Vite (dev) or Bun (production).
- Lightweight API (Vite plugin in dev, Bun server in prod) for reading/writing JSON data.
- Data files in `data/` directory, one JSON file per book.

## Success Criteria
- All imported books render correctly with Armenian and English side by side.
- Click-to-edit any verse in the browser, with auto-save.
- Chapter/book navigation is fast and intuitive.
- Third Classical Armenian column can be toggled on/off.

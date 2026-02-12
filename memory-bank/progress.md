# Progress

## Completed
- Memory bank initialized per cline-memory-bank rule.
- Feature branch `feature/docx-bilingual-site` created.
- Bun installed (v1.3.9).
- Project scaffolded: package.json, tsconfig, Vite config, Svelte config.
- One-time DOCX import script created and run successfully:
  - Genesis (10 chapters, 235 verses)
  - Prayer of King Manasseh (1 chapter, 18 verses)
  - Second Esdras (3 chapters, 50 verses)
  - Psalms (14 selected psalms, 162 verses)
  - Wisdom of Solomon (2 chapters, 4 verses)
- Full Svelte 5 + TypeScript frontend built:
  - Dark theme with Armenian font support
  - Book sidebar with search
  - Chapter navigation
  - Side-by-side verse display (Armenian + English)
  - Click-to-edit with auto-save
  - Column visibility toggles (Armenian/English/Classical)
- Production Bun server created.
- `svelte-check` passes with 0 errors, Vite build succeeds.
- Next-session fix pack implemented and verified:
  - Reorder mutation/undo reliability improved (`applyBookMutation` snapshot path + robust DnD index resolution).
  - Per-verse poetry toggle moved away from drag handle conflict; section poetry toggle made inline and usable.
  - Sidebar footer overflow resolved for gear + display-language controls.
  - Floating edit FAB now uses Material Symbols `edit_square` icon (consistent across both modes, yellow when active).
  - Poetry rendering updated to clause-based line splitting with hanging indent CSS and left-aligned poetry text.
  - DOCX importer now captures paragraph indentation metadata and stores per-verse `indentLevel` when present.
  - `python3 scripts/import_docx.py` re-run; `data/*.json` regenerated with imported indent metadata.
  - Column header scroll bleed-through resolved by restructuring layout (headers fixed outside scroll area; only verse grid scrolls).
- Root `README.md` added with setup/install instructions, command reference, architecture summary, API routes, data model example, and workflow guidance.
- Added root `LICENSE` with split licensing:
  - MIT for code
  - CC0 1.0 for translation/content data and documentation contributions
- Updated `README.md` with non-binding attribution request and explicit license/scope notes.
- Added README screenshots (`docs/screenshots/editor-overview.png`, `docs/screenshots/chapter-view.png`, `docs/screenshots/edit-mode.png`) and linked them in a new Screenshots section.

## Remaining
- End-to-end editing test in browser (browser MCP not connected for automated test).
- Locale placeholder translations remain in non-English locale files (poetry strings at minimum).
- Genesis Chapter 10 has empty content (placeholder in source DOCX).
- Isaiah content merged into Wisdom of Solomon (DOCX structural mismatch).
- Export-to-DOCX feature for print workflow.

## Known Issues
- IDE linter shows Svelte 5 rune warnings (`$state`, `$props`, etc.) — these are false positives; `svelte-check` passes cleanly.
- Book count mismatch between Armenian (5) and English (6) DOCX files — Isaiah missing from Armenian side.

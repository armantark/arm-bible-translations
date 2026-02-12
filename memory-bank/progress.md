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

## Remaining
- End-to-end editing test in browser (browser MCP not connected for automated test).
- Footnote editing UI (data model supports it, UI not yet built).
- Heading editing support.
- Genesis Chapter 10 has empty content (placeholder in source DOCX).
- Isaiah content merged into Wisdom of Solomon (DOCX structural mismatch).
- Export-to-DOCX feature for print workflow.

## Known Issues
- IDE linter shows Svelte 5 rune warnings (`$state`, `$props`, etc.) — these are false positives; `svelte-check` passes cleanly.
- Book count mismatch between Armenian (5) and English (6) DOCX files — Isaiah missing from Armenian side.

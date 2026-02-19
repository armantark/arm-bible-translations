# Active Context

## Current State
Editor now supports per-word footnotes with corrected word anchoring, drag-and-drop reordering (books/chapters/content/footnotes), snapshot undo/redo (Cmd/Ctrl+Z), add chapter/book controls, corner X delete buttons for verses/headings, clause-based poetry layout with hanging indents, imported DOCX paragraph indent metadata (`indentLevel` + `firstLineIndent`), and updated poetry/FAB/sidebar UX fixes. UI copy remains centralized/localized. App builds cleanly.

## Recent Changes
- **Edit affordance + scrollbar clearance polish (all on `main`):**
  - Empty verse cells now render a localized `(CLICK TO EDIT)` placeholder in edit mode, matching heading behavior and providing a reliable click target.
  - Verse text blocks now show a gray dashed bounding box at rest, transitioning to gold on hover in edit mode.
  - Fixed all `:global()` CSS selectors in `app.css` — Svelte-only pseudo-class that browsers silently discard in plain `.css` files. Replaced with plain `.edit-mode` descendant selectors, activating previously inert edit-mode cursor, hover, and bounding-box rules.
  - Added `padding-right: 14px` to `.chapter-scroll` (unconditionally) so content sits clear of the macOS overlay scrollbar in both view and edit modes.
  - Edit-mode-only: increased inner horizontal padding on `.verse-text` boxes and added bottom margin on `.verse-cell` to prevent footnote controls from crowding the dashed border.
- **Copy verse button added:**
  - Each verse cell (classical, Armenian, English) now has a copy icon (Material Symbols `content_copy`) positioned bottom-right, visible on hover.
  - Copied text is formatted as `"verse text" --Book Chapter:Verse` with smart quotes and book name matching the language column.
- **Double-space rendering fix:**
  - Whitespace segments in the word tokenizer were rendering as `<span>{space}</span>` elements, which combined with Svelte template whitespace to produce doubled spaces.
  - Fix: non-word segments now render as bare `{' '}` text nodes (no wrapper `<span>`).
  - Also fixed one literal double space in Psalms data.
- **Tooltip underline trailing-space fix:**
  - Word `<span>` elements had template whitespace inside them (newlines/indentation between `>{seg.text}...{/if}</span>`), which was underlined by the `fn-word` dotted underline.
  - Fix: tightened all word span content onto single lines (`>{seg.text}{#if ...}{/if}</span>`) and changed `.verse-word` from `white-space: pre-wrap` to `normal`.
- **Empty tooltip bubble fix:**
  - `title=""` (empty string) on word spans without footnotes was showing a tiny empty tooltip in some browsers.
  - Changed to `title={undefined}` to omit the attribute entirely when no footnotes exist.
- **Empty verse-row-tools bubble fix:**
  - The `verse-row-tools` div (poetry toggle + delete button container) was always rendered even when empty (non-edit mode), showing as a tiny pill-shaped bubble on hover.
  - Fix: conditionally render the container only when it has content.
- **Poetry alternation uses global line index:**
  - Alternation (even = left, odd = indented) is based on global line position within the verse, not couplet-relative position.
- **DOCX newline normalization fix:**
  - Import pipeline now collapses embedded DOCX line breaks/whitespace to single spaces during verse text extraction.
  - Prevents source formatting artifacts from being interpreted as manual poetry line overrides.
- **Poetry line-breaking + wrapping control refined:**
  - Heuristic now uses punctuation nearest the midpoint, while respecting strong punctuation as multi-couplet boundaries.
  - Manual newline overrides (`\n`) are now first-class and take precedence over heuristic splitting.
  - Entering edit mode on poetry verses pre-populates the textarea with current heuristic line breaks, enabling precise add/remove control.
  - Wrapped continuations on odd poetry lines now render one extra indent level (double indent behavior), while even-line behavior remains unchanged.
- **DOCX indentation import tuned:**
  - Negative Word ruler hanging indents are stripped at import (and related `indentLevel` removed) to avoid over-indentation when poetry mode is toggled.
  - Positive first-line paragraph indents are preserved and applied only to paragraph-starting verses.
- **README screenshots added:**
  - Captured current UI screenshots and added them under `docs/screenshots/`.
  - Updated `README.md` with a new Screenshots section linking:
    - `docs/screenshots/editor-overview.png`
    - `docs/screenshots/chapter-view.png`
    - `docs/screenshots/edit-mode.png`
- **Licensing clarified (split model):**
  - Added root `LICENSE` with MIT for code and CC0 1.0 dedication for translation/content data and docs.
  - Updated `README.md` with a non-binding attribution request and license notes.
  - Added scope note that repository license applies to original contributions only; underlying scripture/source materials may have separate rights status.
- **Project documentation added:**
  - Created root `README.md` with setup, commands, architecture, API routes, data model, and workflow notes for onboarding and daily usage.
- **Next-session priority fixes implemented:**
  - Reorder mutation path hardened:
    - `applyBookMutation()` now snapshots from `get(bookData)` before commit and then `bookData.set(next)`.
    - DnD handlers now resolve indices from multiple operation fields (`index`, `data.current.index`, fallback parsed id) to avoid missed reorder mutations.
  - Poetry controls UX fixed:
    - Per-verse poetry toggle moved to right-side tools area near delete control (no drag-handle overlap).
    - Section-level poetry toggle moved inline with heading text and made explicit toggle (active/inactive state).
  - Sidebar footer overflow fixed:
    - Added overflow/min-width constraints for footer + language controls; sidebar now hides horizontal overflow.
  - Floating editor FAB icon unified:
    - Replaced custom SVG with Material Symbols Outlined `edit_square` icon font.
    - Single icon is used in both modes; active state only controls yellow highlight.
  - Poetry rendering updated:
    - Poetry verses now split into clauses by punctuation (English and Armenian sets), one clause per line.
    - Alternating line indentation is implemented with hanging indent CSS.
    - Imported `indentLevel` (if present) is applied as an explicit base indent override.
  - DOCX paragraph indentation import added:
    - Import script now reads `<w:pPr><w:ind ...>` and computes an `indentLevel`.
    - `indentLevel` is written per verse in generated JSON where metadata exists.
    - Re-ran `python3 scripts/import_docx.py` to regenerate `data/*.json`.
  - Column header scroll bleed-through fixed:
    - Restructured layout: book title, chapter heading, and column headers are now fixed (non-scrolling).
    - Only the verse grid scrolls (inside `.chapter-scroll` container).
    - Abandoned sticky positioning approach due to z-index stacking issues with dnd-kit library.
- **DOCX first-line indentation import + rendering added:**
  - `scripts/import_docx.py` now reads DOCX `w:ind` first-line/hanging metadata (`firstLine`, `hanging`, plus `*Chars` variants) and stores normalized `firstLineIndent` (em) per verse.
  - `src/lib/types.ts` `VerseItem` now includes optional `firstLineIndent?: number`.
  - `src/components/VerseRow.svelte` applies `firstLineIndent` to non-poetry verses via `text-indent` (first line only), keeping poetry behavior unchanged.
  - Re-ran `python3 scripts/import_docx.py`; regenerated `data/*.json` now includes `firstLineIndent` where source metadata exists.
- **Footnote anchoring bug fixed at import layer:**
  - Updated `scripts/import_docx.py` `_anchor_word_from_offset` to anchor based on `text[:offset].rstrip().split()` word count.
  - Re-ran `python3 scripts/import_docx.py` to regenerate all `data/*.json` files with corrected `anchorWord` output.
- **Undo/redo snapshot system added:**
  - New `src/lib/undoStack.ts` with capped history (`MAX_SNAPSHOTS = 50`), undo, redo.
  - `src/lib/stores.ts` now wraps all book mutations with snapshot capture.
  - Added global keyboard shortcuts in `App.svelte`:
    - `Cmd/Ctrl+Z` -> undo
    - `Cmd/Ctrl+Shift+Z` -> redo
- **Drag-and-drop reordering added (Svelte 5):**
  - Dependency installed: `@dnd-kit-svelte/svelte`.
  - New `src/components/SortableItem.svelte` wrapper built on `useSortable`.
  - DnD enabled for:
    - sidebar books (`Sidebar.svelte`)
    - chapter nav chapters (`ChapterNav.svelte`)
    - chapter content rows (verses/headings in `ChapterView.svelte`)
    - footnotes in each verse (`VerseRow.svelte`)
- **Create chapter/book controls:**
  - Added `addChapter()` and `createBook()` flows in `stores.ts`.
  - Added API `POST /api/books` support in both `vite.config.ts` dev middleware and `server.ts`.
  - Added client helper `createBook()` in `src/lib/api.ts`.
- **Delete controls changed to corner X buttons:**
  - Verse and heading delete buttons are now compact corner buttons (`x-delete-btn`) instead of full-width text delete rows.
- **Gear icon rendering fixed:**
  - Replaced Unicode gear glyph with inline SVG in `Sidebar.svelte`.
  - Updated button layout styling for consistent alignment.
- **New localization keys added:**
  - `addChapter`, `addBook`, `deleteChapter`, `deleteBook`, `dragToReorder`, `undo`, `redo`.
- **Localization correction (Western Armenian + Classical spelling):**
  - Updated `armenian.ts` to use Western Armenian dialect with Classical (traditional) spelling.
  - Refined `classical.ts` (Grabar) for better linguistic accuracy and consistent classical orthography.
- **Per-word footnotes (data + UI):**
  - `WordFootnote` model introduced: `{ id, text, anchorWord }`.
  - `VerseFootnotes` now stores arrays of `WordFootnote` per language.
  - Import pipeline now keeps inline footnote position and maps each note to a word index.
  - Editor supports choosing anchor word (`Pick word`) and editing/deleting footnotes.
- **Footnote display mode option (default tooltip):**
  - Added options modal with gear button in sidebar footer.
  - New setting: `tooltip` (default) vs `superscript`.
  - Tooltip mode highlights anchored words; superscript mode renders inline note numbers.
- **Delete controls added in edit mode:**
  - Delete heading button (corner X).
  - Delete verse button (corner X).
  - Delete footnote button (existing, retained).
  - Verse insert now shifts subsequent verse numbers; verse delete decrements following verse numbers.
- **Localization architecture added:**
  - `src/lib/locales/english.ts`
  - `src/lib/locales/armenian.ts`
  - `src/lib/locales/classical.ts`
  - `src/lib/locales/index.ts`
  - All visible UI copy now routes through locale strings.
  - Brand code is localized (`ARM` / `ԱՐՄ`), replacing glitchy mixed-script token output.
- **Hyphenation experiment kept enabled:** `hyphens: auto` + `lang` attributes remain, but Armenian browser support is still unreliable.

## Localization Rule (Important)
- **Any new UI copy must be added to locale files first** (`english.ts`, `armenian.ts`, `classical.ts`) and then referenced via store-driven localized strings.
- No hardcoded user-facing strings should be introduced in Svelte components.
- **CRITICAL: Do NOT attempt to write Armenian (or Classical Armenian) text.** Claude cannot produce correct Armenian. Only use English placeholders with `// TODO: translate` comments in `armenian.ts` and `classical.ts`. Armenian translations require explicit user approval and must be provided by the user or by Gemini. Never modify existing Armenian text in these files.

## Active Decisions
- JSON data files remain the source of truth.
- Edit mode stays client-toggle for now; auth is still required before deployment.
- Footnotes are word-anchored and language-specific.
- Default footnote UI mode is tooltip.
- Classical column can remain partially empty for manual fill-in.
- Book order is persisted client-side in `localStorage` (`armenian-bible-book-order`); chapter/content/footnote reorders persist via normal book save flow.

## Known Data Gaps (genuine source omissions)
- Genesis 1:12 — Armenian text missing (translator-confirmed)
- Second Esdras 1:28 — Armenian text missing
- Second Esdras ch 33 verse 38, ch 42 verses 45/48 — missing entirely
- Wisdom of Solomon 1:13 — Armenian text missing
- Wisdom of Solomon 20:2 — English text missing (Isaiah content area)

## TODO / Next Steps
- **USER PRIORITY (next session):**
  1. **Search by word and search by verse** — full-text search across the loaded books, with results navigating to the matching verse/word.
  2. **Production edit-mode lockdown** — add an environment variable flag (e.g. `VITE_EDIT_ENABLED=false`) that:
     - Completely disables the edit-mode toggle in the UI when not set/false.
     - Closes all write API endpoints (`PUT /api/books/:id`, `POST /api/books`, `DELETE /api/books/:id`) so no mutations are possible from the public internet.
     - Local dev keeps full editing capability; deployed site is read-only by default.
     - Goal: prevent malicious data tampering on the public site while keeping the git repo as the easy rollback mechanism.
  3. Validate reorder undo behavior interactively in browser across content/chapter/footnote DnD.
  4. Consider adding manual USFM-like per-line indent controls (`q1/q2/q3`) as an explicit editorial override.
  5. Translate remaining locale placeholders (poetry strings and other TODO markers in `armenian.ts` and `classical.ts`).
- **Deferred architecture idea (later project):**
  - Evaluate styling strategy for agentic coding ergonomics:
    - Keep plain CSS and modularize `src/app.css` into feature-focused files first.
    - Then compare Sass (organization/mixins/partials) vs Tailwind (utility workflow) for long-term maintainability.
    - Decision deferred until current UI/behavior work stabilizes; no immediate migration planned.
- Consider custom Armenian hyphenation strategy if browser-native support remains insufficient.
- Consider export-to-DOCX tooling with word-anchored footnote round-trip.

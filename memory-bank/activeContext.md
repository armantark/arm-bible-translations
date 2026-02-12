# Active Context

## Current State
Editor now supports per-word footnotes with anchors, delete controls for rows, and a real options modal. UI copy is centralized and localized via one file per language. App builds cleanly.

## Recent Changes
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
  - Delete heading button.
  - Delete verse button.
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

## Active Decisions
- JSON data files remain the source of truth.
- Edit mode stays client-toggle for now; auth is still required before deployment.
- Footnotes are word-anchored and language-specific.
- Default footnote UI mode is tooltip.
- Classical column can remain partially empty for manual fill-in.

## Known Data Gaps (genuine source omissions)
- Genesis 1:12 — Armenian text missing (translator-confirmed)
- Second Esdras 1:28 — Armenian text missing
- Second Esdras ch 33 verse 38, ch 42 verses 45/48 — missing entirely
- Wisdom of Solomon 1:13 — Armenian text missing
- Wisdom of Solomon 20:2 — English text missing (Isaiah content area)

## TODO / Next Steps
- **AUTH:** Require authentication for edit mode before deployment.
- Consider custom Armenian hyphenation strategy if browser-native support remains insufficient.
- Consider export-to-DOCX tooling with word-anchored footnote round-trip.

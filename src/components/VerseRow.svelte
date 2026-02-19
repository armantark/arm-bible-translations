<script lang="ts">
  import type { VerseItem, VerseFootnotes, WordFootnote } from '../lib/types';
  import {
    editMode,
    currentChapter,
    bookData,
    updateFootnotes,
    reorderFootnotes,
    footnoteDisplayMode,
    locale,
  } from '../lib/stores';
  import { DragDropProvider } from '@dnd-kit-svelte/svelte';
  import SortableItem from './SortableItem.svelte';

  interface Props {
    verse: VerseItem;
    contentIndex: number;
    gridClass: string;
    showClassical: boolean;
    showArmenian: boolean;
    showEnglish: boolean;
    canDelete: boolean;
    deleteTitle: string;
    onDelete: () => void;
    onUpdate: (
      verseNumber: number,
      field: 'armenian' | 'english' | 'classical',
      value: string,
    ) => void;
    onUpdateFirstLineIndent?: (verseNumber: number, nextIndent: number | null) => void;
    onTogglePoetry?: () => void;
  }

  interface TextSegment {
    text: string;
    isWord: boolean;
    wordIndex: number;
    footnotes: WordFootnote[];
  }

  let {
    verse,
    contentIndex,
    gridClass,
    showClassical,
    showArmenian,
    showEnglish,
    canDelete,
    deleteTitle,
    onDelete,
    onUpdate,
    onUpdateFirstLineIndent,
    onTogglePoetry,
  }: Props = $props();

  type LangField = 'armenian' | 'english' | 'classical';

  let editingField = $state<LangField | null>(null);
  let editValue = $state('');
  let editDirty = $state(false);
  let editingFnLang = $state<LangField | null>(null);
  let editingFnIdx = $state<number>(-1);
  let fnEditValue = $state('');
  let pickingAnchor = $state<{ lang: LangField; idx: number } | null>(null);
  let copiedLang = $state<LangField | null>(null);

  async function copyVerseText(lang: LangField): Promise<void> {
    const text = verse[lang];
    if (!text) return;
    // Strip newlines (manual poetry overrides) for a clean single-line copy
    const clean = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    // Build attribution: --Book Chapter:Verse
    const bookName = $bookData?.name?.[lang] || $bookData?.name?.english || '';
    const chapter = $currentChapter;
    const verseNum = verse.number;
    const attribution = bookName ? ` --${bookName} ${chapter}:${verseNum}` : '';
    const formatted = `\u201C${clean}\u201D${attribution}`;
    await navigator.clipboard.writeText(formatted);
    copiedLang = lang;
    setTimeout(() => {
      if (copiedLang === lang) copiedLang = null;
    }, 1200);
  }

  function startEdit(field: LangField): void {
    if (!$editMode) return;
    editingField = field;
    editDirty = false;
    const rawText = verse[field];
    // In poetry mode, pre-populate with heuristic line breaks as \n
    // so the user can freely add/remove them for precise control.
    if (verse.poetry === true && !rawText.includes('\n')) {
      const lines = poetryLines(rawText, field);
      editValue = lines
        .map((lineSegs) => lineSegs.map((s) => s.text).join(''))
        .join('\n')
        .trim();
    } else {
      editValue = rawText;
    }
  }

  function commitEdit(): void {
    if (editingField) {
      // Do not persist auto-generated preview line breaks unless the user
      // actually modified the textarea content.
      if (editDirty) {
        onUpdate(verse.number, editingField, editValue.trim());
      }
      editingField = null;
    }
  }

  function markEditDirty(): void {
    editDirty = true;
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      editingField = null;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target as HTMLTextAreaElement;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      editValue = editValue.slice(0, start) + '\t' + editValue.slice(end);
      requestAnimationFrame(() => {
        ta.selectionStart = start + 1;
        ta.selectionEnd = start + 1;
      });
    }
  }

  function startFnEdit(lang: LangField, idx: number): void {
    if (!$editMode) return;
    editingFnLang = lang;
    editingFnIdx = idx;
    fnEditValue = getFootnotes(lang)[idx]?.text ?? '';
  }

  function commitFnEdit(): void {
    if (editingFnLang === null || editingFnIdx < 0) return;
    const lang = editingFnLang;
    const idx = editingFnIdx;
    const val = fnEditValue.trim();
    updateFootnotes($currentChapter, verse.number, lang, (arr) => {
      if (!arr[idx]) return arr;
      const copy = [...arr];
      copy[idx] = { ...copy[idx], text: val };
      return copy;
    });
    editingFnLang = null;
    editingFnIdx = -1;
  }

  function addFn(lang: LangField): void {
    const id = `${lang}-${verse.number}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const anchorWord = Math.max(1, countWords(verse[lang]));
    const newFn: WordFootnote = { id, text: '', anchorWord };
    updateFootnotes($currentChapter, verse.number, lang, (arr) => [...arr, newFn]);
    editingFnLang = lang;
    editingFnIdx = getFootnotes(lang).length;
    fnEditValue = '';
  }

  function deleteFn(lang: LangField, idx: number): void {
    updateFootnotes($currentChapter, verse.number, lang, (arr) =>
      arr.filter((_, i) => i !== idx),
    );
    if (editingFnLang === lang && editingFnIdx === idx) {
      editingFnLang = null;
      editingFnIdx = -1;
    }
    if (pickingAnchor?.lang === lang && pickingAnchor.idx === idx) {
      pickingAnchor = null;
    }
  }

  function updateAnchor(lang: LangField, idx: number, anchorWord: number): void {
    updateFootnotes($currentChapter, verse.number, lang, (arr) => {
      if (!arr[idx]) return arr;
      const copy = [...arr];
      copy[idx] = { ...copy[idx], anchorWord: Math.max(1, Math.floor(anchorWord)) };
      return copy;
    });
  }

  function beginAnchorPick(lang: LangField, idx: number): void {
    if (!$editMode) return;
    const active =
      pickingAnchor?.lang === lang && pickingAnchor.idx === idx;
    pickingAnchor = active ? null : { lang, idx };
  }

  function onWordClick(
    e: MouseEvent,
    lang: LangField,
    wordIndex: number,
  ): void {
    if (!$editMode || !pickingAnchor) return;
    if (pickingAnchor.lang !== lang) return;
    e.preventDefault();
    e.stopPropagation();
    updateAnchor(lang, pickingAnchor.idx, wordIndex);
    pickingAnchor = null;
  }

  function handleFnKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      editingFnLang = null;
      editingFnIdx = -1;
      pickingAnchor = null;
    }
  }

  function countWords(text: string): number {
    const m = text.match(/\S+/g);
    return m ? m.length : 1;
  }

  function isEditableEmpty(text: string): boolean {
    return $editMode && text.trim().length === 0;
  }

  function getFootnotes(lang: LangField): WordFootnote[] {
    const raw = verse.footnotes as VerseFootnotes | Record<string, unknown> | undefined;
    if (!raw || typeof raw !== 'object') return [];
    const arr = (raw as Record<string, unknown>)[lang];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item, i) => toWordFootnote(item, i))
      .filter((v): v is WordFootnote => v !== null);
  }

  function toWordFootnote(item: unknown, index: number): WordFootnote | null {
    if (typeof item === 'string') {
      return {
        id: `legacy-${index + 1}`,
        text: item,
        anchorWord: index + 1,
      };
    }
    if (!item || typeof item !== 'object') return null;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id : `fn-${index + 1}`;
    const text = typeof rec.text === 'string' ? rec.text : '';
    const anchorRaw = typeof rec.anchorWord === 'number' ? rec.anchorWord : index + 1;
    return {
      id,
      text,
      anchorWord: Math.max(1, Math.floor(anchorRaw)),
    };
  }

  function footnoteNumber(lang: LangField, id: string): number {
    const idx = getFootnotes(lang).findIndex((f) => f.id === id);
    return idx >= 0 ? idx + 1 : 1;
  }

  function segments(text: string, lang: LangField): TextSegment[] {
    const notes = getFootnotes(lang);
    const byWord = new Map<number, WordFootnote[]>();
    for (const fn of notes) {
      const current = byWord.get(fn.anchorWord) ?? [];
      current.push(fn);
      byWord.set(fn.anchorWord, current);
    }

    const out: TextSegment[] = [];
    const tokens = text.split(/(\s+)/);
    let wordIndex = 0;
    for (const token of tokens) {
      if (token.length === 0) continue;
      if (/^\s+$/.test(token)) {
        out.push({ text: token, isWord: false, wordIndex: 0, footnotes: [] });
        continue;
      }
      wordIndex += 1;
      out.push({
        text: token,
        isWord: true,
        wordIndex,
        footnotes: byWord.get(wordIndex) ?? [],
      });
    }
    if (out.length === 0) {
      out.push({ text: '\u00A0', isWord: false, wordIndex: 0, footnotes: [] });
    }
    return out;
  }

  // Strong punctuation indicates multi-couplet boundaries
  const ENGLISH_STRONG_RE = /[.;:!?]|\u2014/u;
  const ARMENIAN_STRONG_RE = /[.;:!?։]/u;
  // All punctuation (including commas) — used for midpoint breaks
  const ENGLISH_ANY_PUNCT_RE = /[.;:,!?]|\u2014/u;
  const ARMENIAN_ANY_PUNCT_RE = /[.,:;!?։՝]/u;

  function strongPunctRe(lang: LangField): RegExp {
    return lang === 'english' ? ENGLISH_STRONG_RE : ARMENIAN_STRONG_RE;
  }
  function anyPunctRe(lang: LangField): RegExp {
    return lang === 'english' ? ENGLISH_ANY_PUNCT_RE : ARMENIAN_ANY_PUNCT_RE;
  }

  function trimLineSegments(line: TextSegment[]): TextSegment[] {
    let start = 0;
    let end = line.length;
    while (start < end && !line[start]?.isWord && /^\s+$/.test(line[start]?.text ?? '')) start += 1;
    while (end > start && !line[end - 1]?.isWord && /^\s+$/.test(line[end - 1]?.text ?? '')) end -= 1;
    return line.slice(start, end);
  }

  /** Find the index (within `parts`) of the last real word segment. */
  function lastWordIdx(parts: TextSegment[]): number {
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (parts[i]?.isWord) return i;
    }
    return -1;
  }

  /**
   * Find the word-segment index in `parts[start..end)` whose cumulative
   * character position is closest to the character midpoint of that range.
   * Only considers segments matching `re`.  Ignores the very last word
   * (end-of-verse punctuation shouldn't trigger a break).
   */
  function nearestPunctToMid(
    parts: TextSegment[],
    start: number,
    end: number,
    re: RegExp,
  ): number {
    const lastWord = lastWordIdx(parts.slice(start, end));
    let totalChars = 0;
    for (let i = start; i < end; i += 1) totalChars += (parts[i]?.text ?? '').length;
    const mid = totalChars / 2;

    let cum = 0;
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = start; i < end; i += 1) {
      cum += (parts[i]?.text ?? '').length;
      const seg = parts[i];
      if (!seg?.isWord) continue;
      if (i - start === lastWord) continue; // skip last word
      if (!re.test(seg.text)) continue;
      const dist = Math.abs(cum - mid);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function poetryLines(text: string, lang: LangField): TextSegment[][] {
    // Manual override: if the text has explicit newlines, use those
    if (text.includes('\n')) {
      const manualLines = text.split('\n').filter((l) => l.trim().length > 0);
      const result: TextSegment[][] = [];
      for (const line of manualLines) {
        const segs = segments(line.trim(), lang);
        const trimmed = trimLineSegments(segs);
        if (trimmed.length > 0) result.push(trimmed);
      }
      if (result.length > 0) return result;
    }

    const parts = segments(text, lang);
    const strong = strongPunctRe(lang);
    const any = anyPunctRe(lang);
    const lastWord = lastWordIdx(parts);

    // 1. Collect strong-punctuation break indices (skip last word)
    const strongBreaks: number[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const seg = parts[i];
      if (!seg?.isWord || i === lastWord) continue;
      if (strong.test(seg.text)) strongBreaks.push(i);
    }

    // 2. Build ranges separated by strong breaks
    type Range = { start: number; end: number };
    const ranges: Range[] = [];
    let rangeStart = 0;
    for (const bi of strongBreaks) {
      ranges.push({ start: rangeStart, end: bi + 1 });
      rangeStart = bi + 1;
    }
    if (rangeStart < parts.length) {
      ranges.push({ start: rangeStart, end: parts.length });
    }

    // 3. For each range, find the weak punct nearest the midpoint
    const allBreaks = new Set(strongBreaks);
    for (const r of ranges) {
      const midIdx = nearestPunctToMid(parts, r.start, r.end, any);
      if (midIdx >= 0 && !allBreaks.has(midIdx)) {
        allBreaks.add(midIdx);
      }
    }

    // 4. Build lines from sorted break indices
    const sorted = [...allBreaks].sort((a, b) => a - b);
    const lines: TextSegment[][] = [];
    let lineStart = 0;
    for (const bi of sorted) {
      const line = trimLineSegments(parts.slice(lineStart, bi + 1));
      if (line.length > 0) lines.push(line);
      lineStart = bi + 1;
    }
    const tail = trimLineSegments(parts.slice(lineStart));
    if (tail.length > 0) lines.push(tail);

    if (lines.length === 0) {
      return [[{ text: '\u00A0', isWord: false, wordIndex: 0, footnotes: [] }]];
    }
    return lines;
  }

  /** Global line index drives alternation: even = left, odd = indented. */
  function poetryBaseIndentEm(lineIndex: number): number {
    const explicit = Math.max(0, Math.floor(verse.indentLevel ?? 0));
    const alternating = lineIndex % 2 === 1 ? 1 : 0;
    return 2 + (explicit + alternating) * 2;
  }

  function poetryContinuationIndentEm(lineIndex: number): number {
    const base = poetryBaseIndentEm(lineIndex);
    // Even-indexed lines (left-aligned) need extra indent for wrapped continuations
    return lineIndex % 2 === 0 ? base + 2 : base;
  }

  function poetryHangingOffsetEm(lineIndex: number): number {
    return lineIndex % 2 === 0 ? 4 : 2;
  }

  function poetryLineStyle(lineIndex: number): string {
    return [
      `--poetry-continuation-indent:${poetryContinuationIndentEm(lineIndex)}em`,
      `--poetry-hanging-offset:${poetryHangingOffsetEm(lineIndex)}em`,
    ].join(';');
  }

  function firstLineIndentEm(): number | null {
    const raw = verse.firstLineIndent;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    const clamped = Math.max(-6, Math.min(6, raw));
    if (Math.abs(clamped) < 0.01) return null;
    return clamped;
  }

  function firstLineIndentStyle(): string | undefined {
    if (verse.poetry === true) return undefined;
    const indent = firstLineIndentEm();
    if (indent === null) return undefined;
    if (indent < 0) {
      // Hanging indent: pad-left by |indent| so continuation lines are
      // indented, then text-indent pulls the first line back to the left.
      const abs = Math.abs(indent);
      return `padding-left:${abs}em;text-indent:${indent}em;`;
    }
    return `text-indent:${indent}em;`;
  }

  const INDENT_STEP_EM = 0.5;

  function indentControlValueEm(): number {
    const raw = verse.firstLineIndent;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
    return Math.max(-6, Math.min(6, raw));
  }

  function normalizeIndent(value: number): number | null {
    const rounded = Math.round(value * 4) / 4;
    const clamped = Math.max(-6, Math.min(6, rounded));
    if (Math.abs(clamped) < 0.01) return null;
    return clamped;
  }

  function formattedIndentValue(): string {
    const value = indentControlValueEm();
    if (Math.abs(value) < 0.01) return '0';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}`;
  }

  function changeFirstLineIndent(delta: number): void {
    if (!$editMode || verse.poetry === true || !onUpdateFirstLineIndent) return;
    const next = normalizeIndent(indentControlValueEm() + delta);
    onUpdateFirstLineIndent(verse.number, next);
  }

  function resetFirstLineIndent(): void {
    if (!$editMode || verse.poetry === true || !onUpdateFirstLineIndent) return;
    onUpdateFirstLineIndent(verse.number, null);
  }

  function wordTooltip(lang: LangField, notes: WordFootnote[]): string {
    return notes
      .map((fn) => `[${footnoteNumber(lang, fn.id)}] ${fn.text}`)
      .join('\n');
  }

  function showList(lang: LangField): boolean {
    void lang;
    if ($editMode) return true;
    if ($footnoteDisplayMode === 'superscript') return true;
    return false;
  }

  const FOOTNOTE_ID_PREFIX = 'fn-item-';

  function footnoteGroup(lang: LangField): string {
    return `footnotes-${lang}-${verse.number}-${$currentChapter}`;
  }

  function parseFootnoteIndex(idValue: string | number): number | null {
    const id = String(idValue);
    if (!id.startsWith(FOOTNOTE_ID_PREFIX)) return null;
    const idx = Number.parseInt(id.slice(FOOTNOTE_ID_PREFIX.length), 10);
    return Number.isFinite(idx) ? idx : null;
  }

  type DragNode = {
    id?: string | number;
    index?: number;
    data?: { current?: { index?: number } };
  };

  function resolveFootnoteIndex(node: DragNode | null): number | null {
    if (!node) return null;
    if (typeof node.index === 'number' && Number.isFinite(node.index)) {
      return node.index;
    }
    const dataIndex = node.data?.current?.index;
    if (typeof dataIndex === 'number' && Number.isFinite(dataIndex)) {
      return dataIndex;
    }
    if (node.id !== undefined) return parseFootnoteIndex(node.id);
    return null;
  }

  function onFootnoteDragEnd(
    lang: LangField,
    event: {
      operation: {
        source: { id: string | number } | null;
        target: { id: string | number } | null;
      };
    },
  ): void {
    const fromIndex = resolveFootnoteIndex(event.operation.source as DragNode | null);
    const toIndex = resolveFootnoteIndex(event.operation.target as DragNode | null);
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    reorderFootnotes($currentChapter, verse.number, lang, fromIndex, toIndex);
  }

  function initTextarea(node: HTMLTextAreaElement): { destroy: () => void } {
    node.focus();
    const len = node.value.length;
    node.setSelectionRange(len, len);

    function resize(): void {
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight}px`;
    }

    node.addEventListener('input', resize);
    requestAnimationFrame(resize);
    return {
      destroy() {
        node.removeEventListener('input', resize);
      },
    };
  }
</script>

<div class="verse-row {gridClass}" data-content-index={contentIndex}>
  {#if ($editMode && onTogglePoetry) || canDelete}
    <div class="verse-row-tools">
      {#if $editMode && onTogglePoetry}
        <button
          class="poetry-toggle-btn verse-poetry-toggle-btn"
          class:active={verse.poetry === true}
          onclick={onTogglePoetry}
          title={verse.poetry ? $locale.poetryOff : $locale.poetryOn}
        >
          {$locale.poetryMode}
        </button>
      {/if}
      {#if $editMode && onUpdateFirstLineIndent}
        <div
          class="indent-controls"
          class:disabled={verse.poetry === true}
          title={verse.poetry ? $locale.indentUnavailableInPoetry : undefined}
        >
          <span class="indent-label">{$locale.firstLineIndent}</span>
          <button
            class="indent-btn"
            type="button"
            onclick={() => changeFirstLineIndent(-INDENT_STEP_EM)}
            title={$locale.decreaseIndent}
            disabled={verse.poetry === true}
          >
            -
          </button>
          <button
            class="indent-reset-btn"
            type="button"
            onclick={resetFirstLineIndent}
            title={$locale.resetIndent}
            disabled={verse.poetry === true}
          >
            {formattedIndentValue()}
          </button>
          <button
            class="indent-btn"
            type="button"
            onclick={() => changeFirstLineIndent(INDENT_STEP_EM)}
            title={$locale.increaseIndent}
            disabled={verse.poetry === true}
          >
            +
          </button>
        </div>
      {/if}
      {#if canDelete}
        <button
          class="x-delete-btn"
          type="button"
          onclick={onDelete}
          title={deleteTitle}
          aria-label={deleteTitle}
        >
          x
        </button>
      {/if}
    </div>
  {/if}
  {#if showClassical}
    <div class="verse-col">
      <div class="verse-cell armenian-cell" lang="hy">
        <span class="verse-number">{verse.number}</span>
        {#if editingField === 'classical'}
          <textarea
            class="verse-textarea"
            bind:value={editValue}
            oninput={markEditDirty}
            onblur={commitEdit}
            onkeydown={handleKeydown}
            use:initTextarea
          ></textarea>
        {:else}
          <span
            class="verse-text"
            class:poetry-text={verse.poetry === true}
            class:first-line-indent={verse.poetry !== true && firstLineIndentEm() !== null}
            class:editable-empty={isEditableEmpty(verse.classical)}
            style={firstLineIndentStyle()}
            role="textbox"
            tabindex="0"
            onclick={() => startEdit('classical')}
            onkeydown={(e) => e.key === 'Enter' && startEdit('classical')}
          >
            {#if isEditableEmpty(verse.classical)}
              <span class="verse-empty-placeholder">{$locale.clickToEdit}</span>
            {:else if verse.poetry}
              {#each poetryLines(verse.classical || '\u00A0', 'classical') as line, lineIdx}
                <div class="poetry-line" style={poetryLineStyle(lineIdx)}>
                  {#each line as seg}
                    {#if seg.isWord}
                      {#if $editMode && pickingAnchor?.lang === 'classical'}
                        <button
                          class="word-anchor-btn verse-word"
                          type="button"
                          onclick={(e) => onWordClick(e, 'classical', seg.wordIndex)}
                        >
                          {seg.text}
                          {#if $footnoteDisplayMode === 'superscript'}
                            {#each seg.footnotes as fn}
                              <sup class="fn-sup" title={fn.text}>{footnoteNumber('classical', fn.id)}</sup>
                            {/each}
                          {/if}
                        </button>
                      {:else}
                        <span
                          class="verse-word"
                          class:fn-word={seg.footnotes.length > 0 && $footnoteDisplayMode === 'tooltip'}
                          title={seg.footnotes.length > 0 ? wordTooltip('classical', seg.footnotes) : undefined}
                        >{seg.text}{#if $footnoteDisplayMode === 'superscript'}{#each seg.footnotes as fn}<sup class="fn-sup" title={fn.text}>{footnoteNumber('classical', fn.id)}</sup>{/each}{/if}</span>
                      {/if}
                {:else}{' '}{/if}
              {/each}
            </div>
          {/each}
        {:else}
          {#each segments(verse.classical || '\u00A0', 'classical') as seg}
            {#if seg.isWord}
              {#if $editMode && pickingAnchor?.lang === 'classical'}
                <button
                  class="word-anchor-btn verse-word"
                  type="button"
                  onclick={(e) => onWordClick(e, 'classical', seg.wordIndex)}
                >
                  {seg.text}
                  {#if $footnoteDisplayMode === 'superscript'}
                    {#each seg.footnotes as fn}
                      <sup class="fn-sup" title={fn.text}>{footnoteNumber('classical', fn.id)}</sup>
                    {/each}
                  {/if}
                </button>
              {:else}
                <span
                  class="verse-word"
                  class:fn-word={seg.footnotes.length > 0 && $footnoteDisplayMode === 'tooltip'}
                  title={seg.footnotes.length > 0 ? wordTooltip('classical', seg.footnotes) : undefined}
                >{seg.text}{#if $footnoteDisplayMode === 'superscript'}{#each seg.footnotes as fn}<sup class="fn-sup" title={fn.text}>{footnoteNumber('classical', fn.id)}</sup>{/each}{/if}</span>
              {/if}
            {:else}{' '}{/if}
          {/each}
        {/if}
          </span>
        {/if}
        <button
          class="copy-verse-btn"
          class:copied={copiedLang === 'classical'}
          type="button"
          title="Copy verse text"
          onclick={(e) => { e.stopPropagation(); copyVerseText('classical'); }}
        >
          <span class="material-symbols-outlined">content_copy</span>
        </button>
      </div>
      {#if showList('classical')}
        <div class="cell-footnotes">
          <DragDropProvider onDragEnd={(event) => onFootnoteDragEnd('classical', event)}>
            {#each getFootnotes('classical') as fn, i}
              <SortableItem
                id={`${FOOTNOTE_ID_PREFIX}${i}`}
                index={i}
                group={footnoteGroup('classical')}
                disabled={!$editMode}
                showHandle={$editMode}
                handleTitle={$locale.dragToReorder}
                className="footnote-sortable"
              >
                <div class="footnote-row">
                  <span class="fn-marker">[{i + 1}]</span>
                  {#if editingFnLang === 'classical' && editingFnIdx === i}
                    <textarea
                      class="fn-textarea"
                      bind:value={fnEditValue}
                      onblur={commitFnEdit}
                      onkeydown={handleFnKeydown}
                      use:initTextarea
                    ></textarea>
                  {:else}
                    <span
                      class="fn-text"
                      role="textbox"
                      tabindex="0"
                      onclick={() => startFnEdit('classical', i)}
                      onkeydown={(e) => e.key === 'Enter' && startFnEdit('classical', i)}
                    >{fn.text || '\u00A0'}</span>
                  {/if}
                  {#if $editMode}
                    <button
                      class="fn-anchor-btn"
                      onclick={() => beginAnchorPick('classical', i)}
                    >
                      {pickingAnchor?.lang === 'classical' && pickingAnchor.idx === i
                        ? $locale.cancelPick
                        : `${$locale.anchorWord} ${fn.anchorWord}`}
                    </button>
                    <button
                      class="fn-delete"
                      onclick={() => deleteFn('classical', i)}
                      title={$locale.deleteFootnote}
                    >&times;</button>
                  {/if}
                </div>
                {#if $editMode && pickingAnchor?.lang === 'classical' && pickingAnchor.idx === i}
                  <div class="anchor-pick-hint">{$locale.clickWordToAttach}</div>
                {/if}
              </SortableItem>
            {/each}
          </DragDropProvider>
        </div>
      {/if}
      {#if $editMode}
        <button class="fn-add-btn" onclick={() => addFn('classical')}>{$locale.addFootnote}</button>
      {/if}
    </div>
  {/if}

  {#if showArmenian}
    <div class="verse-col">
      <div class="verse-cell armenian-cell" lang="hy">
        <span class="verse-number">{verse.number}</span>
        {#if editingField === 'armenian'}
          <textarea
            class="verse-textarea"
            bind:value={editValue}
            oninput={markEditDirty}
            onblur={commitEdit}
            onkeydown={handleKeydown}
            use:initTextarea
          ></textarea>
        {:else}
          <span
            class="verse-text"
            class:poetry-text={verse.poetry === true}
            class:first-line-indent={verse.poetry !== true && firstLineIndentEm() !== null}
            class:editable-empty={isEditableEmpty(verse.armenian)}
            style={firstLineIndentStyle()}
            role="textbox"
            tabindex="0"
            onclick={() => startEdit('armenian')}
            onkeydown={(e) => e.key === 'Enter' && startEdit('armenian')}
          >
            {#if isEditableEmpty(verse.armenian)}
              <span class="verse-empty-placeholder">{$locale.clickToEdit}</span>
            {:else if verse.poetry}
              {#each poetryLines(verse.armenian || '\u00A0', 'armenian') as line, lineIdx}
                <div class="poetry-line" style={poetryLineStyle(lineIdx)}>
                  {#each line as seg}
                    {#if seg.isWord}
                      {#if $editMode && pickingAnchor?.lang === 'armenian'}
                        <button
                          class="word-anchor-btn verse-word"
                          type="button"
                          onclick={(e) => onWordClick(e, 'armenian', seg.wordIndex)}
                        >
                          {seg.text}
                          {#if $footnoteDisplayMode === 'superscript'}
                            {#each seg.footnotes as fn}
                              <sup class="fn-sup" title={fn.text}>{footnoteNumber('armenian', fn.id)}</sup>
                            {/each}
                          {/if}
                        </button>
                      {:else}
                        <span
                          class="verse-word"
                          class:fn-word={seg.footnotes.length > 0 && $footnoteDisplayMode === 'tooltip'}
                          title={seg.footnotes.length > 0 ? wordTooltip('armenian', seg.footnotes) : undefined}
                        >{seg.text}{#if $footnoteDisplayMode === 'superscript'}{#each seg.footnotes as fn}<sup class="fn-sup" title={fn.text}>{footnoteNumber('armenian', fn.id)}</sup>{/each}{/if}</span>
                      {/if}
                    {:else}{' '}{/if}
                  {/each}
                </div>
              {/each}
            {:else}
              {#each segments(verse.armenian || '\u00A0', 'armenian') as seg}
                {#if seg.isWord}
                  {#if $editMode && pickingAnchor?.lang === 'armenian'}
                    <button
                      class="word-anchor-btn verse-word"
                      type="button"
                      onclick={(e) => onWordClick(e, 'armenian', seg.wordIndex)}
                    >
                      {seg.text}
                      {#if $footnoteDisplayMode === 'superscript'}
                        {#each seg.footnotes as fn}
                          <sup class="fn-sup" title={fn.text}>{footnoteNumber('armenian', fn.id)}</sup>
                        {/each}
                      {/if}
                    </button>
                  {:else}
                    <span
                      class="verse-word"
                      class:fn-word={seg.footnotes.length > 0 && $footnoteDisplayMode === 'tooltip'}
                      title={seg.footnotes.length > 0 ? wordTooltip('armenian', seg.footnotes) : undefined}
                    >{seg.text}{#if $footnoteDisplayMode === 'superscript'}{#each seg.footnotes as fn}<sup class="fn-sup" title={fn.text}>{footnoteNumber('armenian', fn.id)}</sup>{/each}{/if}</span>
                  {/if}
                {:else}{' '}{/if}
              {/each}
            {/if}
          </span>
        {/if}
        <button
          class="copy-verse-btn"
          class:copied={copiedLang === 'armenian'}
          type="button"
          title="Copy verse text"
          onclick={(e) => { e.stopPropagation(); copyVerseText('armenian'); }}
        >
          <span class="material-symbols-outlined">content_copy</span>
        </button>
      </div>
      {#if showList('armenian')}
        <div class="cell-footnotes">
          <DragDropProvider onDragEnd={(event) => onFootnoteDragEnd('armenian', event)}>
            {#each getFootnotes('armenian') as fn, i}
              <SortableItem
                id={`${FOOTNOTE_ID_PREFIX}${i}`}
                index={i}
                group={footnoteGroup('armenian')}
                disabled={!$editMode}
                showHandle={$editMode}
                handleTitle={$locale.dragToReorder}
                className="footnote-sortable"
              >
                <div class="footnote-row">
                  <span class="fn-marker">[{i + 1}]</span>
                  {#if editingFnLang === 'armenian' && editingFnIdx === i}
                    <textarea
                      class="fn-textarea"
                      bind:value={fnEditValue}
                      onblur={commitFnEdit}
                      onkeydown={handleFnKeydown}
                      use:initTextarea
                    ></textarea>
                  {:else}
                    <span
                      class="fn-text"
                      role="textbox"
                      tabindex="0"
                      onclick={() => startFnEdit('armenian', i)}
                      onkeydown={(e) => e.key === 'Enter' && startFnEdit('armenian', i)}
                    >{fn.text || '\u00A0'}</span>
                  {/if}
                  {#if $editMode}
                    <button
                      class="fn-anchor-btn"
                      onclick={() => beginAnchorPick('armenian', i)}
                    >
                      {pickingAnchor?.lang === 'armenian' && pickingAnchor.idx === i
                        ? $locale.cancelPick
                        : `${$locale.anchorWord} ${fn.anchorWord}`}
                    </button>
                    <button
                      class="fn-delete"
                      onclick={() => deleteFn('armenian', i)}
                      title={$locale.deleteFootnote}
                    >&times;</button>
                  {/if}
                </div>
                {#if $editMode && pickingAnchor?.lang === 'armenian' && pickingAnchor.idx === i}
                  <div class="anchor-pick-hint">{$locale.clickWordToAttach}</div>
                {/if}
              </SortableItem>
            {/each}
          </DragDropProvider>
        </div>
      {/if}
      {#if $editMode}
        <button class="fn-add-btn" onclick={() => addFn('armenian')}>{$locale.addFootnote}</button>
      {/if}
    </div>
  {/if}

  {#if showEnglish}
    <div class="verse-col">
      <div class="verse-cell" lang="en">
        <span class="verse-number">{verse.number}</span>
        {#if editingField === 'english'}
          <textarea
            class="verse-textarea"
            bind:value={editValue}
            oninput={markEditDirty}
            onblur={commitEdit}
            onkeydown={handleKeydown}
            use:initTextarea
          ></textarea>
        {:else}
          <span
            class="verse-text"
            class:poetry-text={verse.poetry === true}
            class:first-line-indent={verse.poetry !== true && firstLineIndentEm() !== null}
            class:editable-empty={isEditableEmpty(verse.english)}
            style={firstLineIndentStyle()}
            role="textbox"
            tabindex="0"
            onclick={() => startEdit('english')}
            onkeydown={(e) => e.key === 'Enter' && startEdit('english')}
          >
            {#if isEditableEmpty(verse.english)}
              <span class="verse-empty-placeholder">{$locale.clickToEdit}</span>
            {:else if verse.poetry}
              {#each poetryLines(verse.english || '\u00A0', 'english') as line, lineIdx}
                <div class="poetry-line" style={poetryLineStyle(lineIdx)}>
                  {#each line as seg}
                    {#if seg.isWord}
                      {#if $editMode && pickingAnchor?.lang === 'english'}
                        <button
                          class="word-anchor-btn verse-word"
                          type="button"
                          onclick={(e) => onWordClick(e, 'english', seg.wordIndex)}
                        >
                          {seg.text}
                          {#if $footnoteDisplayMode === 'superscript'}
                            {#each seg.footnotes as fn}
                              <sup class="fn-sup" title={fn.text}>{footnoteNumber('english', fn.id)}</sup>
                            {/each}
                          {/if}
                        </button>
                      {:else}
                        <span
                          class="verse-word"
                          class:fn-word={seg.footnotes.length > 0 && $footnoteDisplayMode === 'tooltip'}
                          title={seg.footnotes.length > 0 ? wordTooltip('english', seg.footnotes) : undefined}
                        >{seg.text}{#if $footnoteDisplayMode === 'superscript'}{#each seg.footnotes as fn}<sup class="fn-sup" title={fn.text}>{footnoteNumber('english', fn.id)}</sup>{/each}{/if}</span>
                      {/if}
                    {:else}{' '}{/if}
                  {/each}
                </div>
              {/each}
            {:else}
              {#each segments(verse.english || '\u00A0', 'english') as seg}
                {#if seg.isWord}
                  {#if $editMode && pickingAnchor?.lang === 'english'}
                    <button
                      class="word-anchor-btn verse-word"
                      type="button"
                      onclick={(e) => onWordClick(e, 'english', seg.wordIndex)}
                    >
                      {seg.text}
                      {#if $footnoteDisplayMode === 'superscript'}
                        {#each seg.footnotes as fn}
                          <sup class="fn-sup" title={fn.text}>{footnoteNumber('english', fn.id)}</sup>
                        {/each}
                      {/if}
                    </button>
                  {:else}
                    <span
                      class="verse-word"
                      class:fn-word={seg.footnotes.length > 0 && $footnoteDisplayMode === 'tooltip'}
                      title={seg.footnotes.length > 0 ? wordTooltip('english', seg.footnotes) : undefined}
                    >{seg.text}{#if $footnoteDisplayMode === 'superscript'}{#each seg.footnotes as fn}<sup class="fn-sup" title={fn.text}>{footnoteNumber('english', fn.id)}</sup>{/each}{/if}</span>
                  {/if}
                {:else}{' '}{/if}
              {/each}
            {/if}
          </span>
        {/if}
        <button
          class="copy-verse-btn"
          class:copied={copiedLang === 'english'}
          type="button"
          title="Copy verse text"
          onclick={(e) => { e.stopPropagation(); copyVerseText('english'); }}
        >
          <span class="material-symbols-outlined">content_copy</span>
        </button>
      </div>
      {#if showList('english')}
        <div class="cell-footnotes">
          <DragDropProvider onDragEnd={(event) => onFootnoteDragEnd('english', event)}>
            {#each getFootnotes('english') as fn, i}
              <SortableItem
                id={`${FOOTNOTE_ID_PREFIX}${i}`}
                index={i}
                group={footnoteGroup('english')}
                disabled={!$editMode}
                showHandle={$editMode}
                handleTitle={$locale.dragToReorder}
                className="footnote-sortable"
              >
                <div class="footnote-row">
                  <span class="fn-marker">[{i + 1}]</span>
                  {#if editingFnLang === 'english' && editingFnIdx === i}
                    <textarea
                      class="fn-textarea"
                      bind:value={fnEditValue}
                      onblur={commitFnEdit}
                      onkeydown={handleFnKeydown}
                      use:initTextarea
                    ></textarea>
                  {:else}
                    <span
                      class="fn-text"
                      role="textbox"
                      tabindex="0"
                      onclick={() => startFnEdit('english', i)}
                      onkeydown={(e) => e.key === 'Enter' && startFnEdit('english', i)}
                    >{fn.text || '\u00A0'}</span>
                  {/if}
                  {#if $editMode}
                    <button
                      class="fn-anchor-btn"
                      onclick={() => beginAnchorPick('english', i)}
                    >
                      {pickingAnchor?.lang === 'english' && pickingAnchor.idx === i
                        ? $locale.cancelPick
                        : `${$locale.anchorWord} ${fn.anchorWord}`}
                    </button>
                    <button
                      class="fn-delete"
                      onclick={() => deleteFn('english', i)}
                      title={$locale.deleteFootnote}
                    >&times;</button>
                  {/if}
                </div>
                {#if $editMode && pickingAnchor?.lang === 'english' && pickingAnchor.idx === i}
                  <div class="anchor-pick-hint">{$locale.clickWordToAttach}</div>
                {/if}
              </SortableItem>
            {/each}
          </DragDropProvider>
        </div>
      {/if}
      {#if $editMode}
        <button class="fn-add-btn" onclick={() => addFn('english')}>{$locale.addFootnote}</button>
      {/if}
    </div>
  {/if}
</div>

<script lang="ts">
  import type { VerseItem, VerseFootnotes, WordFootnote } from '../lib/types';
  import {
    editMode,
    currentChapter,
    updateFootnotes,
    reorderFootnotes,
    footnoteDisplayMode,
    locale,
  } from '../lib/stores';
  import { DragDropProvider } from '@dnd-kit-svelte/svelte';
  import SortableItem from './SortableItem.svelte';

  interface Props {
    verse: VerseItem;
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
    gridClass,
    showClassical,
    showArmenian,
    showEnglish,
    canDelete,
    deleteTitle,
    onDelete,
    onUpdate,
    onTogglePoetry,
  }: Props = $props();

  type LangField = 'armenian' | 'english' | 'classical';

  let editingField = $state<LangField | null>(null);
  let editValue = $state('');
  let editingFnLang = $state<LangField | null>(null);
  let editingFnIdx = $state<number>(-1);
  let fnEditValue = $state('');
  let pickingAnchor = $state<{ lang: LangField; idx: number } | null>(null);

  function startEdit(field: LangField): void {
    if (!$editMode) return;
    editingField = field;
    editValue = verse[field];
  }

  function commitEdit(): void {
    if (editingField) {
      onUpdate(verse.number, editingField, editValue.trim());
      editingField = null;
    }
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

  const ENGLISH_CLAUSE_BREAK_RE = /[.;:,!?]|\u2014/u;
  const ARMENIAN_CLAUSE_BREAK_RE = /[.,:;!?։՝՞՜]/u;

  function clauseBreakRegex(lang: LangField): RegExp {
    return lang === 'english' ? ENGLISH_CLAUSE_BREAK_RE : ARMENIAN_CLAUSE_BREAK_RE;
  }

  function trimLineSegments(line: TextSegment[]): TextSegment[] {
    let start = 0;
    let end = line.length;
    while (start < end && !line[start]?.isWord && /^\s+$/.test(line[start]?.text ?? '')) start += 1;
    while (end > start && !line[end - 1]?.isWord && /^\s+$/.test(line[end - 1]?.text ?? '')) end -= 1;
    return line.slice(start, end);
  }

  function poetryLines(text: string, lang: LangField): TextSegment[][] {
    const parts = segments(text, lang);
    const breakRe = clauseBreakRegex(lang);
    const lines: TextSegment[][] = [];
    let current: TextSegment[] = [];

    for (const seg of parts) {
      current.push(seg);
      if (seg.isWord && breakRe.test(seg.text)) {
        const trimmed = trimLineSegments(current);
        if (trimmed.length > 0) lines.push(trimmed);
        current = [];
      }
    }

    const tail = trimLineSegments(current);
    if (tail.length > 0) lines.push(tail);
    if (lines.length === 0) return [[{ text: '\u00A0', isWord: false, wordIndex: 0, footnotes: [] }]];
    return lines;
  }

  function poetryBaseIndentEm(lineIndex: number): number {
    const explicit = Math.max(0, Math.floor(verse.indentLevel ?? 0));
    const alternating = lineIndex % 2 === 1 ? 1 : 0;
    return 2 + (explicit + alternating) * 2;
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

<div class="verse-row {gridClass}">
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
  {#if showClassical}
    <div class="verse-col">
      <div class="verse-cell armenian-cell" lang="hy">
        <span class="verse-number">{verse.number}</span>
        {#if editingField === 'classical'}
          <textarea
            class="verse-textarea"
            bind:value={editValue}
            onblur={commitEdit}
            onkeydown={handleKeydown}
            use:initTextarea
          ></textarea>
        {:else}
          <span
            class="verse-text"
            class:poetry-text={verse.poetry === true}
            role="textbox"
            tabindex="0"
            onclick={() => startEdit('classical')}
            onkeydown={(e) => e.key === 'Enter' && startEdit('classical')}
          >
            {#if verse.poetry}
              {#each poetryLines(verse.classical || '\u00A0', 'classical') as line, lineIdx}
                <div class="poetry-line" style={`--poetry-base-indent:${poetryBaseIndentEm(lineIdx)}em;`}>
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
                          title={seg.footnotes.length > 0 ? wordTooltip('classical', seg.footnotes) : ''}
                        >
                          {seg.text}
                          {#if $footnoteDisplayMode === 'superscript'}
                            {#each seg.footnotes as fn}
                              <sup class="fn-sup" title={fn.text}>{footnoteNumber('classical', fn.id)}</sup>
                            {/each}
                          {/if}
                        </span>
                      {/if}
                    {:else}
                      <span>{seg.text}</span>
                    {/if}
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
                      title={seg.footnotes.length > 0 ? wordTooltip('classical', seg.footnotes) : ''}
                    >
                      {seg.text}
                      {#if $footnoteDisplayMode === 'superscript'}
                        {#each seg.footnotes as fn}
                          <sup class="fn-sup" title={fn.text}>{footnoteNumber('classical', fn.id)}</sup>
                        {/each}
                      {/if}
                    </span>
                  {/if}
                {:else}
                  <span>{seg.text}</span>
                {/if}
              {/each}
            {/if}
          </span>
        {/if}
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
            onblur={commitEdit}
            onkeydown={handleKeydown}
            use:initTextarea
          ></textarea>
        {:else}
          <span
            class="verse-text"
            class:poetry-text={verse.poetry === true}
            role="textbox"
            tabindex="0"
            onclick={() => startEdit('armenian')}
            onkeydown={(e) => e.key === 'Enter' && startEdit('armenian')}
          >
            {#if verse.poetry}
              {#each poetryLines(verse.armenian || '\u00A0', 'armenian') as line, lineIdx}
                <div class="poetry-line" style={`--poetry-base-indent:${poetryBaseIndentEm(lineIdx)}em;`}>
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
                          title={seg.footnotes.length > 0 ? wordTooltip('armenian', seg.footnotes) : ''}
                        >
                          {seg.text}
                          {#if $footnoteDisplayMode === 'superscript'}
                            {#each seg.footnotes as fn}
                              <sup class="fn-sup" title={fn.text}>{footnoteNumber('armenian', fn.id)}</sup>
                            {/each}
                          {/if}
                        </span>
                      {/if}
                    {:else}
                      <span>{seg.text}</span>
                    {/if}
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
                      title={seg.footnotes.length > 0 ? wordTooltip('armenian', seg.footnotes) : ''}
                    >
                      {seg.text}
                      {#if $footnoteDisplayMode === 'superscript'}
                        {#each seg.footnotes as fn}
                          <sup class="fn-sup" title={fn.text}>{footnoteNumber('armenian', fn.id)}</sup>
                        {/each}
                      {/if}
                    </span>
                  {/if}
                {:else}
                  <span>{seg.text}</span>
                {/if}
              {/each}
            {/if}
          </span>
        {/if}
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
            onblur={commitEdit}
            onkeydown={handleKeydown}
            use:initTextarea
          ></textarea>
        {:else}
          <span
            class="verse-text"
            class:poetry-text={verse.poetry === true}
            role="textbox"
            tabindex="0"
            onclick={() => startEdit('english')}
            onkeydown={(e) => e.key === 'Enter' && startEdit('english')}
          >
            {#if verse.poetry}
              {#each poetryLines(verse.english || '\u00A0', 'english') as line, lineIdx}
                <div class="poetry-line" style={`--poetry-base-indent:${poetryBaseIndentEm(lineIdx)}em;`}>
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
                          title={seg.footnotes.length > 0 ? wordTooltip('english', seg.footnotes) : ''}
                        >
                          {seg.text}
                          {#if $footnoteDisplayMode === 'superscript'}
                            {#each seg.footnotes as fn}
                              <sup class="fn-sup" title={fn.text}>{footnoteNumber('english', fn.id)}</sup>
                            {/each}
                          {/if}
                        </span>
                      {/if}
                    {:else}
                      <span>{seg.text}</span>
                    {/if}
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
                      title={seg.footnotes.length > 0 ? wordTooltip('english', seg.footnotes) : ''}
                    >
                      {seg.text}
                      {#if $footnoteDisplayMode === 'superscript'}
                        {#each seg.footnotes as fn}
                          <sup class="fn-sup" title={fn.text}>{footnoteNumber('english', fn.id)}</sup>
                        {/each}
                      {/if}
                    </span>
                  {/if}
                {:else}
                  <span>{seg.text}</span>
                {/if}
              {/each}
            {/if}
          </span>
        {/if}
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

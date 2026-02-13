<script lang="ts">
  import {
    bookData,
    currentChapterData,
    currentChapter,
    showArmenian,
    showEnglish,
    showClassical,
    editMode,
    uiLanguage,
    locale,
    updateVerse,
    updateBookName,
    insertVerseAfter,
    insertHeadingAfter,
    deleteItemAt,
    reorderContent,
    setChapterPoetry,
    setSectionPoetry,
    toggleVersePoetry,
  } from '../lib/stores';
  import { isHeading, isVerse, bookDisplayName } from '../lib/types';
  import { DragDropProvider } from '@dnd-kit-svelte/svelte';
  import VerseRow from './VerseRow.svelte';
  import SectionHeading from './SectionHeading.svelte';
  import SortableItem from './SortableItem.svelte';

  let colCount = $derived(
    ($showClassical ? 1 : 0) + ($showArmenian ? 1 : 0) + ($showEnglish ? 1 : 0),
  );

  let gridClass = $derived(
    colCount === 3 ? 'cols-3' : colCount === 2 ? 'cols-2' : 'cols-1',
  );

  let displayBookName = $derived(
    $bookData ? bookDisplayName($bookData.name, $uiLanguage) : '',
  );
  let subtitleName = $derived(
    $bookData
      ? ($uiLanguage === 'english'
        ? $bookData.name.armenian
        : $bookData.name.english)
      : '',
  );

  function handleVerseUpdate(
    verseNumber: number,
    field: 'armenian' | 'english' | 'classical',
    value: string,
  ): void {
    updateVerse($currentChapter, verseNumber, field, value);
  }

  /* ── Book title & subtitle editing ── */
  type BookNameField = 'armenian' | 'english' | 'classical';
  let editingBookTitle = $state<BookNameField | null>(null);
  let editBookTitleValue = $state('');
  let editingSubtitle = $state(false);
  let editSubtitleValue = $state('');

  /** Which language field does the subtitle display? */
  let subtitleField = $derived<BookNameField>(
    $uiLanguage === 'english' ? 'armenian' : 'english',
  );

  function startBookTitleEdit(): void {
    if (!$editMode || !$bookData) return;
    const field: BookNameField = $uiLanguage;
    editingBookTitle = field;
    editBookTitleValue = $bookData.name[field];
  }

  function commitBookTitleEdit(): void {
    if (editingBookTitle && editBookTitleValue.trim()) {
      updateBookName(editingBookTitle, editBookTitleValue.trim());
    }
    editingBookTitle = null;
  }

  function startSubtitleEdit(): void {
    if (!$editMode || !$bookData) return;
    editingSubtitle = true;
    editSubtitleValue = $bookData.name[subtitleField];
  }

  function commitSubtitleEdit(): void {
    if (editingSubtitle && editSubtitleValue.trim()) {
      updateBookName(subtitleField, editSubtitleValue.trim());
    }
    editingSubtitle = false;
  }

  function handleBookTitleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') commitBookTitleEdit();
    if (e.key === 'Escape') { editingBookTitle = null; }
  }

  function handleSubtitleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') commitSubtitleEdit();
    if (e.key === 'Escape') { editingSubtitle = false; }
  }

  function initBookTitleInput(node: HTMLInputElement): { destroy: () => void } {
    node.focus();
    node.select();
    return { destroy() {} };
  }

  let hasAnyPoetry = $derived(
    $currentChapterData
      ? $currentChapterData.content.some((item) => isVerse(item) && item.poetry)
      : false,
  );

  function handleToggleChapterPoetry(): void {
    setChapterPoetry($currentChapter, !hasAnyPoetry);
  }

  function itemHasText(item: import('../lib/types').ChapterItem): boolean {
    return !!(item.armenian.trim() || item.english.trim() || item.classical.trim());
  }

  function confirmDeleteItem(idx: number): void {
    if (!$currentChapterData) return;
    const item = $currentChapterData.content[idx];
    if (!item) return;
    if (itemHasText(item)) {
      if (!window.confirm($locale.confirmDeleteNonEmpty)) return;
    }
    deleteItemAt($currentChapter, idx);
  }

  const CONTENT_ITEM_ID_PREFIX = 'chapter-item-';

  let contentDragGroup = $derived(`chapter-content-${$currentChapter}`);

  function parseContentIndex(idValue: string | number): number | null {
    const id = String(idValue);
    if (!id.startsWith(CONTENT_ITEM_ID_PREFIX)) return null;
    const index = Number.parseInt(id.slice(CONTENT_ITEM_ID_PREFIX.length), 10);
    return Number.isFinite(index) ? index : null;
  }

  type DragNode = {
    id?: string | number;
    index?: number;
    data?: { current?: { index?: number } };
  };

  function resolveContentIndex(node: DragNode | null): number | null {
    if (!node) return null;
    if (typeof node.index === 'number' && Number.isFinite(node.index)) {
      return node.index;
    }
    const dataIndex = node.data?.current?.index;
    if (typeof dataIndex === 'number' && Number.isFinite(dataIndex)) {
      return dataIndex;
    }
    if (node.id !== undefined) return parseContentIndex(node.id);
    return null;
  }

  function sectionHasPoetry(contentIndex: number): boolean {
    if (!$currentChapterData) return false;
    const startIdx = contentIndex + 1;
    let endIdx = $currentChapterData.content.length;
    for (let i = startIdx; i < $currentChapterData.content.length; i += 1) {
      if ($currentChapterData.content[i]?.kind === 'heading') {
        endIdx = i;
        break;
      }
    }
    for (let i = startIdx; i < endIdx; i += 1) {
      const item = $currentChapterData.content[i];
      if (isVerse(item) && item.poetry) return true;
    }
    return false;
  }

  function handleContentDragEnd(event: {
    operation: {
      source: { id: string | number } | null;
      target: { id: string | number } | null;
    };
  }): void {
    const fromIndex = resolveContentIndex(event.operation.source as DragNode | null);
    const toIndex = resolveContentIndex(event.operation.target as DragNode | null);
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    reorderContent($currentChapter, fromIndex, toIndex);
  }
</script>

{#if $currentChapterData && $bookData}
  <div class="chapter-header">
    <div class="header-title-row">
      <div class="header-title-left">
        {#if editingBookTitle}
          <input
            class="book-title-input"
            type="text"
            bind:value={editBookTitleValue}
            onblur={commitBookTitleEdit}
            onkeydown={handleBookTitleKeydown}
            use:initBookTitleInput
          />
        {:else}
          <h1
            class="book-title"
            class:editable={$editMode}
            role={$editMode ? 'button' : undefined}
            tabindex={$editMode ? 0 : undefined}
            title={$editMode ? $locale.editBookName : undefined}
            onclick={startBookTitleEdit}
            onkeydown={(e) => e.key === 'Enter' && startBookTitleEdit()}
          >{displayBookName}</h1>
        {/if}
        {#if !editingBookTitle}
          {#if editingSubtitle}
            <input
              class="book-subtitle-input"
              type="text"
              bind:value={editSubtitleValue}
              onblur={commitSubtitleEdit}
              onkeydown={handleSubtitleKeydown}
              use:initBookTitleInput
            />
          {:else if subtitleName}
            <p
              class="book-subtitle"
              class:editable={$editMode}
              role={$editMode ? 'button' : undefined}
              tabindex={$editMode ? 0 : undefined}
              title={$editMode ? $locale.editBookName : undefined}
              onclick={startSubtitleEdit}
              onkeydown={(e) => e.key === 'Enter' && startSubtitleEdit()}
            >{subtitleName}</p>
          {/if}
        {/if}
      </div>
      <h2 class="chapter-heading">{$locale.chapter} {$currentChapter}</h2>
    </div>

    {#if $editMode}
      <div class="chapter-poetry-bar">
        <button
          class="poetry-toggle-btn"
          class:active={hasAnyPoetry}
          onclick={handleToggleChapterPoetry}
        >
          {$locale.poetryMode} ({hasAnyPoetry ? $locale.poetryOff : $locale.poetryOn})
        </button>
      </div>
    {/if}

    <!-- Column headers: Classical → Armenian → English (fixed, never scrolls) -->
    <div class="column-headers {gridClass}">
      {#if $showClassical}<div class="column-header">{$locale.columnClassical}</div>{/if}
      {#if $showArmenian}<div class="column-header">{$locale.columnArmenian}</div>{/if}
      {#if $showEnglish}<div class="column-header">{$locale.columnEnglish}</div>{/if}
    </div>
  </div>

  <div class="chapter-scroll">
    <div class="verse-grid">
    {#if $editMode}
      <div class="add-row">
        <button class="add-row-btn" onclick={() => insertHeadingAfter($currentChapter, -1)}>
          {$locale.addHeading}
        </button>
        <button class="add-row-btn" onclick={() => insertVerseAfter($currentChapter, -1)}>
          {$locale.addVerse}
        </button>
      </div>
    {/if}

    <DragDropProvider onDragEnd={handleContentDragEnd}>
      {#each $currentChapterData.content as item, idx (idx)}
        <SortableItem
          id={`${CONTENT_ITEM_ID_PREFIX}${idx}`}
          index={idx}
          group={contentDragGroup}
          disabled={!$editMode}
          showHandle={$editMode}
          handleTitle={$locale.dragToReorder}
          className="content-item-wrapper"
        >
          {#if isHeading(item)}
            <SectionHeading
              heading={item}
              contentIndex={idx}
              {gridClass}
              showClassical={$showClassical}
              showArmenian={$showArmenian}
              showEnglish={$showEnglish}
              canDelete={$editMode}
              deleteTitle={$locale.deleteHeading}
              onDelete={() => confirmDeleteItem(idx)}
              sectionPoetryActive={sectionHasPoetry(idx)}
              onToggleSectionPoetry={(value) => setSectionPoetry($currentChapter, idx, value)}
            />
          {:else if isVerse(item)}
            <VerseRow
              verse={item}
              {gridClass}
              showClassical={$showClassical}
              showArmenian={$showArmenian}
              showEnglish={$showEnglish}
              onUpdate={handleVerseUpdate}
              canDelete={$editMode}
              deleteTitle={$locale.deleteVerse}
              onDelete={() => confirmDeleteItem(idx)}
              onTogglePoetry={() => toggleVersePoetry($currentChapter, item.number)}
            />
          {/if}
        </SortableItem>

        {#if $editMode}
          <div class="add-row">
            <button class="add-row-btn" onclick={() => insertHeadingAfter($currentChapter, idx)}>
              {$locale.addHeading}
            </button>
            <button class="add-row-btn" onclick={() => insertVerseAfter($currentChapter, idx)}>
              {$locale.addVerse}
            </button>
          </div>
        {/if}
      {/each}
    </DragDropProvider>
    </div>
  </div>
{/if}

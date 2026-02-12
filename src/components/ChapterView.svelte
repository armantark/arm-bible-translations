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

  let hasAnyPoetry = $derived(
    $currentChapterData
      ? $currentChapterData.content.some((item) => isVerse(item) && item.poetry)
      : false,
  );

  function handleToggleChapterPoetry(): void {
    setChapterPoetry($currentChapter, !hasAnyPoetry);
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
    <h1 class="book-title">{displayBookName}</h1>
    {#if subtitleName}
      <p class="book-subtitle">{subtitleName}</p>
    {/if}

    <h2 class="chapter-heading">{$locale.chapter} {$currentChapter}</h2>

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
              onDelete={() => deleteItemAt($currentChapter, idx)}
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
              onDelete={() => deleteItemAt($currentChapter, idx)}
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

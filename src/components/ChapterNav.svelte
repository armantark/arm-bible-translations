<script lang="ts">
  import {
    chapterNumbers,
    currentChapter,
    bookData,
    locale,
    editMode,
    addChapter,
    deleteChapter,
    reorderChapters,
  } from '../lib/stores';
  import { isVerse } from '../lib/types';
  import { DragDropProvider } from '@dnd-kit-svelte/svelte';
  import SortableItem from './SortableItem.svelte';

  const CHAPTER_ITEM_ID_PREFIX = 'chapter-nav-';

  function selectChapter(num: number): void {
    currentChapter.set(num);
    /* Scroll main content to top */
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function parseChapterIndex(idValue: string | number): number | null {
    const id = String(idValue);
    if (!id.startsWith(CHAPTER_ITEM_ID_PREFIX)) return null;
    const idx = Number.parseInt(id.slice(CHAPTER_ITEM_ID_PREFIX.length), 10);
    return Number.isFinite(idx) ? idx : null;
  }

  type DragNode = {
    id?: string | number;
    index?: number;
    data?: { current?: { index?: number } };
  };

  function resolveChapterIndex(node: DragNode | null): number | null {
    if (!node) return null;
    if (typeof node.index === 'number' && Number.isFinite(node.index)) {
      return node.index;
    }
    const dataIndex = node.data?.current?.index;
    if (typeof dataIndex === 'number' && Number.isFinite(dataIndex)) {
      return dataIndex;
    }
    if (node.id !== undefined) return parseChapterIndex(node.id);
    return null;
  }

  function chapterHasContent(chapterNumber: number): boolean {
    if (!$bookData) return false;
    const chapter = $bookData.chapters.find((c) => c.number === chapterNumber);
    if (!chapter) return false;
    return chapter.content.some((item) => {
      if (isVerse(item)) {
        return !!(item.armenian.trim() || item.english.trim() || item.classical.trim());
      }
      return !!(item.armenian.trim() || item.english.trim() || item.classical.trim());
    });
  }

  function handleDeleteChapter(chapterNumber: number): void {
    if ($chapterNumbers.length <= 1) return;
    if (chapterHasContent(chapterNumber)) {
      if (!window.confirm($locale.confirmDeleteChapter)) return;
    }
    deleteChapter(chapterNumber);
  }

  function handleChapterDragEnd(event: {
    operation: {
      source: { id: string | number } | null;
      target: { id: string | number } | null;
    };
  }): void {
    const fromIndex = resolveChapterIndex(event.operation.source as DragNode | null);
    const toIndex = resolveChapterIndex(event.operation.target as DragNode | null);
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    reorderChapters(fromIndex, toIndex);
  }
</script>

<nav class="chapter-nav">
  <div class="chapter-nav-title">{$locale.chapters}</div>

  <DragDropProvider onDragEnd={handleChapterDragEnd}>
    {#each $chapterNumbers as num, idx (num)}
      <SortableItem
        id={`${CHAPTER_ITEM_ID_PREFIX}${idx}`}
        index={idx}
        group="chapter-nav"
        disabled={!$editMode}
        showHandle={$editMode}
        handleTitle={$locale.dragToReorder}
        className="chapter-sortable"
      >
        <button
          class="chapter-btn"
          class:active={$currentChapter === num}
          onclick={() => selectChapter(num)}
        >
          {$locale.chapter} {num}
        </button>
        {#if $editMode && $chapterNumbers.length > 1}
          <button
            class="x-delete-btn chapter-delete-btn"
            type="button"
            onclick={() => handleDeleteChapter(num)}
            title={$locale.deleteChapter}
            aria-label={$locale.deleteChapter}
          >
            x
          </button>
        {/if}
      </SortableItem>
    {/each}
  </DragDropProvider>

  {#if $editMode}
    <div class="chapter-actions">
      <button class="add-row-btn chapter-add-btn" onclick={() => addChapter()}>
        {$locale.addChapter}
      </button>
    </div>
  {/if}
</nav>

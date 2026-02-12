<script lang="ts">
  import {
    books,
    currentBookId,
    uiLanguage,
    locale,
    showOptions,
    editMode,
    createBook,
    reorderBooks,
  } from '../lib/stores';
  import { bookDisplayName } from '../lib/types';
  import type { UILanguage } from '../lib/types';
  import { DragDropProvider } from '@dnd-kit-svelte/svelte';
  import SortableItem from './SortableItem.svelte';

  let searchQuery = $state('');
  const BOOK_ITEM_ID_PREFIX = 'book-item-';

  let filteredBooks = $derived(
    $books.filter(
      (b) =>
        b.name.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.name.armenian.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.name.classical.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );

  function selectBook(id: string): void {
    currentBookId.set(id);
  }

  function handleLangChange(e: Event): void {
    const val = (e.target as HTMLSelectElement).value as UILanguage;
    uiLanguage.set(val);
  }

  function parseBookId(idValue: string | number): string | null {
    const id = String(idValue);
    if (!id.startsWith(BOOK_ITEM_ID_PREFIX)) return null;
    return id.slice(BOOK_ITEM_ID_PREFIX.length);
  }

  function handleBookDragEnd(event: {
    operation: {
      source: { id: string | number } | null;
      target: { id: string | number } | null;
    };
  }): void {
    const source = event.operation.source;
    const target = event.operation.target;
    if (!source || !target) return;
    const sourceBookId = parseBookId(source.id);
    const targetBookId = parseBookId(target.id);
    if (!sourceBookId || !targetBookId || sourceBookId === targetBookId) return;
    const fromIndex = $books.findIndex((book) => book.id === sourceBookId);
    const toIndex = $books.findIndex((book) => book.id === targetBookId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    reorderBooks(fromIndex, toIndex);
  }
</script>

<nav class="sidebar">
  <div class="sidebar-section">{$locale.books}</div>

  <input
    type="text"
    class="search-input"
    placeholder={$locale.searchPlaceholder}
    bind:value={searchQuery}
  />

  <DragDropProvider onDragEnd={handleBookDragEnd}>
    {#each filteredBooks as book, idx (book.id)}
      <SortableItem
        id={`${BOOK_ITEM_ID_PREFIX}${book.id}`}
        index={idx}
        group="sidebar-books"
        disabled={!$editMode || searchQuery.trim().length > 0}
        showHandle={$editMode}
        handleTitle={$locale.dragToReorder}
        className="sidebar-item-sortable"
      >
        <button
          class="sidebar-item"
          class:active={$currentBookId === book.id}
          onclick={() => selectBook(book.id)}
        >
          {bookDisplayName(book.name, $uiLanguage)}
        </button>
      </SortableItem>
    {/each}
  </DragDropProvider>

  {#if filteredBooks.length === 0 && $books.length === 0}
    <div style="padding: 12px 20px; color: var(--text-muted); font-size: 13px;">
      {$locale.noBooksLoaded}
    </div>
  {/if}

  {#if $editMode}
    <div class="sidebar-actions">
      <button class="add-row-btn sidebar-add-btn" onclick={() => void createBook()}>
        {$locale.addBook}
      </button>
    </div>
  {/if}

  <div class="sidebar-spacer"></div>

  <div class="sidebar-footer">
    <button
      class="gear-btn"
      type="button"
      title={$locale.optionsTitle}
      onclick={() => showOptions.set(true)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" class="gear-icon">
        <path
          d="M19.14 12.94a7.56 7.56 0 0 0 .05-.94a7.56 7.56 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.05.62-.05.94s.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.13-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
        />
      </svg>
    </button>
    <div class="language-selector">
      <label class="lang-label" for="ui-lang">{$locale.displayLanguage}</label>
      <select id="ui-lang" class="lang-select" value={$uiLanguage} onchange={handleLangChange}>
        <option value="english">{$locale.languageEnglish}</option>
        <option value="armenian">{$locale.languageArmenian}</option>
        <option value="classical">{$locale.languageClassical}</option>
      </select>
    </div>
  </div>
</nav>

<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './components/Header.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import ChapterNav from './components/ChapterNav.svelte';
  import ChapterView from './components/ChapterView.svelte';
  import OptionsPanel from './components/OptionsPanel.svelte';
  import {
    books,
    currentBookId,
    currentChapter,
    bookData,
    editMode,
    locale,
    undoLatest,
    redoLatest,
    applyBookOrderPreference,
  } from './lib/stores';
  import { fetchBooks, fetchBook } from './lib/api';

  let loading = $state(true);
  let error = $state<string | null>(null);

  function isEditableTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  interface ScrollAnchor {
    contentIndex: string;
    relativeTop: number;
    fallbackScrollTop: number;
  }

  function chapterScrollContainer(): HTMLElement | null {
    return document.querySelector('.chapter-scroll');
  }

  function captureScrollAnchor(scroller: HTMLElement): ScrollAnchor | null {
    const scrollerRect = scroller.getBoundingClientRect();
    const rows = Array.from(
      scroller.querySelectorAll<HTMLElement>('[data-content-index]'),
    );
    if (rows.length === 0) return null;

    const top = scrollerRect.top + 8;
    const anchor =
      rows.find((row) => row.getBoundingClientRect().bottom > top) ?? rows[0];
    const contentIndex = anchor?.dataset.contentIndex;
    if (!anchor || !contentIndex) return null;

    return {
      contentIndex,
      relativeTop: anchor.getBoundingClientRect().top - scrollerRect.top,
      fallbackScrollTop: scroller.scrollTop,
    };
  }

  function restoreScrollAnchor(anchor: ScrollAnchor): void {
    const scroller = chapterScrollContainer();
    if (!scroller) return;
    const target = scroller.querySelector<HTMLElement>(
      `[data-content-index="${anchor.contentIndex}"]`,
    );
    if (!target) {
      scroller.scrollTop = anchor.fallbackScrollTop;
      return;
    }

    const scrollerTop = scroller.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top - scrollerTop;
    scroller.scrollTop += targetTop - anchor.relativeTop;
  }

  function toggleEditModePreserveLocation(): void {
    const scroller = chapterScrollContainer();
    const anchor = scroller ? captureScrollAnchor(scroller) : null;
    editMode.update((v) => !v);
    if (!anchor) return;

    // Wait for the mode toggle render pass + layout recalculation, then realign.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => restoreScrollAnchor(anchor));
    });
  }

  onMount(() => {
    const onKeydown = (event: KeyboardEvent): void => {
      if (!$editMode) return;
      if (isEditableTarget(event.target)) return;
      const usesUndoKey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z';
      if (!usesUndoKey) return;
      event.preventDefault();
      if (event.shiftKey) {
        redoLatest();
      } else {
        undoLatest();
      }
    };

    window.addEventListener('keydown', onKeydown);

    void (async () => {
      try {
        const bookList = await fetchBooks();
        const orderedBooks = applyBookOrderPreference(bookList);
        books.set(orderedBooks);
        if (orderedBooks.length > 0) {
          currentBookId.set(orderedBooks[0].id);
        }
      } catch {
        error = $locale.failedLoadBooks;
      } finally {
        loading = false;
      }
    })();

    return () => {
      window.removeEventListener('keydown', onKeydown);
    };
  });

  /* Load book data whenever selection changes */
  $effect(() => {
    const id = $currentBookId;
    if (!id) return;

    fetchBook(id)
      .then((data) => {
        bookData.set(data);
        if (data.chapters.length > 0) {
          currentChapter.set(data.chapters[0].number);
        }
      })
      .catch(() => {
        error = $locale.failedLoadBook;
      });
  });
</script>

<Header />
<div class="app-layout" class:edit-mode={$editMode}>
  <Sidebar />
  <main class="main-content">
    {#if loading}
      <div class="empty-state">{$locale.loading}</div>
    {:else if error}
      <div class="empty-state">{error}</div>
    {:else if $bookData}
      <ChapterView />
    {:else}
      <div class="empty-state">{$locale.selectBookToBegin}</div>
    {/if}
  </main>
  <ChapterNav />
</div>
<OptionsPanel />

<!-- Floating edit-mode toggle (pencil icon) -->
<button
  class="edit-fab"
  class:active={$editMode}
  title={$editMode ? $locale.editing : $locale.readOnly}
  onclick={toggleEditModePreserveLocation}
>
  <span class="material-symbols-outlined edit-fab-icon" aria-hidden="true">edit_square</span>
</button>

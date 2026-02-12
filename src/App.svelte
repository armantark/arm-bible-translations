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
  onclick={() => editMode.update((v) => !v)}
>
  <span class="material-symbols-outlined edit-fab-icon" aria-hidden="true">edit_square</span>
</button>

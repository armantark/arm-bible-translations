<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './components/Header.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import ChapterNav from './components/ChapterNav.svelte';
  import ChapterView from './components/ChapterView.svelte';
  import { books, currentBookId, currentChapter, bookData } from './lib/stores';
  import { fetchBooks, fetchBook } from './lib/api';

  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const bookList = await fetchBooks();
      books.set(bookList);
      if (bookList.length > 0) {
        currentBookId.set(bookList[0].id);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load books';
    } finally {
      loading = false;
    }
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
      .catch((e) => {
        error = e instanceof Error ? e.message : 'Failed to load book';
      });
  });
</script>

<Header />
<div class="app-layout">
  <Sidebar />
  <main class="main-content">
    {#if loading}
      <div class="empty-state">Loading&hellip;</div>
    {:else if error}
      <div class="empty-state">{error}</div>
    {:else if $bookData}
      <ChapterView />
    {:else}
      <div class="empty-state">Select a book to begin</div>
    {/if}
  </main>
  <ChapterNav />
</div>

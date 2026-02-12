<script lang="ts">
  import { books, currentBookId } from '../lib/stores';

  let searchQuery = $state('');

  let filteredBooks = $derived(
    $books.filter(
      (b) =>
        b.name.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.name.armenian.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );

  function selectBook(id: string): void {
    currentBookId.set(id);
  }
</script>

<nav class="sidebar">
  <div class="sidebar-section">Books</div>

  <input
    type="text"
    class="search-input"
    placeholder="Search&hellip;"
    bind:value={searchQuery}
  />

  {#each filteredBooks as book (book.id)}
    <button
      class="sidebar-item"
      class:active={$currentBookId === book.id}
      onclick={() => selectBook(book.id)}
    >
      {book.name.english}
    </button>
  {/each}

  {#if filteredBooks.length === 0 && $books.length === 0}
    <div style="padding: 12px 20px; color: var(--text-muted); font-size: 13px;">
      No books loaded
    </div>
  {/if}
</nav>

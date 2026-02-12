<script lang="ts">
  import { chapterNumbers, currentChapter } from '../lib/stores';

  function selectChapter(num: number): void {
    currentChapter.set(num);
    /* Scroll main content to top */
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

<nav class="chapter-nav">
  <div class="chapter-nav-title">Chapters</div>

  {#each $chapterNumbers as num (num)}
    <button
      class="chapter-btn"
      class:active={$currentChapter === num}
      onclick={() => selectChapter(num)}
    >
      Chapter {num}
    </button>
  {/each}
</nav>

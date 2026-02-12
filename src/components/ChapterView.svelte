<script lang="ts">
  import {
    bookData,
    currentChapterData,
    currentChapter,
    showArmenian,
    showEnglish,
    showClassical,
    updateVerse,
  } from '../lib/stores';
  import VerseRow from './VerseRow.svelte';
  import { isHeading, isVerse } from '../lib/types';

  let colCount = $derived(
    ($showArmenian ? 1 : 0) + ($showEnglish ? 1 : 0) + ($showClassical ? 1 : 0),
  );

  let gridClass = $derived(
    colCount === 3 ? 'cols-3' : colCount === 2 ? 'cols-2' : 'cols-1',
  );

  function handleVerseUpdate(
    verseNumber: number,
    field: 'armenian' | 'english' | 'classical',
    value: string,
  ): void {
    updateVerse($currentChapter, verseNumber, field, value);
  }
</script>

{#if $currentChapterData && $bookData}
  <h1 class="book-title">{$bookData.name.english}</h1>
  <p class="book-subtitle">{$bookData.name.armenian}</p>

  <h2 class="chapter-heading">Chapter {$currentChapter}</h2>

  <!-- Column headers -->
  <div class="column-headers {gridClass}">
    {#if $showArmenian}<div class="column-header">Armenian</div>{/if}
    {#if $showEnglish}<div class="column-header">English</div>{/if}
    {#if $showClassical}<div class="column-header">Classical Armenian</div>{/if}
  </div>

  <div class="verse-grid">
    {#each $currentChapterData.content as item, idx (item.kind === 'verse' ? `v${item.number}` : `h${idx}`)}
      {#if isHeading(item)}
        <div class="section-heading">
          <div class="section-heading-row {gridClass}">
            {#if $showArmenian}
              <div class="section-heading-text armenian-heading">{item.armenian}</div>
            {/if}
            {#if $showEnglish}
              <div class="section-heading-text">{item.english}</div>
            {/if}
            {#if $showClassical}
              <div class="section-heading-text armenian-heading">{item.classical}</div>
            {/if}
          </div>
        </div>
      {:else if isVerse(item)}
        <VerseRow
          verse={item}
          {gridClass}
          showArmenian={$showArmenian}
          showEnglish={$showEnglish}
          showClassical={$showClassical}
          onUpdate={handleVerseUpdate}
        />
      {/if}
    {/each}
  </div>
{/if}

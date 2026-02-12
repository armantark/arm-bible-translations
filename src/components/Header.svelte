<script lang="ts">
  import {
    bookData,
    showArmenian,
    showEnglish,
    showClassical,
    saveStatus,
    forceSave,
  } from '../lib/stores';

  function toggleColumn(
    store: typeof showArmenian | typeof showEnglish | typeof showClassical,
  ): void {
    store.update((v) => !v);
  }
</script>

<header class="header">
  <span class="header-logo">Ա.Գ.</span>
  <span class="header-title">
    {#if $bookData}
      {$bookData.name.english}
    {:else}
      Armenian Bible Translations
    {/if}
  </span>

  <div class="header-controls">
    <button
      class="toggle-btn"
      class:active={$showArmenian}
      onclick={() => toggleColumn(showArmenian)}
    >
      Armenian
    </button>
    <button
      class="toggle-btn"
      class:active={$showEnglish}
      onclick={() => toggleColumn(showEnglish)}
    >
      English
    </button>
    <button
      class="toggle-btn"
      class:active={$showClassical}
      onclick={() => toggleColumn(showClassical)}
    >
      Classical
    </button>

    <button
      class="save-btn"
      class:saving={$saveStatus === 'saving'}
      class:saved={$saveStatus === 'saved'}
      class:error={$saveStatus === 'error'}
      onclick={() => void forceSave()}
    >
      {#if $saveStatus === 'saving'}
        Saving&hellip;
      {:else if $saveStatus === 'saved'}
        Saved
      {:else if $saveStatus === 'error'}
        Error
      {:else}
        Save
      {/if}
    </button>
  </div>
</header>

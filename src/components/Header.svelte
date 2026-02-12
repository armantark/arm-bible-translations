<script lang="ts">
  import {
    bookData,
    showArmenian,
    showEnglish,
    showClassical,
    editMode,
    uiLanguage,
    locale,
    saveStatus,
    isDirty,
    forceSave,
    canUndo,
    canRedo,
    undoLatest,
    redoLatest,
  } from '../lib/stores';
  import { bookDisplayName } from '../lib/types';

  function toggleColumn(
    store: typeof showArmenian | typeof showEnglish | typeof showClassical,
  ): void {
    store.update((v) => !v);
  }

  let dotClass = $derived(
    $saveStatus === 'saving'
      ? 'saving'
      : $saveStatus === 'saved'
        ? 'saved'
        : $saveStatus === 'error'
          ? 'error'
          : $isDirty
            ? 'dirty'
            : '',
  );

  let statusLabel = $derived(
    $saveStatus === 'saving'
      ? $locale.saving
      : $saveStatus === 'saved'
        ? $locale.saved
        : $saveStatus === 'error'
          ? $locale.error
          : $isDirty
            ? $locale.unsaved
            : $locale.autoSaveOn,
  );

  let headerTitle = $derived(
    $bookData
      ? bookDisplayName($bookData.name, $uiLanguage)
      : $locale.appTitle,
  );
</script>

<header class="header">
  <span class="header-logo">{$locale.brandCode}</span>
  <span class="header-title">{headerTitle}</span>

  <div class="header-controls">
    <button
      class="toggle-btn"
      class:active={$showClassical}
      onclick={() => toggleColumn(showClassical)}
    >
      {$locale.toggleClassical}
    </button>
    <button
      class="toggle-btn"
      class:active={$showArmenian}
      onclick={() => toggleColumn(showArmenian)}
    >
      {$locale.toggleArmenian}
    </button>
    <button
      class="toggle-btn"
      class:active={$showEnglish}
      onclick={() => toggleColumn(showEnglish)}
    >
      {$locale.toggleEnglish}
    </button>

    {#if $editMode}
      <button
        class="toggle-btn"
        disabled={!$canUndo}
        title={$locale.undo}
        onclick={() => undoLatest()}
      >
        {$locale.undo}
      </button>

      <button
        class="toggle-btn"
        disabled={!$canRedo}
        title={$locale.redo}
        onclick={() => redoLatest()}
      >
        {$locale.redo}
      </button>

      <span class="autosave-dot {dotClass}" title={statusLabel}></span>

      <button
        class="save-btn"
        class:saving={$saveStatus === 'saving'}
        class:saved={$saveStatus === 'saved'}
        class:error={$saveStatus === 'error'}
        onclick={() => void forceSave()}
      >
        {#if $saveStatus === 'saving'}
          {$locale.saving}
        {:else if $saveStatus === 'saved'}
          {$locale.saved}
        {:else if $saveStatus === 'error'}
          {$locale.error}
        {:else}
          {$locale.save}
        {/if}
      </button>
    {/if}
  </div>
</header>

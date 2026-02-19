<script lang="ts">
  import type { HeadingItem } from '../lib/types';
  import { editMode, currentChapter, updateHeading, locale } from '../lib/stores';

  interface Props {
    heading: HeadingItem;
    contentIndex: number;
    gridClass: string;
    showClassical: boolean;
    showArmenian: boolean;
    showEnglish: boolean;
    canDelete: boolean;
    deleteTitle: string;
    onDelete: () => void;
    sectionPoetryActive?: boolean;
    onToggleSectionPoetry?: (value: boolean) => void;
  }

  let {
    heading,
    contentIndex,
    gridClass,
    showClassical,
    showArmenian,
    showEnglish,
    canDelete,
    deleteTitle,
    onDelete,
    sectionPoetryActive = false,
    onToggleSectionPoetry,
  }: Props = $props();

  type LangField = 'armenian' | 'english' | 'classical';

  let editingField = $state<LangField | null>(null);
  let editValue = $state('');

  function startEdit(field: LangField): void {
    if (!$editMode) return;
    editingField = field;
    editValue = heading[field];
  }

  function commitEdit(): void {
    if (editingField) {
      updateHeading($currentChapter, contentIndex, editingField, editValue.trim());
      editingField = null;
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      editingField = null;
    }
  }

  function initInput(node: HTMLInputElement): { destroy: () => void } {
    node.focus();
    node.select();
    return { destroy() {} };
  }
</script>

<div class="section-heading" data-content-index={contentIndex}>
  {#if canDelete}
    <button class="x-delete-btn" type="button" onclick={onDelete} title={deleteTitle} aria-label={deleteTitle}>
      x
    </button>
  {/if}
  <div class="section-heading-row {gridClass}">
    {#if showClassical}
      <div class="section-heading-text armenian-heading">
        {#if editingField === 'classical'}
          <input
            class="heading-input armenian-heading"
            type="text"
            bind:value={editValue}
            onblur={commitEdit}
            onkeydown={(e) => { handleKeydown(e); if (e.key === 'Enter') commitEdit(); }}
            use:initInput
          />
        {:else}
          <span
            class="heading-label"
            role="textbox"
            tabindex="0"
            onclick={() => startEdit('classical')}
            onkeydown={(e) => e.key === 'Enter' && startEdit('classical')}
          >
            {heading.classical || ($editMode ? $locale.clickToEdit : '\u00A0')}
          </span>
        {/if}
        {#if $editMode && onToggleSectionPoetry}
          <button
            class="poetry-toggle-btn section-poetry-inline-btn"
            class:active={sectionPoetryActive}
            onclick={() => onToggleSectionPoetry?.(!sectionPoetryActive)}
            title={sectionPoetryActive ? $locale.poetryOff : $locale.poetryOn}
          >
            {$locale.poetryMode}
          </button>
        {/if}
      </div>
    {/if}
    {#if showArmenian}
      <div class="section-heading-text armenian-heading">
        {#if editingField === 'armenian'}
          <input
            class="heading-input armenian-heading"
            type="text"
            bind:value={editValue}
            onblur={commitEdit}
            onkeydown={(e) => { handleKeydown(e); if (e.key === 'Enter') commitEdit(); }}
            use:initInput
          />
        {:else}
          <span
            class="heading-label"
            role="textbox"
            tabindex="0"
            onclick={() => startEdit('armenian')}
            onkeydown={(e) => e.key === 'Enter' && startEdit('armenian')}
          >
            {heading.armenian || ($editMode ? $locale.clickToEdit : '\u00A0')}
          </span>
        {/if}
        {#if !showClassical && $editMode && onToggleSectionPoetry}
          <button
            class="poetry-toggle-btn section-poetry-inline-btn"
            class:active={sectionPoetryActive}
            onclick={() => onToggleSectionPoetry?.(!sectionPoetryActive)}
            title={sectionPoetryActive ? $locale.poetryOff : $locale.poetryOn}
          >
            {$locale.poetryMode}
          </button>
        {/if}
      </div>
    {/if}
    {#if showEnglish}
      <div class="section-heading-text">
        {#if editingField === 'english'}
          <input
            class="heading-input"
            type="text"
            bind:value={editValue}
            onblur={commitEdit}
            onkeydown={(e) => { handleKeydown(e); if (e.key === 'Enter') commitEdit(); }}
            use:initInput
          />
        {:else}
          <span
            class="heading-label"
            role="textbox"
            tabindex="0"
            onclick={() => startEdit('english')}
            onkeydown={(e) => e.key === 'Enter' && startEdit('english')}
          >
            {heading.english || ($editMode ? $locale.clickToEdit : '\u00A0')}
          </span>
        {/if}
        {#if !showClassical && !showArmenian && $editMode && onToggleSectionPoetry}
          <button
            class="poetry-toggle-btn section-poetry-inline-btn"
            class:active={sectionPoetryActive}
            onclick={() => onToggleSectionPoetry?.(!sectionPoetryActive)}
            title={sectionPoetryActive ? $locale.poetryOff : $locale.poetryOn}
          >
            {$locale.poetryMode}
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

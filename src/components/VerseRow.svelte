<script lang="ts">
  import type { VerseItem } from '../lib/types';

  interface Props {
    verse: VerseItem;
    gridClass: string;
    showArmenian: boolean;
    showEnglish: boolean;
    showClassical: boolean;
    onUpdate: (
      verseNumber: number,
      field: 'armenian' | 'english' | 'classical',
      value: string,
    ) => void;
  }

  let { verse, gridClass, showArmenian, showEnglish, showClassical, onUpdate }: Props =
    $props();

  type EditField = 'armenian' | 'english' | 'classical';

  let editingField = $state<EditField | null>(null);
  let editValue = $state('');

  function startEdit(field: EditField): void {
    editingField = field;
    editValue = verse[field];
  }

  function commitEdit(): void {
    if (editingField) {
      onUpdate(verse.number, editingField, editValue.trim());
      editingField = null;
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      editingField = null;
    }
  }

  /** Svelte action: auto-focus + auto-resize textarea */
  function initTextarea(node: HTMLTextAreaElement): { destroy: () => void } {
    node.focus();
    const len = node.value.length;
    node.setSelectionRange(len, len);

    function resize(): void {
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight}px`;
    }

    node.addEventListener('input', resize);
    requestAnimationFrame(resize);

    return {
      destroy() {
        node.removeEventListener('input', resize);
      },
    };
  }
</script>

<div class="verse-row {gridClass}">
  {#if showArmenian}
    <div class="verse-cell armenian-cell">
      <span class="verse-number">{verse.number}</span>
      {#if editingField === 'armenian'}
        <textarea
          class="verse-textarea"
          bind:value={editValue}
          onblur={commitEdit}
          onkeydown={handleKeydown}
          use:initTextarea
        ></textarea>
      {:else}
        <span
          class="verse-text"
          role="textbox"
          tabindex="0"
          onclick={() => startEdit('armenian')}
          onkeydown={(e) => e.key === 'Enter' && startEdit('armenian')}
        >
          {verse.armenian || '\u00A0'}
        </span>
      {/if}
    </div>
  {/if}

  {#if showEnglish}
    <div class="verse-cell">
      <span class="verse-number">{verse.number}</span>
      {#if editingField === 'english'}
        <textarea
          class="verse-textarea"
          bind:value={editValue}
          onblur={commitEdit}
          onkeydown={handleKeydown}
          use:initTextarea
        ></textarea>
      {:else}
        <span
          class="verse-text"
          role="textbox"
          tabindex="0"
          onclick={() => startEdit('english')}
          onkeydown={(e) => e.key === 'Enter' && startEdit('english')}
        >
          {verse.english || '\u00A0'}
        </span>
      {/if}
    </div>
  {/if}

  {#if showClassical}
    <div class="verse-cell armenian-cell">
      <span class="verse-number">{verse.number}</span>
      {#if editingField === 'classical'}
        <textarea
          class="verse-textarea"
          bind:value={editValue}
          onblur={commitEdit}
          onkeydown={handleKeydown}
          use:initTextarea
        ></textarea>
      {:else}
        <span
          class="verse-text"
          role="textbox"
          tabindex="0"
          onclick={() => startEdit('classical')}
          onkeydown={(e) => e.key === 'Enter' && startEdit('classical')}
        >
          {verse.classical || '\u00A0'}
        </span>
      {/if}
    </div>
  {/if}
</div>

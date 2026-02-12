<script lang="ts">
  import type { Snippet } from 'svelte';
  import { useSortable } from '@dnd-kit-svelte/svelte/sortable';

  interface Props {
    id: string;
    index: number;
    group: string;
    disabled: boolean;
    showHandle: boolean;
    handleTitle: string;
    className?: string;
    children?: Snippet;
  }

  let {
    id,
    index,
    group,
    disabled,
    showHandle,
    handleTitle,
    className = '',
    children,
  }: Props = $props();

  const sortable = useSortable({
    id: () => id,
    index: () => index,
    group: () => group,
    disabled: () => disabled,
  });
</script>

<div
  class={`sortable-item ${className}`.trim()}
  class:is-dragging={sortable.isDragging.current}
  {@attach sortable.ref}
>
  {#if showHandle}
    <button
      type="button"
      class="drag-handle"
      title={handleTitle}
      aria-label={handleTitle}
      {@attach sortable.handleRef}
    >
      ::
    </button>
  {/if}

  {@render children?.()}
</div>

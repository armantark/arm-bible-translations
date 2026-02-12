<script lang="ts">
  import {
    showOptions,
    locale,
    footnoteDisplayMode,
  } from '../lib/stores';
</script>

{#if $showOptions}
  <div
    class="options-backdrop"
    role="button"
    tabindex="0"
    aria-label={$locale.close}
    onclick={() => showOptions.set(false)}
    onkeydown={(e) => e.key === 'Escape' && showOptions.set(false)}
  ></div>
  <div class="options-panel" role="dialog" aria-modal="true">
    <div class="options-header">
      <h3 class="options-title">{$locale.optionsTitle}</h3>
      <button class="options-close-btn" onclick={() => showOptions.set(false)}>
        {$locale.close}
      </button>
    </div>
    <p class="options-subtitle">{$locale.optionsSubtitle}</p>

    <div class="option-group">
      <p class="option-label">{$locale.footnoteMode}</p>
      <label class="option-radio">
        <input
          type="radio"
          name="footnote-mode"
          value="tooltip"
          checked={$footnoteDisplayMode === 'tooltip'}
          onchange={() => footnoteDisplayMode.set('tooltip')}
        />
        <span>{$locale.footnoteModeTooltip}</span>
      </label>
      <label class="option-radio">
        <input
          type="radio"
          name="footnote-mode"
          value="superscript"
          checked={$footnoteDisplayMode === 'superscript'}
          onchange={() => footnoteDisplayMode.set('superscript')}
        />
        <span>{$locale.footnoteModeSuperscript}</span>
      </label>
      <p class="option-help">{$locale.footnoteModeTooltipHelp}</p>
    </div>
  </div>
{/if}

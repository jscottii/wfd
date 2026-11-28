<script>
  // a recipe's photo (or a plate placeholder)
  import { ui } from '../lib/ui.svelte.js';
  // tapping the photo opens the recipe's quick view (open={false} where the screen already does that)
  let { r, size = 56, round = 10, open = true } = $props();
  let broken = $state(false);
  function peek(e) { if (!open || !r?.title || !r.ing) return; e.preventDefault(); e.stopPropagation(); ui.preview = { r }; }
</script>
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<span class="dwrap" class:tap={open} onclick={peek} title={open ? 'Quick look' : undefined}>
{#if r?.image && !broken}
  <img class="dish" src={r.image.includes('themealdb') && size <= 80 ? r.image + '/preview' : r.image} alt="" loading="lazy" style="width:{size}px;height:{size}px;border-radius:{round}px" onerror={() => (broken = true)} />
{:else}
  <span class="dish dish-empty" style="width:{size}px;height:{size}px;border-radius:{round}px;font-size:{Math.round(size * 0.45)}px">🍽️</span>
{/if}
</span>
<style>
  .dwrap { display: inline-flex; flex: none; } .tap { cursor: zoom-in; }
  .dish { object-fit: cover; flex: none; display: inline-block; background: var(--tint); }
  .dish-empty { display: inline-grid; place-items: center; }
</style>

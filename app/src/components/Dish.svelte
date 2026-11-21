<script>
  // a recipe's photo (or a plate placeholder)
  let { r, size = 56, round = 10 } = $props();
  let broken = $state(false);
</script>
{#if r?.image && !broken}
  <img class="dish" src={r.image.includes('themealdb') && size <= 80 ? r.image + '/preview' : r.image} alt="" loading="lazy" style="width:{size}px;height:{size}px;border-radius:{round}px" onerror={() => (broken = true)} />
{:else}
  <span class="dish dish-empty" style="width:{size}px;height:{size}px;border-radius:{round}px;font-size:{Math.round(size * 0.45)}px">🍽️</span>
{/if}
<style>
  .dish { object-fit: cover; flex: none; display: inline-block; background: var(--tint); }
  .dish-empty { display: inline-grid; place-items: center; }
</style>

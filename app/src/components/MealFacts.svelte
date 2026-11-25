<script>
  import { app } from '../lib/db.svelte.js';
  import { conflicts, prefsOf } from '../lib/diet.js';
  import { nutritionOf } from '../lib/nutrition.js';
  // Per-serving calories / protein / carbs / fat, and how the meal fits the household's diets and allergies.
  // compact = one short line for lists; full = macro bar + every diet with the reason.
  let { r, compact = false } = $props();
  const n = $derived(nutritionOf(r));
  const c = $derived(conflicts(r, prefsOf(app.settings)));
  const kcal = $derived(Number(r?.calories) || n?.kcal || 0);
  const short = (a) => (a.length > 2 ? `${a.slice(0, 2).join(', ')}…` : a.join(', '));
</script>

{#if compact}
  <span class="mf-line">
    {#if n?.ok}<span class="mf-mac" title="Estimated per serving">{kcal} cal · {n.protein}g P · {n.carbs}g C · {n.fat}g F</span>{/if}
    {#each c.allergens as a}<span class="mf-tag bad" title="Contains {a.name}: {a.why.join(', ')}">⚠ {a.name} ({short(a.why)})</span>{/each}
    {#each c.diets as d}<span class="mf-tag warn" title={d.why}>✗ {d.diet}</span>{/each}
    {#each c.avoid as a}<span class="mf-tag warn">has {a}</span>{/each}
    {#each c.fits as f}<span class="mf-tag ok">✓ {f}</span>{/each}
  </span>
{:else}
  <div class="mf">
    {#if n?.ok}
      {@const tot = n.protein * 4 + n.carbs * 4 + n.fat * 9 || 1}
      <div class="mf-head"><b>{kcal} cal</b> <span class="small muted">per serving · estimated from the ingredients</span></div>
      <div class="mf-bar" role="img" aria-label="Protein {n.protein} grams, carbs {n.carbs} grams, fat {n.fat} grams">
        <span style="width:{(n.protein * 400) / tot}%;background:#1f5fd1"></span><span style="width:{(n.carbs * 400) / tot}%;background:#f2a33a"></span><span style="width:{(n.fat * 900) / tot}%;background:#8a94a6"></span>
      </div>
      <div class="mf-legend small">
        <span><i style="background:#1f5fd1"></i><b>{n.protein} g</b> protein</span>
        <span><i style="background:#f2a33a"></i><b>{n.carbs} g</b> carbs</span>
        <span><i style="background:#8a94a6"></i><b>{n.fat} g</b> fat</span>
      </div>
    {:else if n?.total}
      <p class="small muted" style="margin:0">Not enough recognisable amounts in this recipe to estimate nutrition.</p>
    {/if}
    {#if c.allergens.length || c.diets.length || c.fits.length || c.avoid.length || c.notes.length}
      <ul class="mf-diet">
        {#each c.allergens as a}<li class="bad">⚠ <b>Contains {a.name.toLowerCase()}</b> — {a.why.join(', ')}</li>{/each}
        {#each c.diets as d}<li class="warn">✗ <b>Not {d.diet}</b> — {d.why}</li>{/each}
        {#each c.avoid as a}<li class="warn">✗ <b>Has {a}</b> (on your avoid list)</li>{/each}
        {#each c.fits as f}<li class="ok">✓ <b>{f}</b></li>{/each}
        {#each c.notes as x}<li class="muted">ℹ︎ {x}</li>{/each}
      </ul>
      <p class="small muted" style="margin:4px 0 0">Checked from the ingredient names — always read labels for allergies.</p>
    {/if}
  </div>
{/if}

<style>
  .mf-line { display: inline-flex; flex-wrap: wrap; gap: 4px 6px; align-items: center; margin-top: 3px; }
  .mf-mac { font-size: 12px; color: var(--muted); }
  .mf-tag { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 1px 7px; white-space: nowrap; }
  .mf-tag.bad { background: #fde8e8; color: #9b1c1c; }
  .mf-tag.warn { background: #fff1db; color: #8a4b00; }
  .mf-tag.ok { background: #e3f4e6; color: #1e6b33; }
  .mf { margin: 6px 0 10px; }
  .mf-head { margin-bottom: 4px; }
  .mf-bar { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: var(--line); gap: 2px; }
  .mf-bar span { display: block; height: 100%; }
  .mf-legend { display: flex; gap: 14px; margin-top: 4px; flex-wrap: wrap; }
  .mf-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
  .mf-diet { list-style: none; margin: 8px 0 0; padding: 0; font-size: 13px; }
  .mf-diet li { padding: 3px 0; }
  .mf-diet .bad { color: #9b1c1c; }
  .mf-diet .warn { color: #8a4b00; }
  .mf-diet .ok { color: #1e6b33; }
</style>

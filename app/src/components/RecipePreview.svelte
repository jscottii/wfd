<script>
  import Dish from './Dish.svelte';
  import MealFacts from './MealFacts.svelte';
  import RecipeFlow from './RecipeFlow.svelte';
  // A recipe as an overlay: photo, nutrition and diets, ingredients, steps. Actions come from the screen that opened it.
  let { r, where = '', onclose, actions = [] } = $props();
  let tab = $state('ing');
  $effect(() => { const k = (e) => e.key === 'Escape' && onclose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); });
</script>

<div class="pv-back" role="presentation" onclick={onclose}></div>
<div class="pv" role="dialog" aria-modal="true" aria-label={r.title}>
  <div class="pv-head">
    <Dish {r} size={72} round={12} open={false} />
    <div class="grow" style="min-width:0">
      {#if where}<div class="small muted">{where}</div>{/if}
      <h2 style="margin:2px 0 4px;font-size:20px">{r.title}</h2>
      <div class="small muted">{[r.when, r.cuisine, r.servings ? `makes ${r.servings}` : '', r.yield].filter(Boolean).join(' · ')}</div>
    </div>
    <button class="quiet pv-x" onclick={onclose} aria-label="Close">✕</button>
  </div>
  <MealFacts {r} />
  {#if r.fridge || r.freeze}<p class="small muted" style="margin:6px 0 0">{#if r.fridge}🧊 Fridge: {r.fridge}. {/if}{#if r.freeze}❄️ Freezer: {r.freeze}.{/if}</p>{/if}
  <div class="seg" style="margin:12px 0 8px">
    <button class:on={tab === 'ing'} onclick={() => (tab = 'ing')}>Ingredients ({r.ing.length})</button>
    <button class:on={tab === 'steps'} onclick={() => (tab = 'steps')}>Steps ({r.steps.length})</button>
    <button class:on={tab === 'flow'} onclick={() => (tab = 'flow')}>🔀 At a glance</button>
  </div>
  <div class="pv-body">
    {#if tab === 'ing'}<ul class="small">{#each r.ing as x}<li>{x}</li>{/each}</ul>
    {:else if tab === 'steps'}<ol class="small">{#each r.steps as x}<li style="margin:4px 0">{x}</li>{/each}</ol>
    {:else}<RecipeFlow {r} />{/if}
    {#if r.source}<p class="small"><a href={r.source} target="_blank" rel="noopener">Original recipe ↗</a></p>{/if}
  </div>
  {#if actions.length}
    <div class="pv-acts">{#each actions as a}<button class={a.kind || 'ghost'} onclick={a.run}>{a.label}</button>{/each}</div>
  {/if}
</div>

<style>
  .pv-back { position: fixed; inset: 0; background: rgba(15, 20, 30, .45); z-index: 80; }
  .pv { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 81; width: min(560px, calc(100vw - 24px)); max-height: calc(100vh - 48px);
    overflow: auto; background: var(--card); border-radius: 18px; padding: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, .3); }
  .pv-head { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; }
  .pv-x { font-size: 18px; padding: 4px 8px; }
  .pv-body { min-height: 120px; }
  .pv-acts { position: sticky; bottom: -16px; display: flex; flex-wrap: wrap; gap: 6px; background: var(--card); padding: 10px 0 2px; border-top: 1px solid var(--line); margin-top: 10px; }
</style>

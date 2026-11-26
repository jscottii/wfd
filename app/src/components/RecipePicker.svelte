<script>
  import { app, importRecipeUrl, toast } from '../lib/db.svelte.js';
  import { suggest } from '../lib/fuzzy.js';
  import Dish from './Dish.svelte';
  import MealFacts from './MealFacts.svelte';
  import FindRecipes from './FindRecipes.svelte';
  // Add a recipe the same three ways as everywhere else: one of yours, a new one from the finder, or a link.
  let { onpick, onclose, exclude = [], title = 'Add a recipe' } = $props();
  let tab = $state('mine'), q = $state(''), link = $state(''), busy = $state(false), err = $state('');
  const pool = $derived(app.recipes.filter((r) => !exclude.includes(r.id)));
  const near = $derived(q.trim().length > 2 ? new Set(suggest(q, pool.map((r) => r.title), 40)) : null);
  const list = $derived(pool.filter((r) => !q.trim() || r.title.toLowerCase().includes(q.toLowerCase().trim()) || near?.has(r.title))
    .sort((a, b) => Number(!!b.active) - Number(!!a.active) || a.title.localeCompare(b.title)));
  function pick(r) { onpick(r.id); toast(`✓ Added ${r.title}`); }
  async function fromLink(e) {
    e.preventDefault(); busy = true; err = '';
    try { const [r] = await importRecipeUrl(link.trim()); link = ''; pick(r); onclose(); } catch (x) { err = x.message; }
    busy = false;
  }
</script>

<div class="modal-back" role="presentation">
  <div class="modal card nocollapse" style="max-width:640px">
    <div class="spread"><h2 style="margin:0">{title}</h2><button class="quiet" onclick={onclose} aria-label="Close">✕</button></div>
    <div class="seg" style="margin:10px 0">
      <button class:on={tab === 'mine'} onclick={() => (tab = 'mine')}>📖 My recipes</button>
      <button class:on={tab === 'find'} onclick={() => (tab = 'find')}>🔎 Find new</button>
      <button class:on={tab === 'link'} onclick={() => (tab = 'link')}>🔗 From a link</button>
    </div>
    {#if tab === 'mine'}
      <input type="search" placeholder="Search your recipes (typos are fine)" bind:value={q} />
      <div class="rp-list">
        {#each list as r (r.id)}
          <button class="rp-row" onclick={() => pick(r)}>
            <Dish {r} size={44} round={8} />
            <span class="grow" style="text-align:left"><b class="small">{r.title}</b><br><span class="small muted">{r.when || ''}{r.cuisine ? ` · ${r.cuisine}` : ''}</span><br><MealFacts {r} compact /></span>
            <span class="rp-add" aria-hidden="true">＋</span>
          </button>
        {:else}{#if q.trim()}<p class="small muted">No saved recipes match <b>“{q.trim()}”</b>.</p><button class="ghost" onclick={() => (tab = 'find')}>🔎 Search for “{q.trim()}” in Find new</button>{:else}<p class="small muted">No saved recipes yet. Try Find new.</p>{/if}{/each}
      </div>
    {:else if tab === 'find'}
      <FindRecipes onadd={(r) => onpick(r.id)} initial={q.trim()} />
    {:else}
      <form onsubmit={fromLink}>
        <label class="f">Paste a recipe link from any site<input type="url" bind:value={link} placeholder="https://…" /></label>
        {#if err}<div class="err small">⚠️ {err}</div>{/if}
        <button disabled={!link.trim() || busy}>{#if busy}<span class="spinner"></span>{/if} Save and add</button>
      </form>
    {/if}
    <div class="row" style="margin-top:12px"><button class="ghost" onclick={onclose}>Done</button></div>
  </div>
</div>

<style>
  .rp-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; max-height: 55vh; overflow-y: auto; }
  .rp-row { display: flex; align-items: center; gap: 10px; background: var(--card); color: var(--ink); border: 1px solid var(--line); border-radius: 12px; padding: 8px; font-weight: 400; justify-content: flex-start; }
  .rp-add { font-size: 20px; color: var(--accent); padding: 0 6px; }
</style>

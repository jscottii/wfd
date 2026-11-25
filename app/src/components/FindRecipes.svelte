<script>
  import { untrack } from 'svelte';
  import { app, saveSettings, importRecipes, importRecipeUrl, callProxy, toast } from '../lib/db.svelte.js';
  import { CUISINES, MEAL_TYPES, findIdeas, mealDetail, fromMealDb } from '../lib/discover.js';
  import { conflicts, conflictText, prefsOf } from '../lib/diet.js';
  import AdSlot from './AdSlot.svelte';
  const warnFor = (r) => { const c = conflicts(r, prefsOf(app.settings)); return c.any ? ` — heads up: ${conflictText(c)}` : ''; };
  // onadd(recipe) — called for each recipe added (e.g. to drop it into a week); onbm — open the Bare Minimum weeks
  let { onadd = null, onbm = null, onclose = null } = $props();

  // tap = pick (tap again to unpick); press and hold = ♥ favorite (saved, and suggestions lean toward it)
  let fav = $state({ cuisines: [...(app.settings.cuisines || [])], types: [...(app.settings.mealTypes || [])] });
  let pick = $state({ cuisines: untrack(() => [...fav.cuisines]), types: untrack(() => (app.settings.diets || []).includes('Vegan') ? ['Vegan'] : (app.settings.diets || []).includes('Vegetarian') ? ['Vegetarian'] : []) });
  let q = $state(''), link = $state('');
  let ideas = $state([]), sites = $state([]), busy = $state(''), err = $state(''), added = $state({});

  const have = (title) => app.recipes.some((r) => r.title.toLowerCase() === String(title).toLowerCase());

  // only the newest search gets to show its results; earlier ones that finish late are ignored
  let seq = 0, wait = 0, sitesBusy = $state(false);
  async function look() {
    const my = ++seq, s = q.trim();
    err = ''; busy = 'look';
    if (s) { sites = []; sitesBusy = true; callProxy({ action: 'recipe-search', q: s }).then((r) => { if (my === seq) sites = r.results || []; }).catch(() => {}).finally(() => { if (my === seq) sitesBusy = false; }); }
    else { sites = []; sitesBusy = false; }
    try {
      const found = await findIdeas({ cuisines: s ? [] : pick.cuisines, types: s ? [] : pick.types, search: s });
      if (my !== seq) return;
      ideas = found;
      if (!found.length) err = s ? `No recipes called “${s}” in the free collection — web results below, or try one word like “chicken”.` : 'Nothing matches that mix — try unpicking something.';
    } catch (e) { if (my === seq) err = e.message; }
    if (my === seq) busy = '';
  }
  // chips: look again a moment after the last tap; typing: search as you type (3+ letters)
  const soon = (ms) => { clearTimeout(wait); wait = setTimeout(look, ms); };
  $effect(() => { JSON.stringify(pick); if (!untrack(() => q)) untrack(() => soon(250)); });
  $effect(() => { const s = q.trim(); if (s.length >= 3) untrack(() => soon(450)); else if (!s) untrack(() => soon(0)); });

  function toggle(kind, v) { if (held) { held = false; return; } q = ''; const a = pick[kind]; pick[kind] = a.includes(v) ? a.filter((x) => x !== v) : [...a, v]; }
  function heart(kind, v) {
    const a = fav[kind], on = !a.includes(v);
    fav[kind] = on ? [...a, v] : a.filter((x) => x !== v);
    if (on && !pick[kind].includes(v)) pick[kind] = [...pick[kind], v];
    navigator.vibrate?.(15);
    toast(on ? `♥ ${v} saved as a favorite` : `${v} removed from favorites`);
    saveSettings(kind === 'cuisines' ? { cuisines: fav.cuisines } : { mealTypes: fav.types }).catch(() => {});
  }
  // long press
  let timer = 0, held = false;
  const down = (kind, v) => { held = false; clearTimeout(timer); timer = setTimeout(() => { held = true; heart(kind, v); }, 500); };
  const up = () => clearTimeout(timer);

  async function addIdea(i) {
    busy = i.id; err = '';
    try { const m = await mealDetail(i.id); const [r] = await importRecipes([fromMealDb(m)], 'mdb'); added[i.id] = true; toast(`✓ ${r.title} saved${warnFor(r)}`); onadd?.(r); }
    catch (e) { err = e.message; }
    busy = '';
  }
  async function addLink(url) {
    busy = url; err = '';
    try { const [r] = await importRecipeUrl(url); added[url] = true; link = ''; toast(`✓ ${r.title} saved${warnFor(r)}`); onadd?.(r); }
    catch (e) { err = e.message; }
    busy = '';
  }
</script>

{#snippet chip(kind, v)}
  <button class="chip" class:on={pick[kind].includes(v) && !q}
    onpointerdown={() => down(kind, v)} onpointerup={up} onpointerleave={up} oncontextmenu={(e) => e.preventDefault()}
    onclick={() => toggle(kind, v)}>{fav[kind].includes(v) ? '♥ ' : ''}{v}</button>
{/snippet}

<div class="card">
  <div class="spread"><h3 style="margin:0">Find recipes</h3>{#if onclose}<button class="quiet" onclick={onclose}>Done</button>{/if}</div>
  {#if err}<div class="err">⚠️ {err}</div>{/if}
  <p class="small muted" style="margin:8px 0 4px">Pick as many as you like · press and hold to ♥ a favorite</p>
  <p class="small" style="margin:6px 0 4px"><b>Cuisine</b></p>
  <div class="chips">{#each CUISINES as [c]}{@render chip('cuisines', c)}{/each}</div>
  <p class="small" style="margin:10px 0 4px"><b>Meal type</b></p>
  <div class="chips">{#each MEAL_TYPES as [t]}{@render chip('types', t)}{/each}</div>

  <form class="row" style="margin-top:10px;gap:6px" onsubmit={(e) => { e.preventDefault(); clearTimeout(wait); look(); }}>
    <input type="search" enterkeyhint="search" placeholder="Search by dish or ingredient: tacos, salmon, curry…" bind:value={q} style="flex:1;min-width:160px" />
    <button disabled={!q.trim() || busy === 'look'}>{#if busy === 'look'}<span class="spinner"></span>{/if} Search</button>
  </form>
  <form class="row" style="margin-top:6px;gap:6px" onsubmit={(e) => { e.preventDefault(); if (link.trim()) addLink(link.trim()); }}>
    <input type="url" placeholder="Or paste a link to any recipe" bind:value={link} style="flex:1;min-width:160px" />
    <button class="ghost" disabled={!link.trim() || !!busy}>{#if busy === link.trim()}<span class="spinner"></span>{/if} Save</button>
  </form>
  {#if onbm}<p class="small" style="margin:6px 0 0"><button class="quiet" onclick={onbm}>Bring in a full week of meals →</button></p>{/if}

  {#if busy === 'look'}<p class="small muted" style="margin:8px 0 0"><span class="spinner"></span> Looking…</p>{:else if q.trim() && ideas.length}<p class="small muted" style="margin:8px 0 0">{ideas.length} recipe{ideas.length === 1 ? '' : 's'} for “{q.trim()}”</p>{/if}
  <div class="ideas">
    {#each ideas.slice(0, 24) as i, n (i.id)}
      {#if n === 4}<div style="grid-column:1/-1"><AdSlot slot="find-recipes" format="native" /></div>{/if}
      <div class="idea">
        <img src={i.thumb + '/preview'} alt="" loading="lazy" />
        <div style="flex:1;min-width:0"><b class="small">{i.title}</b>{#if i.area}<div class="small muted">{i.area}</div>{/if}</div>
        {#if added[i.id] || have(i.title)}<span class="small muted">✓ Saved</span>
        {:else}<button class="ghost" style="padding:6px 10px" onclick={() => addIdea(i)} disabled={!!busy} aria-label="Save recipe">{#if busy === i.id}<span class="spinner"></span>{:else}+{/if}</button>{/if}
      </div>
    {/each}
    {#if sites.length || sitesBusy}<p class="small muted" style="grid-column:1/-1;margin:6px 0 0">From recipe websites {#if sitesBusy}<span class="spinner"></span>{/if}</p>{/if}
    {#each sites as s (s.url)}
      <div class="idea">
        <div class="noimg">🍽️</div>
        <div style="flex:1;min-width:0"><b class="small">{s.title}</b></div>
        {#if added[s.url] || have(s.title)}<span class="small muted">✓ Saved</span>
        {:else}<button class="ghost" style="padding:6px 10px" onclick={() => addLink(s.url)} disabled={!!busy} aria-label="Save recipe">{#if busy === s.url}<span class="spinner"></span>{:else}+{/if}</button>{/if}
      </div>
    {/each}
  </div>
  {#if ideas.length > 12}<AdSlot slot="find-recipes-end" format="rect" />{/if}
  <p class="small muted" style="margin-top:8px">Tap + to save a recipe to your Saved recipes, with its shopping items.</p>
</div>

<style>
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chips :global(.chip) { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  .ideas { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 6px; margin-top: 10px; }
  .idea { display: flex; align-items: center; gap: 8px; padding: 6px; border: 1px solid var(--line, #e5e7eb); border-radius: 10px; margin-bottom: 4px; }
  .idea img, .noimg { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; flex: none; }
  .noimg { display: grid; place-items: center; background: var(--accent-soft, #f4efe8); font-size: 22px; }
</style>

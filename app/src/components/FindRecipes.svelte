<script>
  import { untrack } from 'svelte';
  import { app, saveSettings, importRecipes, importRecipeUrl, callProxy, toast } from '../lib/db.svelte.js';
  import { CUISINES, MEAL_TYPES, findIdeas, mealDetail, fromMealDb } from '../lib/discover.js';
  import { conflicts, conflictText, prefsOf } from '../lib/diet.js';
  import AdSlot from './AdSlot.svelte';
  import MealFacts from './MealFacts.svelte';
  import { correct, learn, loadIngredients } from '../lib/fuzzy.js';
  learn([...app.items.map((i) => i.name), ...app.recipes.map((r) => r.title)]); loadIngredients();
  let fixedQ = $state(''), exact = false;   // the corrected search, when typos were fixed
  const warnFor = (r) => { const c = conflicts(r, prefsOf(app.settings)); return c.any ? ` — heads up: ${conflictText(c)}` : ''; };
  // onadd(recipe) — called for each recipe added (e.g. to drop it into a week); onbm — open the Bare Minimum weeks
  let { onadd = null, onbm = null, onclose = null, initial = '' } = $props();

  // tap = pick (tap again to unpick); press and hold = ♥ favorite (saved, and suggestions lean toward it)
  let fav = $state({ cuisines: [...(app.settings.cuisines || [])], types: [...(app.settings.mealTypes || [])] });
  let pick = $state({ cuisines: untrack(() => [...fav.cuisines]), types: untrack(() => (app.settings.diets || []).includes('Vegan') ? ['Vegan'] : (app.settings.diets || []).includes('Vegetarian') ? ['Vegetarian'] : []) });
  let q = $state(untrack(() => initial)), link = $state('');
  let ideas = $state([]), sites = $state([]), busy = $state(''), err = $state(''), added = $state({});

  const have = (title) => app.recipes.some((r) => r.title.toLowerCase() === String(title).toLowerCase());
  // what a search found: 'exact' (titles with every word), 'similar' (only related dishes), or 'none'
  let status = $state(null), mine = $state([]);
  const wordsOf = (t) => String(t).toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !/^(and|with|the|for|easy|best|recipe|recipes|homemade|simple|quick)$/.test(w)).map((w) => w.replace(/ies$/, 'y').replace(/([^s])s$/, '$1'));
  const hasAll = (title, ws) => ws.length > 0 && ws.every((w) => String(title).toLowerCase().includes(w));

  // each shown idea's ingredients (fetched once, cached) → hide ones that clash with the household's diets/allergies
  let details = $state({}), showAll = $state(false);
  const prefs = $derived(prefsOf(app.settings));
  const strict = $derived(prefs.diets.length + prefs.allergies.length + prefs.avoid.length > 0);
  $effect(() => {
    const want = ideas.slice(0, 90).filter((i) => !(i.id in untrack(() => details)));
    if (!want.length) return;
    let n = 0;
    const next = async () => { while (n < want.length) { const i = want[n++]; try { const r = fromMealDb(await mealDetail(i.id)).recipes[0]; details[i.id] = { title: r.title, ing: r.ing, servings: r.servings || 4 }; } catch { details[i.id] = null; } } };
    Promise.all([next(), next(), next(), next(), next(), next()]);   // six at a time
  });
  const clashes = (i) => details[i.id] && conflicts(details[i.id], prefs).any;
  let shown = $derived(ideas.slice(0, 90).filter((i) => showAll || !strict || !clashes(i)).slice(0, 24));
  let hidden = $derived(strict && !showAll ? ideas.slice(0, 90).filter(clashes).length : 0);
  // only the newest search gets to show its results; earlier ones that finish late are ignored
  let seq = 0, wait = 0, sitesBusy = $state(false);
  async function look() {
    const my = ++seq, s = q.trim();
    err = ''; busy = 'look'; status = null;
    if (s) { sites = []; sitesBusy = true; callProxy({ action: 'recipe-search', q: s }).then((r) => { if (my === seq) sites = r.results || []; }).catch(() => {}).finally(() => { if (my === seq) sitesBusy = false; }); }
    else { sites = []; sitesBusy = false; }
    try {
      let found = await findIdeas({ cuisines: s ? [] : pick.cuisines, types: s ? [] : pick.types, search: s });
      // typos: "chiken tika" → also search "chicken tikka", best of both
      fixedQ = '';
      const c = s && !exact ? correct(s) : null;
      if (c?.changed) {
        const more = await findIdeas({ search: c.text });
        if (more.length > found.length) { found = [...more, ...found.filter((x) => !more.some((y) => y.id === x.id))]; fixedQ = c.text; }
      }
      exact = false;
      if (my !== seq) return;
      const ws = wordsOf(fixedQ || s);
      const exactOnes = s ? found.filter((i) => hasAll(i.title, ws)) : found;
      ideas = s ? [...exactOnes, ...found.filter((i) => !exactOnes.includes(i))] : found;
      // your own saved recipes that match: best matches first
      mine = s ? app.recipes.filter((r) => ws.some((w) => r.title.toLowerCase().includes(w))).sort((a, b) => hasAll(b.title, ws) - hasAll(a.title, ws)).slice(0, 6) : [];
      status = !s ? (found.length ? null : { kind: 'mix' }) : exactOnes.length ? { kind: 'exact', n: exactOnes.length } : found.length ? { kind: 'similar' } : { kind: 'none' };
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

  {#if busy === 'look'}<p class="small muted" style="margin:8px 0 0"><span class="spinner"></span> Looking{q.trim() ? ` for “${q.trim()}”` : ''}…</p>
  {:else if status?.kind === 'exact'}
    {#if fixedQ}<p class="small" style="margin:8px 0 0">Showing recipes for <b>“{fixedQ}”</b> · <button class="quiet" style="padding:0" onclick={() => { exact = true; look(); }}>search for “{q.trim()}” instead</button></p>
    {:else}<p class="small muted" style="margin:8px 0 0">{status.n} recipe{status.n === 1 ? '' : 's'} for “{q.trim()}”{ideas.length > status.n ? ', then similar ones' : ''}</p>{/if}
  {:else if status?.kind === 'similar'}<div class="note">No recipes called <b>“{fixedQ || q.trim()}”</b> in our collection. Here are similar recipes{mine.length ? ', plus matches from your own recipes' : ''}.</div>
  {:else if status?.kind === 'none'}<div class="note">{#if mine.length}No new recipes found for <b>“{q.trim()}”</b>, but you already have these.{:else}We couldn't find any recipes for <b>“{q.trim()}”</b>. Try a single ingredient (like “chicken”), check the spelling, or paste a link to a recipe above.{/if}{#if sitesBusy} Still checking recipe websites…{/if}</div>
  {:else if status?.kind === 'mix'}<div class="note">Nothing matches that mix. Try unpicking a cuisine or meal type.</div>{/if}
  <div class="ideas">
    {#if mine.length && busy !== 'look'}<p class="small muted" style="grid-column:1/-1;margin:6px 0 0">In your recipes</p>
      {#each mine as r (r.id)}
        <div class="idea">
          {#if r.image}<img src={r.image} alt="" loading="lazy" />{:else}<div class="noimg">🍽️</div>{/if}
          <div style="flex:1;min-width:0"><b class="small">{r.title}</b><div class="small muted">Already saved</div></div>
          {#if onadd}<button class="ghost" style="padding:6px 10px" onclick={() => onadd(r)}>Use</button>{:else}<span class="small muted">✓ Saved</span>{/if}
        </div>
      {/each}
      {#if ideas.length}<p class="small muted" style="grid-column:1/-1;margin:6px 0 0">{status?.kind === 'exact' ? 'More recipes' : 'Similar recipes'}</p>{/if}
    {/if}
    {#if hidden}<p class="small muted" style="grid-column:1/-1;margin:0">Hiding {hidden} that don’t fit your diets or allergies · <button class="quiet" style="padding:0" onclick={() => (showAll = true)}>Show them</button></p>
    {:else if showAll && strict}<p class="small muted" style="grid-column:1/-1;margin:0">Showing everything · <button class="quiet" style="padding:0" onclick={() => (showAll = false)}>Hide ones that don’t fit</button></p>{/if}
    {#each shown as i, n (i.id)}
      {#if n === 4}<div style="grid-column:1/-1"><AdSlot slot="find-recipes" format="native" /></div>{/if}
      <div class="idea">
        <img src={i.thumb + '/preview'} alt="" loading="lazy" />
        <div style="flex:1;min-width:0"><b class="small">{i.title}</b>{#if i.area}<div class="small muted">{i.area}</div>{/if}{#if details[i.id]}<MealFacts r={details[i.id]} compact />{/if}</div>
        {#if added[i.id] || have(i.title)}<span class="small muted">✓ Saved</span>
        {:else}<button class="ghost" style="padding:6px 10px" onclick={() => addIdea(i)} disabled={!!busy} aria-label="Save recipe">{#if busy === i.id}<span class="spinner"></span>{:else}+{/if}</button>{/if}
      </div>
    {/each}
    {#if sites.length || sitesBusy}<p class="small muted" style="grid-column:1/-1;margin:6px 0 0">From recipe websites {#if sitesBusy}<span class="spinner"></span>{/if}</p>
    {:else if q.trim() && status && busy !== 'look'}<p class="small muted" style="grid-column:1/-1;margin:6px 0 0">No matches on recipe websites.</p>{/if}
    {#each sites as s (s.url)}
      <div class="idea">
        <div class="noimg">🍽️</div>
        <div style="flex:1;min-width:0"><b class="small">{s.title}</b></div>
        {#if added[s.url] || have(s.title)}<span class="small muted">✓ Saved</span>
        {:else}<button class="ghost" style="padding:6px 10px" onclick={() => addLink(s.url)} disabled={!!busy} aria-label="Save recipe">{#if busy === s.url}<span class="spinner"></span>{:else}+{/if}</button>{/if}
      </div>
    {/each}
  </div>
  {#if shown.length > 12}<AdSlot slot="find-recipes-end" format="rect" />{/if}
  <p class="small muted" style="margin-top:8px">Tap + to save a recipe to your Saved recipes, with its shopping items.</p>
</div>

<style>
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .note { background: var(--accent-soft); color: var(--accent-dark); border-radius: 10px; padding: 9px 12px; margin: 8px 0 0; font-size: 14px; }
  .chips :global(.chip) { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  .ideas { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 6px; margin-top: 10px; }
  .idea { display: flex; align-items: center; gap: 8px; padding: 6px; border: 1px solid var(--line, #e5e7eb); border-radius: 10px; margin-bottom: 4px; }
  .idea img, .noimg { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; flex: none; }
  .noimg { display: grid; place-items: center; background: var(--accent-soft, #f4efe8); font-size: 22px; }
</style>

<script>
  import Hello from '../components/Hello.svelte';
  import Dish from '../components/Dish.svelte';
  import AdSlot from '../components/AdSlot.svelte';
  import { conflicts, prefsOf } from '../lib/diet.js';
  import MealFacts from '../components/MealFacts.svelte';
  import RecipeFlow from '../components/RecipeFlow.svelte';
  import { saveSettings } from '../lib/db.svelte.js';
  import { nutritionOf } from '../lib/nutrition.js';
  import { suggest } from '../lib/fuzzy.js';
  const prefs = $derived(prefsOf(app.settings));
  import { app, portions, itemById, setRecipeActive, saveRecipe, deleteRecipe, importRecipeUrl, toast } from '../lib/db.svelte.js';
  import FindRecipes from '../components/FindRecipes.svelte';
  import Onboarding from '../components/Onboarding.svelte';
  let starter = $state(false);
  // two views: your saved recipes, and finding new ones
  let view = $state((() => { try { return sessionStorage.getItem('mp-rec-view') || 'mine'; } catch { return 'mine'; } })());
  let findQ = $state('');
  const setView = (v) => { view = v; finding = false; try { sessionStorage.setItem('mp-rec-view', v); } catch {} };
  let { go } = $props();
  import { ui } from '../lib/ui.svelte.js';
  $effect(() => { const a = ui.act; if (a === 'recipe') { ui.act = ''; setView('mine'); adding = true; window.scrollTo(0, 0); } else if (a === 'find') { ui.act = ''; setView('find'); } else if (a === 'write') { ui.act = ''; edit(null); window.scrollTo(0, 0); } });
  let adding = $state(false), link = $state(''), linkBusy = $state(false), linkErr = $state(''), finding = $state(false);
  async function fromLink(e) { e.preventDefault(); linkBusy = true; linkErr = ''; try { const [r] = await importRecipeUrl(link.trim()); link = ''; adding = false; open = r.id; toast(`✓ ${r.title} saved`); } catch (x) { linkErr = x.message; } linkBusy = false; }
  let est = $derived(editing ? nutritionOf({ ing: editing.ingText.split('\n').filter(Boolean), servings: Number(editing.servings) || 4 }) : null);
  let open = $state(null), editing = $state(null), busy = $state(false), q = $state('');
  let por = $derived(portions());
  let near = $derived(q.trim().length > 2 ? new Set(suggest(q, app.recipes.map((r) => r.title), 30)) : new Set());
  // filters: ingredients it must include, cuisine, favorites; and how to sort
  let ingWant = $state([]), ingTyped = $state(''), cuisine = $state(''), favOnly = $state(false), sortBy = $state('new');
  const favs = $derived(new Set(app.settings.favRecipes || []));
  function toggleFav(r) { const f = new Set(favs); f.has(r.id) ? f.delete(r.id) : f.add(r.id); saveSettings({ favRecipes: [...f] }).catch((e) => toast(e.message)); }
  function addIng(e) { e?.preventDefault(); const w = ingTyped.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean); ingWant = [...new Set([...ingWant, ...w])]; ingTyped = ''; }
  const hasIng = (r, w) => { const sing = w.replace(/ies$/, 'y').replace(/([^s])s$/, '$1'); return r.ing.some((x) => x.toLowerCase().includes(sing)) || Object.keys(r.items).some((id) => (itemById(id)?.name || '').toLowerCase().includes(sing)); };
  const cuisines = $derived([...new Set(app.recipes.map((r) => r.cuisine).filter(Boolean))].sort());
  const filtering = $derived(!!(ingWant.length || cuisine || favOnly));
  const SORTS = { new: (a, b) => (b.active - a.active) || String(b.createdAt).localeCompare(String(a.createdAt)), az: (a, b) => a.title.localeCompare(b.title),
    fav: (a, b) => (favs.has(b.id) - favs.has(a.id)) || a.title.localeCompare(b.title), cal: (a, b) => ((nutritionOf(a)?.kcal ?? 1e9) - (nutritionOf(b)?.kcal ?? 1e9)),
    protein: (a, b) => ((nutritionOf(b)?.protein ?? -1) - (nutritionOf(a)?.protein ?? -1)) };
  let list = $derived(app.recipes.filter((r) => (!q || r.title.toLowerCase().includes(q.toLowerCase()) || near.has(r.title))
    && ingWant.every((w) => hasIng(r, w)) && (!cuisine || r.cuisine === cuisine) && (!favOnly || favs.has(r.id))).slice().sort(SORTS[sortBy]));
  const blank = () => ({ id: '', title: '', when: 'Lunch/Dinner', servings: 4, yield: '', fridge: '', freeze: '', ingText: '', stepsText: '', tip: '', items: [], newItems: [] });

  function edit(r) {
    editing = r ? { ...r, nkcal: r.nutrition?.kcal ?? '', nprotein: r.nutrition?.protein ?? '', ncarbs: r.nutrition?.carbs ?? '', nfat: r.nutrition?.fat ?? '', ingText: r.ing.join('\n'), stepsText: r.steps.join('\n'), items: Object.entries(r.items).map(([id, u]) => ({ id, units: u })), newItems: [] } : blank();
    open = null;
  }
  async function save() {
    const e = editing; if (!e.title.trim()) { toast('Give it a name'); return; }
    busy = true;
    try {
      const items = Object.fromEntries(e.items.filter((x) => x.id).map((x) => [x.id, Number(x.units) || 1]));
      const id = await saveRecipe({ id: e.id || '', title: e.title.trim(), when: e.when, servings: Number(e.servings) || null, yield: e.yield, fridge: e.fridge, freeze: e.freeze,
        ing: e.ingText.split('\n').map((s) => s.trim()).filter(Boolean), steps: e.stepsText.split('\n').map((s) => s.trim()).filter(Boolean), tip: e.tip,
        custom: e.custom ?? true, active: e.active ?? true, source: e.source || '', items,
        nutrition: ['nkcal', 'nprotein', 'ncarbs', 'nfat'].some((k) => Number(e[k]) > 0) ? { kcal: Number(e.nkcal) || null, protein: Number(e.nprotein) || null, carbs: Number(e.ncarbs) || null, fat: Number(e.nfat) || null } : null }, e.newItems.filter((n) => n.name.trim()));
      editing = null; open = id; toast('✓ Saved');
    } catch (err) { toast(err.message); }
    busy = false;
  }
  async function remove(r) { if (!confirm(`Delete "${r.title}"?`)) return; try { await deleteRecipe(r.id); open = null; } catch (e) { toast(e.message); } }
</script>

<div class="page">
  <Hello page="recipes" />
  {#if editing}
    <h1>{editing.id ? 'Edit recipe' : 'New recipe'}</h1>
    <div class="card">
      <label class="f">Name<input bind:value={editing.title} /></label>
      <div class="grid2">
        <label class="f">Meal<select bind:value={editing.when}><option>Breakfast</option><option>Lunch/Dinner</option><option>Snack/Dessert</option></select></label>
        <label class="f">Makes (servings)<input type="number" min="1" bind:value={editing.servings} /></label>
        <label class="f">Fridge<input bind:value={editing.fridge} placeholder="4 days" /></label>
        <label class="f">Freezer<input bind:value={editing.freeze} placeholder="Up to 2 months" /></label>
      </div>
      <label class="f">Ingredients (one per line)<textarea bind:value={editing.ingText}></textarea></label>
      <label class="f">Steps (one per line)<textarea bind:value={editing.stepsText}></textarea></label>
      <label class="f">Tip<input bind:value={editing.tip} /></label>
      <p class="small" style="margin:10px 0 2px"><b>Nutrition per serving</b> <span class="muted">— leave blank to use the estimate{est?.ok ? ` (${est.kcal} cal, ${est.protein} g protein, ${est.carbs} g carbs, ${est.fat} g fat)` : ''}</span></p>
      <div class="grid4">
        <label class="f">Calories<input type="number" min="0" inputmode="numeric" bind:value={editing.nkcal} placeholder={est?.ok ? String(est.kcal) : ''} /></label>
        <label class="f">Protein (g)<input type="number" min="0" inputmode="numeric" bind:value={editing.nprotein} placeholder={est?.ok ? String(est.protein) : ''} /></label>
        <label class="f">Carbs (g)<input type="number" min="0" inputmode="numeric" bind:value={editing.ncarbs} placeholder={est?.ok ? String(est.carbs) : ''} /></label>
        <label class="f">Fat (g)<input type="number" min="0" inputmode="numeric" bind:value={editing.nfat} placeholder={est?.ok ? String(est.fat) : ''} /></label>
      </div>
    </div>
    <div class="card">
      <h3>What to buy for it</h3>
      <p class="small muted">Pick items already on your list (units = store packages for one batch), or add new ones.</p>
      {#each editing.items as x, i}
        <div class="row" style="margin:6px 0"><select class="grow" bind:value={x.id}><option value="">Choose…</option>{#each app.items.slice().sort((a, b) => a.name.localeCompare(b.name)) as it}<option value={it.id}>{it.name}</option>{/each}</select>
          <input type="number" step="0.25" min="0" bind:value={x.units} style="width:80px" /><button class="quiet" onclick={() => editing.items.splice(i, 1)}>✕</button></div>
      {/each}
      {#each editing.newItems as n, i}
        <div class="row" style="margin:6px 0"><input class="grow" placeholder="New item, e.g. Ground turkey" bind:value={n.name} />
          <select bind:value={n.cat} style="width:120px"><option>Produce</option><option>Meat</option><option>Dairy & Eggs</option><option>Frozen</option><option>Bakery</option><option>Pantry</option></select>
          <input type="number" step="0.25" min="0" bind:value={n.units} style="width:70px" /><button class="quiet" onclick={() => editing.newItems.splice(i, 1)}>✕</button></div>
      {/each}
      <div class="row"><button class="ghost" onclick={() => editing.items.push({ id: '', units: 1 })}>+ Item from my list</button><button class="ghost" onclick={() => editing.newItems.push({ name: '', cat: 'Produce', units: 1 })}>+ New item</button></div>
    </div>
    <div class="row"><button onclick={save} disabled={busy}>{#if busy}<span class="spinner"></span>{/if} Save recipe</button><button class="ghost" onclick={() => (editing = null)}>Cancel</button></div>
  {:else}
    <div class="spread"><h1>Recipes</h1></div>
    <div class="seg" style="margin:0 0 10px">
      <button class:on={view === 'mine'} onclick={() => setView('mine')}>📖 My recipes ({app.recipes.length})</button>
      <button class:on={view === 'find'} onclick={() => setView('find')}>🔎 Find new</button>
    </div>
    {#if view === 'find'}<FindRecipes initial={findQ} />{:else}
    {#if adding}
      <div class="card nocollapse">
        <div class="spread"><h3 style="margin:0 0 8px">Add a recipe</h3><button class="quiet" aria-label="Close" onclick={() => (adding = false)}>✕</button></div>
        <form class="row" onsubmit={fromLink}>
          <input class="grow" type="url" bind:value={link} placeholder="Paste a link to a recipe" required />
          <button disabled={linkBusy || !link.trim()}>{#if linkBusy}<span class="spinner"></span>{/if} Save from link</button>
        </form>
        {#if linkErr}<div class="err small">⚠️ {linkErr}</div>{/if}
        <p class="small muted" style="margin:8px 0">The app pulls in the ingredients, steps and shopping items for you.</p>
        <div class="row"><button class="ghost" onclick={() => { adding = false; edit(null); }}>✏️ Type one in</button><button class="ghost" onclick={() => { adding = false; setView('find'); }}>🔎 Find recipes</button><button class="ghost" onclick={() => { adding = false; starter = true; }}>✨ 15 meals from my favorite cuisines</button></div>
      </div>
    {/if}
    {#if finding}<FindRecipes onclose={() => (finding = false)} />{/if}
    {#if starter}<Onboarding {go} onclose={() => (starter = false)} />{/if}
    <input placeholder="Search saved recipes" bind:value={q} style="margin:6px 0" />
    <div class="filters">
      <form class="ingf" onsubmit={addIng}><input placeholder="🥕 Ingredients" aria-label="Recipes with these ingredients, like chicken, rice" bind:value={ingTyped} enterkeyhint="search" onblur={() => ingTyped.trim() && addIng()} /></form>
      <select bind:value={cuisine} aria-label="Cuisine"><option value="">Cuisine</option>{#each cuisines as c}<option value={c}>{c}</option>{/each}</select>
      <select bind:value={sortBy} aria-label="Sort"><option value="new">Newest</option><option value="az">A–Z</option><option value="fav">♥ first</option><option value="cal">Fewest cal</option><option value="protein">Most protein</option></select>
      <button class="chip favf" class:on={favOnly} aria-label="Favorites only" onclick={() => (favOnly = !favOnly)}>♥{favs.size ? ` ${favs.size}` : ''}</button>
    </div>
    {#if ingWant.length || filtering}
      <div class="row" style="gap:4px;margin:0 0 6px;align-items:center">
        {#each ingWant as w}<button class="chip on" onclick={() => (ingWant = ingWant.filter((x) => x !== w))} aria-label="Remove {w}">{w} ✕</button>{/each}
        <span class="small muted">{list.length} of {app.recipes.length} recipes</span>
        <button class="quiet small" onclick={() => { ingWant = []; cuisine = ''; favOnly = false; }}>Clear filters</button>
      </div>
    {/if}
    <div class="card">
      {#each list as r, ri}
        {#if ri === 3 || ri === 12}<AdSlot slot="recipes-list" format="native" />{/if}
        <div class="list-row">
          <button class="quiet grow" style="text-align:left;justify-content:flex-start;color:var(--ink);padding:0;display:flex;gap:10px;align-items:center" onclick={() => (open = open === r.id ? null : r.id)}>
            <Dish {r} size={52} />
            <span class="grow"><b>{r.title}</b><br><span class="small muted">{r.when}{r.cuisine ? ` · ${r.cuisine}` : ''} · makes {r.servings || '?'}{por[r.id] ? ` · this week ${por[r.id].portions} portions (${por[r.id].scale}×)` : ''}</span>
              <br><MealFacts {r} compact /></span>
          </button>
          <button class="quiet fav" class:on={favs.has(r.id)} onclick={() => toggleFav(r)} aria-label={favs.has(r.id) ? `Unfavorite ${r.title}` : `Favorite ${r.title}`} aria-pressed={favs.has(r.id)}>{favs.has(r.id) ? '♥' : '♡'}</button>
          <label class="switch" title="Shop for this recipe"><input type="checkbox" checked={r.active} onchange={(e) => setRecipeActive(r.id, e.currentTarget.checked).catch((er) => toast(er.message))} /><span></span></label>
        </div>
        {#if open === r.id}
          <div style="padding:4px 0 14px">
            <MealFacts {r} />
            {#if r.tip}<p class="small muted">{r.tip}</p>{/if}
            {#if r.steps.length}<div class="seg" style="margin:8px 0"><button class:on={app.settings.recipeView !== 'flow'} onclick={() => saveSettings({ recipeView: 'list' })}>☰ List</button><button class:on={app.settings.recipeView === 'flow'} onclick={() => saveSettings({ recipeView: 'flow' })}>🔀 Flow chart</button></div>{/if}
            {#if app.settings.recipeView === 'flow' && r.steps.length}<RecipeFlow {r} />
            {:else}
            <h3>Ingredients</h3><ul class="small">{#each r.ing as x}<li>{x}</li>{/each}</ul>
            {#if r.steps.length}<h3>Steps</h3><ol class="small">{#each r.steps as x}<li>{x}</li>{/each}</ol>{/if}
            {/if}
            <p class="small muted">{#if r.fridge}Fridge: {r.fridge}. {/if}{#if r.freeze}Freezer: {r.freeze}.{/if}</p>
            <p class="small"><b>Shopping:</b> {Object.entries(r.items).map(([id, u]) => `${itemById(id)?.name || id}${u !== 1 ? ` ×${u}` : ''}`).join(', ') || 'none linked'}</p>
            <div class="row">{#if r.source}<a class="small" href={r.source} target="_blank" rel="noopener">Original ↗</a>{/if}<button class="ghost" onclick={() => edit(r)}>Edit</button><button class="ghost" onclick={() => remove(r)}>Delete</button></div>
          </div>
        {/if}
      {:else}
        {#if q.trim()}<p class="small muted" style="margin:4px 0">No saved recipes match <b>“{q.trim()}”</b>.</p>
          <button class="ghost" onclick={() => { findQ = q.trim(); setView('find'); }}>🔎 Search for “{q.trim()}” in Find new</button>
        {:else if filtering}<p class="small muted" style="margin:4px 0">No saved recipes match these filters.</p>{#if ingWant.length}<button class="ghost" onclick={() => { findQ = ingWant.join(' '); setView('find'); }}>🔎 Find new recipes with {ingWant.join(', ')}</button>{/if}
        {:else}<p class="small muted" style="margin:4px 0">No saved recipes yet.</p>{/if}
      {/each}
    </div>
    {/if}
  {/if}
</div>

<style>
  .filters { display: flex; flex-wrap: nowrap; gap: 5px; margin: 0 0 8px; align-items: center; }
  .filters .ingf { flex: 1 1 0; min-width: 0; margin: 0; } .filters .ingf input { width: 100%; }
  .filters input, .filters select { font-size: 13.5px; padding: 7px 8px; height: 36px; }
  .filters select { width: auto; flex: 0 1 auto; min-width: 0; max-width: 30%; padding-right: 4px; }
  .filters .favf { flex: none; margin: 0; height: 36px; padding: 0 10px; }
  .fav { font-size: 22px; padding: 2px 8px; color: var(--muted); } .fav.on { color: #d93a5a; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  @media (max-width: 480px) { .grid4 { grid-template-columns: repeat(2, 1fr); } }
</style>

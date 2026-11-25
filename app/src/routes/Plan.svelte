<script>
  import AdSlot from '../components/AdSlot.svelte';
  import { app, saveSettings, itemById, recipeById, saveRecipe, cheapestPrice, savePlan, deletePlan, toast, owned, track, importRecipes } from '../lib/db.svelte.js';
  import { CUISINES, findIdeas, mealDetail, fromMealDb, findByIngredients } from '../lib/discover.js';
  import { pickMix, recipesNeeded, placeRecipes } from '../lib/mix.js';
  import { conflicts, prefsOf } from '../lib/diet.js';
  import { caloriesOf, nutritionOf } from '../lib/nutrition.js';
  import MealFacts from '../components/MealFacts.svelte';
  import Dish from '../components/Dish.svelte';
  const prefs = $derived(prefsOf(app.settings));
  const clash = (r) => conflicts(r, prefs);
  import { rankByPantry, daysLeft, matchItem } from '../lib/pantry.js';
  import { SIDES, SIDE_ITEMS, sideFor } from '../lib/sides.js';
  import Weeks from './Weeks.svelte';
  import Calendar from '../components/Calendar.svelte';
  import { ui } from '../lib/ui.svelte.js';
  import FindRecipes from '../components/FindRecipes.svelte';
  let finding = $state(false);
  import { trip, planTrip } from '../lib/trip.svelte.js';
  let { go } = $props();
  let focusWeek = $state('');   // a future week opened from the calendar

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
  const kind = (r) => { const w = String(r?.when || '').toLowerCase(); return /breakfast/.test(w) ? 'breakfast' : /snack|dessert|treat/.test(w) ? 'snack' : /side/.test(w) ? 'side' : 'main'; };
  const short = (r) => (r ? String(r.title).replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+with .*$/i, '').trim() : '');
  const weekOf = (r) => { const m = String(r.id).match(/^bm(\d\d)(\d\d)-/); return m ? `${['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[1]]} ${+m[2]} week` : r.custom ? 'yours' : 'Thanksgiving week'; };

  // the plan in one sentence: "Prep 2 meals for 5 people, Mon–Fri" (+ snack)
  const DEFAULT_MEALS = { 1: ['dinner'], 2: ['lunch', 'dinner'], 3: ['breakfast', 'lunch', 'dinner'] };
  let shape = $state({ meals: ['lunch', 'dinner'], snack: false, from: 0, to: 4, ...(app.plan.shape || app.settings.planShape || {}) });
  function autoFill(recipes, household) {
    household = Math.max(1, Number(household) || 1);
    const all = DAYS.map((d) => ({ day: d, people: household, breakfast: '', lunch: '', dinner: '', snack: '' }));
    // sides (rice, bread…) aren't placed on their own; they ride along with a main
    const g = { breakfast: [], snack: [], main: [], side: [] };
    recipes.forEach((r) => (g[kind(r)] || g.main).push(r));
    placeRecipes(all.slice(shape.from, shape.to + 1), g, shape.meals, shape.snack);
    return all;
  }
  function reshape(patch) {
    Object.assign(shape, patch);
    if (shape.to < shape.from) shape.to = shape.from;
    days = autoFill(picked, household); manual = false;
  }
  function setMealCount(n) { reshape({ meals: DEFAULT_MEALS[n] }); }
  function toggleMeal(m) { const has = shape.meals.includes(m); if (has && shape.meals.length === 1) return; reshape({ meals: has ? shape.meals.filter((x) => x !== m) : ['breakfast', 'lunch', 'dinner'].filter((x) => x === m || shape.meals.includes(x)) }); }
  const D3 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let goalOn = $state(!!app.settings.calorieGoal || !!app.settings.proteinGoal), goal = $state(app.settings.calorieGoal || 600), pGoal = $state(app.settings.proteinGoal || '');
  // does a main meal meet the goals? (unknown nutrition counts as meeting them, so it isn't left out)
  const meetsGoals = (r) => { if (!goalOn) return true; const n = nutritionOf(r); if (!n?.ok) return true; return (!+goal || n.kcal <= +goal * 1.15) && (!+pGoal || n.protein >= +pGoal); };
  const cal = (r) => caloriesOf(r);

  // working copy of the plan
  const onPlan = new Set(); (app.plan.days || []).forEach((d) => SLOTS.forEach((s) => d[s] && onPlan.add(d[s])));
  let sel = $state(Object.fromEntries(app.recipes.filter((r) => r.active || onPlan.has(r.id)).map((r) => [r.id, true])));
  let household = $state(Number(app.plan.household || app.settings.householdSize) || 3);
  let days = $state(app.plan.days?.length ? app.plan.days.map((d) => ({ ...d })) : autoFill(app.recipes.filter((r) => r.active), household));
  let msg = $state(''), err = $state(''), saving = $state(false);
  let pantry = $state(''), sourceUrl = $state('');

  let picked = $derived(app.recipes.filter((r) => sel[r.id]));
  let por = $derived.by(() => { const o = {}; days.forEach((d) => SLOTS.forEach((s) => d[s] && (o[d[s]] = (o[d[s]] || 0) + (Number(d.people) || 0)))); return o; });
  let similar = $derived.by(() => {
    const pool = new Set(); picked.forEach((r) => Object.keys(r.items).forEach((i) => pool.add(i)));
    app.items.forEach((i) => owned(i) && pool.add(i.id));
    return app.recipes.filter((r) => !sel[r.id] && Object.keys(r.items).length).map((r) => {
      const ids = Object.keys(r.items), shared = ids.filter((i) => pool.has(i));
      return { r, shared, total: ids.length, score: shared.length / ids.length + shared.length * 0.02 };
    }).sort((a, b) => b.score - a.score).slice(0, 10);
  });

  // recipes ranked by what's already in the pantry
  const priceOf = (id) => cheapestPrice(id);
  // Cook from the pantry: pick the items you want to use up; recipes are ranked by how many of them they use.
  let onHand = $derived(app.pantry.filter((p) => !['low', 'out'].includes(p.level)));
  // how many saved recipes each pantry item could anchor
  let mealsFor = $derived(Object.fromEntries(onHand.map((p) => [p.id, rankByPantry(app.recipes, [p], app.items, priceOf).filter((x) => x?.got?.length).length])));
  let pickedP = $state(null);   // null = not chosen yet → defaults to the use-soon items
  let chosen = $derived(pickedP ?? onHand.filter((p) => { const d = daysLeft(p.use_by); return d != null && d <= 3; }).map((p) => p.id));
  let chosenRows = $derived(onHand.filter((p) => chosen.includes(p.id)));
  const pickP = (id) => (pickedP = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  let pantryOrder = $derived([...onHand].sort((a, b) => (mealsFor[b.id] || 0) - (mealsFor[a.id] || 0) || (daysLeft(a.use_by) ?? 99) - (daysLeft(b.use_by) ?? 99)));
  let fromPantry = $derived(!app.pantry.length ? [] : chosenRows.length
    ? rankByPantry(app.recipes, chosenRows, app.items, priceOf).filter((x) => x.got.length).sort((a, b) => b.got.length - a.got.length || b.share - a.share).slice(0, 8)
    : rankByPantry(app.recipes, app.pantry, app.items, priceOf).slice(0, 8));
  let ideas = $state([]), ideasBusy = $state(''), ideasFor = $state('');
  async function findPantryIdeas() {
    ideasBusy = 'find'; ideas = [];
    try {
      const have = new Set(app.recipes.map((r) => r.title.toLowerCase()));
      ideas = (await findByIngredients(chosenRows.map((p) => p.name))).filter((m) => !have.has(m.title.toLowerCase())).slice(0, 10);
      ideasFor = chosenRows.map((p) => p.name).join(',');
      if (!ideas.length) toast('No new recipes found for those — try fewer or different items.');
      track('pantry_ideas', { items: chosenRows.length, found: ideas.length });
    } catch (e) { toast(e.message); }
    ideasBusy = '';
  }
  async function addIdea(m) {
    ideasBusy = m.id;
    try {
      const [r] = await importRecipes([fromMealDb(await mealDetail(m.id))], 'mdb');
      ideas = ideas.filter((x) => x.id !== m.id);
      if (r) { sel[r.id] = true; toast(`✓ Saved ${r.title} and added it to this week`); }
    } catch (e) { toast(e.message); }
    ideasBusy = '';
  }
  let useSoon = $derived(app.pantry.filter((p) => { const d = daysLeft(p.use_by); return d != null && d <= 3; }));
  let showPantry = $state(true);

  let slotPick = $state(null);   // { day, meal } being changed
  let manual = $state(!!app.plan.days?.length);   // you placed meals yourself (or a saved plan), so don't reshuffle them
  function toggle(id) {
    if (sel[id]) { delete sel[id]; days.forEach((d) => SLOTS.forEach((s) => d[s] === id && (d[s] = ''))); } else sel[id] = true;
    if (!manual) days = autoFill(picked, household);
    msg = '';
  }
  function setHousehold(v) { const nv = Math.max(1, Number(v) || 1); days.forEach((d) => { if (Number(d.people) === Number(household)) d.people = nv; }); household = nv; }
  // how to choose this week's recipes
  let how = $state(''), usePantry = $state(null), mixInfo = $state(null);
  let needN = $derived(recipesNeeded(shape));
  // Pick for me: cuisines for this week (starts from your favorites), then a mix from saved recipes —
  // and if those run short, new recipes in those cuisines are found and saved
  let autoCuisines = $state([...(app.settings.cuisines || [])]), topping = $state('');
  const areasOf = (cs) => cs.flatMap((c) => (CUISINES.find((x) => x[0] === c) || [c, [c]])[1]).map((a) => a.toLowerCase());
  const inCuisines = (r, cs) => !cs.length || areasOf(cs).some((a) => String(r.cuisine || '').toLowerCase() === a);
  // ---- Pick for me ----
  // A recipe can go in this week if it suits everyone's diets/allergies and (for lunch & dinner) the goals.
  const fitsUs = (x) => !clash(x).any && (kind(x) !== 'main' || meetsGoals(x));
  let keep = $state({});            // ♥ "keep this one" when repicking
  let lastShown = new Set();        // what the last pick showed, so "new options" really are new
  const MAIN_CATS = /dessert|side|starter|breakfast/i;
  // find, check and save new recipes of one kind until there are `want` of them (six lookups at a time)
  async function topUp(want, have, cs, avoid) {
    const missing = want - have.length; if (missing <= 0) return [];
    const veg = prefs.diets.includes('Vegan') ? ['Vegan'] : prefs.diets.includes('Vegetarian') ? ['Vegetarian', 'Vegan'] : [];
    const saved = new Set(app.recipes.map((r) => r.title.toLowerCase()));
    const out = [];
    // first the chosen cuisines, then (if still short) everything
    const rounds = kindFor === 'breakfast' ? [{ types: ['Breakfast'] }] : [{ cuisines: cs, types: veg }, ...(cs.length ? [{ cuisines: [], types: veg }] : [])];
    for (const q of rounds) {
      let ideas = (await findIdeas(q.cuisines?.length || q.types?.length ? q : { cuisines: ['American', 'Italian', 'Mexican', 'Chinese', 'Indian', 'Japanese', 'Thai', 'Mediterranean'] }))
        .filter((i) => !saved.has(i.title.toLowerCase()) && !avoid.has(i.title.toLowerCase()));
      let n = 0;
      const next = async () => {
        while (n < ideas.length && out.length < missing) {
          const i = ideas[n++];
          topping = `Finding ${missing - out.length} more recipe${missing - out.length === 1 ? '' : 's'} that fit${q.cuisines?.length ? '' : ' (any cuisine)'}…`;
          try {
            const m = await mealDetail(i.id);
            if (kindFor === 'main' && MAIN_CATS.test(m.strCategory)) continue;
            const parsed = fromMealDb(m), rec = parsed.recipes[0];
            const probe = { title: m.strMeal, ing: rec.ing, servings: rec.servings || 4, when: kindFor === 'main' ? 'Dinner' : 'Breakfast' };
            if (!fitsUs(probe) || out.length >= missing) continue;
            saved.add(m.strMeal.toLowerCase());
            const [r] = await importRecipes([parsed], 'mdb'); if (r) out.push(r);
          } catch { /* skip that one */ }
        }
      };
      await Promise.all([next(), next(), next(), next(), next(), next()]);
      if (out.length >= missing) break;
    }
    return out;
  }
  let kindFor = 'main';
  /** fresh: show different recipes than last time (except the ones kept with ♥) */
  async function pickForMe(fresh = false) {
    how = 'auto'; track('pick_for_me', { cuisines: autoCuisines.length, fresh, kept: Object.keys(keep).length }); err = '';
    try {
      const kept = Object.keys(keep).filter((id) => keep[id] && recipeById(id));
      const avoidIds = fresh ? new Set([...lastShown].filter((id) => !keep[id])) : new Set();
      const avoidTitles = new Set([...avoidIds].map((id) => recipeById(id)?.title.toLowerCase()).filter(Boolean));
      // saved recipes that fit; mains from the chosen cuisines
      let pool = app.recipes.filter((x) => fitsUs(x) && kind(x) !== 'side' && (kind(x) !== 'main' || inCuisines(x, autoCuisines)) && !avoidIds.has(x.id));
      // aim for extra choice (1.5× what's needed) so picks vary and repicks have somewhere to go
      for (const k of ['main', 'breakfast']) {
        if (!needN[k]) continue;
        kindFor = k;
        const have = pool.filter((x) => kind(x) === k);
        const want = Math.ceil(needN[k] * 1.5) + (fresh ? needN[k] : 0);
        pool = [...pool, ...(await topUp(want, have, autoCuisines, avoidTitles))];
        // still short: saved recipes from other cuisines that fit
        if (pool.filter((x) => kind(x) === k).length < needN[k]) pool = [...pool, ...app.recipes.filter((x) => kind(x) === k && fitsUs(x) && !pool.includes(x) && !avoidIds.has(x.id))];
      }
      // and if a fresh pick ran dry, allow last time's again rather than leave days empty
      if (fresh && pool.filter((x) => kind(x) === 'main').length < needN.main) pool = [...pool, ...app.recipes.filter((x) => avoidIds.has(x.id) && fitsUs(x))];
      topping = '';
      const recent = new Set(app.weeks.flatMap((w) => w.selected || []));
      const pantryIds = new Set((usePantry && chosenRows.length ? chosenRows : onHand).filter((p) => p.item_id).map((p) => p.item_id));
      const r = pickMix({ recipes: [...new Set([...kept.map(recipeById), ...pool])], need: needN, pantryIds, liked: autoCuisines, recent, usePantry: !!usePantry, keep: kept });
      sel = Object.fromEntries(r.ids.map((id) => [id, true]));
      lastShown = new Set(r.ids);
      days = autoFill(picked, household); manual = false;
      mixInfo = r;
      if (autoSides) { topping = 'Adding sides to light meals…'; await addSides(); topping = ''; }
    } catch (e) { err = e.message; topping = ''; }
  }
  // the week at a glance: average per day for one person, from the meals placed in the grid
  let weekN = $derived.by(() => {
    const ds = days.slice(shape.from, shape.to + 1), slots = [...shape.meals, ...(shape.snack ? ['snack'] : [])];
    let kcal = 0, protein = 0, carbs = 0, fat = 0, counted = 0, missing = 0, offGoal = 0, withFood = 0;
    for (const d of ds) {
      let any = false;
      for (const m of slots) {
        const r = d[m] ? recipeById(d[m]) : null; if (!r) continue;
        any = true; const n = nutritionOf(r);
        if (!n?.ok) { missing++; continue; }
        kcal += n.kcal; protein += n.protein; carbs += n.carbs; fat += n.fat; counted++;
        const sn = sideOf(d, m) && nutritionOf(sideOf(d, m)); if (sn?.ok) { kcal += sn.kcal; protein += sn.protein; carbs += sn.carbs; fat += sn.fat; }
        if (m !== 'snack' && m !== 'breakfast' && !meetsGoals(r)) offGoal++;
      }
      if (any) withFood++;
    }
    if (!counted || !withFood) return null;
    const per = (x) => Math.round(x / withFood);
    return { kcal: per(kcal), protein: per(protein), carbs: per(carbs), fat: per(fat), days: withFood, missing, offGoal };
  });
  // Light mains get a side (rice, bread, potatoes…) so lunch and dinner are a full meal
  let autoSides = $state(app.settings.autoSides !== false);
  const lightLimit = () => Math.max(450, goalOn && +goal ? +goal * 0.75 : 0);
  const isLight = (r) => { const n = nutritionOf(r); return n?.ok && n.kcal < lightLimit(); };
  async function ensureSide(key) {
    const def = SIDES[key];
    const have = app.recipes.find((r) => r.title === def.title);
    if (have) return have.id;
    const items = [], newItems = [];
    for (const [name, cat] of SIDE_ITEMS[key] || []) { const it = matchItem(name, app.items); if (it) items.push({ id: it.id, units: 1 }); else newItems.push({ name, cat, units: 1 }); }
    return saveRecipe({ ...def, custom: true, active: true, items: Object.fromEntries(items.map((x) => [x.id, x.units])) }, newItems);
  }
  async function addSides() {
    const made = {};
    for (const d of days) for (const m of ['lunch', 'dinner']) {
      const r = d[m] ? recipeById(d[m]) : null;
      if (!r || d[m + '_side'] || kind(r) !== 'main' || !isLight(r)) continue;
      const key = sideFor(r); if (!key) continue;
      try { d[m + '_side'] = made[key] ||= await ensureSide(key); } catch { /* leave it without a side */ }
    }
    days = [...days];
  }
  const sideOf = (d, m) => (d[m + '_side'] ? recipeById(d[m + '_side']) : null);
  function dropSide(d, m) { delete d[m + '_side']; days = [...days]; manual = true; }
  async function removePlan() {
    if (!confirm('Delete this week’s plan? Your saved recipes stay.')) return;
    saving = true; err = '';
    try { await deletePlan(); sel = {}; days = autoFill([], household); how = ''; mixInfo = null; trip.result = null; toast('Plan deleted'); } catch (e) { err = e.message; }
    saving = false;
  }
  async function save(startNew) {
    if (!picked.length) { err = 'Pick at least one recipe.'; return; }
    saving = true; err = '';
    try {
      await savePlan({ household, shape: $state.snapshot(shape), days: $state.snapshot(days), selected: Object.keys(sel), startNewWeek: startNew, pantry, sourceUrl });
      trip.result = null;
      track(startNew ? 'plan_start' : 'plan_draft', { recipes: picked.length, people: household });
      if (startNew) { go('trip'); planTrip(); } else toast('✓ Draft saved');
    } catch (e) { err = e.message; }
    saving = false;
  }
  const opts = (slot) => { const want = slot === 'breakfast' ? 'breakfast' : slot === 'snack' ? 'snack' : 'main'; return picked.slice().sort((a, b) => (kind(b) === want) - (kind(a) === want)); };
</script>

<div class="page">
  <div class="spread">
    <h1>Plan the week</h1>
    <div class="row" style="gap:6px">
      <button class="ghost iconbtn" title="Saved recipes" aria-label="Saved recipes" onclick={() => go('recipes')}>📖</button>
      <button class="ghost iconbtn" title="Plan ahead: next 6 weeks" aria-label="Plan ahead" onclick={() => { ui.calendar = !ui.calendar; focusWeek = ''; }}>📅<sup>+</sup></button>
    </div>
  </div>
  {#if ui.calendar && !focusWeek}
    <Calendar onpick={(start) => (focusWeek = start)} onthis={() => (ui.calendar = false)} onclose={() => (ui.calendar = false)} />
  {:else if ui.calendar && focusWeek}
    <button class="quiet" onclick={() => (focusWeek = '')}>← All 6 weeks</button>
    <Weeks {go} focus={focusWeek} showThisWeek={() => { ui.calendar = false; focusWeek = ''; }} />
  {:else}
  {#if err}<div class="err">⚠️ {err}</div>{/if}
  {#if msg}<div class="ok">{msg}</div>{/if}

  <div class="card">
    <h3 style="margin:0">Who's eating, and when</h3>
    <p class="sentence">
      Prep
      <select class="inl" value={shape.meals.length} onchange={(e) => setMealCount(+e.currentTarget.value)}>{#each [1, 2, 3] as n}<option value={n}>{n}</option>{/each}</select>
      meal{shape.meals.length === 1 ? '' : 's'} a day for
      <input class="inl" type="number" min="1" max={app.settings.audience === 'group' ? 500 : 20} value={household} onchange={(e) => { setHousehold(e.currentTarget.value); days = autoFill(picked, household); }} style="width:3.4em" />
      {household === 1 ? 'person' : 'people'},
      <select class="inl" value={shape.from} onchange={(e) => reshape({ from: +e.currentTarget.value })}>{#each D3 as d, i}<option value={i}>{d}</option>{/each}</select>–<select class="inl" value={shape.to} onchange={(e) => reshape({ to: +e.currentTarget.value })}>{#each D3 as d, i}{#if i >= shape.from}<option value={i}>{d}</option>{/if}{/each}</select>.
    </p>
    <div class="row" style="gap:4px;margin:4px 0 6px">
      {#each ['breakfast', 'lunch', 'dinner'] as m}<button class="chip" class:on={shape.meals.includes(m)} onclick={() => toggleMeal(m)}>{m[0].toUpperCase() + m.slice(1)}</button>{/each}
      <button class="chip" class:on={shape.snack} onclick={() => reshape({ snack: !shape.snack })}>{shape.snack ? '✓ Snack' : '+ Add a snack'}</button>
    </div>
    {#if !app.settings.calorieAsked && !goalOn}
      <p class="small" style="margin:6px 0">Want calorie or protein goals for each meal? <button class="quiet" onclick={() => (goalOn = true)}>Yes</button> <button class="quiet" onclick={() => saveSettings({ calorieAsked: true })}>No thanks</button></p>
    {:else if goalOn}
      <p class="sentence small" style="margin:6px 0">Aim for about <input class="inl" type="number" min="100" step="50" bind:value={goal} style="width:4.5em" onchange={() => saveSettings({ calorieGoal: +goal || null, calorieAsked: true })} /> calories and at least <input class="inl" type="number" min="0" step="5" bind:value={pGoal} placeholder="—" style="width:3.5em" onchange={() => saveSettings({ proteinGoal: +pGoal || null, calorieAsked: true })} /> g protein per meal. <span class="muted">Pick for me sticks to these.</span>
        <button class="quiet" onclick={() => { goalOn = false; pGoal = ''; saveSettings({ calorieGoal: null, proteinGoal: null, calorieAsked: true }); }}>Remove</button></p>
      {#if picked.length}<p class="small muted" style="margin:0 0 6px">{picked.filter(cal).length ? picked.filter(cal).map((r) => `${short(r)}: ${cal(r)} cal${nutritionOf(r)?.ok ? `, ${nutritionOf(r).protein} g protein` : ''} ${meetsGoals(r) ? '✓' : '↑'}`).join(' · ') : 'Recipes you save from a link show their calories here when the site lists them.'}</p>{/if}
    {/if}
  </div>

  <AdSlot slot="plan" format="banner" />
  <div class="card">
    <h3 style="margin:0">What's for dinner this week?</h3>
    <p class="small muted" style="margin:4px 0 8px">That's {needN.main} lunch/dinner recipe{needN.main === 1 ? '' : 's'}{needN.breakfast ? `, ${needN.breakfast} breakfast${needN.breakfast === 1 ? '' : 's'}` : ''}{needN.snack ? `, ${needN.snack} snack${needN.snack === 1 ? '' : 's'}` : ''} — each one cooked once and eaten up to twice.</p>
    {#if app.pantry.length}
      <p class="small" style="margin:0 0 8px">Cook from what's in your pantry first?
        <button class="chip" class:on={usePantry === true} onclick={() => { usePantry = true; if (how === 'auto') pickForMe(); }}>Yes</button>
        <button class="chip" class:on={usePantry === false} onclick={() => { usePantry = false; if (how === 'auto') pickForMe(); }}>No</button></p>
    {/if}
    <div class="row" style="gap:6px">
      <button class:ghost={how !== 'mine'} onclick={() => (how = 'mine')}>🔎 I'll pick</button>
      <button class:ghost={how !== 'auto'} onclick={() => pickForMe()}>✨ Pick for me</button>
    </div>
    {#if how === 'auto'}<label class="row small" style="gap:6px;margin:6px 0 0"><input type="checkbox" bind:checked={autoSides} onchange={() => saveSettings({ autoSides })} /> Add a side (rice, bread, potatoes…) to light lunches and dinners</label>{/if}

    {#if usePantry && onHand.length}
      <div class="pan-pick">
        <p class="small" style="margin:0 0 4px"><b>What do you want to use?</b> <span class="muted">The number is how many of your saved recipes each one goes in.</span></p>
        {#each pantryOrder as p (p.id)}{@const d = daysLeft(p.use_by)}
          <button class="chip" class:on={chosen.includes(p.id)} onclick={() => { pickP(p.id); if (how === 'auto') pickForMe(); }}>{chosen.includes(p.id) ? '✓ ' : ''}{p.name}{#if mealsFor[p.id]} <span class="cnt">{mealsFor[p.id]}</span>{/if}{#if d != null && d <= 3} <span class="soon">use soon</span>{/if}</button>
        {/each}
        <div class="row" style="margin-top:6px;gap:6px">
          <button class="ghost" onclick={findPantryIdeas} disabled={!chosenRows.length || ideasBusy === 'find'}>{#if ideasBusy === 'find'}<span class="spinner"></span>{/if} 🔎 New recipes using {chosenRows.length === 1 ? chosenRows[0].name : `these ${chosenRows.length || ''}`.trim()}</button>
          {#if chosen.length}<button class="quiet" onclick={() => (pickedP = [])}>Clear</button>{/if}
        </div>
        {#if ideas.length && ideasFor === chosenRows.map((p) => p.name).join(',')}
          <p class="small muted" style="margin:8px 0 4px">New ideas — tap + to save one and put it in this week</p>
          {#each ideas as m (m.id)}
            <div class="list-row" style="gap:8px">{#if m.thumb}<img src={m.thumb + '/preview'} alt="" width="40" height="40" style="border-radius:8px;object-fit:cover" />{/if}
              <div class="grow"><b class="small">{m.title}</b><div class="small muted">Uses {m.uses.join(', ')}</div></div>
              <button onclick={() => addIdea(m)} disabled={!!ideasBusy} aria-label="Save {m.title}">{#if ideasBusy === m.id}<span class="spinner"></span>{:else}+{/if}</button></div>
          {/each}
        {/if}
      </div>
    {/if}
    {#if usePantry && how === 'mine' && fromPantry.length}
      <p class="small muted" style="margin:10px 0 4px">{chosenRows.length ? `Your saved recipes with ${chosenRows.map((p) => p.name).join(', ')}` : 'Uses what you have'}{!chosenRows.length && useSoon.length ? ` — use soon: ${useSoon.map((p) => p.name).join(', ')}` : ''}</p>
      {#each fromPantry.slice(0, 5) as x}
        <div class="list-row"><div class="grow"><b class="small">{x.r.title}</b> <span class="pill" class:live={x.share >= 0.5}>{chosenRows.length ? `uses ${x.got.length} of ${chosenRows.length}` : `${Math.round(x.share * 100)}% on hand`}</span>{#if x.need.length}<div class="small muted">Buy: {x.need.slice(0, 4).join(', ')}{x.need.length > 4 ? ` +${x.need.length - 4}` : ''}</div>{/if}</div>
          <button class={sel[x.r.id] ? 'ghost' : ''} onclick={() => toggle(x.r.id)}>{sel[x.r.id] ? '✓' : 'Add'}</button></div>
      {/each}
    {/if}

    {#if how === 'mine'}
      <div style="margin-top:10px">
        {#if app.recipes.length}
          <p class="small muted" style="margin:0 0 4px">Your saved recipes</p>
          {#each app.recipes as r (r.id)}<button class="chip" class:on={sel[r.id]} onclick={() => toggle(r.id)}>{sel[r.id] ? '✓ ' : ''}{short(r)}</button>{/each}
        {/if}
        <FindRecipes onadd={(r) => { if (!sel[r.id]) toggle(r.id); }} />
      </div>
    {:else if how === 'auto'}
      <div style="margin-top:10px">
        <p class="small" style="margin:0 0 4px"><b>Cuisines this week</b> <span class="muted">(pick any — none means anything goes)</span></p>
        <div class="row" style="gap:4px;margin-bottom:8px">{#each CUISINES as [c]}<button class="chip" class:on={autoCuisines.includes(c)} onclick={() => { autoCuisines = autoCuisines.includes(c) ? autoCuisines.filter((x) => x !== c) : [...autoCuisines, c]; pickForMe(true); }}>{autoCuisines.includes(c) ? '✓ ' : ''}{c}</button>{/each}</div>
        {#if topping}<p class="small muted"><span class="spinner"></span> {topping}</p>{/if}
        {#if mixInfo && !topping}<p class="small muted" style="margin:0 0 6px">{picked.length} recipes, each eaten at most twice (cooked once, leftovers once). {mixInfo.shared ? `They share ${mixInfo.shared} ingredient${mixInfo.shared === 1 ? '' : 's'}, so there's less to buy and waste,` : 'Picked for variety,'} with different proteins and styles day to day.{#if mixInfo.short.main} Not enough recipes matched — try more cuisines.{/if}</p>{/if}
        {#if picked.length}<p class="small muted" style="margin:0 0 4px">Tap ♡ on the ones you want to keep, then repick the rest.</p>{/if}
        {#each picked as r (r.id)}
          <div class="list-row"><Dish {r} size={40} round={8} /><div class="grow"><b class="small">{r.title}</b><div class="small muted">{r.when}{r.cuisine ? ` · ${r.cuisine}` : ''}</div><MealFacts {r} compact /></div>
            <button class="quiet keep" class:on={keep[r.id]} onclick={() => (keep[r.id] = !keep[r.id])} aria-pressed={!!keep[r.id]} aria-label="Keep {r.title}">{keep[r.id] ? '♥' : '♡'}</button>
            <button class="quiet" onclick={() => { delete keep[r.id]; toggle(r.id); }} aria-label="Remove">✕</button></div>
        {/each}
        <div class="row" style="gap:6px;margin-top:8px">
          {#if Object.values(keep).some(Boolean)}<button onclick={() => pickForMe(true)} disabled={!!topping}>🔄 Keep ♥, repick the rest</button>{/if}
          <button class="ghost" onclick={() => { keep = {}; pickForMe(true); }} disabled={!!topping}>🔄 Repick all — new options</button>
        </div>
      </div>
    {:else if picked.length}
      <div style="margin-top:10px">{#each picked as r (r.id)}<button class="chip on" onclick={() => toggle(r.id)}>✓ {short(r)}</button>{/each}</div>
    {/if}
  </div>

  {#if picked.length}
    <div class="card">
      <h3 style="margin:0">Which meal, which day</h3>
      <p class="small muted" style="margin:4px 0 10px">We spread your recipes out — tap any meal to change it. <span class="pill">leftovers</span> means you cooked it earlier in the week.</p>
      <div class="week">
        {#each days.slice(shape.from, shape.to + 1) as d, di}
          {@const dayN = [...shape.meals, ...(shape.snack ? ['snack'] : [])].flatMap((m) => [d[m] ? recipeById(d[m]) : null, sideOf(d, m)]).filter(Boolean).map((r) => nutritionOf(r)).filter((n) => n?.ok)}
          <div class="wday">
            <div class="wday-name">{d.day.slice(0, 3)}{#if dayN.length}<span class="wday-tot" title="Estimated, one serving of each meal">{dayN.reduce((a, n) => a + n.kcal, 0)} cal<br>{dayN.reduce((a, n) => a + n.protein, 0)}g protein</span>{/if}</div>
            <div class="wslots">
              {#each [...shape.meals, ...(shape.snack ? ['snack'] : [])] as m}
                {@const r = d[m] ? recipeById(d[m]) : null}
                {@const before = r && days.slice(shape.from, shape.from + di).some((x) => SLOTS.some((s) => x[s] === r.id))}
                <button class="wslot" class:empty={!r} onclick={() => (slotPick = { day: d.day, meal: m })}>
                  <span class="small muted wmeal">{m[0].toUpperCase() + m.slice(1)}</span>
                  {#if r}
                    <span class="row" style="gap:8px;flex-wrap:nowrap;align-items:center"><Dish {r} size={38} round={8} /><span class="wname">{short(r)}{#if before} <span class="pill">leftovers</span>{/if}{#if nutritionOf(r)?.ok}{@const n = nutritionOf(r)}<span class="wmac">{n.kcal} cal · {n.protein}P {n.carbs}C {n.fat}F</span>{/if}</span></span>
                  {:else}<span class="small muted">— eating out / nothing</span>{/if}
                </button>
                {#if r && sideOf(d, m)}{@const sd = sideOf(d, m)}
                  <div class="wside small"><span>+ {sd.title}{#if nutritionOf(sd)?.ok} <span class="muted">· {nutritionOf(sd).kcal} cal</span>{/if}</span><button class="quiet" aria-label="Remove {sd.title}" onclick={() => dropSide(d, m)}>✕</button></div>
                {:else if r && kind(r) === 'main' && isLight(r) && sideFor(r) && (m === 'lunch' || m === 'dinner')}
                  <div class="wside small"><button class="quiet" style="padding:0" onclick={async () => { d[m + '_side'] = await ensureSide(sideFor(r)); days = [...days]; manual = true; }}>+ Add {SIDES[sideFor(r)].title.toLowerCase()} (light meal)</button></div>
                {/if}
              {/each}
            </div>
          </div>
        {/each}
      </div>
      {#if weekN}
        <div class="wk-sum">
          <b class="small">This week, per person per day</b> <span class="small muted">· {weekN.days} day{weekN.days === 1 ? '' : 's'} planned, estimated</span>
          <div class="wk-row">
            <span><b>{weekN.kcal}</b><small>cal</small></span><span><b>{weekN.protein} g</b><small>protein</small></span><span><b>{weekN.carbs} g</b><small>carbs</small></span><span><b>{weekN.fat} g</b><small>fat</small></span>
          </div>
          {#if weekN.missing}<p class="small muted" style="margin:4px 0 0">{weekN.missing} meal{weekN.missing === 1 ? '' : 's'} not counted (not enough to estimate).</p>{/if}
          {#if goalOn && (+goal || +pGoal)}<p class="small muted" style="margin:4px 0 0">Your goals per meal: {+goal ? `~${goal} cal` : ''}{+goal && +pGoal ? ', ' : ''}{+pGoal ? `${pGoal} g+ protein` : ''} · {weekN.offGoal ? `${weekN.offGoal} meal${weekN.offGoal === 1 ? '' : 's'} over/under` : 'every meal fits ✓'}</p>{/if}
        </div>
      {/if}
      {#if manual}<button class="quiet" onclick={() => { days = autoFill(picked, household); manual = false; }}>↺ Spread them out for me again</button>{/if}
    </div>
    {#if slotPick}
      {@const sd = days.find((x) => x.day === slotPick.day)}
      <div class="sheet-back" role="presentation" onclick={() => (slotPick = null)}></div>
      <div class="sheet plan-sheet" role="dialog" aria-label="Choose a meal">
        <h3 style="margin:0 0 8px">{slotPick.day} · {slotPick.meal}</h3>
        {#each opts(slotPick.meal).length ? opts(slotPick.meal) : picked as r (r.id)}
          <button class="sheet-row" class:on={sd[slotPick.meal] === r.id} onclick={() => { if (sd[slotPick.meal] !== r.id) delete sd[slotPick.meal + '_side']; sd[slotPick.meal] = r.id; manual = true; slotPick = null; }}>
            <Dish {r} size={44} round={8} /><span class="grow"><b>{short(r)}</b><br><span class="small muted">{r.when}{r.cuisine ? ` · ${r.cuisine}` : ''}</span><br><MealFacts {r} compact /></span>
          </button>
        {/each}
        <button class="sheet-row" class:on={!sd[slotPick.meal]} onclick={() => { sd[slotPick.meal] = ''; delete sd[slotPick.meal + '_side']; manual = true; slotPick = null; }}><span style="font-size:24px">🍴</span><span class="grow"><b>Eating out / nothing</b></span></button>
      </div>
    {/if}
  {/if}

  <div class="card">
    <h3 style="margin:0">Ready?</h3>
    <p class="small muted" style="margin:4px 0 8px">{picked.length ? `${picked.length} recipe${picked.length === 1 ? '' : 's'} picked.` : 'Pick at least one recipe.'} <b>Start</b> builds your shopping list and clears last week's checkmarks (history is kept).</p>
    <div class="row">
      <button onclick={() => save(true)} disabled={saving || !picked.length}>{#if saving}<span class="spinner"></span>{/if} Start</button>
      <button class="ghost" onclick={() => save(false)} disabled={saving || !picked.length}>Save Draft</button>
      <button class="quiet" onclick={removePlan} disabled={saving}>Delete Plan</button>
    </div>
  </div>
  {/if}
  <AdSlot slot="plan-bottom" format="rect" />
</div>

<style>
  .keep { font-size: 20px; color: var(--muted); padding: 4px 8px; }
  .keep.on { color: #d6336c; }
  .wside { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 2px 8px 6px 54px; color: var(--ink); }
  .wside .quiet { font-size: 12px; }
  .wk-sum { margin: 10px 0 4px; padding: 10px; border-radius: 12px; background: var(--accent-soft); }
  .wk-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 6px; text-align: center; }
  .wk-row span { background: #fff; border-radius: 10px; padding: 6px 2px; display: flex; flex-direction: column; }
  .wk-row b { font-size: 16px; }
  .wk-row small { font-size: 11px; color: var(--muted); }
  .wday-tot { display: block; font-size: 10px; font-weight: 500; color: var(--muted); line-height: 1.25; margin-top: 4px; text-transform: none; }
  .wmac { display: block; font-size: 11px; color: var(--muted); font-weight: 400; }
  .pan-pick { margin: 10px 0; padding: 10px; border-radius: 12px; background: var(--accent-soft); }
  .pan-pick .cnt { display: inline-block; min-width: 18px; padding: 0 5px; border-radius: 9px; background: var(--accent); color: #fff; font-size: 11px; font-weight: 700; }
  .pan-pick .soon { font-size: 10px; color: #b45309; font-weight: 700; }
</style>

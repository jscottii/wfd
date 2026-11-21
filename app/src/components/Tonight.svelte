<script>
  import Dish from './Dish.svelte';
  import { app, patchPlan, toast } from '../lib/db.svelte.js';
  import { scaleLine } from '../lib/cookday.js';
  // Household mode: just tonight. What's for dinner, for how many, and whether to cook it or just reheat it.
  let { onsteps } = $props();
  const DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  let offset = $state(0);   // 0 = tonight, 1 = tomorrow…
  const nameAt = (o) => DAYN[(new Date().getDay() + o) % 7];
  const dayName = $derived(nameAt(offset));
  const dayOf = (n) => (app.plan.days || []).find((d) => d.day === n);
  const day = $derived(dayOf(dayName));
  const recipeOf = (d) => (d?.dinner ? app.recipes.find((r) => r.id === d.dinner) : null);
  const recipe = $derived(recipeOf(day));
  const lunch = $derived(day?.lunch && day.lunch !== day.dinner ? app.recipes.find((r) => r.id === day.lunch) : null);
  const short = (t) => String(t).split(/,|\s[–—-]\s|\s+with\s/i)[0].trim();
  const k = $derived(recipe && recipe.servings && day?.people ? Math.max(0.5, Math.ceil((day.people / recipe.servings) * 2) / 2) : 1);

  // already made? (batch-cooked on Prep, cooked meal in the pantry, or eaten an earlier night)
  const cookedItem = (r) => app.pantry.find((p) => r && p.name.toLowerCase().startsWith(short(r.title).toLowerCase()) && /\(cooked\)/i.test(p.name));
  const batched = (r) => !!r && Object.keys(app.plan.prepDone || {}).some((key) => key.startsWith(`s|${r.id}|`));
  const firstNight = (r) => (app.plan.days || []).filter((d) => d.dinner === r.id || d.lunch === r.id).sort((a, b) => ORDER.indexOf(a.day) - ORDER.indexOf(b.day))[0]?.day;
  const reheat = $derived(!!recipe && (batched(recipe) || !!cookedItem(recipe) || (firstNight(recipe) && ORDER.indexOf(firstNight(recipe)) < ORDER.indexOf(dayName))));
  const where = $derived(recipe ? cookedItem(recipe)?.place : null);

  // thaw tonight for tomorrow
  const thaw = $derived.by(() => {
    const t = recipeOf(dayOf(nameAt(offset + 1))); if (!t) return [];
    const out = [];
    const ci = cookedItem(t); if (ci?.place === 'freezer') out.push(`${short(t.title)} (from the freezer)`);
    app.pantry.filter((p) => p.place === 'freezer' && p.item_id && t.items?.[p.item_id] && !/\(cooked\)/i.test(p.name)).forEach((p) => out.push(p.name));
    return out;
  });

  // kid-friendly: hold back the heat, sauce on the side
  const kidNote = $derived.by(() => {
    if (!recipe) return '';
    const text = `${recipe.title} ${recipe.ing.join(' ')} ${recipe.steps.join(' ')}`.toLowerCase();
    const hot = ['cayenne', 'jalapeño', 'jalapeno', 'chipotle', 'sriracha', 'red pepper flakes', 'chili flakes', 'hot sauce', 'curry paste', 'gochujang', 'harissa', 'habanero', 'serrano'].find((w) => text.includes(w));
    if (hot) return `Scoop out a kid portion before the ${hot} goes in, or add it to grown-up plates at the end.`;
    if (/sauce|dressing|salsa|gravy/.test(text)) return 'Serve the sauce on the side so little ones can dip, and keep the pieces separate on their plate.';
    return 'Cut theirs into bite-size pieces and serve the parts separately if they prefer.';
  });

  // swap tonight with another night
  let swapping = $state(false);
  const others = $derived((app.plan.days || []).filter((d) => d.day !== dayName && d.dinner && d.dinner !== day?.dinner));
  async function swapWith(other) {
    const days = (app.plan.days || []).map((d) => ({ ...d }));
    const a = days.find((d) => d.day === dayName), b = days.find((d) => d.day === other);
    [a.dinner, b.dinner] = [b.dinner, a.dinner];
    try { await patchPlan({ days }); swapping = false; toast(`✓ Swapped ${dayName} and ${other}`); } catch (e) { toast(e.message); }
  }
  let open = $state(false);
</script>

<div class="card tonight nocollapse">
  <div class="spread">
    <span class="small muted">{offset === 0 ? "Tonight's dinner" : offset === 1 ? "Tomorrow's dinner" : `${dayName}'s dinner`}</span>
    <span class="row" style="gap:2px"><button class="quiet" disabled={offset === 0} onclick={() => { offset--; open = false; swapping = false; }} aria-label="Previous day">‹</button><button class="quiet" disabled={offset >= 6} onclick={() => { offset++; open = false; swapping = false; }} aria-label="Next day">›</button></span>
  </div>
  {#if recipe}
    {#if recipe.image}<img class="hero" src={recipe.image} alt={recipe.title} />{/if}
    <h2 style="margin:2px 0 4px">{recipe.title}</h2>
    <p class="small muted" style="margin:0 0 10px">For {day.people} · {reheat ? 'already made — just reheat' : k === 1 ? 'cook one batch' : `cook ${k}× the recipe`}{recipe.fridge ? ` · keeps ${recipe.fridge} in the fridge` : ''}</p>
    {#if reheat}
      <p class="small" style="margin:0 0 8px">🔥 {where === 'freezer' ? 'It’s in the freezer — thaw in the fridge overnight, or microwave on defrost first. ' : ''}Reheat covered until steaming all the way through: 2–3 min per portion in the microwave, or 15–20 min in a 350°F oven.</p>
    {/if}
    <div class="row" style="gap:6px">
      <button onclick={() => (open = !open)}>{open ? 'Hide recipe' : reheat ? 'Show the recipe' : '👩‍🍳 Cook it'}</button>
      {#if others.length}<button class="ghost" onclick={() => (swapping = !swapping)}>⇄ Swap night</button>{/if}
    </div>
    {#if swapping}
      <div class="row" style="gap:4px;margin-top:8px">
        <span class="small muted">Swap with:</span>
        {#each others as d}<button class="chip" onclick={() => swapWith(d.day)}>{d.day.slice(0, 3)} · {short(recipeOf(d)?.title || '')}</button>{/each}
      </div>
    {/if}
    {#if open}
      <p class="small muted" style="margin:12px 0 2px">You'll need</p>
      <ul style="margin:0;padding-left:18px">{#each recipe.ing as x}{#if !/:$/.test(String(x).trim())}<li class="small">{scaleLine(x, k)}</li>{/if}{/each}</ul>
      <p class="small muted" style="margin:10px 0 2px">Steps</p>
      <ol style="margin:0;padding-left:20px">{#each recipe.steps as st}<li class="small" style="margin:4px 0">{st}</li>{/each}</ol>
      {#if recipe.tip}<p class="small muted">💡 {recipe.tip}</p>{/if}
    {/if}
    <p class="small" style="margin:10px 0 0">🧒 {kidNote}</p>
    {#if lunch}<p class="small muted" style="margin:6px 0 0">Lunch: {lunch.title}</p>{/if}
  {:else}
    <h2 style="margin:2px 0 4px">Nothing planned</h2>
    <p class="small muted" style="margin:0">{day ? 'Eating out, or a free night.' : 'No plan for this week yet.'}</p>
  {/if}
  {#if thaw.length}<div class="note small" style="margin-top:10px">🧊 Before bed: move <b>{thaw.join(', ')}</b> from the freezer to the fridge for {offset === 0 ? 'tomorrow' : nameAt(offset + 1)}.</div>{/if}
  <p class="small" style="margin:10px 0 0"><button class="quiet" onclick={onsteps}>Batch-cook the whole week instead →</button></p>
</div>

<style>
  .tonight { border-color: var(--accent); }
  .hero { width: 100%; max-height: 220px; object-fit: cover; border-radius: 12px; margin: 6px 0 8px; display: block; }
  .tonight h2 { font: 700 24px/1.2 Georgia, serif; }
</style>

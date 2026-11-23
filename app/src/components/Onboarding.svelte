<script>
  import { app, saveSettings, importRecipes, addLocalStores, track, renameHousehold, currentHousehold } from '../lib/db.svelte.js';
  import { needsName } from '../lib/hhname.js';
  import { hereAddress, findLocalChains, geocode } from '../lib/maps.js';
  import { CUISINES, findIdeas, mealDetail, fromMealDb } from '../lib/discover.js';
  import { conflicts, prefsOf } from '../lib/diet.js';
  import MealPrefs from './MealPrefs.svelte';
  // First run (or anyone who hasn't done it): pick favorite cuisines → 15 starter meals in Saved recipes.
  let { go, onclose } = $props();
  // where home is comes first (trips start and end there, and it decides which stores are nearby)
  let step = $state(needsName(app, currentHousehold()) ? 'name' : !app.settings.homeSet ? 'home' : 'pick'), liked = $state([...(app.settings.cuisines || [])]), prog = $state(0), err = $state(''), made = $state([]);
  const TOTAL = 15;
  const toggle = (c) => (liked = liked.includes(c) ? liked.filter((x) => x !== c) : [...liked, c]);

  async function build() {
    step = 'build'; err = ''; prog = 0;
    try {
      await saveSettings({ cuisines: liked });
      const have = new Set(app.recipes.map((r) => r.title.toLowerCase()));
      // mostly dinners from the cuisines you picked, plus a couple of breakfasts
      const prefs = prefsOf(app.settings);
      const veg = prefs.diets.includes('Vegan') ? ['Vegan'] : prefs.diets.includes('Vegetarian') ? ['Vegetarian', 'Vegan'] : prefs.diets.includes('Pescatarian') ? ['Vegetarian', 'Seafood'] : [];
      const mains = (await findIdeas({ cuisines: liked.length ? liked : ['American', 'Italian', 'Mexican', 'Chinese'], types: veg })).filter((i) => !have.has(i.title.toLowerCase()));
      if (veg.length && mains.length < 25) mains.push(...(await findIdeas({ types: veg })).filter((i) => !have.has(i.title.toLowerCase()) && !mains.some((x) => x.id === i.id)));
      const breakfasts = (await findIdeas({ types: ['Breakfast'] })).filter((i) => !have.has(i.title.toLowerCase())).slice(0, 2);
      // spread the picks evenly across the cuisines
      const byArea = {}; mains.forEach((m) => (byArea[m.area] = byArea[m.area] || []).push(m));
      const areas = Object.keys(byArea), queue = [];
      for (let i = 0; queue.length < TOTAL * 2 && areas.some((a) => byArea[a][i]); i++) areas.forEach((a) => byArea[a][i] && queue.push(byArea[a][i]));
      const out = [];
      const clash = (m) => conflicts({ title: m.title || m.strMeal, ing: fromMealDb(m).recipes[0].ing }, prefs).any;
      for (const b of breakfasts) { const m = await mealDetail(b.id); if (clash(m)) continue; const [r] = await importRecipes([fromMealDb(m)], 'mdb'); out.push(r); prog = out.length; }
      let desserts = 0;
      for (const q of queue) {
        if (out.length >= TOTAL) break;
        const m = await mealDetail(q.id);
        if (/dessert/i.test(m.strCategory) && desserts++ >= 1) continue;
        if (/side|starter/i.test(m.strCategory) || clash(m)) continue;
        const [r] = await importRecipes([fromMealDb(m)], 'mdb'); out.push(r); prog = out.length;
      }
      made = out;
      await saveSettings({ onboarded: true }); track('onboarding_done', { meals: out.length, cuisines: liked.length });
      step = 'done';
    } catch (e) { err = e.message; step = 'pick'; }
  }
  let addr = $state(app.settings.homeSet ? app.settings.homeAddress : ''), homeBusy = $state(''), homeNote = $state('');
  async function useHere() { homeBusy = 'here'; err = ''; try { addr = await hereAddress(); } catch (e) { err = e.message; } homeBusy = ''; }
  async function saveHome() {
    homeBusy = 'save'; err = '';
    try {
      const g = await geocode(addr);   // make sure we can find it on the map
      await saveSettings({ homeAddress: addr.trim(), homeSet: true });
      if (g.approx) homeNote = `Your street isn't on the map yet, so distances use ${g.near || 'your town'} — close enough to find stores. `;
      // the grocery chains around you become your stores
      try {
        const near = (await findLocalChains(addr, app.stores, Number(app.settings.storeRadius) || 25)).filter((b) => !b.known).slice(0, 6);
        if (near.length) { await addLocalStores(near); homeNote += `Added ${near.map((b) => b.brand).join(', ')} near you.`; }
      } catch { /* the store map can be busy; stores can be added later in More → Stores */ }
      if (app.settings.onboarded || homeNote) { homeBusy = ''; step = 'homedone'; } else { homeBusy = ''; step = 'pick'; }
    } catch (e) { err = 'We couldn’t find that address or its town — check the city and ZIP.'; homeBusy = ''; }
  }
  // name the household first, so invites and the household switcher say whose kitchen it is
  let hhName = $state(''), nameBusy = $state(false);
  const afterName = () => (step = !app.settings.homeSet ? 'home' : app.settings.onboarded ? 'close' : 'pick');
  async function saveName() {
    nameBusy = true; err = '';
    try { await renameHousehold(hhName); await saveSettings({ hhNamed: true }); track('household_named'); afterName(); }
    catch (e) { err = e.message; }
    nameBusy = false;
  }
  async function skipName() { await saveSettings({ hhNamed: true }).catch(() => {}); afterName(); }
  $effect(() => { if (step === 'close') onclose(); });
  async function skip() { await saveSettings({ onboarded: true, onboardSkipped: true }).catch(() => {}); onclose(); }
</script>

<div class="modal-back" role="presentation">
  <div class="modal card nocollapse onboard">
    {#if step === 'name'}
      <h2 style="margin-top:0">Name your household</h2>
      <p class="small muted" style="margin-top:0">It's what people see when you invite them to plan and shop with you. You can change it later in More → Settings.</p>
      {#if err}<div class="err small">⚠️ {err}</div>{/if}
      <input bind:value={hhName} placeholder="e.g. The Scott House" maxlength="40" onkeydown={(e) => e.key === 'Enter' && hhName.trim() && saveName()} />
      <div class="row" style="margin-top:12px">
        <button onclick={saveName} disabled={!hhName.trim() || nameBusy}>{#if nameBusy}<span class="spinner"></span>{/if} Save name</button>
        <button class="quiet" onclick={skipName}>Skip</button>
      </div>
    {:else if step === 'home'}
      <h2 style="margin-top:0">Where's home?</h2>
      <p class="small muted" style="margin-top:0">Shopping trips start and end here, and we'll find the grocery stores near you. Only your household sees it.</p>
      {#if err}<div class="err small">⚠️ {err}</div>{/if}
      <button class="ghost" onclick={useHere} disabled={!!homeBusy}>{#if homeBusy === 'here'}<span class="spinner"></span>{/if} 📍 Use my current location</button>
      <input style="margin-top:8px" bind:value={addr} placeholder="Street, city, ZIP" autocomplete="street-address" />
      <div class="row" style="margin-top:12px">
        <button onclick={saveHome} disabled={!addr.trim() || !!homeBusy}>{#if homeBusy === 'save'}<span class="spinner"></span> Finding stores near you…{:else}Save home{/if}</button>
        <button class="quiet" onclick={() => (step = app.settings.onboarded ? 'close' : 'pick')}>Later</button>
      </div>
    {:else if step === 'homedone'}
      <h2 style="margin-top:0">✓ Home saved</h2>
      <p class="small">{homeNote || 'You can add stores near you any time in More → Stores.'}</p>
      <button onclick={() => (app.settings.onboarded ? onclose() : (step = 'pick'))}>{app.settings.onboarded ? 'Done' : 'Next'}</button>
    {:else if step === 'pick'}
      <h2 style="margin-top:0">What do you love to eat?</h2>
      <p class="small muted" style="margin-top:0">Pick your favorite cuisines and we'll start you off with {TOTAL} meals to plan from. You can change them any time.</p>
      {#if err}<div class="err small">⚠️ {err}</div>{/if}
      <div class="row" style="gap:4px">{#each CUISINES as [c]}<button class="chip" class:on={liked.includes(c)} onclick={() => toggle(c)}>{liked.includes(c) ? '♥ ' : ''}{c}</button>{/each}</div>
      <h3 style="margin:16px 0 6px">Any diets or allergies?</h3>
      <MealPrefs compact />
      <div class="row sticky-actions">
        <button onclick={build} disabled={!liked.length}>Get my {TOTAL} meals</button>
        <button class="quiet" onclick={skip}>Not now</button>
      </div>
    {:else if step === 'build'}
      <h2 style="margin-top:0">Building your meals…</h2>
      <p class="small muted">{prog} of {TOTAL} saved</p>
      <div style="height:8px;background:var(--tint);border-radius:99px;overflow:hidden"><div style="height:100%;background:var(--accent);width:{(prog / TOTAL) * 100}%;transition:width .3s"></div></div>
    {:else}
      <h2 style="margin-top:0">✓ {made.length} meals ready</h2>
      <p class="small">{made.slice(0, 6).map((r) => r.title).join(' · ')}{made.length > 6 ? ` and ${made.length - 6} more` : ''}</p>
      <p class="small muted">They're in Saved recipes. Want us to pick this week's mix from them?</p>
      <div class="row"><button onclick={() => { onclose(); go('plan'); }}>Plan my week</button><button class="quiet" onclick={() => { onclose(); go('recipes'); }}>See them</button></div>
    {/if}
  </div>
</div>

<style>
  .onboard { max-width: 560px; }
  .sticky-actions { position: sticky; bottom: -14px; background: var(--card); padding: 12px 0 6px; margin-top: 14px; border-top: 1px solid var(--line); }
</style>

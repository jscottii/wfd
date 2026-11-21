<script module>
  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
</script>

<script>
  import Dish from '../components/Dish.svelte';
  import { untrack } from 'svelte';
  import { app, portions, guideFor, loadGuide, updatePrep, toast, removePantry, addPantry, patchPlan, patchCartMeta, updateCartPrep, saveSettings, currentHousehold } from '../lib/db.svelte.js';
  import { ui, openCart } from '../lib/ui.svelte.js';
  import { usedByRecipes } from '../lib/pantry.js';
  import { scaleLine, scaleStepHtml, prepLists, cookMinutes, alignSteps, isPrepStep, durationOf, equipmentFor, stepMinutes, fmtMins, scaleTime, pansOf, estimateMins, isCutOnly } from '../lib/cookday.js';
  import { unlockAudio, holdAwake } from '../lib/timers.js';
  import { tap } from '../lib/native.js';
  import Tonight from '../components/Tonight.svelte';
  import { freezerPlan, canFreeze } from '../lib/freezer.js';
  let { go } = $props();

  const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
  // which list you're cooking from: this week's home list, or a project cart (cooked once, big-group style)
  let cart = $derived(ui.cart && ui.cart !== 'home' && ui.cart !== 'new' ? app.carts.find((c) => c.id === ui.cart) : null);
  let por = $derived.by(() => {
    if (!cart) return portions();
    const o = {};
    (cart.recipes || []).forEach((x) => { const r = app.recipes.find((y) => y.id === x.id); const p = Number(x.portions) || Number(cart.people) || r?.servings || 0; o[x.id] = { portions: p, scale: r?.servings ? p / r.servings : 1 }; });
    return o;
  });
  // where this cook day keeps its progress and kitchen setup
  let ctx = $derived(cart ? (cart.meta || {}) : app.plan);
  const patchCtx = (patch) => (cart ? patchCartMeta(cart.id, patch) : patchPlan(patch));
  const doPrep = (on, off, timers) => (cart ? updateCartPrep(cart.id, on, off, timers) : updatePrep(on, off, timers));
  const big = $derived(app.settings.audience === 'group' || !!cart);
  // one meal at a time, or the whole week's prep in one go
  const prepStyle = $derived(app.settings.prepStyle || 'single');
  function setStyle(v) { saveSettings({ prepStyle: v }).catch(() => {}); mode = v === 'single' && !big ? 'simple' : 'steps'; }
  let focusId = $state('');
  // freezer meals: which recipes get packed for the freezer
  let freezeSel = $derived(ctx.freezer || {});
  const toggleFreeze = (id) => patchCtx({ freezer: { ...freezeSel, [id]: !freezeSel[id] } }).catch((e) => (err = e.message));
  // this week's recipes: on the plan, or switched on
  let allRecipes = $derived.by(() => {
    if (cart) return (cart.recipes || []).map((x) => app.recipes.find((r) => r.id === x.id)).filter(Boolean);
    const onPlan = new Set(); (app.plan.days || []).forEach((d) => SLOTS.forEach((s) => d[s] && onPlan.add(d[s])));
    return app.recipes.filter((r) => onPlan.has(r.id) || r.active);
  });
  // big group, one meal at a time: just the recipe you're cooking now
  let recipes = $derived(big && prepStyle === 'single' && allRecipes.length > 1 ? allRecipes.filter((r) => r.id === (focusId || allRecipes[0].id)) : allRecipes);
  const batches = (r) => { const p = por[r.id]; return p ? Math.max(0.5, Math.ceil(p.scale * 2) / 2) : 1; };
  const times = (k) => (k === 1 ? 'one batch' : k === 0.5 ? 'half a batch' : `${k}× the recipe`);
  let kOf = $derived(Object.fromEntries(recipes.map((r) => [r.id, batches(r)])));

  // cook-day guides for the posts these recipes came from
  let sources = $derived([...new Set(recipes.map((r) => r.source).filter(Boolean))]);
  let guides = $derived(sources.map((url) => ({ url, guide: guideFor(url), mine: recipes.filter((r) => r.source === url) })));
  const isPost = (url) => /substack\.com\/p\//.test(url);
  let missingGuides = $derived(guides.filter((g) => !g.guide && isPost(g.url)));

  let done = $derived(ctx.prepDone || {});
  let lists = $derived(prepLists(recipes, kOf, app.items));
  let gear = $derived(equipmentFor(recipes));
  // after cooking: what came out of the pantry
  let used = $derived(usedByRecipes(recipes, app.pantry, app.items));
  let usedSel = $state({});
  let pantryDone = $state(false);
  $effect(() => { const prev = untrack(() => usedSel), m = {}; used.forEach((u) => (m[u.p.id] = prev[u.p.id] ?? u.usedUp)); usedSel = m; });
  async function updatePantryAfterCooking() {
    const ids = used.filter((u) => usedSel[u.p.id]).map((u) => u.p.id);
    try {
      if (ids.length) await removePantry(ids);
      // the cooked meals themselves go in, so the Pantry shows what's ready to eat
      await addPantry(recipes.map((r) => ({ name: `${shortTitle(r.title)} (cooked)`, amount: '', place: /yes/i.test(r.freeze || '') && /freez/i.test(r.title + r.ing.join(' ')) ? 'freezer' : 'fridge', use_by: fridgeDays(r) })));
      pantryDone = true; toast(`✓ Pantry updated: ${ids.length} used up, ${recipes.length} meals added`);
    } catch (e) { err = e.message; }
  }
  const fridgeDays = (r) => { const m = String(r.fridge || '').match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*day/i); if (!m) return null; const d = new Date(); d.setDate(d.getDate() + Number(m[1])); return d.toISOString().slice(0, 10); };

  // keep the screen on while this tab is open (your choice, remembered on this device)
  let awake = $state(localStorage.getItem('mp-awake') !== '0');
  $effect(() => {
    localStorage.setItem('mp-awake', awake ? '1' : '0');
    if (!awake) return;
    const stop = holdAwake();
    return stop;
  });
  const firstWords = (t) => { const w = String(t).split(/[.;:]/)[0]; return w.length > 60 ? w.slice(0, 57) + '…' : w; };

  // the kitchen you're cooking in decides how many pans fit at once (big groups set this up before cooking)
  const KITCHEN_DEFAULTS = { home: { ovens: 1, racks: 2, commercial: false }, commercial: { ovens: 2, racks: 6, commercial: true }, both: { ovens: 1, racks: 2, commercial: false } };
  let setup = $derived({ ...KITCHEN_DEFAULTS[ctx.kitchen || 'home'], ...(ctx.kitchenSetup || {}) });
  const avgK = (rs) => (rs.length ? rs.reduce((a, r) => a + (kOf[r.id] || 1), 0) / rs.length : 1);

  /* ---------- the step-by-step plan: the game plan's own steps, with each recipe's matching steps inside ---------- */
  let steps = $derived.by(() => {
    const out = [], covered = new Set(), before = [];
    guides.forEach((g) => g.guide?.sections.forEach((s) => { if (/before you start|bare minimum/i.test(s.title)) before.push(s); }));
    out.push({ kind: 'setup', title: 'Get set up', before, mins: 10, approx: true });
    const timeSteps = [];
    guides.forEach((g) => {
      if (!g.guide) return;
      // a cook-day plan only fits when you're making all of its recipes; otherwise go recipe by recipe
      if (g.mine.length < app.recipes.filter((r) => r.source === g.url).length) return;
      const items = [];
      g.guide.sections.forEach((s, si) => s.kind === 'timeline' && s.items.forEach((it, ii) => items.push({ ...it, key: `t|${g.url}|${si}|${ii}`, text: `${it.label ? it.label + ' — ' : ''}${it.text}` })));
      if (!items.length) return;
      const cooking = items.map((it, idx) => ({ text: it.text, idx })).filter((x) => !isPrepStep(x.text));
      const subs = items.map(() => []);
      g.mine.forEach((r) => {
        const a = alignSteps(r, cooking, recipes);
        if (!a) return;
        covered.add(r.id);
        a.forEach((idx, j) => { let e = subs[idx].find((x) => x.r.id === r.id); if (!e) subs[idx].push((e = { r, js: [] })); e.js.push(j); });
      });
      const mins = stepMinutes(items);
      items.forEach((it, idx) => {
        // no next step to measure against (usually dinner): estimate from its recipe steps, else 15 min
        let m = mins[idx], approx = false;
        if (m == null) { const d = subs[idx].flatMap((e) => e.js.map((j) => durationOf(e.r.steps[j])?.maxMins || 0)); m = Math.max(15, ...d); approx = true; }
        // more food: scale the time by what limits this step (see scaleTime)
        const rs = subs[idx].length ? subs[idx].map((e) => e.r) : g.mine;
        const k = subs[idx].length ? Math.max(...rs.map((r) => kOf[r.id] || 1)) : avgK(rs);
        const sc = scaleTime(it.text, m, k, setup, Math.max(1, ...rs.map(pansOf)));
        timeSteps.push({ kind: 'time', key: it.key, mins: sc.mins, base: m, note: sc.note, approx: approx || sc.mins !== m, title: firstWords(it.text), text: it.text, subs: subs[idx], prep: isPrepStep(it.text) });
      });
    });
    // knife prep + seasonings go on the plan's "chop everything" step, or get their own steps before it
    const chop = timeSteps.find((t) => t.prep);
    if (chop) { chop.knife = lists.knife.length > 0; chop.spices = lists.spices.length > 0; }
    else {
      const cuts = lists.knife.reduce((a, g) => a + g.items.length, 0);
      if (lists.knife.length) out.push({ kind: 'knife', title: 'Knife prep', mins: Math.max(10, Math.round(cuts * 3 * Math.pow(avgK(recipes), 0.85) / 5) * 5), approx: true });
      if (lists.spices.length) out.push({ kind: 'spices', title: 'Measure the seasonings', mins: Math.max(5, lists.spices.length * 2), approx: true });
    }
    out.push(...timeSteps);
    // recipes the game plan doesn't cover: longest cook first, so the oven works while you do the rest
    recipes.filter((r) => !covered.has(r.id)).sort((a, b) => cookMinutes(b) - cookMinutes(a))
      .forEach((r) => {
        // steps that just cut things were already counted in Knife prep
        const sc = r.steps.map((st) => {
          const base = durationOf(st)?.maxMins ?? (lists.knife.length && isCutOnly(st) ? 1 : estimateMins(st));
          return scaleTime(st, base, kOf[r.id] || 1, setup, pansOf(r));
        });
        out.push({ kind: 'recipe', title: r.title, mins: sc.reduce((a, x) => a + x.mins, 0), approx: true, note: sc.map((x) => x.note).filter(Boolean).join(' · '), subs: [{ r, js: r.steps.map((_, j) => j) }] });
      });
    const fz = recipes.filter((r) => freezeSel[r.id] && canFreeze(r));
    if (fz.length) out.push({ kind: 'freezer', title: 'Pack freezer meals', mins: 10 + 5 * fz.reduce((a, r) => a + freezerPlan(r, por[r.id]?.portions || r.servings, Number(app.plan.household) || 4).packs, 0), approx: true });
    out.push({ kind: 'pack', title: app.settings.audience === 'group' ? 'Hold & serve' : 'Pack it up', mins: 15, approx: true });
    out.forEach((st) => (st.label = `${fmtMins(st.mins, st.approx)}${st.mins ? ' · ' : ''}${st.title}`));
    return out;
  });

  const subKeys = (st) => (st.subs || []).flatMap((e) => e.js.map((j) => `s|${e.r.id}|${j}`));
  const knifeKeys = () => lists.knife.flatMap((g) => g.items.map((_, ii) => `k|${g.key}|${ii}`));
  const spiceKeys = () => lists.spices.map((x) => `sp|${x.id}`);
  // the checkmarks that belong to a step, so it can show as done
  function stepKeys(st) {
    if (st.kind === 'setup') return [...gear.items.map((e) => `e|${e.name}`), 'e|basics', ...lists.setup.flatMap((g, gi) => g.items.map((_, ii) => `u|${gi}|${ii}`))];
    if (st.kind === 'knife') return knifeKeys();
    if (st.kind === 'spices') return spiceKeys();
    if (st.kind === 'time') return [st.key, ...(st.knife ? knifeKeys() : []), ...(st.spices ? spiceKeys() : []), ...subKeys(st)];
    if (st.kind === 'recipe') return subKeys(st);
    if (st.kind === 'freezer') return recipes.filter((r) => freezeSel[r.id] && canFreeze(r)).map((r) => `fz|${r.id}`);
    return [];
  }
  const stepDone = (st) => { const k = stepKeys(st); return k.length > 0 && k.every((x) => done[x]); };
  let allKeys = $derived(steps.flatMap((st) => stepKeys(st)));
  let doneCount = $derived(allKeys.filter((k) => done[k]).length);
  let totalMins = $derived(steps.reduce((a, st) => a + (st.mins || 0), 0));
  let leftMins = $derived(steps.filter((st) => !stepDone(st)).reduce((a, st) => a + (st.mins || 0), 0));
  let firstUndone = $derived.by(() => { const i = steps.findIndex((st) => stepKeys(st).some((k) => !done[k])); return i < 0 ? steps.length - 1 : i; });
  // which step a checkmark lives on (so ticking the last item on a step ticks the step in the overview)
  let owner = $derived.by(() => { const m = {}; steps.forEach((st) => stepKeys(st).forEach((k) => { if (!m[k]) m[k] = st; })); return m; });

  // a timer for steps that cook for a set time
  function timerFor(key) {
    const [kind, id, j] = key.split('|');
    if (kind !== 's') return null;
    const r = recipes.find((x) => x.id === id), text = r?.steps[Number(j)];
    const d = text && durationOf(text);
    if (!d) return null;
    // a bigger batch: time per round (pans in the oven) or the scaled time (bigger roast, bigger pot)
    const k = kOf[r.id] || 1, lo = scaleTime(text, d.mins, k, setup, pansOf(r)), hi = scaleTime(text, d.maxMins, k, setup, pansOf(r));
    return { label: `${shortTitle(r.title)}: ${firstWords(text)}${lo.rounds > 1 ? ' (round 1)' : ''}`, mins: lo.perRound, maxMins: hi.perRound };
  }
  const shortTitle = (t) => String(t).split(/,|\s[–—-]\s/)[0];

  let mode = $state(localStorage.getItem('mp-prep-mode') || (untrack(() => app.settings.audience) === 'group' ? 'steps' : 'simple'));
  $effect(() => { if (big && mode === 'simple') mode = 'steps'; if (!big && mode === 'overview') mode = 'simple'; if (!big && prepStyle === 'single' && mode === 'steps') mode = 'simple'; if (!big && prepStyle === 'full' && mode === 'simple') mode = 'steps'; });
  // big group: work backwards from serving time
  let serveAt = $state(untrack(() => ctx.serveAt) || '18:00');
  $effect(() => { serveAt = ctx.serveAt || '18:00'; });
  const kitchen = $derived(ctx.kitchen || '');
  const clock = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  let starts = $derived.by(() => {
    const [h, m] = String(serveAt || '18:00').split(':').map(Number);
    const serve = new Date(); serve.setHours(h || 18, m || 0, 0, 0);
    const cookSteps = steps.filter((st) => st.kind !== 'pack');
    let t = new Date(serve.getTime() - cookSteps.reduce((a, st) => a + (st.mins || 0), 0) * 60000);
    const out = {};
    steps.forEach((st, i) => { if (st.kind === 'pack') { out[i] = serve; return; } out[i] = new Date(t); t = new Date(t.getTime() + (st.mins || 0) * 60000); });
    return out;
  });
  const ready = $derived(!!ctx.kitchenSetup?.ready && !!ctx.kitchen);
  let editSetup = $state(false);
  let form = $state({ serveAt: '18:00', kitchen: '', ovens: 1, racks: 2 });
  $effect(() => { const c = ctx; untrack(() => Object.assign(form, { serveAt: c.serveAt || '18:00', kitchen: c.kitchen || '', ovens: c.kitchenSetup?.ovens || 1, racks: c.kitchenSetup?.racks || 2 })); });
  async function saveSetup() {
    const k = form.kitchen;
    try {
      await patchCtx({ serveAt: form.serveAt, kitchen: k, kitchenSetup: { ovens: Math.max(1, +form.ovens || 1), racks: Math.max(1, +form.racks || 1), commercial: k === 'commercial', ready: true } });
      serveAt = form.serveAt; editSetup = false; resume();
    } catch (e) { err = e.message; }
  }
  // live clock for "time left"
  let now = $state(Date.now());
  $effect(() => { const t = setInterval(() => (now = Date.now()), 30000); return () => clearInterval(t); });
  let serveDate = $derived.by(() => { const [h, m] = String(serveAt || '18:00').split(':').map(Number); const d = new Date(now); d.setHours(h || 18, m || 0, 0, 0); return d; });
  const left = (ms) => { const m = Math.round(ms / 60000); if (m <= 0) return 'serving time!'; return fmtMins(m) + ' to serve'; };
  function setServe(v) { serveAt = v; patchCtx({ serveAt: v }).catch(() => {}); }
  function setKitchen(v) { patchCtx({ kitchen: v }).catch((e) => (err = e.message)); }
  const KITCHENS = [['home', '🏠 Home kitchen'], ['commercial', '🏫 Church / commercial'], ['both', '🚗 Prep at home, serve on site']];
  let totalPortions = $derived(Object.values(por).reduce((a, x) => a + (x.portions || 0), 0));
  let at = $state(Number(localStorage.getItem('mp-prep-step')) || 0);
  let lastSrc = untrack(() => ui.cart);
  $effect(() => { const c = ui.cart; untrack(() => { if (c !== lastSrc) { lastSrc = c; at = firstUndone; } }); });
  function resume() { mode = 'steps'; at = firstUndone; window.scrollTo(0, 0); }
  $effect(() => { localStorage.setItem('mp-prep-mode', mode); localStorage.setItem('mp-prep-step', String(at)); });
  let idx = $derived(Math.min(at, steps.length - 1));
  let cur = $derived(steps[idx]);
  function move(d) { at = Math.max(0, Math.min(steps.length - 1, idx + d)); window.scrollTo(0, 0); }
  // "Done → Next": tick everything on this step (and start timers for anything cooking), then move on
  async function doneNext() {
    unlockAudio();
    const keys = stepKeys(cur).filter((k) => !done[k]), timers = {};
    keys.forEach((k) => { const t = timerFor(k); if (t) timers[k] = t; });
    if (keys.length) try { await doPrep(keys, [], timers); } catch (e) { err = e.message; }
    move(1);
  }

  let loading = $state(''), err = $state('');
  async function fetchGuide(url) {
    loading = url; err = '';
    try { await loadGuide(url); toast('✓ Cook-day plan loaded'); } catch (e) { err = e.message; }
    loading = '';
  }
  async function tick(key, on) {
    unlockAudio(); if (on) tap();
    const t = on ? timerFor(key) : null, onKeys = on ? [key] : [], offKeys = on ? [] : [key];
    // finishing the last item on a step ticks that step in the overview (and unticking one unticks it)
    const st = owner[key];
    if (st?.kind === 'time' && key !== st.key) {
      if (on && stepKeys(st).every((k) => k === key || k === st.key || done[k])) onKeys.push(st.key);
      if (!on && done[st.key]) offKeys.push(st.key);
    }
    try { await doPrep(onKeys, offKeys, t ? { [key]: t } : {}); } catch (e) { err = e.message; }
  }
</script>

{#snippet box(key, html, small = false)}
  <label class="check" style:opacity={done[key] ? 0.5 : 1}>
    <input type="checkbox" checked={!!done[key]} onchange={(e) => tick(key, e.currentTarget.checked)} />
    <span class:small style:text-decoration={done[key] ? 'line-through' : ''}>{@html html}</span>
  </label>
{/snippet}

{#snippet recipeBlock(r)}
  {@const k = kOf[r.id] || 1}
  <div class="card">
    <div class="row" style="gap:10px;align-items:center;flex-wrap:nowrap"><Dish {r} size={64} /><h3 style="margin:0">{r.title} <span class="pill" class:acc={k !== 1}>{times(k)}</span></h3></div>
    {#if k !== 1}<p class="small muted" style="margin:0 0 6px">Amounts below are already {k === 0.5 ? 'halved' : `multiplied by ${k}`}.</p>{/if}
    {#if r.ing.length}
      <p class="small muted" style="margin:6px 0 2px">Ingredients</p>
      <ul style="margin:0;padding-left:18px">
        {#each r.ing as x}{#if /:$/.test(String(x).trim())}<li class="small" style="list-style:none;margin:6px 0 0 -18px"><b>{x}</b></li>{:else}<li class="small">{scaleLine(x, k)}</li>{/if}{/each}
      </ul>
    {/if}
    {#if r.steps.length}<p class="small muted" style="margin:10px 0 0">Steps</p>{/if}
    {#each r.steps as st, i}{@render box(`s|${r.id}|${i}`, scaleStepHtml(st, k), true)}{/each}
    {#if r.fridge || r.freeze}<p class="small muted">{r.fridge ? `🧊 Fridge: ${r.fridge}` : ''}{r.fridge && r.freeze ? ' · ' : ''}{r.freeze ? `❄️ Freezer: ${r.freeze}` : ''}</p>{/if}
    {#if r.tip}<p class="small muted">💡 {r.tip}</p>{/if}
  </div>
{/snippet}

{#snippet knifeList()}
  {#each lists.knife as g}
    <div class="card">
      <h3>🔪 {g.name}</h3>
      <p class="small muted" style="margin:0 0 4px">{g.how}</p>
      {#each g.items as it, ii}{@render box(`k|${g.key}|${ii}`, `<b>${esc(it.text)}</b>${it.cut ? ` — ${esc(it.cut)}` : ''} <span class="muted">· ${esc(it.recipe)}</span>${it.note ? `<br><span class="small">${esc(it.note)}</span>` : ''}${it.from ? ` <span class="pill">${it.from === 'steps' ? 'from the recipe' : 'usual prep'}</span>` : ''}`)}{/each}
    </div>
  {/each}
{/snippet}

{#snippet spiceList()}
  <p class="small muted" style="margin-top:0">Measure each recipe's seasonings into its own small bowl and label it, so you just tip it in when the recipe calls for it.</p>
  {#each lists.spices as x}
    <div class="card">
      {@render box(`sp|${x.id}`, `<b>${esc(x.recipe)}</b>`)}
      <ul style="margin:0 0 4px;padding-left:50px">{#each x.items as y}<li class="small">{y}</li>{/each}</ul>
    </div>
  {/each}
{/snippet}

{#snippet subBlock(e)}
  {@const r = e.r}
  {@const k = kOf[r.id] || 1}
  <div class="card">
    <h3 style="margin-bottom:4px">{r.title} <span class="pill" class:acc={k !== 1}>{times(k)}</span></h3>
    {#if r.ing.length}
      <details open={e.js[0] === 0}>
        <summary class="small muted">Ingredients{k !== 1 ? (k === 0.5 ? ' (already halved)' : ` (already ×${k})`) : ''}</summary>
        <ul style="margin:4px 0 0;padding-left:18px">
          {#each r.ing as x}{#if /:$/.test(String(x).trim())}<li class="small" style="list-style:none;margin:6px 0 0 -18px"><b>{x}</b></li>{:else}<li class="small">{scaleLine(x, k)}</li>{/if}{/each}
        </ul>
      </details>
    {/if}
    {#each e.js as j}
      {@const d = durationOf(r.steps[j])}
      {@const lo = d ? scaleTime(r.steps[j], d.mins, k, setup, pansOf(r)) : null}
      {@const hi = d ? scaleTime(r.steps[j], d.maxMins, k, setup, pansOf(r)) : null}
      {@render box(`s|${r.id}|${j}`, `${scaleStepHtml(r.steps[j], k)}${d ? ` <span class="pill acc">⏱ ${lo.perRound === hi.perRound ? lo.perRound : `${lo.perRound}–${hi.perRound}`} min${lo.rounds > 1 ? ` × ${lo.rounds} rounds` : ''}</span>${lo.note ? `<br><span class="small muted">📏 ${esc(lo.note)}</span>` : ''}` : ''}`)}
    {/each}
    {#if e.js.includes(r.steps.length - 1)}
      {#if r.fridge || r.freeze}<p class="small muted">{r.fridge ? `🧊 Fridge: ${r.fridge}` : ''}{r.fridge && r.freeze ? ' · ' : ''}{r.freeze ? `❄️ Freezer: ${r.freeze}` : ''}</p>{/if}
      {#if r.tip}<p class="small muted">💡 {r.tip}</p>{/if}
    {/if}
  </div>
{/snippet}

<div class="page wide" style="padding-bottom:calc(var(--nav) + 90px)">
  <h1>{!big && mode === 'simple' ? "What's for dinner" : 'Cook day'}</h1>
  <p class="sentence small" style="margin:0 0 8px">Cooking from
    <select class="inl" value={cart ? cart.id : 'home'} onchange={(e) => openCart(e.currentTarget.value)}>
      <option value="home">🏠 {currentHousehold()?.name || 'Home'} list</option>
      {#each app.carts as c (c.id)}<option value={c.id}>📋 {c.name}{c.people ? ` (${c.people})` : ''}</option>{/each}
    </select>
    {#if cart}<span class="muted"> — cooked once for {cart.people || '?'} people</span>{/if}
  </p>
  {#if allRecipes.length}
    <div class="seg" style="margin:0 0 8px">
      <button class:on={prepStyle === 'single'} onclick={() => setStyle('single')}>🍽 One meal at a time</button>
      <button class:on={prepStyle === 'full'} onclick={() => setStyle('full')}>🥘 Full meal prep</button>
    </div>
    {#if big && prepStyle === 'single' && allRecipes.length > 1}
      <p class="sentence small" style="margin:0 0 8px">Cooking now: <select class="inl" value={recipes[0]?.id} onchange={(e) => { focusId = e.currentTarget.value; at = 0; }}>{#each allRecipes as r}<option value={r.id}>{r.title}</option>{/each}</select></p>
    {/if}
    {#if prepStyle === 'full' || big}
      <details class="small" style="margin:0 0 8px" open={Object.values(freezeSel).some(Boolean)}>
        <summary>🧊 Make freezer meals {Object.values(freezeSel).filter(Boolean).length ? `(${Object.values(freezeSel).filter(Boolean).length})` : ''}</summary>
        <p class="muted" style="margin:6px 0 4px">Pick what to pack for the freezer — you'll get a step for cooling, portioning, labeling and reheating.</p>
        <div class="row" style="gap:4px">{#each allRecipes as r}
          {#if canFreeze(r)}<button class="chip" class:on={freezeSel[r.id]} onclick={() => toggleFreeze(r.id)}>{freezeSel[r.id] ? '🧊 ' : ''}{shortTitle(r.title)}</button>
          {:else}<span class="chip" style="opacity:.5" title="Doesn't freeze well">{shortTitle(r.title)} · fridge only</span>{/if}
        {/each}</div>
      </details>
    {/if}
  {/if}
  {#if !recipes.length}
    <p class="muted">{cart ? 'This list has no recipes yet — add some from the 🛒 cart.' : 'No recipes picked for this week yet.'}</p>
    {#if !cart}<button onclick={() => go('plan')}>Plan the week</button>{/if}
  {:else}
    <div class="row" style="justify-content:space-between;margin-bottom:8px">
      {#if big}<div class="seg">
        <button class:on={mode === 'steps'} onclick={resume}>Step by step</button>
        <button class:on={mode === 'overview'} onclick={() => (mode = 'overview')}>Overview</button>
      </div>{:else}<span></span>{/if}
      {#if big && ready && !editSetup}<button class="quiet small" onclick={() => (editSetup = true)}>⚙ Kitchen & serving time</button>{/if}
      <label class="row small" style="gap:6px;cursor:pointer" title="Stops the screen from dimming while you cook">
        <span class="switch"><input type="checkbox" bind:checked={awake} /><span></span></span> Keep screen on
      </label>
    </div>
    {#if big}
      {#if !ready || editSetup}
      <div class="card crowd nocollapse">
        <div class="row" style="gap:16px">
          <div class="stat"><b>{totalPortions || '—'}</b><span>portions</span></div>
          <div class="stat"><b>{recipes.length}</b><span>recipes</span></div>
          <div class="stat"><b>{fmtMins(totalMins)}</b><span>hands-on + cooking</span></div>
          <div class="stat"><b>{gear.items.reduce((a, e) => a + (e.count || 1), 0)}</b><span>pans & tools</span></div>
        </div>
        <div class="small" style="margin-top:8px">{#each recipes as r}<div>• <b>{shortTitle(r.title)}</b> — {por[r.id]?.portions || r.servings || '?'} portions = {times(kOf[r.id])}{r.servings ? ` (recipe serves ${r.servings})` : ''}</div>{/each}</div>
        <p class="small muted" style="margin:6px 0 0">Every amount in the steps below is already scaled for your group.</p>
        {#if ready && !editSetup}
          <p class="small" style="margin:8px 0 0">🍽 Serving at <b>{clock(serveDate)}</b> · start by <b>{starts[0] ? clock(starts[0]) : '—'}</b> · {KITCHENS.find((x) => x[0] === kitchen)?.[1] || ''} · {setup.ovens} oven{setup.ovens === 1 ? '' : 's'}, {setup.racks} pans each <button class="quiet" onclick={() => (editSetup = true)}>Change</button></p>
        {/if}
      </div>
      {/if}
      {#if !ready || editSetup}
        <div class="card nocollapse setupcard">
          <h3 style="margin-top:0">Before you start: your kitchen</h3>
          <p class="small muted" style="margin-top:0">This sets the timeline and how many pans go in at once, so the steps fit your space.</p>
          <p class="sentence small">Serving at <input class="inl" type="time" bind:value={form.serveAt} /></p>
          <p class="small" style="margin:6px 0 4px">Where are you cooking this one?</p>
          <div class="row" style="gap:4px">{#each KITCHENS as [k, l]}<button class="chip" class:on={form.kitchen === k} onclick={() => { form.kitchen = k; Object.assign(form, { ovens: KITCHEN_DEFAULTS[k].ovens, racks: KITCHEN_DEFAULTS[k].racks }); }}>{l}</button>{/each}</div>
          {#if form.kitchen}
            <p class="sentence small" style="margin-top:8px">
              <input class="inl" type="number" min="1" max="10" bind:value={form.ovens} style="width:3em" /> oven{Number(form.ovens) === 1 ? '' : 's'}, each fits
              <input class="inl" type="number" min="1" max="20" bind:value={form.racks} style="width:3em" /> sheet pans or baking dishes at once.
            </p>
            <p class="small muted" style="margin:0">{form.kitchen === 'commercial' ? 'Commercial ovens usually fit 6–8 full sheet pans (or 2–4 hotel pans per deck).' : 'Most home ovens fit 2 pans (two racks); 3 if you have a third rack and rotate.'}{form.kitchen === 'both' ? ' Cook at home, chill fast, carry it cold, and reheat on site to 165°F — allow an extra 45 min.' : ''}</p>
          {/if}
          <div class="row" style="margin-top:10px"><button onclick={saveSetup} disabled={!form.kitchen || !form.serveAt}>{ready ? 'Save' : 'Start cooking →'}</button>{#if editSetup}<button class="quiet" onclick={() => (editSetup = false)}>Cancel</button>{/if}</div>
        </div>
      {/if}
    {/if}
    {#if big && !ready}
    {:else}
    {#if mode !== 'simple'}
    <p class="small muted" style="margin:-2px 0 6px">{doneCount} of {allKeys.length} done · about {fmtMins(totalMins)} total{leftMins && leftMins < totalMins ? `, ${fmtMins(leftMins)} to go` : ''}</p>
    <div style="height:6px;background:var(--tint);border-radius:99px;overflow:hidden;margin-bottom:10px"><div style="height:100%;background:var(--green);width:{allKeys.length ? (doneCount / allKeys.length) * 100 : 0}%"></div></div>
    {/if}
    {#if err}<div class="err">⚠️ {err}</div>{/if}
    {#if mode === 'simple'}
      <Tonight onsteps={() => { setStyle('full'); resume(); }} />
      <details><summary class="small" style="margin:8px 0">All of this week's recipes ({recipes.length})</summary>
        {#each recipes as r}{@render recipeBlock(r)}{/each}
      </details>
    {:else}
    {#each missingGuides as g}
      <div class="note small">The cook-day plan for <b>{g.mine.map((r) => r.title).join(', ')}</b> isn't saved yet, so those recipes are listed one at a time.
        <button class="quiet" onclick={() => fetchGuide(g.url)} disabled={loading === g.url}>{#if loading === g.url}<span class="spinner"></span>{/if} Load its plan</button></div>
    {/each}

    {#if mode === 'steps' && cur}
     {#if big}
       {@const behind = starts[idx] ? Math.round((now - starts[idx].getTime()) / 60000) : 0}
       <div class="statusbar">
         <div><b>⏳ {left(serveDate.getTime() - now)}</b><span>serving at {clock(serveDate)}</span></div>
         <div><b>{allKeys.length - doneCount}</b><span>items left · {steps.filter((st) => !stepDone(st)).length} steps</span></div>
         <div><b class:late={behind > 5 && !stepDone(cur)}>{behind > 5 && !stepDone(cur) ? `${fmtMins(behind)} behind` : behind < -5 ? `${fmtMins(-behind)} ahead` : 'On time'}</b><span>this step {starts[idx] ? `starts ${clock(starts[idx])}` : ''}</span></div>
         {#if steps[idx + 1]}<div class="next"><span>Up next</span><b>{starts[idx + 1] ? clock(starts[idx + 1]) + ' · ' : ''}{steps[idx + 1].title}</b></div>{/if}
       </div>
     {/if}
     <div class="prep-grid"><div>
      <p class="small muted" style="margin:0">Step {idx + 1} of {steps.length}</p>
      <p class="small" style="margin:6px 0 0;color:var(--accent);font-weight:650">⏱ {fmtMins(cur.mins, cur.approx) || '—'}{big && starts[idx] ? ` · ${cur.kind === 'pack' ? 'serve' : 'start'} at ${clock(starts[idx])}` : ''}</p>
      <h2 style="margin:2px 0 10px">{stepDone(cur) ? '✓ ' : ''}{cur.title}</h2>
      {#if cur.note}<p class="note small" style="margin:-4px 0 10px">📏 {cur.note}{cur.base && cur.base !== cur.mins ? ` (the recipe says ${fmtMins(cur.base)} for one batch)` : ''}</p>{/if}

      {#if cur.kind === 'setup'}
        <div class="card">
          <p class="small" style="margin-top:0">Clear the counters and empty the dishwasher so you have somewhere to put dirty pans.</p>
          {#if gear.temps.length}<p class="small"><b>🔥 Oven today:</b> {gear.temps.join(', ')} — preheat to the first one in your plan.</p>{/if}
          <h3 style="margin-top:10px">🍳 Pans and appliances</h3>
          {#each gear.items as e}{@render box(`e|${e.name}`, `<b>${esc(e.name)}</b>${e.count > 1 ? ` ×${e.count}` : ''}${e.optional ? ' <span class="pill">optional</span>' : ''} <span class="muted">· ${esc(e.recipes.map(shortTitle).join(', '))}</span>`, true)}{/each}
          {@render box('e|basics', '<b>Cutting board, chef’s knife, measuring cups and spoons</b>', true)}
          {#each lists.setup as g, gi}
            <h3 style="margin-top:10px">{g.what}</h3>
            {#each g.items as it, ii}{@render box(`u|${gi}|${ii}`, `${esc(it.text)} <span class="muted">· ${esc(it.recipe)}</span>`, true)}{/each}
          {/each}
          {#each cur.before as s}
            <h3 style="margin-top:10px">{s.title}</h3>
            <ul style="margin:0;padding-left:18px">{#each s.items as it}<li class="small" style="margin:4px 0">{#if it.label}<b>{it.label}</b> — {/if}{it.text}</li>{/each}</ul>
          {/each}
        </div>
      {:else if cur.kind === 'knife'}
        {@render knifeList()}
      {:else if cur.kind === 'spices'}
        {@render spiceList()}
      {:else if cur.kind === 'time'}
        <div class="card plan-step">{@render box(cur.key, esc(cur.text))}</div>
        {#if cur.knife}<h3 style="margin:14px 0 6px">🔪 What to cut</h3>{@render knifeList()}{/if}
        {#if cur.spices}<h3 style="margin:14px 0 6px">🥄 Measure the seasonings</h3>{@render spiceList()}{/if}
        {#if cur.subs.length > 1}<p class="small muted">Working on {cur.subs.length} recipes at once — do these together.</p>{/if}
        {#each cur.subs as e}{@render subBlock(e)}{/each}
      {:else if cur.kind === 'recipe'}
        {#each cur.subs as e}{@render subBlock(e)}{/each}
      {:else if cur.kind === 'freezer'}
        {@const per = Number(app.plan.household) || 4}
        {@const fz = recipes.filter((r) => freezeSel[r.id] && canFreeze(r)).map((r) => ({ r, f: freezerPlan(r, por[r.id]?.portions || r.servings, per) }))}
        {@const needs = Object.entries(fz.reduce((a, x) => { if (x.f.need) a[x.f.need] = (a[x.f.need] || 0) + x.f.packs; return a; }, {}))}
        <div class="card">
          <p class="small" style="margin-top:0">🧊 Cool everything first: spread it out in shallow pans and get it into the fridge within 2 hours, then pack. Freezer meals keep best for about 3 months.</p>
          {#if needs.length}<p class="small"><b>You'll need:</b> {needs.map(([n, c]) => `${c} ${n}${c === 1 ? '' : 's'}`).join(', ')}, a marker or labels.</p>{/if}
          {#each fz as { r, f }}
            <div class="fz">
              {@render box(`fz|${r.id}`, `<b>${esc(r.title)}</b> → <b>${f.packs} pack${f.packs === 1 ? '' : 's'}</b> of ${f.perPack} servings<br><span class="small">${esc(f.pack)}</span><br><span class="small muted">🏷 Label: ${esc(f.label)}</span>`)}
            </div>
          {/each}
        </div>
      {:else if cur.kind === 'pack' && big}
        <div class="card">
          <h3 style="margin-top:0">🔥 Holding until you serve</h3>
          <ul class="small" style="margin:0;padding-left:18px">
            <li>Keep hot food at <b>140°F or hotter</b> — a 170–200°F oven, chafing dishes, or slow cookers on warm. Cover to stop it drying out.</li>
            <li>Keep cold food at <b>40°F or colder</b> — on ice, or in the fridge until serving.</li>
            <li>Food can sit out for <b>2 hours at most</b> (1 hour if it's over 90°F outside), then refrigerate or toss.</li>
            {#if kitchen === 'both'}<li>Reheating on site: everything to <b>165°F</b> before it goes on the line.</li>{/if}
          </ul>
          <h3>🍽 Serving line</h3>
          <p class="small" style="margin:0 0 4px">Plates → starch → main → veg/salad → sauces → bread → drinks; desserts on a separate table so the line keeps moving.</p>
          {#each recipes as r}
            {@const p = por[r.id]?.portions || r.servings || 0}
            <div class="list-row"><div class="grow"><b class="small">{r.title}</b><div class="small muted">{p} portions{r.servings ? ` · split each batch into ${r.servings} servings` : ''}{p >= 20 ? ' · use a ½-cup or 1-cup scoop so portions stay even' : ''}</div></div></div>
          {/each}
          <h3>📦 After</h3>
          <p class="small" style="margin:0">Cool leftovers fast in shallow containers and fridge within 2 hours. {recipes.some((r) => r.freeze) ? 'Most of these freeze — label with the name and date.' : ''}</p>
        </div>
      {:else if cur.kind === 'pack'}
        <div class="card">
          <p class="small" style="margin-top:0">Let hot food cool (no more than an hour on the counter) before lidding it, then fridge or freeze. Label freezer containers with the name and date.</p>
          {#each recipes as r}
            <div class="list-row"><div class="grow"><b class="small">{r.title}</b><div class="small muted">{r.fridge ? `🧊 Fridge: ${r.fridge}` : '🧊 Fridge'}{r.freeze ? ` · ❄️ Freezer: ${r.freeze}` : ''}</div></div></div>
          {/each}
          <h3 style="margin-top:14px">🥫 Update your pantry</h3>
          {#if pantryDone}
            <p class="ok small">✓ Done. The cooked meals are in your Pantry with their fridge dates.</p>
          {:else}
            <p class="small muted" style="margin:0 0 4px">Checked = used up today. Staples (spices, oil, freezer items) stay unless you check them.</p>
            {#each used as u}
              <label class="check"><input type="checkbox" bind:checked={usedSel[u.p.id]} /><span class="small">{u.p.name}</span></label>
            {/each}
            <button style="margin-top:8px" onclick={updatePantryAfterCooking}>Update pantry{used.length ? ` (${used.filter((u) => usedSel[u.p.id]).length} used up)` : ''}</button>
          {/if}
          {#each guides as g}{#each g.guide?.sections || [] as s}{#if /where it all goes|freeze|storage/i.test(s.title)}
            <h3 style="margin-top:12px">{s.title}</h3>
            <ul style="margin:0;padding-left:18px">{#each s.items as it}<li class="small" style="margin:4px 0">{#if it.label}<b>{it.label}</b> — {/if}{it.text}</li>{/each}</ul>
          {/if}{/each}{/each}
        </div>
      {/if}

      <div class="stepnav">
        <button class="ghost" onclick={() => move(-1)} disabled={idx === 0}>← Back</button>
        <select value={idx} onchange={(e) => { at = Number(e.currentTarget.value); window.scrollTo(0, 0); }} aria-label="Jump to step">{#each steps as s, i}<option value={i}>{i + 1}. {stepDone(s) ? '✓ ' : ''}{s.label}</option>{/each}</select>
        <button onclick={doneNext}>{idx >= steps.length - 1 ? 'Done ✓' : 'Done → Next'}</button>
      </div>
     </div>
     <aside class="prep-aside card">
       <h3>All steps</h3>
       {#each steps as s, i}<button class:on={i === idx} class:done={stepDone(s)} onclick={() => { at = i; window.scrollTo(0, 0); }}>{stepDone(s) ? '✓' : i + 1}. {big && starts[i] ? clock(starts[i]) + ' · ' : ''}{s.label}</button>{/each}
     </aside></div>
    {:else}
      <button style="width:100%;margin-bottom:10px" onclick={resume}>▶ {doneCount ? 'Pick up where you left off' : 'Start cooking'}: step {firstUndone + 1} · {steps[firstUndone]?.label}</button>
      <div class="card">
        <h3>What to make</h3>
        {#each recipes as r}
          <div class="list-row">
            <div class="grow"><b>{r.title}</b>
              <div class="small muted">{r.when}{r.yield ? ` · recipe makes ${r.yield}` : ''}{por[r.id] ? ` · ${por[r.id].portions} portions planned` : ''}</div>
            </div>
            <span class="pill" class:acc={kOf[r.id] !== 1}>{times(kOf[r.id])}</span>
          </div>
        {/each}
      </div>
      {#each guides as g}
        {#if g.guide}
          {@const total = app.recipes.filter((r) => r.source === g.url).length}
          <div class="card">
            <h3>Game plan · <a href={g.url} target="_blank" rel="noopener">{g.guide.title}</a></h3>
            {#if g.mine.length < total}<p class="small muted">You're making {g.mine.length} of this post's {total} recipes, so skip the steps for the others.</p>{/if}
            {#each g.guide.sections as s, si}
              {#if s.kind === 'timeline'}
                <h3 style="margin-top:10px">{s.title}</h3>
                {@const mins = stepMinutes(s.items)}
                {#each s.items as it, ii}{@render box(`t|${g.url}|${si}|${ii}`, `${mins[ii] ? `<b>${fmtMins(mins[ii])}</b> · ` : ''}${it.label ? `<b>${esc(it.label)}</b> — ` : ''}${esc(it.text)}`)}{/each}
              {:else}
                <details style="margin-top:8px"><summary><b>{s.title}</b> <span class="small muted">({s.items.length})</span></summary>
                  <ul style="margin:6px 0 0;padding-left:18px">{#each s.items as it}<li class="small" style="margin:4px 0">{#if it.label}<b>{it.label}</b> — {/if}{it.text}</li>{/each}</ul>
                </details>
              {/if}
            {/each}
          </div>
        {/if}
      {/each}
      <div class="card">
        <h3>Recipe by recipe</h3>
        {#each recipes as r}
          <details style="border-top:1px solid var(--line);padding:8px 0"><summary><b>{r.title}</b></summary>{@render recipeBlock(r)}</details>
        {/each}
      </div>
    {/if}
    {/if}
    {/if}
  {/if}
</div>

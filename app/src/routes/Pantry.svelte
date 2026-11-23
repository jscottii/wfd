<script>
  import AdSlot from '../components/AdSlot.svelte';
  import PantryScan from '../components/PantryScan.svelte';
  let scanning = $state(false);
  import { app, addPantry, updatePantry, removePantry, toast } from '../lib/db.svelte.js';
  import { parseAdd, daysLeft, covers, placeFor, useByFor } from '../lib/pantry.js';
  import { showAmount, splitContainer, joinContainer, UNIT_CHOICES, CONTAINERS, SIZE_UNITS } from '../lib/units.js';
  const relative = $derived(app.settings.units === 'relative');
  const mode = $derived(app.settings.units === 'metric' ? 'metric' : 'imperial');
  const LEVELS = [['plenty', 'Plenty'], ['some', 'Some'], ['low', 'Low'], ['out', 'Out']];
  // amount = "2 lb" or, for containers, "2 can (15 oz)" — a can or bag needs its size
  function setAmount(p, a) {
    const v = joinContainer(a.n, a.unit, a.size, a.sizeUnit);
    set(p, { amount: v, level: v && Number(a.n) <= 0 ? 'out' : p.level === 'low' ? 'low' : 'plenty' });
  }
  let { go } = $props();

  const PLACES = [['fridge', '🧊 Fridge'], ['freezer', '❄️ Freezer'], ['pantry', '🥫 Pantry'], ['counter', '🧺 Counter']];
  

  let text = $state(''), busy = $state(false), err = $state(''), q = $state(''), editing = $state(''), showQuick = $state(false);
  let preview = $derived(text.trim() ? parseAdd(text, app.items) : []);
  let soon = $derived(app.pantry.filter((p) => { const d = daysLeft(p.use_by); return d != null && d <= 3; }).sort((a, b) => (a.use_by || '').localeCompare(b.use_by || '')));
  let shown = $derived(app.pantry.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())));
  let byPlace = $derived(PLACES.map(([k, label]) => ({ k, label, rows: shown.filter((p) => (p.place || 'pantry') === k).sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.rows.length));
  // your usual items not in the pantry yet, by aisle
  let quick = $derived.by(() => {
    const g = {};
    app.items.filter((i) => !app.pantry.some((p) => p.item_id === i.id)).forEach((i) => (g[i.cat || 'Other'] = g[i.cat || 'Other'] || []).push(i));
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  });

  async function addTyped(e) {
    e?.preventDefault(); if (!preview.length) return;
    busy = true; err = '';
    try { await addPantry(preview); toast(`✓ Added ${preview.length} to your pantry`); text = ''; } catch (x) { err = x.message; }
    busy = false;
  }
  async function addItem(i) { try { await addPantry([{ item_id: i.id }]); toast(`✓ ${i.name}`); } catch (x) { err = x.message; } }
  async function set(p, patch) { try { await updatePantry(p.id, patch); } catch (x) { err = x.message; } }
  async function drop(p) { try { await removePantry(p.id); toast(`Removed ${p.name}`); } catch (x) { err = x.message; } }
  const when = (p) => {
    const d = daysLeft(p.use_by);
    if (d == null) return '';
    return d < 0 ? `past use-by (${-d}d)` : d === 0 ? 'use today' : d === 1 ? 'use by tomorrow' : `use within ${d} days`;
  };
</script>

<div class="page wide">
  <div class="spread"><h1>Pantry</h1><button class="quiet" onclick={() => go('plan')}>Plan from it →</button></div>
  <button class="ghost" style="width:100%;margin-bottom:8px" onclick={() => (scanning = true)}>📷 Add with the camera — scan barcodes or snap the fridge</button>
  {#if scanning}<PantryScan onclose={() => (scanning = false)} />{/if}
  <p class="muted small">What you already have. Trips skip it, and the Plan tab suggests recipes that use it up. Things you check off on a trip or a receipt are added for you.</p>
  {#if err}<div class="err">⚠️ {err}</div>{/if}
  <AdSlot slot="pantry" format="banner" />

  <form class="card" onsubmit={addTyped}>
    <label class="f">Add what you have — separate with commas or new lines
      <textarea bind:value={text} rows="2" placeholder="2 lb chicken thighs, rice, half a bag of spinach, 1 dozen eggs"></textarea>
    </label>
    {#if preview.length}
      <div class="row" style="gap:4px;margin-bottom:8px">
        {#each preview as r}<span class="pill" class:live={r.item_id}>{r.amount ? showAmount(r.amount, mode) + ' ' : ''}{r.name}{r.item_id ? '' : ' (new)'}</span>{/each}
      </div>
    {/if}
    <div class="row">
      <button type="submit" disabled={busy || !preview.length}>{#if busy}<span class="spinner"></span>{/if} Add {preview.length || ''}</button>
      <button type="button" class="ghost" onclick={() => (showQuick = !showQuick)}>{showQuick ? 'Hide' : 'Pick from'} your usual items</button>
    </div>
    <p class="small muted" style="margin-bottom:0">Green = matched to an item on your shopping list, so the trip knows to skip it.</p>
  </form>

  {#if showQuick}
    <div class="card">
      <h3>Tap what you have</h3>
      {#each quick as [cat, list]}
        <p class="small muted" style="margin:10px 0 2px">{cat}</p>
        {#each list as i}<button class="chip" onclick={() => addItem(i)}>+ {i.name}</button>{/each}
      {/each}
      {#if !quick.length}<p class="small muted">Everything on your list is already in the pantry.</p>{/if}
    </div>
  {/if}

  {#if soon.length}
    <div class="card" style="border-color:var(--accent)">
      <h3>⏳ Use soon</h3>
      {#each soon as p}
        <div class="list-row"><span><b>{p.name}</b> <span class="small" style="color:var(--accent)">{when(p)}</span></span><button class="quiet" onclick={() => go('plan')}>Find a recipe →</button></div>
      {/each}
    </div>
  {/if}

  {#if app.pantry.length > 8}<input placeholder="Search your pantry" bind:value={q} style="margin:8px 0" />{/if}

  {#if !app.pantry.length}
    <div class="note">Your pantry is empty. Type a few things above, or tap <b>Pick from your usual items</b>. Start with the 10–20 things you always have.</div>
  {/if}

  {#each byPlace as g}
    <div class="card">
      <h3>{g.label} <span class="small muted" style="font-weight:400">({g.rows.length})</span></h3>
      {#each g.rows as p (p.id)}
        {@const a = splitContainer(p.amount, mode)}
        {@const needSize = CONTAINERS.includes(a.unit) && !a.size}
        <div class="list-row" style="flex-wrap:wrap">
          <button class="grow quiet" style="text-align:left;justify-content:flex-start;color:var(--ink);padding:0" onclick={() => (editing = editing === p.id ? '' : p.id)}>
            <span><b>{p.name}</b>{#if !relative && !p.amount}<span class="small" style="color:var(--accent)"> · how much?</span>{:else if !relative && needSize}<span class="small" style="color:var(--accent)"> · what size {a.unit}?</span>{/if}{#if when(p)}<br><span class="small" style:color={daysLeft(p.use_by) <= 2 ? 'var(--accent)' : 'var(--muted)'}>{when(p)}</span>{/if}</span>
          </button>
          {#if relative}
            <div class="seg" style="flex:none">{#each LEVELS as [k, label]}<button class:on={(p.level || 'plenty') === k} class="lv lv-{k}" onclick={() => set(p, { level: k })}>{label}</button>{/each}</div>
          {:else}
            <div class="amt">
              <input type="number" min="0" step="any" inputmode="decimal" placeholder="?" value={a.n ?? ''} aria-label="How much of {p.name}" onchange={(e) => setAmount(p, { ...a, n: e.currentTarget.value })} />
              <select value={a.unit} aria-label="Unit" onchange={(e) => setAmount(p, { ...a, n: a.n ?? 1, unit: e.currentTarget.value })}>{#each UNIT_CHOICES[mode] as u}<option value={u}>{u}</option>{/each}</select>
              {#if CONTAINERS.includes(a.unit)}
                <span class="small muted" style="align-self:center">of</span>
                <input type="number" min="0" step="any" inputmode="decimal" placeholder="size" class:missing={needSize} value={a.size ?? ''} aria-label="Size of each {a.unit}" onchange={(e) => setAmount(p, { ...a, n: a.n ?? 1, size: e.currentTarget.value })} />
                <select value={a.sizeUnit} aria-label="Size unit" onchange={(e) => setAmount(p, { ...a, n: a.n ?? 1, sizeUnit: e.currentTarget.value })}>{#each SIZE_UNITS[mode] as u}<option value={u}>{u}</option>{/each}</select>
              {/if}
            </div>
            <button class="chip" class:on={['low', 'out'].includes(p.level)} title="Put it on the shopping list" onclick={() => set(p, { level: ['low', 'out'].includes(p.level) ? 'plenty' : 'low' })}>{['low', 'out'].includes(p.level) ? '🛒 On list' : '+ List'}</button>
          {/if}
          <button class="quiet" aria-label="Used up" title="Used up — remove" onclick={() => drop(p)}>✕</button>
          {#if editing === p.id}
            <div class="grid2" style="width:100%;margin-top:6px">
              <label class="f">Where<select value={p.place || 'pantry'} onchange={(e) => set(p, { place: e.currentTarget.value })}>{#each PLACES as [k, label]}<option value={k}>{label}</option>{/each}</select></label>
              <label class="f">Use by<input type="date" value={p.use_by || ''} onchange={(e) => set(p, { use_by: e.currentTarget.value || null })} /></label>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
  {#if app.pantry.length}<p class="small muted">Tap an item to change its amount, where it lives, or its use-by date. {relative ? 'Low or Out puts it back on the shopping list.' : 'Fill in how much you have — for a can, jar or bag, also its size. Set it to 0, or tap + List, to put it on the shopping list.'} Change how amounts work in More → Settings.</p>{/if}
</div>

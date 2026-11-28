<script>
  import Hello from '../components/Hello.svelte';
  import GuestNote from '../components/GuestNote.svelte';
  import AdSlot from '../components/AdSlot.svelte';
  import PantryScan from '../components/PantryScan.svelte';
  let scanning = $state(false);
  import { ui } from '../lib/ui.svelte.js';
  $effect(() => { const a = ui.act; if (a === 'pantry') { ui.act = ''; adding = true; setTimeout(() => document.querySelector('.addform textarea')?.focus(), 60); } else if (a === 'scan') { ui.act = ''; scanning = true; } });
  import { app, addPantry, updatePantry, removePantry, toast, isGuest } from '../lib/db.svelte.js';
  import { parseAdd, daysLeft, covers, placeFor, useByFor } from '../lib/pantry.js';
  import { suggest, learn, loadIngredients } from '../lib/fuzzy.js';
  learn(app.items.map((i) => i.name)); loadIngredients();
  // suggestions for the item being typed (the text after the last comma or new line)
  const lastPart = (t) => (String(t).split(/[\n,;]/).pop() || '').replace(/^\s*(?:\d+(?:[./]\d+)?|[½¼¾⅓⅔]|half(?: a)?|a|an)\s*(?:lbs?|pounds?|oz|bags?|cans?|jars?|boxes?|packs?|bunch(?:es)?|dozen|cups?|gallons?|bottles?)?\.?\s*(?:of\s+)?/i, '').trim();
  let ideasFor = $derived(lastPart(text).length >= 3 ? suggest(lastPart(text), [...new Set(app.items.map((i) => i.name))], 4).filter((n) => n.toLowerCase() !== lastPart(text).toLowerCase()) : []);
  function pickIdea(n) { const parts = text.split(/([\n,;])/); const last = parts.pop(); const lead = last.match(/^\s*(?:\d+(?:[./]\d+)?|[½¼¾⅓⅔]|half(?: a)?|a|an)?\s*(?:lbs?|pounds?|oz|bags?|cans?|jars?|boxes?|packs?|bunch(?:es)?|dozen|cups?|gallons?|bottles?)?\.?\s*(?:of\s+)?/i)?.[0] || ''; text = parts.join('') + lead + n + ', '; }
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
  

  let adding = $state(!app.pantry.length), showSoon = $state(false);
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
  <Hello page="pantry" />
  <div class="spread"><h1>Pantry</h1><button class="quiet" onclick={() => go('plan')}>Plan from it →</button></div>
  {#if isGuest()}<GuestNote text="The pantry is for accounts. You can look around, but you'll need an account to add or change things." />{/if}
  <fieldset class="locked" disabled={isGuest()}>
  {#if err}<div class="err">⚠️ {err}</div>{/if}
  {#if soon.length}
    <div class="soonline">
      <span>⏳ <b>{soon.length} item{soon.length === 1 ? '' : 's'}</b> expiring soon</span>
      <span class="row" style="gap:4px"><button class="quiet" onclick={() => (showSoon = !showSoon)}>{showSoon ? 'Hide' : 'Update'}</button><button class="quiet" onclick={() => go('plan')}>Use in this week's plan →</button></span>
    </div>
    {#if showSoon}
      <div class="card" style="margin-top:6px">
        {#each soon as p (p.id)}
          <div class="list-row"><span class="grow"><b>{p.name}</b> <span class="small" style="color:var(--accent)">{when(p)}</span></span>
            <input type="date" value={p.use_by || ''} aria-label="Use by for {p.name}" onchange={(e) => set(p, { use_by: e.currentTarget.value || null })} style="width:auto" />
            <button class="quiet" aria-label="Used up" title="Used up — remove" onclick={() => drop(p)}>✕</button></div>
        {/each}
        <p class="small muted" style="margin:6px 0 0">Change a date, or ✕ what's used up or thrown out.</p>
      </div>
    {/if}
  {/if}

  {#if app.pantry.length > 8}<input placeholder="Search your pantry" bind:value={q} style="margin:8px 0" />{/if}
  {#if !app.pantry.length && !adding}
    <div class="note">Your pantry is empty. Tap the round <b>WFD</b> button below to add the 10–20 things you always have.</div>
  {/if}

  {#each byPlace as g (g.k)}
    <details class="card pl-sec" open={!!q || byPlace.length === 1}>
      <summary><b>{g.label}</b> <span class="small muted">({g.rows.length}{g.rows.some((p) => (daysLeft(p.use_by) ?? 99) <= 3) ? ` · ${g.rows.filter((p) => (daysLeft(p.use_by) ?? 99) <= 3).length} use soon` : ''})</span></summary>
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
    </details>
  {/each}

  {#if adding}
    <button class="ghost" style="width:100%;margin-bottom:8px" onclick={() => (scanning = true)}>📷 Add with the camera — scan barcodes or snap the fridge</button>
  <form class="card addform" onsubmit={addTyped}>
    <div class="spread"><h3 style="margin:0">Add to your pantry</h3><button type="button" class="quiet" aria-label="Close" onclick={() => (adding = false)}>✕</button></div>
    <label class="f">Add what you have — separate with commas or new lines
      <textarea bind:value={text} rows="2" placeholder="2 lb chicken thighs, rice, half a bag of spinach, 1 dozen eggs" autocomplete="off" autocorrect="on" spellcheck="true"></textarea>
    </label>
    {#if ideasFor.length}<div class="row" style="gap:4px;margin:-4px 0 8px"><span class="small muted">Did you mean</span>{#each ideasFor as n}<button type="button" class="chip" onclick={() => pickIdea(n)}>{n}</button>{/each}</div>{/if}
    {#if preview.length}
      <div class="row" style="gap:4px;margin-bottom:8px">
        {#each preview as r}<span class="pill" class:live={r.item_id}>{r.amount ? showAmount(r.amount, mode) + ' ' : ''}{r.name}{r.item_id ? '' : ' (new)'}{r.fixedFrom ? ` ← “${r.fixedFrom}”` : ''}</span>{/each}
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

  {/if}
  {#if scanning}<PantryScan onclose={() => (scanning = false)} />{/if}
  <AdSlot slot="pantry" format="banner" />
  {#if app.pantry.length}<p class="small muted">Tap an item to change its amount, where it lives, or its use-by date. {relative ? 'Low or Out puts it back on the shopping list.' : 'Fill in how much you have — for a can, jar or bag, also its size. Set it to 0, or tap + List, to put it on the shopping list.'} Change how amounts work in More → Settings.</p>{/if}
  {#if app.pantry.length > 6}<AdSlot slot="pantry-bottom" format="rect" />{/if}
  </fieldset>
</div>

<style>
  .soonline { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px; background: var(--accent-soft); color: var(--accent-dark); border-radius: 12px; padding: 9px 12px; margin: 4px 0 10px; font-size: 14px; }
  .soonline button { padding: 2px 6px; font-weight: 600; }
  .pl-sec > summary { cursor: pointer; display: flex; gap: 6px; align-items: center; list-style: none; }
  .pl-sec > summary::-webkit-details-marker { display: none; }
  .pl-sec > summary::after { content: '▾'; margin-left: auto; color: var(--muted); }
  .pl-sec[open] > summary { margin-bottom: 6px; }
  .pl-sec[open] > summary::after { content: '▴'; }
  .addwrap { display: flex; justify-content: center; margin: 14px 0 10px; }
  .addbtn { width: 52px; height: 52px; border-radius: 50%; font-size: 30px; line-height: 1; padding: 0; box-shadow: 0 4px 14px rgba(31, 95, 209, .3); }
  .addbtn.on { background: var(--card); color: var(--accent); border: 1px solid var(--line); box-shadow: none; }
</style>

<script>
  import Hello from '../components/Hello.svelte';
  import { app, need, refreshPrices, setPriceByHand, toast } from '../lib/db.svelte.js';
  import { trip } from '../lib/trip.svelte.js';
  let { go } = $props();
  let busy = $state(false), prog = $state(''), result = $state(null), err = $state(''), editing = $state(null), val = $state('');
  let n = $derived(need());
  let items = $derived(app.items.filter((i) => n[i.id]));
  let stores = $derived(app.stores.filter((s) => s.enabled !== false));
  let cats = $derived([...new Set(['Produce', 'Meat', 'Dairy & Eggs', 'Frozen', 'Bakery', 'Pantry', ...items.map((i) => i.cat)])].filter((c) => items.some((i) => i.cat === c)));
  const fmt = (x) => (x == null ? '—' : '$' + Number(x).toFixed(2));
  function cheapest(id) { const row = app.prices[id] || {}; let b = null; for (const [s, e] of Object.entries(row)) if (e.price != null && !e.notFound && (b == null || e.price < row[b].price)) b = s; return b; }

  async function check() {
    busy = true; err = ''; result = null;
    try { result = await refreshPrices(trip.geo, (i, t, name) => (prog = `${i} of ${t}: ${name}`)); trip.result = null; }
    catch (e) { err = e.message; }
    busy = false; prog = '';
  }
  async function saveHand() {
    try { await setPriceByHand(editing.item, editing.store, val, true); editing = null; toast('✓ Price saved and locked'); } catch (e) { toast(e.message); }
  }
</script>

<div class="page">
  <Hello page="prices" />
  <h1>Prices</h1>
  <div class="card">
    {#if app.hasSerpKey}
      <div class="spread"><div class="small muted">Live prices from Google Shopping · {app.serpUsage.n} of {app.serpUsage.limit} searches used this month</div></div>
      <button style="margin-top:8px" onclick={check} disabled={busy}>{#if busy}<span class="spinner"></span> {prog || 'Checking…'}{:else}Check this week's prices{/if}</button>
      <p class="small muted">One search per item covers Safeway, Lucky, Raley's and Target together. Items checked in the last 2 days are skipped. Trader Joe's, Grocery Outlet and Costco prices come from your receipts.</p>
    {:else}
      <p class="small">Live price checks aren’t switched on yet. Prices are estimates, your own entries, and your receipts.</p>
    {/if}
    {#if err}<div class="err">⚠️ {err}</div>{/if}
    {#if result}<div class="ok">✓ {result.live} prices updated from {result.searched} searches{result.recent ? ` · ${result.recent} checked recently, skipped` : ''}{result.budget ? ' · monthly limit reached' : ''}. Searched near {result.location}.</div>{/if}
  </div>
  <p class="small muted">Tap any price to type your own (it's locked so checks won't overwrite it). <b style="color:var(--green)">Green</b> = cheapest.</p>
  <div class="tw card" style="padding:4px 6px">
    <table>
      <thead><tr><th>Item</th>{#each stores as s}<th class="num">{s.short.replace(/\s*\(.*\)/, '')}</th>{/each}</tr></thead>
      <tbody>
        {#each cats as c}
          <tr><td colspan={stores.length + 1} style="background:#f3ece2;font-weight:700;font-size:12px">{c}</td></tr>
          {#each items.filter((i) => i.cat === c) as it}
            {@const best = cheapest(it.id)}
            <tr>
              <td><b>{it.name}</b><div class="small muted">{it.qty}</div></td>
              {#each stores as s}
                {@const e = app.prices[it.id]?.[s.id]}
                <td class="num" style:color={best === s.id ? 'var(--green)' : ''} style:font-weight={best === s.id ? 700 : 400} onclick={() => { editing = { item: it.id, store: s.id, name: it.name, store_: s.short }; val = e?.price ?? ''; }}>
                  {#if e?.notFound}<span class="pill red">out</span>{:else}{fmt(e?.price)}{/if}
                  {#if e?.source === 'live' || e?.source === 'receipt'}<div class="small" style="color:var(--green)">●</div>{:else if e?.locked}<div class="small">🔒</div>{/if}
                </td>
              {/each}
            </tr>
          {/each}
        {/each}
      </tbody>
    </table>
  </div>
  {#if editing}
    <div class="card"><h3>{editing.name} at {editing.store_}</h3>
      <div class="row"><input type="number" step="0.01" bind:value={val} style="width:120px" placeholder="0.00" /><button onclick={saveHand}>Save</button><button class="ghost" onclick={() => (editing = null)}>Cancel</button></div>
      <p class="small muted">Price for the quantity on your list. Leave blank to clear.</p></div>
  {/if}
</div>

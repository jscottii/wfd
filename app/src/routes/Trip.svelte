<script>
  import AdSlot from '../components/AdSlot.svelte';
  import InstallApp from '../components/InstallApp.svelte';
  import { install } from '../lib/install.svelte.js';
  let hideInstall = $state(localStorage.getItem('mp-hide-install') === '1' || matchMedia('(min-width: 900px)').matches);
  import { app, need, portions, itemById, setHave, toast, owned, updatePantry, tripCart, editPurchase } from '../lib/db.svelte.js';
  import CartEditor from '../components/CartEditor.svelte';
  import OrderBar from '../components/OrderBar.svelte';
  import { linesFor } from '../lib/order.js';
  import Carts from './Carts.svelte';
  import { ui, openCart } from '../lib/ui.svelte.js';
  import { untrack } from 'svelte';
  import { covers } from '../lib/pantry.js';
  import { showAmount } from '../lib/units.js';
  import { shareText, tap } from '../lib/native.js';
  import { trip, planTrip, chosen, drawLine, useMyLocation, startAddress } from '../lib/trip.svelte.js';
  import { directionsUrl } from '../lib/maps.js';
  import RouteMap from '../components/RouteMap.svelte';
  let { go } = $props();

  const fmt = (x) => '$' + Number(x || 0).toFixed(2);
  let plan = $derived(chosen());
  let n = $derived(need());
  let por = $derived(portions());
  let active = $derived(app.recipes.filter((r) => r.active));
  let bought = $derived(app.items.filter((i) => n[i.id] && i.have));
  let left = $derived(app.items.filter((i) => n[i.id] && !owned(i)).length);
  let fromPantry = $derived(app.items.filter((i) => n[i.id] && !i.have && covers(app.pantry, i.id)));
  async function buyAnyway(i) { const p = app.pantry.find((x) => x.item_id === i.id); if (p) { await updatePantry(p.id, { level: 'low' }); trip.result = null; planTrip(); } }
  let byId = $derived(Object.fromEntries(trip.stores.map((s) => [s.id, s])));
  let unpriced = $derived(plan ? plan.stores.reduce((a, s) => a + s.items.filter((i) => i.source === 'unpriced').length, 0) : 0);
  let mapsLink = $derived(plan ? directionsUrl(startAddress(), app.settings.homeAddress, plan.stores.map((s) => byId[s.id]).filter(Boolean)) : '');

  $effect(() => { if (ui.cart === 'home' && app.ready && app.household && !trip.result && !trip.busy && !trip.error && left) planTrip(); });
  // finishing the list opens the receipt check
  let prevLeft = untrack(() => left);
  $effect(() => { const l = left; untrack(() => { if (prevLeft > 0 && l === 0 && cart.length) ui.receipt = true; prevLeft = l; }); });
  $effect(() => { if (ui.cart !== 'home' && ui.cart !== 'new' && !app.carts.some((c) => c.id === ui.cart)) openCart('home'); });

  // the cart: what's checked off and what it cost
  let cart = $derived(tripCart());
  let cartTotal = $derived(cart.reduce((a, c) => a + (c.paid || 0), 0));
  let cartOf = $derived(Object.fromEntries(cart.map((c) => [c.item.id, c])));
  let toGo = $derived(plan ? plan.stores.reduce((a, st) => a + st.items.filter((it) => !itemById(it.id)?.have).reduce((b, it) => b + (it.price || 0), 0), 0) : 0);
  let editing = $state('');
  async function saveEdit(c, v, storeId) { try { await editPurchase(c.p, v, c.item, storeId); editing = ''; toast(`✓ ${c.item.name}: ${fmt(v.total ?? (v.unit_price != null ? v.qty * v.unit_price : 0))}`); } catch (e) { toast(e.message); } }
  const big = $derived(app.settings.audience === 'group');

  async function tick(it, storeId) {
    tap();
    try { await setHave([it.id], true, storeId, { [it.id]: it.price }); toast(`✓ ${it.name}`); } catch (e) { toast(e.message); }
  }
  async function shareList() {
    const lines = ['🛒 Shopping list'];
    plan.stores.forEach((st) => {
      const left = st.items.filter((it) => !itemById(it.id)?.have);
      if (!left.length) return;
      lines.push('', `${byId[st.id]?.short || st.name}:`);
      left.forEach((it) => lines.push(`☐ ${it.name}${itemById(it.id)?.qty ? ' — ' + itemById(it.id).qty : ''}`));
    });
    try { if ((await shareText('Shopping list', lines.join('\n'))) === 'copied') toast('✓ List copied'); } catch (e) { toast(e.message); }
  }
  async function untick(id) { try { await setHave([id], false); } catch (e) { toast(e.message); } }
  async function here() { try { await useMyLocation(); trip.result = null; planTrip(); } catch (e) { trip.error = e.message; } }
  function setStart(m) { trip.start = m; if (m === 'home') { trip.result = null; planTrip(); } }
  const src = (s) => ({ live: 'live', receipt: 'receipt', you: 'yours', estimate: 'est.', unpriced: 'no price yet' })[s] || s;
</script>

<div class="page">
  {#if !hideInstall && !install.installed}<div style="position:relative"><InstallApp compact /><button class="quiet small" style="position:absolute;right:4px;bottom:2px" onclick={() => { hideInstall = true; localStorage.setItem('mp-hide-install', '1'); }}>Not now</button></div>{/if}
  {#if ui.cart !== 'home'}
    <div class="spread"><h1>{ui.cart === 'new' ? 'New project list' : app.carts.find((c) => c.id === ui.cart)?.name || 'Project list'}</h1><button class="quiet" onclick={() => openCart('home')}>🏠 Home list</button></div>
    <Carts {go} cartId={ui.cart === 'new' ? '' : ui.cart} oncreated={(id) => openCart(id)} />
  {:else}
  <div class="spread"><h1>This week's list</h1><button class="quiet" onclick={() => (ui.receipt = true)}>🧾 Scan receipt</button></div>
  <p class="muted small">
    {active.length} recipe{active.length === 1 ? '' : 's'}{Object.keys(por).length ? ` · ${Object.values(por).reduce((a, x) => a + x.portions, 0)} portions planned` : ''} · {left} item{left === 1 ? '' : 's'} to buy{bought.length ? `, ${bought.length} already bought` : ''}
  </p>
  <AdSlot slot="shop" format="banner" />

  <div class="card">
    <div class="small muted" style="margin-bottom:6px">Starting from (you always end at home)</div>
    <div class="seg">
      <button class:on={trip.start === 'home'} onclick={() => setStart('home')}>🏠 Home</button>
      <button class:on={trip.start === 'here'} onclick={here}>📍 Here</button>
      <button class:on={trip.start === 'typed'} onclick={() => (trip.start = 'typed')}>✏️ Address</button>
    </div>
    {#if trip.start === 'typed'}
      <div class="row" style="margin-top:8px">
        <input class="grow" placeholder="e.g. 1 Broadway, Oakland" bind:value={trip.typed} onkeydown={(e) => e.key === 'Enter' && planTrip()} />
        <button onclick={() => { trip.result = null; planTrip(); }}>Go</button>
      </div>
    {/if}
    <p class="small muted" style="margin:8px 0 0">Each chain uses its location nearest to where you start.</p>
  </div>

  {#if trip.error}<div class="err">⚠️ {trip.error} <button class="quiet" onclick={() => { trip.error = ''; planTrip(); }}>Try again</button></div>{/if}

  {#if trip.busy}
    <div class="card row"><span class="spinner"></span> {trip.step || 'Planning…'}</div>
  {:else if trip.result?.empty || (!left && app.ready)}
    <div class="hero"><h2>Nothing left to buy 🎉</h2><p class="muted">Everything on this week's list is checked off. <a href="#plan" onclick={(e) => { e.preventDefault(); go('plan'); }}>Plan next week</a>.</p></div>
  {:else if plan}
    <div class="hero">
      <div class="spread"><div><div class="muted small">{trip.choice === 'fastest' ? 'Fastest' : trip.choice === 'cheapest' ? 'Cheapest' : 'Best'} trip · {plan.stores.length} stop{plan.stores.length === 1 ? '' : 's'}</div><div class="big">{fmt(plan.groceries)}</div><div class="small muted">groceries · plus about {fmt(plan.fuel)} gas</div></div>
        <a class="btn" href={mapsLink} target="_blank" rel="noopener">Directions ↗</a>
        <button class="ghost" onclick={shareList}>Share list</button></div>
      <div class="row" style="margin-top:12px">
        <div class="stat"><b>{fmt(plan.groceries + plan.fuel)}</b><span>with gas</span></div>
        <div class="stat"><b>{plan.driveMin + plan.stopMin} min</b><span>{plan.driveMin} driving</span></div>
        <div class="stat"><b>{plan.miles} mi</b><span>{fmt(plan.fuel)} gas</span></div>
      </div>
    </div>

    <div class="seg" style="margin-bottom:6px">
      {#each [['best', 'Best overall'], ['cheapest', 'Cheapest'], ['fastest', 'Fastest']] as [k, label]}
        <button class:on={trip.choice === k} onclick={() => { trip.choice = k; drawLine(); }}>{label}</button>
      {/each}
    </div>

    {#if trip.line?.coords}<RouteMap line={trip.line} />{/if}
    {#if unpriced}<div class="note">{unpriced} item{unpriced === 1 ? ' has' : 's have'} no price yet, so {unpriced === 1 ? "it's" : "they're"} placed at a stop you're already making. {app.hasSerpKey ? 'Check prices on the Prices page' : 'Scan a receipt'} to fill {unpriced === 1 ? 'it' : 'them'} in.</div>{/if}
    {#if plan.missing.length}<div class="note">Not found on this route: {plan.missing.join(', ')}</div>{/if}

    <div class="cartbar">
      <div><span class="small muted">🛒 In your cart</span><br><b class="big">{fmt(cartTotal)}</b> <span class="small muted">· {cart.length} item{cart.length === 1 ? '' : 's'}</span></div>
      <div style="text-align:right"><span class="small muted">Still to get</span><br><b>{fmt(toGo)}</b> <span class="small muted">· {left} item{left === 1 ? '' : 's'}</span></div>
    </div>
    {#if big && cart.length}<p class="small muted" style="margin:-4px 0 8px">{Object.values(por).reduce((a, x) => a + x.portions, 0) ? `About ${fmt((cartTotal + toGo) / Object.values(por).reduce((a, x) => a + x.portions, 0))} per portion so far.` : ''}</p>{/if}

    {#each plan.stores as st, i}
      {@const loc = byId[st.id]}
      <div class="stop">
        <div class="spread"><h2 style="margin:0"><span class="stopnum">{i + 1}</span>{loc?.short || st.short}</h2><b>{fmt(st.subtotal)}</b></div>
        <div class="small muted" style="margin:2px 0 6px 32px">{loc?.label || ''}{loc?.fromStart ? ` · ${loc.fromStart.minutes} min from start` : ''}</div>
        {#each st.items as it}
          {@const item = itemById(it.id)}
          <label class="check" class:done={item?.have}>
            <input type="checkbox" checked={!!item?.have} onchange={(e) => (e.currentTarget.checked ? tick(it, st.id) : untick(it.id))} />
            <span class="grow"><b style:text-decoration={item?.have ? 'line-through' : ''}>{it.name}</b> <span class="muted small">{showAmount(item?.qty, app.settings.units === 'metric' ? 'metric' : 'imperial')}{n[it.id] && n[it.id] !== item?.units ? ` · buy ${n[it.id]}` : ''}</span><br>
              {#if item?.have && cartOf[it.id]}
                {@const c = cartOf[it.id]}
                <span class="small"><b>{c.paid != null ? fmt(c.paid) : 'no price'}</b>{c.p?.qty ? ` · ${c.p.qty} ${c.p.unit}${c.p.unit_price ? ` @ ${fmt(c.p.unit_price)}` : ''}` : ''}{!c.edited ? ' (estimate)' : ''}</span>
                <button type="button" class="ghost editbtn" onclick={(e) => { e.preventDefault(); e.stopPropagation(); editing = editing === it.id ? '' : it.id; }}>✎ Edit</button>
              {:else}
                <span class="small muted">{it.source === 'unpriced' ? 'price not checked yet' : fmt(it.price)} <span class="pill" class:live={it.source === 'live' || it.source === 'receipt'}>{src(it.source)}</span></span>
              {/if}</span>
          </label>
          {#if editing === it.id && cartOf[it.id]}
            {@const c = cartOf[it.id]}
            <CartEditor large={big} line={{ qty: c.p?.qty ?? n[it.id] ?? 1, unit: c.p?.unit || 'each', unit_price: c.p?.unit_price, total: c.paid ?? it.price ?? null }} onsave={(v) => saveEdit(c, v, st.id)} oncancel={() => (editing = '')} />
          {/if}
        {/each}
      </div>
    {/each}
    <div class="card">
      <h3 style="margin:0">🚚 Rather have it delivered?</h3>
      <OrderBar title="WFD · this week" lines={linesFor(Object.fromEntries(Object.entries(n).filter(([id]) => { const i = itemById(id); return i && !owned(i); })))} {go} />
    </div>
    <p class="small muted">Compared {trip.result.considered} store combinations. <button class="quiet" onclick={planTrip}>↻ Re-plan</button></p>
  {/if}

  {#if fromPantry.length}
    <div class="card"><h3>🥫 Skipping — already in your pantry ({fromPantry.length})</h3>
      {#each fromPantry as b}<div class="list-row"><span>{b.name}</span><button class="quiet" onclick={() => buyAnyway(b)}>Buy anyway</button></div>{/each}
      <p class="small muted" style="margin-bottom:0">Running low? "Buy anyway" marks it low in your pantry and adds it back to the trip.</p>
    </div>
  {/if}
  {#if bought.length}
    <div class="card"><h3>Already bought ({bought.length})</h3>
      {#each bought as b}
        {@const c = cartOf[b.id]}
        <div class="list-row"><span class="grow">{b.name} <span class="small muted">{b.haveOn}</span><br><span class="small"><b>{c?.paid != null ? fmt(c.paid) : 'no price'}</b>{c?.p?.qty ? ` · ${c.p.qty} ${c.p.unit}${c.p.unit_price ? ` @ ${fmt(c.p.unit_price)}` : ''}` : ''}{c && !c.edited ? ' (estimate)' : ''}</span></span>
          <button class="ghost editbtn" onclick={() => (editing = editing === 'b' + b.id ? '' : 'b' + b.id)}>✎ Edit</button><button class="quiet" onclick={() => untick(b.id)}>Undo</button></div>
        {#if editing === 'b' + b.id && c}
          <CartEditor large={big} line={{ qty: c.p?.qty ?? n[b.id] ?? 1, unit: c.p?.unit || 'each', unit_price: c.p?.unit_price, total: c.paid }} onsave={(v) => saveEdit(c, v, c.p?.store_id || null)} oncancel={() => (editing = '')} />
        {/if}
      {/each}
    </div>
  {/if}
  {/if}
  <AdSlot slot="shop-bottom" format="rect" />
</div>

<script>
  import RecipePicker from '../components/RecipePicker.svelte';
  import OrderBar from '../components/OrderBar.svelte';
  import { untrack, onDestroy } from 'svelte';
  import { app, createCart, saveCart, archiveCart, cheapestPrice, toast } from '../lib/db.svelte.js';
  import { recipeLines, mergeLines, totals, orderLines, readAmount } from '../lib/carts.js';
  import { parseAdd } from '../lib/pantry.js';
  import { orderInstacart, orderAmazon, copyAndOpen, shareList, STORES_LINKS } from '../lib/order.js';
  import CartEditor from '../components/CartEditor.svelte';
  let { go, cartId = '', oncreated = null } = $props();

  const big = $derived(app.settings.audience === 'group');
  const fmt = (x) => (x == null ? '—' : '$' + Number(x).toFixed(2));
  let openId = $state(cartId), newName = $state(''), newPeople = $state(''), newDate = $state(''), newBudget = $state('');
  let err = $state(''), busy = $state(''), editing = $state(''), addText = $state(''), saved = $state('');

  // a working copy of the open cart, saved a moment after each change
  let cart = $state(null);
  $effect(() => { const id = cartId; untrack(() => { if (id !== openId) openId = id; }); });
  $effect(() => { const id = openId; untrack(() => { flush(); const c = app.carts.find((x) => x.id === id); cart = c ? structuredClone($state.snapshot(c)) : null; last = cart ? JSON.stringify(cart) : ''; }); });
  let last = '', t = null;
  function flush() { clearTimeout(t); if (!cart) return; const snap = $state.snapshot(cart), js = JSON.stringify(snap); if (js === last) return; last = js; saved = 'Saving…'; saveCart(snap).then(() => (saved = 'Saved ✓')).catch((e) => { err = e.message; saved = ''; }); }
  $effect(() => { if (!cart) return; const js = JSON.stringify($state.snapshot(cart)); untrack(() => { if (js !== last) { clearTimeout(t); t = setTimeout(flush, 500); } }); });
  onDestroy(flush);

  let sum = $derived(cart ? totals(cart.lines) : null);
  const byId = (id) => app.recipes.find((r) => r.id === id);
  let picking = $state(false);

  async function make(e) {
    e.preventDefault(); err = '';
    try { const c = await createCart({ name: newName, people: newPeople, event_date: newDate, budget: newBudget }); openId = c.id; oncreated?.(c.id); newName = newPeople = newDate = newBudget = ''; } catch (x) { err = x.message; }
  }
  function rebuild() {
    const people = Number(cart.people) || 0;
    const rs = cart.recipes.map((x) => ({ r: byId(x.id), portions: x.portions || people || byId(x.id)?.servings }));
    cart.lines = mergeLines(cart.lines, recipeLines(rs, app.items, cheapestPrice));
  }
  function addRecipe(id) { if (!id || cart.recipes.some((x) => x.id === id)) return; cart.recipes.push({ id, portions: Number(cart.people) || null }); rebuild(); }
  function dropRecipe(id) { cart.recipes = cart.recipes.filter((x) => x.id !== id); cart.lines = cart.lines.filter((l) => l.manual || !(l.recipes || []).every((t) => t === byId(id)?.title)); rebuild(); }
  function setPeople(v) { cart.people = Math.max(1, Number(v) || 1); cart.recipes.forEach((x) => (x.portions = cart.people)); rebuild(); }
  function addTyped(e) {
    e.preventDefault();
    parseAdd(addText, app.items).forEach((r) => {
      const a = readAmount(r.amount), each = r.item_id ? cheapestPrice(r.item_id) : 0;
      cart.lines.push({ key: 'm:' + Date.now() + Math.random().toString(36).slice(2, 6), item_id: r.item_id, name: r.name, qty: a.qty, unit: r.item_id && a.unit === 'each' ? 'pack' : a.unit, size: '', unit_price: each || null, total: each ? Math.round(each * a.qty * 100) / 100 : null, est: true, done: false, manual: true });
    });
    addText = '';
  }
  async function order(how) {
    const lines = orderLines(cart.lines), title = `WFD · ${cart.name}`;
    busy = how; err = '';
    try {
      if (how === 'instacart') await orderInstacart(title, lines);
      else if (how === 'amazon') orderAmazon(lines);
      else if (how === 'walmart' || how === 'safeway') { await copyAndOpen(title, lines, STORES_LINKS[how]); toast('✓ List copied — paste it into the store’s search'); }
      else if ((await shareList(title, lines)) === 'copied') toast('✓ List copied');
    } catch (x) { err = x.message; }
    busy = '';
  }
  async function done() { flush(); try { await archiveCart(cart.id); openId = ''; oncreated?.('home'); toast('✓ List archived'); } catch (x) { err = x.message; } }
</script>

<div>
  {#if err}<div class="err">⚠️ {err}</div>{/if}
  {#if !openId || !cart}
    <form class="card" onsubmit={make}>
      <h3>Name your project list</h3>
      <p class="small muted" style="margin-top:0">A birthday dinner, Thanksgiving, chili for youth group — separate from your weekly plan, with its own list and total.</p>
      <label class="f">Name<input bind:value={newName} placeholder="e.g. Friday chili for youth group" required /></label>
      <div class="grid2">
        <label class="f">How many people?<input type="number" min="1" bind:value={newPeople} placeholder="e.g. 40" /></label>
        <label class="f">Date (optional)<input type="date" bind:value={newDate} /></label>
        <label class="f">Budget (optional)<input type="number" min="0" step="1" bind:value={newBudget} placeholder="$" /></label>
      </div>
      <button type="submit" disabled={!newName.trim()}>Create list</button>
    </form>
  {:else}
    <div class="card">
      <div class="spread">
        <input style="font:700 20px/1.2 Georgia,serif;border:0;padding:0;background:transparent" bind:value={cart.name} />
        <span class="small muted">{saved}</span>
      </div>
      <div class="row small" style="gap:10px;margin:6px 0">
        <span>People <input type="number" min="1" style="width:70px;padding:4px" value={cart.people || ''} onchange={(e) => setPeople(e.currentTarget.value)} /></span>
        <span>Date <input type="date" style="padding:4px" bind:value={cart.event_date} /></span>
        <span>Budget $<input type="number" min="0" style="width:80px;padding:4px" bind:value={cart.budget} /></span>
      </div>

      <div class="cartbar" style="position:static">
        <div><span class="small muted">🛒 In cart</span><br><b class="big">{fmt(sum.inCart)}</b> <span class="small muted">· {sum.done} of {sum.count}</span></div>
        <div style="text-align:right"><span class="small muted">Whole list</span><br><b>{fmt(sum.all)}</b>{#if cart.budget}<span class="small" style:color={sum.all > cart.budget ? 'var(--red)' : 'var(--green)'}> · {sum.all > cart.budget ? `${fmt(sum.all - cart.budget)} over` : `${fmt(cart.budget - sum.all)} under`} budget</span>{/if}</div>
      </div>
      {#if (big || cart.people >= 10) && cart.people && sum.all}<p class="small muted" style="margin:-4px 0 6px">{fmt(sum.all / cart.people)} per person{sum.unpriced ? ` · ${sum.unpriced} item${sum.unpriced === 1 ? '' : 's'} without a price yet` : ''}</p>{/if}

      <h3 style="margin-top:12px">Recipes</h3>
      {#each cart.recipes as x}
        {@const r = byId(x.id)}
        {#if r}
          <div class="list-row"><span class="grow"><b>{r.title}</b>{#if big || cart.people >= 10}<span class="small muted"> · {x.portions || cart.people || r.servings} portions{r.servings ? ` (${Math.round(((x.portions || cart.people || r.servings) / r.servings) * 10) / 10}× the recipe)` : ''}</span>{/if}</span>
            {#if big || cart.people >= 10}<input type="number" min="1" style="width:70px;padding:4px" value={x.portions || ''} onchange={(e) => { x.portions = Number(e.currentTarget.value) || null; rebuild(); }} title="Portions" />{/if}
            <button class="quiet" onclick={() => dropRecipe(x.id)}>✕</button></div>
        {/if}
      {/each}
      <button class="ghost" onclick={() => (picking = true)}>＋ Add a recipe</button>
      {#if picking}<RecipePicker title="Add a recipe to {cart.name || 'this cart'}" exclude={cart.recipes.map((x) => x.id)} onpick={addRecipe} onclose={() => (picking = false)} />{/if}

      <h3 style="margin-top:14px">List</h3>
      <form class="row" onsubmit={addTyped}><input class="grow" bind:value={addText} placeholder="Add items: 10 lb ground beef, 4 cans beans, paper plates" /><button type="submit" class="ghost" disabled={!addText.trim()}>Add</button></form>
      {#each cart.lines as l (l.key)}
        <label class="check" style:opacity={l.done ? 0.5 : 1}>
          <input type="checkbox" bind:checked={l.done} />
          <span class="grow"><b style:text-decoration={l.done ? 'line-through' : ''}>{l.name}</b>
            <span class="small muted">{l.unit === 'pack' ? `${l.qty} × ${l.size || 'pack'}` : `${l.qty} ${l.unit}`}</span><br>
            <span class="small">{fmt(l.total)}{l.unit_price && l.qty !== 1 ? ` · ${fmt(l.unit_price)}/${l.unit === 'pack' ? 'pack' : l.unit}` : ''}{l.est && l.total != null ? ' (estimate)' : ''}{big && l.recipes?.length ? ` · for ${l.recipes.join(', ')}` : ''}</span>
            <button type="button" class="quiet" style="padding:0 6px" onclick={(e) => { e.preventDefault(); editing = editing === l.key ? '' : l.key; }}>Edit</button>
            <button type="button" class="quiet" style="padding:0 6px" onclick={(e) => { e.preventDefault(); cart.lines = cart.lines.filter((x) => x !== l); }}>Remove</button></span>
        </label>
        {#if editing === l.key}
          <CartEditor large={big} line={l} onsave={(v) => { Object.assign(l, v, { est: false, total: v.total ?? (v.unit_price != null ? Math.round(v.qty * v.unit_price * 100) / 100 : null) }); editing = ''; }} oncancel={() => (editing = '')} />
        {/if}
      {/each}
      {#if !cart.lines.length}<p class="small muted">Add a recipe or type items above.</p>{/if}

      {#if cart.lines.some((l) => !l.done)}
        <OrderBar title={`WFD · ${cart.name}`} lines={orderLines(cart.lines.filter((l) => !l.done))} {go} />
      {/if}
      <div class="row" style="margin-top:12px"><button class="quiet" onclick={done}>Finished — archive this cart</button></div>
    </div>
  {/if}
</div>

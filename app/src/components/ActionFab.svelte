<script>
  // The round WFD button in the middle of the bottom bar. Tap it for the things you can add from this page.
  import { app, addExtras, toast, isGuest } from '../lib/db.svelte.js';
  import { ui } from '../lib/ui.svelte.js';
  import { trip } from '../lib/trip.svelte.js';
  let { page, go } = $props();
  const wide = matchMedia('(min-width: 900px)');
  let open = $state(false), quick = $state(false), text = $state(''), busy = $state(false);

  // [id, icon, label, page it happens on]
  const A = {
    list: ['list', '🛒', 'Add to shopping list'],
    pantry: ['pantry', '🥫', 'Add to pantry', 'pantry'],
    scan: ['scan', '📷', 'Scan into pantry', 'pantry'],
    recipe: ['recipe', '🔗', 'Add a recipe', 'recipes'],
    find: ['find', '🔎', 'Find new recipes', 'recipes'],
    write: ['write', '✏️', 'Type a recipe', 'recipes'],
    pick: ['pick', '✨', 'Pick meals for me', 'plan'],
    lists: ['lists', '📋', 'Switch list'],
    receipt: ['receipt', '🧾', 'Scan a receipt'],
    ahead: ['ahead', '📅', 'Plan ahead'],
    soon: ['soon', '⏰', 'Use what expires soon', 'plan'],
  };
  // at most three, and only what fits the page you're on
  const BY_PAGE = {
    plan: ['pick', 'recipe', 'ahead'],
    trip: ['list', 'lists', 'receipt'],
    pantry: ['pantry', 'scan', 'soon'],
    recipes: ['recipe', 'find', 'write'],
    prep: ['list'],
    more: ['list', 'pantry', 'recipe'],
    prices: ['list'],
  };
  let items = $derived((BY_PAGE[page] || ['list']).map((k) => A[k]).filter((a) => !(isGuest() && (a[0] === 'pantry' || a[0] === 'scan'))));

  function run([id, , , where]) {
    open = false;
    if (id === 'list') { quick = true; return; }
    if (id === 'lists') { ui.cartPicker = true; return; }
    if (id === 'receipt') { ui.receipt = true; return; }
    if (id === 'ahead') { ui.calendar = true; window.scrollTo(0, 0); return; }
    if (where && where !== page) go(where);
    ui.act = id;   // the page picks this up and opens the right form
  }
  // a little arc above the button
  const pos = (i, n) => {
    const t = n === 1 ? 0.5 : i / (n - 1), a = wide.matches ? Math.PI / 2 + t * Math.PI / 2 : Math.PI * (0.83 - 0.66 * t), r = 116;
    return `--x:${Math.round(Math.cos(a) * r)}px;--y:${-Math.round(Math.sin(a) * r) - 28}px;--d:${i * 30}ms`;
  };
  async function addToList(e) {
    e?.preventDefault(); if (!text.trim()) return;
    busy = true;
    try { const a = await addExtras(text); toast(`✓ Added ${a.join(', ')} to the list`); text = ''; quick = false; trip.result = null; } catch (x) { toast(x.message); }
    busy = false;
  }
  $effect(() => { const k = (e) => e.key === 'Escape' && ((open = false), (quick = false)); addEventListener('keydown', k); return () => removeEventListener('keydown', k); });
</script>

{#if open}<div class="fab-back" role="presentation" onclick={() => (open = false)}></div>{/if}
<div class="fab-wrap">
  {#if open}
    {#each items as a, i (a[0])}
      <button class="fab-opt" style={pos(i, items.length)} onclick={() => run(a)}><span class="fo-ic">{a[1]}</span><span class="fo-l">{a[2]}</span></button>
    {/each}
  {/if}
  <button class="wfd-fab" class:open aria-label={open ? 'Close' : 'Add something'} aria-expanded={open} onclick={() => (open = !open)}>
    <img src="wfd-mark.svg" alt="WFD" width="48" height="16" />
    {#if app.carts.length && page === 'trip' && !open}<span class="fab-badge">{app.carts.length + 1}</span>{/if}
  </button>
</div>

{#if quick}
  <div class="sheet-back" role="presentation" onclick={() => (quick = false)}></div>
  <form class="sheet qa" onsubmit={addToList} aria-label="Add to the shopping list">
    <h3 style="margin:0 0 4px">Add to this week's list</h3>
    <p class="small muted" style="margin:0 0 8px">Anything you want to buy, for a meal or not.</p>
    <!-- svelte-ignore a11y_autofocus -->
    <input bind:value={text} autofocus placeholder="paper towels, 2 milk, bananas…" enterkeyhint="done" autocomplete="off" />
    <div class="row" style="margin-top:10px"><button disabled={busy || !text.trim()}>{#if busy}<span class="spinner"></span>{/if} Add</button><button type="button" class="quiet" onclick={() => (quick = false)}>Cancel</button></div>
  </form>
{/if}

<style>
  .fab-wrap { position: fixed; left: 50%; bottom: calc(var(--nav) + env(safe-area-inset-bottom) - 44px); width: 66px; height: 66px; transform: translateX(-50%); z-index: 56; }
  .wfd-fab { position: relative; width: 66px; height: 66px; border-radius: 50%; padding: 0; display: grid; place-items: center; background: var(--accent); border: 4px solid var(--bg, #fffdf9); box-shadow: 0 6px 18px rgba(31, 95, 209, .4); transition: transform .2s; }
  .wfd-fab img { width: 48px; height: auto; display: block; transition: transform .2s; }
  .wfd-fab.open img { transform: rotate(-12deg) scale(.9); }
  .wfd-fab:active { transform: scale(.94); }
  .fab-back { position: fixed; inset: 0; background: rgba(20, 30, 50, .5); z-index: 55; }
  .fab-opt { position: absolute; left: 50%; top: 50%; width: 118px; margin: -30px 0 0 -59px; display: flex; flex-direction: column; align-items: center; gap: 3px; background: transparent; color: #fff; padding: 0; font-weight: 600;
    transform: translate(var(--x), var(--y)); animation: pop .22s ease-out both; animation-delay: var(--d); }
  .fo-ic { width: 54px; height: 54px; border-radius: 50%; background: var(--card, #fff); display: grid; place-items: center; font-size: 26px; box-shadow: 0 4px 12px rgba(0, 0, 0, .25); }
  .fo-l { white-space: nowrap; font-size: 14px; font-weight: 700; line-height: 1.2; text-align: center; color: var(--ink, #1d2230); background: var(--card, #fff); border-radius: 10px; padding: 3px 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, .2); }
  @keyframes pop { from { transform: translate(0, 0) scale(.3); opacity: 0; } to { transform: translate(var(--x), var(--y)) scale(1); opacity: 1; } }
  .qa { left: 50%; right: auto; transform: translateX(-50%); }
  @media (min-width: 900px) { .fab-wrap { left: auto; right: 28px; bottom: 28px; transform: none; } }
</style>

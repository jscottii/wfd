<script>
  import { track } from '../lib/db.svelte.js';
  import { shareList } from '../lib/order.js';
  // Delivery without connecting anything: copy the list, then paste it into whichever grocery app you already use.
  let { title, lines, go = null } = $props();
  let copied = $state(false), err = $state(''), showText = $state(false);
  // one item per line: easy to paste into a store's search, a notes app or a text to whoever is shopping
  const text = $derived(lines.map((l) => `${l.name}${l.qty ? ` (${l.qty})` : ''}${l.count > 1 ? ` ×${l.count}` : ''}`).join('\n'));
  const SITES = [
    ['Instacart', 'https://www.instacart.com/store'],
    ['Walmart', 'https://www.walmart.com/cp/grocery/976759'],
    ['Amazon Fresh', 'https://www.amazon.com/alm/storefront?almBrandId=QW1hem9uIEZyZXNo'],
    ['Target', 'https://www.target.com/c/grocery/-/N-5xt1a'],
    ['Safeway', 'https://www.safeway.com/shop/aisles.html'],
  ];
  async function copy() {
    err = '';
    try { await navigator.clipboard.writeText(text); copied = true; track('list_copied', { items: lines.length }); }
    catch { showText = true; err = 'Your browser didn’t let WFD copy. Press and hold the list below to copy it.'; }
  }
  const openSite = (name, url) => { track('delivery_open', { store: name }); window.open(url, '_blank', 'noopener'); };
</script>

{#if lines.length}
  <p class="small muted" style="margin:4px 0 8px">Copy your list, open the grocery app you already use, and paste it in. No WFD sign-in or connection needed: you check out on their site as usual.</p>
  <div class="row" style="gap:6px">
    <button onclick={copy}>{copied ? '✓ Copied' : `📋 Copy list (${lines.length} item${lines.length === 1 ? '' : 's'})`}</button>
    <button class="ghost" onclick={() => (showText = !showText)}>{showText ? 'Hide list' : 'See list'}</button>
    <button class="quiet" onclick={() => shareList(title, lines).catch(() => {})}>Share…</button>
  </div>
  {#if err}<div class="err small">⚠️ {err}</div>{/if}
  {#if showText}<textarea class="small" readonly rows={Math.min(10, lines.length + 1)} style="width:100%;margin-top:8px" onfocus={(e) => e.currentTarget.select()}>{text}</textarea>{/if}
  {#if copied}
    <p class="small" style="margin:10px 0 6px"><b>Now paste it into:</b></p>
    <div class="row" style="gap:6px">{#each SITES as [name, url]}<button class="ghost" onclick={() => openSite(name, url)}>{name} ↗</button>{/each}</div>
    <p class="small muted" style="margin:6px 0 0">Tip: paste into the store's search one item at a time, or keep the list open in your notes while you add to the cart.</p>
  {/if}
{/if}

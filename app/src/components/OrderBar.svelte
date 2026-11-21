<script>
  import { app, toast, track } from '../lib/db.svelte.js';
  import { orderInstacart, orderAmazon, orderWalmart, copyAndOpen, shareList, STORES_LINKS } from '../lib/order.js';
  let { title, lines, go = null } = $props();
  let busy = $state(''), err = $state(''), note = $state('');
  async function order(how) {
    err = ''; note = ''; busy = how; track('order_click', { store: how });
    try {
      if (how === 'instacart') { const r = await orderInstacart(title, lines); if (r.test) toast('Opened Instacart’s test site — use a live key for real orders'); }
      else if (how === 'amazon') { if (orderAmazon(lines) === 'copy') { await copyAndOpen(title, lines, STORES_LINKS.amazon); toast('✓ List copied — paste it into Amazon Fresh search'); } }
      else if (how === 'walmart' && app.canWalmart) {
        const r = await orderWalmart(lines);
        note = `Walmart opened with ${r.found.length} item${r.found.length === 1 ? '' : 's'} in your cart — sign in with your Walmart+ account to check out with free delivery.${r.missing.length ? ` Not found: ${r.missing.join(', ')}.` : ''}`;
      }
      else if (how === 'walmart' || how === 'safeway') { await copyAndOpen(title, lines, STORES_LINKS[how]); toast(how === 'walmart' ? '✓ List copied — sign in to Walmart+ and paste it into search' : '✓ List copied — paste it into the store’s search'); }
      else if ((await shareList(title, lines)) === 'copied') toast('✓ List copied');
    } catch (e) { err = e.message; }
    busy = '';
  }
  const ic = $derived(app.settings.instacartStore?.name);
</script>

{#if lines.length}
  <div class="row" style="gap:6px;margin-top:8px">
    <button onclick={() => order('instacart')} disabled={!!busy}>{#if busy === 'instacart'}<span class="spinner"></span>{/if} {ic ? `${ic} (Instacart)` : 'Instacart · Costco same-day'}</button>
    <button class="ghost" onclick={() => order('walmart')} disabled={!!busy}>{#if busy === 'walmart'}<span class="spinner"></span>{/if} Walmart+</button>
    <button class="ghost" onclick={() => order('amazon')}>Amazon Fresh / Whole Foods</button>
    <button class="quiet" onclick={() => order('share')}>Share list</button>
  </div>
  {#if err}<div class="err small">⚠️ {err}</div>{/if}
  {#if note}<div class="ok small">{note}</div>{/if}
  <p class="small muted" style="margin:4px 0 0">These fill the store’s cart; you sign in on their site and check out. Pick your usual Instacart store (Costco, Safeway…) in Settings.</p>
{/if}

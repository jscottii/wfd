<script>
  import { onMount } from 'svelte';
  import { app, track } from '../lib/db.svelte.js';
  import { ADSENSE_CLIENT, ADSENSE_SLOT, ADSENSE_ANCHOR_SLOT } from '../lib/config.js';
  import { isNative } from '../lib/native.js';
  import { showNativeBanner, hideNativeBanner } from '../lib/ads.js';
  // The always-visible ad: a slim banner pinned just above the tab bar on the planning, shopping and pantry screens.
  // Web uses AdSense; the phone app uses an AdMob banner in the same place. Can be closed for the rest of the visit.
  let { page } = $props();
  const PAGES = ['plan', 'trip', 'pantry', 'recipes'];
  let closed = $state((() => { try { return sessionStorage.getItem('wfd-anchor-closed') === '1'; } catch { return false; } })());
  const slotId = ADSENSE_ANCHOR_SLOT || ADSENSE_SLOT;
  const eligible = $derived(!app.plus && !closed && PAGES.includes(page));
  const webLive = $derived(eligible && !isNative() && !!ADSENSE_CLIENT && !!slotId);
  const preview = $derived(eligible && !webLive && !isNative() && !!app.settings.adPreview && app.isAdmin);
  const shown = $derived(webLive || preview);
  $effect(() => { document.body.classList.toggle('with-anchor', shown || (isNative() && eligible)); return () => document.body.classList.remove('with-anchor'); });
  // phone app: AdMob draws its own banner natively, above the tab bar
  $effect(() => { if (!isNative()) return; if (eligible) showNativeBanner(); else hideNativeBanner(); });
  let el = $state(null), pushed = false;
  $effect(() => {
    if (!webLive || !el || pushed) return;
    pushed = true;
    if (!document.querySelector('script[data-adsense]')) {
      const s = document.createElement('script'); s.async = true; s.dataset.adsense = '1'; s.crossOrigin = 'anonymous';
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`; document.head.appendChild(s);
    }
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
  });
  let counted = false;
  $effect(() => { if (shown && !counted) { counted = true; track('ad_impression', { slot: 'anchor', format: 'anchor', preview: !webLive }); } });
  function close() { closed = true; try { sessionStorage.setItem('wfd-anchor-closed', '1'); } catch {} track('ad_close', { slot: 'anchor' }); }
  const goPlus = (e) => { e.preventDefault(); sessionStorage.setItem('mp-more-tab', 'settings'); location.hash = 'more'; };
</script>

{#if shown}
  <div class="anchor-ad" role="complementary" aria-label="Advertisement" bind:this={el}>
    <button class="anchor-x" onclick={close} aria-label="Close ad">✕</button>
    {#if webLive}
      <ins class="adsbygoogle" style="display:inline-block;width:100%;height:50px" data-ad-client={ADSENSE_CLIENT} data-ad-slot={slotId}></ins>
    {:else}
      <button class="anchor-body" onclick={() => track('ad_click', { slot: 'anchor', format: 'anchor', preview: true })}>
        <span class="anchor-art">🛒</span><span class="anchor-txt"><span class="small muted">Sponsored · preview (anchor)</span><b>Free delivery on your first grocery order</b></span><span class="anchor-cta">Get it</span>
      </button>
    {/if}
    <a class="anchor-plus" href="#more" onclick={goPlus}>Ad-free</a>
  </div>
{/if}

<style>
  .anchor-ad { position: fixed; left: 0; right: 0; bottom: calc(var(--nav) + env(safe-area-inset-bottom)); height: 58px; z-index: 39; background: #fff; border-top: 1px solid var(--line); box-shadow: 0 -2px 10px rgba(0,0,0,.06); display: flex; align-items: center; gap: 6px; padding: 4px 8px 4px 4px; }
  .anchor-x { background: transparent; color: var(--muted); padding: 4px 6px; font-size: 13px; flex: none; }
  .anchor-ad ins { flex: 1; min-width: 0; }
  .anchor-body { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; background: transparent; color: var(--ink); padding: 0; font-weight: 400; text-align: left; justify-content: flex-start; }
  .anchor-art { width: 44px; height: 44px; display: grid; place-items: center; background: #fff7e6; border-radius: 8px; font-size: 22px; flex: none; }
  .anchor-txt { display: flex; flex-direction: column; min-width: 0; font-size: 13px; }
  .anchor-txt b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .anchor-cta { background: #f2a33a; color: #2b1a00; font-weight: 700; border-radius: 999px; padding: 6px 12px; font-size: 13px; flex: none; }
  .anchor-plus { font-size: 11px; color: var(--accent); flex: none; }
  @media (min-width: 900px) { .anchor-ad { left: var(--side); bottom: 0; } }
</style>

<script>
  import { onMount } from 'svelte';
  import { app, track } from '../lib/db.svelte.js';
  import { ADSENSE_CLIENT, ADSENSE_SLOT } from '../lib/config.js';
  import { isNative } from '../lib/native.js';
  // An ad space on planning/shopping screens. Never on Prep, never for WFD Plus members.
  // Live when AdSense IDs are set; otherwise admins can switch on "preview ad slots" to see where ads go.
  let { slot = 'banner', format = 'banner' } = $props();   // format: banner (wide strip) | native (looks like a list row) | rect (300×250 box)
  const live = $derived(!!ADSENSE_CLIENT && !!ADSENSE_SLOT && !app.plus && !isNative());
  const preview = $derived(!live && !app.plus && !!app.settings.adPreview && app.isAdmin);
  const SAMPLES = {
    banner: { brand: 'FreshCo Market', head: '20% off produce this week', cta: 'Shop deals', art: '🥬🍅🥕' },
    native: { brand: 'Sponsored · Kitchen Pro', head: 'Sheet pans that never warp — 3-pack $24', cta: 'See it', art: '🍳' },
    rect: { brand: 'Sponsored · MealBox', head: 'First box of meal kits, 50% off', sub: 'Chef-designed dinners delivered weekly', cta: 'Claim offer', art: '📦🥗' },
  };
  const ad = $derived(SAMPLES[format] || SAMPLES.banner);
  let el = $state(null), seen = false;
  onMount(() => {
    if (!live && !preview) return;
    if (live) {
      if (!document.querySelector('script[data-adsense]')) {
        const s = document.createElement('script');
        s.async = true; s.dataset.adsense = '1'; s.crossOrigin = 'anonymous';
        s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
        document.head.appendChild(s);
      }
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    }
    // count an impression once it's actually on screen
    const io = new IntersectionObserver((es) => { if (!seen && es.some((e) => e.isIntersecting)) { seen = true; track('ad_impression', { slot, format, preview: !live }); io.disconnect(); } }, { threshold: 0.5 });
    if (el) io.observe(el);
    return () => io.disconnect();
  });
  const click = () => track('ad_click', { slot, format, preview: !live });
  const goPlus = (e) => { e.preventDefault(); e.stopPropagation(); sessionStorage.setItem('mp-more-tab', 'settings'); location.hash = 'more'; };
</script>

{#if live}
  <div class="adslot" bind:this={el} aria-label="Advertisement" onclickcapture={click}>
    <span class="adlabel">Ad · <a href="#more" onclick={goPlus}>Go ad-free</a></span>
    <ins class="adsbygoogle" style="display:block" data-ad-client={ADSENSE_CLIENT} data-ad-slot={ADSENSE_SLOT} data-ad-format={format === 'rect' ? 'rectangle' : 'auto'} data-full-width-responsive="true"></ins>
  </div>
{:else if preview}
  <div class="adslot ad-{format}" bind:this={el} aria-label="Advertisement preview">
    <span class="adlabel">Sponsored · <b>preview</b> ({slot}) · <a href="#more" onclick={goPlus}>Go ad-free</a></span>
    <button class="adbody" onclick={click}>
      <span class="adart">{ad.art}</span>
      <span class="adtext"><span class="small muted">{ad.brand}</span><b>{ad.head}</b>{#if ad.sub}<span class="small muted">{ad.sub}</span>{/if}</span>
      <span class="adcta">{ad.cta}</span>
    </button>
  </div>
{/if}

<style>
  .adslot { margin: 14px 0; }
  .adlabel { display: block; font-size: 11px; color: var(--muted); margin: 0 0 4px 2px; }
  .adlabel a { color: var(--accent); }
  .adbody { width: 100%; display: flex; align-items: center; gap: 12px; background: #fff; color: var(--ink); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; font-weight: 400; text-align: left; justify-content: flex-start; }
  .adart { font-size: 26px; width: 56px; height: 56px; display: grid; place-items: center; background: #fff7e6; border-radius: 10px; flex: none; }
  .adtext { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .adcta { background: #f2a33a; color: #2b1a00; font-weight: 700; border-radius: 999px; padding: 6px 12px; font-size: 13px; flex: none; }
  .ad-rect .adbody { flex-direction: column; align-items: stretch; text-align: center; max-width: 320px; margin: 0 auto; }
  .ad-rect .adart { width: 100%; height: 140px; font-size: 52px; }
  .ad-rect .adtext { align-items: center; }
  .ad-native .adbody { border-style: dashed; }
</style>

<script>
  import { loadAll, toast } from '../lib/db.svelte.js';
  // Pull down from the top of any screen to get the newest version of the app and the latest plans and lists.
  let pull = $state(0), busy = $state(false);
  let startY = null, armed = false;
  const LIMIT = 70;
  const blocked = () => window.scrollY > 0 || document.querySelector('.modal-back, .sheet, .prep-focus') || busy;
  function start(e) { if (blocked() || e.touches.length !== 1) { startY = null; return; } startY = e.touches[0].clientY; armed = false; }
  function move(e) {
    if (startY == null) return;
    const d = e.touches[0].clientY - startY;
    if (d <= 0 || window.scrollY > 0) { pull = 0; return; }
    pull = Math.min(110, d * 0.5);
    if (pull > 8 && e.cancelable) e.preventDefault();   // our pull, not the page's rubber band
    if (!armed && pull >= LIMIT) { armed = true; navigator.vibrate?.(10); }
  }
  // touchmove must not be passive so the pull can stop the page's own bounce
  $effect(() => {
    const o = { passive: false };
    addEventListener('touchstart', start, { passive: true }); addEventListener('touchmove', move, o);
    addEventListener('touchend', end); addEventListener('touchcancel', end);
    return () => { removeEventListener('touchstart', start); removeEventListener('touchmove', move, o); removeEventListener('touchend', end); removeEventListener('touchcancel', end); };
  });
  async function end() {
    if (startY == null) return;
    startY = null;
    if (pull < LIMIT) { pull = 0; return; }
    busy = true; pull = 56;
    try {
      // 1) a newer version of the app? install it and reload
      const reg = await navigator.serviceWorker?.getRegistration?.();
      if (reg) {
        await reg.update().catch(() => {});
        const sw = reg.installing || reg.waiting;
        if (sw) {
          await new Promise((res) => { if (sw.state === 'activated') return res(); sw.addEventListener('statechange', () => sw.state === 'activated' && res()); sw.postMessage?.({ type: 'SKIP_WAITING' }); setTimeout(res, 4000); });
          location.reload(); return;
        }
      }
      // 2) otherwise, fetch the latest plans, lists, recipes and pantry
      await loadAll();
      toast('✓ Up to date');
    } catch (e) { toast(e.message || 'Couldn’t refresh — check your connection'); }
    busy = false; pull = 0;
  }
</script>


{#if pull > 0 || busy}
  <div class="ptr" style="transform:translate(-50%, {pull - 44}px)" aria-live="polite">
    {#if busy}<span class="spinner"></span>{:else}<span class="arrow" class:ready={pull >= LIMIT}>↓</span>{/if}
    <span class="small">{busy ? 'Refreshing…' : pull >= LIMIT ? 'Let go to refresh' : 'Pull to refresh'}</span>
  </div>
{/if}

<style>
  .ptr { position: fixed; top: env(safe-area-inset-top); left: 50%; z-index: 250; display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid var(--line); border-radius: 999px; padding: 8px 14px; box-shadow: 0 4px 14px rgba(0,0,0,.12); color: var(--ink); pointer-events: none; }
  .arrow { display: inline-block; font-weight: 700; color: var(--accent); transition: transform .15s; }
  .arrow.ready { transform: rotate(180deg); }
</style>

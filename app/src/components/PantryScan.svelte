<script>
  import { onDestroy } from 'svelte';
  import { app, addPantry, callProxy, toast, track } from '../lib/db.svelte.js';
  import { matchItem } from '../lib/pantry.js';
  // Fill the pantry with the camera: scan barcodes (free product lookup), or snap a photo of a shelf or the fridge
  // (an AI lists what it sees). Everything lands in a list to check before it's added.
  let { onclose } = $props();
  let tab = $state('barcode'), found = $state([]), err = $state(''), busy = $state(''), video = $state(null), running = $state(false);
  let controls = null, last = '', lastAt = 0;

  // ---- barcodes ----
  async function lookup(code) {
    try {
      const j = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,generic_name,brands,quantity`).then((r) => r.json());
      const p = j.product || {};
      const name = (p.product_name || p.generic_name || '').trim();
      return { name: name ? name.replace(/\s+/g, ' ') : '', brand: (p.brands || '').split(',')[0].trim(), amount: (p.quantity || '').replace(/\s+/g, ' ').trim() };
    } catch { return { name: '', brand: '', amount: '' }; }
  }
  async function onCode(code) {
    const now = Date.now();
    if (code === last && now - lastAt < 4000) return;
    last = code; lastAt = now;
    navigator.vibrate?.(40);
    const dup = found.find((f) => f.code === code);
    if (dup) { dup.count = (dup.count || 1) + 1; found = [...found]; return; }
    const row = { code, name: '', amount: '', brand: '', on: true, count: 1, looking: true };
    found = [row, ...found];
    const p = await lookup(code);
    Object.assign(row, p, { looking: false, name: p.name || '' });
    found = [...found];
  }
  async function startCamera() {
    err = ''; busy = 'cam';
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, video, (res) => { if (res) onCode(res.getText()); });
      running = true;
    } catch (e) { err = /Permission|NotAllowed/i.test(e?.name + e?.message) ? 'Camera access was blocked — allow the camera for this site in your settings.' : 'Couldn’t start the camera: ' + (e?.message || e); }
    busy = '';
  }
  function stopCamera() { try { controls?.stop(); } catch {} controls = null; running = false; }
  onDestroy(stopCamera);
  $effect(() => { if (tab !== 'barcode') stopCamera(); });

  // ---- photo of a shelf / fridge ----
  async function shrink(file) {
    const img = await createImageBitmap(file);
    const s = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82).split(',')[1];
  }
  async function onPhoto(e) {
    const file = e.currentTarget.files?.[0]; e.currentTarget.value = '';
    if (!file) return;
    err = ''; busy = 'photo';
    try {
      const image = await shrink(file);
      const r = await callProxy({ action: 'vision-pantry', image });
      const rows = (r.items || []).map((x) => ({ name: x.name, amount: [x.amount, x.unit].filter(Boolean).join(' '), on: true, brand: '' }));
      if (!rows.length) err = 'We couldn’t make out any food in that photo — try closer, with good light.';
      found = [...rows, ...found];
      track('pantry_photo', { items: rows.length });
    } catch (x) { err = x.message; }
    busy = '';
  }

  async function addAll() {
    const rows = found.filter((f) => f.on && f.name.trim()).map((f) => {
      const it = matchItem(f.name, app.items);
      return { item_id: it?.id || null, name: it ? it.name : f.name.trim(), amount: f.count > 1 ? `${f.count} × ${f.amount || 'pack'}` : f.amount || '' };
    });
    if (!rows.length) return;
    busy = 'add';
    try { await addPantry(rows); toast(`✓ Added ${rows.length} to your pantry`); track('pantry_scan', { items: rows.length, via: tab }); found = []; stopCamera(); onclose(); }
    catch (x) { err = x.message; }
    busy = '';
  }
</script>

<div class="modal-back" role="presentation">
  <div class="modal card nocollapse scan">
    <div class="spread"><h2 style="margin:0">Add with the camera</h2><button class="quiet" onclick={() => { stopCamera(); onclose(); }} aria-label="Close">✕</button></div>
    <div class="seg" style="margin:10px 0">
      <button class:on={tab === 'barcode'} onclick={() => (tab = 'barcode')}>▦ Scan barcodes</button>
      <button class:on={tab === 'photo'} onclick={() => (tab = 'photo')}>📸 Photo of shelf or fridge</button>
    </div>
    {#if err}<div class="err small">⚠️ {err}</div>{/if}

    {#if tab === 'barcode'}
      <div class="cam">
        <video bind:this={video} playsinline muted></video>
        {#if !running}<button class="cam-start" onclick={startCamera} disabled={busy === 'cam'}>{#if busy === 'cam'}<span class="spinner"></span>{/if} Start camera</button>{:else}<span class="cam-aim" aria-hidden="true"></span>{/if}
      </div>
      <p class="small muted" style="margin:6px 0 0">Hold each package's barcode in the box — it beeps (buzzes) when it reads one. Scan the same item twice to count 2.</p>
    {:else if !app.canVision}
      <p class="small">Snapping a photo of a whole shelf needs photo recognition, which isn't switched on for WFD yet. Barcode scanning works now.</p>
      <button class="ghost" onclick={() => (tab = 'barcode')}>▦ Scan barcodes instead</button>
    {:else}
      <label class="photo-btn">
        <input type="file" accept="image/*" capture="environment" onchange={onPhoto} hidden />
        {#if busy === 'photo'}<span class="spinner"></span> Looking at your photo…{:else}📸 Take or choose a photo{/if}
      </label>
      <p class="small muted" style="margin:6px 0 0">One shelf or fridge door at a time works best. You'll check the list before anything is added.</p>
    {/if}

    {#if found.length}
      <h3 style="margin:14px 0 4px">Found ({found.filter((f) => f.on).length} to add)</h3>
      {#each found as f, i (f.code || f.name + i)}
        <div class="list-row" style="gap:8px">
          <input type="checkbox" style="width:22px;height:22px" bind:checked={f.on} aria-label="Add {f.name || 'item'}" />
          <div class="grow">
            {#if f.looking}<span class="small muted"><span class="spinner"></span> Looking up {f.code}…</span>
            {:else}
              <input bind:value={f.name} placeholder={f.code ? `Unknown product (${f.code}) — type its name` : 'Name'} style="padding:6px" />
              <span class="small muted">{[f.brand, f.amount, f.count > 1 ? `×${f.count}` : ''].filter(Boolean).join(' · ')}</span>
            {/if}
          </div>
        </div>
      {/each}
      <div class="row sticky-actions"><button onclick={addAll} disabled={busy === 'add' || !found.some((f) => f.on && f.name.trim())}>{#if busy === 'add'}<span class="spinner"></span>{/if} Add to pantry</button></div>
    {/if}
  </div>
</div>

<style>
  .scan { max-width: 520px; }
  .cam { position: relative; background: #111; border-radius: 12px; overflow: hidden; aspect-ratio: 4 / 3; display: grid; place-items: center; }
  .cam video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .cam-start { position: relative; z-index: 1; }
  .cam-aim { position: absolute; left: 15%; right: 15%; top: 32%; bottom: 32%; border: 3px solid #fff; border-radius: 10px; box-shadow: 0 0 0 999px rgba(0,0,0,.25); }
  .photo-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 28px 12px; border: 2px dashed var(--accent); border-radius: 12px; color: var(--accent); font-weight: 700; cursor: pointer; background: var(--accent-soft); }
  .sticky-actions { position: sticky; bottom: -14px; background: var(--card); padding: 12px 0 6px; margin-top: 10px; border-top: 1px solid var(--line); }
</style>

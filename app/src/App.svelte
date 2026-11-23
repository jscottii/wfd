<script>
  import { app, start, currentHousehold, joinWithCode, clearPendingCode, MAX_HOUSEHOLDS, createHousehold, need, owned } from './lib/db.svelte.js';
  import { ui, openCart } from './lib/ui.svelte.js';
  import { enableCollapse } from './lib/collapse.js';
  import { onMount } from 'svelte';
  onMount(() => enableCollapse());
  let fixName = $state('My household'), fixBusy = $state(false), fixCode = $state('');
  async function fixCreate() { fixBusy = true; try { await createHousehold(fixName || 'My household'); location.reload(); } catch (e) { app.error = e.message; fixBusy = false; } }
  async function fixJoin() { fixBusy = true; try { await joinWithCode(fixCode); location.reload(); } catch (e) { app.error = e.message; fixBusy = false; } }
  let joinBusy = $state(false), joinErr = $state('');
  async function doJoin() { joinBusy = true; joinErr = ''; try { await joinWithCode(app.pendingJoin.code); } catch (e) { joinErr = e.message; joinBusy = false; } }
  import Login from './routes/Login.svelte';
  import Trip from './routes/Trip.svelte';
  import Plan from './routes/Plan.svelte';
  import Prep from './routes/Prep.svelte';
  import Pantry from './routes/Pantry.svelte';
  import Recipes from './routes/Recipes.svelte';
  import Receipt from './routes/Receipt.svelte';
  import Prices from './routes/Prices.svelte';
  import More from './routes/More.svelte';
  import TimerDock from './components/TimerDock.svelte';
  import Onboarding from './components/Onboarding.svelte';
  import AnchorAd from './components/AnchorAd.svelte';
  import WhatsNew from './components/WhatsNew.svelte';
  // after an update, once: what changed (first-ever open just records the version)
  let showNew = $state((() => { try { let v = localStorage.getItem('wfd-seen-version'); if (!v) { const existing = Object.keys(localStorage).some((k) => /^mp-|auth-token/.test(k)); if (!existing) { localStorage.setItem('wfd-seen-version', __APP_VERSION__); return false; } v = '1.4.1'; localStorage.setItem('wfd-seen-version', v); } return v !== __APP_VERSION__; } catch { return false; } })());
  if (typeof window !== 'undefined') window.addEventListener('wfd-whats-new', () => (showAllNew = true));
  let showAllNew = $state(false);
  import { needsName } from './lib/hhname.js';
  import Admin from './routes/Admin.svelte';
  let showOnboard = $state(false), onboardDismissed = $state(false);
  $effect(() => { if (app.ready && app.household && app.session && (!app.settings.onboarded || !app.settings.homeSet || needsName(app, currentHousehold())) && !onboardDismissed && !app.pendingJoin) showOnboard = true; });

  const TABS = [['plan', '📅', 'Plan'], ['trip', '🛒', 'Shop'], ['prep', '🔪', 'Prep'], ['pantry', '🥫', 'Pantry'], ['more', '☰', 'More']];
  const PAGES = ['plan', 'trip', 'prep', 'pantry', 'more', 'recipes', 'prices', 'admin'];
  let page = $state(PAGES.includes((location.hash || '').slice(1)) ? location.hash.slice(1) : 'plan');
  function go(p) { page = p; history.replaceState(null, '', '#' + p); window.scrollTo(0, 0); }
  $effect(() => { const f = () => { const h = location.hash.slice(1); if (PAGES.includes(h)) page = h; else if (h === 'receipt') ui.receipt = true; }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); });
  start();
</script>

{#if !app.ready}
  <div class="page row" style="padding-top:30vh;justify-content:center"><span class="spinner"></span> Loading…</div>
{:else if !app.session}
  <Login />
{:else if !app.household}
  <div class="page">
    <h1>Set up your household</h1>
    {#if app.error}<div class="err">⚠️ {app.error}</div>{/if}
    <div class="card nocollapse">
      <h3 style="margin-top:0">Start a new household</h3>
      <p class="small muted">Your recipes, plans, pantry and shopping lists live in a household. You can invite others later.</p>
      <div class="row"><input class="grow" bind:value={fixName} placeholder="e.g. Smith Family" /><button onclick={fixCreate} disabled={fixBusy}>{#if fixBusy}<span class="spinner"></span>{/if} Create</button></div>
    </div>
    <div class="card nocollapse">
      <h3 style="margin-top:0">Or join one</h3>
      <div class="row"><input class="grow" bind:value={fixCode} placeholder="Home code, e.g. WFD-AB12CD" /><button class="ghost" onclick={fixJoin} disabled={fixBusy || !fixCode.trim()}>Join</button></div>
    </div>
    <button class="quiet" onclick={() => location.reload()}>Try again</button>
  </div>
{:else}
  <TimerDock />
  {#if app.households.length > 1 || app.myInvites.length}
    <div class="hhbar">
      {#if app.households.length > 1}<button class="quiet" onclick={() => { sessionStorage.setItem('mp-more-tab', 'settings'); go('more'); }}>🏠 {currentHousehold()?.name}</button>{/if}
      {#if app.myInvites.length}<button class="quiet" onclick={() => { sessionStorage.setItem('mp-more-tab', 'settings'); go('more'); }}>✉️ {app.myInvites.length === 1 ? `${app.myInvites[0].name} invited you` : `${app.myInvites.length} household invites`} →</button>{/if}
    </div>
  {/if}
  {#key page}
    {#if page === 'plan'}<Plan {go} />
    {:else if page === 'prep'}<Prep {go} />
    {:else if page === 'pantry'}<Pantry {go} />
    {:else if page === 'recipes'}<Recipes {go} />
    {:else if page === 'prices'}<Prices {go} />
    {:else if page === 'more'}<More {go} />
    {:else if page === 'admin' && app.isAdmin}<Admin />
    {:else if page === 'trip'}<Trip {go} />
    {:else}<Plan {go} />{/if}
  {/key}
  {#if page !== 'prep'}
    <button class="cart-fab" aria-label="Shopping carts" onclick={() => (ui.cartPicker = !ui.cartPicker)}><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 3.5h2.6l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2l1.6-6.8H6.2"/><circle cx="9.6" cy="20" r="1.6" fill="#fff"/><circle cx="17.4" cy="20" r="1.6" fill="#fff"/></svg>{#if app.carts.length}<span class="fab-badge">{app.carts.length + 1}</span>{/if}</button>
  {/if}
  {#if ui.cartPicker}
    <div class="sheet-back" role="presentation" onclick={() => (ui.cartPicker = false)}></div>
    <div class="sheet" role="dialog" aria-label="Pick a cart">
      <h3 style="margin:0 0 8px">Which list?</h3>
      <button class="sheet-row" class:on={ui.cart === 'home'} onclick={() => { openCart('home'); go('trip'); }}><span>🏠</span><span class="grow"><b>Home list</b><br><span class="small muted">This week's groceries</span></span></button>
      {#each app.carts as c (c.id)}
        <button class="sheet-row" class:on={ui.cart === c.id} onclick={() => { openCart(c.id); go('trip'); }}><span>📋</span><span class="grow"><b>{c.name}</b><br><span class="small muted">{c.people ? `${c.people} people` : 'Project list'}{c.event_date ? ` · ${c.event_date}` : ''}</span></span></button>
      {/each}
      <button class="sheet-row" onclick={() => { openCart('new'); go('trip'); }}><span>＋</span><span class="grow"><b>New project list</b><br><span class="small muted">A party, an event, one-off meal — give it a title</span></span></button>
    </div>
  {/if}
  {#if ui.receipt}
    <div class="modal-back" role="presentation">
      <div class="modal receipt-modal card nocollapse"><button class="quiet modal-x" aria-label="Close" onclick={() => (ui.receipt = false)}>✕</button><Receipt {go} onclose={() => (ui.receipt = false)} /></div>
    </div>
  {/if}
  <AnchorAd {page} />
  <nav class="tabs">
    <div class="brand"><img src="icon.svg" alt="" width="26" height="26" style="vertical-align:-7px;margin-right:8px;border-radius:6px" />What's for Dinner{#if app.households.length > 1}<button class="hh" onclick={() => { sessionStorage.setItem('mp-more-tab', 'settings'); go('more'); }}>🏠 {currentHousehold()?.name} ▾</button>{/if}</div>
    {#each TABS as [k, ic, label]}<button class:on={page === k} onclick={() => go(k)}><span class="ic">{ic}</span>{label}</button>{/each}
  </nav>
{/if}
{#if app.pendingJoin}
  <div class="modal-back">
    <div class="card modal">
      <h2>Join “{app.pendingJoin.name}”?</h2>
      <p class="small muted">{app.pendingJoin.members} member{app.pendingJoin.members === 1 ? '' : 's'}. You'll see and share its recipes, plans, pantry and shopping lists. Your current household stays in your list; switch any time in Settings.</p>
      {#if app.households.length >= MAX_HOUSEHOLDS}<p class="err small">You're in {MAX_HOUSEHOLDS} households, the most allowed. Leave one in Settings first.</p>{/if}
      {#if joinErr}<div class="err">⚠️ {joinErr}</div>{/if}
      <div class="row">
        <button onclick={doJoin} disabled={joinBusy || app.households.length >= MAX_HOUSEHOLDS}>{#if joinBusy}<span class="spinner"></span>{/if} Join</button>
        <button class="quiet" onclick={() => { clearPendingCode(); app.pendingJoin = null; }}>Not now</button>
      </div>
    </div>
  </div>
{/if}
{#if (showNew || showAllNew) && app.ready && app.session && !showOnboard}<WhatsNew all={showAllNew} onclose={() => { showNew = false; showAllNew = false; }} />{/if}
{#if showOnboard}<Onboarding {go} onclose={() => { showOnboard = false; onboardDismissed = true; }} />{/if}
{#if app.toast}<div class="toast">{app.toast}</div>{/if}

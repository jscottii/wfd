<script>
  import Hello from '../components/Hello.svelte';
  import InstallApp from '../components/InstallApp.svelte';
  import { app, saveSettings, saveSerpKey, testSerpKey, saveInstacartKey, MAX_HOUSEHOLDS, switchHousehold, createHousehold, acceptInvite, declineInvite, leaveHousehold, renameHousehold, currentHousehold, getJoinCode, resetJoinCode, peekCode, joinWithCode, showCode, inviteLink, invite, signOut, deleteAccount, isGuest, saveStore, addLocalStores, setHouseholdSize, toast, myName, saveMe } from '../lib/db.svelte.js';
  import Welcome from '../components/Welcome.svelte';
  let redoWelcome = $state(false);
  import { findLocalChains } from '../lib/maps.js';
  import { ui } from '../lib/ui.svelte.js';
  import MealPrefs from '../components/MealPrefs.svelte';
  import Feedback from '../components/Feedback.svelte';
  import GuestNote from '../components/GuestNote.svelte';
  import { instacartStores } from '../lib/order.js';
  import { STRIPE_PAYMENT_LINK, STRIPE_PORTAL_LINK, PLUS_PRICE } from '../lib/config.js';
  import { isNative } from '../lib/native.js';
  const plusLink = () => `${STRIPE_PAYMENT_LINK}?client_reference_id=${app.user?.id}&prefilled_email=${encodeURIComponent(app.user?.email || '')}`;
  let icZip = $state((String(app.settings.homeAddress || '').match(/\b\d{5}\b/) || [''])[0]), icStores = $state(null), icBusy = $state(false), icErr = $state('');
  async function icFind() { icBusy = true; icErr = ''; try { icStores = await instacartStores(icZip); if (!icStores.length) icErr = 'No Instacart stores found for that ZIP.'; } catch (e) { icErr = e.message; } icBusy = false; }
  import { trip } from '../lib/trip.svelte.js';
  let { go } = $props();
  let icKey = $state('');
  let hhName = $state(''), newHh = $state(''), hhBusy = $state(''), hhErr = $state(''), leaving = $state('');
  $effect(() => { if (!hhName && currentHousehold()) hhName = currentHousehold().name; });
  const atMax = () => app.households.length >= MAX_HOUSEHOLDS;
  let code = $state(''), codeAsk = $state(false), joinCode = $state(''), joinPeek = $state(null);
  // the code belongs to the household you're in now; fetch it again whenever that changes
  let codeFor = '';
  $effect(() => { const hid = app.household; if (tab === 'settings' && hid && codeFor !== hid) { codeFor = hid; code = ''; getJoinCode(hid).then((c) => { if (app.household === hid) code = c; }).catch(() => {}); } });
  async function copyLink() { try { await navigator.clipboard.writeText(inviteLink(code)); toast('✓ Invite link copied'); } catch { toast(inviteLink(code)); } }
  async function shareLink() {
    const text = `Join our household on WFD Meals: ${inviteLink(code)}\nOr enter code ${showCode(code)} in More → Settings.`;
    try { if (navigator.share) await navigator.share({ title: 'Join our WFD household', text }); else { await navigator.clipboard.writeText(text); toast('✓ Invite copied'); } } catch {}
  }
  async function hh(label, fn) { hhBusy = label; hhErr = ''; try { await fn(); } catch (e) { hhErr = e.message; } hhBusy = ''; }
  async function icSave() { try { await saveInstacartKey(icKey); icKey = ''; toast('✓ Instacart key saved'); } catch (e) { toast(e.message); } }
  let delAsk = $state(false), delWord = $state(''), delBusy = $state(false), delErr = $state('');
  async function reallyDelete() {
    delBusy = true; delErr = '';
    try { await deleteAccount(); location.hash = ''; location.reload(); } catch (e) { delErr = e.message; delBusy = false; }
  }
  let tab = $state(sessionStorage.getItem('mp-more-tab') || 'settings');
  sessionStorage.removeItem('mp-more-tab');
  let s = $state({ ...app.settings }), saving = $state(false);
  let key = $state(''), keyBusy = $state(false), keyMsg = $state(null);
  let wife = $state(''), invBusy = $state(false);

  let days = $derived.by(() => {
    const g = {};
    app.purchases.forEach((p) => { const k = `${p.day}|${p.store || ''}`; (g[k] = g[k] || []).push(p); });
    return Object.entries(g).map(([k, rows]) => ({ day: k.split('|')[0], store: k.split('|')[1], rows }));
  });
  const fmt = (x) => (x == null ? '—' : '$' + Number(x).toFixed(2));

  let local = $state(null), localPick = $state({}), localBusy = $state(''), localErr = $state('');
  async function findLocal() {
    localBusy = 'find'; localErr = '';
    try { local = await findLocalChains(app.settings.homeAddress, app.stores, Number(app.settings.storeRadius) || 25); localPick = Object.fromEntries(local.filter((b) => !b.known).slice(0, 5).map((b) => [b.brand, true])); if (!local.length) localErr = `No grocery stores found within ${app.settings.storeRadius || 25} miles of your home address.`; }
    catch (e) { localErr = e.message; }
    localBusy = '';
  }
  async function addLocal() {
    localBusy = 'add'; localErr = '';
    try { const ids = await addLocalStores(local.filter((b) => localPick[b.brand] && !b.known)); trip.result = null; toast(`✓ Added ${ids.length} store${ids.length === 1 ? '' : 's'}`); local = local.map((b) => (localPick[b.brand] ? { ...b, known: true } : b)); }
    catch (e) { localErr = e.message; }
    localBusy = '';
  }
  async function save() {
    const moved = s.homeAddress !== app.settings.homeAddress;
    saving = true;
    try { await saveSettings({ homeAddress: s.homeAddress, mpg: +s.mpg, gasPrice: +s.gasPrice, timeValue: +s.timeValue, timeValueSet: !!s.timeValueSet, stopMinutes: +s.stopMinutes, maxStores: +s.maxStores,
      costcoMember: !!s.costcoMember, costcoMode: s.costcoMode, householdSize: +s.householdSize, audience: s.audience || 'household', units: s.units || 'imperial', storeRadius: +s.storeRadius || 25, nearestStores: !!s.nearestStores, serpMonthlyLimit: +s.serpMonthlyLimit });
      await setHouseholdSize(+s.householdSize);
      trip.result = null; toast('✓ Settings saved — plan, recipe amounts and shopping list updated');
      if (moved) { tab = 'stores'; findLocal(); } }
    catch (e) { toast(e.message); }
    saving = false;
  }
  async function keyTest() {
    keyBusy = true; keyMsg = null;
    try { if (key.trim()) await saveSerpKey(key); const r = await testSerpKey(); keyMsg = r.ok ? { ok: true, text: `Key works — ${r.plan} plan${r.left != null ? `, ${r.left} searches left` : ''}.` } : { ok: false, text: r.error }; if (r.ok) key = ''; }
    catch (e) { keyMsg = { ok: false, text: e.message }; }
    keyBusy = false;
  }
  async function sendInvite() {
    invBusy = true;
    try { await invite(wife); toast(`✓ ${wife} can now sign in and will join your household`); wife = ''; } catch (e) { toast(e.message); }
    invBusy = false;
  }
  async function toggleStore(st) { st.enabled = st.enabled === false; try { await saveStore(st); trip.result = null; } catch (e) { toast(e.message); } }
</script>

<div class="page">
  <Hello page="more" />
  <div class="row" style="gap:6px;margin:6px 0 8px">
    <button class="ghost" onclick={() => go('recipes')}>📖 Saved recipes</button>
    <button class="ghost" onclick={() => (ui.receipt = true)}>🧾 Scan a receipt</button>
    <button class="ghost" onclick={() => go('prices')}>💲 Prices</button>
    {#if app.isAdmin}<button class="ghost" onclick={() => go('admin')}>📊 Dashboards</button>{/if}
  </div>
  <div class="seg" style="margin:6px 0 4px">
    {#each [['settings', 'Settings'], ['history', 'History'], ['stores', 'Stores']] as [k, l]}<button class:on={tab === k} onclick={() => (tab = k)}>{l}</button>{/each}
  </div>
  {#if isGuest()}<GuestNote leave text="You're using WFD as a guest. You can see your settings, but you'll need an account to change them. Guest data is deleted after 14 days." />{/if}

  <fieldset class="locked" disabled={isGuest()}>
  {#if tab === 'history'}
    <h1>What you've bought</h1>
    {#each days as d}
      {@const pl = d.rows.reduce((a, r) => a + (Number(r.planned) || 0), 0)}{@const pd = d.rows.reduce((a, r) => a + (Number(r.paid) || 0), 0)}
      <div class="card"><div class="spread"><h3 style="margin:0">{d.store || 'Store'} · {d.day}</h3>{#if pd}<b>{fmt(pd)}</b>{/if}</div>
        {#if pd && pl}<p class="small" style:color={pd > pl ? 'var(--red)' : 'var(--green)'}>{pd > pl ? 'Paid' : 'Saved'} {fmt(Math.abs(pd - pl))} vs plan</p>{/if}
        {#each d.rows as r}<div class="list-row small"><span>{r.item}{#if r.status === 'Not found'} <span class="pill red">not in stock</span>{/if}</span><span>{r.paid != null ? fmt(r.paid) : r.planned != null ? fmt(r.planned) + ' planned' : ''}</span></div>{/each}
      </div>
    {:else}<p class="muted">Nothing yet. Tick items off on your trip, or upload a receipt after shopping.</p>{/each}

  {:else if tab === 'stores'}
    <h1>Stores</h1>
    <p class="muted small">{app.settings.nearestStores !== false ? 'Each chain uses its location nearest to where your trip starts.' : 'Using the addresses below.'} Turn a store off to leave it out of trips.</p>
    <div class="card">
      <div class="spread"><b>Stores near {app.settings.homeAddress.split(',')[0]}</b><button class="ghost" onclick={findLocal} disabled={!!localBusy}>{#if localBusy === 'find'}<span class="spinner"></span>{/if} Find stores near me</button></div>
      <p class="small muted" style="margin:4px 0">Moved? This finds the grocery chains around your home address (change it in Settings).</p>
      {#if localErr}<div class="err">⚠️ {localErr}</div>{/if}
      {#if local}
        {#each local as b (b.brand)}
          <label class="list-row" style="cursor:pointer">
            <input type="checkbox" style="width:auto" disabled={b.known} checked={b.known || !!localPick[b.brand]} onchange={(e) => (localPick[b.brand] = e.currentTarget.checked)} />
            <div class="grow"><b>{b.brand}</b>{#if b.bulk} <span class="pill acc">membership</span>{/if}{#if b.known} <span class="pill live">in your stores</span>{/if}
              <div class="small muted">{b.miles} mi · {b.near.label}{b.count > 1 ? ` · ${b.count} nearby` : ''} · prices {b.level < 0.95 ? 'lower' : b.level > 1.05 ? 'higher' : 'average'}</div></div>
          </label>
        {/each}
        <button onclick={addLocal} disabled={!!localBusy || !local.some((b) => localPick[b.brand] && !b.known)}>{#if localBusy === 'add'}<span class="spinner"></span>{/if} Add selected stores</button>
        <p class="small muted">New stores start with estimated prices (from what items cost elsewhere and the chain's usual price level). Scanning a receipt or a live price check replaces the estimates. Stores farther than your store range (Settings) from where a trip starts are left out.</p>
      {/if}
    </div>
    <div class="card">
      {#each app.stores as st}
        {@const loc = trip.stores.find((x) => x.id === st.id)}
        <div class="list-row">
          <div class="grow"><b>{st.short}</b>{#if st.bulk} <span class="pill acc">membership</span>{/if}
            <div class="small muted">{loc?.label || st.address}{loc?.fromStart ? ` · ${loc.fromStart.minutes} min · ${loc.fromStart.miles} mi` : ''}{loc && !loc.home ? ' · nearest' : ''}</div>
            <div class="small"><a href={st.ad} target="_blank" rel="noopener">Weekly ad ↗</a> · {st.source === 'serpapi' || st.source === 'target' ? 'live prices (SerpApi)' : st.source === 'local' ? 'estimated prices until a receipt' : 'prices from receipts'}</div></div>
          <label class="switch"><input type="checkbox" checked={st.enabled !== false} onchange={() => toggleStore(st)} /><span></span></label>
        </div>
      {/each}
    </div>

  {:else}
    <h1>Settings</h1>
    <InstallApp />
    <div class="card">
      <label class="f">Your first name <span class="muted small">(just for you; others in the household see their own)</span><input value={myName()} maxlength="30" autocomplete="given-name" placeholder="First name" onchange={(e) => saveMe({ first_name: e.currentTarget.value.trim() }).then(() => toast('✓ Name saved')).catch((x) => toast(x.message))} /></label>
      <label class="f">Repeat a meal in a week<select value={String(app.settings.repeat || 2)} onchange={(e) => { saveSettings({ repeat: +e.currentTarget.value }); toast('✓ Saved. Pick for me uses this next time.'); }}><option value="1">Never: no leftovers</option><option value="2">Up to twice: cook once, leftovers once</option><option value="3">Up to 3 times: same thing most nights is fine</option></select></label>
      <label class="f">Grocery budget per week ($, optional)<input type="number" min="0" step="5" inputmode="numeric" value={app.settings.weeklyBudget || ''} placeholder="No budget" onchange={(e) => saveSettings({ weeklyBudget: +e.currentTarget.value > 0 ? Math.round(+e.currentTarget.value) : '' }).then(() => toast('✓ Budget saved'))} /></label>
      <button type="button" class="quiet small" style="margin:-6px 0 8px;padding:0" onclick={() => (redoWelcome = true)}>Answer the welcome questions again</button>
      <label class="f">How much detail<select bind:value={s.audience} onchange={() => { saveSettings({ audience: s.audience }); toast(s.audience === "group" ? "✓ Showing all the details" : "✓ Simplified view"); }}><option value="household">Simplified</option><option value="group">Give me all the details</option></select></label>
      <p class="small muted" style="margin:-4px 0 8px">Simplified keeps screens short. All the details adds full prep steps, bigger batches and more numbers: handy when cooking for a crowd.</p>
      <label class="f">Show pantry amounts in<select bind:value={s.units}><option value="imperial">Imperial — lb, oz, cups</option><option value="metric">Metric — kg, g, L</option><option value="relative">Roughly — plenty, some, low, out</option></select></label>
      <label class="f">Home address (where shopping trips usually start)<input bind:value={s.homeAddress} /></label>
      <label class="row small" style="gap:6px;margin:-4px 0 8px"><input type="checkbox" checked={!!app.settings.returnHome} onchange={(e) => saveSettings({ returnHome: e.currentTarget.checked })} /> Plan trips as round trips (drive back home at the end)</label>
      <label class="f">Store range: shop at stores within <b>{s.storeRadius || 25} miles</b><input type="range" min="5" max="50" step="5" bind:value={s.storeRadius} /></label>
      <div class="grid2">
        <label class="f">Usually feeding (people)<input type="number" min="1" bind:value={s.householdSize} /></label>
        <label class="f">Costco<select bind:value={s.costcoMember}><option value={false}>Not a member</option><option value={true}>Member</option></select></label>
      </div>
      <details open={s.audience === 'group'}>
      <summary class="small" style="margin:6px 0">Trip details (stops, gas, time)</summary>
      <div class="grid2">
        <label class="f">Most stops per trip<input type="number" min="1" max="6" bind:value={s.maxStores} /></label>
        <label class="f">Car MPG<input type="number" bind:value={s.mpg} /></label>
        <label class="f">Gas $/gallon<input type="number" step="0.01" bind:value={s.gasPrice} /></label>
        <label class="f">Value of your time ($/hour) <span class="small muted">— keep low to choose by grocery price</span><input type="number" bind:value={s.timeValue} oninput={() => (s.timeValueSet = true)} /></label>
        <label class="f">Minutes per stop<input type="number" bind:value={s.stopMinutes} /></label>
        <label class="f">Store locations<select bind:value={s.nearestStores}><option value={true}>Nearest to where I start</option><option value={false}>Always the saved addresses</option></select></label>
      </div>
      </details>
      <button onclick={save} disabled={saving}>{#if saving}<span class="spinner"></span>{/if} Save settings</button>
    </div>

    <div class="card">
      <h3>Food preferences</h3>
      <MealPrefs />
    </div>

    <div class="card">
      <h3>⭐ WFD Plus</h3>
      {#if app.plus}
        <p class="small">✅ You're a Plus member — no ads. Thank you!</p>
        {#if STRIPE_PORTAL_LINK}<a class="btn ghost" href={STRIPE_PORTAL_LINK} target="_blank" rel="noopener">Manage subscription ↗</a>{/if}
      {:else}
        <p class="small">No ads, ever, and you support the app. {PLUS_PRICE}, cancel any time.</p>
        {#if STRIPE_PAYMENT_LINK && !isNative()}<a class="btn" href={plusLink()} target="_blank" rel="noopener">Go ad-free</a>
        {:else}<p class="small muted">Coming soon.</p>{/if}
      {/if}
    </div>

    <div class="card">
      <h3>Delivery: Instacart, Costco & Walmart+</h3>
      <p class="small">Tap <b>Instacart</b> on any shopping list and your items go straight into an Instacart cart. You sign in with your own Instacart account to check out — Costco same-day, Safeway, Sprouts and more are all there, and your Costco membership is linked inside Instacart.</p>
      <div class="row">
        <a class="btn ghost" href="https://www.instacart.com/login" target="_blank" rel="noopener">Sign in to Instacart ↗</a>
        <a class="btn ghost" href="https://sameday.costco.com/" target="_blank" rel="noopener">Costco same-day ↗</a>
        <a class="btn ghost" href="https://www.walmart.com/account/login" target="_blank" rel="noopener">Sign in to Walmart+ ↗</a>
      </div>
      <p class="small" style="margin:8px 0 0">Prefer Walmart? Tap <b>Walmart+</b> on any list: your items go into your Walmart cart, and you check out with your own Walmart+ account (free delivery over the minimum).</p>
      <p class="small muted" style="margin:6px 0 0">Signing in once on this device keeps you signed in when the app sends a list.</p>
      {#if app.hasInstacartKey}
        <p class="small" style="margin:10px 0 4px"><b>Your usual Instacart store</b> {app.settings.instacartStore ? `· ${app.settings.instacartStore.name}` : '· none (you pick each time)'}</p>
        <div class="row"><input style="width:7em" inputmode="numeric" placeholder="ZIP" bind:value={icZip} /><button class="ghost" onclick={icFind} disabled={icBusy || !icZip.trim()}>{#if icBusy}<span class="spinner"></span>{/if} Find stores</button>
          {#if app.settings.instacartStore}<button class="quiet" onclick={() => saveSettings({ instacartStore: null })}>Clear</button>{/if}</div>
        {#if icErr}<div class="err small">⚠️ {icErr}</div>{/if}
        {#if icStores}<div class="row" style="gap:4px;margin-top:6px">{#each icStores.slice(0, 30) as st}<button class="chip" class:on={app.settings.instacartStore?.key === st.key} onclick={() => { saveSettings({ instacartStore: { key: st.key, name: st.name } }); toast(`✓ Instacart will open at ${st.name}`); }}>{st.name}</button>{/each}</div>{/if}
      {/if}
      {#if !app.hasInstacartKey}<p class="small muted">Instacart ordering is being switched on for the app — the button will work once it is.</p>{/if}
    </div>

    <div class="card">
      <h3>Household</h3>
      <p class="small">Signed in as <b>{app.user?.email}</b>.</p>
      <label class="f">Household name
        <div class="row"><input class="grow" bind:value={hhName} /><button class="ghost" disabled={!hhName.trim() || hhName === currentHousehold()?.name} onclick={() => hh('rename', async () => { await renameHousehold(hhName); toast('✓ Renamed'); })}>Rename</button></div>
      </label>
      {#if app.members.length > 1}<p class="small muted">Members: {app.members.map((m) => m.email).join(', ')}</p>{/if}
      {#if app.invites.length}<p class="small muted">Invited: {app.invites.map((i) => i.email).join(', ')} (they join when they sign in)</p>{/if}
      <h3 style="margin-top:12px">Invite people to {currentHousehold()?.name || 'this household'}</h3>
      {#if code}
        <div class="row" style="align-items:center">
          <span style="font:700 26px/1 ui-monospace,Menlo,monospace;letter-spacing:3px;background:#fff;border:1px dashed var(--line);border-radius:10px;padding:10px 14px">{showCode(code)}</span>
          <button onclick={shareLink}>Share invite</button>
          <button class="ghost" onclick={copyLink}>Copy link</button>
        </div>
        <p class="small muted">Anyone with this link or code can join <b>{currentHousehold()?.name}</b>. New people create an account from the link; people already on WFD enter the code under Your households.
          {#if !codeAsk}<button class="quiet" onclick={() => (codeAsk = true)}>Make a new code</button>
          {:else}<button class="quiet" onclick={() => hh('code', async () => { code = await resetJoinCode(); codeAsk = false; toast('✓ New code; the old one no longer works'); })}>Yes, replace it</button><button class="quiet" onclick={() => (codeAsk = false)}>Cancel</button>{/if}
        </p>
      {:else}<p class="small muted"><span class="spinner"></span> Getting your code…</p>{/if}
      <h3 style="margin-top:12px">Or invite by email</h3>
      <div class="row"><input class="grow" type="email" placeholder="Invite someone by email" bind:value={wife} /><button onclick={sendInvite} disabled={invBusy || !/@/.test(wife)}>Invite</button></div>
      <p class="small muted">Then send them the app link. They sign in with that email and see the same plans and lists, live. Someone already using WFD sees the invite under Your households.</p>
    </div>

    <div class="card">
      <h3>Your households <span class="small muted" style="font-weight:400">({app.households.length} of {MAX_HOUSEHOLDS})</span></h3>
      {#each app.households as h (h.id)}
        <div class="list-row">
          <div class="grow"><b>{h.name}</b> {#if h.is_current}<span class="pill live">current</span>{/if}<div class="small muted">{h.members} member{h.members === 1 ? '' : 's'}</div></div>
          {#if !h.is_current}<button class="ghost" disabled={!!hhBusy} onclick={() => hh('sw' + h.id, () => switchHousehold(h.id))}>{#if hhBusy === 'sw' + h.id}<span class="spinner"></span>{/if} Switch</button>{/if}
          {#if app.households.length > 1}
            {#if leaving === h.id}
              <button class="danger" disabled={!!hhBusy} onclick={() => hh('lv' + h.id, () => leaveHousehold(h.id))}>Leave{h.members === 1 ? ' & delete' : ''}</button>
              <button class="quiet" onclick={() => (leaving = '')}>Cancel</button>
            {:else}
              <button class="quiet" onclick={() => (leaving = h.id)}>Leave</button>
            {/if}
          {/if}
        </div>
        {#if leaving === h.id && h.members === 1}<p class="small" style="color:var(--red);margin:0 0 6px">You're the only member, so leaving deletes this household's recipes, plans, prices and pantry.</p>{/if}
      {/each}

      {#if app.myInvites.length}
        <h3 style="margin-top:14px">Invites for you</h3>
        {#each app.myInvites as iv (iv.household_id)}
          <div class="list-row">
            <div class="grow"><b>{iv.name}</b>{#if iv.invited_by}<div class="small muted">from {iv.invited_by}</div>{/if}</div>
            <button disabled={atMax() || !!hhBusy} onclick={() => hh('ac' + iv.household_id, () => acceptInvite(iv.household_id))}>{#if hhBusy === 'ac' + iv.household_id}<span class="spinner"></span>{/if} Join</button>
            <button class="quiet" onclick={() => hh('dc', () => declineInvite(iv.household_id))}>Decline</button>
          </div>
        {/each}
        {#if atMax()}<p class="small muted">You're in {MAX_HOUSEHOLDS} households, the most allowed. Leave one to join another.</p>{/if}
      {/if}

      <h3 style="margin-top:14px">Join with a code</h3>
      <div class="row"><input class="grow" placeholder="Code someone sent you" bind:value={joinCode} disabled={atMax()} oninput={() => (joinPeek = null)} style="text-transform:uppercase" />
        {#if !joinPeek}<button class="ghost" disabled={atMax() || joinCode.replace(/[^A-Za-z0-9]/g, '').length < 6 || !!hhBusy} onclick={() => hh('peek', async () => { joinPeek = await peekCode(joinCode); })}>Look up</button>
        {:else if joinPeek.already}<span class="small muted">You're already in “{joinPeek.name}”.</span>
        {:else}<button disabled={!!hhBusy} onclick={() => hh('join', () => joinWithCode(joinCode))}>{#if hhBusy === 'join'}<span class="spinner"></span>{/if} Join “{joinPeek.name}”</button>{/if}
      </div>

      <h3 style="margin-top:14px">Start another household</h3>
      <div class="row"><input class="grow" placeholder="e.g. Mom & Dad, Youth group dinners" bind:value={newHh} disabled={atMax()} />
        <button disabled={atMax() || !newHh.trim() || !!hhBusy} onclick={() => hh('new', () => createHousehold(newHh))}>{#if hhBusy === 'new'}<span class="spinner"></span>{/if} Create</button></div>
      <p class="small muted">{atMax() ? `You're in ${MAX_HOUSEHOLDS} households, the most allowed.` : 'Each household has its own recipes, plans, pantry, stores and prices. Switching changes what the whole app shows.'}</p>
      {#if hhErr}<div class="err">⚠️ {hhErr}</div>{/if}
      {#if !isGuest()}<button class="ghost" style="margin-top:10px" onclick={signOut}>Sign out</button>{/if}
    </div>
    <div class="card">
      <h3>Delete my account</h3>
      <p class="small muted">Deletes your sign-in. If you're the only one in your household, it also deletes everything: recipes, plans, prices, pantry, receipts and your SerpApi key. This can't be undone.</p>
      {#if !delAsk}
        <button class="ghost" style="color:var(--red);border-color:var(--red)" onclick={() => (delAsk = true)}>Delete my account…</button>
      {:else}
        <label class="f">Type DELETE to confirm<input bind:value={delWord} autocapitalize="characters" /></label>
        <div class="row">
          <button class="danger" disabled={delWord.trim() !== 'DELETE' || delBusy} onclick={reallyDelete}>{#if delBusy}<span class="spinner"></span>{/if} Delete forever</button>
          <button class="quiet" onclick={() => { delAsk = false; delWord = ''; }}>Cancel</button>
        </div>
        {#if delErr}<div class="err">⚠️ {delErr}</div>{/if}
      {/if}
    </div>
  {/if}
  </fieldset>
  <div class="card" id="contact" style="margin-top:16px">
    <h3>Contact us</h3>
    <p class="small muted" style="margin-top:0">Questions, bugs or ideas — send them here.</p>
    <Feedback />
  </div>
</div>
{#if redoWelcome}<Welcome onclose={() => { redoWelcome = false; location.reload(); }} />{/if}


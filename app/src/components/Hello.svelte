<script>
  // A friendly line at the top of each page, using your name. If we don't know it yet, or the household still
  // has its starter name ("Our household"), a small nudge asks once in a while.
  import { app, myName, saveMe, renameHousehold, saveSettings, currentHousehold, isGuest, toast } from '../lib/db.svelte.js';
  import { DEFAULT_NAMES } from '../lib/hhname.js';
  let { page } = $props();
  const SNOOZE = 5 * 864e5;
  const snoozed = (k) => { try { return Date.now() - Number(localStorage.getItem('wfd-snooze-' + k) || 0) < SNOOZE; } catch { return false; } };
  const snooze = (k) => { try { localStorage.setItem('wfd-snooze-' + k, String(Date.now())); } catch {} nudge = ''; };
  let nudge = $state(''), val = $state(''), busy = $state(false);
  $effect(() => {
    if (!app.ready || !app.user) return;
    if (!myName() && !snoozed('name')) nudge = 'name';
    else if (!isGuest() && DEFAULT_NAMES.test(String(currentHousehold()?.name || '').trim()) && !snoozed('hh')) nudge = 'hh';
    else nudge = '';
  });
  const part = () => { const h = new Date().getHours(); return h < 5 ? 'Hi' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
  const LINES = { plan: 'What sounds good this week?', trip: 'Happy shopping!', prep: 'Let’s get cooking.', pantry: 'Here’s what’s in your kitchen.', recipes: 'Your cookbook, all in one place.', more: 'Here’s everything else.', prices: 'Let’s find the deals.' };
  // the greeting shows once per visit, on the first page you open
  const first = (() => { try { if (sessionStorage.getItem('wfd-greeted')) return false; sessionStorage.setItem('wfd-greeted', page); return true; } catch { return true; } })();
  let line = $derived(first && myName() ? LINES[page] || 'Good to see you.' : '');
  async function save() {
    if (!val.trim()) return;
    busy = true;
    try {
      if (nudge === 'name') { await saveMe({ first_name: val.trim().slice(0, 30) }); toast(`✓ Nice to meet you, ${val.trim()}!`); }
      else { await renameHousehold(val.trim()); await saveSettings({ hhNamed: true }); toast('✓ Household renamed'); }
      val = '';
    } catch (e) { toast(e.message); }
    busy = false;
  }
</script>

{#if line}<div class="hello"><span class="hi">{part()}, {myName()} 👋</span><span class="sub">{line}</span></div>{/if}
{#if nudge}
  <form class="nudge" onsubmit={(e) => { e.preventDefault(); save(); }}>
    <span class="small">{nudge === 'name' ? '👋 What should we call you?' : `🏠 Make it yours: “${currentHousehold()?.name}” could be “The ${myName() ? myName() + '’s' : 'Smith'} kitchen”.`}</span>
    <div class="row" style="gap:6px;flex-wrap:nowrap;margin-top:6px">
      <input class="grow" bind:value={val} maxlength={nudge === 'name' ? 30 : 40} placeholder={nudge === 'name' ? 'Your first name' : 'Household name'} autocomplete={nudge === 'name' ? 'given-name' : 'off'} />
      <button disabled={busy || !val.trim()}>Save</button>
      <button type="button" class="quiet" onclick={() => snooze(nudge)}>Later</button>
    </div>
  </form>
{/if}

<style>
  .hello { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 12px; padding: 12px 14px; border-radius: 14px; background: linear-gradient(135deg, var(--accent), #3d7ae6); color: #fff; animation: hi .4s ease-out; }
  .hello .hi { font: 700 22px/1.2 Georgia, serif; }
  .hello .sub { font-size: 14.5px; opacity: .92; }
  @keyframes hi { from { opacity: 0; transform: translateY(-6px); } }
  .nudge { background: var(--accent-soft); border: 1px dashed var(--accent); border-radius: 12px; padding: 10px 12px; margin: 0 0 12px; }
  .nudge input { padding: 7px 10px; }
</style>

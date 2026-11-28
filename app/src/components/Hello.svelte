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
  const LINES = {
    plan: (n) => `${part()}, ${n}. What sounds good this week?`,
    trip: (n) => `Happy shopping, ${n}!`,
    prep: (n) => `Let's get cooking, ${n}.`,
    pantry: (n) => `Here's what's in your kitchen, ${n}.`,
    recipes: (n) => `${n}'s cookbook`,
    more: (n) => `Hi ${n}, here's everything else.`,
    prices: (n) => `Let's find the deals, ${n}.`,
  };
  let line = $derived(myName() ? (LINES[page] || ((n) => `${part()}, ${n}.`))(myName()) : '');
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

{#if line}<p class="hello">{line}</p>{/if}
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
  .hello { margin: 0 0 -6px; font-size: 14px; color: var(--accent-dark, var(--accent)); font-weight: 600; }
  .nudge { background: var(--accent-soft); border: 1px dashed var(--accent); border-radius: 12px; padding: 10px 12px; margin: 0 0 12px; }
  .nudge input { padding: 7px 10px; }
</style>

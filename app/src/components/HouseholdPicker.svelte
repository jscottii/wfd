<script>
  import { app, currentHousehold, switchHousehold, createHousehold, MAX_HOUSEHOLDS, toast } from '../lib/db.svelte.js';
  // Opened from the household name at the top: switch to another household, or start a new one.
  let { onclose, go } = $props();
  let busy = $state(''), adding = $state(false), name = $state('');
  const full = () => app.households.length >= MAX_HOUSEHOLDS;
  async function sw(h) {
    if (h.is_current) return onclose();
    busy = h.id;
    try { await switchHousehold(h.id); } catch (e) { toast(e.message); busy = ''; }
  }
  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    busy = 'new';
    try { await createHousehold(name.trim()); } catch (x) { toast(x.message); busy = ''; }
  }
  const manage = () => { sessionStorage.setItem('mp-more-tab', 'settings'); onclose(); go('more'); };
</script>

<div class="sheet-back" role="presentation" onclick={onclose}></div>
<div class="sheet" role="dialog" aria-label="Your households">
  <h3 style="margin:0 0 8px">Your households</h3>
  {#each app.households as h (h.id)}
    <button class="sheet-row" class:on={h.is_current} onclick={() => sw(h)} disabled={!!busy}>
      <span>🏠</span>
      <span class="grow"><b>{h.name}</b><br><span class="small muted">{h.members} member{h.members === 1 ? '' : 's'}{h.is_current ? ' · you’re here' : ''}</span></span>
      {#if busy === h.id}<span class="spinner"></span>{:else if h.is_current}<span aria-hidden="true">✓</span>{/if}
    </button>
  {/each}
  {#if !adding}
    <button class="sheet-row" onclick={() => (adding = true)} disabled={full() || !!busy}>
      <span>＋</span><span class="grow"><b>New household</b><br><span class="small muted">{full() ? `You're in ${MAX_HOUSEHOLDS}, the most allowed — leave one in Settings first` : 'Separate plans, lists and pantry — e.g. a second home or a group you cook for'}</span></span>
    </button>
  {:else}
    <form class="row" style="margin:8px 0;gap:6px" onsubmit={add}>
      <!-- svelte-ignore a11y_autofocus -->
      <input class="grow" bind:value={name} placeholder="Name it, e.g. Smith Family" maxlength="40" autofocus />
      <button disabled={!name.trim() || !!busy}>{#if busy === 'new'}<span class="spinner"></span>{/if} Create</button>
      <button type="button" class="quiet" onclick={() => (adding = false)}>Cancel</button>
    </form>
  {/if}
  <button class="sheet-row" onclick={manage}><span>⚙️</span><span class="grow"><b>Invite, join with a code, or leave</b><br><span class="small muted">More → Settings</span></span></button>
</div>

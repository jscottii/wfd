<script>
  import { app, isGuest, saveGuestAccount, toast } from '../lib/db.svelte.js';
  // Shown to guests (no account): a reminder that nothing is saved, and a quick way to keep everything by making an account.
  let open = $state(false), email = $state(''), password = $state(''), busy = $state(false), err = $state('');
  let hidden = $state((() => { try { return sessionStorage.getItem('wfd-guestbar') === '1'; } catch { return false; } })());
  // the "Create an account" buttons on locked screens open this form too
  $effect(() => { const f = () => (open = true); addEventListener('wfd-create-account', f); return () => removeEventListener('wfd-create-account', f); });
  const hide = () => { hidden = true; try { sessionStorage.setItem('wfd-guestbar', '1'); } catch {} };
  async function save(e) {
    e.preventDefault(); err = '';
    if (password.length < 8) { err = 'Use at least 8 characters.'; return; }
    busy = true;
    try { await saveGuestAccount(email, password); open = false; toast('Account made: your meals are saved.'); }
    catch (x) { err = x.message; }
    busy = false;
  }
</script>

{#if app.user && isGuest()}
  {#if !hidden && !open}
    <div class="gbar" role="status">
      <span>👋 <b>Guest mode:</b> your meals aren't saved. Guest data is deleted after 14 days, or sooner if you sign out or clear this browser.</span>
      <span class="gact"><button onclick={() => (open = true)}>Create an account</button><button class="gx" onclick={hide} aria-label="Hide">✕</button></span>
    </div>
  {/if}
  {#if open}
    <div class="sheet-bg" role="presentation" onclick={() => (open = false)}></div>
    <form class="sheet card" onsubmit={save}>
      <h2 style="margin-top:0">Create an account</h2>
      <p class="small muted">Everything you've done as a guest (your plan, recipes and lists) comes with you. You'll also be able to use your pantry and settings, and sign in from any device.</p>
      <label class="f">Email<input type="email" required autocomplete="email" bind:value={email} placeholder="you@example.com" /></label>
      <label class="f">Password<input type="password" required autocomplete="new-password" bind:value={password} /></label>
      {#if err}<div class="err">⚠️ {err}</div>{/if}
      <div class="row" style="gap:8px;margin-top:8px">
        <button type="submit" disabled={busy}>{#if busy}<span class="spinner"></span>{/if} Create account</button>
        <button type="button" class="ghost" onclick={() => (open = false)}>Not now</button>
      </div>
    </form>
  {/if}
{/if}

<style>
  .gbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: space-between; background: var(--accent-soft); color: var(--accent-dark);
    font-size: 13px; padding: 8px 12px; border-radius: 10px; margin: 8px 12px 0; }
  .gact { display: flex; align-items: center; gap: 4px; margin-left: auto; }
  .gact button { font-size: 13px; padding: 6px 12px; }
  .gact .gx { background: transparent; color: var(--accent-dark); padding: 6px 8px; }
  .sheet-bg { position: fixed; inset: 0; background: rgba(0, 0, 0, .35); z-index: 90; }
  .sheet { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(420px, calc(100vw - 32px)); z-index: 91; }
</style>

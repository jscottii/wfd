<script>
  import { signIn, signUp, continueAsGuest, sendResetCode, resetWithCode, pendingCode, showCode, cleanCode } from '../lib/db.svelte.js';
  const joining = pendingCode();
  let mode = $state(pendingCode() ? 'up' : 'in'), email = $state(localStorage.getItem('mp-email') || ''), password = $state(''), busy = $state(false), err = $state('');
  let code = $state(''), sent = $state(false), info = $state('');
  const setMode = (m) => { mode = m; err = ''; info = ''; sent = false; code = ''; password = ''; };
  async function go(e) {
    e.preventDefault(); err = '';
    if (mode === 'up' && password.length < 8) { err = 'Use at least 8 characters.'; return; }
    busy = true;
    try { localStorage.setItem('mp-email', email.trim()); await (mode === 'in' ? signIn : signUp)(email, password); }
    catch (x) { err = x.message; busy = false; }
  }
  async function guest() {
    err = ''; busy = true;
    try { await continueAsGuest(); } catch (x) { err = x.message; busy = false; }
  }
  async function send(e) {
    e?.preventDefault(); err = ''; busy = true;
    try { await sendResetCode(email); localStorage.setItem('mp-email', email.trim()); sent = true; info = `We emailed a reset code to ${email.trim()}. It can take a minute; check spam too.`; }
    catch (x) { err = x.message; }
    busy = false;
  }
  async function reset(e) {
    e.preventDefault(); err = '';
    if (password.length < 8) { err = 'Use at least 8 characters for the new password.'; return; }
    busy = true;
    try { await resetWithCode(email, code, password); } catch (x) { err = x.message; busy = false; }
  }
</script>

<div class="page" style="max-width:420px;padding-top:12vh">
  <img src="icon.svg" alt="" width="64" height="64" style="border-radius:14px" />
  <h1>What's for Dinner</h1>
  <p class="muted">Plan the week, shop it in the fewest, cheapest stops, and cook it all at once.</p>
  {#if joining}<div class="ok small">You're joining a household with code <b>{showCode(cleanCode(joining))}</b>. Create an account (or sign in) and you'll be added.</div>{/if}
  {#if mode === 'reset'}
    <h2 style="margin-top:14px">Reset your password</h2>
    {#if !sent}
      <form class="card" onsubmit={send}>
        <label class="f">Email<input type="email" required autocomplete="email" bind:value={email} /></label>
        <button type="submit" disabled={busy} style="width:100%">{#if busy}<span class="spinner"></span>{/if} Email me a reset code</button>
        {#if err}<div class="err">⚠️ {err}</div>{/if}
      </form>
    {:else}
      <form class="card" onsubmit={reset}>
        <p class="small" style="margin-top:0">{info}</p>
        <label class="f">Reset code<input inputmode="numeric" autocomplete="one-time-code" required bind:value={code} placeholder="123456" style="font-size:22px;letter-spacing:4px;text-align:center" /></label>
        <label class="f">New password<input type="password" required autocomplete="new-password" bind:value={password} /></label>
        <button type="submit" disabled={busy || code.replace(/\D/g, '').length < 6} style="width:100%">{#if busy}<span class="spinner"></span>{/if} Save new password</button>
        {#if err}<div class="err">⚠️ {err}</div>{/if}
      </form>
      <button class="quiet" onclick={send} disabled={busy}>Send a new code</button>
    {/if}
    <button class="quiet" onclick={() => setMode('in')}>← Back to sign in</button>
  {:else}
    <div class="seg" style="margin-bottom:10px">
      <button class:on={mode === 'in'} onclick={() => setMode('in')}>Sign in</button>
      <button class:on={mode === 'up'} onclick={() => setMode('up')}>Create account</button>
    </div>

    <form class="card" onsubmit={go}>
      <label class="f">Email<input type="email" required autocomplete="email" bind:value={email} placeholder="you@example.com" /></label>
      <label class="f">Password<input type="password" required autocomplete={mode === 'in' ? 'current-password' : 'new-password'} bind:value={password} /></label>
      <button type="submit" disabled={busy} style="width:100%">{#if busy}<span class="spinner"></span>{/if} {mode === 'in' ? 'Sign in' : 'Create account'}</button>
      {#if err}<div class="err">⚠️ {err}</div>{/if}
    </form>
    {#if mode === 'in'}<button class="quiet" onclick={() => setMode('reset')}>Forgot password?</button>{/if}
    <p class="small muted">{mode === 'up' ? 'Invited by someone in your household? Use the email they invited and you\'ll join their household.' : 'You stay signed in on this device.'}</p>
    {#if !joining}
      <div class="guest">
        <button class="ghost" style="width:100%" onclick={guest} disabled={busy}>Continue without an account</button>
        <p class="small muted" style="margin:6px 0 0">Try everything right away. Without an account your meals <b>aren't saved</b>: they stay only in this browser, and they're gone if you sign out, clear your browser data, or switch devices. You can create an account any time to keep them.</p>
      </div>
    {/if}
  {/if}
</div>

<style>
  .guest { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); }
</style>

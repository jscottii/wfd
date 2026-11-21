<script>
  import { app, sb, toast, track } from '../lib/db.svelte.js';
  // Contact us / feedback — saved for the WFD team to read
  let kind = $state('feedback'), message = $state(''), replyTo = $state(app.user?.email || ''), busy = $state(false), sent = $state(false), err = $state('');
  const KINDS = [['feedback', '💬 Feedback'], ['bug', '🐞 Something’s broken'], ['idea', '💡 Idea'], ['help', '🙋 Need help']];
  async function send() {
    busy = true; err = '';
    const { error } = await sb.from('feedback').insert({ kind, message: message.trim(), reply_to: replyTo.trim() || null, app_version: `${__APP_VERSION__} (${__BUILD_DATE__})`, page: (location.hash || '#').slice(1, 40) });
    busy = false;
    if (error) { err = error.message; return; }
    sent = true; message = ''; track('feedback_sent', { kind }); toast('✓ Thanks — we got it');
  }
</script>

{#if sent}
  <p class="ok small">✓ Thanks! We read every message{replyTo ? ` and will reply to ${replyTo} if needed` : ''}.</p>
  <button class="quiet" onclick={() => (sent = false)}>Send another</button>
{:else}
  <div class="row" style="gap:4px;margin-bottom:8px">{#each KINDS as [k, l]}<button class="chip" class:on={kind === k} onclick={() => (kind = k)}>{l}</button>{/each}</div>
  <textarea rows="4" bind:value={message} maxlength="4000" placeholder={kind === 'bug' ? 'What happened, and what did you expect?' : kind === 'help' ? 'What do you need help with?' : 'Tell us what you think…'}></textarea>
  <label class="f" style="margin-top:6px">Reply to (optional)<input type="email" bind:value={replyTo} placeholder="you@example.com" /></label>
  {#if err}<div class="err small">⚠️ {err}</div>{/if}
  <button onclick={send} disabled={busy || message.trim().length < 2}>{#if busy}<span class="spinner"></span>{/if} Send</button>
{/if}

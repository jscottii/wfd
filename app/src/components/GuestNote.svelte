<script>
  import { signOut } from '../lib/db.svelte.js';
  // For guests on a view-only screen (Pantry, Settings): what's locked, and how to unlock it.
  let { text = 'Create an account to make changes here.', leave = false } = $props();
  const create = () => window.dispatchEvent(new Event('wfd-create-account'));
</script>

<div class="gnote">
  <p>🔒 {text}</p>
  <div class="row" style="gap:6px">
    <button onclick={create}>Create an account</button>
    {#if leave}<button class="ghost" onclick={() => { if (confirm('Leave guest mode? Your guest meals are deleted and can\'t be brought back.')) signOut(); }}>Leave guest mode</button>{/if}
  </div>
</div>

<style>
  .gnote { background: var(--accent-soft); color: var(--accent-dark); border-radius: 12px; padding: 10px 12px; margin: 8px 0 12px; }
  .gnote p { margin: 0 0 8px; font-size: 14px; }
  .gnote button { font-size: 14px; padding: 7px 14px; }
</style>

<script>
  import { track } from '../lib/db.svelte.js';
  // After an update: a short list of what changed since the version you last opened. Also reachable from More.
  let { onclose, all = false } = $props();
  const KEY = 'wfd-seen-version';
  const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
  let seen = ''; try { seen = localStorage.getItem(KEY) || ''; } catch {}
  const list = (__CHANGELOG__ || []).filter((v) => all || !seen || cmp(v.version, seen) > 0).slice(0, all ? 8 : 4);
  // bold the bit before the first colon ("Pantry → Add with the camera: …")
  const fmt = (n) => { const esc = n.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); const i = esc.indexOf(': '); return i > 0 && i < 60 ? `<b>${esc.slice(0, i)}</b>${esc.slice(i)}` : esc; };
  function done() { try { localStorage.setItem(KEY, __APP_VERSION__); } catch {} track('whats_new_seen', { version: __APP_VERSION__ }); onclose(); }
</script>

<div class="modal-back" role="presentation">
  <div class="modal card nocollapse" style="max-width:520px">
    <div class="spread"><h2 style="margin:0">✨ What's new</h2><button class="quiet" onclick={done} aria-label="Close">✕</button></div>
    {#each list as v}
      <h3 style="margin:14px 0 4px">v{v.version} <span class="small muted" style="font-weight:400">· {v.date}</span></h3>
      <ul style="margin:0;padding-left:18px">{#each v.notes as n}<li class="small" style="margin:5px 0">{@html fmt(n)}</li>{/each}</ul>
    {/each}
    <button style="margin-top:14px;width:100%" onclick={done}>Got it</button>
  </div>
</div>

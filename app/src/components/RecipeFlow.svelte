<script>
  import { buildFlow } from '../lib/flow.js';
  // The recipe as a flow chart: ingredients on the left, each step a block joining what it uses. Tap a step for its full text.
  let { r } = $props();
  const f = $derived(buildFlow(r));
  let shown = $state(null);
</script>

{#if f}
  <div class="flow-wrap">
    <div class="flow" style="grid-template-columns: minmax(150px, 1.6fr) repeat({f.cols - 1}, minmax(84px, 1fr))">
      {#each f.setup as s, i}
        <div class="fc setup" style="grid-row:{i + 1};grid-column:1 / span {f.cols}">{s.text}</div>
      {/each}
      {#each f.cells as c}
        {#if c.kind === 'step'}
          <button class="fc step" class:on={shown === c} style="grid-row:{c.row + 1 + f.setup.length} / span {c.rows};grid-column:{c.col + 1} / span {c.cols}" onclick={() => (shown = shown === c ? null : c)} title={c.full}>{c.text}</button>
        {:else}
          <div class="fc {c.kind}" style="grid-row:{c.row + 1 + f.setup.length} / span {c.rows};grid-column:{c.col + 1} / span {c.cols}">{c.text}</div>
        {/if}
      {/each}
    </div>
  </div>
  {#if shown}<p class="small flow-full"><b>Step:</b> {shown.full}</p>{/if}
{:else}
  <p class="small muted">This recipe's steps don't name their ingredients clearly enough to draw a flow chart.</p>
{/if}

<style>
  .flow-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 6px 0; border: 2px solid #5a9a3a; border-radius: 4px; }
  .flow { display: grid; min-width: max-content; background: #fffef2; }
  .fc { border: 1px solid #5a9a3a; padding: 8px 10px; font-size: 14px; line-height: 1.3; display: flex; align-items: center; min-height: 40px; }
  .fc.setup { justify-content: center; text-align: center; }
  .fc.ing { font-weight: 500; }
  .fc.step { justify-content: center; text-align: center; background: transparent; color: var(--ink); font-weight: 400; border-radius: 0; cursor: pointer; }
  .fc.step.on { background: #eef6e6; }
  .fc.gap { padding: 0; }
  .flow-full { background: #eef6e6; border-radius: 8px; padding: 8px 10px; margin: 0 0 8px; }
</style>

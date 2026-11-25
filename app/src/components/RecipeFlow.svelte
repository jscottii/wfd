<script>
  import { buildFlow } from '../lib/flow.js';
  // The recipe as a flow chart. Short recipes: ingredients on the left, each step a block joining what it uses.
  // Long recipes: the steps top to bottom, each with the ingredients it brings in. Tap a step for its full text.
  let { r } = $props();
  const f = $derived(buildFlow(r));
  let shown = $state(null), width = $state(0), pick = $state('');
  // the chart if it fits the screen (a little sideways scrolling is fine), otherwise steps top to bottom
  const auto = $derived(f && (f.mode === 'stack' || (width && 118 + (f.cols - 1) * 92 > width * 1.3)) ? 'stack' : 'grid');
  const view = $derived(pick || auto);
  const tap = (c) => (shown = shown === c ? null : c);
</script>

{#if f}
  <div class="vswitch" bind:clientWidth={width}>
    <button class:on={view === 'grid'} onclick={() => (pick = 'grid')}>Chart</button><button class:on={view === 'stack'} onclick={() => (pick = 'stack')}>Step by step</button>
  </div>
  {#if f.setup.length}
    <div class="setup">{#each f.setup as s}<button class="chip-step" class:on={shown === s} onclick={() => tap(s)}>🔧 {s.text}</button>{/each}</div>
  {/if}
  {#if view === 'grid'}
    <div class="flow-wrap">
      <div class="flow" style="grid-template-columns: minmax(118px, 170px) repeat({f.cols - 1}, minmax(92px, 124px))">
        {#each f.cells as c}
          {#if c.kind === 'step'}
            <button class="fc step" class:on={shown === c} style="grid-row:{c.row + 1} / span {c.rows};grid-column:{c.col + 1} / span {c.cols}" onclick={() => tap(c)} title={c.full}>{c.text}</button>
          {:else}
            <div class="fc {c.kind}" style="grid-row:{c.row + 1} / span {c.rows};grid-column:{c.col + 1} / span {c.cols}">{c.text}</div>
          {/if}
        {/each}
      </div>
    </div>
  {:else}
    <ol class="stack">
      {#each f.stack as s, i}
        <li>
          {#if s.adds.length}<div class="adds">{#each s.adds as a}<span class="ing-chip">{a}</span>{/each}</div>{/if}
          <button class="sstep" class:on={shown === s} onclick={() => tap(s)}><span class="n">{i + 1}</span>{s.text}</button>
          {#if shown === s}<p class="small flow-full">{s.full}</p>{/if}
        </li>
      {/each}
    </ol>
  {/if}
  {#if f.also.length}<p class="small muted also"><b>Also:</b> {f.also.join(' · ')}</p>{/if}
  {#if shown && (view === 'grid' || f.setup.includes(shown))}<p class="small flow-full"><b>Step:</b> {shown.full}</p>{/if}
{:else}
  <p class="small muted">This recipe's steps don't name their ingredients clearly enough to draw a flow chart.</p>
{/if}

<style>
  .vswitch { display: flex; justify-content: flex-end; gap: 2px; margin: 4px 0; }
  .vswitch button { background: transparent; color: var(--muted); font-size: 12px; font-weight: 600; padding: 4px 9px; border-radius: 999px; }
  .vswitch button.on { background: var(--tint); color: var(--ink); }
  .setup { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
  .chip-step { background: var(--tint); color: var(--ink); font-weight: 500; font-size: 13px; padding: 6px 10px; border-radius: 999px; }
  .chip-step.on { background: var(--accent-soft); color: var(--accent-dark); }

  .flow-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 6px 0; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .flow { display: grid; width: max-content; min-width: 100%; }
  .fc { border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 6px 8px; font-size: 13px; line-height: 1.3; display: flex; align-items: center; min-height: 34px; }
  .fc.ing { background: var(--card); color: var(--ink); }
  .fc.step { justify-content: center; text-align: center; background: var(--accent-soft); color: var(--accent-dark); font-weight: 600; border-radius: 0; cursor: pointer; }
  .fc.step.on { background: var(--accent); color: #fff; }
  .fc.gap { padding: 0; background: var(--card); }

  .stack { list-style: none; margin: 6px 0; padding: 0; display: flex; flex-direction: column; gap: 0; }
  .stack li { position: relative; padding-left: 14px; border-left: 2px solid var(--accent-soft); padding-bottom: 10px; }
  .stack li:last-child { border-left-color: transparent; padding-bottom: 0; }
  .adds { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 5px; }
  .ing-chip { background: var(--card); border: 1px solid var(--line); border-radius: 999px; padding: 2px 9px; font-size: 12px; color: var(--ink); }
  .sstep { display: flex; align-items: center; gap: 8px; width: 100%; justify-content: flex-start; text-align: left; background: var(--accent-soft); color: var(--accent-dark); font-weight: 600; font-size: 14px; padding: 9px 11px; border-radius: 10px; }
  .sstep.on { background: var(--accent); color: #fff; }
  .sstep .n { flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; margin-left: -25px; box-shadow: 0 0 0 3px var(--card); }
  .sstep.on .n { background: #fff; color: var(--accent); }
  .also { margin: 4px 0 8px; }
  .flow-full { background: var(--accent-soft); border-radius: 8px; padding: 8px 10px; margin: 4px 0 8px; }
</style>

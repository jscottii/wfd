<script>
  // one series per day as thin bars, baseline-anchored, with a hover/tap tooltip
  let { data = [], days = 30, label = '' } = $props();
  const W = 640, H = 150, P = { l: 28, r: 6, t: 8, b: 20 };
  let series = $derived.by(() => {
    const map = Object.fromEntries(data.map((x) => [String(x.d).slice(0, 10), Number(x.n) || 0]));
    const out = []; const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - days + 1);
    for (let i = 0; i < days; i++) { const k = d.toISOString().slice(0, 10); out.push({ k, n: map[k] || 0 }); d.setDate(d.getDate() + 1); }
    return out;
  });
  let max = $derived(Math.max(1, ...series.map((x) => x.n)));
  const nice = (m) => { const p = Math.pow(10, Math.floor(Math.log10(m))); return Math.ceil(m / p) * p; };
  let top = $derived(nice(max));
  let bw = $derived((W - P.l - P.r) / series.length);
  let hover = $state(-1);
  const fmtD = (k) => new Date(k + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
</script>

<div class="daybars">
  <svg viewBox="0 0 {W} {H}" role="img" aria-label={label} onmouseleave={() => (hover = -1)}>
    {#each [0, 0.5, 1] as g}
      <line x1={P.l} x2={W - P.r} y1={P.t + (H - P.t - P.b) * (1 - g)} y2={P.t + (H - P.t - P.b) * (1 - g)} class="grid" />
      <text x={P.l - 4} y={P.t + (H - P.t - P.b) * (1 - g) + 4} class="ax" text-anchor="end">{Math.round(top * g)}</text>
    {/each}
    {#each series as s, i}
      {@const h = ((H - P.t - P.b) * s.n) / top}
      <rect x={P.l + i * bw} y={P.t} width={bw} height={H - P.t - P.b} fill="transparent" onmouseenter={() => (hover = i)} onclick={() => (hover = i)} role="presentation" />
      {#if s.n > 0}<rect x={P.l + i * bw + 1} y={H - P.b - h} width={Math.max(2, bw - 2)} height={h} rx={Math.min(4, bw / 3)} class="bar" class:hot={hover === i} pointer-events="none" />{/if}
    {/each}
    <text x={P.l} y={H - 4} class="ax">{fmtD(series[0]?.k)}</text>
    <text x={W - P.r} y={H - 4} class="ax" text-anchor="end">{fmtD(series[series.length - 1]?.k)}</text>
  </svg>
  {#if hover >= 0}<div class="tip small"><b>{series[hover].n}</b> {label} · {fmtD(series[hover].k)}</div>{/if}
</div>

<style>
  .daybars { position: relative; }
  svg { width: 100%; height: auto; display: block; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .ax { font-size: 10px; fill: var(--muted); }
  .bar { fill: var(--accent); }
  .bar.hot { fill: var(--accent-dark, #174aa6); }
  .tip { position: absolute; top: 0; right: 0; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 2px 8px; }
</style>

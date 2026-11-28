<script>
  import { app, sb, saveSettings, toast } from '../lib/db.svelte.js';
  import DayBars from '../components/DayBars.svelte';
  import AreaMap from '../components/AreaMap.svelte';
  // Owner dashboards: usage, ads, and data storage. Only admins can load these numbers.
  let days = $state(30), tab = $state('usage'), st = $state(null), err = $state(''), busy = $state(false);
  async function load() {
    busy = true; err = '';
    const { data, error } = await sb.rpc('admin_stats', { days });
    busy = false;
    if (error) { err = error.message; return; }
    st = data;
  }
  $effect(() => { days; load(); });
  // where people shop from and which stores they use (a separate query, loaded when the tab opens)
  let geo = $state(null), geoErr = $state('');
  async function loadGeo() { geoErr = ''; const { data, error } = await sb.rpc('admin_geo', { days }); if (error) geoErr = /admin_geo|function/i.test(error.message) ? 'The “Where” numbers need a one-time database update (supabase/migrations/2026-11-28-admin-geo.sql).' : error.message; else geo = data; }
  $effect(() => { if (tab === 'where') { days; loadGeo(); } });
  const START = { home: '🏠 From home', here: '📍 From where they were', typed: '✏️ From a typed address' };
  const num = (n) => Number(n || 0).toLocaleString();
  const bytes = (b) => { b = Number(b) || 0; return b > 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB'; };
  const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + '%' : '—');
  const LABELS = { app_open: 'App opens', plan_start: 'Plans started', plan_draft: 'Drafts saved', pick_for_me: 'Pick for me', recipe_saved: 'Recipes saved', trip_planned: 'Trips planned', order_click: 'Delivery clicks', prep_open: 'Prep opened', feedback_sent: 'Feedback sent', onboarding_done: 'Finished setup', ad_impression: 'Ad impressions', ad_click: 'Ad clicks' };
  const FREE_DB = 500 * 1024 * 1024;   // Supabase free plan database size
</script>

{#snippet hbars(rows, key = 'n', fmt = num)}
  {@const max = Math.max(1, ...rows.map((r) => Number(r[key]) || 0))}
  {#each rows as r}
    <div class="hb" title="{r.k}: {fmt(r[key])}"><span class="hb-k small">{LABELS[r.k] || r.k || '—'}</span><span class="hb-bar"><span style="width:{(100 * (Number(r[key]) || 0)) / max}%"></span></span><span class="hb-n small">{fmt(r[key])}</span></div>
  {:else}<p class="small muted">No data yet.</p>{/each}
{/snippet}

<div class="page">
  <div class="spread"><h1>Dashboards</h1>
    <div class="seg">{#each [7, 30, 90] as d}<button class:on={days === d} onclick={() => (days = d)}>{d}d</button>{/each}</div>
  </div>
  <div class="seg" style="margin-bottom:10px">{#each [['usage', '📈 Usage'], ['where', '📍 Where & stores'], ['ads', '📣 Ads'], ['data', '🗄 Data storage']] as [k, l]}<button class:on={tab === k} onclick={() => (tab = k)}>{l}</button>{/each}</div>
  {#if err}<div class="err">⚠️ {err}</div>{/if}
  {#if busy && !st}<p class="muted"><span class="spinner"></span> Loading…</p>{/if}

  {#if st && tab === 'usage'}
    <div class="tiles">
      <div class="tile"><b>{num(st.users_total)}</b><span>accounts · {num(st.users_new)} new</span></div>
      <div class="tile"><b>{num(st.active_7d)}</b><span>active last 7 days</span></div>
      <div class="tile"><b>{num(st.active_1d)}</b><span>active today</span></div>
      <div class="tile"><b>{num(st.households_total)}</b><span>households · {st.members_avg || 0} people each</span></div>
      <div class="tile"><b>{num(st.plus_members)}</b><span>WFD Plus members</span></div>
      <div class="tile"><b>{num(st.feedback_new)}</b><span>new messages ({num(st.feedback_total)} total)</span></div>
    </div>
    <div class="card"><h3>Active people per day</h3><DayBars data={st.active_by_day} {days} label="active people" /></div>
    <div class="card"><h3>New accounts per day</h3><DayBars data={st.signups_by_day} {days} label="new accounts" /></div>
    <div class="grid2c">
      <div class="card"><h3>What people do</h3>{@render hbars(st.events_by_name.filter((e) => !/^ad_/.test(e.k)))}</div>
      <div class="card"><h3>Delivery clicks by store</h3>{@render hbars(st.orders_by_store)}</div>
      <div class="card"><h3>Prep style</h3>{@render hbars(st.prep_style)}</div>
      <div class="card"><h3>Where saved recipes come from</h3>{@render hbars(st.recipe_sources)}</div>
    </div>
    <div class="card"><h3>Most-planned recipes (households)</h3>{@render hbars(st.top_recipes)}</div>
    <div class="card"><h3>Latest messages</h3>
      {#each st.feedback_recent as f}<div class="list-row"><div class="grow"><span class="pill">{f.kind}</span> <span class="small">{f.msg}</span><div class="small muted">{new Date(f.at).toLocaleString()} · {f.v || ''}{f.reply ? ` · reply to ${f.reply}` : ''}</div></div></div>
      {:else}<p class="small muted">No messages yet.</p>{/each}
    </div>
    <p class="small muted">Usage is counted in our own database (no outside analytics tools). Counting started Nov 21, 2026.</p>
  {/if}

  {#if tab === 'where'}
    {#if geoErr}<div class="err">⚠️ {geoErr}</div>
    {:else if !geo}<p class="muted"><span class="spinner"></span> Loading…</p>
    {:else}
      <div class="tiles">
        <div class="tile"><b>{num(geo.homes_set)}</b><span>households with a home set</span></div>
        <div class="tile"><b>{num(geo.trip_starts.reduce((a, x) => a + x.n, 0))}</b><span>trips planned ({days}d)</span></div>
        <div class="tile"><b>{num(geo.stores_saved.length)}</b><span>store chains in use</span></div>
      </div>
      <div class="card"><h3>Where trips start</h3><AreaMap points={geo.trip_points} />
        <p class="small muted" style="margin:0">Each dot is an area about 10 km across, never an exact spot. <span style="color:#1f5fd1">●</span> from home · <span style="color:#e07a1f">●</span> from somewhere else. Trips before Nov 28 weren't mapped.</p></div>
      <div class="grid2c">
        <div class="card"><h3>Home areas (households)</h3>{@render hbars(geo.home_areas)}</div>
        <div class="card"><h3>How trips start</h3>{@render hbars(geo.trip_starts.map((x) => ({ ...x, k: START[x.k] || x.k })))}</div>
        <div class="card"><h3>Stores households shop at</h3>{@render hbars(geo.stores_saved)}</div>
        <div class="card"><h3>Stores on planned trips</h3>{@render hbars(geo.stores_on_trips)}</div>
      </div>
      <p class="small muted">Home areas show only the town and state; street addresses stay in the database.</p>
    {/if}
  {/if}

  {#if st && tab === 'ads'}
    <div class="card">
      <h3 style="margin-top:0">Ad slots</h3>
      <label class="row small" style="gap:8px;cursor:pointer"><span class="switch"><input type="checkbox" checked={!!app.settings.adPreview} onchange={(e) => { saveSettings({ adPreview: e.currentTarget.checked }); toast(e.currentTarget.checked ? 'Ad previews on — only you see them' : 'Ad previews off'); }} /><span></span></span> Preview ad slots in the app (only admins see previews)</label>
      <p class="small muted" style="margin:6px 0 0">Slots: Plan, Shop, Pantry, Prep and Prep full screen (banners), Saved recipes (in-list), Find recipes (box). {app.plus ? '' : ''}Live ads start when AdSense IDs are added; numbers below include previews until then.</p>
    </div>
    <div class="tiles">
      <div class="tile"><b>{num(st.ad_impressions)}</b><span>impressions</span></div>
      <div class="tile"><b>{num(st.ad_clicks)}</b><span>clicks</span></div>
      <div class="tile"><b>{pct(st.ad_clicks, st.ad_impressions)}</b><span>click-through rate</span></div>
    </div>
    <div class="card"><h3>Impressions per day</h3><DayBars data={st.ads_by_day} {days} label="impressions" /></div>
    <div class="card"><h3>By slot</h3>
      {#each st.ads_by_slot as s}<div class="list-row"><div class="grow"><b class="small">{s.k}</b></div><span class="small">{num(s.imp)} views · {num(s.clk)} clicks · {pct(s.clk, s.imp)}</span></div>
      {:else}<p class="small muted">No ad views yet — switch on previews above to test.</p>{/each}
    </div>
    <p class="small muted">Earnings and fill rate come from AdSense/AdMob once live; this shows what the app itself measures.</p>
  {/if}

  {#if st && tab === 'data'}
    <div class="tiles">
      <div class="tile"><b>{bytes(st.db_bytes)}</b><span>database size</span></div>
      <div class="tile"><b>{pct(st.db_bytes, FREE_DB)}</b><span>of the 500 MB free plan</span></div>
      <div class="tile"><b>{num(st.tables.reduce((a, t) => a + (Number(t.rows) || 0), 0))}</b><span>rows stored</span></div>
    </div>
    <div class="card"><h3>Biggest tables</h3>{@render hbars(st.tables.slice(0, 12), 'bytes', bytes)}</div>
    <div class="card"><h3>By household</h3>
      <div class="tw"><table class="wk"><thead><tr><th>Household</th><th>Recipes</th><th>Items</th><th>Pantry</th><th>Purchases</th></tr></thead>
        <tbody>{#each st.storage_by_household as h}<tr><td>{h.k}</td><td>{h.recipes}</td><td>{h.items}</td><td>{h.pantry}</td><td>{h.purchases}</td></tr>{/each}</tbody></table></div>
    </div>
    <p class="small muted">What we store and why is listed in the privacy policy. Deleting an account removes its data and any household it was the last member of.</p>
  {/if}
</div>

<style>
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-bottom: 10px; }
  .tile { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; }
  .tile b { font-size: 26px; line-height: 1.1; }
  .tile span { font-size: 12px; color: var(--muted); }
  .grid2c { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 0 12px; }
  .hb { display: grid; grid-template-columns: minmax(90px, 38%) 1fr auto; gap: 8px; align-items: center; margin: 5px 0; }
  .hb-k { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hb-bar { height: 10px; background: var(--tint); border-radius: 99px; overflow: hidden; }
  .hb-bar span { display: block; height: 100%; background: var(--accent); border-radius: 99px; }
  .hb-n { min-width: 44px; text-align: right; font-variant-numeric: tabular-nums; }
</style>

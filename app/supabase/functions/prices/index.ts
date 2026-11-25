// prices — the weekly price refresh. Called by a scheduled job in the database (pg_cron), never by the app.
// For each household that used the app in the last 3 weeks, it checks the items on that week's list
// (settings.priceWatch, saved by the app) and saves fresh prices for the stores the household shops at:
//   • Kroger family stores (Ralphs, Fred Meyer, King Soopers, QFC, Smith's, Fry's, Harris Teeter…) — Kroger's free API, store-level prices
//   • Walmart — Walmart's affiliate API (online price)
//   • everything else (Safeway, Target, Costco, Trader Joe's…) — one Google Shopping search per item through SerpApi, with a monthly cap
// Each source is used only if its keys are set. Locked prices and recent receipt prices are never overwritten.
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const env = (k: string) => (Deno.env.get(k) || '').trim();
const RECEIPT_FRESH_DAYS = 21;
const KROGER_CHAINS = /kroger|ralphs|fred meyer|king soopers|qfc|smith'?s|fry'?s|harris teeter|dillons|food 4 less|foods co|mariano|pick ?n ?save|metro market|city market|baker'?s|gerbes|jay c|pay ?less|ruler/i;
const norm = (s: string) => String(s || '').toLowerCase().replace(/[’']/g, '');
const matches = (title: string, must: string[] = []) => { const t = norm(title); return (must || []).every((tok) => tok.split('|').some((a) => t.includes(a))); };
const days = (iso?: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 864e5 : 1e9);

/* ---------- Kroger ---------- */
let krogerTok = '';
async function kroger(path: string) {
  if (!krogerTok) {
    const r = await fetch('https://api.kroger.com/v1/connect/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(env('KROGER_CLIENT_ID') + ':' + env('KROGER_CLIENT_SECRET')) },
      body: 'grant_type=client_credentials&scope=product.compact',
    });
    krogerTok = (await r.json()).access_token || '';
    if (!krogerTok) throw new Error('Kroger sign-in failed');
  }
  const r = await fetch('https://api.kroger.com/v1' + path, { headers: { Authorization: 'Bearer ' + krogerTok, Accept: 'application/json' } });
  return r.json();
}

/* ---------- Walmart affiliate API (signed requests) ---------- */
let wmKey: CryptoKey | null = null;
async function walmart(q: string) {
  const id = env('WALMART_CONSUMER_ID'), ver = env('WALMART_KEY_VERSION') || '1';
  if (!wmKey) {
    const pem = env('WALMART_PRIVATE_KEY').replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
    wmKey = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  }
  const ts = String(Date.now());
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', wmKey, new TextEncoder().encode(`${id}\n${ts}\n${ver}\n`));
  const r = await fetch(`https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search?query=${encodeURIComponent(q)}&numItems=10`, {
    headers: { 'WM_CONSUMER.ID': id, 'WM_CONSUMER.INTIMESTAMP': ts, 'WM_SEC.KEY_VERSION': ver, 'WM_SEC.AUTH_SIGNATURE': btoa(String.fromCharCode(...new Uint8Array(sig))) },
  });
  const j = await r.json().catch(() => ({}));
  return (j.items || []).map((x: any) => ({ title: x.name, price: x.salePrice ?? x.msrp ?? null }));
}

Deno.serve(async (req) => {
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  // only the scheduled job knows this token; it's made inside the database and never leaves it
  const { data: tok } = await admin.from('cron_token').select('token').maybeSingle();
  if (!tok?.token || req.headers.get('x-cron-token') !== tok.token) return json({ error: 'not allowed' }, 401);
  const body = await req.json().catch(() => ({}));

  const haveKroger = !!(env('KROGER_CLIENT_ID') && env('KROGER_CLIENT_SECRET'));
  const haveWalmart = !!(env('WALMART_CONSUMER_ID') && env('WALMART_PRIVATE_KEY'));
  const serpKey = env('SERPAPI_KEY');
  const month = new Date().toISOString().slice(0, 7);
  const serpCap = Number(env('PRICE_SERP_MONTHLY')) || 200;          // whole app, per month
  const perHouse = Number(env('PRICE_SERP_PER_HOUSEHOLD')) || 15;    // per household, per weekly run
  const { data: used } = await admin.from('price_runs').select('serp_used').eq('month', month).maybeSingle();
  let serpUsed = used?.serp_used || 0;

  const { data: houses } = await admin.from('settings').select('household_id, data, updated_at').gte('updated_at', new Date(Date.now() - 21 * 864e5).toISOString());
  const report: any[] = [];
  for (const h of houses || []) {
    if (body.household && body.household !== h.household_id) continue;
    const w = h.data?.priceWatch;
    if (!w?.ids?.length) continue;
    const hid = h.household_id;
    const [{ data: stores }, { data: items }, { data: rows }] = await Promise.all([
      admin.from('stores').select('*').eq('household_id', hid),
      admin.from('items').select('id, name, q, must, units').eq('household_id', hid).in('id', w.ids),
      admin.from('prices').select('*').eq('household_id', hid).in('item_id', w.ids),
    ]);
    const enabled = new Set(h.data?.enabledStores || []);
    const mine = (stores || []).filter((s: any) => s.enabled !== false && enabled.has(s.id));
    const existing = new Map((rows || []).map((r: any) => [r.item_id + '|' + r.store_id, r]));
    const keep = (iid: string, sid: string) => { const e: any = existing.get(iid + '|' + sid); return e && (e.locked || (e.source === 'receipt' && days(e.updated_at) < RECEIPT_FRESH_DAYS)); };
    const now = new Date().toISOString(), out: any[] = [];
    const save = (it: any, sid: string, unit: number, matched: string, source: string) =>
      out.push({ household_id: hid, item_id: it.id, store_id: sid, price: Math.round(unit * (Number(it.units) || 1) * 100) / 100, unit_price: unit, source, matched, updated_at: now, checked_at: now });
    const stat = { household: hid, kroger: 0, walmart: 0, serp: 0, searches: 0 };

    // Kroger family: one store near home, then one search per item
    const kStore = mine.find((s: any) => KROGER_CHAINS.test(`${s.name} ${s.short}`));
    if (haveKroger && kStore && (w.zip || w.lat)) {
      try {
        const near = w.lat ? `filter.latLong.near=${w.lat},${w.lng}` : `filter.zipCode.near=${w.zip}`;
        const loc = (await kroger(`/locations?${near}&filter.radiusInMiles=15&filter.limit=1`)).data?.[0]?.locationId;
        if (loc) for (const it of items || []) {
          if (keep(it.id, kStore.id)) continue;
          const p = (await kroger(`/products?filter.term=${encodeURIComponent(it.q || it.name)}&filter.locationId=${loc}&filter.limit=8`)).data || [];
          const hit = p.find((x: any) => matches(x.description, it.must) && x.items?.[0]?.price);
          if (hit) { const pr = hit.items[0].price; save(it, kStore.id, pr.promo || pr.regular, `${hit.description} [Kroger API]`, 'live'); stat.kroger++; }
        }
      } catch (e) { console.warn('kroger', hid, String(e)); }
    }

    // Walmart: affiliate API (online price)
    const wStore = mine.find((s: any) => /walmart/i.test(`${s.name} ${s.short}`));
    if (haveWalmart && wStore) {
      for (const it of items || []) {
        if (keep(it.id, wStore.id)) continue;
        try {
          const hit = (await walmart(it.q || it.name)).find((x: any) => x.price && matches(x.title, it.must));
          if (hit) { save(it, wStore.id, hit.price, `${hit.title} [Walmart API]`, 'live'); stat.walmart++; }
        } catch (e) { console.warn('walmart', hid, String(e)); break; }
      }
    }

    // everyone else: Google Shopping through SerpApi, capped
    const covered = new Set([kStore && haveKroger ? kStore.id : '', wStore && haveWalmart ? wStore.id : '']);
    const sStores = mine.filter((s: any) => !covered.has(s.id) && s.source !== 'instacart');
    if (serpKey && sStores.length) {
      // oldest-checked items first, so the cap rotates through the list over the weeks
      const last = (it: any) => Math.max(0, ...sStores.map((s: any) => { const e: any = existing.get(it.id + '|' + s.id); return e?.checked_at ? new Date(e.checked_at).getTime() : 0; }));
      const todo = [...(items || [])].filter((it) => Date.now() - last(it) > 5 * 864e5).sort((a, b) => last(a) - last(b)).slice(0, perHouse);
      for (const it of todo) {
        if (serpUsed >= serpCap) break;
        try {
          const r = await fetch(`https://serpapi.com/search.json?engine=google_shopping&gl=us&hl=en&num=60&location=${encodeURIComponent(w.loc || 'United States')}&q=${encodeURIComponent(it.q || it.name)}&api_key=${encodeURIComponent(serpKey)}`);
          const j = await r.json(); serpUsed++; stat.searches++;
          const res = [...(j.shopping_results || []), ...(j.inline_shopping_results || [])].map((x: any) => ({ title: x.title, source: x.source, price: x.extracted_price ?? null }));
          for (const s of sStores) {
            if (keep(it.id, s.id)) continue;
            const m = norm(s.merchant || s.short || s.name);
            const hit = res.find((x: any) => x.price && norm(x.source).includes(m) && matches(x.title, it.must));
            if (hit) { save(it, s.id, hit.price, `${hit.title} [${hit.source}]`, 'live'); stat.serp++; }
          }
        } catch (e) { console.warn('serp', hid, String(e)); }
      }
    }

    if (out.length) {
      const { error } = await admin.from('prices').upsert(out);
      if (error) console.warn('save', hid, error.message);
    }
    report.push(stat);
  }
  await admin.from('price_runs').upsert({ month, serp_used: serpUsed, last_run: new Date().toISOString(), report });
  return json({ ok: true, serpUsed, serpCap, houses: report });
});

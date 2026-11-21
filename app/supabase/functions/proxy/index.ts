// proxy — the only server code. Signed-in household members only.
//   bm-archive            newest posts from the bare minimum
//   bm-post {slug}        one post (recipes + shopping list HTML)
//   serp-account          check the household's SerpApi key (free)
//   serp-search {q, location}  one Google Shopping search (counts toward the monthly cap)
//   serp-location {city, state} SerpApi's canonical location name
//   instacart-list {title, items:[{name, quantity, unit, display}]}  an Instacart shopping-list page (pick Costco, Safeway, … there)
//   serp-walmart-cart {items:[{name,count}]}  Walmart add-to-cart link (one SerpApi search per item)
//   instacart-retailers {postal_code}  Instacart stores near a ZIP
//   delete-account {confirm:'DELETE'}  delete your sign-in; the household's data too if you're its last member
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const BM = 'https://barefoodtim.substack.com';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: u, error: ue } = await admin.auth.getUser(token);
    if (ue || !u?.user) return json({ error: 'Please sign in again.' }, 401);
    // the household you're looking at: your current one if you're still in it, else your first
    const { data: mems } = await admin.from('members').select('household_id, created_at').eq('user_id', u.user.id).order('created_at');
    if (!mems?.length) return json({ error: 'No household yet.' }, 403);
    const { data: pref } = await admin.from('user_prefs').select('current_household').eq('user_id', u.user.id).maybeSingle();
    const hid = mems.find((m: any) => m.household_id === pref?.current_household)?.household_id || mems[0].household_id;
    const body = await req.json().catch(() => ({}));

    if (body.action === 'capabilities') {
      // which shared services the app can use (never returns the keys themselves)
      const { data: sec } = await admin.from('household_secrets').select('serpapi_key, instacart_key').eq('household_id', hid).maybeSingle();
      return json({ instacart: !!(sec?.instacart_key || Deno.env.get('INSTACART_API_KEY')), serp: !!sec?.serpapi_key, walmart: !!(sec?.serpapi_key || Deno.env.get('SERPAPI_KEY')),
        stripe: !!Deno.env.get('STRIPE_SECRET_KEY') });
    }

    if (body.action === 'instacart-list') {
      const { data: sec } = await admin.from('household_secrets').select('instacart_key').eq('household_id', hid).maybeSingle();
      const key = sec?.instacart_key || Deno.env.get('INSTACART_API_KEY');
      if (!key) return json({ error: 'Instacart ordering isn’t switched on for this app yet.' }, 400);
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 200).filter((x: any) => x && x.name);
      if (!items.length) return json({ error: 'Nothing to order.' }, 400);
      const payload = {
        title: String(body.title || 'WFD shopping list').slice(0, 100),
        link_type: 'shopping_list',
        expires_in: 30,
        line_items: items.map((x: any) => ({
          name: String(x.name).slice(0, 100),
          display_text: x.display ? String(x.display).slice(0, 100) : undefined,
          line_item_measurements: x.quantity ? [{ quantity: Number(x.quantity) || 1, unit: String(x.unit || 'each') }] : undefined,
        })),
        landing_page_configuration: { partner_linkback_url: 'https://jscottii.github.io/wfd/' },
      };
      // live key first; a development key only works against Instacart's test site
      for (const base of ['https://connect.instacart.com', 'https://connect.dev.instacart.tools']) {
        const r = await fetch(base + '/idp/v1/products/products_link', {
          method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload),
        });
        if (r.status === 401 || r.status === 403) continue;
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return json({ error: j?.errors?.[0]?.message || j?.error || `Instacart said ${r.status}` }, 502);
        return json({ url: j.products_link_url, test: base.includes('dev') });
      }
      return json({ error: "Instacart didn't accept that key. Check it in your Instacart developer dashboard." }, 400);
    }

    if (body.action === 'delete-account') {
      if (body.confirm !== 'DELETE') return json({ error: 'Type DELETE to confirm.' }, 400);
      await admin.from('members').delete().eq('user_id', u.user.id);
      // every household you were the last member of goes too (recipes, plans, prices, pantry, receipts, keys)
      let householdDeleted = false;
      for (const m of mems) {
        const { count } = await admin.from('members').select('user_id', { count: 'exact', head: true }).eq('household_id', m.household_id);
        if (!count) {
          const { error: he } = await admin.from('households').delete().eq('id', m.household_id);
          if (he) return json({ error: he.message }, 500);
          householdDeleted = true;
        }
      }
      await admin.from('invites').delete().eq('invited_by', u.user.id);
      const { error: de } = await admin.auth.admin.deleteUser(u.user.id);
      if (de) return json({ error: de.message }, 500);
      return json({ ok: true, householdDeleted });
    }

    if (body.action === 'recipe-url') {
      let u: URL;
      try { u = new URL(String(body.url || '')); } catch { return json({ error: 'That isn’t a web link.' }, 400); }
      if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname) || !u.hostname.includes('.'))
        return json({ error: 'That link can’t be opened.' }, 400);
      const r = await fetch(u.href, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WFD recipe import)', Accept: 'text/html' }, redirect: 'follow' });
      if (!r.ok) return json({ error: `That site answered HTTP ${r.status}` }, 502);
      const html = (await r.text()).slice(0, 3_000_000);
      const out: any[] = [];
      const walk = (x: any) => {
        if (!x || typeof x !== 'object') return;
        if (Array.isArray(x)) return x.forEach(walk);
        const t = [].concat(x['@type'] || []).map(String);
        if (t.includes('Recipe')) out.push(x);
        if (x['@graph']) walk(x['@graph']);
        if (x.mainEntity) walk(x.mainEntity);
      };
      for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        try { walk(JSON.parse(m[1].trim())); } catch { /* skip bad blocks */ }
      }
      const keep = out.map((x) => ({ name: x.name, recipeIngredient: x.recipeIngredient, recipeInstructions: x.recipeInstructions,
        recipeYield: x.recipeYield, recipeCategory: x.recipeCategory, recipeCuisine: x.recipeCuisine, image: x.image, nutrition: x.nutrition ? { calories: x.nutrition.calories } : null }));
      return json({ url: r.url, recipes: keep });
    }

    if (body.action === 'recipe-search') {
      // search a few big recipe sites; returns links the app can import with recipe-url
      const q = String(body.q || '').slice(0, 80);
      const sites: [string, string, RegExp][] = [
        ['Allrecipes', `https://www.allrecipes.com/search?q=${encodeURIComponent(q)}`, /href="(https:\/\/www\.allrecipes\.com\/recipe\/\d+\/[^"]+)"[\s\S]{0,1500}?card__title-text[^>]*>([^<]+)</g],
        ['Food Network', `https://www.foodnetwork.com/search/${encodeURIComponent(q.replace(/\s+/g, '-'))}-`, /href="(\/\/www\.foodnetwork\.com\/recipes\/[^"]+)"[^>]*>\s*<span[^>]*>([^<]+)</g],
        ['Simply Recipes', `https://www.simplyrecipes.com/search?q=${encodeURIComponent(q)}`, /href="(https:\/\/www\.simplyrecipes\.com\/(?:recipes\/)?[a-z0-9-]+-\d+)"[\s\S]{0,1500}?card__title-text[^>]*>([^<]+)</g],
      ];
      const results: any[] = [];
      await Promise.all(sites.map(async ([site, url, re]) => {
        try {
          const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' } });
          if (!r.ok) return;
          const html = await r.text(), seen = new Set();
          for (const m of html.matchAll(re)) {
            const link = m[1].startsWith('//') ? 'https:' + m[1] : m[1];
            if (seen.has(link) || seen.size >= 8) continue; seen.add(link);
            results.push({ site, url: link, title: m[2].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim() });
          }
        } catch { /* a site being down shouldn't break the search */ }
      }));
      return json({ results });
    }

    if (body.action === 'bm-archive') {
      const r = await fetch(`${BM}/api/v1/archive?sort=new&limit=30`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) return json({ error: `the bare minimum answered HTTP ${r.status}` }, 502);
      const j = await r.json();
      const posts = (Array.isArray(j) ? j : j.posts || []).map((p: any) => ({
        slug: p.slug, title: p.title, subtitle: p.subtitle || '', date: String(p.post_date || '').slice(0, 10),
        free: p.audience === 'everyone', url: p.canonical_url || `${BM}/p/${p.slug}`,
      }));
      return json({ posts });
    }

    if (body.action === 'bm-post') {
      const slug = String(body.slug || '').replace(/[^a-z0-9-]/gi, '');
      const r = await fetch(`${BM}/api/v1/posts/${slug}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) return json({ error: `Couldn't open that post (HTTP ${r.status})` }, 502);
      const p = await r.json();
      return json({ slug, title: p.title, date: String(p.post_date || '').slice(0, 10), free: p.audience === 'everyone',
                    url: p.canonical_url, html: p.body_html || '' });
    }

    if (String(body.action || '').startsWith('serp-')) {
      if (body.action === 'serp-location') {
        const r = await fetch(`https://serpapi.com/locations.json?limit=10&q=${encodeURIComponent(body.city || '')}`);
        const list = await r.json().catch(() => []);
        const hit = (list || []).find((x: any) => String(x.canonical_name || '').includes(body.state || 'California'));
        return json({ location: hit ? String(hit.canonical_name).replace(/,/g, ', ') : `${body.state || 'California'}, United States` });
      }
      const { data: sec } = await admin.from('household_secrets').select('serpapi_key').eq('household_id', hid).maybeSingle();
      // the app-wide key (SERPAPI_KEY) is only for Walmart+ carts; live price checks need a household's own key
      const key = (sec?.serpapi_key || (body.action === 'serp-walmart-cart' ? Deno.env.get('SERPAPI_KEY') : '') || '').trim();
      if (!key) return json({ error: 'Live price checks aren’t switched on for this app yet.' }, 400);

      if (body.action === 'serp-account') {
        const r = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(key)}`);
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.error) return json({ ok: false, error: j.error || `SerpApi answered HTTP ${r.status}` });
        return json({ ok: true, plan: j.plan_name || 'Free', left: j.plan_searches_left ?? j.total_searches_left, perMonth: j.searches_per_month });
      }

      if (body.action === 'serp-search') {
        const month = new Date().toISOString().slice(0, 7);
        const { data: st } = await admin.from('settings').select('data').eq('household_id', hid).maybeSingle();
        const limit = Number(st?.data?.serpMonthlyLimit) || 230;
        const { data: use } = await admin.from('serp_usage').select('n').eq('household_id', hid).eq('month', month).maybeSingle();
        const n = use?.n || 0;
        if (n >= limit) return json({ error: `Monthly SerpApi limit reached (${limit}).`, budget: true }, 429);
        const url = `https://serpapi.com/search.json?engine=google_shopping&gl=us&hl=en&num=60&location=${encodeURIComponent(body.location || 'California, United States')}&q=${encodeURIComponent(body.q || '')}&api_key=${encodeURIComponent(key)}`;
        const r = await fetch(url);
        const j = await r.json().catch(() => ({}));
        await admin.from('serp_usage').upsert({ household_id: hid, month, n: n + 1 });
        if (!r.ok || (j.error && !/hasn't returned any results/i.test(j.error))) return json({ error: j.error || `SerpApi HTTP ${r.status}` }, 502);
        const results = [...(j.shopping_results || []), ...(j.inline_shopping_results || [])].map((x: any) => ({
          title: x.title, source: x.source, price: x.extracted_price ?? (x.price ? Number(String(x.price).replace(/[^0-9.]/g, '')) : null),
        }));
        return json({ results, used: n + 1, limit });
      }

      if (body.action === 'serp-walmart-cart') {
        // look up each item's Walmart product number, then build Walmart's add-to-cart link
        const items = (Array.isArray(body.items) ? body.items : []).filter((x: any) => x && x.name).slice(0, 40);
        const month = new Date().toISOString().slice(0, 7);
        const { data: st } = await admin.from('settings').select('data').eq('household_id', hid).maybeSingle();
        const limit = Number(st?.data?.serpMonthlyLimit) || 230;
        const { data: use } = await admin.from('serp_usage').select('n').eq('household_id', hid).eq('month', month).maybeSingle();
        let n = use?.n || 0;
        if (n + items.length > limit) return json({ error: `That needs ${items.length} SerpApi searches and only ${Math.max(0, limit - n)} are left this month.`, budget: true }, 429);
        const found: any[] = [], missing: string[] = [];
        await Promise.all(items.map(async (x: any) => {
          try {
            const r = await fetch(`https://serpapi.com/search.json?engine=walmart&query=${encodeURIComponent(x.name)}&api_key=${encodeURIComponent(key)}`);
            const j = await r.json(); n++;
            const hit = (j.organic_results || []).find((o: any) => o.us_item_id || o.product_id);
            if (hit) found.push({ name: x.name, id: String(hit.us_item_id || hit.product_id), qty: Math.max(1, Math.round(Number(x.count) || 1)), title: hit.title, price: hit.primary_offer?.offer_price ?? null });
            else missing.push(x.name);
          } catch { missing.push(x.name); }
        }));
        await admin.from('serp_usage').upsert({ household_id: hid, month, n });
        if (!found.length) return json({ error: 'Walmart didn’t find those items.' }, 404);
        const url = 'https://affil.walmart.com/cart/addToCart?items=' + found.map((f) => `${f.id}|${f.qty}`).join(',');
        return json({ url, found, missing, used: n, limit });
      }
    }

    if (body.action === 'instacart-retailers') {
      // stores near a ZIP code on Instacart, so the list can open straight at Costco, Safeway, …
      const { data: sec } = await admin.from('household_secrets').select('instacart_key').eq('household_id', hid).maybeSingle();
      const key = sec?.instacart_key || Deno.env.get('INSTACART_API_KEY');
      if (!key) return json({ error: 'Instacart ordering isn’t switched on for this app yet.' }, 400);
      const zip = String(body.postal_code || '').replace(/[^0-9A-Za-z ]/g, '').slice(0, 10);
      for (const base of ['https://connect.instacart.com', 'https://connect.dev.instacart.tools']) {
        const r = await fetch(`${base}/idp/v1/retailers?postal_code=${encodeURIComponent(zip)}&country_code=${body.country || 'US'}`, { headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' } });
        if (r.status === 401 || r.status === 403) continue;
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return json({ error: j?.errors?.[0]?.message || `Instacart said ${r.status}` }, 502);
        return json({ retailers: (j.retailers || []).map((x: any) => ({ key: x.retailer_key, name: x.name, logo: x.retailer_logo_url })) });
      }
      return json({ error: "Instacart didn't accept that key for store lookups." }, 400);
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

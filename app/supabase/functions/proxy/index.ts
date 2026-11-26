// proxy — the only server code. Signed-in household members only.
//   bm-archive            newest posts from the bare minimum
//   bm-post {slug}        one post (recipes + shopping list HTML)
//   serp-account          check the household's SerpApi key (free)
//   serp-search {q, location}  one Google Shopping search (counts toward the monthly cap)
//   serp-location {city, state} SerpApi's canonical location name
//   instacart-list {title, items:[{name, quantity, unit, display}]}  an Instacart shopping-list page (pick Costco, Safeway, … there)
//   serp-walmart-cart {items:[{name,count}]}  Walmart add-to-cart link (one SerpApi search per item)
//   instacart-retailers {postal_code}  Instacart stores near a ZIP
//   vision-pantry {image: base64 jpeg}  list the food in a photo of a shelf or fridge (needs ANTHROPIC_API_KEY)
//   delete-account {confirm:'DELETE'}  delete your sign-in; the household's data too if you're its last member
import { parseHTML } from 'npm:linkedom@0.18';
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
        stripe: !!Deno.env.get('STRIPE_SECRET_KEY'), vision: !!Deno.env.get('ANTHROPIC_API_KEY') });
    }

    if (body.action === 'vision-pantry') {
      const key = Deno.env.get('ANTHROPIC_API_KEY');
      if (!key) return json({ error: 'Photo recognition isn’t switched on yet — scan barcodes instead.' }, 400);
      const image = String(body.image || '');
      if (!image || image.length > 7_000_000) return json({ error: 'That photo is too big — try again.' }, 400);
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: Deno.env.get('VISION_MODEL') || 'claude-haiku-5-5', max_tokens: 1200,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: 'This is a photo of someone\'s pantry shelf, fridge or freezer. List each distinct food or cooking ingredient you can clearly see, as a grocery item name (e.g. "Black beans", "Whole milk", "Chicken thighs"). Count packages when you can. Skip anything you cannot identify, and non-food items. Reply with ONLY JSON: {"items":[{"name":"...","amount":2,"unit":"can"}]} (amount and unit optional).' },
          ] }],
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: 'Photo recognition is busy — try again in a moment.' }, 502);
      const text = (j.content || []).map((c: any) => c.text || '').join('');
      let items: any[] = [];
      try { items = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).items || []; } catch { items = []; }
      items = items.filter((x) => x && typeof x.name === 'string' && x.name.trim()).slice(0, 40)
        .map((x) => ({ name: x.name.trim().slice(0, 60), amount: Number(x.amount) || null, unit: typeof x.unit === 'string' ? x.unit.slice(0, 20) : '' }));
      return json({ items });
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
        landing_page_configuration: { partner_linkback_url: 'https://wfdmeals.app/' },
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
      let r: Response;
      try { r = await fetch(u.href, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Accept: 'text/html', 'Accept-Language': 'en-US,en;q=0.9' }, redirect: 'follow' }); }
      catch { return json({ error: 'That site didn’t answer. Check the link, or try again in a minute.' }, 502); }
      if (r.status === 403 || r.status === 401 || r.status === 429) return json({ error: 'That site blocks other apps from reading its pages. Open the recipe in Chrome and save it with the WFD extension, or add it by hand.' }, 502);
      if (!r.ok) return json({ error: `That page couldn’t be opened (the site answered ${r.status}). Check the link.` }, 502);
      const html = (await r.text()).slice(0, 3_000_000);
      const { document } = parseHTML(html);
      const recipes = readRecipeFromDocument(document, r.url);
      return json({ url: r.url, recipes });
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

// <readrecipe> copied from src/lib/readrecipe.js by scripts/sync-proxy.mjs — edit that file, then run the script
// @ts-nocheck: plain JS shared with the app
// Reads the recipe(s) on a web page, from a DOM document (the browser's, or linkedom's on the server).
// 1. schema.org JSON-LD (most recipe sites)  2. schema.org microdata  3. the page's own layout:
//    an "Ingredients" heading with a list, then "Directions"/"Instructions" or "Step 1, Step 2…" blocks.
// Returns schema.org-shaped objects: [{ name, recipeIngredient, recipeInstructions, recipeYield, recipeCuisine, recipeCategory, image, nutrition }]
// Used by the server import (supabase/functions/proxy, a copy kept in sync by scripts/sync-proxy.mjs) and the Chrome extension.

function readRecipeFromDocument(doc, url = '') {
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const meta = (p) => doc.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.getAttribute('content') || '';

  // 1. JSON-LD
  const out = [];
  const walk = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(walk);
    const t = [].concat(x['@type'] || []).map(String);
    if (t.includes('Recipe')) out.push(x);
    if (x['@graph']) walk(x['@graph']);
    if (x.mainEntity) walk(x.mainEntity);
  };
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) { try { walk(JSON.parse(s.textContent.trim())); } catch (_) { /* skip bad blocks */ } }
  const keep = (x) => ({ name: x.name, recipeIngredient: x.recipeIngredient, recipeInstructions: x.recipeInstructions, recipeYield: x.recipeYield,
    recipeCategory: x.recipeCategory, recipeCuisine: x.recipeCuisine, image: x.image, nutrition: x.nutrition ? { calories: x.nutrition.calories } : null });
  const good = out.filter((x) => (x.recipeIngredient || x.ingredients || []).length);
  if (good.length) return good.map(keep);

  // 2. microdata
  const md = doc.querySelector('[itemtype*="schema.org/Recipe"]');
  if (md) {
    const prop = (p) => [...md.querySelectorAll(`[itemprop="${p}"]`)];
    const ing = [...prop('recipeIngredient'), ...prop('ingredients')].map((e) => clean(e.textContent)).filter(Boolean);
    const steps = prop('recipeInstructions').flatMap((e) => { const lis = [...e.querySelectorAll('li')]; return lis.length ? lis.map((l) => clean(l.textContent)) : [clean(e.textContent)]; }).filter(Boolean);
    if (ing.length >= 2 && steps.length) {
      const img = prop('image')[0];
      return [{ name: clean(prop('name')[0]?.textContent) || clean(doc.querySelector('h1')?.textContent), recipeIngredient: ing, recipeInstructions: steps,
        recipeYield: clean(prop('recipeYield')[0]?.textContent) || '', image: img?.getAttribute('src') || img?.getAttribute('content') || meta('og:image') }];
    }
  }

  // 3. the page's own layout
  const body = doc.body || doc.documentElement;
  if (!body) return [];
  const all = [...body.querySelectorAll('*')].filter((e) => !/^(SCRIPT|STYLE|NOSCRIPT|SVG|NAV|FOOTER|HEADER|FORM|BUTTON|SELECT|OPTION)$/i.test(e.tagName) && !e.closest('nav,footer,header,aside,form'));
  const pos = new Map(all.map((e, i) => [e, i]));
  const text = (e) => clean(e.textContent);
  // a "label" is a short element whose own words are the heading (its children don't also make up the same words)
  const labels = (re) => all.filter((e) => {
    const t = text(e);
    if (!t || t.length > 40 || !re.test(t)) return false;
    return ![...e.children].some((c) => text(c) === t);   // keep the innermost
  });
  const ING = /^(ingredients?|what you(?:'|’)?ll need|you(?:'|’)?ll need|shopping list)\s*:?$/i;
  const DIR = /^(directions?|instructions?|method|preparation|steps|how to make(?: it)?|procedure|cooking instructions)\s*:?$/i;
  const STEP = /^step\s*\d+\s*[:.]?$/i;
  const STOP = /^(nutrition(al)?( information| facts)?|notes?|tips?|reviews?|comments?|related( recipes)?|you (may|might) also like|more recipes|recipe quick facts|share|print|rate this recipe|made with our|equipment)\b/i;
  const stops = labels(STOP), dirs = labels(DIR), steps = labels(STEP);
  const nextAfter = (p, lists) => Math.min(...lists.flat().map((e) => pos.get(e)).filter((x) => x > p), Infinity);
  const leafText = (e) => [...e.querySelectorAll('p,li,div')].every((c) => text(c).length <= 15);
  // an element's text with line breaks kept (<br> and block children start new lines; textContent drops them)
  const lines = (e) => { let s = ''; const go = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) s += c.data; else if (c.nodeType === 1) { if (c.tagName === 'BR') s += '\n'; else { const blk = /^(P|DIV|LI)$/.test(c.tagName); if (blk) s += '\n'; go(c); if (blk) s += '\n'; } } } }; go(e); return s.split(/\n+/).map(clean).filter(Boolean); };

  let ingredients = [], ingAt = -1;
  for (const h of labels(ING)) {
    const p = pos.get(h), end = nextAfter(p, [dirs, steps, stops]);
    const lis = all.filter((e) => e.tagName === 'LI' && pos.get(e) > p && pos.get(e) < end && !e.querySelector('li')).map(text).filter((t) => t && t.length < 200);
    let got = lis;
    if (got.length < 2) got = all.filter((e) => /^(P|DIV|SPAN)$/.test(e.tagName) && pos.get(e) > p && pos.get(e) < end && leafText(e)).flatMap(lines).filter((t) => t && t.length < 160 && !ING.test(t) && !DIR.test(t) && !STEP.test(t) && !STOP.test(t));
    if (got.length >= 2) { ingredients = [...new Set(got)].slice(0, 60); ingAt = p; break; }
  }
  if (!ingredients.length) return [];

  let method = [];
  const after = (list) => list.filter((e) => pos.get(e) > ingAt);
  const dir = after(dirs)[0];
  if (dir) {
    const p = pos.get(dir), end = nextAfter(p, [stops]);
    method = all.filter((e) => e.tagName === 'LI' && pos.get(e) > p && pos.get(e) < end && !e.querySelector('li')).map(text);
    if (!method.length) method = all.filter((e) => /^(P|DIV)$/.test(e.tagName) && pos.get(e) > p && pos.get(e) < end && leafText(e)).flatMap(lines).filter((t) => t.length > 15 && !STEP.test(t) && !DIR.test(t));
  }
  if (!method.length) {
    const st = after(steps);
    st.forEach((h, i) => {
      const p = pos.get(h), end = Math.min(st[i + 1] ? pos.get(st[i + 1]) : Infinity, nextAfter(p, [stops]));
      const parts = all.filter((e) => pos.get(e) > p && pos.get(e) < end && !e.contains(h) && leafText(e) && text(e).length > 3 && !STEP.test(text(e)))
        .filter((e, _, arr) => !arr.some((o) => o !== e && o.contains(e)));   // outermost leaf blocks only
      const t = clean(parts.map(text).join(' '));
      if (t) method.push(t);
    });
  }
  method = method.filter((t) => t && t.length > 3).slice(0, 40);
  if (!method.length) return [];

  const bodyText = clean(body.textContent);
  const y = bodyText.match(/(\d+)\s*(?:servings?|portions)/i)?.[1] || bodyText.match(/(?:serves|makes|yields?)\s*:?\s*(\d+)/i)?.[1] || '';
  const name = clean(doc.querySelector('h1')?.textContent) || clean(meta('og:title')) || clean(doc.title);
  return [{ name, recipeIngredient: ingredients, recipeInstructions: method, recipeYield: y, image: meta('og:image') || '', nutrition: null }];
}
// </readrecipe>

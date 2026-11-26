// Reads the recipe(s) on a web page, from a DOM document (the browser's, or linkedom's on the server).
// 1. schema.org JSON-LD (most recipe sites)  2. schema.org microdata  3. the page's own layout:
//    an "Ingredients" heading with a list, then "Directions"/"Instructions" or "Step 1, Step 2…" blocks.
// Returns schema.org-shaped objects: [{ name, recipeIngredient, recipeInstructions, recipeYield, recipeCuisine, recipeCategory, image, nutrition }]
// Used by the server import (supabase/functions/proxy, a copy kept in sync by scripts/sync-proxy.mjs) and the Chrome extension.

export function readRecipeFromDocument(doc, url = '') {
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

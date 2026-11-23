// Pantry: what's on hand, where it lives, when to use it, and which recipes it covers.

const FRIDGE = /produce|meat|dairy|deli|seafood|fish|refrigerated|eggs/i;
const FREEZER = /frozen|freezer/i;
/** Where a shopping item usually lives. */
export function placeFor(cat = '', name = '') {
  if (FREEZER.test(cat) || /\bfrozen\b/i.test(name)) return 'freezer';
  if (/produce/i.test(cat) || !cat) { if (/\b(potato|onion|garlic|squash|banana|avocado|tomato)/i.test(name)) return 'counter'; if (/produce/i.test(cat)) return 'fridge'; }
  if (FRIDGE.test(cat) || /\b(milk|yogurt|cheese|butter|cream|eggs?|tofu|hummus|tortillas)\b/i.test(name)) return 'fridge';
  return 'pantry';
}

// rough shelf life once home, in days (null = keeps for months)
const LIFE = [
  [/\b(spinach|lettuce|arugula|greens|herbs?|cilantro|parsley|basil|dill|mint|berries|strawberr|raspberr|blueberr|mushrooms?)\b/i, 5],
  [/\b(chicken|turkey|ground|sausage|pork|beef|steak|fish|salmon|shrimp|bacon)\b/i, 3],
  [/\b(kale|broccoli|cauliflower|zucchini|bell pepper|peppers?|cucumber|green beans|asparagus|celery|fennel|cabbage|scallions?|green onions?)\b/i, 7],
  [/\b(milk|cream|yogurt|buttermilk|cottage)\b/i, 10],
  [/\b(apples?|pears?|carrots?|lemons?|limes?|oranges?)\b/i, 21],
  [/\b(potato(?:es)?|onions?|garlic|squash|sweet potato(?:es)?)\b/i, 30],
  [/\b(eggs?|butter|cheese|cheddar|parmesan|mozzarella|feta|tortillas)\b/i, 28],
  [/\b(bread|buns|rolls)\b/i, 5],
  [/\b(bananas?|avocados?|tomato(?:es)?)\b/i, 5]
];
export function useByFor(cat = '', name = '', from = new Date()) {
  if (FREEZER.test(cat) || /\bfrozen\b/i.test(name)) return null;
  const hit = LIFE.find(([re]) => re.test(name));
  const days = hit ? hit[1] : /produce/i.test(cat) ? 7 : /meat|seafood/i.test(cat) ? 3 : /dairy/i.test(cat) ? 14 : null;
  if (!days) return null;
  const d = new Date(from); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
export function daysLeft(useBy, now = new Date()) {
  if (!useBy) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const [y, m, d] = String(useBy).slice(0, 10).split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - today) / 864e5);
}

/* ---------------- matching names to your shopping items ---------------- */
const NOISE = new Set(['fresh', 'large', 'small', 'medium', 'boneless', 'skinless', 'organic', 'whole', 'bag', 'bags', 'can', 'cans', 'jar', 'box', 'pack', 'package', 'bunch', 'lb', 'lbs', 'oz', 'pound', 'pounds', 'ounce', 'ounces', 'cup', 'cups', 'tbsp', 'tsp', 'half', 'some', 'of', 'a', 'an', 'the', 'and', 'or', 'about', 'leftover', 'chopped', 'diced', 'sliced', 'shredded', 'grated', 'plain', 'low', 'fat', 'free', 'style', 'mild']);
const sing = (w) => w.replace(/(ies)$/, 'y').replace(/(oes)$/, 'o').replace(/([^s])s$/, '$1');
export function tokens(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\bchx\b/g, 'chicken').split(/[^a-z]+/).filter((w) => w.length > 1 && !NOISE.has(w)).map(sing);
}
/** Best shopping item for a typed name ("2 lb chicken thighs" → Chicken thighs), or null. */
export function matchItem(text, items) {
  const t = tokens(text);
  if (!t.length) return null;
  let best = null, bestScore = 0;
  items.forEach((it) => {
    const w = tokens(it.name);
    if (!w.length) return;
    const hit = w.filter((x) => t.includes(x)).length;
    const head = w.at(-1), headHit = t.includes(head);
    const score = hit / w.length + (headHit ? 0.5 : 0) - Math.max(0, t.length - hit) * 0.05;
    if (hit && headHit && score > bestScore) { best = it; bestScore = score; }
  });
  return bestScore >= 1 ? best : null;
}

/** "2 lb chicken thighs, rice\nhalf a bag of spinach" → rows to add. */
export function parseAdd(text, items) {
  return String(text).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).map((line) => {
    const m = line.match(/^((?:\d+(?:[./]\d+)?|[½¼¾⅓⅔]|half(?: a)?|a|an|one|two|three)\s*(?:[½¼¾⅓⅔])?\s*(?:lbs?|pounds?|oz|ounces?|bags?|cans?|jars?|boxes?|packs?|packages?|bunch(?:es)?|heads?|dozen|cups?|gallons?|bottles?|cartons?|loaf|loaves|blocks?|sticks?)?\.?)\s+(?:of\s+)?(.+)$/i);
    const amount = m ? m[1].trim() : '', name = m ? m[2].trim() : line;
    const it = matchItem(name, items);
    return { name: it ? it.name : name.replace(/^./, (c) => c.toUpperCase()), amount, item_id: it?.id || null, cat: it?.cat || '' };
  });
}

/** Does the pantry cover this shopping item? (Low counts as "need to buy".) */
export function covers(pantry, itemId) {
  return pantry.some((p) => p.item_id === itemId && !['low', 'out'].includes(p.level));
}

/* ---------------- ranking recipes by what you have ---------------- */
/**
 * For each recipe: which of its shopping items you have, which you'd buy, and what it uses up.
 * Weighted by price so having the chicken counts more than having the salt.
 */
export function rankByPantry(recipes, pantry, items, priceOf = () => 0) {
  const have = new Map(pantry.filter((p) => !['low', 'out'].includes(p.level)).map((p) => [p.item_id || 'n:' + tokens(p.name).join(' '), p]));
  const byName = pantry.filter((p) => !['low', 'out'].includes(p.level));
  const now = new Date();
  return recipes.map((r) => {
    const ids = Object.keys(r.items || {});
    const got = [], need = [], useUp = [];
    let wHave = 0, wAll = 0;
    ids.forEach((id) => {
      const it = items.find((i) => i.id === id);
      if (!it) return;
      const w = Math.max(1, priceOf(id) || 2);
      wAll += w;
      const p = have.get(id) || byName.find((x) => !x.item_id && matchItem(x.name, [it]));
      if (p) {
        got.push(it.name); wHave += w;
        const d = daysLeft(p.use_by, now);
        if (d != null && d <= 4) useUp.push(it.name);
      } else need.push(it.name);
    });
    // recipes with no linked items: match ingredient words against the pantry
    if (!ids.length && (r.ing || []).length) {
      (r.ing || []).forEach((line) => {
        if (/:$/.test(String(line).trim())) return;
        const p = byName.find((x) => { const a = tokens(x.name); return a.length && a.every((w) => tokens(line).includes(w)); });
        wAll += 1;
        if (p) { got.push(p.name); wHave += 1; const d = daysLeft(p.use_by, now); if (d != null && d <= 4) useUp.push(p.name); }
      });
    }
    const share = wAll ? wHave / wAll : 0;
    return { r, got, need, useUp, share, score: share + useUp.length * 0.15 - need.length * 0.02 };
  }).filter((x) => x.got.length).sort((a, b) => b.score - a.score);
}

/** After cook day: which pantry rows this week's recipes probably used up (fresh food yes, staples no). */
export function usedByRecipes(recipes, pantry, items) {
  const ids = new Set(recipes.flatMap((r) => Object.keys(r.items || {})));
  const lines = recipes.flatMap((r) => (r.ing || []).map((l) => tokens(l)));
  return pantry.filter((p) => !/\(cooked\)$/i.test(p.name || '')).map((p) => {
    const it = p.item_id ? items.find((i) => i.id === p.item_id) : null;
    // linked to a recipe's shopping item, or (scanned/typed items) every word of its name appears in one ingredient line
    const nameWords = tokens(p.name || it?.name || '');
    const hit = (p.item_id && ids.has(p.item_id)) || (nameWords.length && lines.some((l) => nameWords.every((w) => l.includes(w))));
    if (!hit) return null;
    const staple = /pantry|spice|baking|condiment|oil|dry/i.test(it?.cat || p.cat || '') || p.place === 'pantry' || p.place === 'freezer';
    return { p, usedUp: !staple };
  }).filter(Boolean);
}

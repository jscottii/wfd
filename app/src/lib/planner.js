/**
 * Planner.gs — "I'm ready for a new week":
 *   - lists the newest weekly plans from the bare minimum (barefoodtim.substack.com)
 *   - imports a week's recipes + shopping list into your recipe library
 *   - the Week Plan: which recipe covers which meal, and how many people eat each day
 *
 * Quantities: each recipe makes "servings" portions. The week plan says how many
 * portions you actually need (sum of people over the meals that recipe covers),
 * so a recipe is scaled by portions ÷ servings before the shopping list is built.
 */

var BM_SITE = 'https://barefoodtim.substack.com';
var PLAN_SHEET = 'Week Plan';
var PLAN_HEADERS = ['Day', 'People', 'Breakfast', 'Lunch', 'Dinner', 'Snack'];
var PLAN_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
var PLAN_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];

/* ============================ pure helpers ============================ */

var BM_UNIT_ = { pound: 16, pounds: 16, lb: 16, lbs: 16, ounce: 1, ounces: 1, oz: 1,
  g: 0.03527, gr: 0.03527, gram: 0.03527, grams: 0.03527, kg: 35.27, kilo: 35.27, kilos: 35.27, kilogram: 35.27, kilograms: 35.27,
  ml: 0.0338, milliliter: 0.0338, milliliters: 0.0338, l: 33.8, liter: 33.8, liters: 33.8, litre: 33.8, litres: 33.8 };
var BM_PACK_ = ('quart quarts dozen bunch bunches package packages bag bags can cans jar jars bottle bottles wedge wedges head heads ' +
  'bulb bulbs pint pints gallon gallons small medium large box boxes container containers loaf loaves block blocks tub tubs ' +
  'stick sticks sleeve sleeves carton cartons pack packs clamshell bundle cup cups tbsp tsp slice slices piece pieces ' +
  'clove cloves sprig sprigs pinch handful packet packets tablespoon tablespoons teaspoon teaspoons tblsp tbs').split(' ');
var BM_MOD_ = {};
('fresh large small medium boneless skinless frozen sweet sharp unsalted salted plain whole low moisture shredded grated dried ground ' +
 'crushed smoked red green yellow white black light dark extra virgin baby cold hot mild spicy italian greek old fashioned long ' +
 'grain kosher flaky organic raw cooked toasted chopped diced sliced canned jarred bottled pure thick cut lacinato curly flat leaf').split(' ').forEach(function (w) { BM_MOD_[w] = 1; });
var BM_KEEP_ = { black: 1, green: 1, red: 1, white: 1, yellow: 1, salted: 1, unsalted: 1, greek: 1, italian: 1, smoked: 1, plain: 1, sweet: 1 };
var BM_STOP_ = {};
('the and for with of or a an to in on at any your plus more about each into from cup cups tbsp tsp tablespoon tablespoons teaspoon ' +
 'teaspoons serving servings optional taste pinch divided half rind few some other').split(' ').forEach(function (w) { BM_STOP_[w] = 1; });
BM_PACK_.forEach(function (w) { BM_STOP_[w] = 1; });
Object.keys(BM_UNIT_).forEach(function (w) { BM_STOP_[w] = 1; });

function decodeHtml_(s) {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); })
    .replace(/&#x([0-9a-f]+);/gi, function (m, n) { return String.fromCharCode(parseInt(n, 16)); })
    .replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}

/** Ordered text blocks (headings, paragraphs, list items) from Substack post HTML. */
function htmlBlocks_(html) {
  var out = [], re = /<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi, m;
  while ((m = re.exec(String(html || '')))) {
    var t = decodeHtml_(m[2]);
    if (t) out.push({ tag: m[1].toLowerCase(), text: t });
  }
  return out;
}

function stem_(w) {
  w = String(w).toLowerCase();
  if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
  if (w.length > 4 && /(oes|ches|shes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
  return w;
}
/** Meaningful words (stemmed) in an ingredient / item name. */
function plain_(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function words_(s) {
  return plain_(s).toLowerCase().replace(/’/g, "'").replace(/'s\b/g, '').split(/[^a-z]+/)
    .filter(function (w) { return w.length >= 3 && !BM_STOP_[w]; }).map(stem_);
}
function nouns_(ws) { return ws.filter(function (w) { return !BM_MOD_[w]; }); }

function num_(s) {
  var map = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125 };
  s = String(s).trim();
  var m = s.match(/^(\d+)?\s*([½¼¾⅓⅔⅛])$/); if (m) return (Number(m[1] || 0)) + map[m[2]];
  m = s.match(/^(\d+)\/(\d+)$/); if (m) return Number(m[1]) / Number(m[2]);
  return Number(s);
}

/** "2 cans (15 oz) cannellini beans" → { qty:'2 cans (15 oz)', name:'cannellini beans', units:2, oz:null } */
// "Finely chopped Carrots" → "Carrots", "Pounded to 1cm thickness chicken breast" → "chicken breast"
var PREP_ = /^(?:(?:finely|roughly|thinly|freshly|lightly|coarsely|very)\s+)?(?:chopped|diced|sliced|grated|shredded|beaten|crushed|peeled|cubed|julienned|halved|quartered|torn|melted|softened|cooked|boiled|steamed|toasted|thin cut|thick cut|pounded to [^ ]+ thickness|pounded|trimmed|rinsed|drained|packet(?: of)?|to serve|for frying|garnish|to taste)\s+/i;
function cleanName_(n) { var s = String(n || '').trim(), g = 0; while (PREP_.test(s) && g++ < 4) s = s.replace(PREP_, ''); return s.replace(/^(of|the)\s+/i, '') || String(n || '').trim(); }
function parseShopLine_(line) {
  var s = String(line).trim().replace(/^(about|around|roughly|approx\.?)\s+/i, '').replace(/^half\s+(?=gallon|pound|dozen|cup)/i, '½ ');
  var m = s.match(/^(\d+\s*[½¼¾⅓⅔⅛]|\d*[½¼¾⅓⅔⅛]|\d+\/\d+|\d+\s+\d+\/\d+|\d+(?:\.\d+)?)(?:\s*(?:-|to)\s*\d+(?:\.\d+)?(?=\s))?/);
  if (!m) return { qty: '', name: cleanName_(s.replace(/\s*\([^)]*\)\s*$/, '')), units: 1, oz: null };
  var raw = m[1], n = /\s\d+\/\d+$/.test(raw) ? Number(raw.split(/\s+/)[0]) + num_(raw.split(/\s+/)[1]) : num_(raw);
  var rest = s.slice(m[0].length), qty = m[0].trim(), weight = null, glued = false, pack = false, bare = false, w;
  for (var guard = 0; guard < 6; guard++) {
    if ((w = rest.match(/^-?\s*(ounce|ounces|oz|pound|pounds|lb|lbs)\b\.?\s*/i)) && /^-/.test(rest)) {          // "8-ounce"
      weight = n * BM_UNIT_[w[1].toLowerCase()]; glued = true; qty += '-' + w[1]; rest = rest.slice(w[0].length); continue;
    }
    if ((w = rest.match(/^\s*\(([^)]*)\)\s*/))) {                                                                   // "(15-ounce)"
      var inner = w[1].match(/(\d+(?:\.\d+)?)\s*-?\s*(ounces?|oz|pounds?|lbs?)\b/i);
      if (inner && weight == null) weight = n * Number(inner[1]) * BM_UNIT_[inner[2].toLowerCase()];
      qty += ' (' + w[1] + ')'; rest = rest.slice(w[0].length); continue;
    }
    if ((w = rest.match(/^\s*([A-Za-z]+)\.?(?=\s|$)\s*/)) && (BM_UNIT_[w[1].toLowerCase()] || BM_PACK_.indexOf(w[1].toLowerCase()) >= 0)) {
      var k = w[1].toLowerCase();
      if (BM_UNIT_[k]) { if (weight == null) weight = n * BM_UNIT_[k]; bare = true; }
      if (!BM_UNIT_[k] && !bare && !/^(small|medium|large|cups?|tbsp|tsp|tablespoons?|teaspoons?|tblsp|tbs|quarts?|gallons?|pints?|dozen|slices?|cloves?|sprigs?|pinch|handful)$/.test(k)) pack = true;
      if (k === 'dozen') pack = true;
      qty += ' ' + w[1]; rest = rest.slice(w[0].length); continue;
    }
    break;
  }
  var units = glued ? 1 : pack ? n : weight ? 1 : /quart|gallon|pint|cup|tbsp|tsp|tablespoon|teaspoon|tblsp|tbs|slice|clove|sprig|pinch|handful/i.test(qty) ? 1 : n;
  return {
    qty: qty.trim(), name: cleanName_(rest.replace(/\s*\([^)]*\)\s*$/, '').trim()),
    units: Math.min(12, Math.max(1, Math.ceil(units - 1e-9))),
    oz: weight
  };
}
function ozOf_(qtyText) {
  var m = String(qtyText || '').match(/(\d+(?:\.\d+)?|\d*[½¼¾⅓⅔])\s*(pounds?|lbs?|ounces?|oz)\b/i);
  return m ? num_(m[1]) * BM_UNIT_[m[2].toLowerCase()] : null;
}

/** "4 to 6 servings" → 5, "6 (maybe even 8) bowls" → 6, "12 biscuits" → 12 */
function servingsOf_(yieldText) {
  var t = String(yieldText || ''), r = t.match(/(\d+)\s*(?:to|-|–)\s*(\d+)/);
  if (r) return Math.round((Number(r[1]) + Number(r[2])) / 2);
  var m = t.match(/\d+/); return m ? Number(m[0]) : 0;
}

function simTitle_(a, b) {
  var A = words_(a), B = words_(b); if (!A.length || !B.length) return 0;
  var hit = A.filter(function (w) { return B.indexOf(w) >= 0; }).length;
  return hit / Math.max(A.length, B.length);
}

/**
 * Parse one "A Full Week of Meals + A Shopping List" post.
 * Returns { lineup:[{when,title}], shopping:[{section,line}], pantry:[], recipes:[{title,when,yieldText,servings,freeze,fridge,ing,steps,tip}] }
 */
function parseBareMinimum(html) {
  var b = htmlBlocks_(html), out = { lineup: [], shopping: [], pantry: [], recipes: [] };
  var isHead = function (x) { return /^h[1-6]$/.test(x.tag); };
  for (var i = 0; i < b.length; i++) {
    if (isHead(b[i]) && /lineup/i.test(b[i].text)) {
      for (var j = i + 1; j < b.length && !isHead(b[j]); j++) {
        if (b[j].tag !== 'li') continue;
        var lm = b[j].text.match(/^(.+?)\s*[-–—:]\s+(.+)$/);
        if (lm) out.lineup.push({ when: lm[1].trim(), title: lm[2].trim() });
      }
      break;
    }
  }
  for (i = 0; i < b.length; i++) {
    if (!(isHead(b[i]) && /shopping list/i.test(b[i].text))) continue;
    var section = '', level = b[i].tag;
    for (j = i + 1; j < b.length; j++) {
      var x = b[j];
      if (isHead(x)) {
        if (x.tag <= level || /cost|game plan|cook day|timeline|before you|storage|how it all/i.test(x.text)) break;
        section = x.text; continue;
      }
      if (x.tag !== 'li' || !section) continue;
      if (/pantry/i.test(section)) out.pantry.push(x.text);
      else out.shopping.push({ section: section, line: x.text });
    }
    break;
  }
  for (i = 0; i < b.length; i++) {
    if (!isHead(b[i])) continue;
    var y = -1;
    for (j = i + 1; j < Math.min(b.length, i + 8) && !isHead(b[j]); j++) if (/^yield$/i.test(b[j].text)) { y = j; break; }
    if (y < 0) continue;
    var r = { title: b[i].text, when: '', yieldText: '', servings: 0, freeze: '', fridge: '', ing: [], steps: [], tip: '' };
    if (b[i + 1] && b[i + 1].tag === 'p' && i + 1 < y) r.tip = b[i + 1].text;
    var mode = '';
    for (j = y; j < b.length && !isHead(b[j]); j++) {
      var t = b[j].text, p = b[j].tag === 'p';
      if (p && /^yield$/i.test(t)) { r.yieldText = (b[j + 1] || {}).text || ''; j++; continue; }
      if (p && /^freezer$/i.test(t)) { r.freeze = (b[j + 1] || {}).text || ''; j++; continue; }
      if (p && /^active and total$/i.test(t)) { j++; continue; }
      if (p && /^ingredients$/i.test(t)) { mode = 'ing'; continue; }
      if (p && /^(method|directions|instructions)$/i.test(t)) { mode = 'steps'; continue; }
      if (p && /^storage/i.test(t)) { mode = 'store'; continue; }
      if (mode === 'ing') r.ing.push(p ? t.replace(/:?$/, ':') : t);
      else if (mode === 'steps' && !p) r.steps.push(t);
      else if (mode === 'store' && !p) {
        if (/^store\b/i.test(t)) r.fridge = t.replace(/^store\s*[-–—:]\s*/i, '');
        else r.steps.push(t);
      }
    }
    r.servings = servingsOf_(r.yieldText);
    var best = null;
    out.lineup.forEach(function (l, li) { var s = simTitle_(l.title, r.title); if (s >= 0.5 && (!best || s > best.s)) best = { s: s, when: l.when, li: li }; });
    r.when = best ? best.when : ''; r._li = best ? best.li : -1;
    if (r.ing.length) out.recipes.push(r);
    i = j - 1;
  }
  // recipes whose title didn't match the lineup take the leftover lineup entries in order
  var taken = {}; out.recipes.forEach(function (r) { if (r._li >= 0) taken[r._li] = 1; });
  var spare = out.lineup.map(function (l, li) { return li; }).filter(function (li) { return !taken[li]; });
  out.recipes.forEach(function (r) { if (!r.when) r.when = spare.length ? out.lineup[spare.shift()].when : 'Lunch/Dinner'; delete r._li; });
  return out;
}

/** Category for an imported shopping-list section. */
function catOf_(section) {
  var s = String(section).toLowerCase();
  if (/produce|fruit|veg/.test(s)) return 'Produce';
  if (/meat|seafood|fish|poultry/.test(s)) return 'Meat';
  if (/dairy|egg|cheese/.test(s)) return 'Dairy & Eggs';
  if (/frozen/.test(s)) return 'Frozen';
  if (/bread|bakery/.test(s)) return 'Bakery';
  return 'Pantry';
}

/**
 * Turn a parsed post into recipes + shopping items, reusing items you already have
 * when the names match. Pure: returns what to write.
 * existing: [{id, name, qty, units}]
 */
function buildImport(parsed, existing, idPrefix) {
  var used = {}; existing.forEach(function (e) { used[e.id] = 1; });
  var exWords = existing.map(function (e) { return { e: e, w: words_(String(e.name).split(/,| or |\(/)[0]) }; });
  var items = parsed.shopping.map(function (s) {
    var p = parseShopLine_(s.line);
    var display = p.name.replace(/\s+/g, ' ').trim();
    var parts = display.split(/\s+or\s+|\(|;/i)[0].split(','), core = parts.shift();
    while (parts.length && words_(core).every(function (a) { return BM_MOD_[a]; })) core += ' ' + parts.shift();   // "boneless, skinless chicken thighs"
    core = core.replace(/\s+/g, ' ').trim() || display;
    var w = words_(core), nw0 = nouns_(w);
    var it = { line: s.line, section: s.section, cat: catOf_(s.section), name: core.charAt(0).toUpperCase() + core.slice(1),
               qty: p.qty || '', units: p.units, oz: p.oz, words: w, nouns: nw0, head: nw0.length ? nw0[nw0.length - 1] : w[w.length - 1],
               id: '', isNew: true };
    // reuse an existing item when the words match closely
    var best = null;
    exWords.forEach(function (x) {
      if (!x.w.length || !w.length) return;
      var nx = nouns_(x.w), nw = nouns_(w);
      var nounOk = nx.length && nw.length && nx.every(function (a) { return nw.indexOf(a) >= 0; }) && nw.every(function (a) { return nx.indexOf(a) >= 0; });
      if (!nounOk) return;
      var mx = x.w.filter(function (a) { return BM_MOD_[a]; }), mw = w.filter(function (a) { return BM_MOD_[a]; });
      var modOk = !mx.length || !mw.length || mx.some(function (a) { return mw.indexOf(a) >= 0; });
      var inter = x.w.filter(function (a) { return w.indexOf(a) >= 0; }).length, jac = inter / (x.w.length + w.length - inter);
      if (modOk && (!best || jac > best.j)) best = { j: jac, e: x.e };
    });
    if (best) {
      it.id = best.e.id; it.isNew = false; it.name = best.e.name;
      var exOz = ozOf_(best.e.qty), base = Number(best.e.units) || 1;
      if (base <= 1 && it.oz && exOz) it.units = Math.round(it.oz / exOz * 100) / 100;   // e.g. 4 lb of chicken vs your usual 3 lb pack
    } else {
      var id = slug_(plain_(core)), k = 2, b0 = id;
      while (used[id]) id = b0 + '-' + (k++);
      it.id = id;
      it.q = plain_(core).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
      it.must = w.filter(function (a) { return !BM_MOD_[a] || BM_KEEP_[a]; }).map(function (a) { return a.length > 5 ? a.replace(/y$/, '') : a; }).slice(-3);
      if (!it.must.length && w.length) it.must = [w[w.length - 1]];
    }
    used[it.id] = 1;
    return it;
  });
  // merge two shopping lines that landed on the same item
  var byId = {}, merged = [];
  items.forEach(function (it) { if (byId[it.id]) byId[it.id].units += it.units; else { byId[it.id] = it; merged.push(it); } });
  items = merged;

  // link each recipe ingredient line to the shopping item(s) it uses
  var recipes = parsed.recipes.map(function (r, ri) {
    var rid = (idPrefix ? idPrefix + '-' : '') + slug_(plain_(r.title)).slice(0, 32);
    return { r: r, id: rid, links: {} };
  });
  recipes.forEach(function (R) {
    R.r.ing.forEach(function (line) {
      if (/:$/.test(line)) return;            // sub-heading like "Honey butter:"
      var lw = words_(String(line).replace(/butter lettuce/gi, 'lettuce').replace(/peanut butter/gi, 'peanutbutter').replace(/cream cheese/gi, 'creamcheese'));
      if (!lw.length) return;
      var top = 0, hits = [];
      items.forEach(function (it) {
        if (!it.head || lw.indexOf(it.head) < 0) return;   // the item's main word must be in the line
        var sc = it.words.filter(function (a) { return lw.indexOf(a) >= 0; }).length;
        if (sc > top) { top = sc; hits = [it]; } else if (sc === top) hits.push(it);
      });
      hits.forEach(function (it) { R.links[it.id] = 1; });
    });
  });
  // split each item's units across the recipes that use it (unused items go to all recipes)
  items.forEach(function (it) {
    var users = recipes.filter(function (R) { return R.links[it.id]; });
    if (!users.length) users = recipes;
    users.forEach(function (R) { R.links[it.id] = Math.round(it.units / users.length * 1000) / 1000; });
  });
  return { items: items, recipes: recipes.map(function (R) {
    var r = R.r;
    return { id: R.id, title: r.title, servings: r.servings, yield: r.yieldText, when: r.when, fridge: r.fridge, freeze: r.freeze,
             ing: r.ing, steps: r.steps, tip: r.tip, items: R.links };
  }) };
}

/**
 * How much of each recipe to make, from the week plan.
 * plan.days[i] = { day, people, breakfast, lunch, dinner, snack } (recipe ids or '')
 * Returns { recipeId: { portions, scale } } for recipes on the plan.
 */
function planPortions(plan, recipes) {
  var out = {}, sv = {};
  recipes.forEach(function (r) { sv[r.id] = Number(r.servings) || 0; });
  ((plan && plan.days) || []).forEach(function (d) {
    var ppl = Math.max(0, Number(d.people) || 0);
    PLAN_SLOTS.concat(PLAN_SLOTS.map(function (s) { return s + '_side'; })).forEach(function (s) {
      var id = d[s]; if (!id) return;
      (out[id] = out[id] || { portions: 0, scale: 1 }).portions += ppl;
    });
  });
  Object.keys(out).forEach(function (id) {
    out[id].scale = sv[id] ? Math.round(out[id].portions / sv[id] * 100) / 100 : 1;
  });
  return out;
}

/** Store units to buy: recipes on the week plan are scaled by people; other active recipes count as one batch. */
function neededUnits(recipes, plan) {
  var por = planPortions(plan, recipes), onPlan = Object.keys(por).length > 0, need = {};
  recipes.forEach(function (r) {
    var k;
    if (onPlan && por[r.id]) k = por[r.id].scale;   // on the week plan: scaled to the people eating it
    else if (r.active) k = 1;                       // switched on but not placed on a day: one batch
    else return;
    // more than 12 packages of one thing per batch is an amount read wrong (grams); count it as one
    Object.keys(r.items || {}).forEach(function (id) { var u = Number(r.items[id] || 0); need[id] = (need[id] || 0) + (u > 12 ? 1 : u) * k; });
  });
  // round to whole packages, but don't buy a second one for a small overshoot (1.2 bottles of ranch → 1)
  Object.keys(need).forEach(function (id) { var x = need[id]; need[id] = x <= 0 ? 0 : Math.max(1, Math.ceil(x - 0.25)); if (!need[id]) delete need[id]; });
  return need;
}

/** Spread recipes over Monday–Friday (like the meal plans): breakfasts, snacks, then mains across dinners and lunches. */
function autoFillPlan(recipes, household, days) {
  household = Math.max(1, Number(household) || 1);
  var all = (days || PLAN_DAYS).map(function (d) { return { day: d, people: household, breakfast: '', lunch: '', dinner: '', snack: '' }; });
  var grid = all.filter(function (d) { return !/^(saturday|sunday)$/i.test(d.day); });
  var kind = function (r) {
    var w = String(r.when || '').toLowerCase();
    if (/breakfast/.test(w)) return 'breakfast';
    if (/snack|dessert|treat/.test(w)) return 'snack';
    if (/side/.test(w)) return 'side';
    return 'main';
  };
  var groups = { breakfast: [], snack: [], main: [], side: [] };
  recipes.forEach(function (r) { (groups[kind(r)] || groups.main).push(r); });
  ['breakfast', 'snack'].forEach(function (slot) {
    var g = groups[slot]; if (!g.length) return;
    grid.forEach(function (d, i) { d[slot] = g[i % g.length].id; });
  });
  // each main covers about servings ÷ household meals
  var queue = [];
  groups.main.forEach(function (r) { var n = Math.max(1, Math.round((Number(r.servings) || household) / household)); queue.push({ id: r.id, left: n }); });
  var slots = [];
  grid.forEach(function (d) { slots.push([d, 'dinner']); });
  grid.forEach(function (d) { slots.push([d, 'lunch']); });
  var qi = 0;
  slots.forEach(function (s) {
    var tries = 0;
    while (queue.length && tries < queue.length) {
      var q = queue[qi % queue.length];
      if (q.left > 0) { s[0][s[1]] = q.id; q.left--; qi++; return; }
      qi++; tries++;
    }
  });
  return { household: household, days: all };
}


/** Re-price each store's entry for the quantity the active recipes need (prices are stored for the item's usual quantity). */
function scalePrices(prices, items, need, stores, costcoMode) {
  var bulk = {}; stores.forEach(function (s) { bulk[s.id] = !!s.bulk; });
  var out = {};
  items.forEach(function (it) {
    var base = Number(it.units) || 1, n = need[it.id] || 0, k = n / base;
    var row = prices[it.id] || {};
    out[it.id] = {};
    Object.keys(row).forEach(function (sid) {
      var e = row[sid], c = {};
      Object.keys(e).forEach(function (key) { c[key] = e[key]; });
      if (e.price != null && !(bulk[sid] && costcoMode !== 'unit')) c.price = Math.round(e.price * k * 100) / 100;
      if (e.unitNeeded != null) c.unitNeeded = Math.round(e.unitNeeded * k * 100) / 100;
      out[it.id][sid] = c;
    });
  });
  return out;
}

function slug_(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item'; }

/**
 * The cook-day guide from a post: "Before You Start" and "Order of Operations"
 * (clock-time timeline, where it all goes, what to freeze, swaps, leftovers).
 * Returns { sections: [{ title, kind: 'timeline'|'list', items: [{ time, label, text }] }] }
 */
function parsePrepGuide(html) {
  var b = htmlBlocks_(html), sections = [], cur = null, inside = false, level = 'h9';
  var isHead = function (x) { return /^h[1-6]$/.test(x.tag); };
  for (var i = 0; i < b.length; i++) {
    var x = b[i];
    if (isHead(x)) {
      if (/before you start|order of operations|game plan|cook day/i.test(x.text)) { inside = true; level = x.tag; cur = null; continue; }
      if (inside && (x.tag <= level || /shopping list|lineup|other recipes|discussion|ready for more/i.test(x.text))) { inside = false; cur = null; continue; }
      if (inside) { cur = { title: x.text, kind: /timeline|schedule/i.test(x.text) ? 'timeline' : 'list', items: [] }; sections.push(cur); }
      continue;
    }
    if (!inside || (x.tag !== 'li' && x.tag !== 'p')) continue;
    if (!cur) { cur = { title: 'Before you start', kind: 'list', items: [] }; sections.push(cur); }
    var t = x.text.replace(/\s+/g, ' ').trim(), it = { time: '', label: '', text: t };
    var tm = t.match(/^(\d{1,2}:\d{2}\s*(?:[ap]\.?m\.?)?)\s*[-–—:]\s*(.+)$/i);
    if (tm) { it.time = tm[1].trim(); it.text = tm[2]; if (cur.kind !== 'timeline' && x.tag === 'li') cur.kind = 'timeline'; }
    else { var lm = t.match(/^([^.!?]{2,48}?)\s+[-–—]\s+(.+)$/); if (lm && x.tag === 'li') { it.label = lm[1]; it.text = lm[2]; } }
    cur.items.push(it);
  }
  return { sections: sections.filter(function (s) { return s.items.length; }) };
}

export { parsePrepGuide, parseBareMinimum, buildImport, neededUnits, planPortions, autoFillPlan, scalePrices, slug_, words_, PLAN_DAYS, PLAN_SLOTS };

// Cook day: scaled measurements, knife prep (how to cut what), seasonings, and a step-by-step order.

const FR = [[0, ''], [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '']];
const UNI = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
const NUM = '(?:\\d+\\s*[½¼¾⅓⅔⅛⅜⅝⅞]|\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.\\d+|\\d+|[½¼¾⅓⅔⅛⅜⅝⅞])';
const UNITS = 'cups?|c\\.|tablespoons?|tbsps?|tbs|teaspoons?|tsps?|pounds?|lbs?|ounces?|oz|grams?|g|kg|ml|liters?|quarts?|qts?|pints?|cans?|jars?|cloves?|sticks?|slices?|stalks?|sprigs?|bunch(?:es)?|heads?|bulbs?|pinch(?:es)?|dash(?:es)?|handfuls?|large|medium|small|packages?|bags?|blocks?|links?';

export function parseNum(s) {
  s = String(s).trim();
  let m = s.match(/^(\d+)\s*([½¼¾⅓⅔⅛⅜⅝⅞])$/); if (m) return +m[1] + UNI[m[2]];
  m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3];
  m = s.match(/^(\d+)\/(\d+)$/); if (m) return m[1] / m[2];
  if (UNI[s] != null) return UNI[s];
  return Number(s);
}

/** 1.5 → "1½", 0.33 → "⅓", 2.4 → "2½" (kitchen-friendly rounding). */
export function fmtNum(x) {
  if (!isFinite(x)) return '';
  if (x >= 10) return String(Math.round(x));
  let whole = Math.floor(x), f = x - whole, best = FR[0];
  FR.forEach((p) => { if (Math.abs(p[0] - f) < Math.abs(best[0] - f)) best = p; });
  if (best[0] === 1) { whole += 1; best = FR[0]; }
  return (whole ? String(whole) : '') + best[1] || '0';
}

/** Tidy up big spoon amounts: 3 tsp → 1 tbsp, 4 tbsp → ¼ cup. */
function tidy(x, unit) {
  const u = unit.toLowerCase();
  if (/^(tbsp|tablespoon|tbs)/.test(u) && x < 1) return [x * 3, 'tsp'];
  if (/^cups?$/.test(u) && x < 0.25) return [x * 16, 'tbsp'];
  if (/^(tsp|teaspoon)/.test(u) && x >= 3 && Math.abs(x / 3 * 4 - Math.round(x / 3 * 4)) < 0.01) return [x / 3, 'tbsp'];
  if (/^(tbsp|tablespoon|tbs)/.test(u) && x >= 4 && Math.abs(x / 16 * 12 - Math.round(x / 16 * 12)) < 0.01) return [x / 16, x / 16 > 1 ? 'cups' : 'cup'];
  return [x, unit];
}

const SING = /^(cup|can|clove|stalk|bulb|head|slice|stick|sprig|jar|package|bag|block|link|lime|lemon|orange|carrot|onion|egg|jalapeño|jalapeno|potato|tomato|zucchini|apple|pear|bunch|pinch|dash|handful|shallot|avocado|pepper|leek|pound)$/i;
function plural(w, x) {
  if (!(x > 1)) { const one = w.replace(/(ch|sh)es$/i, '$1').replace(/(potato|tomato)es$/i, '$1').replace(/s$/i, ''); return one !== w && SING.test(one) ? one : w; }
  if (!SING.test(w)) return w;
  if (/(ch|sh|sh)$/i.test(w)) return w + 'es';
  if (/(o)$/i.test(w) && /potato|tomato/i.test(w)) return w + 'es';
  if (/zucchini/i.test(w)) return w;
  return w + 's';
}
/** "2 lime" → "2 limes" for the first word after an amount. */
function fixNext(rest, x) { return rest.replace(/^(\s+(?:more\s+|large\s+|medium\s+|small\s+)?)([A-Za-zñ]+)/, (a, sp, w) => sp + plural(w, x)); }
function scaleOne(numStr, unit, k) {
  let x = parseNum(numStr) * k;
  let u = unit || '';
  if (u) [x, u] = tidy(x, u);
  return fmtNum(x) + (u ? ' ' + plural(u, x) : '');
}

function scaleInline(text, k) {
  const re = new RegExp(`(^|[^\\d/.])(${NUM})\\s+(cups?|tablespoons?|tbsps?|teaspoons?|tsps?|pounds?|lbs?|ounces?|oz|cloves?)\\b`, 'gi');
  return text.replace(re, (all, pre, n, u) => pre + scaleOne(n, u, k));
}
function scaleParens(rest, k) {
  return rest.replace(/\(([^)]*)\)/g, (all, inner) => /\b(?:oz|ounces?|lb|g|ml|inch|in\.)\b|-inch/i.test(inner) ? all
    : '(' + inner.replace(new RegExp(`(^|[\\s,])(${NUM})(?=\\s)`, 'g'), (a, pre, n) => pre + fmtNum(parseNum(n) * k)) + ')');
}

/**
 * Scale the amount at the start of an ingredient line ("1½ cups flour", "¾ to 1 cup milk",
 * "Zest and juice of 2 limes", "Pinch of salt"). Lines with no amount are returned unchanged.
 */
export function scaleLine(line, k) {
  line = String(line);
  if (!k || k === 1 || /:$/.test(line.trim())) return line;
  const range = new RegExp(`^(${NUM})\\s*(?:to|-|–)\\s*(${NUM})\\s+(${UNITS})\\b`, 'i');
  let m = line.match(range);
  if (m) return `${fmtNum(parseNum(m[1]) * k)} to ${scaleOne(m[2], m[3], k)}` + line.slice(m[0].length);
  m = line.match(new RegExp(`^(${NUM})(\\s+(?:${UNITS})\\b)?`, 'i'));
  if (m) {
    const unit = (m[2] || '').trim(), x = parseNum(m[1]) * k;
    let rest = scaleParens(line.slice(m[0].length), k);
    if (/\s—\s|\+/.test(rest)) rest = scaleInline(rest, k);
    return scaleOne(m[1], unit, k) + (unit ? rest : fixNext(rest, x));
  }
  m = line.match(new RegExp(`^((?:zest|juice|zest and juice) of\\s+)(${NUM})\\b`, 'i'));
  if (m) { const x = parseNum(m[2]) * k; return m[1] + fmtNum(x) + fixNext(line.slice(m[0].length), x); }
  m = line.match(/^(a\s+)?pinch\b/i);
  if (m && k >= 1.5) return `${Math.round(k)} pinches` + line.slice(m[0].length);
  return line;
}

/** Scale amounts written inside a step ("stir in ½ cup parmesan"). Returns HTML with scaled amounts in bold. */
export function scaleStepHtml(text, k) {
  const esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (!k || k === 1) return esc;
  const re = new RegExp(`(^|[^\\d/.])(${NUM})\\s+(cups?|tablespoons?|tbsps?|teaspoons?|tsps?|pounds?|lbs?|ounces?|oz|cloves?)\\b`, 'gi');
  return esc.replace(re, (all, pre, n, u) => `${pre}<b>${scaleOne(n, u, k)}</b>`);
}

/* ---------------- knife prep ---------------- */
const CUTS = [
  { re: /\bfinely (?:diced|chopped)\b/i, key: 'fine', name: 'Fine dice', how: 'About ¼-inch pieces. Cut into thin planks, then thin sticks, then across into tiny cubes.' },
  { re: /\bminced\b/i, key: 'mince', name: 'Mince', how: 'As small as you can get it. Smash garlic with the flat of the knife first, then rock the blade back and forth over the pile.' },
  { re: /\bdiced\b/i, key: 'dice', name: 'Dice', how: 'About ½-inch cubes. Cut into ½-inch planks, then ½-inch sticks, then across. Even pieces cook evenly.' },
  { re: /\bcut into ([^,;(]+?(?:pieces|cubes|chunks|strips|wedges|rounds|florets))/i, key: 'cutinto', name: 'Cut to size', how: 'Cut to the size listed so everything cooks in the same time.' },
  { re: /\b(?:cubed|cut into cubes)\b/i, key: 'cube', name: 'Cube', how: 'About ½-inch cubes. For butter: cut it straight from the fridge and put it back in the fridge until you need it.' },
  { re: /\b(?:ribboned|chiffonade|cut into ribbons)\b/i, key: 'ribbon', name: 'Ribbons', how: 'Strip the leaves off the stems, stack them, roll up tight like a cigar and slice thin across the roll.' },
  { re: /\b(?:julienned|matchsticks?)\b/i, key: 'julienne', name: 'Matchsticks', how: 'Slice into ⅛-inch planks, stack a few, then cut into ⅛-inch sticks.' },
  { re: /\bthinly sliced\b/i, key: 'thin', name: 'Slice thin', how: 'About ⅛ inch, nearly see-through. Keep your fingertips curled under on the hand holding the food.' },
  { re: /\bsliced\b/i, key: 'slice', name: 'Slice', how: 'About ¼-inch slices.' },
  { re: /\b(?:roughly )?chopped\b/i, key: 'chop', name: 'Chop', how: 'Rough ½-inch pieces; they don’t need to be even. For fresh herbs: pick the leaves, bunch them up, and chop through a few times.' },
  { re: /\bstems? removed\b/i, key: 'stem', name: 'Stem', how: 'Hold the stem and pull the leaves off with your other hand, then chop the leaves.' },
  { re: /\b(?:halved|quartered|cut in half)\b/i, key: 'halve', name: 'Halve / quarter', how: 'Cut in half (or quarters) through the middle.' },
  { re: /\b(?:grated|shredded)\b/i, key: 'grate', name: 'Grate', how: 'Large holes of a box grater (skip it if you bought it already shredded). Parmesan and ginger: fine holes or a microplane.' },
  { re: /\bzest\b/i, key: 'zest', name: 'Zest, then juice', how: 'Zest first: rub the fruit over a microplane, only the colored skin. Then roll it on the counter, cut in half and squeeze over your hand to catch seeds.' },
  { re: /\bjuice(?:d)? of\b/i, key: 'juice', name: 'Juice', how: 'Roll it on the counter, cut in half and squeeze over your hand to catch the seeds.' },
  { re: /\bpeeled\b/i, key: 'peel', name: 'Peel', how: 'Peel with a vegetable peeler before cutting.' }
];
const SETUP = [
  { re: /\bsoftened\b/i, what: 'Take out to soften (about 1 hour before)' },
  { re: /\b(?:at )?room temperature\b/i, what: 'Take out to come to room temperature' },
  { re: /\bthawed\b/i, what: 'Thaw ahead (overnight in the fridge)' },
  { re: /\b(?:cans?|beans?|chickpeas?|lentils?)\b.*\b(?:drained|rinsed)\b|\bdrained\b/i, what: 'Open cans, drain and rinse in a colander' },
  { re: /\b(?:rice|quinoa|farro|barley|grains?)\b.*\brinsed\b/i, what: 'Rinse in a sieve until the water runs mostly clear' }
];

/** Strip the prep words off a line, leaving the amount + ingredient ("3 celery stalks"). */
function amountPart(line) {
  return String(line).replace(/,?\s*(?:then|plus)\b.*$/i, '').replace(/\s*\((?!\d)[^)]*\)/g, '').split(',')[0].replace(/\b(?:finely|thinly|roughly)\s+(?:diced|chopped|sliced)\s+/i, '').replace(/\b(?:chopped|diced|minced|sliced|grated|shredded)\s+(?=fresh|\w)/i, '').trim();
}

const SPICE = /\b(salt|pepper(?:corns)?|cumin|paprika|chili powder|chile powder|cayenne|oregano|thyme|basil|rosemary|sage|dill|tarragon|marjoram|cinnamon|nutmeg|allspice|cloves|ginger|turmeric|curry|coriander|cardamom|garam masala|five[- ]spice|italian seasoning|herbes|za'?atar|sumac|red pepper flakes|chili flakes|bay leaf|bay leaves|fennel seeds?|mustard seeds?|dry mustard|mustard powder|garlic powder|onion powder|vanilla|baking powder|baking soda|seasoning|spice|everything bagel|old bay|cajun|taco|ranch seasoning|msg|bouillon)\b/i;
const NOT_SPICE = /\b(fresh|chopped|leaves|sprig|bunch|bell pepper|peppers\b|jalape|red pepper\b(?! flakes)|sweet pepper|ginger root|grated ginger|frank|hot sauce|sauce)\b/i;


/* ---------------- produce the recipe doesn't say how to cut ---------------- */
// prep: what to do before cutting · cut: knife group · by method: roast / mash / soup / raw / saute
const PRODUCE = [
  { k: 'butternut', re: /\bbutternut(?: squash)?\b|\bsquash\b/i, name: 'Butternut squash', prep: 'Cut off both ends, peel with a Y-peeler, halve lengthwise and scoop out the seeds.', cut: 'cube', size: '1-inch cubes', soup: '½-inch cubes' },
  { k: 'sweetpotato', re: /\bsweet potato(?:es)?\b|\byams?\b/i, name: 'Sweet potatoes', prep: 'Scrub (peel if you like).', cut: 'cube', size: '1-inch cubes', mash: '2-inch chunks' },
  { k: 'potato', re: /\b(?:yukon(?: gold)?s?|russets?|red potato(?:es)?|potato(?:es)?)\b/i, name: 'Potatoes', prep: 'Scrub; peel for mash. Keep cut pieces in cold water so they don’t brown.', cut: 'cutinto', size: '1-inch chunks', mash: '2-inch chunks (same size so they cook evenly)', roast: '1-inch chunks' },
  { k: 'onion', re: /\b(?:yellow |red |white )?onions?\b(?! powder)/i, name: 'Onion', prep: 'Halve through the root, peel, and leave the root on to hold it together.', cut: 'dice', raw: 'thin slices', roast: 'wedges' },
  { k: 'shallot', re: /\bshallots?\b/i, name: 'Shallot', prep: 'Peel.', cut: 'mince' },
  { k: 'garlic', re: /\bgarlic\b(?! powder)/i, name: 'Garlic', prep: 'Smash each clove with the flat of the knife; the skin slips off.', cut: 'mince' },
  { k: 'ginger', re: /\bginger\b(?! powder|, ground)/i, name: 'Ginger', prep: 'Peel with the edge of a spoon.', cut: 'grate' },
  { k: 'carrot', re: /\bcarrots?\b/i, name: 'Carrots', prep: 'Peel and trim the ends.', cut: 'dice', roast: '½-inch coins', raw: 'grated' },
  { k: 'celery', re: /\bcelery\b/i, name: 'Celery', prep: 'Trim the ends; rinse.', cut: 'dice' },
  { k: 'bellpepper', re: /\b(?:bell|sweet|red|green|yellow|orange) peppers?\b(?! flakes)|\bpoblanos?\b/i, name: 'Bell peppers', prep: 'Cut off the top, pull out the core and seeds.', cut: 'slice', soup: 'diced', saute: 'strips' },
  { k: 'jalapeno', re: /\bjalape[nñ]os?\b/i, name: 'Jalapeños', prep: 'Halve and scrape out seeds and ribs for less heat; wash hands after.', cut: 'mince', raw: 'thin rounds' },
  { k: 'zucchini', re: /\bzucchini\b/i, name: 'Zucchini', prep: 'Trim the ends.', cut: 'dice', roast: 'half-moons' },
  { k: 'kale', re: /\bkale\b/i, name: 'Kale', prep: 'Pull the leaves off the stems; wash and dry.', cut: 'chop', raw: 'thin ribbons' },
  { k: 'cabbage', re: /\b(?:green |red |purple |napa )?cabbage\b/i, name: 'Cabbage', prep: 'Quarter through the core and cut the core out. (Skip if you bought coleslaw mix.)', cut: 'thin' },
  { k: 'broccoli', re: /\bbroccoli\b/i, name: 'Broccoli', prep: 'Cut off the thick stem.', cut: 'cutinto', size: 'bite-size florets' },
  { k: 'cauliflower', re: /\bcauliflower\b/i, name: 'Cauliflower', prep: 'Pull off the leaves and cut out the core.', cut: 'cutinto', size: 'bite-size florets' },
  { k: 'fennel', re: /\bfennel(?: bulbs?)?\b(?! seeds?)/i, name: 'Fennel', prep: 'Cut off the stalks (save a few fronds), halve and cut out the core.', cut: 'slice' },
  { k: 'apple', re: /\bapples?\b(?! cider|sauce)/i, name: 'Apples', prep: 'Quarter and cut out the core (peeling is optional).', cut: 'slice', raw: 'matchsticks', soup: 'diced' },
  { k: 'pear', re: /\bpears?\b/i, name: 'Pears', prep: 'Quarter and cut out the core.', cut: 'dice' },
  { k: 'mushroom', re: /\bmushrooms?\b/i, name: 'Mushrooms', prep: 'Wipe clean with a damp towel; trim the stems.', cut: 'slice' },
  { k: 'tomato', re: /\b(?:roma |cherry |grape )?tomato(?:es)?\b(?! paste| sauce|, crushed)/i, name: 'Tomatoes', prep: 'Core with a paring knife (cherry tomatoes: just halve).', cut: 'dice' },
  { k: 'cucumber', re: /\bcucumbers?\b/i, name: 'Cucumber', prep: 'Trim the ends; peel in stripes if the skin is thick.', cut: 'dice' },
  { k: 'greenonion', re: /\b(?:green onions?|scallions?)\b/i, name: 'Green onions', prep: 'Trim the roots.', cut: 'thin' },
  { k: 'leek', re: /\bleeks?\b/i, name: 'Leeks', prep: 'Use the white and light green parts; halve lengthwise and rinse out the grit.', cut: 'thin' },
  { k: 'brussels', re: /\bbrussels sprouts?\b/i, name: 'Brussels sprouts', prep: 'Trim the stem ends and pull off loose leaves.', cut: 'halve' },
  { k: 'greenbeans', re: /\bgreen beans?\b/i, name: 'Green beans', prep: 'Snap or trim the stem ends.', cut: 'cutinto', size: '1-inch pieces' },
  { k: 'asparagus', re: /\basparagus\b/i, name: 'Asparagus', prep: 'Snap off the woody ends.', cut: 'cutinto', size: '2-inch pieces' },
  { k: 'eggplant', re: /\beggplants?\b/i, name: 'Eggplant', prep: 'Trim the ends.', cut: 'cube', size: '1-inch cubes' },
  { k: 'herbs', re: /\b(?:parsley|cilantro|dill|basil|mint|chives)\b/i, name: 'Fresh herbs', prep: 'Rinse and spin or pat dry; pick the leaves (tender stems are fine).', cut: 'chop' }
];
const METHOD = [['mash', /\bmash/i], ['roast', /\broast|\boven|\bbake|\bsheet pan/i], ['soup', /\bsoup|\bsimmer|\bboil|\bbraise|\bstew|\bsauce\b/i], ['raw', /\bslaw|\bsalad|\btoss|\braw\b|\bgarnish|\bmassage/i], ['saute', /\bsaut|\bfry|\bbrown|\bstir|\bcook/i]];
const STEP_CUTS = [['cube', /\bcub(?:ed|e)\b/i], ['mince', /\bminc(?:ed|e)\b/i], ['fine', /\bfinely (?:dice|diced|chop|chopped)\b/i], ['dice', /\bdic(?:ed|e)\b/i], ['thin', /\bthinly slic|\bshred(?:ded)?\b(?! chicken)/i], ['slice', /\bslic(?:ed|e)\b/i], ['chop', /\bchop(?:ped)?\b/i], ['grate', /\bgrat(?:ed|e)\b/i], ['julienne', /\bjulienn|\bmatchstick/i], ['ribbon', /\bribbon/i], ['halve', /\bhalv(?:ed|e)\b|\bquarter(?:ed)?\b/i], ['cutinto', /\b(?:cut )?into ([^,;.]*?(?:pieces|cubes|chunks|wedges|florets|strips|coins|rounds))/i]];
const NO_KNIFE = /\bfor serving\b|\btorn\b|\bgarnish\b|\bcans?\b|\bcrushed\b|\bfrozen\b|\bcoleslaw mix\b|\bbaby spinach\b|\bpre-?cut\b|\bbagged\b|\bjarred\b|\bcanned\b|\bpaste\b|\bjuice\b(?! of)|\bdried\b/i;

function sentencesWith(texts, re) { return texts.flatMap((t) => String(t).split(/(?<=[.;])\s+/)).filter((x) => re.test(x)); }

/** Produce a recipe uses but never says how to cut: read the steps, else use the usual prep. */
function inferProduce(r, kk, items, taken) {
  const out = [];
  const lines = (r.ing || []).map(String), linked = Object.keys(r.items || {}).map((id) => items.find((i) => i.id === id)).filter((i) => i && /produce/i.test(i.cat || ''));
  PRODUCE.forEach((p) => {
    if (taken.has(p.k)) return;
    const ingHits = lines.filter((l) => p.re.test(l) && !NO_KNIFE.test(l));
    const item = linked.find((i) => p.re.test(i.name));
    if (!ingHits.length && !item) return;
    if (item && !ingHits.length && NO_KNIFE.test(item.name)) return;
    if (p.k === 'herbs' && (!ingHits.length || ingHits.every((l) => /\bsprigs?\b|\bleaves?\b,? whole/i.test(l)))) return;
    const ctx = sentencesWith(r.steps || [], p.re);
    const words = [...ctx, ...ingHits].join(' ');
    let cut = '', size = '', from = 'usual';
    for (const [key, re] of STEP_CUTS) {
      const near = ctx.map((sn) => { const m = sn.match(new RegExp(`.{0,40}(?:${p.re.source}).{0,50}`, 'i')); return m ? m[0] : ''; }).join(' ');
      const m = near.match(re);
      if (m) { cut = key; size = key === 'cutinto' ? m[1].trim() : ''; from = 'steps'; break; }
    }
    const method = (METHOD.find(([, re]) => re.test(words)) || [''])[0];
    if (!cut) { cut = p.cut; size = (method && p[method]) || p.size || ''; }
    else if (!size && /cube|cutinto/.test(cut)) size = (method && p[method]) || p.size || '';
    const amt = ingHits.find((l) => /^\s*[\d½¼¾⅓⅔⅛]/.test(l));
    const derived = ingHits.length && ingHits.every((l) => /\b(?:half|rest|remaining|the roasted|the cooked|reserved)\b/i.test(l));
    out.push({ k: p.k, cut, size, from, name: p.name, prep: p.prep, derived,
      text: amt ? amountPart(scaleLine(amt, kk)) : item && item.qty ? `${item.qty} ${p.name.toLowerCase()}` : p.name });
  });
  return out;
}

/**
 * recipes: [{ id, title, ing:[], steps:[] }], k: { id: batches }
 * Returns { knife: [{ key, name, how, items:[{ text, cut, recipe }] }], spices: [{ recipe, items:[text] }], setup: [{ what, items:[{text, recipe}] }] }
 */
export function prepLists(recipes, k, items = []) {
  const knife = {}, setup = {}, spices = [], inferred = {};
  recipes.forEach((r) => {
    const kk = k[r.id] || 1, sp = [], taken = new Set();
    (r.ing || []).forEach((raw) => {
      const line = String(raw).trim();
      if (!line || /:$/.test(line) || /\bfor serving\b/i.test(line) && !/\b(?:diced|chopped|sliced|minced)\b/i.test(line)) return;
      const scaled = scaleLine(line, kk);
      const lab = line.match(/^([A-Za-z0-9 ]{2,24}):\s/);
      const combined = /\+|\s—\s|\sor\s\d/.test(line) || (lab && !/rub|spice|season/i.test(lab[1]));
      if (!combined && SPICE.test(line) && !NOT_SPICE.test(line)) { sp.push(scaled); return; }
      const cooked = /\b(chicken|pork|beef|turkey|brisket|lamb)\b/i.test(line) && /\bshredded\b/i.test(line);
      const c = cooked ? null : CUTS.find((x) => x.re.test(line));
      if (c) PRODUCE.forEach((p) => { if (p.re.test(line)) taken.add(p.k); });
      if (c) {
        const extra = c.key === 'cutinto' ? line.match(c.re)[1] : '';
        let txt = c.key === 'zest' || c.key === 'juice' ? scaled : amountPart(scaled);
        if (/^[A-Za-z0-9 ]{2,24}:\s/.test(line)) { const seg = scaled.replace(/^[^:]*:\s*/, '').split(',').find((x) => c.re.test(x)); if (seg) txt = seg.trim(); }
        (knife[c.key] = knife[c.key] || { key: c.key, name: c.name, how: c.how, items: [] }).items.push({ text: txt, cut: extra, recipe: r.title });
      }
      const s = SETUP.find((x) => x.re.test(line));
      if (s) (setup[s.what] = setup[s.what] || { what: s.what, items: [] }).items.push({ text: amountPart(scaled), recipe: r.title });
    });
    if (sp.length) spices.push({ recipe: r.title, id: r.id, items: sp });
    // produce whose cut isn't on the ingredient line; one entry per vegetable across recipes
    inferProduce(r, kk, items, taken).forEach((x) => {
      const e = inferred[x.k];
      if (!e) { inferred[x.k] = { ...x, recipes: [r.title] }; return; }
      e.recipes.push(r.title);
      if (e.derived && !x.derived) Object.assign(e, { ...x, recipes: e.recipes });   // keep the recipe that does the cutting
      else if (e.from !== 'steps' && x.from === 'steps') Object.assign(e, { cut: x.cut, size: x.size, from: 'steps' });
    });
  });
  Object.values(inferred).forEach((x) => {
    const c = CUTS.find((y) => y.key === x.cut) || CUTS.find((y) => y.key === 'chop');
    (knife[c.key] = knife[c.key] || { key: c.key, name: c.name, how: c.how, items: [] }).items.push({ text: x.text, cut: x.size, recipe: x.recipes.join(' + '), note: x.prep, from: x.from });
  });
  const order = CUTS.map((c) => c.key);
  return { knife: Object.values(knife).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)), spices, setup: Object.values(setup) };
}

/* ---------------- step-by-step order ---------------- */
/** Minutes a recipe spends cooking (hands-off time), from "1 hr 15 min", "25 minutes" in its steps. */
export function cookMinutes(r) {
  let t = 0;
  (r.steps || []).forEach((s) => {
    const str = String(s);
    const h = str.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\b/i), m = str.match(/(\d+)\s*(?:min|minutes)\b/i);
    t += (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  });
  return t;
}

const STOP = new Set(['with', 'and', 'the', 'bowl', 'bowls', 'bake', 'baked', 'jars', 'bars', 'salad', 'easy', 'one', 'pan', 'sheet', 'loaded', 'style', 'honey', 'butter', 'cheese', 'cheesy', 'creamy', 'spiced', 'fresh', 'quick', 'chicken']);
const keyWords = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter((w) => w.length >= 4 && !STOP.has(w));
/** Which of the week's recipes a game-plan step is about. */
export function recipesInStep(text, recipes) {
  if (/^\s*(?:chop|cut|prep|dice|slice|wash|set up|get out|preheat)\b|\b(?:chop|cut|prep) everything\b/i.test(text)) return [];
  const t = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return recipes.filter((r) => keyWords(r.title).some((w) => new RegExp(`\\b${w.replace(/s$/, '')}`).test(t)));
}

/* ---------------- timers ---------------- */
const COOKING = /\b(bake|baking|roast|simmer|boil|braise|cook|rest|chill|marinate|toast|broil|steam|reduce|sear|fry|saut|crisp|brown|blanch|poach|grill|set|rise|proof|soak|cool|steep|sit|stand|leave|infuse|brine|ferment|refrigerat|freez|slow cook|pressure cook)/i;
/** "Bake covered 400°F 15 min" → { mins: 15, maxMins: 15 }; "1 hr 15 min" → 75; "25–30 min" → 25..30. Only for cooking steps. */
export function durationOf(text) {
  const t = String(text);
  if (!COOKING.test(t)) return null;
  const re = /(?:(\d+(?:\.\d+)?)\s*(?:–|-|to)\s*)?(\d+(?:\.\d+)?)\s*(hrs?|hours?|min(?:ute)?s?)\b(?:\s*(\d+)\s*min(?:ute)?s?\b)?/i;
  const m = t.match(re);
  if (!m || /\bmin(?:ute)?s?\s+(?:short|less|before|early)\b|\bfrom frozen\b|\breheat|^\s*night \d|\bto serve\b/i.test(t)) return null;
  const hrs = /^h/i.test(m[3]);
  let hi = Number(m[2]) * (hrs ? 60 : 1) + (m[4] ? Number(m[4]) : 0);
  let lo = m[1] ? Number(m[1]) * (hrs ? 60 : 1) + (m[4] ? Number(m[4]) : 0) : hi;
  if (!(hi > 0) || hi > 12 * 60) return null;
  return { mins: lo, maxMins: hi };
}

/* Hands-off steps: the food cooks, steeps or sits while you leave it alone. Only these get a timer. */
const HANDS_OFF = /\b(bak(?:e|es|ed|ing)|roast(?:s|ed|ing)?|simmer(?:s|ed|ing)?|braise[sd]?|braising|boil(?:s|ed|ing)?|steam(?:s|ed|ing)?|poach(?:es|ed|ing)?|rest(?:s|ed|ing)?|chill(?:s|ed|ing)?|refrigerate[sd]?|freeze|marinat(?:e|es|ed|ing)|rise[sn]?|rising|proof(?:s|ed|ing)?|soak(?:s|ed|ing)?|steep(?:s|ed|ing)?|cool(?:s|ed|ing)?|infuse[sd]?|brine[sd]?|ferment(?:s|ed|ing)?|slow[- ]?cook|pressure[- ]?cook|broil(?:s|ed|ing)?|reduce|stand|sit|set(?:s)? (?:up|aside)|cover(?:ed)? and (?:cook|leave)|cook (?:covered|on low|on high)|leave)\b/i;
const HANDS_ON = /\b(sear(?:s|ed|ing)?|fry|fries|fried|frying|stir[- ]?fr(?:y|ied)|saut[eé]e?(?:s|d|ing)?|brown(?:s|ed|ing)?|whisk(?:ing)?|knead(?:ing)?|beat(?:ing)?|blend(?:ing)?|flip(?:ping)?|toss(?:ing)?|toast(?:ing)?|grill(?:ing)?|mix(?:ing)?|chop(?:ping)?)\b|\b(?:stirring|turning) (?:constantly|continuously|frequently|often)\b|\bconstantly\b/i;
/** A duration for a step only if that part of the step is hands-off (bake, simmer, marinate, rest…); null for stirring, frying, searing. */
export function handsOffTimer(text) {
  const parts = String(text).split(/(?<=[.;!?])\s+|,\s*(?=then\b)|\bthen\b/i);
  for (const p of parts) {
    const d = durationOf(p);
    if (!d) continue;
    if (!HANDS_OFF.test(p)) continue;
    // "fry for 5 minutes, stirring" is hands-on; "simmer 20 minutes, stirring occasionally" is not
    const on = p.match(HANDS_ON);
    if (on && !(HANDS_OFF.test(p.slice(0, on.index)) || /\bsimmer|\bbake|\broast|\bbraise/i.test(p)) ) continue;
    if (/\b(?:stirring|turning) (?:constantly|continuously|frequently|often)\b/i.test(p)) continue;
    return d;
  }
  return null;
}

/* ---------------- matching recipe steps to the game plan ---------------- */
const GENERIC = new Set(['the', 'and', 'with', 'into', 'for', 'until', 'add', 'stir', 'cook', 'mix', 'put', 'set', 'let', 'place', 'make', 'then', 'min', 'minute', 'over', 'from', 'off', 'each', 'half', 'rest', 'all', 'about', 'more', 'some', 'your', 'them', 'while', 'when', 'heat', 'medium', 'high', 'low', 'large', 'small', 'pan', 'pot', 'bowl', 'top', 'serve', 'serving', 'once', 'well', 'just', 'side', 'one', 'two', 'out', 'covered', 'uncovered']);
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '');
const OVEN = /\b(?:bake|baked|roast|roasted|braise|braised|broil)\b/i;
function anyDuration(t) {
  const m = String(t).match(/(\d+(?:\.\d+)?)\s*(hrs?|hours?|min(?:ute)?s?)\b(?:\s*(\d+)\s*min)?/i);
  return m ? Number(m[1]) * (/^h/i.test(m[2]) ? 60 : 1) + (m[3] ? Number(m[3]) : 0) : 0;
}
function words(t) {
  const extra = (OVEN.test(t) ? ['oven'] : []).concat(/\b(?:assemble|portion|pack|fill|layer|toss|combine|divide|split|jar)\b/i.test(t) ? ['assembl'] : []);
  return new Set(extra.concat(String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z]+/).filter((w) => w.length >= 3 && !GENERIC.has(w)).map(stem).filter((w) => w.length >= 3 && !GENERIC.has(w))));
}
export const isPrepStep = (text) => /^\s*(?:chop|cut|prep|dice|slice|wash|set up|get out|measure)\b|\b(?:chop|cut|prep) everything\b/i.test(String(text));

/**
 * Give each of a recipe's steps a place in the game plan, keeping the recipe's order.
 * timeline: [{ text, idx }] (cooking steps only). Returns an array of timeline idx per recipe step, or null if the plan doesn't cover this recipe.
 */
export function alignSteps(r, timeline, others = []) {
  const steps = r.steps || [], n = steps.length, m = timeline.length;
  if (!n || !m) return null;
  // words in other recipes' names (shared ingredients like "squash") count for little; this recipe's own words count a lot
  const theirs = new Set(others.filter((o) => o.id !== r.id).flatMap((o) => keyWords(o.title).map(stem)));
  const mine = keyWords(r.title).map(stem).filter((w) => !theirs.has(w));
  const tw = timeline.map((t) => words(t.text)), td = timeline.map((t) => anyDuration(t.text));
  const mention = tw.map((T) => (mine.some((w) => T.has(w)) ? 1.5 : 0));
  const weight = (x) => (theirs.has(x) ? 0.3 : 1);
  const sc = steps.map((s) => {
    const w = words(s), d = anyDuration(s);
    return tw.map((T, i) => { let c = 0; w.forEach((x) => { if (T.has(x)) c += weight(x); }); if (d && d === td[i] && d >= 10) c += 2; return c + mention[i] - i * 1e-3; });
  });
  let best = 0; sc.forEach((row) => row.forEach((v) => { if (v > best) best = v; }));
  if (best < 0.9) return null;
  // best order-keeping assignment (each step at or after the one before)
  const dp = sc.map(() => Array(m).fill(-Infinity)), from = sc.map(() => Array(m).fill(0));
  for (let i = 0; i < m; i++) dp[0][i] = sc[0][i];
  for (let j = 1; j < n; j++) {
    let bv = -Infinity, bi = 0;
    for (let i = 0; i < m; i++) { if (dp[j - 1][i] > bv) { bv = dp[j - 1][i]; bi = i; } dp[j][i] = bv + sc[j][i]; from[j][i] = bi; }
  }
  let end = 0; for (let i = 1; i < m; i++) if (dp[n - 1][i] > dp[n - 1][end]) end = i;
  const out = Array(n); out[n - 1] = end;
  for (let j = n - 1; j > 0; j--) out[j - 1] = from[j][out[j]];
  return out.map((i) => timeline[i].idx);
}

/* ---------------- pans and appliances ---------------- */
const EQUIP = [
  ['Sheet pans', /\bsheet pans?\b|\bbaking sheets?\b|\broast(?:ed|ing)?\b(?!.*\bdutch oven\b)/i, 'roast'],
  ['9×13 baking dish', /\b9\s*[x×]\s*13\b/i],
  ['8×8 baking dish', /\b8\s*[x×]\s*8\b/i],
  ['Loaf pan', /\bloaf pan\b/i],
  ['Muffin tin', /\bmuffin (?:tin|pan|cups?)\b/i],
  ['Pie dish', /\bpie (?:dish|plate|pan)\b/i],
  ['Dutch oven', /\bdutch oven\b|\bbraise\b/i],
  ['Large pot', /\bboil\b|\bstockpot\b|\blarge pot\b|\bsoup\b|\bpasta\b|\brigatoni|\bnoodles?\b/i],
  ['Saucepan', /\bsaucepan\b|\bsimmer\b(?!.*soup)|\brice\b|\bfarro\b|\bquinoa\b|\bcompote\b/i],
  ['Large skillet', /\bskillet\b|\bfrying pan\b|\bsaut[eé]\b|\bbrown (?:the )?(?:sausage|beef|turkey|meat|pork)\b|\bcrisp the bacon\b|\bscramble/i],
  ['Blender', /\bblend(?:er|ed)?\b|\bpur[eé]e\b/i],
  ['Food processor', /\bfood processor\b|\bpulse\b/i],
  ['Slow cooker / Instant Pot', /\bslow cooker\b|\bcrock ?pot\b|\binstant pot\b|\bpressure cook/i],
  ['Stand or hand mixer', /\bmixer\b|\bbeat (?:until|on)\b/i],
  ['Colander', /\bdrain(?:ed)?\b|\brinsed?\b/i],
  ['Box grater / microplane', /\bgrat(?:e|ed)\b|\bzest\b|\bshred(?:ded)? (?:cheddar|mozzarella|cheese|carrot|cabbage)/i],
  ['Mixing bowls + whisk', /\bwhisk\b|\bmixing bowl\b|\btoss\b|\bstir together\b/i],
  ['Masher', /\bmash\b/i],
  ['Jars', /\bjars?\b/i],
  ['Meal-prep containers', /\bportion\b|\bcontainers?\b|\bdivide\b/i],
  ['Foil / plastic wrap', /\bfoil\b|\bwrap (?:twice|tightly|well)\b|\bcovered\b/i],
  ['Parchment paper', /\bparchment\b/i],
  ['Meat thermometer', /\b16[05]\s*°?\s*F\b|\binternal temp/i]
];
/**
 * What to pull out before you start: [{ name, recipes:[titles], count }], plus oven temperatures in the order they're needed.
 */
export function equipmentFor(recipes) {
  const found = new Map(), temps = [];
  recipes.forEach((r) => {
    const text = [...(r.steps || []), ...(r.ing || [])].join(' \n ');
    EQUIP.forEach(([name, re]) => {
      if (!re.test(text)) return;
      const e = found.get(name) || { name, recipes: [], count: 1, optional: true };
      if (!(/slow cooker/i.test(name) && /\bor (?:a |in a )?slow cooker\b/i.test(text))) e.optional = false;
      e.recipes.push(r.title);
      if (/8\s*[x×]\s*8/.test(name) && /\btwo 8\s*[x×]\s*8/i.test(text)) e.count = Math.max(e.count, 2);
      found.set(name, e);
    });
    (r.steps || []).forEach((s) => { const m = String(s).match(/(\d{3})\s*°\s*F/); if (m && !/from frozen|reheat/i.test(s) && !temps.includes(m[1] + '°F')) temps.push(m[1] + '°F'); });
  });
  const order = EQUIP.map((e) => e[0]);
  temps.sort((a, b) => parseInt(b) - parseInt(a));
  return { items: [...found.values()].map((e) => ({ ...e, optional: /slow cooker/i.test(e.name) && e.optional })).sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)), temps };
}

/* ---------------- how long each step takes ---------------- */
/** "1:30" / "12:55 pm" → minutes since midnight-ish (a cook day runs forward, so a smaller clock time means it rolled past 12). */
function clockMins(t) {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})\s*([ap])?/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3] && /p/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}
/** A time written in the step itself ("Chop everything first (25 min)"), not a cook time. */
function statedMins(text) {
  const m = String(text).match(/\((?:about |~)?(\d+)\s*(?:–|-|to)?\s*(\d+)?\s*(min|minutes|hr|hours?)\)/i);
  if (!m) return null;
  return Number(m[1]) * (/^h/i.test(m[3]) ? 60 : 1);
}
/** Minutes for each game-plan step: the gap to the next step's clock time, or a time stated in the step. Last step: null unless stated. */
export function stepMinutes(items) {
  const raw = items.map((it) => clockMins(it.time));
  // unroll the 12-hour clock: 12:30 → 12:55 → 1:00 keeps going forward
  let add = 0, prev = null;
  const abs = raw.map((v) => { if (v == null) return null; if (prev != null && v + add < prev - 60) add += 12 * 60; prev = v + add; return v + add; });
  return items.map((it, i) => {
    const stated = statedMins(`${it.label || ''} ${it.text}`);
    if (stated) return stated;
    const next = abs.slice(i + 1).find((v) => v != null);
    return abs[i] != null && next != null && next > abs[i] ? next - abs[i] : null;
  });
}
export function fmtMins(m, approx = false) {
  if (m == null || !(m > 0)) return '';
  const r = m >= 60 ? Math.round(m / 5) * 5 : Math.round(m);
  const h = Math.floor(r / 60), mm = r % 60;
  return (approx ? '~' : '') + (h ? `${h} hr${mm ? ` ${mm} min` : ''}` : `${mm} min`);
}

/* ---------------- scaling time with batch size ----------------
 * Cooking more food doesn't take proportionally longer — it depends on what limits the step:
 *  - Knife work & assembly: your hands are the limit, so it's nearly linear (k^0.85: a little faster once you're in a rhythm).
 *  - Bringing liquid to a boil: the burner's power is the limit, so time grows with the amount (linear), capped at 3×
 *    because bigger batches go in bigger pots over more burners.
 *  - A bigger single piece (whole roast, turkey, brisket): heat has to travel to the center, and time grows with
 *    thickness squared; a piece k times heavier is k^(1/3) thicker, so time grows by k^(2/3).
 *    (Double a roast → about 1.6× the time, not 2×. Never raise the temperature to make up for it.)
 *  - Pans in the oven: each pan cooks in the same time, but a fuller oven recovers heat more slowly (+10% per extra pan,
 *    up to +30%), and if the pans don't all fit, they go in rounds.
 *  - Searing / browning: crowding a pan steams the food, so you brown in batches (one batch per pan-full).
 *  - Simmering / braising: the time to get tender doesn't change; only the heat-up of a bigger pot does (k^(1/3)).
 *  - Resting, marinating, chilling, rising: unchanged.
 */
const CUT_RE = /\b(chop|dice|slice|cut|mince|peel|grate|trim|wash|shred|quarter|julienne|core|seed|zest|crush|pick)\b/i;
const COMBINE_RE = /\b(measure|whisk|mix|toss|stir|combine|assemble|portion|form|shape|roll|stuff|spread|layer|pack|label|scoop|garnish|season|rub|pour)\b/i;
const PREP_RE = new RegExp(CUT_RE.source + '|' + COMBINE_RE.source, 'i');
const HEAT_RE = /\b(heat|cook|boil|simmer|saut|fry|sear|brown|bake|roast|broil|oven|grill|toast|melt|reduce|wok|skillet)/i;

/** Minutes for a recipe step that doesn't say how long it takes. Headings and notes take none. */
export function estimateMins(text) {
  const t = String(text || '').trim();
  if (!t || /:$/.test(t) || /^\*|^note\b|^tip\b|\b(this recipe calls for|you can substitute|available at|do not confuse|if you can't find)\b/i.test(t)) return 0;
  const sec = t.match(/(\d+)\s*(?:sec|seconds?)\b/i);
  if (sec && !/\bmin/i.test(t)) return Math.max(1, Math.round(Number(sec[1]) / 60));
  return t.length < 60 ? 2 : HEAT_RE.test(t) ? 5 : COMBINE_RE.test(t) && !CUT_RE.test(t) ? 2 : 4;
}
const BOIL_RE = /\bbring\b.*\bboil\b|\bboil (?:the )?water\b|\buntil boiling\b/i;
const BIG_PIECE_RE = /\b(whole (?:chicken|turkey|fish)|turkey|brisket|shoulder|pork butt|roast beef|prime rib|leg of lamb|ham\b|tenderloin|meatloaf)\b/i;
const OVEN_RE = /\b(oven|bake|baked|roast|roasting|broil|sheet pan|baking sheet|baking dish|casserole|°\s*F)\b/i;
const SEAR_RE = /\b(sear|brown|saut[ée]|fry|crisp|char)\b/i;
const SIMMER_RE = /\b(simmer|braise|stew|slow cook|pressure cook|instant pot|poach)\b/i;
const WAIT_RE = /\b(rest|marinate|chill|refrigerate|cool|rise|proof|soak|set aside|freeze)\b/i;

/** How many oven pans one batch of a recipe uses ("two sheet pans" → 2). */
export function pansOf(r) {
  const t = (r?.steps || []).join(' ').replace(/dutch oven/gi, 'pot');
  const m = t.match(/\b(two|three|four|2|3|4)\s+(?:large\s+)?(?:sheet pans|baking sheets|baking dishes|pans|trays)\b/i);
  const n = m ? ({ two: 2, three: 3, four: 4 }[m[1].toLowerCase()] || Number(m[1])) : 1;
  return OVEN_RE.test(t) ? n : 0;
}

/**
 * Minutes for a step when making k× the recipe.
 * setup: { ovens, racks (pans per oven), commercial } · pans: oven pans per batch
 * Returns { mins, perRound, rounds, pans, note }
 */
export function scaleTime(text, mins, k = 1, setup = {}, pans = 1) {
  const t = String(text || '').replace(/dutch oven/gi, 'pot'), base = Number(mins) || 0;   // a Dutch oven is a pot, not oven space
  const out = { mins: base, perRound: base, rounds: 1, pans: 0, note: '' };
  if (!base || !(k > 0) || Math.abs(k - 1) < 0.01) return out;
  const r5 = (x) => (x < 10 ? Math.max(1, Math.round(x)) : Math.round(x / 5) * 5);
  if (WAIT_RE.test(t) && !OVEN_RE.test(t) && !SEAR_RE.test(t)) return out;
  if (OVEN_RE.test(t) && BIG_PIECE_RE.test(t)) {
    const f = Math.pow(k, 2 / 3);
    return { ...out, mins: r5(base * f), perRound: r5(base * f), note: `bigger cut: about ${f.toFixed(1)}× the time at the same temperature — go by a thermometer` };
  }
  if (SIMMER_RE.test(t)) {
    // braises and stews: the time to get tender is the same; a fuller pot only takes longer to come up to heat
    const f = Math.min(1.35, 1 + 0.15 * (k - 1));
    return { ...out, mins: r5(base * f), perRound: r5(base * f), note: k > 1.5 ? `same temperature — use a bigger pot or two side by side; about ${Math.round((f - 1) * 100)}% longer to come up to heat` : '' };
  }
  if (OVEN_RE.test(t) && !PREP_RE.test(t.split(/[.;]/)[0])) {
    const need = Math.max(1, Math.ceil((pans || 1) * k - 0.01));
    const fit = Math.max(1, (Number(setup.ovens) || 1) * (Number(setup.racks) || 2));
    const rounds = Math.ceil(need / fit), perLoad = Math.min(need, fit);
    const load = setup.commercial ? 1 + Math.min(0.15, (perLoad - 1) * 0.03) : 1 + Math.min(0.3, (perLoad - 1) * 0.1);
    const per = r5(base * load);
    return { mins: per * rounds + (rounds - 1) * 5, perRound: per, rounds, pans: need,
      note: rounds > 1 ? `${need} pans, ${perLoad} at a time → ${rounds} rounds of ${per} min (rotate pans halfway)` : need > 1 ? `${need} pans in together, rotate halfway${load > 1 ? ` — a full oven adds ~${Math.round((load - 1) * 100)}%` : ''}` : '' };
  }
  if (BOIL_RE.test(t)) { const f = Math.min(3, k); return { ...out, mins: r5(base * f), perRound: r5(base * f), note: k > 2 ? 'use the biggest pot, lid on — or split across two pots' : '' }; }
  if (SEAR_RE.test(t) && !SIMMER_RE.test(t)) {
    const per = setup.commercial ? 3 : 1, batches = Math.max(1, Math.ceil(k / per - 0.01));
    return { ...out, mins: r5(base * batches), perRound: base, rounds: batches, note: batches > 1 ? `brown in ${batches} batches so the pan doesn't steam` : '' };
  }
  if (SIMMER_RE.test(t)) { const f = Math.pow(k, 1 / 3); return { ...out, mins: r5(base * f), perRound: r5(base * f), note: k > 1.5 ? 'a bigger pot takes longer to come back to a simmer; the cooking time itself doesn’t change' : '' }; }
  if (CUT_RE.test(t) && !HEAT_RE.test(t)) { const f = Math.pow(k, 0.85); return { ...out, mins: r5(base * f), perRound: r5(base * f), note: '' }; }
  if (COMBINE_RE.test(t) && !HEAT_RE.test(t)) { const f = Math.pow(k, 0.4); return { ...out, mins: r5(base * f), perRound: r5(base * f), note: '' }; }   // a bigger bowl, not 4× the stirring
  const f = Math.pow(k, 1 / 3);
  return { ...out, mins: r5(base * f), perRound: r5(base * f) };
}

export const isCutOnly = (t) => CUT_RE.test(String(t)) && !HEAT_RE.test(String(t));

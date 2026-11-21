// Finding new recipes: TheMealDB (free, by cuisine or meal type) and any recipe page that publishes schema.org Recipe data.
const MEALDB = 'https://www.themealdb.com/api/json/v1/1';

// the cuisines people pick most; TheMealDB "areas" behind each
export const CUISINES = [
  ['American', ['American', 'Canadian']], ['Mexican', ['Mexican']], ['Italian', ['Italian']], ['Chinese', ['Chinese']],
  ['Japanese', ['Japanese']], ['Thai', ['Thai']], ['Indian', ['Indian']], ['Korean', ['South Korean']],
  ['Vietnamese', ['Vietnamese']], ['Filipino', ['Filipino']], ['Mediterranean', ['Greek', 'Turkish', 'Lebanese']],
  ['French', ['French']], ['Spanish', ['Spanish', 'Portuguese']], ['Middle Eastern', ['Egyptian', 'Moroccan', 'Tunisian', 'Syrian', 'Iranian']],
  ['Caribbean', ['Jamaican', 'Cuban', 'Puerto Rican', 'Trinidadian']], ['Latin American', ['Brazilian', 'Peruvian', 'Argentine', 'Colombian', 'Venezuelan']],
  ['British & Irish', ['British', 'Irish']], ['African', ['Kenyan', 'Nigerian', 'Ethiopian', 'South African', 'Ghanaian']],
];
export const MEAL_TYPES = [['Breakfast', 'Breakfast'], ['Chicken', 'Chicken'], ['Beef', 'Beef'], ['Pork', 'Pork'], ['Seafood', 'Seafood'], ['Vegetarian', 'Vegetarian'], ['Vegan', 'Vegan'], ['Pasta', 'Pasta'], ['Lamb', 'Lamb'], ['Sides', 'Side'], ['Dessert', 'Dessert']];

const STAPLE = /^(salt|pepper|black pepper|water|oil|olive oil|vegetable oil|cooking spray|sugar|flour|ice)$/i;
function sectionOf(name) {
  const s = ' ' + name.toLowerCase().replace(/[^a-z ]+/g, ' ') + ' ';
  const has = (re) => re.test(s);
  if (has(/ (can|canned|jar|sauce|paste|broth|stock|dried|powder|ground (cumin|coriander|ginger|cinnamon|turmeric)|masala|spice|seasoning|vinegar|soy|rice|pasta|noodles?|beans|lentils|flour|sugar|honey|syrup|oats|nuts?) /)) return 'Pantry';
  if (has(/ frozen /)) return 'Frozen';
  if (has(/ (milk|cheese|butter|cream|yogurt|yoghurt|eggs?|parmesan|mozzarella|feta|cheddar) /)) return 'Dairy & Eggs';
  if (has(/ (onions?|garlic|peppers?|tomato(es)?|potato(es)?|carrots?|celery|lettuce|spinach|kale|cabbage|cilantro|coriander leaves|parsley|basil|mint|limes?|lemons?|ginger|chil(l)?i(es)?|mushrooms?|zucchini|squash|avocados?|apples?|bananas?|berries|scallions?|leeks?|cucumbers?|broccoli|cauliflower|shallots?|corn|herbs?|jalapenos?) /)) return 'Produce';
  if (has(/ (chicken|beef|pork|lamb|turkey|sausages?|bacon|ham|steak|mince|fish|salmon|shrimp|prawns?|tuna|cod|crab|mussels|clams|thighs|breasts?) /)) return 'Meat & Seafood';
  if (has(/ (bread|buns?|tortillas?|pitas?|baguette|rolls?) /)) return 'Bakery';
  return 'Pantry';
}
// "1 tablespoon garam masala" → "garam masala": you buy a jar, not a tablespoon
const SMALL = /^[\d\s½¼¾⅓⅔⅛./-]+\s*(teaspoons?|tsp|tablespoons?|tbsp|tbs|cups?|cloves?|pinch(es)?|dash(es)?|sprigs?|handful|stalks?|bunch)\b\.?\s*(of\s+)?/i;
const shopLine = (l) => l.replace(/\s*\((optional|or more|to taste)[^)]*\)/gi, '').replace(SMALL, '').replace(/,\s*(minced|diced|chopped|sliced|cut|peeled|grated|crushed|finely|thinly|to taste|divided|softened|melted)[^,]*$/i, '').trim();
const mealOf = (cat) => /breakfast/i.test(cat) ? 'Breakfast' : /dessert/i.test(cat) ? 'Snack' : /side|starter/i.test(cat) ? 'Side' : 'Dinner';
const splitSteps = (t) => {
  const lines = String(t || '').split(/\r?\n+|(?<=\.)\s+(?=STEP|\d+\.)/).map((x) => x.replace(/^\s*(step\s*\d+[:.]?|\d+[.)])\s*/i, '').trim()).filter((x) => x.length > 3);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\*|^note:/i.test(l)) continue;                                    // side notes aren't steps
    if (/:$/.test(l) && lines[i + 1]) { lines[i + 1] = l.replace(/:$/, '') + ' — ' + lines[i + 1]; continue; }   // "Sauté eggplant:" heads the next line
    out.push(l);
  }
  return out;
};

function toParsed({ title, servings, yieldText, cuisine, when, ing, steps, url, shopping, calories, image }) {
  return { shopping, recipes: [{ title, servings: servings || 4, yieldText: yieldText || `${servings || 4} servings`, when, fridge: '', freeze: '', ing, steps, tip: '', url, cuisine, calories, image }] };
}

/** TheMealDB meal → the shape buildImport takes. */
export function fromMealDb(m) {
  const ing = [], shopping = [];
  for (let i = 1; i <= 20; i++) {
    const name = String(m['strIngredient' + i] || '').trim(), meas = String(m['strMeasure' + i] || '').trim();
    if (!name) continue;
    ing.push(`${meas} ${name}`.trim());
    if (!STAPLE.test(name)) shopping.push({ line: shopLine(`${/^\d/.test(meas) ? meas + ' ' : ''}${name}`), section: sectionOf(name) });
  }
  return toParsed({ title: m.strMeal, servings: 4, cuisine: m.strArea, when: mealOf(m.strCategory), ing, steps: splitSteps(m.strInstructions),
    url: m.strSource || `https://www.themealdb.com/meal/${m.idMeal}`, shopping, image: m.strMealThumb || '' });
}

/** schema.org Recipe (from a recipe page) → the shape buildImport takes. */
export function fromJsonLd(r, url) {
  const ing = (r.recipeIngredient || r.ingredients || []).map((x) => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const flat = (x) => Array.isArray(x) ? x.flatMap(flat) : x && typeof x === 'object' ? (x.itemListElement ? flat(x.itemListElement) : [x.text || x.name || '']) : [String(x || '')];
  const steps = flat(r.recipeInstructions).flatMap((t) => splitSteps(t.replace(/<[^>]+>/g, ' ')));
  const y = Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield;
  const servings = Number(String(y || '').match(/\d+/)?.[0]) || 4;
  const cat = [].concat(r.recipeCategory || []).join(' ');
  const shopping = ing.map(shopLine).filter((l) => l && !STAPLE.test(l.replace(/^[\d\s½¼¾⅓⅔./-]+/, '').trim())).map((line) => ({ line, section: sectionOf(line) }));
  return toParsed({ title: String(r.name || 'Recipe').replace(/&amp;/g, '&'), servings, yieldText: String(y || ''), cuisine: [].concat(r.recipeCuisine || [])[0] || '',
    when: mealOf(cat), ing, steps, url, shopping, calories: Math.round(Number(String(r.nutrition?.calories || '').match(/[\d.]+/)?.[0])) || null,
    image: (() => { const im = Array.isArray(r.image) ? r.image[0] : r.image; return typeof im === 'string' ? im : im?.url || ''; })() });
}

const get = (path) => fetch(MEALDB + path).then((r) => { if (!r.ok) throw new Error('The recipe finder is busy — try again in a moment.'); return r.json(); });
/** Recipe ideas for any of the cuisines, any of the meal types, or a search: [{id, title, thumb, area}] */
export async function findIdeas({ cuisines = [], types = [], search = '' }) {
  if (search) return ((await get(`/search.php?s=${encodeURIComponent(search)}`)).meals || []).map(shape);
  const areas = cuisines.flatMap((c) => (CUISINES.find((x) => x[0] === c) || [c, [c]])[1]);
  const cats = types.map((t) => (MEAL_TYPES.find((x) => x[0] === t) || [t, t])[1]).filter(Boolean);
  const pull = (path, extra = {}) => get(path).then((j) => (j.meals || []).map((m) => ({ ...m, ...extra }))).catch(() => []);
  let byArea = null, byCat = null;
  if (areas.length) byArea = (await Promise.all(areas.map((a) => pull(`/filter.php?a=${encodeURIComponent(a)}`, { strArea: a })))).flat();
  if (cats.length) byCat = (await Promise.all(cats.map((c) => pull(`/filter.php?c=${encodeURIComponent(c)}`)))).flat();
  let list = byArea && byCat ? byArea.filter((m) => byCat.some((x) => x.idMeal === m.idMeal)) : byArea || byCat || [];
  if (!byArea && !byCat) list = (await Promise.all(['Chicken', 'Beef', 'Vegetarian', 'Seafood', 'Pasta'].map((c) => pull(`/filter.php?c=${c}`)))).flat();
  const seen = new Set(); list = list.filter((m) => !seen.has(m.idMeal) && seen.add(m.idMeal));
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }   // a fresh mix each time
  return list.map(shape);
}
const shape = (m) => ({ id: m.idMeal, title: m.strMeal, thumb: m.strMealThumb, area: m.strArea || '' });
export async function mealDetail(id) { const m = (await get(`/lookup.php?i=${id}`)).meals?.[0]; if (!m) throw new Error('That recipe is gone.'); return m; }

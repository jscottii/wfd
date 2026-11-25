// Meal preferences: diets and allergies. Each ingredient line is checked on its own, whole words only, after
// removing "safe" look-alikes (garlic-infused oil, green beans, butternut squash, almond flour, lactose-free milk…).
// Diets that are really about amounts (keto, low-fat, high-protein) use the estimated nutrition instead of words.
// Matching can still miss hidden ingredients — people with allergies should read labels.
import { nutritionOf } from './nutrition.js';

export const DIETS = ['Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Low-carb', 'Paleo', 'Whole30', 'Gluten-free', 'Dairy-free', 'Mediterranean', 'Halal', 'Kosher', 'High-protein'];
// health-related ways of eating (shown with a "not medical advice" note)
export const HEALTH_DIETS = ['Diabetes-friendly', 'Heart-healthy', 'Low-sodium', 'Low-FODMAP', 'Low-fat', 'Kidney-friendly', 'Pregnancy-safe'];
export const ALLERGENS = ['Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Fish', 'Shellfish', 'Soy', 'Wheat / gluten', 'Sesame'];

// terms: words that count; safe: phrases removed first so they can't trigger the terms
const R = {
  meat: { terms: 'chicken|beef|pork|bacon|ham|hamburger|sausage|turkey|lamb|veal|steak|chorizo|prosciutto|pepperoni|salami|duck|brisket|gelatin|lard|venison|pancetta|meatball|hot dog|ground meat|mince|short rib|ribs|oxtail|bone broth|chicken stock|chicken broth|beef stock|beef broth', safe: 'celery ribs|celery rib|vegan*|vegetarian*|plant-based*|plant based*|meatless*|beyond|impossible|vegetable stock|vegetable broth|veggie broth|goat cheese|chicken-style|no-chicken|turkey berry' },
  fish: { terms: 'salmon|tuna|cod|tilapia|halibut|fish|anchovy|anchovies|sardine|trout|mackerel|snapper|sea bass|branzino|haddock|mahi|swordfish|catfish|pollock|bonito|dashi|worcestershire', safe: 'vegan fish sauce|fish-free|vegan worcestershire|fish pepper' },
  shellfish: { terms: 'shrimp|prawn|crab|lobster|clam|mussel|oyster|scallop|squid|calamari|crawfish|crayfish|oyster sauce', safe: 'oyster mushroom|imitation crab|crab apple|vegan oyster sauce|mushroom oyster sauce' },
  dairy: { terms: 'milk|cheese|butter|cream|yogurt|yoghurt|ghee|parmesan|parmigiano|pecorino|mozzarella|cheddar|ricotta|feta|whey|buttermilk|custard|ice cream|half and half|half-and-half|sour cream|mascarpone|brie|gouda|gruyere|paneer|burrata|queso|creme fraiche|crème fraîche|kefir|casein', safe: 'coconut milk|almond milk|oat milk|soy milk|rice milk|cashew milk|hemp milk|plant milk|dairy-free*|dairy free*|non-dairy*|nondairy*|vegan*|plant-based*|peanut butter|almond butter|nut butter|cashew butter|sunflower butter|sunbutter|seed butter|cocoa butter|shea butter|apple butter|butternut|butter bean|butterhead|butter lettuce|cream of tartar|coconut cream|coconut yogurt|nutritional yeast|cream of coconut|creamed corn' },
  eggs: { terms: 'egg|eggs|egg yolk|egg white|mayonnaise|mayo|meringue|aioli', safe: 'egg-free*|eggless*|vegan mayo|vegan mayonnaise|flax egg|chia egg|egg replacer|eggplant|egg roll wrapper' },
  gluten: { terms: 'flour|bread|breadcrumb|breadcrumbs|panko|pasta|spaghetti|linguine|fettuccine|penne|rigatoni|macaroni|lasagna|lasagne|noodle|noodles|couscous|barley|farro|bulgur|wheat|rye|seitan|bun|buns|pita|tortilla|tortillas|cracker|crackers|crouton|croutons|soy sauce|beer|pancake|waffle|biscuit|pie crust|puff pastry|orzo|gnocchi|udon|ramen|malt|semolina|spelt|naan|bagel|baguette|croissant|brioche|graham|matzo|teriyaki|hoisin', safe: 'gluten-free*|gluten free*|gf*|rice flour|almond flour|coconut flour|corn flour|cornflour|masa harina|tapioca flour|cassava flour|chickpea flour|oat flour \\(gf\\)|buckwheat flour|potato flour|arrowroot|rice noodle|rice noodles|glass noodle|glass noodles|rice vermicelli|rice paper|kelp noodle|zucchini noodle|zoodle|shirataki|corn tortilla|corn tortillas|tamari|coconut aminos|cornstarch|corn starch|buckwheat' },
  peanuts: { terms: 'peanut|peanuts|peanut butter|groundnut', safe: '' },
  treeNuts: { terms: 'almond|almonds|walnut|walnuts|pecan|pecans|cashew|cashews|pistachio|pistachios|hazelnut|hazelnuts|macadamia|pine nut|pine nuts|pignoli|brazil nut|praline|marzipan|nutella|frangipane', safe: '' },
  soy: { terms: 'soy|soya|soybean|soybeans|tofu|edamame|miso|tempeh|tamari|natto', safe: 'soy-free' },
  sesame: { terms: 'sesame|tahini|benne|halva|halvah|furikake', safe: '' },
  honey: { terms: 'honey', safe: 'honeydew|honeycrisp' },
  grains: { terms: 'flour|bread|breadcrumbs|panko|pasta|spaghetti|penne|rigatoni|macaroni|linguine|noodle|noodles|rice|oats|oatmeal|corn|cornmeal|polenta|grits|barley|farro|quinoa|couscous|tortilla|tortillas|bun|buns|cracker|crackers|wheat|rye|millet|bulgur|orzo|pita|naan|bagel', safe: 'almond flour|coconut flour|cassava flour|tapioca flour|arrowroot|cauliflower rice|riced cauliflower|rice vinegar|rice wine|zucchini noodle|zoodle|kelp noodle|shirataki|coconut aminos|corn starch|cornstarch|baby corn' },
  legumes: { terms: 'beans|bean|lentil|lentils|chickpea|chickpeas|garbanzo|peanut|peanuts|soy|soya|tofu|edamame|peas|hummus|miso|tempeh|black-eyed peas|split peas', safe: 'green beans|green bean|string beans|snap peas|snow peas|sugar snap|vanilla bean|coffee bean|cocoa bean|haricots verts|runner beans|wax beans' },
  addedSugar: { terms: 'sugar|brown sugar|powdered sugar|corn syrup|high fructose|agave|cane syrup|molasses|candy|marshmallow|chocolate chips', safe: 'sugar-free*|sugar free*|no sugar added|sugar snap|unsweetened' },
  anySweetener: { terms: 'sugar|honey|maple syrup|agave|corn syrup|molasses|coconut sugar|date syrup|stevia|monk fruit|sweetener|splenda', safe: 'sugar snap|sugar-free|sugar free|no sugar added|unsweetened' },
  refined: { terms: 'sugar|honey|maple syrup|agave|corn syrup|white rice|white bread|pasta|spaghetti|rigatoni|penne|linguine|macaroni|noodle|noodles|bun|buns|pancake|syrup|juice|cake|cookie|cookies|candy|soda', safe: 'sugar-free*|sugar free*|no sugar added|sugar snap|unsweetened|whole wheat pasta|whole-wheat pasta|whole grain|wholegrain|zucchini noodle|shirataki|lemon juice|lime juice' },
  sodium: { terms: 'soy sauce|fish sauce|bouillon|stock cube|bacon|ham|sausage|salami|pepperoni|prosciutto|chorizo|anchovy|anchovies|miso|pickle|pickles|olives|capers|cured|feta|teriyaki|kimchi|sauerkraut|canned soup|seasoning salt|ramen', safe: 'low-sodium*|low sodium*|reduced-sodium*|reduced sodium*|no-salt-added*|no salt added*|unsalted*|salt-free*' },
  satfat: { terms: 'bacon|sausage|butter|heavy cream|whipping cream|double cream|lard|ghee|salami|pepperoni|chorizo|coconut oil|deep-fry|deep fry|shortening|cream cheese|mascarpone', safe: 'peanut butter|almond butter|nut butter|cashew butter|sunflower butter|cocoa butter|apple butter|butternut|butter bean|butter lettuce|light cream cheese' },
  fodmap: { terms: 'onion|onions|garlic|shallot|shallots|leek|leeks|wheat|flour|bread|buns|bun|pasta|spaghetti|penne|linguine|rigatoni|macaroni|fettuccine|lasagna|noodles|farro|bulgur|couscous|barley|rye|beans|bean|lentil|lentils|chickpea|chickpeas|hummus|honey|agave|high fructose|apple|apples|pear|pears|mango|watermelon|cherries|milk|yogurt|ice cream|ricotta|cottage cheese|cashew|cashews|pistachio|pistachios|mushroom|mushrooms|cauliflower|asparagus|artichoke|snow peas|sugar snap|celery|inulin|chicory', safe: 'garlic-infused|garlic infused|garlic oil|onion-infused|onion infused|green onion tops|green parts|scallion greens|spring onion greens|chives|lactose-free*|lactose free*|almond milk|coconut milk|rice milk|gluten-free*|gluten free*|rice flour|corn flour|cornflour|oat flour|buckwheat flour|tapioca flour|potato flour|green beans|green bean|string beans|apple cider vinegar|oyster mushroom|oyster mushrooms|celery seed|celery salt|garlic chives|sourdough spelt|rice noodle|rice noodles|asafoetida' },
  pork: { terms: 'pork|bacon|ham|lard|prosciutto|pepperoni|salami|chorizo|pancetta|gelatin|guanciale|hot dog', safe: 'turkey bacon|beef bacon|halal|vegan|plant-based|beef pepperoni|turkey pepperoni|chicken sausage|beef sausage' },
  alcohol: { terms: 'wine|beer|rum|vodka|bourbon|whiskey|whisky|brandy|sherry|mirin|sake|liqueur|tequila|gin|cognac|marsala|port|vermouth|kahlua|stout|ale', safe: 'wine vinegar|red wine vinegar|white wine vinegar|rice wine vinegar|sherry vinegar|cider vinegar|apple cider vinegar|non-alcoholic|alcohol-free|ginger beer|root beer' },
  kidney: { terms: 'soy sauce|bouillon|bacon|ham|sausage|banana|bananas|potato|potatoes|tomato|tomatoes|spinach|avocado|beans|lentil|lentils|cheese|milk|yogurt|nuts|chocolate|salami|pepperoni|cola', safe: 'low-sodium|green beans' },
  pregnancy: { terms: 'raw egg|raw eggs|raw fish|sushi|sashimi|tartare|ceviche|carpaccio|rare|brie|camembert|blue cheese|gorgonzola|roquefort|unpasteurized|raw milk|swordfish|king mackerel|tilefish|shark|bigeye tuna|liver|pâté|pate|runny|soft-boiled|soft boiled|wine|beer|rum|vodka|bourbon|brandy|liqueur', safe: 'wine vinegar|pasteurized|cooked' },
};
// longest first, so "peanut butter" is reported rather than "peanut"; a safe word ending in * also covers the
// one or two words after it ("lactose-free* " → "lactose-free whole milk")
const alt = (s) => s.split('|').sort((a, b) => b.length - a.length).map((x) => (x.endsWith('*') ? `${x.slice(0, -1)}(?:[ -][a-z]+){0,2}` : x)).join('|');
const RX = Object.fromEntries(Object.entries(R).map(([k, { terms, safe }]) => [k, {
  terms: new RegExp(`(^|[^\\w-])(${alt(terms)})(?![\\w-])`, 'gi'),
  safe: safe ? new RegExp(`(^|[^\\w-])(${alt(safe)})(?![\\w-])`, 'gi') : null,
}]));
/** The words in one ingredient line that trigger a rule (after removing its safe look-alikes). */
function hits(line, key) {
  const { terms, safe } = RX[key];
  const t = safe ? line.replace(safe, '$1 ') : line;
  return [...t.matchAll(terms)].map((m) => m[2].toLowerCase());
}
const lines = (r) => [r?.title || '', ...(r?.ing || [])].map((x) => ` ${String(x).toLowerCase()} `).filter((x) => !/:\s*$/.test(x));

const ALLERGEN_KEY = { Peanuts: ['peanuts'], 'Tree nuts': ['treeNuts'], Dairy: ['dairy'], Eggs: ['eggs'], Fish: ['fish'], Shellfish: ['shellfish'], Soy: ['soy'], 'Wheat / gluten': ['gluten'], Sesame: ['sesame'] };
// words-based diet rules
const DIET_RULES = {
  Vegetarian: ['meat', 'fish', 'shellfish'], Vegan: ['meat', 'fish', 'shellfish', 'dairy', 'eggs', 'honey'], Pescatarian: ['meat'],
  Paleo: ['grains', 'legumes', 'dairy', 'addedSugar'], Whole30: ['grains', 'legumes', 'dairy', 'anySweetener', 'alcohol'],
  'Gluten-free': ['gluten'], 'Dairy-free': ['dairy'], Halal: ['pork', 'alcohol'], Kosher: ['pork', 'shellfish'],
  'Diabetes-friendly': ['refined'], 'Heart-healthy': ['sodium', 'satfat'], 'Low-sodium': ['sodium'], 'Low-FODMAP': ['fodmap'],
  'Kidney-friendly': ['kidney'], 'Pregnancy-safe': ['pregnancy'],
};
// amount-based diets, judged per serving from the nutrition estimate
const AMOUNT_RULES = {
  Keto: (n) => n.carbs > 15 && `about ${n.carbs} g carbs a serving (keto is usually under ~20 g a day)`,
  'Low-carb': (n) => n.carbs > 40 && `about ${n.carbs} g carbs a serving`,
  'Low-fat': (n) => n.kcal && n.fat * 9 > n.kcal * 0.3 && `${Math.round((n.fat * 9 * 100) / n.kcal)}% of calories from fat`,
  'High-protein': (n) => n.kcal && (n.protein < 25 || n.protein * 4 < n.kcal * 0.2) && `only about ${n.protein} g protein a serving`,
  'Diabetes-friendly': (n) => n.carbs > 60 && `about ${n.carbs} g carbs a serving`,
};
// one entry per word, singular and plural together ("pear, pears" → "pear")
const uniq = (a) => { const seen = new Set(); return a.filter((w) => { const k = w.replace(/e?s$/, '').replace(/e$/, ''); if (seen.has(k)) return false; seen.add(k); return true; }); };
const short = (a) => (a.length > 3 ? `${a.slice(0, 3).join(', ')} +${a.length - 3} more` : a.join(', '));

/**
 * How a recipe fits someone's preferences.
 * allergens: [{ name, why }] · diets: [{ diet, why }] (doesn't fit) · fits: ['Low-FODMAP'] (chosen diets it passes)
 * notes: soft reminders that don't block (e.g. halal meat) · avoid: words they asked to skip
 */
export function conflicts(r, prefs = {}) {
  const L = lines(r);
  const found = (key) => uniq(L.flatMap((l) => hits(l, key)));
  const allergens = (prefs.allergies || []).map((a) => ({ name: a, why: uniq((ALLERGEN_KEY[a] || []).flatMap(found)) })).filter((x) => x.why.length);
  let n = null;
  const nut = () => (n ??= nutritionOf(r));
  const diets = [], fits = [], notes = [];
  for (const d of prefs.diets || []) {
    const why = uniq((DIET_RULES[d] || []).flatMap(found));
    if (d === 'Kosher' && found('meat').length && found('dairy').length) why.push('meat with dairy');
    const amt = AMOUNT_RULES[d] && nut()?.ok ? AMOUNT_RULES[d](nut()) : '';
    if (why.length || amt) diets.push({ diet: d, why: [why.length ? short(why) : '', amt].filter(Boolean).join('; ') });
    else if (DIET_RULES[d] || (AMOUNT_RULES[d] && nut()?.ok)) fits.push(d);
    if ((d === 'Halal' || d === 'Kosher') && found('meat').length && !why.length) notes.push(`${d}: buy ${d.toLowerCase()} meat`);
  }
  const text = L.join(' ');
  const avoid = (prefs.avoid || []).filter((w) => w && new RegExp(`(^|[^\\w-])${String(w).toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(text));
  return { allergens, diets, fits, notes, avoid, any: allergens.length + diets.length + avoid.length > 0 };
}
/** One line for lists: "⚠️ Contains peanuts (peanut butter) · Low-FODMAP: garlic, onion" */
export function conflictText(c) {
  return [
    ...c.allergens.map((a) => `Contains ${a.name.toLowerCase()} (${short(a.why)})`),
    ...c.diets.map((d) => `Not ${d.diet}: ${d.why}`),
    ...c.avoid.map((a) => `Has ${a}`),
  ].join(' · ');
}
export const prefsOf = (settings) => ({ diets: settings.diets || [], allergies: settings.allergies || [], avoid: String(settings.avoid || '').split(',').map((x) => x.trim()).filter(Boolean) });

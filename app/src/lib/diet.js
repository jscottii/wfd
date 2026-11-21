// Meal preferences: diets and allergies. Matching is by ingredient names, so it can miss hidden
// ingredients — people with allergies should still read labels.
export const DIETS = ['Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Low-carb', 'Paleo', 'Whole30', 'Gluten-free', 'Dairy-free', 'Mediterranean'];
export const ALLERGENS = ['Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Fish', 'Shellfish', 'Soy', 'Wheat / gluten', 'Sesame'];

const W = (s) => new RegExp(`\\b(${s})`, 'i');
const RE = {
  meat: W('chicken|beef|pork|bacon|ham\\b|sausage|turkey|lamb|veal|steak|chorizo|prosciutto|pepperoni|salami|duck|brisket|gelatin|lard'),
  fish: W('salmon|tuna|cod\\b|tilapia|halibut|fish|anchov|sardine|trout|mackerel|snapper|bass\\b'),
  shellfish: W('shrimp|prawn|crab|lobster|clam|mussel|oyster|scallop|squid|calamari'),
  dairy: W('milk|cheese|butter|cream|yogurt|yoghurt|ghee|parmesan|mozzarella|cheddar|ricotta|feta|whey|buttermilk'),
  notDairy: W('coconut milk|almond milk|oat milk|soy milk|peanut butter|cocoa butter|nut butter|almond butter|cream of tartar|coconut cream'),
  eggs: W('eggs?\\b|mayonnaise|mayo\\b'),
  gluten: W('flour|bread|pasta|spaghetti|noodle|rigatoni|penne|macaroni|couscous|barley|farro|bulgur|wheat|bun|panko|breadcrumb|soy sauce|beer|cracker|pancake|tortilla|pita|baguette|seitan'),
  peanuts: W('peanut'),
  treeNuts: W('almond|walnut|pecan|cashew|pistachio|hazelnut|macadamia|pine nut|brazil nut'),
  soy: W('soy|tofu|edamame|miso|tempeh'),
  sesame: W('sesame|tahini'),
  carbs: W('pasta|rice|bread|potato|sugar|flour|noodle|tortilla|bun|corn|beans|oats|honey|farro|quinoa|couscous|maple syrup|pancake|rigatoni|penne|spaghetti'),
  legumes: W('beans|lentil|chickpea|peanut|soy|tofu|edamame|peas\\b'),
  grains: W('flour|bread|pasta|rice|oats|corn|barley|farro|quinoa|couscous|noodle|tortilla|bun|rigatoni|penne|spaghetti'),
  sugar: W('sugar|honey|maple syrup|agave|corn syrup'),
  honey: W('honey'),
};
const ALLERGEN_RE = { Peanuts: 'peanuts', 'Tree nuts': 'treeNuts', Dairy: 'dairy', Eggs: 'eggs', Fish: 'fish', Shellfish: 'shellfish', Soy: 'soy', 'Wheat / gluten': 'gluten', Sesame: 'sesame' };
const DIET_RULES = {
  Vegetarian: ['meat', 'fish', 'shellfish'], Vegan: ['meat', 'fish', 'shellfish', 'dairy', 'eggs', 'honey'], Pescatarian: ['meat'],
  Keto: ['carbs'], 'Low-carb': ['carbs'], Paleo: ['grains', 'legumes', 'dairy', 'sugar'], Whole30: ['grains', 'legumes', 'dairy', 'sugar'],
  'Gluten-free': ['gluten'], 'Dairy-free': ['dairy'], Mediterranean: [],
};
const LABEL = { meat: 'meat', fish: 'fish', shellfish: 'shellfish', dairy: 'dairy', eggs: 'eggs', honey: 'honey', carbs: 'carbs', grains: 'grains', legumes: 'beans/legumes', sugar: 'added sugar', gluten: 'gluten' };

function has(text, key) {
  if (key === 'dairy') return RE.dairy.test(text.replace(new RegExp(RE.notDairy.source, 'gi'), ''));
  return RE[key].test(text);
}
/** What in a recipe clashes with someone's preferences: { allergens: ['Peanuts'], diets: ['Keto: carbs'], avoid: ['cilantro'] } */
export function conflicts(r, prefs = {}) {
  const text = ` ${r?.title || ''} ${(r?.ing || []).join(' ')} `.toLowerCase();
  const allergens = (prefs.allergies || []).filter((a) => ALLERGEN_RE[a] && has(text, ALLERGEN_RE[a]));
  const diets = (prefs.diets || []).flatMap((d) => { const bad = (DIET_RULES[d] || []).filter((k) => has(text, k)); return bad.length ? [`${d}: ${bad.map((k) => LABEL[k]).join(', ')}`] : []; });
  const avoid = (prefs.avoid || []).filter((w) => w && text.includes(String(w).toLowerCase().trim()));
  return { allergens, diets, avoid, any: allergens.length + diets.length + avoid.length > 0 };
}
export const prefsOf = (settings) => ({ diets: settings.diets || [], allergies: settings.allergies || [], avoid: String(settings.avoid || '').split(',').map((x) => x.trim()).filter(Boolean) });

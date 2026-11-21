// Meal preferences: diets and allergies. Matching is by ingredient names, so it can miss hidden
// ingredients — people with allergies should still read labels.
export const DIETS = ['Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Low-carb', 'Paleo', 'Whole30', 'Gluten-free', 'Dairy-free', 'Mediterranean', 'Halal', 'Kosher', 'High-protein'];
// health-related ways of eating (shown with a "not medical advice" note)
export const HEALTH_DIETS = ['Diabetes-friendly', 'Heart-healthy', 'Low-sodium', 'Low-FODMAP', 'Low-fat', 'Kidney-friendly', 'Pregnancy-safe'];
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
  refined: W('sugar|honey|maple syrup|agave|corn syrup|white rice|white bread|pasta|spaghetti|rigatoni|penne|noodle|bun|pancake|syrup|juice|cake|cookie|candy'),
  sodium: W('soy sauce|fish sauce|bouillon|stock cube|bacon|ham\\b|sausage|salami|pepperoni|prosciutto|chorizo|anchov|miso|pickle|olives|capers|cured'),
  satfat: W('bacon|sausage|butter|cream|lard|ghee|ham\\b|fried|deep.fry|salami|pepperoni|chorizo'),
  fodmap: W('onion|garlic|wheat|beans|lentil|chickpea|honey|apple|pear|mango|milk|cashew|pistachio|mushroom|cauliflower|asparagus'),
  pork: W('pork|bacon|ham\\b|lard|prosciutto|pepperoni|salami|chorizo|pancetta|gelatin'),
  alcohol: W('wine|beer|rum|vodka|bourbon|whiskey|brandy|sherry|mirin|sake|liqueur'),
  kidney: W('soy sauce|bouillon|bacon|ham\\b|sausage|banana|potato|tomato|spinach|avocado|beans|lentil|cheese|milk|yogurt|nuts?\\b|chocolate'),
  pregnancy: W('raw|rare|sushi|sashimi|brie|camembert|blue cheese|unpasteurized|swordfish|king mackerel|tilefish|liver|alcohol|wine|beer|runny|soft.boiled'),
  fat: W('butter|cream|oil|lard|ghee|bacon|sausage|cheese|fried|mayonnaise|avocado|coconut milk'),
};
const ALLERGEN_RE = { Peanuts: 'peanuts', 'Tree nuts': 'treeNuts', Dairy: 'dairy', Eggs: 'eggs', Fish: 'fish', Shellfish: 'shellfish', Soy: 'soy', 'Wheat / gluten': 'gluten', Sesame: 'sesame' };
const DIET_RULES = {
  Vegetarian: ['meat', 'fish', 'shellfish'], Vegan: ['meat', 'fish', 'shellfish', 'dairy', 'eggs', 'honey'], Pescatarian: ['meat'],
  Keto: ['carbs'], 'Low-carb': ['carbs'], Paleo: ['grains', 'legumes', 'dairy', 'sugar'], Whole30: ['grains', 'legumes', 'dairy', 'sugar'],
  'Gluten-free': ['gluten'], 'Dairy-free': ['dairy'], Mediterranean: [], 'High-protein': [],
  Halal: ['pork', 'alcohol'], Kosher: ['pork', 'shellfish'],
  'Diabetes-friendly': ['refined'], 'Heart-healthy': ['sodium', 'satfat'], 'Low-sodium': ['sodium'], 'Low-FODMAP': ['fodmap'], 'Low-fat': ['fat'],
  'Kidney-friendly': ['kidney'], 'Pregnancy-safe': ['pregnancy', 'alcohol'],
};
const LABEL = { meat: 'meat', fish: 'fish', shellfish: 'shellfish', dairy: 'dairy', eggs: 'eggs', honey: 'honey', carbs: 'carbs', grains: 'grains', legumes: 'beans/legumes', sugar: 'added sugar', gluten: 'gluten', refined: 'sugar or refined carbs', sodium: 'high-sodium ingredients', satfat: 'saturated fat', fodmap: 'high-FODMAP ingredients', pork: 'pork', alcohol: 'alcohol', kidney: 'high potassium/sodium/phosphorus foods', pregnancy: 'foods to check in pregnancy', fat: 'higher-fat ingredients' };

function has(text, key) {
  if (key === 'dairy') return RE.dairy.test(text.replace(new RegExp(RE.notDairy.source, 'gi'), ''));
  return RE[key].test(text);
}
/** What in a recipe clashes with someone's preferences: { allergens: ['Peanuts'], diets: ['Keto: carbs'], avoid: ['cilantro'] } */
export function conflicts(r, prefs = {}) {
  const text = ` ${r?.title || ''} ${(r?.ing || []).join(' ')} `.toLowerCase();
  const allergens = (prefs.allergies || []).filter((a) => ALLERGEN_RE[a] && has(text, ALLERGEN_RE[a]));
  const diets = (prefs.diets || []).flatMap((d) => { const bad = (DIET_RULES[d] || []).filter((k) => has(text, k)); if (d === 'Kosher' && has(text, 'meat') && has(text, 'dairy')) bad.push('meat with dairy'); return bad.length ? [`${d}: ${bad.map((k) => LABEL[k] || k).join(', ')}`] : []; });
  const avoid = (prefs.avoid || []).filter((w) => w && text.includes(String(w).toLowerCase().trim()));
  return { allergens, diets, avoid, any: allergens.length + diets.length + avoid.length > 0 };
}
export const prefsOf = (settings) => ({ diets: settings.diets || [], allergies: settings.allergies || [], avoid: String(settings.avoid || '').split(',').map((x) => x.trim()).filter(Boolean) });

// Estimated nutrition per serving, worked out from the ingredient list: each line's amount is turned into grams
// and matched to a small table of common foods (USDA-style values per 100 g). It's an estimate — brands,
// trimming and how much fat you drain all change the real numbers.

// [match, kcal, protein, carbs, fat (per 100 g), grams per "each", grams per cup]
// First match wins, so more specific names come first. kcal 0 = counts as known but adds nothing (spices, water).
const F = [
  // ---- broths & liquids (before meats)
  ['broth|stock|bouillon|dashi', 7, 1, 0.5, 0.2, 240, 240],
  ['light coconut milk', 75, 0.5, 1.5, 7, 400, 240],
  ['coconut milk', 197, 2, 3, 21, 400, 226],
  ['almond milk|oat milk|soy milk|rice milk|cashew milk|plant milk', 30, 1, 3, 1.5, 240, 240],
  ['heavy cream|whipping cream|double cream', 340, 2.8, 2.7, 36, 15, 238],
  ['half and half|half-and-half', 130, 3, 4.3, 11.5, 15, 242],
  ['sour cream|creme fraiche|crème fraîche', 198, 2.4, 4.6, 19, 15, 230],
  ['cream cheese', 342, 6, 4, 34, 28, 232],
  ['buttermilk', 40, 3.3, 4.8, 0.9, 245, 245],
  ['greek yogurt', 73, 10, 4, 2, 170, 245],
  ['yogurt|yoghurt', 61, 3.5, 4.7, 3.3, 170, 245],
  ['milk', 55, 3.3, 4.8, 2.5, 244, 244],
  ['coconut cream', 330, 3.6, 6.7, 35, 15, 240],
  // ---- nut butters & look-alikes before butter
  ['peanut butter', 588, 25, 20, 50, 16, 258],
  ['almond butter|cashew butter|nut butter|sunflower butter|seed butter', 614, 21, 19, 56, 16, 256],
  ['butternut', 45, 1, 12, 0.1, 1000, 140],
  ['butter beans?', 105, 7, 19, 0.4, 240, 170],
  ['butter lettuce|butterhead', 13, 1.4, 2.2, 0.2, 160, 55],
  ['butter|ghee', 717, 0.9, 0.1, 81, 14, 227],
  // ---- cheeses
  ['parmesan|parmigiano|pecorino|grana padano', 431, 38, 4, 29, 5, 100],
  ['mozzarella|burrata', 280, 28, 3, 17, 28, 113],
  ['feta', 265, 14, 4, 21, 28, 150],
  ['ricotta', 174, 11, 3, 13, 28, 246],
  ['cottage cheese', 98, 11, 3.4, 4.3, 28, 225],
  ['mascarpone', 429, 4.8, 4.8, 44, 28, 232],
  ['goat cheese|chevre', 364, 22, 2, 30, 28, 140],
  ['cheddar|monterey jack|pepper jack|colby|gruyere|swiss|gouda|provolone|havarti|cheese|queso', 390, 24, 2, 32, 28, 113],
  // ---- eggs
  ['egg whites?', 52, 11, 0.7, 0.2, 33, 243],
  ['egg yolks?', 322, 16, 3.6, 27, 17, 243],
  ['egg noodles?', 384, 14, 71, 4.4, 50, 38],
  ['mayonnaise|mayo|aioli', 680, 1, 0.6, 75, 14, 220],
  ['eggs?', 143, 12.6, 0.7, 9.5, 50, 243],
  // ---- meat & fish
  ['bacon|pancetta|guanciale', 417, 13, 1.4, 40, 25, 100],
  ['chicken breasts?', 120, 22.5, 0, 2.6, 200, 140],
  ['chicken thighs?|thighs?', 121, 19.7, 0, 4.1, 110, 140],
  ['chicken drumsticks?|chicken legs?', 160, 19, 0, 9, 110, 140],
  ['chicken wings?', 190, 18, 0, 13, 35, 140],
  ['ground chicken', 143, 17, 0, 8, 450, 225],
  ['rotisserie chicken|cooked chicken|shredded chicken', 190, 27, 0, 8, 900, 140],
  ['whole chicken|chicken', 170, 20, 0, 10, 200, 140],
  ['ground turkey', 150, 19, 0, 8, 450, 225],
  ['turkey', 114, 23, 0, 2, 450, 140],
  ['lean ground beef', 176, 20, 0, 10, 450, 225],
  ['ground beef|hamburger|ground chuck|minced beef|beef mince', 230, 18, 0, 17, 450, 225],
  ['brisket|short ribs?|oxtail', 250, 18, 0, 20, 450, 140],
  ['chuck|stew meat|beef stew', 190, 19, 0, 12, 450, 140],
  ['steak|sirloin|ribeye|flank|skirt|tenderloin|beef', 170, 21, 0, 9, 225, 140],
  ['ground pork', 263, 17, 0, 21, 450, 225],
  ['pork shoulder|pork butt|pork belly', 260, 16, 0, 22, 450, 140],
  ['pork chops?|pork loin|pork tenderloin|pork', 143, 21, 0, 6, 170, 140],
  ['italian sausage|sausage|bratwurst|kielbasa|hot dogs?', 300, 14, 2, 26, 85, 135],
  ['chorizo', 455, 24, 2, 38, 85, 135],
  ['ham|prosciutto', 145, 21, 1.5, 6, 28, 140],
  ['pepperoni|salami', 500, 22, 1, 44, 2, 130],
  ['ground lamb|lamb', 282, 17, 0, 23, 200, 140],
  ['salmon|trout|arctic char', 208, 20, 0, 13, 170, 140],
  ['canned tuna|tuna', 116, 26, 0, 1, 142, 154],
  ['shrimp|prawns?', 85, 20, 0, 0.5, 12, 145],
  ['scallops?', 69, 12, 3, 0.5, 30, 140],
  ['crab|lobster', 87, 18, 0, 1, 150, 135],
  ['mussels?|clams?', 86, 12, 4, 2, 15, 150],
  ['cod|tilapia|halibut|haddock|pollock|white fish|snapper|sea bass|mahi|catfish|fish', 90, 19, 0, 1, 150, 140],
  ['anchovy|anchovies', 210, 29, 0, 10, 4, 100],
  ['silken tofu', 55, 5, 2, 3, 400, 250],
  ['tofu', 144, 17, 3, 9, 400, 250],
  ['tempeh', 192, 20, 8, 11, 225, 166],
  // ---- sauces & condiments (before their base words)
  ['soy sauce|tamari|coconut aminos', 53, 8, 5, 0.6, 16, 255],
  ['fish sauce', 35, 5, 4, 0, 18, 290],
  ['oyster sauce|hoisin', 200, 3, 44, 1.5, 16, 280],
  ['teriyaki', 89, 6, 16, 0, 16, 288],
  ['worcestershire', 78, 0, 19, 0, 5, 275],
  ['sriracha|hot sauce|tabasco', 93, 2, 19, 1, 5, 250],
  ['bbq sauce|barbecue sauce', 172, 0.8, 41, 0.6, 17, 280],
  ['ketchup', 101, 1, 27, 0.1, 17, 240],
  ['mustard', 66, 4, 6, 4, 5, 250],
  ['pesto', 450, 5, 6, 45, 16, 240],
  ['curry paste|harissa|gochujang|chili paste', 150, 3, 20, 6, 15, 240],
  ['salsa', 36, 1.5, 7, 0.2, 16, 260],
  ['marinara|pasta sauce|spaghetti sauce', 50, 1.5, 8, 1.5, 125, 250],
  ['tomato paste', 82, 4.3, 19, 0.5, 16, 262],
  ['tomato sauce|tomato puree|passata', 30, 1.4, 6, 0.3, 245, 245],
  ['crushed tomatoes|diced tomatoes|canned tomatoes|whole tomatoes|plum tomatoes|san marzano', 25, 1.2, 5, 0.2, 400, 240],
  ['vinegar', 18, 0, 0.9, 0, 15, 240],
  ['balsamic', 88, 0.5, 17, 0, 16, 255],
  ['tahini', 595, 17, 21, 54, 15, 240],
  ['hummus', 166, 8, 14, 10, 15, 246],
  ['miso', 199, 12, 26, 6, 17, 275],
  ['honey', 304, 0.3, 82, 0, 21, 340],
  ['maple syrup|agave|corn syrup|molasses|syrup', 260, 0, 67, 0, 20, 315],
  ['jam|jelly|preserves', 250, 0.4, 65, 0.1, 20, 320],
  // ---- oils & fats
  ['olive oil|vegetable oil|canola oil|sesame oil|coconut oil|avocado oil|peanut oil|sunflower oil|grapeseed oil|oil|lard|shortening', 884, 0, 0, 100, 13.5, 216],
  // ---- grains & starches
  ['cauliflower rice|riced cauliflower', 25, 1.9, 5, 0.3, 340, 107],
  ['cooked rice|leftover rice|steamed rice', 130, 2.7, 28, 0.3, 158, 158],
  ['brown rice', 370, 7.9, 77, 2.9, 190, 190],
  ['rice noodles?|vermicelli|glass noodles?', 364, 6, 80, 0.6, 56, 90],
  ['rice', 365, 7.1, 80, 0.7, 185, 185],
  ['quinoa', 368, 14, 64, 6, 170, 170],
  ['couscous', 376, 13, 77, 0.6, 173, 173],
  ['oats|oatmeal|rolled oats', 389, 17, 66, 7, 40, 81],
  ['cooked pasta', 158, 5.8, 31, 0.9, 140, 140],
  ['pasta|spaghetti|penne|rigatoni|macaroni|linguine|fettuccine|fusilli|farfalle|orzo|lasagna|lasagne|noodles?|ramen|udon|soba', 371, 13, 75, 1.5, 56, 100],
  ['gnocchi', 133, 3, 28, 0.5, 450, 160],
  ['panko|breadcrumbs?|bread crumbs', 395, 13, 72, 5, 30, 100],
  ['almond flour', 571, 21, 21, 50, 28, 96],
  ['cornstarch|corn starch|arrowroot|tapioca', 381, 0.3, 91, 0, 8, 128],
  ['cornmeal|polenta|grits|masa', 370, 8, 79, 3.6, 30, 157],
  ['flour', 364, 10, 76, 1, 30, 125],
  ['corn tortillas?', 218, 5.7, 45, 2.9, 26, 100],
  ['tortillas?|wraps?', 300, 8, 50, 8, 45, 100],
  ['pita|naan|flatbread', 275, 9, 55, 1.2, 60, 100],
  ['buns?|rolls?|hamburger buns?|slider buns?|brioche', 280, 9, 50, 4.5, 55, 100],
  ['bread|baguette|sourdough|toast', 265, 9, 49, 3.2, 30, 45],
  ['crackers?', 430, 9, 70, 13, 5, 60],
  ['croutons?', 407, 12, 74, 6.6, 3, 30],
  // ---- sugar & sweet
  ['brown sugar', 380, 0, 98, 0, 4, 220],
  ['powdered sugar|confectioners', 389, 0, 100, 0, 4, 120],
  ['sugar', 387, 0, 100, 0, 4, 200],
  ['chocolate chips?|chocolate', 500, 5, 60, 28, 28, 168],
  ['cocoa', 228, 20, 58, 14, 5, 86],
  // ---- legumes
  ['green beans?|string beans?|haricots verts', 31, 1.8, 7, 0.2, 5, 110],
  ['snap peas|snow peas|sugar snap', 42, 2.8, 7.5, 0.2, 4, 98],
  ['chickpeas?|garbanzo', 150, 8, 24, 2.5, 240, 165],
  ['dry lentils|dried lentils', 352, 25, 63, 1, 192, 192],
  ['lentils?', 116, 9, 20, 0.4, 198, 198],
  ['edamame', 121, 12, 9, 5, 155, 155],
  ['beans?', 120, 7.5, 21, 0.5, 240, 172],
  ['peas', 81, 5.4, 14, 0.4, 145, 145],
  // ---- nuts & seeds
  ['peanuts?', 567, 26, 16, 49, 1, 146],
  ['pepitas|pumpkin seeds|sunflower seeds|hemp seeds|seeds', 560, 30, 11, 49, 1, 129],
  ['sesame seeds?', 573, 18, 23, 50, 1, 144],
  ['chia|flax|flaxseed', 500, 18, 35, 33, 1, 160],
  ['almonds?|walnuts?|pecans?|cashews?|pistachios?|hazelnuts?|macadamia|pine nuts?|nuts', 610, 17, 18, 54, 1.2, 125],
  ['coconut flakes|shredded coconut|coconut', 660, 6.9, 24, 65, 5, 93],
  // ---- vegetables
  ['sweet potato(es)?|yams?', 86, 1.6, 20, 0.1, 130, 133],
  ['potato(es)?|yukon|russets?|fingerling', 77, 2, 17, 0.1, 213, 150],
  ['butternut squash|squash|pumpkin', 45, 1, 12, 0.1, 1000, 140],
  ['corn', 86, 3.3, 19, 1.4, 100, 154],
  ['avocados?', 160, 2, 8.5, 14.7, 150, 150],
  ['olives', 115, 0.8, 6, 11, 4, 135],
  ['green onions?|scallions?|spring onions?|chives', 32, 1.8, 7.3, 0.2, 15, 100],
  ['shallots?', 72, 2.5, 17, 0.1, 40, 160],
  ['onions?|leeks?', 40, 1.1, 9.3, 0.1, 110, 160],
  ['garlic', 149, 6.4, 33, 0.5, 4, 136],
  ['ginger', 80, 1.8, 18, 0.8, 15, 96],
  ['jalape[nñ]os?|serranos?|chil(e|i|li)e?s?|poblanos?|habaneros?', 30, 1, 6.5, 0.4, 14, 150],
  ['bell peppers?|red peppers?|green peppers?|yellow peppers?|peppers?', 26, 1, 6, 0.3, 120, 150],
  ['cherry tomato(es)?|grape tomato(es)?', 18, 0.9, 3.9, 0.2, 17, 150],
  ['tomato(es)?', 18, 0.9, 3.9, 0.2, 123, 180],
  ['carrots?', 41, 0.9, 10, 0.2, 61, 128],
  ['celery', 16, 0.7, 3, 0.2, 40, 101],
  ['baby spinach|spinach', 23, 2.9, 3.6, 0.4, 340, 30],
  ['kale|lacinato|collards?|chard|greens', 35, 2.9, 4.4, 1.5, 200, 25],
  ['arugula|lettuce|romaine|salad|mixed greens|spring mix', 15, 1.4, 2.9, 0.2, 300, 47],
  ['broccoli|broccolini', 34, 2.8, 7, 0.4, 600, 91],
  ['cauliflower', 25, 1.9, 5, 0.3, 575, 107],
  ['brussels sprouts?', 43, 3.4, 9, 0.3, 19, 88],
  ['zucchini|courgettes?|summer squash', 17, 1.2, 3.1, 0.3, 196, 124],
  ['eggplants?|aubergines?', 25, 1, 6, 0.2, 450, 82],
  ['mushrooms?|cremini|portobello|shiitake', 22, 3.1, 3.3, 0.3, 18, 70],
  ['cabbage|coleslaw mix|slaw', 25, 1.3, 6, 0.1, 900, 89],
  ['cucumbers?', 15, 0.7, 3.6, 0.1, 300, 120],
  ['fennel( bulbs?)?', 31, 1.2, 7, 0.2, 234, 87],
  ['asparagus', 20, 2.2, 3.9, 0.1, 16, 134],
  ['bok choy|pak choi', 13, 1.5, 2.2, 0.2, 400, 70],
  ['radish(es)?|turnips?|beets?|parsnips?', 40, 1.2, 9, 0.2, 80, 130],
  ['parsley|cilantro|basil|mint|dill|tarragon|herbs|fresh sage|fresh thyme|sprigs?', 36, 3, 6, 0.8, 1, 30],
  ['capers', 23, 2.4, 4.9, 0.9, 1, 136],
  ['pickles?', 12, 0.3, 2.3, 0.2, 35, 150],
  ['kimchi|sauerkraut', 19, 1, 4, 0.4, 150, 150],
  // ---- fruit
  ['lemon juice|lime juice', 22, 0.4, 7, 0.2, 30, 244],
  ['lemons?|limes?', 29, 1.1, 9, 0.3, 58, 212],
  ['orange juice|apple juice|apple cider|cider|juice', 45, 0.7, 10, 0.2, 240, 248],
  ['oranges?', 47, 0.9, 12, 0.1, 131, 180],
  ['apples?', 52, 0.3, 14, 0.2, 182, 125],
  ['bananas?', 89, 1.1, 23, 0.3, 118, 150],
  ['berries|blueberries|strawberries|raspberries|blackberries', 50, 0.7, 12, 0.3, 5, 148],
  ['raisins|dried cranberries|dates', 299, 3, 79, 0.5, 8, 145],
  ['mango(es)?|pineapple|peach(es)?|pears?|grapes', 60, 0.6, 15, 0.2, 165, 165],
  // ---- drinks used in cooking
  ['wine|sherry|mirin|sake', 83, 0.1, 2.6, 0, 150, 236],
  ['beer', 43, 0.5, 3.6, 0, 355, 240],
  // ---- zero / negligible (last, so 'vanilla yogurt' or 'chili' still count as food)
  ['water|ice|salt|kosher salt|sea salt|black pepper|white pepper|peppercorns?|pepper flakes|red pepper flakes|chili flakes|cayenne|paprika|smoked paprika|cumin|coriander|turmeric|oregano|thyme|rosemary|sage|bay leaf|bay leaves|cinnamon|nutmeg|cloves? \\(ground\\)|ground cloves|allspice|cardamom|garlic powder|onion powder|chili powder|curry powder|garam masala|italian seasoning|herbes de provence|five spice|mustard seed|fennel seed|celery seed|dill weed|baking soda|baking powder|yeast|vanilla|extract|food coloring|cream of tartar|saffron|sumac|za.?atar|seasoning|spice|msg|gelatin|cooking spray|nonstick spray|zest', 0, 0, 0, 0, 2, 100],
];
const FOODS = F.map(([m, kcal, p, c, f, each, cup]) => ({ re: new RegExp(`(^|[^\\w-])(${m})(?![\\w-])`, 'i'), kcal, p, c, f, each, cup }));
const findFood = (name) => FOODS.find((x) => x.re.test(name));

// ---- amounts
const FRAC = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
function num(s) {
  s = s.replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, (c) => ` ${FRAC[c]}`).trim();
  let t = 0;
  for (const part of s.split(/\s+/)) {
    if (/^\d+\/\d+$/.test(part)) { const [a, b] = part.split('/'); t += Number(a) / Number(b); } else if (!isNaN(Number(part))) t += Number(part);
  }
  return t;
}
const NUM = '(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.?\\d+\\s*[½⅓⅔¼¾⅛⅜⅝⅞]?|[½⅓⅔¼¾⅛⅜⅝⅞])';
// grams per unit (weight), or "cup:x" (fraction of a cup → uses the food's cup weight), or "each:x"
const UNITS = [
  [/^(kg|kilograms?)\b/, 'g', 1000], [/^(g|grams?|gr)\b/, 'g', 1], [/^(mg)\b/, 'g', 0.001],
  [/^(lbs?|pounds?)\b/, 'g', 453.6], [/^(oz|ounces?)\b/, 'g', 28.35],
  [/^(cups?|c\.)\b/, 'cup', 1], [/^(tablespoons?|tbsps?|tbls?|tblsp|tbs|T)\b/, 'cup', 1 / 16], [/^(teaspoons?|tsps?|t)\b/, 'cup', 1 / 48],
  [/^(ml|milliliters?|millilitres?)\b/, 'cup', 1 / 240], [/^(l|liters?|litres?)\b/, 'cup', 1000 / 240], [/^(fl\.? ?oz|fluid ounces?)\b/, 'cup', 1 / 8],
  [/^(pints?)\b/, 'cup', 2], [/^(quarts?|qt)\b/, 'cup', 4],
  [/^(pinch(es)?|dash(es)?|sprinkle)\b/, 'cup', 1 / 384],
  [/^(cans?|tins?)\b/, 'can', 1], [/^(jars?)\b/, 'g', 450], [/^(packages?|packs?|pkgs?|bags?|boxes?|cartons?)\b/, 'pack', 1],
  [/^(sticks?)\b/, 'g', 113], [/^(slices?|rashers?|strips?)\b/, 'slice', 1], [/^(cloves?)\b/, 'g', 4],
  [/^(bunch(es)?|heads?)\b/, 'each', 1], [/^(handfuls?)\b/, 'cup', 0.5], [/^(sprigs?)\b/, 'g', 1], [/^(stalks?|ribs?)\b/, 'g', 40],
  [/^(fillets?|filets?|breasts?|thighs?|pieces?|large|medium|small|whole|ears?|links?)\b/, 'each', 1],
];
/** One ingredient line → grams (or null when there's no amount to go on). */
function parseLine(line) {
  let s = String(line).toLowerCase().replace(/^(a|an|one)\s+(?=[a-z])/, '1 ').replace(/^(half( of)?( the)?|½ of)\s+/, '0.5 ').replace(/^two\s+/, '2 ').replace(/^three\s+/, '3 ').replace(/\(.*?\)/g, (m) => (/\d/.test(m) && /oz|g\b|ml|lb/.test(m) ? m : ' ')).replace(/\s+/g, ' ').trim();
  // "Chicken Thighs 8" / "Rice 2 cups" (TheMealDB order) → move the amount to the front
  const tail = s.match(new RegExp(`^([a-z][a-z \\-'&]+?)\\s+${NUM}\\s*(.*)$`));
  if (tail && !/^\d/.test(s)) s = `${tail[2]} ${tail[3]} ${tail[1]}`.trim();
  const m = s.match(new RegExp(`^${NUM}(\\s*(-|–|—|to)\\s*${NUM})?\\s*`));
  let qty = m ? num(m[1]) : 0;
  if (m && m[4]) qty = (qty + num(m[4])) / 2; // "2-3 cloves" → 2.5
  let rest = m ? s.slice(m[0].length) : s;
  // a size in brackets/words: "1 (15 oz) can black beans", "2 14.5-oz cans"
  const size = rest.match(/^\(?\s*(?:about|approx\.?|~)?\s*(\d*\.?\d+)\s*-?\s*(oz|ounce|g|gram|ml|lb)s?\.?\s*\)?\s*/);
  let sizeG = 0;
  if (size) { sizeG = Number(size[1]) * ({ oz: 28.35, ounce: 28.35, g: 1, gram: 1, ml: 1, lb: 453.6 })[size[2]]; rest = rest.slice(size[0].length); }
  rest = rest.replace(/^(of|x)\s+/, '');
  let unit = null, factor = 1;
  const glued = rest.match(/^(g|kg|ml|oz|lb)\b/) || (m && /^\d/.test(s) && s.match(new RegExp(`^${NUM}(g|kg|ml|l|oz|lbs?)\\b`)));
  for (const [re, u, f] of UNITS) { const um = rest.match(re); if (um) { unit = u; factor = f; rest = rest.slice(um[0].length).replace(/^\.?\s*(of\s+)?/, ''); break; } }
  if (!unit && glued && glued[2]) { const g = UNITS.find(([re]) => re.test(glued[2])); if (g) { unit = g[1]; factor = g[2]; } }
  return { qty, unit, factor, sizeG, name: rest.replace(/^[,\s]+/, '') || s };
}
function gramsFor(p, food) {
  const q = p.qty || 1; // "Salt to taste", "1 onion" with the number missing → one of it
  if (p.unit === 'g') return q * p.factor;
  if (p.unit === 'cup') return q * p.factor * food.cup;
  if (p.unit === 'can') return q * (p.sizeG || 400) * (food.kcal > 60 && food.kcal < 200 && food.c > 10 ? 0.6 : 1); // drained beans ≈ 60% of the can
  if (p.unit === 'pack') return q * (p.sizeG || Math.max(food.each, 300));
  if (p.unit === 'slice') return q * (food.each <= 60 ? food.each : 28);
  if (p.sizeG) return q * p.sizeG;
  return q * food.each;
}
const round = (x) => Math.round(x);
const cache = new WeakMap();
/**
 * Per-serving estimate for a recipe: { kcal, protein, carbs, fat, ok, known, total }.
 * ok = enough of the ingredients were recognised to trust it (and the result looks like a meal).
 */
export function nutritionOf(r) {
  if (!r) return null;
  if (typeof r === 'object' && cache.has(r) && cache.get(r).key === (r.ing || []).join('|') + r.servings) return cache.get(r).v;
  // "Rub: 2 tsp salt, 1 Tbsp brown sugar" / "1 fennel bulb + 1 apple" → one entry each
  const ing = (r.ing || []).filter((x) => x && !/:\s*$/.test(String(x).trim()))
    .flatMap((x) => String(x).replace(/^[^:]{1,24}:\s*/, '').split(/\s*(?:[,;+]|\band\b)\s*(?=[\d½⅓⅔¼¾⅛])/)).map((x) => x.trim()).filter(Boolean);
  let kcal = 0, p = 0, c = 0, f = 0, known = 0;
  for (const line of ing) {
    const parsed = parseLine(line);
    const food = findFood(parsed.name) || findFood(String(line).toLowerCase());
    if (!food) continue;
    known++;
    if (!food.kcal) continue;
    const g = gramsFor(parsed, food) / 100;
    kcal += food.kcal * g; p += food.p * g; c += food.c * g; f += food.f * g;
  }
  const serv = Number(r.servings) || 4;
  const v = { kcal: round(kcal / serv), protein: round(p / serv), carbs: round(c / serv), fat: round(f / serv), known, total: ing.length };
  v.ok = ing.length > 0 && known / ing.length >= 0.6 && v.kcal >= 60 && v.kcal <= 2500;
  if (typeof r === 'object') cache.set(r, { key: (r.ing || []).join('|') + r.servings, v });
  return v;
}
/** Calories for a recipe: the source's own number when it gave one, else the estimate. */
export const caloriesOf = (r) => Number(r?.calories) || (nutritionOf(r)?.ok ? nutritionOf(r).kcal : 0);

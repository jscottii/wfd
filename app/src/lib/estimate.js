// Typical US grocery prices (late 2026, mid-priced supermarket), for items nobody has priced yet.
// [match, price for the usual package, the package] — first match wins, so specific names come first.
// Real prices (receipts, what you type, live lookups) always replace these.
const P = [
  // meat & fish
  ['ground beef|minced beef|beef mince|hamburger', 6.49, '1 lb'], ['ground turkey|turkey mince', 5.49, '1 lb'], ['ground pork|pork mince', 4.99, '1 lb'],
  ['ground chicken', 5.49, '1 lb'], ['ground lamb|lamb mince', 9.99, '1 lb'],
  ['chicken breasts?', 4.49, '1 lb'], ['chicken thighs?|thighs', 3.49, '1 lb'], ['chicken wings?', 4.29, '1 lb'], ['chicken drumsticks?|chicken legs?', 2.29, '1 lb'],
  ['whole chicken', 9.99, 'about 4 lb'], ['rotisserie chicken', 6.99, 'each'], ['chicken', 3.99, '1 lb'],
  ['bacon|pancetta', 6.99, '12 oz'], ['italian sausage|sausages?|bratwurst|kielbasa|chorizo', 5.99, '1 lb'], ['hot dogs?', 4.49, '8 ct'],
  ['ham|prosciutto', 5.99, '8 oz'], ['pepperoni|salami', 4.99, '6 oz'],
  ['steak|sirloin|ribeye|flank|skirt|tenderloin', 11.99, '1 lb'], ['brisket|short ribs?|chuck|stew meat|beef', 8.99, '1 lb'],
  ['pork belly', 6.99, '1 lb'], ['pork shoulder|pork butt', 3.49, '1 lb'], ['pork chops?|pork loin|pork tenderloin|pork', 4.49, '1 lb'],
  ['lamb|goat', 10.99, '1 lb'], ['turkey', 4.99, '1 lb'],
  ['salmon|trout', 11.99, '1 lb'], ['shrimp|prawns?', 10.99, '1 lb'], ['scallops?', 19.99, '1 lb'], ['crab|lobster', 19.99, '8 oz'],
  ['canned tuna|tuna', 1.79, '5 oz can'], ['cod|tilapia|halibut|haddock|pollock|white fish|snapper|sea bass|fish', 8.99, '1 lb'],
  ['anchov(y|ies)', 3.49, '2 oz tin'], ['dried shrimp', 6.99, '4 oz'],
  ['silken tofu|tofu', 2.49, '14 oz'], ['tempeh', 3.99, '8 oz'],
  // dairy & eggs
  ['eggs?', 3.99, 'dozen'], ['butter|ghee', 4.99, '1 lb'], ['heavy cream|whipping cream|double cream|single cream|cream', 4.49, 'pint'],
  ['half and half', 3.29, 'pint'], ['sour cream|creme fraiche', 2.49, '16 oz'], ['cream cheese', 2.99, '8 oz'],
  ['greek yogurt', 5.99, '32 oz'], ['yogurt|yoghurt', 3.99, '32 oz'], ['buttermilk', 2.99, 'quart'],
  ['almond milk|oat milk|soy milk|coconut milk beverage', 3.99, 'half gallon'], ['milk', 4.29, 'gallon'],
  ['parmesan|parmigiano|pecorino', 5.99, '8 oz'], ['mozzarella|burrata', 4.49, '8 oz'], ['feta', 4.49, '6 oz'], ['ricotta', 4.29, '15 oz'],
  ['goat cheese', 4.99, '4 oz'], ['cottage cheese', 3.99, '16 oz'], ['cheese curds', 5.99, '12 oz'],
  ['cheddar|monterey jack|pepper jack|colby|swiss|gouda|provolone|gruyere|cheese', 4.49, '8 oz'],
  // produce (spices that share a word with produce go first)
  ['black pepper|white pepper|peppercorns?|pepper flakes|sichuan pepper|cayenne|coriander seeds?|ground coriander|bay leaf|bay leaves|cloves \\(ground\\)|ground cloves', 3.99, 'jar'],
  ['potato(es)?|yukon|russet', 4.99, '5 lb bag'], ['sweet potato(es)?|yams?', 1.49, 'lb'], ['onions?|shallots?', 1.29, 'lb'],
  ['green onions?|spring onions?|scallions?|chives', 1.29, 'bunch'], ['garlic', 0.79, 'head'], ['ginger|galangal', 0.99, '4 oz piece'],
  ['lemongrass', 2.99, 'pack'], ['lime leaves|makrut', 3.49, 'pack'],
  ['carrots?', 1.49, '2 lb bag'], ['celery', 2.29, 'bunch'], ['bell peppers?|red peppers?|romano peppers?|peppers?', 1.49, 'each'],
  ['jalape[nñ]os?|serranos?|chil(l)?i(es)?|chiles?', 0.25, 'each'], ['cherry tomato|grape tomato', 3.99, 'pint'], ['tomato(es)?', 2.49, 'lb'],
  ['baby spinach|spinach', 3.99, '5 oz bag'], ['kale|collard|chard|greens', 2.49, 'bunch'], ['arugula|lettuce|romaine|mixed greens|salad', 3.99, 'bag'],
  ['broccoli', 2.49, 'head'], ['cauliflower', 3.49, 'head'], ['brussels', 3.99, 'lb'], ['zucchini|courgette|summer squash', 1.69, 'lb'],
  ['eggplants?|aubergines?|egg plants?', 1.99, 'each'], ['mushrooms?', 3.49, '8 oz'], ['napa cabbage|bok choy|pak choi|cabbage|coleslaw', 2.49, 'head'],
  ['cucumbers?', 0.99, 'each'], ['avocados?', 1.29, 'each'], ['butternut|squash|pumpkin', 3.99, 'each'], ['corn|sweetcorn', 0.69, 'ear'],
  ['green beans|long beans|string beans', 2.99, 'lb'], ['peas|snap peas|snow peas', 2.49, '12 oz'], ['asparagus', 3.99, 'bunch'],
  ['bean sprouts', 1.99, '12 oz'], ['fennel', 2.49, 'bulb'], ['beets?|turnips?|radish|parsnips?|daikon', 1.99, 'lb'], ['leeks?', 1.99, 'each'],
  ['parsley|cilantro|coriander leaves|coriander|basil|mint|dill|thyme|rosemary|sage|herbs?', 1.99, 'bunch'],
  ['lemons?', 0.79, 'each'], ['limes?', 0.50, 'each'], ['oranges?', 0.99, 'each'], ['apples?', 1.99, 'lb'], ['pears?', 1.99, 'lb'],
  ['bananas?', 0.69, 'lb'], ['berries|strawberries|blueberries|raspberries|blackberries', 3.99, 'pack'], ['mango(es)?', 1.29, 'each'],
  ['pineapple', 2.99, 'each'], ['grapes', 3.49, 'lb'], ['raisins|dried cranberries|dates', 3.99, '6 oz'],
  // pantry
  ['jasmine rice|basmati rice|sushi rice|brown rice|rice', 3.99, '2 lb bag'], ['rice noodles?|vermicelli|glass noodles?', 2.99, '14 oz'],
  ['egg noodles?|udon|ramen|soba|noodles?', 2.49, '1 lb'], ['pasta|spaghetti|penne|rigatoni|macaroni|linguine|fettuccine|orzo|lasagna', 1.79, '1 lb'],
  ['quinoa', 4.99, '1 lb'], ['couscous', 2.99, '10 oz'], ['oats|oatmeal', 3.99, '42 oz'], ['farro|barley|bulgur', 3.99, '1 lb'],
  ['flour', 3.99, '5 lb'], ['cornmeal|polenta|masa|corn flour', 3.49, '2 lb'], ['cornstarch|corn starch|potato starch|starch', 2.49, '16 oz'],
  ['breadcrumbs|panko|bread crumbs', 2.49, '8 oz'], ['brown sugar|muscovado', 2.99, '2 lb'], ['powdered sugar|icing sugar', 2.99, '2 lb'],
  ['sugar|caster sugar|rock sugar', 3.99, '4 lb'], ['honey', 5.99, '12 oz'], ['maple syrup', 7.99, '12 oz'],
  ['chocolate chips|chocolate', 3.99, '12 oz'], ['cocoa', 3.99, '8 oz'],
  ['olive oil', 9.99, '17 oz'], ['sesame oil|sesame seed oil', 4.99, '5 oz'], ['vegetable oil|canola oil|sunflower oil|peanut oil|oil', 4.49, '48 oz'],
  ['soy sauce|tamari', 3.49, '15 oz'], ['fish sauce', 3.99, '7 oz'], ['oyster sauce|hoisin', 3.49, '9 oz'], ['shaoxing|rice wine|mirin|sake', 4.49, 'bottle'],
  ['vinegar', 2.99, '16 oz'], ['sriracha|hot sauce|chilli bean|doubanjiang|gochujang|chili paste|sambal', 3.99, 'jar'],
  ['curry paste', 3.49, '4 oz jar'], ['tomato paste|tomato puree', 1.29, '6 oz can'], ['tomato sauce|passata|marinara|pasta sauce', 3.49, '24 oz jar'],
  ['diced tomatoes|crushed tomatoes|canned tomatoes|plum tomatoes', 1.79, '28 oz can'], ['coconut milk|coconut cream', 2.49, '13.5 oz can'],
  ['broth|stock|bouillon', 2.99, '32 oz carton'], ['gravy', 2.49, 'can'],
  ['black beans|kidney beans|pinto beans|cannellini|white beans|chickpeas|garbanzo|beans|split peas|lentils', 1.29, '15 oz can'],
  ['peanut butter|almond butter|tahini|sesame sauce|sesame paste', 4.49, 'jar'],
  ['almonds|walnuts|pecans|cashews|pistachios|pine nuts|peanuts|nuts', 6.99, '8 oz'], ['sesame seeds|pepitas|seeds', 3.99, '4 oz'],
  ['mayonnaise|mayo', 4.49, '30 oz'], ['ketchup', 3.49, '20 oz'], ['mustard|dijon', 2.49, '8 oz'], ['pesto', 4.99, '6 oz'], ['salsa', 3.99, '16 oz'],
  ['olives|capers|pickles', 3.99, 'jar'], ['kimchi', 6.99, 'jar'],
  ['bread|baguette|sourdough|loaf', 3.99, 'loaf'], ['buns?|rolls?', 3.99, '8 ct'], ['corn tortillas?', 2.49, '30 ct'], ['tortillas?|wraps?', 3.49, '10 ct'],
  ['naan|pita|flatbread', 3.49, 'pack'], ['wonton|dumpling wrappers|gyoza', 2.99, 'pack'], ['puff pastry|pie crust|shortcrust|pastry', 4.99, 'pack'],
  ['graham|digestive|crackers?|biscuits', 3.99, 'box'],
  ['frozen|stir.?fry vegetables|mixed vegetables', 2.99, '12 oz bag'],
  ['vanilla', 6.99, '2 oz bottle'], ['baking powder|baking soda|yeast', 2.49, 'container'],
  ['cumin|paprika|curry powder|garam masala|turmeric|cinnamon|nutmeg|oregano|chili powder|five spice|star anise|cardamom|cloves|bay|pepper|allspice|coriander seed|fennel seed|sichuan|spice|seasoning|pul biber', 3.99, 'jar'],
  ['salt', 1.99, 'box'],
];
const TABLE = P.map(([m, price, pack]) => ({ re: new RegExp(`(^|[^a-z])(${m})(?![a-z])`, 'i'), price, pack }));

/** Typical price for one package of an item, or null when nothing matches. */
export function estimateFor(name) {
  const n = String(name || '').toLowerCase();
  const hit = TABLE.find((x) => x.re.test(n));
  return hit ? { price: hit.price, pack: hit.pack } : null;
}

// How a chain's prices usually compare with a typical supermarket
const CHAINS = [
  [/costco|sam'?s club|bj'?s/i, 0.8], [/grocery outlet|aldi|winco|lidl|food ?4 ?less|smart ?& ?final/i, 0.78],
  [/walmart/i, 0.88], [/trader joe/i, 0.9], [/target/i, 0.95], [/kroger|ralphs|fred meyer|king soopers|fry'?s|smith'?s|h-?e-?b|meijer|food lion|stater/i, 0.95],
  [/lucky|save mart|foodmaxx|99 ranch|h ?mart|mitsuwa|asian|mexican|carniceria|vallarta|cardenas/i, 0.97],
  [/safeway|vons|albertsons|pavilions|jewel|acme|shaw'?s|tom thumb|randalls|raley'?s|bel ?air|nob hill|publix|giant|stop.?shop|wegmans/i, 1.1],
  [/sprouts|natural grocers/i, 1.12], [/whole foods|erewhon|bristol farms|gelson|andronico|mollie stone|draeger/i, 1.3],
];
export function chainFactor(store) {
  const name = `${store?.short || ''} ${store?.name || ''}`;
  return (CHAINS.find(([re]) => re.test(name)) || [null, 1])[1];
}

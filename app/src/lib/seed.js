// Seed data (from the original Apps Script version)
/**
 * Data.gs — seed data: stores, shopping list, recipes, timeline, week plan.
 * Edit the Google Sheet (not this file) after setup; this only seeds it.
 */

var HOME_DEFAULT = '';

/** id, name, address used for routing, auto price source, links */
var STORES_SEED = [
  { id: 'sbf',    name: "Safeway",   short: "Safeway", address: "",          source: 'serpapi', serpMerchant: 'Safeway',        hours: '', ad: 'https://www.safeway.com/weeklyad', enabled: true },
  { id: 'tj',     name: "Trader Joe's",     short: "Trader Joe's",       address: "",  source: 'traderjoes',                              hours: '',      ad: 'https://www.traderjoes.com/home/products', enabled: true },
  { id: 'tgt',    name: "Target",       short: "Target",             address: "",            source: 'target',                                  hours: '',     ad: 'https://www.target.com/weekly-ad', enabled: true },
  { id: 'go',     name: "Grocery Outlet",       short: "Grocery Outlet",     address: "",      source: 'manual',                                  hours: '',      ad: 'https://www.groceryoutlet.com/circulars', enabled: false },
  { id: 'costco', name: "Costco",           short: "Costco",             address: "",        source: 'manual',                                  hours: '',  ad: 'https://www.costco.com/warehouse-locations', enabled: false, bulk: true }
];

/**
 * Shopping list.
 * q      = search phrase sent to store sites
 * must   = words that must appear in a matched product title (lowercase)
 * units  = how many store units to buy (multiplies the unit price)
 * est    = fallback estimate for the needed quantity (USD) when no live price
 *          costco values are [packPrice, packNote, perNeededQtyPrice]
 */
var ITEMS_SEED = [
  ['pears','Produce','Pears','5','Yogurt jars','bartlett pear',['pear'],5,{sbf:6.20,tj:3.95,lucky:4.95,go:3.99,tgt:5.50,raleys:6.50}],
  ['squash','Produce','Butternut squash','~4 lb (1 large / 2 medium)','Farro bowl, rigatoni','butternut squash',['butternut'],2,{sbf:7.96,tj:5.98,lucky:5.16,go:4.50,tgt:5.96,raleys:7.96}],
  ['kale','Produce','Lacinato kale','1 bunch','Farro bowl','lacinato kale',['kale'],1,{sbf:2.99,tj:1.99,lucky:2.49,go:1.99,tgt:2.79,raleys:2.99}],
  ['fennel','Produce','Fennel bulb','1 large','Chicken','fennel bulb',['fennel'],1,{sbf:3.49,tj:2.49,lucky:2.99,raleys:3.49}],
  ['apples','Produce','Apples','3','Chicken, slaw','honeycrisp apple',['apple'],3,{sbf:3.75,tj:2.07,lucky:2.99,go:2.49,tgt:3.29,raleys:3.99}],
  ['potatoes','Produce','Yukon Gold potatoes','3 lb','Mash','yukon gold potatoes 3 lb',['yukon'],1,{sbf:4.99,tj:3.49,lucky:3.99,go:2.99,tgt:3.79,raleys:4.99}],
  ['cabbage','Produce','Coleslaw mix (or small cabbage)','14 oz','Slaw','coleslaw mix',['slaw'],1,{sbf:2.49,tj:1.99,lucky:1.99,go:1.49,tgt:1.99,raleys:2.49}],
  ['spinach','Produce','Baby spinach','5 oz','Rigatoni','baby spinach',['spinach'],1,{sbf:3.99,tj:2.29,lucky:2.99,go:1.99,tgt:2.69,raleys:3.99}],
  ['lemons','Produce','Lemons','3','Dressing, compote','lemon',['lemon'],3,{sbf:2.97,tj:1.98,lucky:2.37,go:1.99,tgt:2.49,raleys:2.97}],
  ['herbs','Produce','Fresh sage, thyme & parsley','1 each','Chicken, rigatoni, farro','fresh sage',['sage'],3,{sbf:7.47,tj:5.67,lucky:5.97,tgt:6.27,raleys:7.47}],
  ['chicken','Meat','Boneless skinless chicken thighs','~3 lb','Pulled chicken','boneless skinless chicken thighs',['thigh','boneless'],1,{sbf:14.97,tj:13.47,lucky:11.97,go:9.99,tgt:12.87,raleys:16.47,costco:[22.00,'~5.5 lb pack',11.97]}],
  ['sausage','Meat','Mild Italian sausage','1 lb','Rigatoni','mild italian sausage',['italian','sausage'],1,{sbf:6.99,tj:4.99,lucky:5.49,go:4.49,tgt:4.99,raleys:6.99}],
  ['bacon','Meat','Thick-cut bacon','12 oz','Pancake bake','thick cut bacon',['bacon'],1,{sbf:7.99,tj:5.99,lucky:6.49,go:4.99,tgt:5.99,raleys:7.99,costco:[17.99,'4 lb',4.50]}],
  ['yogurt','Dairy & Eggs','Plain Greek yogurt','32 oz','Yogurt jars','plain greek yogurt 32 oz',['greek','yogurt'],1,{sbf:6.49,tj:5.49,lucky:5.49,go:3.99,tgt:4.49,raleys:6.49,costco:[6.49,'48 oz tub',4.33]}],
  ['eggs','Dairy & Eggs','Large eggs','1 dozen','Pancake bake','large eggs dozen',['egg'],1,{sbf:4.99,tj:3.79,lucky:3.99,go:3.49,tgt:3.69,raleys:5.29,costco:[7.99,'2 dozen',4.00]}],
  ['milk','Dairy & Eggs','Whole milk','½ gallon','Pancake bake, mash','whole milk half gallon',['milk'],1,{sbf:3.49,tj:2.99,lucky:2.99,go:2.79,tgt:2.79,raleys:3.49}],
  ['cheddar','Dairy & Eggs','Sharp cheddar','8 oz','Pancake bake','sharp cheddar cheese 8 oz',['cheddar'],1,{sbf:4.49,tj:3.49,lucky:3.49,go:2.99,tgt:2.99,raleys:4.49,costco:[10.99,'2 lb block',2.75]}],
  ['feta','Dairy & Eggs','Feta','4 oz','Farro bowl','feta cheese crumbles',['feta'],1,{sbf:4.29,tj:3.49,lucky:3.99,go:2.99,tgt:3.29,raleys:4.49}],
  ['mozz','Dairy & Eggs','Low-moisture mozzarella','8 oz','Rigatoni','low moisture mozzarella 8 oz',['mozzarella'],1,{sbf:4.29,tj:3.49,lucky:3.49,go:2.99,tgt:2.79,raleys:4.49}],
  ['parm','Dairy & Eggs','Parmesan wedge','4 oz','Rigatoni','parmesan wedge',['parm'],1,{sbf:5.99,tj:3.99,lucky:5.49,go:3.99,tgt:4.49,raleys:6.49,costco:[17.99,'~1.5 lb',3.00]}],
  ['cream','Dairy & Eggs','Heavy cream','1 pint','Rigatoni','heavy whipping cream pint',['cream'],1,{sbf:5.49,tj:3.99,lucky:4.49,go:3.49,tgt:3.99,raleys:5.49}],
  ['butter','Dairy & Eggs','Unsalted butter','1 lb','Pancake bake, compote, mash','unsalted butter 1 lb',['unsalted','butter'],1,{sbf:5.99,tj:4.49,lucky:4.99,go:3.99,tgt:4.29,raleys:5.99,costco:[14.99,'4 lb',3.75]}],
  ['farro','Pantry','Farro','1 cup dry','Farro bowl','farro',['farro'],1,{sbf:5.99,tj:2.99,lucky:4.99,tgt:4.29,raleys:5.99}],
  ['beans','Pantry','Cannellini beans','2 × 15 oz cans','Farro bowl','cannellini beans',['cannellini'],2,{sbf:3.98,tj:2.58,lucky:2.98,go:2.00,tgt:2.18,raleys:4.38}],
  ['tahini','Pantry','Tahini','1 jar','Lemon-tahini dressing','tahini',['tahini'],1,{sbf:8.99,tj:5.49,lucky:7.99,go:4.99,tgt:6.99,raleys:8.99}],
  ['pepitas','Pantry','Pepitas','⅓ cup','Farro bowl','pepitas pumpkin seeds',['pepita','pumpkin seed'],1,{sbf:4.99,tj:3.49,lucky:4.49,go:2.99,tgt:3.99,raleys:5.49}],
  ['cranberries','Pantry','Dried cranberries','⅓ cup','Farro bowl','dried cranberries',['cranberr'],1,{sbf:3.99,tj:2.99,lucky:3.49,go:2.49,tgt:2.99,raleys:4.29}],
  ['rigatoni','Pantry','Rigatoni','1 lb','Rigatoni','rigatoni pasta',['rigatoni'],1,{sbf:1.99,tj:0.99,lucky:1.79,go:1.49,tgt:1.69,raleys:2.29}],
  ['granola','Pantry','Granola','1 bag','Yogurt jars','granola',['granola'],1,{sbf:5.49,tj:3.99,lucky:4.99,go:3.49,tgt:3.99,raleys:5.99}],
  ['cider','Pantry','Unfiltered apple cider','½ gallon','Chicken','unfiltered apple cider',['cider'],1,{sbf:5.99,tj:4.49,lucky:5.49,go:3.99,tgt:4.99,raleys:6.49}],
  ['stock','Pantry','Chicken stock','32 oz','Rigatoni','chicken stock 32 oz',['chicken','stock|broth'],1,{sbf:3.49,tj:2.49,lucky:2.99,go:2.49,tgt:2.29,raleys:3.99}],
  ['buns','Pantry','Slider buns','12-pack','Chicken sliders','slider buns hawaiian rolls',['roll|bun'],1,{sbf:5.49,tj:3.99,lucky:4.99,go:3.49,tgt:4.79,raleys:5.49,costco:[7.99,'24 rolls',4.00]}]
];

var PANTRY_CHECK = "Kosher salt (Diamond Crystal — halve if Morton), black pepper, flour, sugar, brown sugar, baking powder, vanilla, cardamom, cinnamon, nutmeg, smoked paprika, mustard powder, bay leaves, olive oil, Dijon, cider vinegar, honey, maple syrup, mayo";

var RECIPES = [
 {id:'pancake-bake',n:1,title:'Bacon, Egg & Cheese Pancake Bake',yield:'One 9×13 · 12 squares',when:'Breakfasts',freeze:'Yes — up to 2 months',fridge:'4 days',
  ing:['12 oz thick-cut bacon','8 eggs (6 to scramble, 2 for batter)','1½ cups shredded sharp cheddar','2 cups Kodiak-style mix — or 2 cups flour + 2 Tbsp sugar + 1 Tbsp baking powder + 1 tsp salt','1¾ cups whole milk','4 Tbsp melted butter','1 tsp vanilla','Maple syrup to serve'],
  steps:['Crisp the bacon; drain and crumble.','Softly scramble 6 eggs, keeping them slightly underdone.','Whisk mix with milk, the other 2 eggs, melted butter and vanilla.','Pour into a buttered 9×13; scatter bacon, eggs and cheddar on top.','Bake 325°F for 35–40 min (or 350°F for 25–30). Cool and cut into 12.'],
  tip:'Reheat a square 30–45 seconds in the microwave.'},
 {id:'yogurt-jars',n:2,title:'Spiced Pear Yogurt Jars',yield:'8 jars',when:'Breakfasts / snacks',freeze:'No',fridge:'4 days',
  ing:['4 pears, diced','2 Tbsp butter','2 Tbsp maple syrup','½ tsp each cardamom and cinnamon','Pinch of salt','1 Tbsp lemon juice','32 oz plain Greek yogurt','Granola (add when eating)'],
  steps:['Cook pears in butter with maple, spices and salt 8–10 min until syrupy.','Stir in lemon juice; cool.','Layer ~½ cup yogurt and ~3 Tbsp compote per jar.','Add granola right before eating.'],
  tip:'Extra compote is great on oatmeal.'},
 {id:'farro-bowl',n:3,title:'Squash & White Bean Farro Bowl, Lemon-Tahini',yield:'6 lunches',when:'Lunches',freeze:'No',fridge:'5 days',
  ing:['1 cup farro','Half the roasted squash','2 cans cannellini beans, rinsed','1 bunch lacinato kale, ribboned','4 oz feta','⅓ cup dried cranberries','⅓ cup toasted pepitas','¼ cup chopped parsley','Dressing: ⅓ cup tahini, ¼ cup lemon juice, 1 Tbsp honey, ¾ tsp salt, optional garlic, 4–6 Tbsp ice water'],
  steps:['Roast cubed squash with oil and salt at 425°F for 25–30 min (this batch also feeds the rigatoni).','Cook farro until tender; drain.','Whisk dressing, loosening with ice water.','Massage kale with salt and lemon.','Toss with half the dressing and portion out; add the rest plus pepitas when serving.'],
  tip:'For kids, serve the components separately.'},
 {id:'cider-chicken',n:4,title:'Cider-Braised Pulled Chicken',yield:'~6 servings · two dinners',when:'Dinner ×2',freeze:'Yes — up to 3 months',fridge:'4 days',
  ing:['2.75–3 lb boneless skinless thighs','Rub: 2 tsp salt, 1 Tbsp brown sugar, 2 tsp smoked paprika, 1 tsp mustard powder, 1 tsp pepper','1 fennel bulb + 1 apple, sliced','1 cup cider, 2 Tbsp cider vinegar, 2 Tbsp Dijon','4 thyme sprigs, 2 bay leaves','Night 1: 3 lb Yukon Golds, 4 Tbsp butter, ¾–1 cup warm milk','Night 2: 4 cups cabbage, 2 julienned apples, ⅓ cup mayo, 2 Tbsp cider vinegar, 1 Tbsp honey, ½ tsp salt; slider buns'],
  steps:['Rub chicken with the spice mix.','Bed fennel and apple in a Dutch oven, add chicken, pour in cider/vinegar/Dijon, add herbs.','Braise covered at 325°F for 1 hr 15 min (or slow cooker low 4–5 hrs).','Shred, remove herbs, reduce liquid by a third, stir back together.','Night 1: mash potatoes with butter, warm milk, salt; serve chicken on top.','Night 2: toss slaw; serve chicken + slaw on toasted buns.'],
  tip:'Reheat covered with a splash of the juices.'},
 {id:'rigatoni',n:5,title:'Butternut Squash & Sausage Baked Rigatoni',yield:'Two 8×8 pans · 4 servings each',when:'Dinner now + one frozen',freeze:'Yes — unbaked, 3 months',fridge:'3–4 days',
  ing:['1 lb rigatoni','1 lb mild Italian sausage, casings off','2 Tbsp chopped sage','Half the roasted squash (2 cups blended, rest in chunks)','1 cup chicken stock','1 cup heavy cream','1 cup grated parmesan, divided','Pinch of nutmeg','5 oz baby spinach','8 oz low-moisture mozzarella'],
  steps:['Boil rigatoni 2 min short of package time.','Brown sausage with sage.','Blend 2 cups squash with stock, cream, ½ cup parmesan, nutmeg.','Off heat, combine pasta, sauce, sausage, spinach, squash chunks.','Split into two 8×8 pans; top with mozzarella + remaining parmesan.','Bake covered 400°F 15 min, then uncovered 10–15 min.','Freezer pan: wrap twice unbaked; bake from frozen 375°F covered 60 min + uncovered 15.'],
  tip:'No blender? Stir cream and parmesan straight in.'}
];

var TIMELINE = [
 ['12:30','Chop everything: squash, fennel, apple, kale, pears, herbs, lemons.'],
 ['12:55','Squash into the oven at 425°F; start the farro.'],
 ['1:00','Season chicken, layer fennel + apple in Dutch oven, add chicken and cider; refrigerate.'],
 ['1:25','Squash out; drop oven to 325°F.'],
 ['1:30','Assemble and bake the pancake bake.'],
 ['1:50','Make pear compote; cool.'],
 ['2:00','Assemble farro bowls.'],
 ['2:25','Make rigatoni — one pan to freezer, one to fridge.'],
 ['2:45','Cut pancake bake into 12.'],
 ['3:00','Fill yogurt jars, make slaw. Chicken into oven at 3:15 for 1 hr 15 min.'],
 ['4:30','Boil potatoes; shred chicken and reduce juices.'],
 ['5:30','Dinner: pulled chicken over mash with slaw.']
];

var WEEK = [
 ['Sunday','Cook day','—','Chicken over mash'],
 ['Monday','Pancake bake / yogurt jar','Farro bowl','Baked rigatoni (fridge pan)'],
 ['Tuesday','Yogurt jar','Farro bowl','Chicken sliders + slaw'],
 ['Wednesday','Pancake bake','Farro bowl','Leftovers'],
 ['Thursday','Pancake bake','—','Open (Thanksgiving)'],
 ['Friday','Yogurt jar','Farro bowl','Leftover chicken (quesadillas / eggs)'],
 ['Saturday','Pancake bake','Leftovers','Frozen rigatoni']
];

var STORAGE = {
  freeze: ['Unbaked rigatoni (3 months)','Pulled chicken (3 months)','Pancake bake squares (2 months)'],
  noFreeze: ['Farro bowls','Yogurt jars','Slaw','Mashed potatoes'],
  swaps: [['Italian sausage','Ground pork + fennel seed, sage, salt'],['Chicken thighs','Pork shoulder'],['Farro','Brown rice or quinoa'],['Tahini dressing','Yogurt-based dressing'],['Feta','Goat cheese'],['Pears','Apples'],['Butternut squash','Sweet potatoes'],['Dutch oven','Slow cooker']],
  leftovers: ['Pulled chicken in quesadillas or with eggs','Pear compote on oatmeal','Lemon-tahini on sliders','Browned sage butter on pasta']
};

var SOURCE_URL = 'https://barefoodtim.substack.com/p/a-full-week-of-meals-a-shopping-list-6ec';

var RECIPE_SERVINGS_SEED = { 'pancake-bake': 12, 'yogurt-jars': 8, 'farro-bowl': 6, 'cider-chicken': 6, 'rigatoni': 8 };
var RECIPE_ITEMS_SEED = {
  'pancake-bake':  { bacon: 1, eggs: 1, cheddar: 1, milk: 0.5, butter: 0.25 },
  'yogurt-jars':   { pears: 5, yogurt: 1, granola: 1, lemons: 1, butter: 0.25 },
  'farro-bowl':    { squash: 1, farro: 1, beans: 2, kale: 1, feta: 1, cranberries: 1, pepitas: 1, herbs: 1, tahini: 1, lemons: 2 },
  'cider-chicken': { chicken: 1, fennel: 1, apples: 3, cider: 1, herbs: 1, potatoes: 1, butter: 0.25, milk: 0.5, cabbage: 1, buns: 1 },
  'rigatoni':      { rigatoni: 1, sausage: 1, squash: 1, stock: 1, cream: 1, parm: 1, spinach: 1, mozz: 1, herbs: 1 }
};


export { HOME_DEFAULT, STORES_SEED, ITEMS_SEED, PANTRY_CHECK, RECIPES, TIMELINE, WEEK, STORAGE, SOURCE_URL, RECIPE_SERVINGS_SEED, RECIPE_ITEMS_SEED };

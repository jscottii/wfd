// Public pages for wfdmeals.app: original recipes and guides written for WFD.
// Built into static HTML by site/build.js (see vite.config.js), so anyone (and search engines) can read them without signing in.

export const RECIPES = [
  {
    slug: 'sheet-pan-chicken-fajitas', title: 'Sheet-Pan Chicken Fajitas', meal: 'Dinner', cuisine: 'Mexican-inspired', serves: 4, time: '35 min',
    intro: 'Everything roasts on one pan while you warm the tortillas, so dinner is on the table in about half an hour with one pan to wash. Leftovers make great burrito bowls the next day.',
    ing: ['1.5 lb boneless skinless chicken breasts', '3 bell peppers', '1 large onion', '2 tbsp olive oil', '2 tsp chili powder', '1 tsp ground cumin', '1 tsp smoked paprika', '1/2 tsp salt', '1 lime', '8 flour tortillas', '1/2 cup sour cream'],
    steps: ['Heat the oven to 425°F and line a sheet pan with foil.', 'Slice the chicken into thin strips and the peppers and onion into strips about the same size.', 'Toss the chicken, peppers and onion with the olive oil, chili powder, cumin, smoked paprika and salt right on the pan, then spread everything into one layer.', 'Roast for 20 minutes, stirring once halfway, until the chicken is cooked through and the peppers have browned edges.', 'Squeeze the lime over the pan and serve in warm tortillas with sour cream.'],
    tips: ['Crowding the pan steams the vegetables instead of browning them. Use two pans if yours is small.', 'Warm the tortillas in a dry skillet for 20 seconds a side, or wrapped in foil in the oven for the last 5 minutes.'],
    keeps: 'Fridge 3–4 days. Freeze the cooked filling (not the tortillas) up to 3 months.',
  },
  {
    slug: 'one-pot-turkey-chili', title: 'One-Pot Turkey and Bean Chili', meal: 'Dinner', cuisine: 'American', serves: 6, time: '45 min',
    intro: 'A big, mild pot of chili that feeds a crowd on Sunday and becomes lunches all week. It tastes even better on day two.',
    ing: ['1 tbsp olive oil', '1 large onion', '3 cloves garlic', '1 lb ground turkey', '2 tbsp chili powder', '1 tsp ground cumin', '1 tsp dried oregano', '1 can (28 oz) crushed tomatoes', '2 cans (15 oz) kidney beans', '1 can (15 oz) black beans', '1 cup chicken broth', '1 tsp salt', '1 cup shredded cheddar'],
    steps: ['Heat the olive oil in a large pot over medium heat. Add the onion and cook until soft, about 5 minutes, then stir in the garlic for 30 seconds.', 'Add the ground turkey and break it up as it browns, about 6 minutes.', 'Stir in the chili powder, cumin and oregano and cook for 1 minute until fragrant.', 'Add the crushed tomatoes, drained kidney beans, drained black beans, chicken broth and salt. Bring to a boil.', 'Turn the heat to low and simmer uncovered for 25 minutes, stirring now and then, until thick.', 'Taste for salt and serve topped with cheddar.'],
    tips: ['For more heat, add a chopped jalapeño with the onion.', 'Cool it quickly by spreading it in shallow containers before it goes in the fridge.'],
    keeps: 'Fridge 4 days. Freezes well for 3 months.',
  },
  {
    slug: 'lemon-garlic-salmon-green-beans', title: 'Lemon-Garlic Salmon with Green Beans', meal: 'Dinner', cuisine: 'American', serves: 4, time: '25 min',
    intro: 'Salmon and green beans bake side by side with a quick lemon-garlic butter. It is fast enough for a weeknight and looks like more effort than it is.',
    ing: ['4 salmon fillets', '1 lb green beans', '3 tbsp butter', '3 cloves garlic', '1 lemon', '1 tbsp olive oil', '1/2 tsp salt', '1/4 tsp black pepper', '2 tbsp chopped parsley'],
    steps: ['Heat the oven to 400°F.', 'Trim the green beans, toss them with the olive oil and a pinch of the salt, and spread them on one side of a sheet pan.', 'Set the salmon fillets on the other side and season with the rest of the salt and the pepper.', 'Melt the butter with the minced garlic and the juice of half the lemon, then spoon it over the salmon.', 'Bake 12 to 15 minutes, until the salmon flakes easily and the green beans are tender.', 'Finish with the parsley and the rest of the lemon cut into wedges.'],
    tips: ['Thicker fillets need a few more minutes; thin tail pieces need a few less.'],
    keeps: 'Best fresh. Fridge 2 days; eat cold on salads.',
  },
  {
    slug: 'black-bean-sweet-potato-tacos', title: 'Black Bean and Sweet Potato Tacos', meal: 'Dinner', cuisine: 'Mexican-inspired', serves: 4, time: '35 min',
    intro: 'A filling meatless taco night. Roasted sweet potato and smoky black beans make a hearty base, and a quick lime slaw adds crunch.',
    ing: ['2 sweet potatoes', '2 tbsp olive oil', '1 tsp smoked paprika', '1 tsp ground cumin', '1/2 tsp salt', '1 can (15 oz) black beans', '3 cups shredded cabbage', '1 lime', '1/4 cup chopped cilantro', '8 corn tortillas', '1/2 cup crumbled feta'],
    steps: ['Heat the oven to 425°F.', 'Peel the sweet potatoes, cut them into small cubes and toss with the olive oil, smoked paprika, cumin and salt.', 'Roast the sweet potatoes for 25 minutes, turning once, until soft and browned.', 'Warm the rinsed black beans in a small pot with a splash of water and lightly mash about half of them.', 'Toss the cabbage with the lime juice, cilantro and a pinch of salt.', 'Fill warm tortillas with the beans, sweet potatoes and slaw, and top with feta.'],
    tips: ['Roast a double batch of sweet potatoes: they reheat well in grain bowls all week.'],
    keeps: 'Keep the parts separate. Fridge 4 days.',
  },
  {
    slug: 'baked-ziti-spinach', title: 'Baked Ziti with Spinach', meal: 'Dinner', cuisine: 'Italian-American', serves: 8, time: '50 min',
    intro: 'A make-ahead pasta bake that stretches to two meals. Bake one pan tonight and freeze the other for a busy night.',
    ing: ['1 lb ziti', '1 jar (24 oz) marinara sauce', '15 oz ricotta', '1 egg', '5 oz baby spinach', '2 cups shredded mozzarella', '1/2 cup grated parmesan', '1 tsp dried basil', '1/2 tsp salt'],
    steps: ['Heat the oven to 375°F and grease two 8×8 pans.', 'Boil the ziti 2 minutes short of the package time, then drain.', 'Stir the ricotta, egg, basil and salt together in a large bowl, then fold in the spinach.', 'Toss the drained ziti with the marinara and the ricotta mixture.', 'Split it between the two pans and top with the mozzarella and parmesan.', 'Cover with foil and bake 20 minutes, then uncover and bake 10 to 15 minutes more until bubbling and golden.'],
    tips: ['To freeze one pan, wrap it twice before baking. Bake from frozen, covered, at 375°F for about an hour, then uncovered for 15 minutes.'],
    keeps: 'Fridge 4 days. Freeze unbaked up to 3 months.',
  },
  {
    slug: 'teriyaki-chicken-rice-bowls', title: 'Teriyaki Chicken Rice Bowls', meal: 'Dinner', cuisine: 'Japanese-inspired', serves: 4, time: '30 min',
    intro: 'A homemade teriyaki sauce takes five minutes and tastes far better than the bottled kind. Pack the bowls for lunches, or serve them family style.',
    ing: ['1.5 lb boneless skinless chicken thighs', '1/3 cup soy sauce', '3 tbsp honey', '1 tbsp rice vinegar', '1 tbsp cornstarch', '2 cloves garlic', '1 tbsp grated ginger', '1 tbsp vegetable oil', '2 cups jasmine rice', '3 cups broccoli florets', '1 tbsp sesame seeds'],
    steps: ['Cook the jasmine rice according to the package.', 'Whisk the soy sauce, honey, rice vinegar, cornstarch, garlic and ginger with 1/4 cup water.', 'Cut the chicken thighs into bite-size pieces. Heat the vegetable oil in a large skillet over medium-high heat and cook the chicken until browned and cooked through, about 8 minutes.', 'Steam the broccoli for 4 minutes until bright green and just tender.', 'Pour the sauce over the chicken and simmer for 2 minutes until it thickens and coats the chicken.', 'Serve the chicken and broccoli over the rice and sprinkle with sesame seeds.'],
    tips: ['Thighs stay juicier than breasts when reheated, which makes them the better choice for meal prep.'],
    keeps: 'Fridge 4 days. Freeze the chicken and sauce up to 2 months.',
  },
  {
    slug: 'peanut-butter-banana-overnight-oats', title: 'Peanut Butter Banana Overnight Oats', meal: 'Breakfast', cuisine: 'American', serves: 4, time: '10 min + overnight',
    intro: 'Four breakfasts made in ten minutes. Stir everything together at night and grab a jar on the way out the door.',
    ing: ['2 cups rolled oats', '2 cups milk', '1 cup plain Greek yogurt', '1/4 cup peanut butter', '2 tbsp maple syrup', '2 tbsp chia seeds', '2 bananas', '1/2 tsp cinnamon', '1 pinch salt'],
    steps: ['Whisk the milk, Greek yogurt, peanut butter, maple syrup, cinnamon and salt until smooth.', 'Stir in the rolled oats and chia seeds.', 'Slice one banana and fold it in, then split the mixture between four jars.', 'Cover and chill overnight, at least 6 hours.', 'Top with the second banana, sliced, just before eating.'],
    tips: ['Add a splash of milk in the morning if it is thicker than you like.'],
    keeps: 'Fridge 4 days.',
  },
  {
    slug: 'chicken-vegetable-fried-rice', title: 'Chicken and Vegetable Fried Rice', meal: 'Dinner', cuisine: 'Chinese-inspired', serves: 4, time: '25 min',
    intro: 'The best use for leftover rice. Cold, day-old rice fries up in separate grains instead of turning mushy.',
    ing: ['4 cups cooked rice', '2 tbsp vegetable oil', '1 lb boneless skinless chicken breast', '3 eggs', '2 cups frozen peas and carrots', '4 green onions', '2 cloves garlic', '3 tbsp soy sauce', '1 tsp sesame oil'],
    steps: ['Cut the chicken into small pieces. Heat 1 tablespoon of the vegetable oil in a large skillet or wok over high heat and cook the chicken until cooked through, about 6 minutes. Move it to a plate.', 'Scramble the eggs in the same pan until just set, then add them to the plate with the chicken.', 'Add the rest of the vegetable oil, the peas and carrots, the garlic and the white parts of the green onions, and stir-fry for 2 minutes.', 'Add the cooked rice and press it flat. Let it sit for a minute to crisp, then stir and repeat twice.', 'Add the chicken and eggs back with the soy sauce and sesame oil and toss until hot.', 'Finish with the green parts of the green onions.'],
    tips: ['No leftover rice? Cook it, spread it on a sheet pan and chill it for 30 minutes first.'],
    keeps: 'Fridge 3 days. Reheat until steaming hot.',
  },
];

export const GUIDES = [
  {
    slug: 'plan-a-week-of-dinners', title: 'How to plan a week of dinners in 15 minutes',
    summary: 'A simple routine that turns "what\'s for dinner?" into a decision you make once a week.',
    body: `
<p>Most of the stress of weeknight dinners isn't cooking. It's deciding, every single evening, while everyone is hungry. Planning once a week moves that decision to a calm moment and makes shopping faster too. Here's a routine that takes about fifteen minutes.</p>
<h2>1. Look at the week first, not the recipes</h2>
<p>Before picking a single meal, look at the calendar. Which nights are busy with practice, late meetings or plans out? Those nights need something that's already made or takes under 20 minutes. A calmer night can handle a recipe that takes longer. Write down how many dinners you actually need. It's often five, not seven.</p>
<h2>2. Pick from a short list of favorites</h2>
<p>Keep a running list of 15 to 20 meals your household already likes. Each week, choose most of your dinners from that list and add one new recipe at most. New recipes take longer to shop for and cook, so one is plenty.</p>
<h2>3. Cook once, eat twice</h2>
<p>Choose at least one meal that makes extra on purpose: a big pot of chili, a double pan of baked ziti, or extra rice for fried rice later in the week. Leftovers are a planned dinner, not an accident.</p>
<h2>4. Share ingredients across meals</h2>
<p>If Monday's fajitas need a bag of peppers and Thursday's fried rice needs vegetables too, buy once and use them up. Overlapping ingredients cut waste and cost. A bunch of cilantro or a head of cabbage can show up in two meals instead of wilting in the drawer.</p>
<h2>5. Check what you already have</h2>
<p>Before writing the list, look in the fridge, freezer and pantry. Anything that needs using soon should shape the plan. Half a bag of spinach becomes baked ziti; leftover rice becomes fried rice.</p>
<h2>6. Write the list by store section</h2>
<p>Group the list the way the store is laid out: produce, meat, dairy, pantry, frozen. You'll walk through once instead of zig-zagging back for the one thing you missed.</p>
<p>WFD does most of this for you: it spreads your picks across the week, notices leftovers, checks your pantry, and builds the list sorted by store, with prices.</p>`,
  },
  {
    slug: 'meal-prep-for-beginners', title: 'Meal prep for beginners: a Sunday game plan',
    summary: 'How to cook several meals in one session without spending the whole day in the kitchen.',
    body: `
<p>Meal prep doesn't mean eating the same chicken and rice five days in a row. The goal is to do the slow parts once, so weeknight meals come together in minutes. A two-hour session on the weekend can cover most of the week.</p>
<h2>Start the longest things first</h2>
<p>Anything that bakes, roasts or simmers goes first, because it cooks while you do other work. Preheat the oven before you do anything else. Get rice or grains going, put a sheet pan of vegetables in the oven, and start a pot of chili on the stove. Then chop while they cook.</p>
<h2>Use the oven and stove at the same time</h2>
<p>A good session keeps every burner and the oven busy. While something roasts at 425°F, a pot simmers on one burner and a skillet browns meat on another. Recipes that share an oven temperature can go in together.</p>
<h2>Prep components, not just meals</h2>
<p>Cooked grains, roasted vegetables, a batch of shredded chicken and one or two sauces can be combined in different ways all week: bowls one night, tacos the next, a salad for lunch. Components stay more interesting than five identical boxes.</p>
<h2>Cool food quickly, then store it</h2>
<p>Spread hot food into shallow containers so it cools faster, and get it into the fridge within two hours of cooking. Label containers with the date. Most cooked dishes keep three to four days in the fridge. Freeze anything you won't eat by then.</p>
<h2>Clean as you go</h2>
<p>Wash bowls and boards while things cook. You'll finish with a clean kitchen instead of a sink full of dishes.</p>
<p>WFD's Cook day view turns your week's recipes into one combined, step-by-step plan in the right order, with timers that start on their own for the hands-off steps.</p>`,
  },
  {
    slug: 'spend-less-on-groceries', title: 'How to spend less on groceries without clipping coupons',
    summary: 'Practical ways to lower the weekly bill that don\'t take extra time.',
    body: `
<p>Coupons and deal-hunting can save money, but they take time most families don't have. These habits lower the grocery bill without any extra work once they become routine.</p>
<h2>Shop from a plan, not from the aisles</h2>
<p>The single biggest saver is walking in with a list built from your week's meals. Unplanned buying is where budgets leak: the extra snacks, the second jar of something you already had.</p>
<h2>Know where things are cheapest</h2>
<p>Prices for the same item can differ a lot between stores in the same town. Staples like rice, beans, oil, spices and canned tomatoes are often much cheaper at warehouse or discount stores, while produce may be cheaper elsewhere. Splitting a list between two stores can save real money, as long as the extra drive is worth it.</p>
<h2>Count the drive</h2>
<p>A second store saves money only if the savings beat the gas and the time. A good rule: only add a stop if it saves more than a few dollars per extra mile, and group stores that are near each other.</p>
<h2>Buy for the whole week, not for one recipe</h2>
<p>When two recipes use the same ingredient, a bigger package is usually cheaper per ounce. Plan meals that share ingredients so nothing goes to waste.</p>
<h2>Use what you already have</h2>
<p>Food you throw away is money spent twice. Check the fridge and pantry before planning, and build at least one meal around what needs using up.</p>
<h2>Swap brands on the basics</h2>
<p>Store brands of flour, sugar, canned goods, frozen vegetables and dairy are usually made to the same standards for less. Save the name brands for the few things where you notice a difference.</p>
<p>WFD compares your stores item by item, adds in the gas, and plans the cheapest route, so the list tells you where to buy each thing.</p>`,
  },
  {
    slug: 'read-a-flow-chart-recipe', title: 'Flow chart recipes: see a whole recipe at a glance',
    summary: 'Why a recipe drawn as a chart is easier to cook from, and how to read one.',
    body: `
<p>A normal recipe is a list of ingredients followed by a block of steps. While cooking, you keep jumping back and forth: how much flour again? Which bowl does the butter go in? A flow chart recipe (sometimes called a tabular recipe) puts both in one picture.</p>
<h2>How to read it</h2>
<p>Ingredients run down the left side. Each step is a box to the right of the ingredients it uses. When a step combines things, its box stretches across all of their rows, so you can see at a glance what gets mixed with what. Read from left to right: each column happens after the one before it.</p>
<h2>Why it helps</h2>
<ul>
<li><b>You can see the parallel work.</b> Two separate branches (say, a sauce and a filling) can be made at the same time, in either order.</li>
<li><b>Amounts are next to the step that uses them</b>, so there's less scanning back up the page.</li>
<li><b>Setup comes first.</b> Steps like "preheat the oven" or "grease the pan" sit above the chart so they aren't forgotten.</li>
</ul>
<h2>When a list is better</h2>
<p>Long recipes with many separate stages can get too wide for a phone screen. For those, a top-to-bottom version works better: each step in order, with small tags showing which ingredients join in at that step.</p>
<p>Every recipe in WFD, including ones you save from any website, can be shown as a flow chart or step by step. Tap a step to read the full instructions.</p>`,
  },
];

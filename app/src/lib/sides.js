// Simple sides that turn a light main into a full meal. Picked by cuisine; saved as ordinary recipes the first
// time they're used, so they land on the shopping list and in Prep like anything else.
export const SIDES = {
  rice: { title: 'Steamed rice', servings: 4, when: 'Side', cuisine: '', ing: ['1 1/2 cups white rice', '2 1/4 cups water', '1/2 tsp salt'],
    steps: ['Rinse the rice until the water runs clear.', 'Bring rice, water and salt to a boil, cover, and simmer on low for 15 minutes.', 'Turn off the heat and let it sit, covered, for 10 minutes. Fluff with a fork.'], fridge: '4 days', freeze: 'Up to 2 months' },
  bread: { title: 'Warm crusty bread', servings: 4, when: 'Side', cuisine: '', ing: ['1 baguette', '3 tbsp butter'],
    steps: ['Warm the baguette in a 375°F oven for 8 minutes.', 'Slice and serve with butter.'], fridge: '', freeze: 'Up to 1 month' },
  potatoes: { title: 'Roasted potatoes', servings: 4, when: 'Side', cuisine: '', ing: ['2 lb Yukon Gold potatoes', '2 tbsp olive oil', '1 tsp salt', '1/2 tsp black pepper'],
    steps: ['Heat the oven to 425°F.', 'Cut the potatoes into 1-inch pieces and toss with oil, salt and pepper.', 'Roast on a sheet pan for 30–35 minutes, turning once, until golden.'], fridge: '4 days', freeze: '' },
  tortillas: { title: 'Warm tortillas & beans', servings: 4, when: 'Side', cuisine: '', ing: ['8 corn tortillas', '1 (15 oz) can black beans', '1/2 tsp cumin', '1/4 tsp salt'],
    steps: ['Warm the beans with cumin and salt in a small pot.', 'Heat the tortillas in a dry skillet, about 30 seconds a side. Wrap in a towel to keep warm.'], fridge: '4 days', freeze: '' },
  pasta: { title: 'Buttered pasta', servings: 4, when: 'Side', cuisine: '', ing: ['8 oz pasta', '2 tbsp butter', '1/4 cup grated parmesan'],
    steps: ['Boil the pasta in salted water until tender.', 'Drain and toss with butter and parmesan.'], fridge: '3 days', freeze: '' },
  naan: { title: 'Rice & naan', servings: 4, when: 'Side', cuisine: '', ing: ['1 cup basmati rice', '1 1/2 cups water', '4 naan'],
    steps: ['Simmer the rice in the water, covered, for 15 minutes; rest 5 minutes.', 'Warm the naan in a 375°F oven for 5 minutes.'], fridge: '4 days', freeze: 'Up to 1 month' },
};
const BY_CUISINE = [
  [/chinese|japanese|thai|korean|vietnamese|filipino|malaysian|indonesian|asian/i, 'rice'],
  [/indian|pakistani|sri lankan/i, 'naan'],
  [/mexican|latin|peruvian|argentin|brazil|colombian|venezuelan|cuban|jamaican|puerto|caribbean/i, 'tortillas'],
  [/italian/i, 'bread'], [/french|spanish|portuguese|greek|mediterranean|turkish|lebanese|moroccan/i, 'bread'],
  [/american|canadian|british|irish/i, 'potatoes'],
];
/** Which side suits a main: by cuisine, else by what the dish looks like (stir-fry → rice, stew → bread). */
export function sideFor(r) {
  const c = String(r?.cuisine || ''), t = `${r?.title || ''} ${(r?.ing || []).join(' ')}`.toLowerCase();
  if (/\b(rice|noodles?|pasta|spaghetti|penne|rigatoni|potato(es)?|breads?|buns?|tortillas?|naans?|pitas?|couscous|quinoa|baguettes?|rolls?)\b/.test(t)) return null;   // already has a starch
  const hit = BY_CUISINE.find(([re]) => re.test(c));
  if (hit) return hit[1];
  if (/stir.?fry|soy sauce|curry|teriyaki|ginger/.test(t)) return 'rice';
  if (/stew|soup|chili|braise/.test(t)) return 'bread';
  return 'potatoes';
}

// what goes on the shopping list for each side: [name, aisle]
export const SIDE_ITEMS = {
  rice: [['White rice', 'Pantry']], bread: [['Baguette', 'Bakery'], ['Butter', 'Dairy & Eggs']], potatoes: [['Yukon Gold potatoes', 'Produce']],
  tortillas: [['Corn tortillas', 'Bakery'], ['Black beans', 'Pantry']], pasta: [['Pasta', 'Pantry'], ['Parmesan', 'Dairy & Eggs']], naan: [['Basmati rice', 'Pantry'], ['Naan', 'Bakery']],
};

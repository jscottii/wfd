// Making sense of what people type: "chiken thies" → "chicken thighs", "brocoli" → "broccoli".
// A vocabulary of food words (your items, your recipes, ~600 ingredients from TheMealDB, common foods) and an
// edit-distance match that forgives one or two slips per word.
const COMMON = `chicken beef pork lamb turkey bacon sausage ham salmon tuna shrimp prawns cod tilapia fish tofu tempeh eggs egg
milk butter cream cheese cheddar mozzarella parmesan feta ricotta yogurt greek sour
rice pasta spaghetti penne noodles bread tortillas flour sugar oats quinoa couscous potatoes potato
onion onions garlic ginger carrots carrot celery peppers pepper tomatoes tomato spinach kale lettuce broccoli cauliflower
zucchini eggplant mushrooms mushroom cabbage cucumber avocado lemon lime orange apple apples banana bananas berries
strawberries blueberries beans chickpeas lentils peas corn squash pumpkin sweet basil cilantro parsley mint thyme rosemary
oil olive vinegar soy sauce honey maple syrup salt cumin paprika cinnamon curry chili chilli stock broth coconut
breast breasts thigh thighs wings ground minced steak chops fillet fillets tenderloin shoulder ribs
taco tacos burrito enchilada lasagna curry stew soup chili salad sandwich burger pizza casserole stir fry roast
tikka masala teriyaki pad thai fried rice lo mein ramen pho bibimbap bulgogi katsu sushi gyoza dumplings
meatballs meatloaf pot pie quesadilla fajitas nachos risotto carbonara bolognese alfredo pesto marinara
pancakes waffles muffins oatmeal granola smoothie omelette frittata quiche`.split(/\s+/);

let vocab = new Set(COMMON), loading = null;
/** Add words (item names, recipe titles…) to what the matcher knows. */
export function learn(texts) { for (const t of texts || []) for (const w of words(t)) if (w.length > 2) vocab.add(w); }
/** TheMealDB's full ingredient list, fetched once and kept for the session. */
export function loadIngredients() {
  return (loading ||= fetch('https://www.themealdb.com/api/json/v1/1/list.php?i=list').then((r) => r.json())
    .then((j) => learn((j.meals || []).map((m) => m.strIngredient))).catch(() => { loading = null; }));
}
const words = (s) => String(s || '').toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/[\s-]+/).filter(Boolean);

// Damerau–Levenshtein distance (a swap of two letters counts as one slip), stopping early past `max`
function dist(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      best = Math.min(best, d[i][j]);
    }
    if (best > max) return max + 1;
  }
  return d[a.length][b.length];
}
const subseq = (a, b) => { let i = 0; for (const c of b) if (c === a[i]) i++; return i === a.length; };
const allowed = (w) => (w.length <= 3 ? 0 : w.length === 4 ? 1 : 2);   // short words must be (nearly) exact

/** The closest known word, or the word itself when it's already known or nothing is close. */
export function fixWord(w) {
  w = w.toLowerCase();
  if (vocab.has(w) || allowed(w) === 0) return w;
  let best = w, bestD = allowed(w) + 1;
  for (const v of vocab) {
    if (Math.abs(v.length - w.length) > bestD || v[0] !== w[0] && v[0] !== w[1]) continue;   // first letters rarely wrong
    const d = dist(w, v, bestD);
    // on a tie, prefer the word that contains every typed letter in order (people drop letters more than they swap them)
    if (d < bestD || (d === bestD && best !== w && subseq(w, v) && !subseq(w, best))) { best = v; bestD = d; }
  }
  return best;
}
/** "chiken thies" → { text: "chicken thighs", changed: true } */
export function correct(text) {
  const out = String(text || '').replace(/[a-zA-Z']+/g, (w) => { const f = fixWord(w); return f === w.toLowerCase() ? w : f; });
  return { text: out, changed: out.toLowerCase() !== String(text || '').toLowerCase() };
}
/** Best matches for what's typed among a list of names (prefix, word and typo-tolerant), best first. */
export function suggest(typed, names, n = 5) {
  const q = words(typed); if (!q.length) return [];
  const fixed = q.map(fixWord);
  return names.map((name) => {
    const nw = words(name); let score = 0;
    for (let i = 0; i < q.length; i++) {
      const w = q[i], f = fixed[i];
      if (nw.some((x) => x === w || x === f)) score += 3;
      else if (nw.some((x) => x.startsWith(w) || x.startsWith(f))) score += 2;
      else if (nw.some((x) => x.length > 3 && dist(w, x, 2) <= allowed(w))) score += 1;
      else return { name, score: 0 };
    }
    return { name, score: score - nw.length * 0.1 };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, n).map((x) => x.name);
}

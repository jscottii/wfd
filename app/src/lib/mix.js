// "Pick for me": a week of recipes that share ingredients (less to buy, less waste) but still vary
// in protein, cuisine and style from day to day.
const PROTEINS = [['chicken', /chicken/], ['beef', /beef|steak|brisket|mince/], ['pork', /pork|sausage|bacon|ham\b|chorizo/], ['fish', /salmon|fish|cod|tuna|tilapia|halibut/],
  ['shrimp', /shrimp|prawn/], ['turkey', /turkey/], ['lamb', /lamb/], ['tofu', /tofu|tempeh/], ['beans', /bean|lentil|chickpea/], ['egg', /\begg/]];
const STYLES = [['pasta', /pasta|rigatoni|spaghetti|penne|noodle|lasagn|mac/], ['bowl', /bowl|rice|farro|quinoa/], ['soup', /soup|stew|chili|curry/],
  ['bake', /bake|casserole|roast|sheet.?pan/], ['taco', /taco|burrito|enchilada|quesadilla|wrap/], ['salad', /salad/], ['sandwich', /sandwich|burger|slider|sub\b/]];
const tag = (list, text) => (list.find(([, re]) => re.test(text)) || ['other'])[0];
const kindOf = (r) => { const w = String(r?.when || '').toLowerCase(); return /breakfast/.test(w) ? 'breakfast' : /snack|dessert|treat|side/.test(w) ? 'snack' : 'main'; };

/**
 * recipes: saved recipes; need: { breakfast, main, snack } counts; pantryIds: Set of item ids on hand;
 * liked: cuisines; recent: Set of recipe ids used lately. Returns recipe ids.
 */
export function pickMix({ recipes, need, pantryIds = new Set(), liked = [], recent = new Set(), usePantry = false, keep = [] }) {
  const info = recipes.map((r) => {
    const text = `${r.title} ${(r.ing || []).join(' ')}`.toLowerCase();
    return { r, kind: kindOf(r), items: new Set(Object.keys(r.items || {})), protein: tag(PROTEINS, text), style: tag(STYLES, text), cuisine: String(r.cuisine || '').toLowerCase() };
  });
  const likedL = liked.map((c) => c.toLowerCase());
  const chosen = [], pool = new Set();
  const score = (x) => {
    const n = x.items.size || 1;
    const shared = [...x.items].filter((i) => pool.has(i)).length / n;                       // overlap with what's already on the list
    const onHand = usePantry ? [...x.items].filter((i) => pantryIds.has(i)).length / n : 0;  // uses up the pantry
    const same = chosen.filter((c) => c.kind === x.kind);
    const repeat = same.filter((c) => c.protein === x.protein && x.protein !== 'other').length * 0.6
      + same.filter((c) => c.style === x.style && x.style !== 'other').length * 0.45
      + same.filter((c) => c.cuisine && c.cuisine === x.cuisine).length * 0.3;
    const fav = x.cuisine && likedL.some((c) => x.cuisine.includes(c) || c.includes(x.cuisine)) ? 0.25 : 0;
    const fresh = recent.has(x.r.id) ? -0.5 : 0;
    return shared * 1.2 + onHand * 1.5 + fav + fresh - repeat + Math.random() * 0.8;   // enough chance that picks vary
  };
  // the ones you said to keep go in first; the rest are chosen to go with them
  for (const id of keep) { const x = info.find((y) => y.r.id === id); if (x && !chosen.includes(x)) { chosen.push(x); x.items.forEach((i) => pool.add(i)); } }
  for (const kind of ['main', 'breakfast', 'snack']) {
    for (let i = chosen.filter((x) => x.kind === kind).length; i < (need[kind] || 0); i++) {
      const cands = info.filter((x) => x.kind === kind && !chosen.includes(x));
      if (!cands.length) break;
      const best = cands.map((x) => [x, score(x)]).sort((a, b) => b[1] - a[1])[0][0];
      chosen.push(best); best.items.forEach((id) => pool.add(id));
    }
  }
  return { ids: chosen.map((x) => x.r.id), short: Object.fromEntries(['main', 'breakfast', 'snack'].map((k) => [k, Math.max(0, (need[k] || 0) - chosen.filter((x) => x.kind === k).length)])),
    shared: [...pool].filter((id) => chosen.filter((x) => x.items.has(id)).length > 1).length };
}

// Meal slots in time order, and which of them can be followed by a leftover meal: a dinner's leftovers are the
// next day's lunch; with one kind of meal (just dinners, breakfasts…) a meal's leftovers are the next day's.
function mainSlots(grid, meals) {
  const ms = ['lunch', 'dinner'].filter((m) => meals.includes(m));
  const slots = grid.flatMap((d) => ms.map((m) => [d, m]));
  const pairs = [];
  if (ms.length === 2) { for (let i = 0; i < slots.length - 1; i++) if (slots[i][1] === 'dinner') pairs.push(i); }
  else for (let i = 0; i + 1 < slots.length; i += 2) pairs.push(i);
  return { slots, pairs };
}
function daySlots(grid, m) { const slots = grid.map((d) => [d, m]); const pairs = []; for (let i = 0; i + 1 < slots.length; i += 2) pairs.push(i); return { slots, pairs }; }

/** How many different recipes a week needs: every recipe is eaten at most twice (cooked once, leftovers once). */
export function recipesNeeded(shape) {
  const grid = Array.from({ length: shape.to - shape.from + 1 }, () => ({}));
  const m = mainSlots(grid, shape.meals), b = daySlots(grid, 'breakfast');
  return { main: Math.max(1, m.slots.length - m.pairs.length), breakfast: shape.meals.includes('breakfast') ? b.slots.length - b.pairs.length : 0, snack: shape.snack ? b.slots.length - b.pairs.length : 0 };
}

/**
 * Place recipes into the week. Each recipe appears at most twice, and only forward in time: cooked, then eaten
 * once more at the next meal (tonight's dinner → tomorrow's lunch). Extra recipes mean fewer leftover meals.
 */
export function placeRecipes(grid, byKind, meals, snack) {
  // Leftovers land on a random later meal 1–3 days after cooking (never before, never the same day, and rarely
  // the very next meal), so the week doesn't read "dinner → tomorrow's lunch" every time.
  const fill = ({ slots, pairs }, list) => {
    if (!slots.length || !list.length) return;
    const dayOf = (i) => grid.indexOf(slots[i][0]);
    let doubles = Math.max(0, Math.min(pairs.length, slots.length - list.length));
    const taken = new Array(slots.length).fill(false);
    let j = 0;
    for (let i = 0; i < slots.length; i++) {
      if (taken[i]) continue;
      const r = list[j++ % list.length];
      const [d, m] = slots[i]; d[m] = r.id; taken[i] = true;
      if (doubles > 0) {
        const di = dayOf(i);
        const options = slots.map((_, k) => k).filter((k) => !taken[k] && dayOf(k) > di && dayOf(k) <= di + 3);
        // keep enough room: don't take a slot a later cook day needs if this one has other options
        const notNext = options.filter((k) => k !== i + 1);
        const pool = notNext.length ? notNext : options;
        if (pool.length) {
          // lean toward sooner days (fresher leftovers) but stay random
          const weights = pool.map((k) => 1 / (dayOf(k) - di));
          let x = Math.random() * weights.reduce((a, b) => a + b, 0), pick = pool[0];
          for (let t = 0; t < pool.length; t++) { x -= weights[t]; if (x <= 0) { pick = pool[t]; break; } }
          const [d2, m2] = slots[pick]; d2[m2] = r.id; taken[pick] = true; doubles--;
        }
      }
    }
  };
  grid.forEach((d) => { ['breakfast', 'lunch', 'dinner', 'snack'].forEach((m) => { d[m] = ''; delete d[m + '_side']; }); });
  fill(mainSlots(grid, meals), byKind.main || []);
  if (meals.includes('breakfast')) fill(daySlots(grid, 'breakfast'), byKind.breakfast || []);
  if (snack) fill(daySlots(grid, 'snack'), byKind.snack || []);
}

// Turning a recipe into freezer meals: what kind of dish it is, how to pack it, and how to reheat it.
const T = (r) => `${r.title} ${(r.steps || []).join(' ')}`.toLowerCase();
export function freezerKind(r) {
  const t = T(r), title = r.title.toLowerCase();
  if (/salad|slaw|yogurt|parfait|jars?\b|fresh|raw|crispy|fried|tempura|sushi|ceviche|mashed potato|cucumber|lettuce/.test(title)) return 'no';
  if (/lasagn|casserole|bake\b|baked (pasta|ziti|rigatoni)|enchilada|rigatoni|ziti|shepherd|pot pie|gratin|mac(aroni)? (and|&) cheese/.test(title)) return 'pan';
  if (/soup|stew|chili|curry|sauce|braise|braised|pulled|ragu|bolognese|dal|stock|broth/.test(t)) return 'bag';
  if (/pancake|waffle|muffin|burrito|bars?\b|cookie|bread|meatball|patties|burger|dumpling|egg bite|frittata|breakfast (sandwich|bake)/.test(title)) return 'tray';
  if (/rice|farro|quinoa|grain|beans|lentil/.test(t)) return 'bag';
  return 'container';
}
const HOW = {
  pan: { pack: 'Assemble in a foil pan but don’t bake it. Cool, wrap tightly in plastic wrap, then foil.', reheat: 'Thaw overnight in the fridge, then bake covered at 375°F for 45–60 min and uncovered 15 min more, until 165°F in the middle.', need: 'foil pan' },
  bag: { pack: 'Cool completely, ladle into gallon freezer bags, squeeze out the air and freeze them flat on a sheet pan, then stand them up like files.', reheat: 'Thaw overnight in the fridge (or set the bag in cold water), then warm on the stove until steaming.', need: 'gallon freezer bag' },
  tray: { pack: 'Freeze pieces in one layer on a lined sheet pan for 1–2 hours, then move them into a freezer bag so they don’t stick together.', reheat: 'Reheat from frozen: microwave 1–2 min, or 350°F oven/toaster oven 10–15 min.', need: 'gallon freezer bag' },
  container: { pack: 'Cool completely, then portion into freezer-safe containers, leaving ½ inch at the top for expansion.', reheat: 'Thaw overnight in the fridge, then reheat covered until steaming (165°F).', need: 'freezer container' },
  no: { pack: 'This one doesn’t freeze well — keep it in the fridge and eat it this week.', reheat: '', need: '' },
};
/** Freezer plan for a recipe: { kind, packs, perPack, pack, reheat, need, label } */
export function freezerPlan(r, portions, perMeal) {
  const kind = freezerKind(r), how = HOW[kind];
  const per = Math.max(1, Number(perMeal) || 4), packs = kind === 'no' ? 0 : Math.max(1, Math.round((Number(portions) || per) / per));
  const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const until = new Date(Date.now() + 90 * 864e5).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { kind, packs, perPack: per, ...how, label: kind === 'no' ? '' : `${r.title} · serves ${per} · made ${date} · eat by ${until}${how.reheat ? ` · ${how.reheat.split('.')[0]}` : ''}` };
}
export const canFreeze = (r) => freezerKind(r) !== 'no';

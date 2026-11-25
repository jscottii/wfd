// A recipe as a flow chart (the "tabular recipe" layout): ingredients down the left, and each step a column that
// joins the ingredients it uses into one block, so you can see what goes into what at a glance.
// Built from the ingredient list and the steps; steps that use nothing yet ("Preheat the oven") go across the top.

const STOP = new Set(('large small medium ripe fresh frozen chopped diced sliced minced ground grated shredded melted softened ' +
  'beaten whole boneless skinless finely roughly thinly lightly packed cups cup tablespoons tablespoon tbsp tbs tsp teaspoons ' +
  'teaspoon ounces ounce pound pounds grams gram can cans jar package pinch dash optional divided plus more about into for and ' +
  'the with of or to taste room temperature extra virgin all purpose all-purpose unsalted salted dry dried warm cold hot cut pieces').split(' '));
const SETUP = /\b(preheat|pre-heat|grease|spray|line (a|the|your)|butter and flour|heat (the )?(oven|grill)|prepare (a|the) (pan|dish|sheet))\b/i;
const sing = (w) => w.replace(/ies$/, 'y').replace(/(ch|sh|x|s|o)es$/, '$1').replace(/([^s])s$/, '$1');

/** The words that name an ingredient: "2 large (250 g) ripe bananas" → ["banana"] */
function keysOf(line) {
  const s = String(line).toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[\d½⅓⅔¼¾⅛.,\/-]+/g, ' ').replace(/[^a-z' ]/g, ' ');
  const words = s.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map(sing);
  return [...new Set(words)];
}
const rawSentences = (step) => String(step).replace(/^\s*(step\s*)?\d+[.):]\s*/i, '').replace(/([a-z])([A-Z][a-z]+ (?:the|a|an|your|all)\b)/g, '$1. \u0001$2').split(/(?<=[.!?])\s+(?=[A-Z\u0001])/).map((x) => x.trim()).filter(Boolean);

/** Short label for a step: its first sentence without the ingredient names ("Mash the bananas until smooth" → "Mash until smooth"). */
function labelOf(step, names) {
  let t = sentences(step)[0] || String(step);
  for (const n of names) t = t.replace(new RegExp(`\\b(the |your )?${n}(e?s)?\\b`, 'gi'), '');
  // the names are gone; tidy the joining words left behind ("Add , and to and mash" → "Add and mash")
  const CONN = /^(,|and|to|into|with|in|the|a|an|of|plus|then|&)$/i, KEEP = ['into', 'to', 'with', 'in', 'and', 'then'];
  const toks = t.replace(/,/g, ' , ').split(/\s+/).filter(Boolean), out = [];
  for (let i = 0; i < toks.length; ) {
    if (!CONN.test(toks[i])) { out.push(toks[i++]); continue; }
    const run = []; while (i < toks.length && CONN.test(toks[i])) run.push(toks[i++]);
    if (i >= toks.length) continue;                                 // nothing after it: drop
    if (!out.length) { const p = run.find((x) => /^(in|into|with)$/i.test(x)); if (p) out.push(p.charAt(0).toUpperCase() + p.slice(1)); continue; }
    if (run.length === 1) { out.push(run[0]); continue; }
    out.push(KEEP.find((k) => run.some((x) => x.toLowerCase() === k)) || run[run.length - 1]);
  }
  t = out.join(' ').replace(/\s+([,:;])/g, '$1').replace(/^[,\s]+|[,\s.]+$/g, '');
  if (t.length < 4) t = (sentences(step)[0] || String(step)).replace(/[.]$/, '');
  return t.length > 48 ? t.slice(0, 46).replace(/\s+\S*$/, '') + '…' : t;
}

/**
 * → { setup: [labels across the top], rows: [ingredient lines in table order], cells: [{ row, rows, col, cols, text, full, kind }], cols }
 * row/col are 0-based grid positions; kind: 'ing' | 'step' | 'gap'
 */
/** Tips, swaps, serving notes and asides: not steps, so they get no box. */
const NOTE = /^(?:\(|note\b|tip\b|\*|you can\b|you could\b|you may\b|if you\b|if (?:using|desired|preferred|needed)\b|alternatively\b|optional(?:ly)?\b|feel free\b|or\s|for (?:a|an|extra|more)\b[^,]*\b(?:version|flavou?r|heat|kick|twist)|this (?:recipe|dish|can|will|is)\b|it (?:can|will|is)\b|leftovers\b|store\b|keeps?\b|serves?\s+\d|makes?\s+\d|enjoy\b|recipe (?:from|by|adapted)|adapted from|source\b)|\bin place of\b|\binstead of\b|\bcan be (?:made|frozen|stored|substituted|swapped)\b|\bwill keep\b/i;
const isNote = (s) => NOTE.test(String(s).replace('\u0001', '').trim());
/** Drop tips, and the sentences that follow a tip in the same step (until a new step was glued on by the importer). */
const sentences = (step) => rawSentences(step).map((x) => x.replace('\u0001', ''));
function dropNotes(list) {
  let skip = false; const out = [];
  for (const x of list) {
    if (x.startsWith('\u0001')) skip = false;
    if (isNote(x)) { skip = true; continue; }
    if (!skip) out.push(x.replace('\u0001', ''));
  }
  return out;
}

export function buildFlow(r) {
  const ing = (r?.ing || []).map(String).filter((x) => x.trim() && !/:\s*$/.test(x));
  if (ing.length < 2 || !(r?.steps || []).length) return null;
  const keys = ing.map(keysOf);
  // one step per sentence, unless that makes it unreadably wide
  let steps = (r.steps || []).flatMap((st) => dropNotes(rawSentences(st))).filter((s) => s.split(/\s+/).length >= 3);
  if (steps.length > 12) steps = (r.steps || []).map((st) => dropNotes(rawSentences(st)).join(' ')).filter((x) => x.split(/\s+/).length >= 3);
  const leaves = ing.map((line, i) => ({ leaf: i, col: 0, used: false }));
  let roots = [...leaves];
  const setup = [];
  const top = (n) => { while (n.parent) n = n.parent; return n; };
  for (const st of steps) {
    const text = ` ${st.toLowerCase().replace(/[^a-z' ]/g, ' ')} `;
    const words = new Set(text.split(/\s+/).filter(Boolean).map(sing));
    const hit = keys.map((k, i) => (k.length && k.some((w) => words.has(w)) ? i : -1)).filter((i) => i >= 0);
    let groups = [...new Set(hit.map((i) => top(leaves[i])))];
    const started = roots.some((n) => n.used);
    // getting the kitchen ready ("Butter and flour a loaf pan", "Preheat the oven") goes across the top
    if (!started && (SETUP.test(st) || (/\b(pan|dish|baking sheet|sheet pan|tin|oven|skillet|grill|pot)\b/i.test(st) && !/\b(add|stir|mix|whisk|cook|bake|fry)\b/i.test(st)))) { setup.push({ text: labelOf(st, []), full: st }); continue; }
    if (!groups.length) {
      if (!started) { setup.push({ text: labelOf(st, []), full: st }); continue; }
      groups = [...roots];   // "Fold", "Bake 55 min", "Let cool": everything so far
    }
    const names = hit.flatMap((i) => keys[i]);
    const node = { kids: groups, col: Math.max(...groups.map((g) => g.col)) + 1, label: labelOf(st, names), full: st, used: true };
    groups.forEach((g) => { g.parent = node; g.used = true; });
    const at = roots.indexOf(groups[0]);
    roots = roots.filter((n) => !groups.includes(n));
    roots.splice(Math.min(at, roots.length), 0, node);
  }
  if (!roots.some((n) => n.leaf === undefined)) return null;   // no step joined anything
  // lay the leaves out so every block covers a run of rows
  const order = [];
  const walk = (n) => { if (n.leaf !== undefined) order.push(n); else n.kids.forEach(walk); };
  roots.forEach(walk);
  order.forEach((n, i) => (n.row = i));
  const span = (n) => (n.leaf !== undefined ? [n.row, n.row] : n.kids.map(span).reduce((a, b) => [Math.min(a[0], b[0]), Math.max(a[1], b[1])]));
  const cells = [], cols = Math.max(...roots.map((n) => n.col)) + 1;
  const place = (n) => {
    const [a, b] = span(n);
    if (n.leaf !== undefined) cells.push({ row: a, rows: 1, col: 0, cols: 1, text: ing[n.leaf], kind: 'ing' });
    else { cells.push({ row: a, rows: b - a + 1, col: n.col, cols: 1, text: n.label, full: n.full, kind: 'step' }); n.kids.forEach(place); }
    // empty space between this block and the step that uses it
    const to = n.parent ? n.parent.col : cols;
    if (to - n.col > 1) cells.push({ row: a, rows: b - a + 1, col: n.col + 1, cols: to - n.col - 1, text: '', kind: 'gap' });
  };
  roots.forEach(place);
  return { setup, rows: order.map((n) => ing[n.leaf]), cells, cols };
}

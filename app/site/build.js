// Builds the public pages of wfdmeals.app (home, recipes, guides, about, sitemap) as plain HTML:
// readable without signing in or running the app, which search engines and Google AdSense need.
import { RECIPES, GUIDES } from './content.js';
import { buildFlow } from '../src/lib/flow.js';
import { nutritionOf } from '../src/lib/nutrition.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const CSS = `
:root{--bg:#f6f4ee;--card:#fffefb;--ink:#1b2433;--muted:#667085;--line:#e2e1da;--tint:#ebeee9;--accent:#1f5fd1;--accent-dark:#174aa6;--accent-soft:#e7eefb}
*{box-sizing:border-box}body{margin:0;font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg)}
a{color:var(--accent)}h1,h2,h3{font-family:Georgia,"Times New Roman",serif;line-height:1.2}h1{font-size:34px;margin:8px 0 10px}h2{font-size:23px;margin:30px 0 8px}
.wrap{max-width:860px;margin:0 auto;padding:0 20px}
.top{background:var(--card);border-bottom:1px solid var(--line)}.top .wrap{display:flex;align-items:center;gap:16px;height:60px}
.brand{display:flex;align-items:center;gap:9px;font-weight:700;color:var(--ink);text-decoration:none;font-family:Georgia,serif;font-size:19px}.brand img{width:32px;height:32px;border-radius:8px}
.top nav{display:flex;gap:16px;margin-left:auto;align-items:center}.top nav a{color:var(--ink);text-decoration:none;font-weight:600;font-size:15px}
.btn{display:inline-block;background:var(--accent);color:#fff!important;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:999px;border:0;font-size:16px;cursor:pointer}
.btn.ghost{background:var(--card);color:var(--accent)!important;border:1px solid var(--line)}.btn.sm{padding:7px 14px;font-size:14px}
.muted{color:var(--muted)}.small{font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:14px 0}
.hero{padding:44px 0 18px}.hero h1{font-size:42px}.hero p{font-size:19px;max-width:620px}.cta{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 6px}
.feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:18px 0}.feat h3{margin:4px 0 6px;font-size:20px}.feat p{margin:0}
.shots{display:flex;gap:14px;overflow-x:auto;padding:6px 2px 14px;scroll-snap-type:x mandatory}.shots img{height:440px;border-radius:18px;box-shadow:0 6px 24px rgba(20,40,90,.18);scroll-snap-align:start}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}.tile{display:block;text-decoration:none;color:var(--ink)}.tile h3{margin:0 0 4px;font-size:19px}.tile p{margin:0;font-size:15px}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 4px}.meta span{background:var(--tint);border-radius:999px;padding:3px 11px;font-size:14px}
.facts{display:flex;gap:18px;flex-wrap:wrap;font-size:15px}.facts b{font-size:19px;display:block}
.ing li{margin:3px 0}.steps li{margin:8px 0}
.flow-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);margin:8px 0}
.flow{display:grid;width:max-content;min-width:100%}
.fc{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:6px 8px;font-size:13px;line-height:1.3;display:flex;align-items:center;min-height:34px}
.fc.step{justify-content:center;text-align:center;background:var(--accent-soft);color:var(--accent-dark);font-weight:600}
.stack{list-style:none;margin:8px 0;padding:0}.stack li{border-left:2px solid var(--accent-soft);padding:0 0 10px 16px;position:relative}.stack li:last-child{border-left-color:transparent}
.stack .s{display:block;background:var(--accent-soft);color:var(--accent-dark);font-weight:600;font-size:15px;padding:8px 11px;border-radius:10px}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px}.chip{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:2px 9px;font-size:13px}
.setup{display:flex;flex-wrap:wrap;gap:6px}.setup span{background:var(--tint);border-radius:999px;padding:5px 11px;font-size:14px}
.ad{margin:22px 0;min-height:100px;text-align:center}.ad .lbl{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.try{background:var(--accent-soft);border-radius:14px;padding:16px 18px;margin:24px 0}.try h3{margin:0 0 6px}
footer{border-top:1px solid var(--line);margin-top:40px;padding:22px 0 40px;font-size:14px;color:var(--muted)}footer a{margin-right:14px}
@media(max-width:600px){.top nav a.hide{display:none}.hero h1{font-size:32px}h1{font-size:28px}.shots img{height:360px}}
`;

const nav = `<header class="top"><div class="wrap"><a class="brand" href="/"><img src="/icon.svg" alt="">WFD Meals</a>
<nav><a class="hide" href="/recipes/">Recipes</a><a class="hide" href="/guides/">Guides</a><a class="hide" href="/about/">About</a><a class="btn sm" href="/#login">Open WFD</a></nav></div></header>`;
const foot = `<footer><div class="wrap"><a href="/recipes/">Recipes</a><a href="/guides/">Guides</a><a href="/about/">About</a><a href="/privacy.html">Privacy</a><a href="/support.html">Help</a><a href="mailto:support@wfdmeals.app">support@wfdmeals.app</a>
<p>© ${new Date().getFullYear()} WFD Meals. Nutrition is estimated from the ingredients and isn't medical advice.</p></div></footer>`;

/** An AdSense ad (only on content pages, never next to buttons). */
const ad = (client, slot) => (client && slot ? `<div class="ad"><div class="lbl">Advertisement</div><ins class="adsbygoogle" style="display:block" data-ad-client="${client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>` : '');

function page({ title, desc, path, body, site, ads, jsonld }) {
  const url = site + path.replace(/^\//, '');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:type" content="website">
<meta name="theme-color" content="#1f5fd1"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
${ads.client ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.client}" crossorigin="anonymous"></script>` : ''}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
<style>${CSS}</style></head><body>${nav}<main class="wrap">${body}</main>${foot}</body></html>`;
}

function flowHtml(r) {
  const f = buildFlow(r);
  if (!f) return '';
  let h = f.setup.length ? `<div class="setup">${f.setup.map((s) => `<span>🔧 ${esc(s.text)}</span>`).join('')}</div>` : '';
  if (f.mode === 'grid') {
    h += `<div class="flow-wrap"><div class="flow" style="grid-template-columns:minmax(130px,190px) repeat(${f.cols - 1},minmax(100px,140px))">` +
      f.cells.map((c) => `<div class="fc ${c.kind}" style="grid-row:${c.row + 1} / span ${c.rows};grid-column:${c.col + 1} / span ${c.cols}"${c.full ? ` title="${esc(c.full)}"` : ''}>${esc(c.text)}</div>`).join('') + '</div></div>';
  } else {
    h += '<ol class="stack">' + f.stack.map((s) => `<li>${s.adds.length ? `<div class="chips">${s.adds.map((a) => `<span class="chip">${esc(a)}</span>`).join('')}</div>` : ''}<span class="s">${esc(s.text)}</span></li>`).join('') + '</ol>';
  }
  if (f.also.length) h += `<p class="small muted"><b>Also:</b> ${f.also.map(esc).join(' · ')}</p>`;
  return h;
}

const tryBox = (what) => `<div class="try"><h3>Plan it with WFD</h3><p style="margin:0 0 10px">${what}</p><a class="btn" href="/#guest">Try it free, no account needed</a> <a class="btn ghost" href="/#signup">Create an account</a></div>`;

function recipePage(r, o) {
  const n = nutritionOf({ ...r, servings: r.serves });
  const facts = n?.ok !== false && n ? `<div class="facts"><div><b>${n.kcal}</b>calories</div><div><b>${n.protein} g</b>protein</div><div><b>${n.carbs} g</b>carbs</div><div><b>${n.fat} g</b>fat</div></div><p class="small muted">Per serving, estimated from the ingredients.</p>` : '';
  const body = `<p class="small" style="margin-top:18px"><a href="/recipes/">← All recipes</a></p>
<h1>${esc(r.title)}</h1><div class="meta"><span>${esc(r.meal)}</span><span>${esc(r.cuisine)}</span><span>Serves ${r.serves}</span><span>${esc(r.time)}</span></div>
<p>${esc(r.intro)}</p>
<div class="card">${facts}</div>
<h2>Ingredients</h2><ul class="ing">${r.ing.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
${ad(o.ads.client, o.ads.slot)}
<h2>Steps</h2><ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
<h2>At a glance</h2><p class="small muted">The same recipe as a flow chart: ingredients on the left, and each step joins the ones it uses.</p>${flowHtml(r)}
${r.tips?.length ? `<h2>Tips</h2><ul>${r.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
${r.keeps ? `<p><b>Keeps:</b> ${esc(r.keeps)}</p>` : ''}
${tryBox('Add this to your week, get a shopping list sorted by store with prices, and cook it step by step with timers.')}
${ad(o.ads.client, o.ads.slot)}`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'Recipe', name: r.title, description: r.intro, recipeYield: `${r.serves} servings`, recipeCategory: r.meal, recipeCuisine: r.cuisine,
    recipeIngredient: r.ing, recipeInstructions: r.steps.map((t) => ({ '@type': 'HowToStep', text: t })), author: { '@type': 'Organization', name: 'WFD Meals' },
    ...(n ? { nutrition: { '@type': 'NutritionInformation', calories: `${n.kcal} calories`, proteinContent: `${n.protein} g`, carbohydrateContent: `${n.carbs} g`, fatContent: `${n.fat} g` } } : {}) };
  return page({ title: `${r.title} · WFD Meals`, desc: r.intro, path: `/recipes/${r.slug}/`, body, site: o.site, ads: o.ads, jsonld });
}

function guidePage(g, o) {
  const body = `<p class="small" style="margin-top:18px"><a href="/guides/">← All guides</a></p><h1>${esc(g.title)}</h1><p class="muted">${esc(g.summary)}</p>
${g.body}${ad(o.ads.client, o.ads.slot)}${tryBox('Plan the week, shop it in the fewest, cheapest stops, and cook it all at once.')}`;
  return page({ title: `${g.title} · WFD Meals`, desc: g.summary, path: `/guides/${g.slug}/`, body, site: o.site, ads: o.ads });
}

const recipeTile = (r) => `<a class="card tile" href="/recipes/${r.slug}/"><h3>${esc(r.title)}</h3><p class="muted">${esc(r.meal)} · ${esc(r.time)} · serves ${r.serves}</p></a>`;
const guideTile = (g) => `<a class="card tile" href="/guides/${g.slug}/"><h3>${esc(g.title)}</h3><p class="muted">${esc(g.summary)}</p></a>`;

/** The home page, written into index.html before the app loads (people who are signed in go straight to the app). */
export function landingHtml() {
  return `<div id="landing">${nav}<main class="wrap">
<section class="hero"><h1>What's for dinner? Sorted for the week.</h1>
<p>WFD plans your week of meals, builds one shopping list priced across your nearby stores with the cheapest route, and walks you through cooking it all at once.</p>
<div class="cta"><a class="btn" href="#guest">Try it free, no account needed</a><a class="btn ghost" href="#signup">Create an account</a><a class="btn ghost" href="#login">Sign in</a></div>
<p class="small muted">Free to use. Guest mode keeps your plan in this browser for 14 days; an account keeps it for good and works on every device.</p></section>
<div class="shots"><img src="/shots/plan.webp" alt="WFD planning screen: a week of meals with calories and protein" width="203" height="440"><img src="/shots/shop.webp" alt="WFD shopping list with the cheapest trip across stores" width="203" height="440"><img src="/shots/prep.webp" alt="WFD cook-day steps with timers" width="203" height="440"><img src="/shots/recipes.webp" alt="WFD saved recipes with nutrition" width="203" height="440"><img src="/shots/pantry.webp" alt="WFD pantry" width="203" height="440"></div>
<div class="feats">
<div class="card feat"><h3>📅 Plan the week</h3><p>Pick meals, or let WFD pick for you around your diets and goals. It spreads them across the days and plans leftovers on purpose.</p></div>
<div class="card feat"><h3>🛒 Shop it for less</h3><p>One list, priced at the stores near you. WFD splits it across stores only when the savings beat the drive, and maps the route.</p></div>
<div class="card feat"><h3>🔪 Cook it all at once</h3><p>A single step-by-step cook day for the whole week, with timers that start themselves for the hands-off steps.</p></div>
<div class="card feat"><h3>🥫 Use what you have</h3><p>Keep a pantry, scan barcodes, and get recipe ideas that use up what's in the fridge before it goes bad.</p></div>
</div>
<h2>Recipes</h2><div class="grid">${RECIPES.slice(0, 6).map(recipeTile).join('')}</div><p><a href="/recipes/">All recipes →</a></p>
<h2>Guides</h2><div class="grid">${GUIDES.map(guideTile).join('')}</div>
</main>${foot}</div>`;
}
/** The site's styles limited to the home page block, so they can't clash with the app's own styles on the same page. */
export function landingCss() {
  const scope = (css) => css.replace(/([^{}@]+)\{([^{}]*)\}/g, (m, sel, rules) => {
    const out = sel.split(',').map((x) => x.trim()).filter(Boolean).map((x) => (x === ':root' ? '#landing' : x === 'body' ? '#landing' : x === '*' ? '#landing,#landing *' : `#landing ${x}`)).join(',');
    return `${out}{${rules}}`;
  });
  // keep @media wrappers, scope what's inside them
  return CSS.replace(/@media([^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g, (m, q, inner) => `@media${q}{${scope(inner)}}`)
    .split(/(@media[^{]+\{(?:[^{}]*\{[^{}]*\})*\s*\})/).map((part) => (part.startsWith('@media') ? part : scope(part))).join('');
}

/** Every public page: [path, html] pairs, plus the sitemap and robots.txt. */
export function publicFiles({ site, ads }) {
  const o = { site, ads };
  const files = [];
  for (const r of RECIPES) files.push([`recipes/${r.slug}/index.html`, recipePage(r, o)]);
  for (const g of GUIDES) files.push([`guides/${g.slug}/index.html`, guidePage(g, o)]);
  files.push(['recipes/index.html', page({ title: 'Recipes · WFD', desc: 'Weeknight dinners and make-ahead breakfasts, each with nutrition and a flow chart you can cook from.', path: '/recipes/', site, ads,
    body: `<h1 style="margin-top:24px">Recipes</h1><p class="muted">Weeknight dinners and make-ahead breakfasts, written for real weeknights. Each one has estimated nutrition and a flow chart you can cook from.</p><div class="grid">${RECIPES.map(recipeTile).join('')}</div>${ad(ads.client, ads.slot)}` })]);
  files.push(['guides/index.html', page({ title: 'Guides · WFD', desc: 'Short guides to planning meals, prepping ahead and spending less on groceries.', path: '/guides/', site, ads,
    body: `<h1 style="margin-top:24px">Guides</h1><p class="muted">Short, practical guides to planning, prepping and shopping.</p><div class="grid">${GUIDES.map(guideTile).join('')}</div>` })]);
  files.push(['about/index.html', page({ title: 'About WFD Meals', desc: 'WFD Meals is a small, independent app for planning, shopping and cooking a week of meals.', path: '/about/', site, ads,
    body: `<h1 style="margin-top:24px">About WFD Meals</h1>
<p><b>WFD Meals</b> is a small, independent app for families and anyone who cooks for a household. It started from a simple frustration: deciding what to make every night, then making three trips to the store to make it.</p>
<p>WFD puts the whole week in one place. You plan the meals once; WFD builds one shopping list, prices it at the stores near you and finds the cheapest trip, then turns the week's recipes into a single cook-day plan. It keeps track of your pantry, so you buy only what you need.</p>
<h2>What it costs</h2><p>WFD is free to use, with ads. <b>WFD Plus</b> removes the ads. You can try everything without an account; guest data is kept for 14 days.</p>
<h2>The recipes and guides</h2><p>The recipes and guides on this site are written for WFD. Nutrition is estimated from the ingredients and is a guide, not medical advice.</p>
<h2>Contact</h2><p>Questions, bugs or ideas: email <a href="mailto:support@wfdmeals.app">support@wfdmeals.app</a> or use <a href="/support.html">the help page</a>. See our <a href="/privacy.html">privacy policy</a> for what we store and how to delete it.</p>
${tryBox('Plan the week, shop it in the fewest, cheapest stops, and cook it all at once.')}` })]);
  const urls = ['', 'recipes/', 'guides/', 'about/', 'privacy.html', 'support.html', ...RECIPES.map((r) => `recipes/${r.slug}/`), ...GUIDES.map((g) => `guides/${g.slug}/`)];
  files.push(['sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${site}${u}</loc></url>`).join('\n')}\n</urlset>\n`]);
  files.push(['robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`]);
  return files;
}

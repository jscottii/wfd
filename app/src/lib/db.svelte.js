// Data layer: Supabase auth, loading, live sync, and every write the app makes.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_URL } from './config.js';
import { estimateFor, chainFactor } from './estimate.js';
import { STORES_SEED, ITEMS_SEED, RECIPES, RECIPE_SERVINGS_SEED, RECIPE_ITEMS_SEED, HOME_DEFAULT, PANTRY_CHECK, SOURCE_URL, TIMELINE, STORAGE } from './seed.js';
import { neededUnits, planPortions, parseBareMinimum, buildImport, parsePrepGuide, slug_ } from './planner.js';
import { placeFor, useByFor, covers } from './pantry.js';
import { NOT_FOUND_DAYS, RECEIPT_FRESH_DAYS } from './receipts.js';
import { titleMatches_ } from './optimizer.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });

export const DEFAULT_SETTINGS = {
  audience: 'household', units: 'imperial', storeRadius: 25, homeAddress: HOME_DEFAULT, mpg: 28, gasPrice: 5.6, timeValue: 5, stopMinutes: 12, maxStores: 3,
  costcoMember: false, costcoMode: 'pack', enabledStores: ['sbf', 'tj', 'tgt', 'costco'],
  householdSize: 3, nearestStores: true, serpMonthlyLimit: 230, serpLocation: '', pantry: PANTRY_CHECK, sourceUrl: SOURCE_URL
};

export const app = $state({ pantry: [],
  ready: false, session: null, user: null, household: null, error: '', toast: '',
  settings: { ...DEFAULT_SETTINGS }, stores: [], items: [], prices: {}, recipes: [], plan: { household: 3, days: [] }, purchases: [],
  members: [], invites: [], hasSerpKey: false, hasInstacartKey: false, households: [], myInvites: [], pendingJoin: null, weeks: [], carts: [], serpUsage: { n: 0, limit: 230 }, plus: false, canPay: false, canWalmart: false, isAdmin: false, canVision: false
});

/* ---------------- derived helpers ---------------- */
// spices, sauces and other jars last for many batches: one is enough however many times the recipe is made
const ONE_WILL_DO = /^(jar|bottle|box|container|5 lb|4 lb|2 lb|42 oz|48 oz|17 oz|15 oz|16 oz|12 oz|7 oz|9 oz|5 oz|2 oz bottle|4 oz jar|8 oz|30 oz|20 oz)$/;
const SHELF = /spice|seasoning|sauce|paste|oil|vinegar|flour|sugar|starch|salt|honey|syrup|powder|masala|leaf|leaves|seeds?|extract|mirin|wine|sake|doubanjiang|cumin|paprika|cinnamon|nutmeg|oregano|turmeric|cardamom|anise|peppercorn|black pepper|baking/i;
export function need() {
  const n = neededUnits(app.recipes, app.plan);
  for (const id of Object.keys(n)) {
    const it = itemById(id); if (!it || n[id] <= 1) continue;
    const est = estimateFor(it.name);
    if (SHELF.test(it.name) && (!est || est.rough || ONE_WILL_DO.test(est.pack))) n[id] = 1;
  }
  // amounts you changed on the shopping list win (0 = don't buy it this week)
  for (const [id, v] of Object.entries(app.plan.buy || {})) { if (!(id in n)) continue; if (v > 0) n[id] = v; else delete n[id]; }
  return n;
}
export function portions() { return planPortions(app.plan, app.recipes); }
export function itemById(id) { return app.items.find((i) => i.id === id); }
/** Cheapest known price for one batch of an item, else a typical-price estimate (est: true). */
export function priceFor(id) {
  const row = app.prices[id] || {};
  const v = Object.values(row).map((e) => e?.price).filter((x) => x > 0);
  if (v.length) return { price: Math.min(...v), est: false };
  const it = itemById(id), e = it && estimateFor(it.name, it.cat);
  return e ? { price: e.price, est: true, pack: e.pack } : { price: 0, est: true };
}
export { estimateFor, chainFactor };
export function storeById(id) { return app.stores.find((s) => s.id === id); }
export function recipeById(id) { return app.recipes.find((r) => r.id === id); }
export function toast(msg) { app.toast = msg; setTimeout(() => { if (app.toast === msg) app.toast = ''; }, 3500); }
function fail(e) { const m = (e && (e.message || e.error_description)) || String(e); app.error = m; throw new Error(m); }
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (d) => (d ? (Date.now() - new Date(d).getTime()) / 864e5 : Infinity);

/* ---------------- row ↔ app shape ---------------- */
const toItem = (r) => ({ id: r.id, cat: r.cat, name: r.name, qty: r.qty, q: r.q, must: r.must || [], units: Number(r.units) || 1, have: !!r.have_on, haveOn: r.have_on || '' });
const toRecipe = (r) => ({ id: r.id, title: r.title, active: r.active, servings: Number(r.servings) || 0, yield: r.yield || '', when: r.meal || '', fridge: r.fridge || '', freeze: r.freeze || '',
  ing: r.ing || [], steps: r.steps || [], tip: r.tip || '', custom: r.custom, source: r.source || '', cuisine: r.cuisine || '', calories: Number(r.calories) || 0, image: r.image || '', nutrition: r.nutrition || null, items: r.items || {}, createdAt: r.created_at });
const fromRecipe = (r) => ({ id: r.id, title: r.title, active: !!r.active, servings: Number(r.servings) || null, yield: r.yield || '', meal: r.when || '', fridge: r.fridge || '', freeze: r.freeze || '',
  ing: r.ing || [], steps: r.steps || [], tip: r.tip || '', custom: !!r.custom, source: r.source || '', cuisine: r.cuisine || null, ...(Number(r.calories) ? { calories: Number(r.calories) } : {}), ...(r.image ? { image: r.image } : {}), ...(r.nutrition !== undefined ? { nutrition: r.nutrition } : {}), items: r.items || {} });
function setPrice(row) {
  const e = (app.prices[row.item_id] = app.prices[row.item_id] || {});
  e[row.store_id] = { price: row.price == null ? null : Number(row.price), unitPrice: row.unit_price, unitNeeded: row.unit_needed == null ? null : Number(row.unit_needed),
    source: row.source || '', matched: row.matched || '', updated: row.updated_at, checkedAt: row.checked_at, locked: row.locked,
    notFound: !!row.not_found_on && daysAgo(row.not_found_on) < NOT_FOUND_DAYS, notFoundOn: row.not_found_on || '' };
}

/* ---------------- auth ---------------- */
const authMsg = (m) => /invalid login/i.test(m) ? 'Wrong email or password.' : /already registered|already exists/i.test(m) ? 'That email already has an account — use Sign in.' : m;
export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(authMsg(error.message));
}
/** Forgot password: email a 6-digit reset code (no link, so email scanners can't use it up). */
export async function sendResetCode(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email.trim());
  if (error) throw new Error(/rate|seconds/i.test(error.message) ? 'Please wait a minute before asking for another code.' : error.message);
}
export async function resetWithCode(email, code, password) {
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.replace(/\D/g, ''), type: 'recovery' });
  if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'That code is wrong or expired. Send a new one.' : error.message);
  const { error: e2 } = await sb.auth.updateUser({ password });
  if (e2) throw new Error(e2.message);
}
export async function signUp(email, password) {
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(authMsg(error.message));
  if (!data.session) throw new Error('Account made, but email confirmation is still on in Supabase.');
}
/** Delete this sign-in (and the household's data if you're its last member). */
export async function deleteAccount() {
  const r = await callProxy({ action: 'delete-account', confirm: 'DELETE' });
  await sb.auth.signOut().catch(() => {});
  try { Object.keys(localStorage).filter((k) => k.startsWith('mp-') || k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k)); } catch {}
  return r;
}
export async function signOut() { await sb.auth.signOut(); location.reload(); }

/* ---------------- guests ---------------- */
/** Try WFD without an account: a private, throwaway sign-in for this browser only. Every guest gets their own household. */
export async function continueAsGuest() {
  const { error } = await sb.auth.signInAnonymously();
  if (error) throw new Error(/anonymous/i.test(error.message) ? 'Guest mode is turned off right now. Please create an account.' : error.message);
}
export const isGuest = () => !!app.user?.is_anonymous;
/** Turn this guest into a real account (same household, nothing lost). */
export async function saveGuestAccount(email, password) {
  const { data, error } = await sb.auth.updateUser({ email: email.trim(), password });
  if (error) throw new Error(/already|exists|registered/i.test(error.message) ? 'That email already has an account. Sign out of guest mode and sign in instead (your guest meals won\'t come with you).' : error.message);
  try { localStorage.setItem('mp-email', email.trim()); } catch {}
  const { data: s } = await sb.auth.refreshSession();
  app.session = s.session || app.session; app.user = s.session?.user || data.user || app.user;
  track('guest_saved');
}

/** A new "usually feeding" number flows through: this week's plan, upcoming weeks, and so recipe scaling and the shopping list. */
export async function setHouseholdSize(n) {
  n = Math.max(1, Number(n) || 1);
  const old = Number(app.plan.household) || Number(app.settings.householdSize) || 3;
  if (old !== n) {
    const { weeks: _old, ...rest } = app.plan;
    const plan = { ...rest, household: n, days: (app.plan.days || []).map((d) => ({ ...d, people: Number(d.people) === old ? n : d.people })) };
    const { error } = await sb.from('week_plan').upsert({ household_id: app.household, data: plan, updated_at: new Date().toISOString() });
    if (error) fail(error);
    app.plan = plan;
    for (const w of app.weeks) {
      const wo = Number(w.household) || old;
      if (wo === n) continue;
      await saveWeek({ ...w, household: n, days: (w.days || []).map((d) => ({ ...d, people: Number(d.people) === wo ? n : d.people })) });
    }
  }
}
/** Change a few fields of this week's plan (e.g. swap two nights, the serving time, where you're cooking). */
/** Change how many of an item to buy this week (null = back to what the recipes need). */
export async function setBuy(id, n) {
  const buy = { ...(app.plan.buy || {}) };
  if (n == null) delete buy[id]; else buy[id] = Math.max(0, Math.round(n));
  await patchPlan({ buy });
}
export async function patchPlan(patch) {
  const { weeks: _old, ...rest } = app.plan;
  const plan = { ...rest, ...patch };
  const { error } = await sb.from('week_plan').upsert({ household_id: app.household, data: plan, updated_at: new Date().toISOString() });
  if (error) fail(error);
  app.plan = plan;
}
/** Find photos for saved recipes that don't have one yet (recipe ideas by name; saved links from their page). */
let imagesTried = false;
export async function backfillImages() {
  if (imagesTried) return; imagesTried = true;
  const need = app.recipes.filter((r) => !r.image).slice(0, 25);
  for (const r of need) {
    let img = '';
    try {
      const name = r.title.replace(/\s*[(,].*$/, '').trim();
      const j = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`).then((x) => x.json());
      const hit = (j.meals || []).find((m) => m.strMeal.toLowerCase() === r.title.toLowerCase() || m.strMeal.toLowerCase() === name.toLowerCase());
      if (hit) img = hit.strMealThumb;
      if (!img && r.source && !/substack|bareminimum/i.test(r.source)) {
        const p = await callProxy({ action: 'recipe-url', url: r.source }).catch(() => null);
        const im = p?.recipes?.[0]?.image; img = (Array.isArray(im) ? im[0] : im)?.url || (Array.isArray(im) ? im[0] : im) || '';
        if (typeof img !== 'string') img = '';
      }
    } catch { /* no photo is fine */ }
    if (img) { r.image = img; await sb.from('recipes').update({ image: img }).eq('id', r.id).eq('household_id', app.household); }
  }
}
/** Usage analytics: a named event with a few details, kept in our own database (batched, never blocks the app). */
let evq = [], evt = 0;
export function track(name, props = {}) {
  if (!app.user) return;
  evq.push({ name, props, app_version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null });
  clearTimeout(evt); evt = setTimeout(flushEvents, 1500);
}
function flushEvents() { const rows = evq.splice(0); if (rows.length) sb.from('events').insert(rows).then(() => {}, () => {}); }
if (typeof window !== 'undefined') window.addEventListener('pagehide', flushEvents);
/** Clear this week's plan (saved recipes stay). */
export async function deletePlan() {
  const { weeks: _old, ...rest } = app.plan;
  const plan = { ...rest, days: [], prepDone: {}, timers: {} };
  const { error } = await sb.from('week_plan').upsert({ household_id: app.household, data: plan, updated_at: new Date().toISOString() });
  if (error) fail(error);
  app.plan = plan;
  const on = app.recipes.filter((r) => r.active).map((r) => r.id);
  if (on.length) await sb.from('recipes').update({ active: false }).in('id', on);
  app.recipes.forEach((r) => (r.active = false));
}
export async function start() {
  const { data } = await sb.auth.getSession();
  app.session = data.session; app.user = data.session?.user || null;
  sb.auth.onAuthStateChange((_e, s) => {
    const was = !!app.session; app.session = s; app.user = s?.user || null;
    if (s && !was) setTimeout(boot, 0);
  });
  if (app.session) await boot(); else app.ready = true;
}

async function boot() {
  try {
    app.error = '';
    // opened an invite link: a brand-new account joins that household instead of starting its own
    const code = pendingCode();
    // an invite link always adds you to that household and switches to it (even if you already have one)
    if (code) { const { error: je } = await sb.rpc('join_with_code', { code }); clearPendingCode(); if (je) app.error = je.message; }
    const { data, error } = await sb.rpc('ensure_household');
    if (error) fail(error);
    app.household = data.household_id;
    if (data.created) await seedHousehold();
    await loadAll();
    repairItems().catch(() => {});
    loadHouseholds();
    setTimeout(() => backfillImages().catch(() => {}), 4000);
    track('app_open', { native: !!(typeof __NATIVE__ !== 'undefined' && __NATIVE__) });
    sb.rpc('is_admin').then(({ data }) => (app.isAdmin = !!data));
    checkPendingJoin();
    subscribe();
  } catch (e) { app.error = String(e.message || e); }
  app.ready = true;
}

/** First sign-in: copy the starter stores, items, estimated prices and recipes into the new household. */
async function seedHousehold() {
  const stores = STORES_SEED.map((s, i) => ({ id: s.id, name: s.name, short: s.short, address: s.address, source: s.source, merchant: s.serpMerchant || null,
    hours: s.hours, ad: s.ad, bulk: !!s.bulk, enabled: s.enabled !== false, sort: i }));
  const items = ITEMS_SEED.map((x) => ({ id: x[0], cat: x[1], name: x[2], qty: x[3], q: x[5], must: x[6], units: x[7] }));
  const prices = [];
  const sids = new Set(STORES_SEED.map((s) => s.id));
  ITEMS_SEED.forEach((x) => Object.entries(x[8]).filter(([sid]) => sids.has(sid)).forEach(([sid, v]) => {
    const arr = Array.isArray(v);
    prices.push({ item_id: x[0], store_id: sid, price: arr ? v[0] : v, unit_needed: arr ? v[2] : null, matched: arr ? v[1] : null, source: 'estimate' });
  }));
  const recipes = RECIPES.map((r) => fromRecipe({ ...r, active: true, servings: RECIPE_SERVINGS_SEED[r.id], items: RECIPE_ITEMS_SEED[r.id] || {}, source: SOURCE_URL }));
  for (const [t, rows] of [['stores', stores], ['items', items], ['prices', prices], ['recipes', recipes]]) {
    const { error } = await sb.from(t).insert(rows); if (error) fail(error);
  }
  await sb.from('settings').insert({ data: DEFAULT_SETTINGS });
  await sb.from('week_plan').insert({ data: { household: 3, days: [] } });
}

/** One-time fix for things saved by the old importer: gram amounts counted as packages ("100g butter" → 100 packs),
 *  and unit words left on names ("G Melted Butter", "Tblsp Paprika"). Version 2 also fixes recipes. */
async function repairItems() {
  if ((app.settings.itemsRepaired || 0) >= 2) return;
  const UNIT = /^(g|gr|kg|ml|l|tblsp|tbsp|tbs|tsp|tablespoons?|teaspoons?|cups?|oz)\s+/i;
  const PREP = /^(?:(?:finely|roughly|thinly|freshly|lightly|coarsely)\s+)?(?:chopped|diced|sliced|grated|shredded|beaten|crushed|peeled|cubed|pounded to \S+ thickness|pounded|thin cut|melted|softened|packet(?: of)?)\s+/i;
  const fixName = (n) => { let x = String(n); for (let k = 0; k < 3; k++) x = x.replace(UNIT, '').replace(PREP, ''); return x.charAt(0).toUpperCase() + x.slice(1); };
  for (const it of app.items) {
    const name = fixName(it.name), units = Number(it.units) > 12 || UNIT.test(it.name) ? 1 : it.units;
    if (name === it.name && units === it.units) continue;
    const { error } = await sb.from('items').update({ name, units }).eq('id', it.id);
    if (!error) Object.assign(it, { name, units });
  }
  // a recipe needing more than 12 packages of one thing was a gram amount read as a count
  for (const r of app.recipes) {
    if (!Object.values(r.items || {}).some((u) => Number(u) > 12)) continue;
    const items = Object.fromEntries(Object.entries(r.items).map(([id, u]) => [id, Number(u) > 12 ? 1 : u]));
    const { error } = await sb.from('recipes').update({ items }).eq('id', r.id); if (!error) r.items = items;
  }
  await saveSettings({ itemsRepaired: 2 });
}
export async function loadAll() {
  const [st, s, i, p, r, w, pu, m, inv, key, use, pan, uw, ca] = await Promise.all([
    sb.from('settings').select('data').maybeSingle(),
    sb.from('stores').select('*').order('sort'),
    sb.from('items').select('*'),
    sb.from('prices').select('*'),
    sb.from('recipes').select('*').order('created_at'),
    sb.from('week_plan').select('data').maybeSingle(),
    sb.from('purchases').select('*').order('day', { ascending: false }).order('id', { ascending: false }).limit(600),
    sb.from('members').select('email,user_id'),
    sb.from('invites').select('email'),
    sb.rpc('has_serp_key'),
    sb.from('serp_usage').select('n').eq('month', new Date().toISOString().slice(0, 7)).maybeSingle(),
    sb.from('pantry').select('*').order('added_on', { ascending: false }),
    sb.from('upcoming_weeks').select('start, data').order('start'),
    sb.from('carts').select('*').eq('archived', false).order('created_at', { ascending: false })
  ]);
  for (const x of [st, s, i, p, r, w, pu]) if (x.error) fail(x.error);
  app.settings = { ...DEFAULT_SETTINGS, ...(st.data?.data || {}) };
  app.stores = s.data.map((x) => ({ ...x, serpMerchant: x.merchant }));
  app.items = i.data.map(toItem);
  app.prices = {}; p.data.forEach(setPrice);
  app.recipes = r.data.map(toRecipe);
  app.plan = { household: Number(app.settings.householdSize) || 3, days: [], ...(w.data?.data || {}) };
  app.purchases = pu.data;
  app.members = m.data || []; app.invites = inv.data || [];
  app.hasSerpKey = !!key.data;
  sb.rpc('has_instacart_key').then(({ data }) => (app.hasInstacartKey = !!data));
  sb.from('entitlements').select('plus').eq('user_id', app.user?.id).maybeSingle().then(({ data }) => (app.plus = !!data?.plus));
  callProxy({ action: 'capabilities' }).then((c) => { app.hasInstacartKey = !!c.instacart; app.hasSerpKey = !!c.serp; app.canWalmart = !!c.walmart; app.canPay = !!c.stripe; app.canVision = !!c.vision; }).catch(() => {});
  app.serpUsage = { n: use.data?.n || 0, limit: Number(app.settings.serpMonthlyLimit) || 230 };
  app.pantry = pan.error ? [] : pan.data;
  // trips now rank mainly on grocery cost: move the old $25/hr default for your time down to $5/hr
  if (Number(app.settings.timeValue) === 25 && !app.settings.timeValueSet) saveSettings({ timeValue: 5 }).catch(() => {});
  app.weeks = uw.error ? [] : uw.data.map((x) => ({ ...x.data, start: x.start }));
  app.carts = ca.error ? [] : ca.data;
}

let channel = null, reloadTimer = null;
function subscribe() {
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('household-' + app.household);
  ['items', 'prices', 'recipes', 'week_plan', 'purchases', 'settings', 'stores', 'pantry', 'upcoming_weeks', 'carts'].forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${app.household}` }, (ev) => {
      // small, frequent changes are applied directly; anything else triggers a quiet reload
      if (table === 'items' && ev.new?.id) { const k = app.items.findIndex((x) => x.id === ev.new.id); if (k >= 0) { app.items[k] = toItem(ev.new); return; } }
      if (table === 'prices' && ev.new?.item_id) { setPrice(ev.new); return; }
      if (table === 'upcoming_weeks') {
        if (ev.eventType === 'DELETE') { app.weeks = app.weeks.filter((x) => x.start !== ev.old?.start); return; }
        const wk = { ...ev.new.data, start: ev.new.start }, k = app.weeks.findIndex((x) => x.start === wk.start);
        if (k >= 0) app.weeks[k] = wk; else app.weeks = [...app.weeks, wk].sort((a, b) => a.start.localeCompare(b.start));
        return;
      }
      if (table === 'carts') {
        if (ev.eventType === 'DELETE' || ev.new?.archived) { app.carts = app.carts.filter((x) => x.id !== (ev.old?.id || ev.new?.id)); return; }
        const k = app.carts.findIndex((x) => x.id === ev.new.id);
        if (k >= 0) app.carts[k] = ev.new; else app.carts = [ev.new, ...app.carts];
        return;
      }
      if (table === 'pantry') {
        if (ev.eventType === 'DELETE') { app.pantry = app.pantry.filter((x) => x.id !== ev.old?.id); return; }
        const k = app.pantry.findIndex((x) => x.id === ev.new.id);
        if (k >= 0) app.pantry[k] = ev.new; else app.pantry = [ev.new, ...app.pantry];
        return;
      }
      if (table === 'week_plan' && ev.new?.data) { app.plan = { household: app.plan.household, days: [], ...ev.new.data }; return; }
      clearTimeout(reloadTimer); reloadTimer = setTimeout(() => loadAll().catch(() => {}), 600);
    });
  });
  channel.subscribe();
}

/* ---------------- writes ---------------- */
export async function saveSettings(patch) {
  const data = { ...app.settings, ...patch };
  const { error } = await sb.from('settings').upsert({ household_id: app.household, data, updated_at: new Date().toISOString() });
  if (error) fail(error);
  app.settings = data; app.serpUsage.limit = Number(data.serpMonthlyLimit) || 230;
}

/** Tick items off (or back on). Bought items leave the list until a new week starts. */
export async function setHave(itemIds, have, storeId, paid) {
  const day = have ? today() : null;
  const { error } = await sb.from('items').update({ have_on: day }).in('id', itemIds);
  if (error) fail(error);
  itemIds.forEach((id) => { const it = itemById(id); if (it) { it.have = !!have; it.haveOn = day || ''; } });
  if (have) await stockPantry(itemIds); else await unstockToday(itemIds);
  if (have && storeId) {
    const st = storeById(storeId);
    const rows = itemIds.map((id) => ({ day, store_id: storeId, store: st?.short, item_id: id, item: itemById(id)?.name, planned: paid?.[id] ?? null, status: 'Checked off' }));
    const { data, error: e2 } = await sb.from('purchases').insert(rows).select();
    if (e2) toast('Couldn’t record the price: ' + e2.message);
    if (!e2 && data) app.purchases = [...data, ...app.purchases];
  }
}

/* ---------------- the cart: what you've put in it this trip ---------------- */
const PACK = /^(each|pack|bag|box|can|jar|bottle|bunch|dozen|case|tray)$/;
/** Items checked off this week, with what each cost (what you typed, else the estimate). */
export function tripCart() {
  const wk = app.plan.weekOf || '9999';
  const back = (() => { const d = new Date(); d.setDate(d.getDate() - 10); return d.toISOString().slice(0, 10); })();
  const since = wk < back ? wk : back;   // a week started early has a "week of" in the future — don't let that hide this trip
  return app.items.filter((i) => i.have).map((i) => {
    const p = app.purchases.filter((x) => x.item_id === i.id && x.day >= (i.haveOn && i.haveOn < since ? i.haveOn : since) && x.status !== 'Not in stock').sort((a, b) => String(b.day).localeCompare(String(a.day)) || (b.id || 0) - (a.id || 0))[0];
    const paid = p ? (p.paid ?? p.planned) : null;
    return { item: i, p, paid: paid == null ? null : Number(paid), edited: p?.paid != null };
  });
}
export async function editPurchase(p, { qty, unit, unit_price, total }, item = null, storeId = null) {
  const paid = total ?? (unit_price != null ? Math.round(qty * unit_price * 100) / 100 : null);
  const patch = { qty, unit, unit_price, paid, status: 'Bought' };
  if (!p) {   // checked off before purchases were recorded: make the record now
    const st = storeId ? storeById(storeId) : null;
    const { data, error } = await sb.from('purchases').insert({ day: today(), store_id: storeId, store: st?.short || null, item_id: item.id, item: item.name, ...patch }).select().single();
    if (error) fail(error);
    app.purchases = [data, ...app.purchases]; p = data;
  } else {
    const { error } = await sb.from('purchases').update(patch).eq('id', p.id);
    if (error) fail(error);
  }
  Object.assign(p, patch);
  app.purchases = [...app.purchases];
  if (p.store_id && paid != null) {
    // package units: price of one package; weight/volume: the total for this amount, plus the price per unit
    const price = PACK.test(unit) && qty ? Math.round((paid / qty) * 100) / 100 : paid;
    await upsertPrices([{ item_id: p.item_id, store_id: p.store_id, price, unit_price: unit_price ?? null, source: 'you', locked: false, updated_at: new Date().toISOString() }]).catch(() => {});
  }
}

/* ---------------- project carts ---------------- */
export async function createCart({ name, people, event_date, budget }) {
  const row = { name: name.trim() || 'New cart', people: Number(people) || null, event_date: event_date || null, budget: budget === '' || budget == null ? null : Number(budget), recipes: [], lines: [] };
  const { data, error } = await sb.from('carts').insert(row).select().single();
  if (error) fail(error);
  app.carts = [data, ...app.carts.filter((c) => c.id !== data.id)];
  return data;
}
export async function saveCart(c) {
  const { id, name, people, event_date, budget, recipes, lines } = c;
  const { error } = await sb.from('carts').update({ name, people, event_date, budget, recipes, lines, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) fail(error);
  const k = app.carts.findIndex((x) => x.id === id); if (k >= 0) app.carts[k] = { ...app.carts[k], ...c };
}
export async function archiveCart(id) {
  const { error } = await sb.from('carts').update({ archived: true }).eq('id', id);
  if (error) fail(error);
  app.carts = app.carts.filter((c) => c.id !== id);
}
// cheapest real price, else a typical estimate (so carts and plan costs aren't $0)
export const cheapestPrice = (id) => priceFor(id).price;

/* ---------------- upcoming weeks (one row each) ---------------- */
// A week: { start: 'YYYY-MM-DD' (a Monday), household, days, selected }
export async function saveWeek(wk) {
  const { start, ...data } = wk;
  const { error } = await sb.from('upcoming_weeks').upsert({ household_id: app.household, start, data: { ...data, start }, updated_at: new Date().toISOString() });
  if (error) fail(error);
  const k = app.weeks.findIndex((x) => x.start === start);
  if (k >= 0) app.weeks[k] = wk; else app.weeks = [...app.weeks, wk].sort((a, b) => a.start.localeCompare(b.start));
}
export async function deleteWeek(start) {
  const { error } = await sb.from('upcoming_weeks').delete().eq('start', start);
  if (error) fail(error);
  app.weeks = app.weeks.filter((x) => x.start !== start);
}
/** Make an upcoming week the current one (same as "Start the week" on the Week tab). */
export async function startUpcoming(start) {
  const wk = app.weeks.find((w) => w.start === start);
  if (!wk) return;
  app.plan = { ...app.plan, weekOf: start };
  await savePlan({ household: wk.household, days: wk.days, selected: wk.selected || [], startNewWeek: true });
  await deleteWeek(start);
}

export async function savePlan({ household, shape, days, selected, startNewWeek, pantry, sourceUrl }) {
  const { weeks: _old, ...rest } = app.plan;
  const plan = { ...rest, household: Number(household) || 3, days, ...(shape ? { shape } : {}) };
  if (startNewWeek) { plan.prepDone = {}; plan.timers = {}; plan.buy = {}; }
  const { error } = await sb.from('week_plan').upsert({ household_id: app.household, data: plan, updated_at: new Date().toISOString() });
  if (error) fail(error);
  app.plan = plan;
  const on = new Set(selected || []);
  days.forEach((d) => ['breakfast', 'lunch', 'dinner', 'snack'].forEach((s) => { if (d[s]) on.add(d[s]); if (d[s + '_side']) on.add(d[s + '_side']); }));
  const toOn = app.recipes.filter((r) => on.has(r.id) && !r.active).map((r) => r.id);
  const toOff = app.recipes.filter((r) => !on.has(r.id) && r.active).map((r) => r.id);
  if (toOn.length) await sb.from('recipes').update({ active: true }).in('id', toOn);
  if (toOff.length) await sb.from('recipes').update({ active: false }).in('id', toOff);
  app.recipes.forEach((r) => (r.active = on.has(r.id)));
  const patch = { householdSize: plan.household };
  if (pantry) patch.pantry = pantry;
  if (sourceUrl) patch.sourceUrl = sourceUrl;
  await saveSettings(patch);
  if (startNewWeek) {
    await sb.from('items').update({ have_on: null }).not('have_on', 'is', null);
    app.items.forEach((i) => { i.have = false; i.haveOn = ''; });
  }
}

export async function setRecipeActive(id, active) {
  const { error } = await sb.from('recipes').update({ active }).eq('id', id);
  if (error) fail(error);
  const r = recipeById(id); if (r) r.active = active;
  if (!active && app.plan.days.some((d) => ['breakfast', 'lunch', 'dinner', 'snack'].some((s) => d[s] === id || d[s + '_side'] === id))) {
    const days = app.plan.days.map((d) => { const x = { ...d }; ['breakfast', 'lunch', 'dinner', 'snack'].forEach((s) => { if (x[s] === id) { x[s] = ''; delete x[s + '_side']; } if (x[s + '_side'] === id) delete x[s + '_side']; }); return x; });
    await savePlan({ household: app.plan.household, days, selected: app.recipes.filter((q) => q.active).map((q) => q.id) });
  }
}

/** Add or update one of your own recipes. newItems: [{name, cat, qty, units}] become shopping items. */
export async function saveRecipe(rec, newItems = []) {
  const items = { ...(rec.items || {}) };
  for (const n of newItems) {
    const base = n.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
    let id = base, k = 2; while (itemById(id)) id = base + '-' + k++;
    const word = n.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3).pop() || n.name.toLowerCase();
    const row = { id, cat: n.cat || 'Pantry', name: n.name, qty: n.qty || '1', q: n.name.toLowerCase(), must: [word], units: Number(n.units) || 1 };
    const { error } = await sb.from('items').insert(row); if (error) fail(error);
    app.items.push(toItem(row));
    items[id] = Number(n.units) || 1;
  }
  if (!rec.id) {
    const base = rec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    let id = base, k = 2; while (recipeById(id)) id = base + '-' + k++;
    rec.id = id; rec.custom = true; rec.active = rec.active !== false;
  }
  const row = fromRecipe({ ...rec, items });
  const { error } = await sb.from('recipes').upsert({ household_id: app.household, ...row });
  if (error) fail(error);
  const i = app.recipes.findIndex((r) => r.id === rec.id);
  const v = toRecipe({ ...row, meal: row.meal });
  if (i >= 0) app.recipes[i] = v; else app.recipes.push(v);
  return rec.id;
}
export async function deleteRecipe(id) {
  const { error } = await sb.from('recipes').delete().eq('id', id); if (error) fail(error);
  app.recipes = app.recipes.filter((r) => r.id !== id);
}

/* ---------------- the bare minimum ---------------- */
export async function callProxy(body) {
  const { data, error } = await sb.functions.invoke('proxy', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); msg = j.error || msg; } catch (_) {}
    if (/no household/i.test(msg)) msg = 'You’re not in a household yet, so nothing can be saved. Create one, or join one with an invite link or home code.';
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export async function listBareMinimum() {
  const { posts } = await callProxy({ action: 'bm-archive' });
  const imported = new Map();
  app.recipes.forEach((r) => { if (r.source) { const s = r.source.split('/p/')[1]; if (s) (imported.get(s) || imported.set(s, []).get(s)).push(r.id); } });
  return posts.filter((p) => /week of meals|meal plan|shopping list/i.test(p.title)).map((p) => ({ ...p, recipeIds: imported.get(p.slug) || null }));
}

/** Bring a week's recipes + shopping list into your library (switched off until you pick them). */
export async function importBareMinimum(slug) {
  const post = await callProxy({ action: 'bm-post', slug });
  const parsed = parseBareMinimum(post.html);
  if (!parsed.recipes.length) throw new Error(post.free ? "Couldn't find recipes in that post." : "That week is for paid subscribers, so its recipes can't be read here. Pick a free week.");
  const built = buildImport(parsed, app.items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, units: i.units })), 'bm' + String(post.date).slice(5).replace('-', ''));
  const url = post.url || `https://barefoodtim.substack.com/p/${slug}`;
  const newItems = built.items.filter((i) => i.isNew);
  if (newItems.length) {
    const rows = newItems.map((it) => ({ id: it.id, cat: it.cat, name: it.name, qty: it.qty || '1', q: it.q, must: it.must, units: it.units }));
    const { error } = await sb.from('items').insert(rows); if (error) fail(error);
    rows.forEach((r) => app.items.push(toItem(r)));
  }
  const recs = built.recipes.map((r) => fromRecipe({ ...r, active: false, source: url }));
  const { error } = await sb.from('recipes').upsert(recs.map((r) => ({ household_id: app.household, ...r })));
  if (error) fail(error);
  recs.forEach((r) => { const v = toRecipe({ ...r, meal: r.meal }); const k = app.recipes.findIndex((x) => x.id === r.id); if (k >= 0) app.recipes[k] = v; else app.recipes.push(v); });
  await keepGuide(url, post.title, post.html);
  return { title: post.title, url, recipeIds: recs.map((r) => r.id), newItems: newItems.length, reused: built.items.length - newItems.length, pantry: parsed.pantry.join(', ') };
}

/** Save recipes found online (a recipe link or the recipe finder) into your library, switched off until you pick them. */
export async function importRecipes(parsedList, prefix = 'web') {
  const out = [];
  parsedList.forEach(() => track('recipe_saved', { via: prefix === 'mdb' ? 'finder' : 'link' }));
  for (const parsed of parsedList) {
    const built = buildImport(parsed, app.items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, units: i.units })), prefix);
    const newItems = built.items.filter((i) => i.isNew);
    if (newItems.length) {
      const rows = newItems.map((it) => ({ id: it.id, cat: it.cat, name: it.name, qty: it.qty || '1', q: it.q, must: it.must, units: it.units }));
      const { error } = await sb.from('items').upsert(rows.map((r) => ({ household_id: app.household, ...r })), { onConflict: 'household_id,id', ignoreDuplicates: true }); if (error) fail(error);
      rows.forEach((r) => { if (!app.items.some((x) => x.id === r.id)) app.items.push(toItem(r)); });
    }
    const src = parsed.recipes[0];
    const recs = built.recipes.map((r) => fromRecipe({ ...r, active: false, source: src.url || '', cuisine: src.cuisine || '', calories: src.calories || null, image: src.image || '' }));
    const { error } = await sb.from('recipes').upsert(recs.map((r) => ({ household_id: app.household, ...r })));
    if (error) fail(error);
    recs.forEach((r) => { const v = toRecipe(r); const k = app.recipes.findIndex((x) => x.id === r.id); if (k >= 0) app.recipes[k] = v; else app.recipes.push(v); out.push(v); });
  }
  return out;
}
export async function importRecipeUrl(url) {
  const { recipes } = await callProxy({ action: 'recipe-url', url });
  if (!recipes?.length) throw new Error("That page doesn't share its recipe in a standard way. Try another site, or add it by hand.");
  const { fromJsonLd } = await import('./discover.js');
  return importRecipes(recipes.slice(0, 1).map((r) => fromJsonLd(r, url)));
}

/* ---------------- cook-day (bulk prep) guide ---------------- */
async function keepGuide(url, title, html) {
  const g = parsePrepGuide(html);
  if (!g.sections.length) return null;
  const guide = { title, url, sections: g.sections, saved: today() };
  await saveSettings({ prepGuides: { ...(app.settings.prepGuides || {}), [url]: guide } });
  return guide;
}
const SEED_GUIDE = {
  title: 'A Full Week of Meals + A Shopping List', url: SOURCE_URL,
  sections: [
    { title: 'Clock-Time Timeline', kind: 'timeline', items: TIMELINE.map(([time, text]) => ({ time, label: '', text })) },
    { title: 'What to Freeze', kind: 'list', items: STORAGE.freeze.map((text) => ({ time: '', label: '', text })).concat(STORAGE.noFreeze.map((x) => ({ time: '', label: "Don't freeze", text: x }))) },
    { title: 'Easy Swaps', kind: 'list', items: STORAGE.swaps.map(([label, text]) => ({ time: '', label, text })) },
    { title: 'Use Up the Leftovers', kind: 'list', items: STORAGE.leftovers.map((text) => ({ time: '', label: '', text })) }
  ]
};
/** The saved guide for a recipe source (the starter week has one built in). */
export function guideFor(url) {
  if (!url) return null;
  return app.settings.prepGuides?.[url] || (url === SOURCE_URL ? SEED_GUIDE : null);
}
/** Fetch the guide for a week imported before guides were kept. */
export async function loadGuide(url) {
  const slug = String(url).split('/p/')[1]?.split(/[?#/]/)[0];
  if (!slug) throw new Error('That recipe didn\'t come from a Bare Minimum post.');
  const post = await callProxy({ action: 'bm-post', slug });
  const g = await keepGuide(url, post.title, post.html);
  if (!g) throw new Error(post.free ? 'That post has no cook-day plan.' : 'That week is for paid subscribers, so its plan can\'t be read here.');
  return g;
}
/** Tick a cook-day step on or off (shared with the other phone). */
/** Cook-day progress for a project cart (kept on the cart; running timers still live on the plan so the timer dock sees them). */
export async function patchCartMeta(id, patch) {
  const c = app.carts.find((x) => x.id === id); if (!c) return;
  const meta = { ...(c.meta || {}), ...patch };
  const { error } = await sb.from('carts').update({ meta, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) fail(error);
  c.meta = meta; app.carts = [...app.carts];
}
export async function updateCartPrep(id, on = [], off = [], timers = {}) {
  const c = app.carts.find((x) => x.id === id); if (!c) return;
  const prepDone = { ...(c.meta?.prepDone || {}) };
  on.forEach((k) => (prepDone[k] = 1)); off.forEach((k) => delete prepDone[k]);
  const all = { ...(app.plan.timers || {}) };
  on.forEach((k) => { if (timers[k] && !all[k]) all[k] = { ...timers[k], start: Date.now() }; }); off.forEach((k) => delete all[k]);
  await patchCartMeta(id, { prepDone });
  if (Object.keys(timers).length || off.some((k) => app.plan.timers?.[k])) {
    const plan = { ...app.plan, timers: all }; app.plan = plan;
    await sb.from('week_plan').upsert({ household_id: app.household, data: plan, updated_at: new Date().toISOString() });
  }
}
export async function setPrepDone(key, on, timer) {
  return updatePrep(on ? [key] : [], on ? [] : [key], timer ? { [key]: timer } : {});
}
/**
 * Tick cook-day steps on/off and start/stop their timers in one save (shared with the other phone).
 * timers: { key: { label, mins, maxMins } } start when the step is ticked; unticking a step stops its timer.
 */
export async function updatePrep(on = [], off = [], timers = {}) {
  const prepDone = { ...(app.plan.prepDone || {}) }, all = { ...(app.plan.timers || {}) };
  on.forEach((k) => { prepDone[k] = 1; if (timers[k] && !all[k]) all[k] = { ...timers[k], start: Date.now() }; });
  off.forEach((k) => { delete prepDone[k]; delete all[k]; });
  const plan = { ...app.plan, prepDone, timers: all };
  app.plan = plan;
  const { error } = await sb.from('week_plan').upsert({ household_id: app.household, data: plan, updated_at: new Date().toISOString() });
  if (error) fail(error);
}
export async function clearTimer(key) {
  const all = { ...(app.plan.timers || {}) }; delete all[key];
  const plan = { ...app.plan, timers: all };
  app.plan = plan;
  const { error } = await sb.from('week_plan').upsert({ household_id: app.household, data: plan, updated_at: new Date().toISOString() });
  if (error) fail(error);
}

/* ---------------- prices ---------------- */
export async function upsertPrices(rows) {
  if (!rows.length) return;
  const { error } = await sb.from('prices').upsert(rows.map((r) => ({ household_id: app.household, ...r })));
  if (error) fail(error);
  rows.forEach((r) => setPrice({ ...(priceRow(r.item_id, r.store_id)), ...r }));
}
function priceRow(itemId, storeId) {
  const e = app.prices[itemId]?.[storeId]; if (!e) return {};
  return { price: e.price, unit_needed: e.unitNeeded, source: e.source, matched: e.matched, updated_at: e.updated, checked_at: e.checkedAt, locked: e.locked, not_found_on: e.notFoundOn || null };
}
export async function setPriceByHand(itemId, storeId, price, lock = true) {
  await upsertPrices([{ item_id: itemId, store_id: storeId, price: price === '' ? null : Number(price), source: 'you', locked: lock, updated_at: new Date().toISOString() }]);
}

export async function saveSerpKey(key) {
  const { error } = await sb.rpc('set_serp_key', { k: key.replace(/\s+/g, '') });
  if (error) fail(error);
  app.hasSerpKey = true;
}
export async function saveInstacartKey(key) {
  const { error } = await sb.rpc('set_instacart_key', { k: key.trim() });
  if (error) fail(error);
  app.hasInstacartKey = true;
}
export async function testSerpKey() { return callProxy({ action: 'serp-account' }); }

let serpLoc = null;
async function serpLocation(geo) {
  if (app.settings.serpLocation) return app.settings.serpLocation;
  if (serpLoc) return serpLoc;
  try { serpLoc = (await callProxy({ action: 'serp-location', city: geo?.city || '', state: geo?.state || '' })).location; }
  catch (_) { serpLoc = 'United States'; }
  return serpLoc;
}

/**
 * Live price check for this week's list: one Google Shopping search per item covers every store.
 * Skips items checked in the last 2 days, locked prices and recent receipt prices.
 */
export async function refreshPrices(geo, onProgress) {
  const n = need(), loc = await serpLocation(geo);
  const items = app.items.filter((i) => n[i.id] && !owned(i));
  const serpStores = app.stores.filter((s) => s.source === 'serpapi' || s.source === 'target');
  const stats = { live: 0, searched: 0, recent: 0, kept: 0, notListed: 0, budget: false, location: loc };
  let done = 0;
  for (const it of items) {
    onProgress?.(++done, items.length, it.name);
    const row = app.prices[it.id] || {};
    const last = Math.max(0, ...Object.values(row).map((e) => (e.checkedAt ? new Date(e.checkedAt).getTime() : 0)));
    if (Date.now() - last < 2 * 864e5) { stats.recent++; continue; }
    let res;
    try { res = await callProxy({ action: 'serp-search', q: it.q || it.name, location: loc }); }
    catch (e) { if (/limit/i.test(e.message)) { stats.budget = true; break; } throw e; }
    stats.searched++; app.serpUsage.n = res.used;
    const now = new Date().toISOString(), rows = [];
    for (const s of serpStores) {
      const e = row[s.id] || {};
      if (e.locked || (e.source === 'receipt' && daysAgo(e.updated) < RECEIPT_FRESH_DAYS)) { stats.kept++; continue; }
      const m = String(s.serpMerchant || s.short || '').toLowerCase().replace(/[’']/g, '');
      const hit = res.results.find((x) => x.price && String(x.source || '').toLowerCase().replace(/[’']/g, '').includes(m) && titleMatches_(x.title, it.must));
      if (hit) { rows.push({ item_id: it.id, store_id: s.id, price: Math.round(hit.price * (it.units || 1) * 100) / 100, unit_price: hit.price, source: 'live', matched: `${hit.title} [${hit.source}]`, updated_at: now, checked_at: now }); stats.live++; }
      else { rows.push({ ...priceRow(it.id, s.id), item_id: it.id, store_id: s.id, checked_at: now }); stats.notListed++; }
    }
    await upsertPrices(rows);
  }
  return stats;
}

/**
 * The weekly price refresh (runs on the server once a week) checks this list: this week's items near home.
 * Saved only when the list changes, so it doesn't write on every visit.
 */
export async function syncPriceWatch(ids, geo) {
  const zip = (String(app.settings.homeAddress || '').match(/\b(\d{5})(?:-\d{4})?\b(?!.*\b\d{5}\b)/) || [])[1] || '';
  const w = { ids: [...new Set(ids)].sort().slice(0, 60), lat: geo?.lat ? Math.round(geo.lat * 1000) / 1000 : null, lng: geo?.lng ? Math.round(geo.lng * 1000) / 1000 : null, zip, loc: app.settings.serpLocation || serpLoc || '' };
  const old = app.settings.priceWatch || {};
  if (JSON.stringify({ ...old, at: undefined }) === JSON.stringify({ ...w, at: undefined })) return;
  if (!w.loc) { try { w.loc = await serpLocation(geo); } catch (_) {} }
  await saveSettings({ priceWatch: { ...w, at: new Date().toISOString() } });
}

/* ---------------- receipts ---------------- */
/** Save a checked receipt: prices become "receipt" prices, found items are ticked off, misses are skipped at that store for 30 days. */
export async function saveReceipt(storeId, rows, date) {
  const st = storeById(storeId), now = new Date().toISOString(), day = date || today();
  const priceRows = [], buy = [], log = [];
  for (const r of rows) {
    if (!r.itemId) continue;
    const it = itemById(r.itemId), planned = app.prices[r.itemId]?.[storeId]?.price ?? null;
    if (r.status === 'notfound') {
      priceRows.push({ ...priceRow(r.itemId, storeId), item_id: r.itemId, store_id: storeId, not_found_on: day });
      log.push({ day, store_id: storeId, store: st?.short, item_id: r.itemId, item: it?.name, planned, paid: null, status: 'Not found', receipt_line: '' });
    } else if (r.paid != null && r.paid !== '') {
      const paid = Number(r.paid);
      priceRows.push({ item_id: r.itemId, store_id: storeId, price: paid, unit_price: Math.round(paid / (it?.units || 1) * 100) / 100, source: 'receipt', matched: r.line || '', updated_at: now, checked_at: now, not_found_on: null, locked: false });
      buy.push(r.itemId);
      log.push({ day, store_id: storeId, store: st?.short, item_id: r.itemId, item: it?.name, planned, paid, status: 'Bought', receipt_line: r.line || '' });
    }
  }
  await upsertPrices(priceRows);
  if (buy.length) { await sb.from('items').update({ have_on: day }).in('id', buy); buy.forEach((id) => { const it = itemById(id); if (it) { it.have = true; it.haveOn = day; } }); await stockPantry(buy, day); }
  if (log.length) { const { data } = await sb.from('purchases').insert(log).select(); if (data) app.purchases = [...data, ...app.purchases]; }
  return { saved: priceRows.length, bought: buy.length };
}

/* ---------------- pantry ---------------- */
/** Is this shopping item already on hand (bought this week, or in the pantry)? */
export const owned = (i) => i.have || covers(app.pantry, i.id);

export async function addPantry(rows) {
  const day = today();
  const out = rows.map((r) => {
    const it = r.item_id ? itemById(r.item_id) : null, name = r.name || it?.name || '';
    return { item_id: r.item_id || null, name, amount: r.amount ?? it?.qty ?? '', level: r.level || 'plenty', place: r.place || placeFor(it?.cat || r.cat || '', name), added_on: day, use_by: r.use_by !== undefined ? r.use_by : useByFor(it?.cat || r.cat || '', name) };
  });
  // already there? top it back up instead of adding a second row
  const fresh = [];
  for (const r of out) {
    const ex = r.item_id ? app.pantry.find((p) => p.item_id === r.item_id) : app.pantry.find((p) => p.name.toLowerCase() === r.name.toLowerCase());
    if (ex) await updatePantry(ex.id, { level: 'plenty', amount: r.amount || ex.amount, use_by: r.use_by, added_on: day });
    else fresh.push(r);
  }
  if (!fresh.length) return;
  const { data, error } = await sb.from('pantry').insert(fresh).select();
  if (error) fail(error);
  const have = new Set(app.pantry.map((p) => p.id));
  app.pantry = [...data.filter((d) => !have.has(d.id)), ...app.pantry];
}
export async function updatePantry(id, patch) {
  const k = app.pantry.findIndex((p) => p.id === id);
  if (k >= 0) app.pantry[k] = { ...app.pantry[k], ...patch };
  const { error } = await sb.from('pantry').update(patch).eq('id', id);
  if (error) fail(error);
}
export async function removePantry(ids) {
  ids = [].concat(ids);
  app.pantry = app.pantry.filter((p) => !ids.includes(p.id));
  const { error } = await sb.from('pantry').delete().in('id', ids);
  if (error) fail(error);
}
async function stockPantry(itemIds, day) {
  try { await addPantry(itemIds.map((id) => ({ item_id: id }))); } catch (e) { console.warn('pantry', e); }
}
// un-ticking a trip item takes back what that tick added today
async function unstockToday(itemIds) {
  const ids = app.pantry.filter((p) => itemIds.includes(p.item_id) && p.added_on === today()).map((p) => p.id);
  if (ids.length) try { await removePantry(ids); } catch (e) { console.warn('pantry', e); }
}

/* ---------------- household ---------------- */
/* ---------------- several households ---------------- */
export const MAX_HOUSEHOLDS = 5;
export async function loadHouseholds() {
  const [h, i] = await Promise.all([sb.rpc('list_households'), sb.rpc('my_invites')]);
  if (!h.error) app.households = h.data || [];
  if (!i.error) app.myInvites = i.data || [];
}
// switching households reloads everything for the one you picked
const reloadApp = () => { location.hash = ''; location.reload(); };
export async function switchHousehold(id) {
  const { error } = await sb.rpc('switch_household', { hid: id }); if (error) fail(error);
  reloadApp();
}
export async function createHousehold(name) {
  const { data, error } = await sb.rpc('create_household', { nm: name }); if (error) fail(error);
  app.household = data.household_id;
  await seedHousehold();
  reloadApp();
}
export async function acceptInvite(id) {
  const { error } = await sb.rpc('accept_invite', { hid: id }); if (error) fail(error);
  reloadApp();
}
export async function declineInvite(id) {
  const { error } = await sb.rpc('decline_invite', { hid: id }); if (error) fail(error);
  app.myInvites = app.myInvites.filter((x) => x.household_id !== id);
}
export async function leaveHousehold(id) {
  const { error } = await sb.rpc('leave_household', { hid: id }); if (error) fail(error);
  reloadApp();
}
export async function renameHousehold(name) {
  const { error } = await sb.from('households').update({ name: name.trim() || 'Our household' }).eq('id', app.household); if (error) fail(error);
  app.households = app.households.map((h) => (h.id === app.household ? { ...h, name: name.trim() } : h));
}
/* home codes and invite links */
export const pendingCode = () => { try { return localStorage.getItem('wfd-join') || ''; } catch { return ''; } };
export const clearPendingCode = () => { try { localStorage.removeItem('wfd-join'); } catch {} };
export const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-6);
export const showCode = (c) => (c ? `WFD-${c}` : '');
export const inviteLink = (c) => `${APP_URL}#join=${c}`;
/** The code for one household (the current one unless told otherwise). Falls back to the older no-argument version. */
export async function getJoinCode(hid = app.household) {
  let { data, error } = await sb.rpc('get_household_code', { hid });
  if (error && /function|schema cache|not find/i.test(error.message)) ({ data, error } = await sb.rpc('get_join_code'));
  if (error) fail(error); return data;
}
export async function resetJoinCode(hid = app.household) {
  let { data, error } = await sb.rpc('reset_household_code', { hid });
  if (error && /function|schema cache|not find/i.test(error.message)) ({ data, error } = await sb.rpc('reset_join_code'));
  if (error) fail(error); return data;
}
export async function peekCode(code) {
  const { data, error } = await sb.rpc('peek_join_code', { code: cleanCode(code) }); if (error) fail(error);
  if (!data) throw new Error("That code doesn't match a household. Check it, or ask for a new one.");
  return data;
}
export async function joinWithCode(code) {
  const { error } = await sb.rpc('join_with_code', { code: cleanCode(code) }); if (error) fail(error);
  clearPendingCode(); reloadApp();
}
// signed in and opened someone's invite link: ask before joining
async function checkPendingJoin() {
  const code = pendingCode(); if (!code) return;
  try { const p = await peekCode(code); if (p.already) { clearPendingCode(); return; } app.pendingJoin = { code: cleanCode(code), ...p }; }
  catch (e) { clearPendingCode(); toast(e.message); }
}

export const currentHousehold = () => app.households.find((h) => h.is_current) || app.households.find((h) => h.id === app.household);

export async function invite(email) {
  const { error } = await sb.from('invites').upsert({ email: email.trim().toLowerCase(), household_id: app.household, invited_by: app.user.id }, { onConflict: 'email,household_id' });
  if (error) fail(error);
  app.invites = [...app.invites.filter((x) => x.email !== email.trim().toLowerCase()), { email: email.trim().toLowerCase() }];
}

/** Add grocery chains found near your address as stores (estimated prices until you have real ones). */
export async function addLocalStores(list) {
  const ids = [];
  for (const b of list) {
    const addr = b.near.label.includes(',') && !/^-?\d/.test(b.near.label) ? b.near.label : `${b.near.lat},${b.near.lng}`;
    // a starter store of the same chain with no address yet just gets this one's address (keeps its price estimates)
    const key = (x) => String(x || '').toLowerCase().replace(/[^a-z]/g, '');
    const blank = app.stores.find((x) => !x.address && (key(x.short).startsWith(key(b.brand)) || key(b.brand).startsWith(key(x.short))));
    if (blank) { Object.assign(blank, { address: addr, enabled: true }); await saveStore(blank); ids.push(blank.id); continue; }
    let id = slug_(b.brand).slice(0, 24), k = 2; while (app.stores.some((x) => x.id === id)) id = slug_(b.brand).slice(0, 20) + '-' + k++;
    const st = { id, name: b.brand, short: b.brand, address: b.near.label.includes(',') && !/^-?\d/.test(b.near.label) ? b.near.label : `${b.near.lat},${b.near.lng}`,
      source: 'local', ad: `https://www.google.com/search?q=${encodeURIComponent(b.brand + ' weekly ad')}`, bulk: !!b.bulk, enabled: true, sort: 50 + app.stores.length };
    await saveStore(st); app.stores.push(st); ids.push(id);
  }
  const en = Array.isArray(app.settings.enabledStores) ? app.settings.enabledStores : String(app.settings.enabledStores || '').split(',').filter(Boolean);
  const lv = Object.fromEntries(list.map((b, i) => [ids[i], b.level]));
  await saveSettings({ enabledStores: [...new Set([...en, ...ids])], storeLevel: { ...(app.settings.storeLevel || {}), ...lv } });
  return ids;
}
export async function saveStore(s) {
  const { error } = await sb.from('stores').upsert({ household_id: app.household, id: s.id, name: s.name, short: s.short, address: s.address, source: s.source, merchant: s.serpMerchant || s.merchant || null, hours: s.hours, ad: s.ad, bulk: !!s.bulk, enabled: s.enabled !== false, sort: s.sort || 0 });
  if (error) fail(error);
}

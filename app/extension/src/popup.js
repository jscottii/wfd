// WFD Chrome extension: reads the recipe on the page you're looking at and saves it to your WFD household,
// matched to shopping items exactly the way the app's "From a link" import does (same code, bundled in).
import { createClient } from '@supabase/supabase-js';
import { fromJsonLd } from '../../src/lib/discover.js';
import { buildImport } from '../../src/lib/planner.js';

const SUPABASE_URL = 'https://osyhpifmegqotdfdlave.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zeWhwaWZtZWdxb3RkZmRsYXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5ODUzNjksImV4cCI6MjExMDU2MTM2OX0.0TuNBUobM0j6cgJQrtiWdTpXoCoiOftxwn_rmfyLPxg';
const APP = 'https://wfdmeals.app/';

// the sign-in is kept in the extension's own storage (separate from the website's)
const storage = {
  getItem: async (k) => (await chrome.storage.local.get(k))[k] ?? null,
  setItem: (k, v) => chrome.storage.local.set({ [k]: v }),
  removeItem: (k) => chrome.storage.local.remove(k),
};
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

const $view = document.getElementById('view');
const $who = document.getElementById('who');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const open = (url) => chrome.tabs.create({ url });
const show = (html) => { $view.innerHTML = html; };
const fail = (e) => { throw new Error(e?.message || String(e)); };

// same mapping the app uses to store a recipe
const fromRecipe = (r) => ({ id: r.id, title: r.title, active: !!r.active, servings: Number(r.servings) || null, yield: r.yield || '', meal: r.when || '', fridge: r.fridge || '', freeze: r.freeze || '',
  ing: r.ing || [], steps: r.steps || [], tip: r.tip || '', custom: !!r.custom, source: r.source || '', cuisine: r.cuisine || null, ...(Number(r.calories) ? { calories: Number(r.calories) } : {}), ...(r.image ? { image: r.image } : {}), items: r.items || {} });

const imageOf = (img) => { const x = Array.isArray(img) ? img[0] : img; return typeof x === 'string' ? x : x?.url || ''; };

/* ---------- screens ---------- */
function signInView(msg = '') {
  $who.textContent = '';
  show(`<h2>Sign in to save recipes</h2><p class="muted" style="margin:0 0 6px">Use your WFD account.</p>
  <form id="f"><label>Email</label><input id="em" type="email" required autocomplete="email">
  <label>Password</label><input id="pw" type="password" required autocomplete="current-password">
  ${msg ? `<div class="err">${esc(msg)}</div>` : ''}
  <div class="row" style="margin-top:12px"><button id="go" class="wide" type="submit">Sign in</button></div></form>
  <p class="small muted" style="margin:12px 0 0">No account? <button class="link small" id="mk">Create one at wfdmeals.app</button>. Guest mode isn't available in the extension, since a guest's recipes live in one browser tab.</p>`);
  chrome.storage.local.get('wfd-email').then((o) => { if (o['wfd-email']) document.getElementById('em').value = o['wfd-email']; });
  document.getElementById('mk').onclick = () => open(APP + '#signup');
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const b = document.getElementById('go'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Signing in';
    const email = document.getElementById('em').value.trim();
    const { error } = await sb.auth.signInWithPassword({ email, password: document.getElementById('pw').value });
    if (error) return signInView(/invalid login/i.test(error.message) ? 'Wrong email or password.' : error.message);
    chrome.storage.local.set({ 'wfd-email': email });
    main();
  };
}

async function main() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session || session.user.is_anonymous) return signInView();
  $who.textContent = session.user.email || '';

  // what's on this page?
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let page = null;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['reader.js'] });
    [{ result: page }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.__wfdPage });
  } catch (_) { page = null; }

  const { data: hh } = await sb.rpc('list_households');
  const cur = (hh || []).find((h) => h.is_current) || (hh || [])[0];
  if (!cur) return show(`<div class="err">You're not in a household yet. Open WFD to set one up.</div><button class="wide" id="o">Open WFD</button>${footer()}`), bind();

  if (!page?.recipes?.length) {
    return show(`<h2>No recipe found here</h2><p class="muted">WFD looks for an ingredient list and steps on the page. Open the recipe itself (not a list of recipes) and click the WFD button again. If the recipe is there but WFD can't read it, add it by hand in WFD.</p>
      <button class="ghost wide" id="o">Open WFD</button>${footer()}`), bind();
  }
  const r = page.recipes[0];
  const { data: dup } = await sb.from('recipes').select('id,title').eq('source', page.url).limit(1);
  const nIng = (r.recipeIngredient || []).length;
  const nSteps = fromJsonLd(r, page.url).recipes?.[0]?.steps?.length || 0;
  const img = imageOf(r.image);
  show(`<div class="card rec">${img ? `<img src="${esc(img)}" alt="">` : ''}<div><h2>${esc(r.name || 'Recipe')}</h2>
    <div class="facts"><span>${nIng} ingredients</span><span>${nSteps} steps</span>${r.recipeYield ? `<span>Makes ${esc([].concat(r.recipeYield)[0])}</span>` : ''}</div></div></div>
    ${dup?.length ? `<div class="ok">Already in WFD as “${esc(dup[0].title)}”. Saving again updates it with this page's version.</div>` : ''}
    ${(hh || []).length > 1 ? `<label>Save to</label><select id="hh">${hh.map((h) => `<option value="${h.id}"${h.id === cur.id ? ' selected' : ''}>${esc(h.name)}</option>`).join('')}</select>
      <p class="small muted" style="margin:4px 0 0">Picking another household also switches WFD to it.</p>` : `<p class="muted" style="margin:0">Saving to <b>${esc(cur.name)}</b></p>`}
    <label class="check"><input type="checkbox" id="week"> Add to this week's picks</label>
    <div id="msg"></div>
    <button class="wide" id="save">Save to WFD</button>${footer()}`);
  bind();
  document.getElementById('save').onclick = () => save(r, page.url, cur.id);
}

async function save(raw, url, curId) {
  const b = document.getElementById('save'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Saving';
  try {
    const pick = document.getElementById('hh')?.value || curId;
    if (pick !== curId) { const { error } = await sb.rpc('switch_household', { hid: pick }); if (error) fail(error); }
    const { data: h } = await sb.rpc('list_households');
    const hid = (h || []).find((x) => x.is_current)?.id || pick;
    const { data: items, error: e1 } = await sb.from('items').select('id,name,qty,units'); if (e1) fail(e1);
    const parsed = fromJsonLd(raw, url);
    if (!parsed?.recipes?.length || !parsed.recipes[0].ing?.length) throw new Error("This page's recipe has no ingredient list WFD can read.");
    const built = buildImport(parsed, items || [], 'web');
    const newItems = built.items.filter((i) => i.isNew);
    if (newItems.length) {
      const rows = newItems.map((it) => ({ household_id: hid, id: it.id, cat: it.cat, name: it.name, qty: it.qty || '1', q: it.q, must: it.must, units: it.units }));
      const { error } = await sb.from('items').upsert(rows, { onConflict: 'household_id,id', ignoreDuplicates: true }); if (error) fail(error);
    }
    const src = parsed.recipes[0];
    const active = document.getElementById('week').checked;
    const recs = built.recipes.map((x) => ({ household_id: hid, ...fromRecipe({ ...x, active, source: src.url || url, cuisine: src.cuisine || '', calories: src.calories || null, image: src.image || '' }) }));
    const { error } = await sb.from('recipes').upsert(recs); if (error) fail(error);
    sb.from('events').insert({ name: 'recipe_saved', props: { via: 'extension' }, app_version: 'ext-' + chrome.runtime.getManifest().version }).then(() => {}, () => {});
    show(`<div class="ok">✓ Saved “${esc(recs[0].title)}”${active ? ' and added it to this week\'s picks' : ''}.${newItems.length ? ` ${newItems.length} new shopping item${newItems.length > 1 ? 's' : ''} added.` : ''}</div>
      <button class="wide" id="o">Open in WFD</button>${footer()}`);
    bind();
  } catch (e) {
    document.getElementById('msg').innerHTML = `<div class="err">${esc(e.message)}</div>`;
    b.disabled = false; b.textContent = 'Try again';
  }
}

const footer = () => `<footer style="padding:12px 0 0"><button class="link small" id="app">wfdmeals.app</button><button class="link small" id="out">Sign out</button></footer>`;
function bind() {
  document.getElementById('o')?.addEventListener('click', () => open(APP + '#recipes'));
  document.getElementById('app')?.addEventListener('click', () => open(APP));
  document.getElementById('out')?.addEventListener('click', async () => { await sb.auth.signOut({ scope: 'local' }); signInView(); });
}

main().catch((e) => show(`<div class="err">${esc(e.message)}</div>`));

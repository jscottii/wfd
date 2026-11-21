import { AMAZON_ASSOCIATE_TAG } from './config.js';
// Send a week's shopping list to a delivery service.
import { app, itemById, callProxy } from './db.svelte.js';
import { shareText, isNative } from './native.js';

/** need map { itemId: packages } → lines with a search-friendly name and the amount to buy. */
export function linesFor(need) {
  return Object.entries(need).map(([id, n]) => {
    const it = itemById(id);
    if (!it) return null;
    return { id, name: it.name, search: it.q || it.name, count: n, qty: it.qty || '', cat: it.cat || 'Other' };
  }).filter(Boolean).sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));
}

export function listText(title, lines) {
  const out = [title];
  let cat = '';
  lines.forEach((l) => {
    if (l.cat !== cat) { cat = l.cat; out.push('', cat + ':'); }
    out.push(`☐ ${l.name}${l.qty ? ' — ' + l.qty : ''}${l.count > 1 ? ` · buy ${l.count}` : ''}`);
  });
  return out.join('\n');
}

const open = (url) => window.open(url, '_blank', 'noopener');

/** Instacart: a shopping-list page where you pick the store (Costco same-day, Safeway, Sprouts…), then check out. */
export async function orderInstacart(title, lines) {
  const r = await callProxy({ action: 'instacart-list', title, items: lines.map((l) => ({ name: l.search, quantity: l.count, unit: 'each', display: `${l.name}${l.qty ? ' — ' + l.qty : ''}` })) });
  if (!r?.url) throw new Error(r?.error || "Instacart didn't return a link.");
  const store = app.settings.instacartStore;   // open straight at your usual store (Costco same-day, Safeway…)
  open(store?.key ? r.url + (r.url.includes('?') ? '&' : '?') + 'retailer_key=' + encodeURIComponent(store.key) : r.url);
  return r;
}

/** Amazon Fresh / Whole Foods: Amazon's ingredient hand-off page, where you pick products and add them to the cart. */
export function orderAmazon(lines) {
  // Amazon only accepts recipe-to-cart from approved Associates; without a tag, use the Fresh store + copied list
  if (!AMAZON_ASSOCIATE_TAG) return 'copy';
  const ingredients = lines.map((l) => ({ name: l.search, quantityList: [{ unit: 'COUNT', amount: l.count }] }));
  const f = document.createElement('form');
  f.method = 'POST'; f.action = 'https://www.amazon.com/afx/ingredients/landing'; f.target = '_blank';
  const i = document.createElement('input');
  i.type = 'hidden'; i.name = 'ingredients'; i.value = JSON.stringify({ ingredients });
  const t = document.createElement('input'); t.type = 'hidden'; t.name = 'tag'; t.value = AMAZON_ASSOCIATE_TAG;
  f.appendChild(i); f.appendChild(t); document.body.appendChild(f); f.submit(); f.remove();
}

/** Walmart: look up each item's product number, then open Walmart with them already in the cart (sign in there to check out). */
export async function orderWalmart(lines) {
  const r = await callProxy({ action: 'serp-walmart-cart', items: lines.map((l) => ({ name: l.search, count: l.count })) });
  open(r.url);
  return r;
}
export async function instacartStores(zip) { return (await callProxy({ action: 'instacart-retailers', postal_code: zip })).retailers || []; }

/** Walmart and Safeway have no way for other apps to fill a cart: copy the list, then open the store. */
export async function copyAndOpen(title, lines, url) {
  try { await navigator.clipboard.writeText(listText(title, lines)); } catch {}
  open(url);
}
export const STORES_LINKS = {
  amazon: 'https://www.amazon.com/alm/storefront?almBrandId=QW1hem9uIEZyZXNo',
  walmart: 'https://www.walmart.com/cp/grocery/976759',
  safeway: 'https://www.safeway.com/shop/aisles.html'
};

export async function shareList(title, lines) {
  return shareText(title, listText(title, lines));
}
export { isNative };

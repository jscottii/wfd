// Trip planning: nearest stores + drive times (free maps) → optimizer → route line.
import { app, need, toast, owned } from './db.svelte.js';
import { nearestAndMatrix, routeLine, geocode, haversineMi } from './maps.js';
import { planTrips } from './optimizer.js';
import { scalePrices } from './planner.js';

export const trip = $state({ start: 'home', typed: '', here: null, busy: false, step: '', error: '', result: null, choice: 'best', line: null, stores: [], when: 0, geo: null });

export function startAddress() {
  if (trip.start === 'here' && trip.here) return `${trip.here.lat},${trip.here.lng}`;
  if (trip.start === 'typed' && trip.typed.trim()) return trip.typed.trim();
  return app.settings.homeAddress;
}

export function useMyLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This device can’t share its location.'));
    navigator.geolocation.getCurrentPosition(
      (p) => { trip.here = { lat: p.coords.latitude, lng: p.coords.longitude }; trip.start = 'here'; resolve(trip.here); },
      () => reject(new Error('Location permission was denied. You can type an address instead.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}

export async function planTrip() {
  if (trip.busy) return;
  trip.busy = true; trip.error = ''; trip.step = 'Starting…';
  try {
    const s = app.settings, n = need();
    const items = app.items.filter((i) => n[i.id] > 0 && !owned(i));
    if (!items.length) { trip.result = { empty: true }; return; }
    const enabled = (Array.isArray(s.enabledStores) ? s.enabledStores : String(s.enabledStores || '').split(',')).map((x) => x.trim()).filter(Boolean);
    const stores = app.stores.filter((st) => st.enabled !== false && enabled.includes(st.id) && (!st.bulk || s.costcoMember));
    const start = startAddress(), home = s.homeAddress;
    const nm = await nearestAndMatrix(start, home, stores, s.nearestStores !== false, (t) => (trip.step = t));
    trip.geo = nm.start; trip.stores = nm.stores;
    // stores beyond your store range (Settings, 25 mi by default) are left out
    const range = Number(s.storeRadius) || 25;
    const near = nm.stores.filter((st) => !st.lat || !nm.start || haversineMi(nm.start, st) <= range);
    if (!near.length) throw new Error(`None of your stores are within ${range} miles. Open More → Stores → “Find stores near me”, or widen the store range in Settings.`);
    if (near.length < nm.stores.length) {
      const keep = new Set(['start', 'end', ...near.map((x) => x.id)]), idx = nm.matrix.nodes.map((id, i) => (keep.has(id) ? i : -1)).filter((i) => i >= 0);
      nm.matrix = { nodes: idx.map((i) => nm.matrix.nodes[i]), dist: idx.map((i) => idx.map((j) => nm.matrix.dist[i][j])), dur: idx.map((i) => idx.map((j) => nm.matrix.dur[i][j])) };
      nm.stores = near; trip.stores = near;
    }
    const prices = scalePrices(app.prices, items, n, nm.stores, s.costcoMode);
    // chains with no prices yet (found near a new address): estimate from what the item costs elsewhere
    const level = s.storeLevel || {};
    items.forEach((it) => {
      const row = prices[it.id] = prices[it.id] || {};
      const known = Object.entries(row).filter(([sid, e]) => e && e.price > 0 && !e.notFound && level[sid] == null).map(([, e]) => e.price).sort((a, b) => a - b);
      if (!known.length) return;
      const mid = known[Math.floor(known.length / 2)];
      nm.stores.forEach((st) => { if (level[st.id] != null && !(row[st.id]?.price > 0)) row[st.id] = { price: Math.round(mid * level[st.id] * 100) / 100, source: 'estimate' }; });
    });
    // items with no price anywhere yet: place them at a stop you're making anyway
    items.forEach((it) => {
      const row = (prices[it.id] = prices[it.id] || {});
      if (Object.values(row).some((e) => e && e.price != null && !e.notFound)) return;
      nm.stores.forEach((st) => { if (!st.bulk && !(row[st.id] && row[st.id].notFound)) row[st.id] = { price: 0, source: 'unpriced' }; });
    });
    const res = planTrips({ items, stores: nm.stores, prices, matrix: nm.matrix,
      settings: { mpg: +s.mpg, gasPrice: +s.gasPrice, timeValue: +s.timeValue, stopMinutes: +s.stopMinutes, maxStores: +s.maxStores,
        costcoMember: !!s.costcoMember, costcoMode: s.costcoMode, enabled: nm.stores.map((x) => x.id) },
      start, end: home });
    res.itemCount = items.length;
    res.alreadyHave = app.items.filter((i) => n[i.id] > 0 && owned(i)).map((i) => i.id);
    trip.result = res; trip.choice = 'best'; trip.when = Date.now();
    await drawLine();
  } catch (e) {
    trip.error = String(e.message || e);
  } finally { trip.busy = false; trip.step = ''; }
}

export function chosen() {
  const r = trip.result; if (!r || r.empty) return null;
  return r[trip.choice] || r.best;
}

export async function drawLine() {
  const p = chosen(); trip.line = null;
  if (!p || !trip.geo) return;
  const byId = Object.fromEntries(trip.stores.map((s) => [s.id, s]));
  const homeGeo = await geocode(app.settings.homeAddress).catch(() => null);
  const pts = [trip.geo, ...p.stores.map((s) => byId[s.id]), homeGeo || trip.geo].filter(Boolean);
  try { trip.line = { ...(await routeLine(pts)), pts }; } catch (_) { trip.line = { coords: null, pts }; }
}


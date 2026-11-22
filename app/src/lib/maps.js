// Free map services, called straight from the phone/browser:
//   Nominatim (OpenStreetMap)  address → coordinates
//   Overpass  (OpenStreetMap)  store locations near you (saved to Supabase so everyone shares them)
//   OSRM                       drive-time matrix + route line, one request each
import { sb } from './db.svelte.js';

const UA_EMAIL = 'WFD app';
const cache = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (_) { return null; } };

export function haversineMi(a, b) {
  const R = 3958.8, t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLng = (b.lng - a.lng) * t;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** {lat, lng, city, state, label} for an address or "lat,lng". Cached on the device. */
export async function geocode(addr) {
  addr = String(addr || '').trim();
  const m = addr.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  const key = 'geo:' + addr.toLowerCase();
  const hit = cache(key); if (hit) return hit;
  let g;
  if (m) {
    g = { lat: +m[1], lng: +m[2], city: '', state: '', label: 'your location' };
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${m[1]}&lon=${m[2]}&zoom=16&addressdetails=1`);
      const j = await r.json(); const a = j.address || {};
      g.city = a.city || a.town || a.village || ''; g.state = a.state || ''; g.label = [a.road, g.city].filter(Boolean).join(', ') || g.label;
    } catch (_) {}
  } else {
    // New streets are often missing from the map: fall back to the street without the number, then the town + ZIP,
    // then the ZIP. Close enough to find stores and plan trips; the address stays as typed.
    const parts = addr.split(',').map((x) => x.trim()).filter(Boolean);
    const zip = (addr.match(/\b\d{5}\b/) || [])[0];
    const tries = [addr, parts.length > 1 ? [parts[0].replace(/^\d+[a-z]?\s+/i, ''), ...parts.slice(1)].join(', ') : '', parts.length > 1 ? parts.slice(1).join(', ') : '', zip || ''];
    let j = [], used = 0;
    for (let t = 0; t < tries.length; t++) {
      const q = tries[t]; if (!q || (t > 0 && q === tries[t - 1])) continue;
      if (t > 0) await new Promise((res) => setTimeout(res, 1100));   // the free map service allows ~1 lookup a second
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`);
      j = r.ok ? await r.json() : [];
      if (j[0]) { used = t; break; }
    }
    if (!j[0]) throw new Error(`Couldn't find "${addr}" on the map. Check the city and ZIP.`);
    const a = j[0].address || {};
    g = { lat: +j[0].lat, lng: +j[0].lon, city: a.city || a.town || a.village || a.suburb || '', state: a.state || '', label: addr,
      approx: used > 0, near: used > 0 ? [a.city || a.town || a.village || a.hamlet || a.suburb || a.county, a.state, a.postcode].filter(Boolean).join(', ') : '' };
  }
  cache(key, g);
  return g;
}

function chainKey(s) {
  return String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[–—-].*$/, '').replace(/[’']/g, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function chainFor(tags, stores) {
  const name = chainKey(tags.name || tags.brand || ''), label = chainKey(`${tags.brand || ''} ${tags.name || ''}`);
  if (/business center|gas station|pharmacy|optical|tire|fuel|express/.test(name)) return null;
  for (const s of stores) { const k = chainKey(s.short || s.name); if (k && (name.startsWith(k) || label.startsWith(k))) return s.id; }
  return null;
}

/** Look up every chain's locations within ~12 miles, once per area (shared through Supabase). */
export async function discoverStores(g, stores) {
  const cell = `${g.lat.toFixed(1)},${g.lng.toFixed(1)}`;
  const { data: area } = await sb.from('store_areas').select('cell,searched_at').eq('cell', cell).maybeSingle();
  if (area && (Date.now() - new Date(area.searched_at).getTime()) < 180 * 864e5) return 0;
  const names = stores.map((s) => String(s.short || s.name).replace(/\s*\(.*\)/, '').replace(/[–—-].*$/, '').trim()).filter(Boolean).map((n) => n.replace(/'/g, '.'));
  const rx = `^(${names.join('|')})`;
  // brand tags cover the big chains; ask three public mirrors at once and use the first answer
  const q = `[out:json][timeout:25];nwr["brand"~"${rx}"](around:20000,${g.lat},${g.lng});out center tags;`;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
  const ask = (ep) => fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: ctl.signal })
    .then((r) => r.json()).then((j) => { if (!j.elements) throw new Error(j.remark || 'no data'); return j; });
  let j;
  try {
    j = await Promise.any(['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'].map(ask));
  } finally { clearTimeout(t); ctl.abort(); }
  const rows = [], seen = new Set();
  for (const e of j.elements || []) {
    const tg = e.tags || {}, lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    if (lat == null) continue;
    const chain = chainFor(tg, stores); if (!chain) continue;
    const k = `${chain}@${lat.toFixed(4)},${lng.toFixed(4)}`; if (seen.has(k)) continue; seen.add(k);
    const street = [String(tg['addr:housenumber'] || '').split(/[;,]/)[0], tg['addr:street']].filter(Boolean).join(' ');
    rows.push({ chain, name: tg.name || tg.brand, label: street ? [street, tg['addr:city']].filter(Boolean).join(', ') : (tg['addr:city'] || ''), lat, lng });
  }
  if (rows.length) await sb.from('store_locations').upsert(rows, { onConflict: 'chain,lat,lng', ignoreDuplicates: true });
  await sb.from('store_areas').upsert({ cell, searched_at: new Date().toISOString(), found: rows.length });
  return rows.length;
}

// rough price level vs. an average supermarket, for chains we have no prices for yet
const PRICE_LEVEL = [[/aldi|lidl|winco|grocery outlet|food 4 less|save a lot|walmart|market basket|price rite|fiesta/i, 0.85],
  [/kroger|ralphs|fred meyer|king soopers|fry|smith|dillons|qfc|harris teeter|h-?e-?b|meijer|food lion|publix|giant|stop.?shop|hannaford|hy-?vee|winn|ingles|schnucks|jewel|acme|shoprite|wegmans|target|vons|albertsons|safeway|lucky|stater|smart ?& ?final|99 ranch|h mart/i, 1.0],
  [/sprouts|raley|nugget|draeger|mollie|andronico|new seasons|fresh market|earth fare/i, 1.12], [/whole foods|erewhon|bristol/i, 1.25],
  [/costco|sam'?s club|bj'?s/i, 0.8], [/trader joe/i, 0.92]];
export const priceLevel = (name) => (PRICE_LEVEL.find(([re]) => re.test(name)) || [0, 1])[1];

/** The grocery chains around an address: [{ brand, count, miles, near: {lat,lng,label}, bulk, level }] nearest first. */
export async function findLocalChains(addr, known = [], radiusMi = 25) {
  const g = await geocode(addr);
  const q = `[out:json][timeout:25];nwr["shop"~"^(supermarket|wholesale|grocery)$"](around:${Math.round(Math.min(50, Math.max(2, radiusMi)) * 1609)},${g.lat},${g.lng});out center tags;`;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
  const ask = (ep) => fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: ctl.signal })
    .then((r) => r.json()).then((j) => { if (!j.elements) throw new Error(j.remark || 'no data'); return j; });
  let j;
  try { j = await Promise.any(['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'].map(ask)); }
  catch (_) { throw new Error('The store map is busy right now — try again in a minute.'); }
  finally { clearTimeout(t); ctl.abort(); }
  const knownKeys = known.map((s) => chainKey(s.short || s.name)).filter(Boolean);
  const by = {};
  for (const e of j.elements || []) {
    const tg = e.tags || {}, lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    const brand = String(tg.brand || '').trim() || (tg.shop === 'wholesale' ? String(tg.name || '').trim() : '');
    if (lat == null || !brand || /gas|fuel|pharmacy|7-eleven|circle k|dollar|cvs|walgreens/i.test(brand)) continue;
    const mi = haversineMi(g, { lat, lng });
    const st1 = [String(tg['addr:housenumber'] || '').split(/[;,]/)[0], tg['addr:street']].filter(Boolean).join(' '), street = [st1, tg['addr:city']].filter(Boolean).join(', ');
    const b = (by[brand] = by[brand] || { brand, count: 0, miles: 99, near: null });
    b.count++;
    if (mi < b.miles) { b.miles = Math.round(mi * 10) / 10; b.near = { lat, lng, label: street || `${lat.toFixed(4)},${lng.toFixed(4)}` }; }
  }
  return Object.values(by).map((b) => ({ ...b, bulk: /costco|sam'?s club|bj'?s/i.test(b.brand), level: priceLevel(b.brand),
    known: knownKeys.some((k) => chainKey(b.brand).startsWith(k) || k.startsWith(chainKey(b.brand))) }))
    .filter((b) => b.miles <= radiusMi).sort((a, b) => a.miles - b.miles).slice(0, 20);
}

/** OSRM: durations (s) and distances (m) from each source to each destination. */
async function osrmTable(points, sources, destinations) {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  let url = `https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration,distance`;
  if (sources) url += `&sources=${sources.join(';')}`;
  if (destinations) url += `&destinations=${destinations.join(';')}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.code !== 'Ok') throw new Error('Drive-time service: ' + (j.message || j.code));
  return j;
}

/**
 * Each chain's fastest location from the start, then a full drive-time matrix for start → stores → home.
 * Returns { stores (with address/label/lat/lng/fromStart), matrix } ready for the optimizer.
 */
export async function nearestAndMatrix(start, end, stores, useNearest, onStep) {
  onStep?.('Finding your start on the map…');
  const s = await geocode(start), e = await geocode(end);
  let found = stores.map((st) => ({ ...st }));
  const geos = await Promise.all(found.map((st) => geocode(st.address).catch(() => null)));
  found.forEach((st, i) => { if (geos[i]) Object.assign(st, { lat: geos[i].lat, lng: geos[i].lng, label: st.address, home: true }); });

  if (useNearest) {
    onStep?.('Looking for stores near you…');
    try { await discoverStores(s, found); } catch (_) { /* map search unavailable: fall back to saved addresses */ }
    const { data: locs } = await sb.from('store_locations').select('*')
      .gte('lat', s.lat - 0.3).lte('lat', s.lat + 0.3).gte('lng', s.lng - 0.35).lte('lng', s.lng + 0.35);
    const cands = [];
    found.forEach((st, si) => {
      const list = [];
      if (st.lat != null) list.push({ si, lat: st.lat, lng: st.lng, label: st.address, home: true });
      (locs || []).filter((l) => l.chain === st.id).forEach((l) => {
        if (!list.some((x) => haversineMi(x, l) < 0.12)) list.push({ si, lat: l.lat, lng: l.lng, label: (l.label || '').trim() || `near ${l.lat.toFixed(3)}, ${l.lng.toFixed(3)}`, home: false });
      });
      list.sort((a, b) => haversineMi(s, a) - haversineMi(s, b)).slice(0, 3).forEach((c) => cands.push(c));
    });
    if (cands.length) {
      onStep?.('Comparing drive times…');
      const t = await osrmTable([s, ...cands], [0], cands.map((_, i) => i + 1));
      cands.forEach((c, i) => { c.sec = t.durations[0][i]; c.m = t.distances[0][i]; });
      found = found.map((st, si) => {
        const best = cands.filter((c) => c.si === si && c.sec != null).sort((a, b) => a.sec - b.sec)[0];
        if (!best) return st;
        const place = String(best.label).split(',')[0];
        return { ...st, lat: best.lat, lng: best.lng, label: best.label, home: best.home,
          name: (st.short || st.name).replace(/\s*\(.*\)/, '') + (place ? ' – ' + place : ''), short: (st.short || st.name).replace(/\s*\(.*\)/, ''),
          fromStart: { minutes: Math.round(best.sec / 60), miles: Math.round(best.m / 160.934) / 10 } };
      });
    }
  }
  found = found.filter((st) => st.lat != null);
  found.forEach((st) => (st.address = `${st.lat.toFixed(6)},${st.lng.toFixed(6)}`));
  onStep?.('Working out the best trip…');
  const pts = [s, e, ...found];
  const t = await osrmTable(pts);
  return { start: s, end: e, stores: found, matrix: { nodes: ['start', 'end', ...found.map((x) => x.id)], dist: t.distances, dur: t.durations } };
}

/** Road geometry for the chosen route (GeoJSON LineString coordinates [lng, lat]). */
export async function routeLine(points) {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
  const j = await r.json();
  if (j.code !== 'Ok') return null;
  return { coords: j.routes[0].geometry.coordinates, legs: j.routes[0].legs.map((l) => ({ miles: Math.round(l.distance / 160.934) / 10, minutes: Math.round(l.duration / 60) })) };
}

export function directionsUrl(start, end, stores) {
  const enc = (p) => encodeURIComponent(typeof p === 'string' ? p : `${p.lat},${p.lng}`);
  return `https://www.google.com/maps/dir/?api=1&origin=${enc(start)}&destination=${enc(end)}&travelmode=driving` +
    (stores.length ? `&waypoints=${stores.map((x) => enc(x)).join('%7C')}` : '');
}
export { UA_EMAIL };

/** The phone's location → a street address (asks the person's permission first). */
export function hereAddress() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This device can’t share its location — type your address instead.'));
    navigator.geolocation.getCurrentPosition(async (p) => {
      const { latitude: lat, longitude: lng } = p.coords;
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const a = (await r.json()).address || {};
        const street = [a.house_number, a.road].filter(Boolean).join(' ');
        const city = a.city || a.town || a.village || a.suburb || '';
        resolve([street, city, [a.state, a.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ') || `${lat.toFixed(5)},${lng.toFixed(5)}`);
      } catch { resolve(`${lat.toFixed(5)},${lng.toFixed(5)}`); }
    }, () => reject(new Error('Location wasn’t allowed — type your address instead.')), { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  });
}

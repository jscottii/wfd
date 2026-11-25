/**
 * Optimizer.gs — pure functions (no Apps Script services) so they can be unit-tested.
 *
 * Picks the set of stores + driving order that minimizes:
 *   groceries + fuel + (drive minutes + per-stop minutes) × value of your time
 */

/** Effective comparable price for one item at one store, or null. */
function effectivePrice_(entry, store, settings) {
  if (!entry || entry.notFound) return null;   // store didn't have it last time: plan it elsewhere
  if (entry.price == null || entry.price === '' || isNaN(entry.price)) return null;
  if (store.bulk && settings.costcoMode === 'unit' && entry.unitNeeded != null && entry.unitNeeded !== '') {
    return Number(entry.unitNeeded);
  }
  return Number(entry.price);
}

/** All permutations of an array (n ≤ 7 → ≤ 5040). */
function permutations_(arr) {
  if (arr.length <= 1) return [arr.slice()];
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    var rest = arr.slice(0, i).concat(arr.slice(i + 1));
    var ps = permutations_(rest);
    for (var j = 0; j < ps.length; j++) out.push([arr[i]].concat(ps[j]));
  }
  return out;
}

/** Best start→stores→end order for a subset, using the precomputed matrix. */
function bestRoute_(subset, matrix, oneWay) {
  var idx = {};
  matrix.nodes.forEach(function (n, i) { idx[n] = i; });
  var best = null;
  permutations_(subset).forEach(function (order) {
    // one-way trips end at the last store; otherwise drive back to the end point (usually home)
    var path = oneWay ? ['start'].concat(order) : ['start'].concat(order).concat(['end']);
    var m = 0, s = 0;
    for (var k = 0; k < path.length - 1; k++) {
      m += matrix.dist[idx[path[k]]][idx[path[k + 1]]];
      s += matrix.dur[idx[path[k]]][idx[path[k + 1]]];
    }
    if (!best || s < best.seconds || (s === best.seconds && m < best.meters)) {
      best = { order: order, meters: m, seconds: s };
    }
  });
  return best;
}

/** Google Maps directions link (official Maps URLs format). */
function mapsUrl_(start, end, orderedStores) {
  var enc = encodeURIComponent;
  var stops = orderedStores.slice();
  if (!end && stops.length) end = stops.pop().address;   // one-way: the last store is the destination
  var url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + enc(start) + '&destination=' + enc(end);
  if (stops.length) url += '&waypoints=' + stops.map(function (s) { return enc(s.address); }).join('%7C');
  return url;
}

/**
 * input: { items, stores, prices, matrix, settings, start, end }
 *   prices[itemId][storeId] = { price, unitNeeded, note, source, matched, updated }
 *   settings: { mpg, gasPrice, timeValue, stopMinutes, costcoMember, costcoMode, maxStores, enabled[] }
 */
function planTrips(input) {
  var st = input.settings;
  var storesById = {};
  input.stores.forEach(function (s) { storesById[s.id] = s; });

  var candidates = input.stores.filter(function (s) {
    if (st.enabled && st.enabled.indexOf(s.id) < 0) return false;
    if (s.bulk && !st.costcoMember) return false;
    return input.matrix.nodes.indexOf(s.id) >= 0;
  }).map(function (s) { return s.id; });

  var maxStores = Math.max(1, Math.min(Number(st.maxStores) || 3, candidates.length));
  var plans = [];

  var n = candidates.length;
  for (var mask = 1; mask < (1 << n); mask++) {
    var subset = [];
    for (var b = 0; b < n; b++) if (mask & (1 << b)) subset.push(candidates[b]);
    if (subset.length > maxStores) continue;

    // Assign each item to its cheapest store in the subset
    var assign = {}, groceries = 0, missing = [];
    input.items.forEach(function (it) {
      var best = null;
      subset.forEach(function (sid) {
        var e = (input.prices[it.id] || {})[sid];
        var p = effectivePrice_(e, storesById[sid], st);
        if (p != null && (best === null || p < best.p)) best = { sid: sid, p: p, e: e };
      });
      if (!best) { missing.push(it.name); return; }
      (assign[best.sid] = assign[best.sid] || []).push({
        id: it.id, name: it.name, qty: it.qty, price: best.p,
        source: best.e.source || 'estimate', matched: best.e.matched || '', note: best.e.note || '',
        updated: best.e.updated || ''
      });
      groceries += best.p;
    });

    // A store that ends up with zero items is a wasted stop: skip this subset
    var used = subset.filter(function (sid) { return assign[sid] && assign[sid].length; });
    if (used.length !== subset.length) continue;

    var route = bestRoute_(used, input.matrix, !input.end);
    var miles = route.meters / 1609.344;
    var driveMin = route.seconds / 60;
    var stopMin = Number(st.stopMinutes || 0) * used.length;
    var fuel = miles / Number(st.mpg || 25) * Number(st.gasPrice || 5);
    var timeCost = (driveMin + stopMin) / 60 * Number(st.timeValue || 0);
    var penalty = missing.length * 1000; // full coverage always wins

    var ordered = route.order.map(function (sid) {
      var items = assign[sid];
      return {
        id: sid, name: storesById[sid].name, short: storesById[sid].short, address: storesById[sid].address,
        bulk: !!storesById[sid].bulk, items: items,
        subtotal: items.reduce(function (a, x) { return a + x.price; }, 0)
      };
    });

    plans.push({
      key: route.order.join('>'),
      stores: ordered,
      groceries: round2_(groceries),
      miles: round1_(miles),
      driveMin: Math.round(driveMin),
      stopMin: stopMin,
      fuel: round2_(fuel),
      timeCost: round2_(timeCost),
      total: round2_(groceries + fuel + timeCost),
      score: groceries + fuel + timeCost + penalty,
      missing: missing,
      mapsUrl: mapsUrl_(input.start, input.end, ordered)
    });
  }

  plans.sort(function (a, b) { return a.score - b.score; });
  var full = plans.filter(function (p) { return !p.missing.length; });
  var pool = full.length ? full : plans;

  var cheapest = pool.slice().sort(function (a, b) { return a.groceries + a.fuel - (b.groceries + b.fuel); })[0];
  var fastest = pool.slice().sort(function (a, b) { return (a.driveMin + a.stopMin) - (b.driveMin + b.stopMin) || a.groceries - b.groceries; })[0];
  var leastFuel = pool.slice().sort(function (a, b) { return a.fuel - b.fuel || a.groceries - b.groceries; })[0];

  return {
    best: pool[0] || null,
    cheapest: cheapest || null,
    fastest: fastest || null,
    leastFuel: leastFuel || null,
    alternatives: pool.slice(0, 8),
    considered: plans.length,
    candidates: candidates
  };
}

/** Lowercase title match: every token must match; a token may be "a|b". */
function titleMatches_(title, must) {
  var t = String(title || '').toLowerCase();
  return (must || []).every(function (tok) {
    return tok.split('|').some(function (alt) { return t.indexOf(alt) >= 0; });
  });
}

function round2_(x) { return Math.round(x * 100) / 100; }
function round1_(x) { return Math.round(x * 10) / 10; }


export { planTrips, titleMatches_, mapsUrl_, effectivePrice_ };

/* ==========================================================================
   mc-foodapi.js — Open Food Facts client for the Nutrition tab
   --------------------------------------------------------------------------
   Looks up packaged/brand foods from Open Food Facts (free, no API key, CORS
   enabled) and normalizes the messy `nutriments` blob into the app's macro
   shape: { kcal, p, f, c }. Two entry points:

     MCFoodAPI.search(query)   -> Promise<[item]>   (text search)
     MCFoodAPI.lookup(barcode) -> Promise<item|null> (barcode → product)
     MCFoodAPI.parse(text)     -> Promise<[{query,qty,unit}]> (NL description → search-ready items)

   A normalized `item` is:
     { code, name, brand, basis:'serving'|'100g', servingLabel, grams,
       kcal, p, f, c, nutr:{ fiber, sugar, chol, sodium } }
   where the macros are PER ONE UNIT of `basis` (one serving if the product
   declares a serving size, else per 100 g — `servingLabel` says which).
   `grams` is the weight of one base unit (serving grams, or 100 for 100g) so
   the UI can convert between servings / grams / oz. `nutr` carries fiber/sugar
   in grams and cholesterol/sodium in mg (any field undefined if not reported).

   Every successful result is cached in localStorage ('mc_foodapi_cache_v1')
   so repeat foods resolve instantly and work offline (kitchen Wi-Fi is
   flaky). On a network/lookup miss the callers fall back to manual entry.
   ========================================================================== */
(function () {
  if (window.MCFoodAPI) return;

  var BASE = 'https://world.openfoodfacts.org';
  var FIELDS = 'code,product_name,brands,nutriments,serving_size,serving_quantity,nutrition_data_per';
  var CACHE_KEY = 'mc_foodapi_cache_v1';
  var CACHE_MAX = 300;          // cap cached lookups
  var TIMEOUT_MS = 8000;

  // Master food aggregator (Supabase edge function: USDA + OFF, server-side
  // keys, owned cache). We call it first and fall back to OFF direct if it's
  // unreachable — so the app keeps working even before the function is deployed.
  var FN_URL = 'https://dhlxmoyjfxohbeiexwnr.supabase.co/functions/v1/food';
  var FN_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobHhtb3lqZnhvaGJlaWV4d25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjgwNDAsImV4cCI6MjA5NjcwNDA0MH0.G9XpWjEqaGhY7mdLjz8yAaQBFl5EXvYFfAkJMivG38E';
  function fnJSON(qs) {
    return fetchWithTimeout(FN_URL + '?' + qs, { headers: { apikey: FN_KEY, Authorization: 'Bearer ' + FN_KEY } })
      .then(function (r) { if (!r.ok) throw new Error('fn ' + r.status); return r.json(); });
  }

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  // ---- localStorage cache (simple { key: {t, v} } map, LRU-ish by trim) ----
  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeCache(c) {
    try {
      var keys = Object.keys(c);
      if (keys.length > CACHE_MAX) {
        // drop the oldest entries by timestamp
        keys.sort(function (a, b) { return (c[a].t || 0) - (c[b].t || 0); });
        keys.slice(0, keys.length - CACHE_MAX).forEach(function (k) { delete c[k]; });
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) {}
  }
  function cacheGet(key) { var c = readCache(); return c[key] ? c[key].v : null; }
  function cacheSet(key, val) { var c = readCache(); c[key] = { t: Date.now(), v: val }; writeCache(c); }

  // ---- fetch with timeout — shared by every network call in this module.
  // Every caller (fnJSON, fetchJSON, parse) already falls back gracefully
  // (a direct-OFF retry, or an empty result) when the returned promise
  // rejects, so an abort here always lands somewhere useful rather than
  // hanging the caller. fnJSON previously used a bare fetch() with no
  // timeout at all — on a stalled connection (captive portal, one-bar gym
  // Wi-Fi) that left search spinning until the browser's own multi-minute
  // ceiling, well past the point a trainee would give up and assume the
  // app was frozen. ------------------------------------------------------
  function fetchWithTimeout(url, opts) {
    opts = opts || {};
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(url, opts).then(function (r) {
      if (timer) clearTimeout(timer);
      return r;
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      throw e;
    });
  }
  function fetchJSON(url) {
    return fetchWithTimeout(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  // ---- normalize one OFF product → item or null ----------------------------
  // Prefers per-serving values when the product declares a serving size and
  // carries *_serving nutriments; otherwise falls back to per-100g.
  function normalize(prod) {
    if (!prod) return null;
    var n = prod.nutriments || {};
    var name = (prod.product_name || '').trim();
    if (!name) return null;

    var hasServing = !!prod.serving_size &&
      (n['energy-kcal_serving'] != null || n.proteins_serving != null);

    var item = {
      code: prod.code || '',
      name: name,
      brand: ((prod.brands || '').split(',')[0] || '').trim()
    };

    // micronutrients + serving weight (grams), per the chosen basis, so the
    // Nutrition Facts sheet can show fiber/sugar/cholesterol/sodium and convert
    // between servings / grams / oz. Undefined when the product omits them.
    function micros(sfx) {
      var sodium = n['sodium' + sfx];
      // OFF often reports salt, not sodium (sodium ≈ salt / 2.5); both in grams
      if (sodium == null && n['salt' + sfx] != null) sodium = num(n['salt' + sfx]) / 2.5;
      return {
        fiber: n['fiber' + sfx] != null ? +num(n['fiber' + sfx]).toFixed(1) : undefined,
        sugar: n['sugars' + sfx] != null ? +num(n['sugars' + sfx]).toFixed(1) : undefined,
        chol: n['cholesterol' + sfx] != null ? Math.round(num(n['cholesterol' + sfx]) * 1000) : undefined, // g→mg
        sodium: sodium != null ? Math.round(num(sodium) * 1000) : undefined                               // g→mg
      };
    }

    if (hasServing) {
      item.basis = 'serving';
      item.servingLabel = String(prod.serving_size);
      item.grams = prod.serving_quantity != null ? num(prod.serving_quantity) : undefined;
      item.kcal = Math.round(num(n['energy-kcal_serving']));
      item.p = Math.round(num(n.proteins_serving));
      item.f = Math.round(num(n.fat_serving));
      item.c = Math.round(num(n.carbohydrates_serving));
      item.nutr = micros('_serving');
    } else {
      item.basis = '100g';
      item.servingLabel = '100 g';
      item.grams = 100;
      item.kcal = Math.round(num(n['energy-kcal_100g']));
      item.p = Math.round(num(n.proteins_100g));
      item.f = Math.round(num(n.fat_100g));
      item.c = Math.round(num(n.carbohydrates_100g));
      item.nutr = micros('_100g');
    }
    // a product with no usable energy value is useless for logging
    if (!item.kcal && !item.p && !item.f && !item.c) return null;
    return item;
  }

  // ---- public: text search -------------------------------------------------
  function search(query) {
    query = (query || '').trim();
    if (!query) return Promise.resolve([]);
    var ckey = 'q:' + query.toLowerCase();
    var cached = cacheGet(ckey);
    if (cached) return Promise.resolve(cached);

    // aggregator first (USDA + OFF), then OFF direct as a fallback
    return fnJSON('q=' + encodeURIComponent(query)).then(function (data) {
      var items = (data && data.items) || [];
      if (items.length) { cacheSet(ckey, items); return items; }
      return offSearchDirect(query, ckey, cached);
    }).catch(function () { return offSearchDirect(query, ckey, cached); });
  }

  function offSearchDirect(query, ckey, cached) {
    var url = BASE + '/cgi/search.pl?search_simple=1&action=process&json=1' +
      '&page_size=20&fields=' + encodeURIComponent(FIELDS) +
      '&search_terms=' + encodeURIComponent(query);
    return fetchJSON(url).then(function (data) {
      var products = (data && data.products) || [];
      var items = [];
      for (var i = 0; i < products.length; i++) {
        var it = normalize(products[i]);
        if (it) items.push(it);
      }
      if (items.length) cacheSet(ckey, items);
      return items;
    }).catch(function () {
      // Both the aggregator and this direct-OFF retry failed — genuinely
      // unreachable, not just "no matches for this term". search() only
      // reaches this catch when there was no cache hit (it returns early
      // above otherwise), so `cached` is always falsy here; flag the empty
      // result so callers can tell "no matches" from "couldn't check".
      var fallback = cached || [];
      fallback.networkError = true;
      return fallback;
    });
  }

  // ---- public: barcode lookup ---------------------------------------------
  function lookup(barcode) {
    barcode = (barcode || '').replace(/\D/g, '');
    if (!barcode) return Promise.resolve(null);
    var ckey = 'b:' + barcode;
    var cached = cacheGet(ckey);
    if (cached) return Promise.resolve(cached);

    return fnJSON('barcode=' + encodeURIComponent(barcode)).then(function (data) {
      var it = data && data.item;
      if (it) { cacheSet(ckey, it); return it; }
      return offLookupDirect(barcode, ckey, cached);
    }).catch(function () { return offLookupDirect(barcode, ckey, cached); });
  }

  function offLookupDirect(barcode, ckey, cached) {
    var url = BASE + '/api/v2/product/' + encodeURIComponent(barcode) +
      '.json?fields=' + encodeURIComponent(FIELDS);
    return fetchJSON(url).then(function (data) {
      if (!data || data.status === 0 || !data.product) return null;
      var it = normalize(data.product);
      if (it) cacheSet(ckey, it);
      return it;
    }).catch(function () { return cached || null; });
  }

  // ---- public: natural-language parse (roadmap 4.2) ------------------------
  // "two eggs and a slice of toast" -> [{query, qty, unit}, ...]. The model
  // only extracts what was said, never nutrition numbers — callers still run
  // each `query` through search() above for real, grounded macro data.
  var PARSE_URL = 'https://dhlxmoyjfxohbeiexwnr.supabase.co/functions/v1/parse-food';
  function parse(text) {
    text = (text || '').trim();
    if (!text) return Promise.resolve([]);
    return fetchWithTimeout(PARSE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: FN_KEY, Authorization: 'Bearer ' + FN_KEY },
      body: JSON.stringify({ text: text })
    }).then(function (r) { if (!r.ok) throw new Error('parse ' + r.status); return r.json(); })
      .then(function (data) { return (data && Array.isArray(data.items)) ? data.items : []; })
      .catch(function () { return []; });
  }

  window.MCFoodAPI = { search: search, lookup: lookup, parse: parse };
})();

/* ==========================================================================
   mc-offline-prefetch.js — take the active program offline on selection
   --------------------------------------------------------------------------
   Audit G-05 / K-2.1: sw.js precaches the app shell but none of the 145
   workout pages — each caches only on first visit. A trainee who selects a
   program on the couch and only opens Day 1 before leaving for the gym finds
   Day 2 "You are offline" the moment gym Wi-Fi drops.

   No SW change needed: sw.js's fetch handler already caches ANY same-origin
   GET it sees (stale-while-revalidate, base.css comment "the ~25 module
   loads per workout page feel instant"). This module just needs to make that
   GET happen once, right after the trainee picks a program, instead of
   waiting for them to tap into every page by hand — a plain fetch() loop,
   exactly as the audit named it.

   The hard part is finding WHICH pages belong to a program. There is no
   authoritative page list to read: mc-pm-data.js's `splits` field is display
   labels ("Split 1", "Phase 2 · Barbell"), not hrefs, and the 10 programs
   don't share one shape — most flagship and licensed-influencer programs
   link their pages directly from the landing page; ks nests a second landing
   (cat-ie.html)
   one hop deeper; pmc's split pages (pmc-split1..7.html) are never in an
   <a href> at all — cat-pmc.html's picker builds them from JS object
   literals; ss (Strength & Supersets) has no static per-split pages at all,
   it's entirely engine/data-rendered. A hand-maintained per-program page
   list would be exactly the class of drift store-registry.json exists to
   stop being possible (K-1.1) — so this crawls instead of listing.

   crawl() fetches the landing page's raw text and regex-matches every
   `something.html` token in it, not just real <a href> attributes — that
   single pass catches both real links (mm, mc, hv, ...) and the JS-literal
   page names cat-pmc.html embeds (`backUrl: 'pmc-split1.html'`) without two
   code paths. It costs precision (a stray filename in a comment would match
   too) for real recall on the shapes that matter; the cap below bounds the
   damage from a bad match, and an extra harmless page in the cache is not a
   defect. Programs with no static split pages (ss) simply crawl down to
   just their landing + instructions page — correct for what they are, not
   a bug in this file.

   window.MCOfflinePrefetch:
     ensure(activeProg) -> Promise<{progId, count}|null>
       Given the dashboard hero's activeProg card, crawls + prefetches its
       program once per program-id change (persisted, so it doesn't re-run on
       every dashboard visit), then marks it done for the confirmation line.
       Resolves null (no-op, not an error) for: no program selected, a
       custom/published program (no MC_PM_DATA entry — no fixed pages to
       find), no fetch API, offline right now, or already done recently.
     status(progId) -> {ts, count} | null
       Last completed prefetch record for a program id, for the "Available
       offline ✓" line — read directly, no promise, so a page that already
       finished prefetching on a prior visit can show the line immediately.
       It is a RECORD, not proof: verify() is.
     verify(progId) -> Promise<{progId, total, cached}|null>
       Asks the Cache API whether every page the last prefetch fetched is
       still there (flagship readiness R3, step 3).

   Flagship readiness R3 / D-17: a deploy's service worker used to delete
   every page this module had fetched while the record lived on for 14 days,
   so the dashboard said "Available offline ✓" over an empty cache. sw.js now
   carries the old pages across a deploy, and this side does two things of
   its own: a record remembers its URLs and the cache version it filled, so a
   new deploy's cache is filled again on the next dashboard visit; and the
   line is painted from caches.match(), never from the record alone.
   ========================================================================== */
(function () {
  "use strict";
  if (window.MCOfflinePrefetch) return;

  var KEY = 'mc_offline_prefetch_v1';
  var inflight = {};   // progId -> in-progress Promise, so concurrent ensure() calls share one crawl
  var REFRESH_MS = 14 * 24 * 60 * 60 * 1000;   // re-crawl a program at most this often
  var MAX_PAGES = 60;                           // hard cap on fetches per prefetch run
  var STAGGER_MS = 120;                         // spacing between fetches — polite on gym Wi-Fi
  // Digit-led filenames need the class to accept a digit as the first
  // character too — a letter-only first char either dropped a wholly
  // digit-then-hyphen-led name outright (no letter-led boundary exists in it
  // at all) or truncated a mixed one at its first letter-led segment (turning
  // it into a URL that doesn't exist). Caught live against a real licensed
  // program's split-page names, which are numbering-scheme filenames.
  var FILENAME_RE = /\b[A-Za-z0-9][A-Za-z0-9_-]*\.html\b/g;

  // Pages a crawl must never follow into: universal nav/utility pages, and
  // any OTHER program's own landing (crawling sideways into a sibling
  // program on selection would just waste the trainee's data plan).
  var BLOCKLIST = [
    'dashboard.html', 'index.html', 'exercise-library.html', 'workout-logs.html',
    'stats.html', 'quick-tour.html', 'quick-tour-overview.html', 'program-guide.html',
    'collections.html', 'build-workout.html', 'build-program.html', 'import.html',
    'mc-home.html', 'pmc-home.html', 'kitchen-sink.html', 'kitchen-sink-s3.html',
    'kitchen-sink-s4.html', 'kitchen-sink-s5.html', 'kitchen-sink-s6.html',
    'the-500.html', 'pm-mode-overview.html'
  ];
  // kitchen-sink*.html are excluded above even though 'ks' links them: they
  // are the fleet's shared component-gallery pages (S4b/S5a), not workout
  // content — precached already as part of the app shell in sw.js.

  function store() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function save(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
  }

  function status(progId) {
    var s = store()[progId];
    return (s && s.count) ? s : null;
  }

  // The service worker's own app cache: the one mc-training-* cache that is
  // neither the font cache nor the carry-over cache. Null when there is not
  // exactly one (no SW yet, or a new deploy installing beside the old one),
  // so a version comparison is never made on a guess.
  function currentCacheName() {
    if (typeof caches === 'undefined' || !caches.keys) return Promise.resolve(null);
    return caches.keys().then(function (keys) {
      var app = keys.filter(function (k) {
        return /^mc-training-/.test(k) && !/^mc-training-(fonts|carry)-/.test(k);
      });
      return app.length === 1 ? app[0] : null;
    }).catch(function () { return null; });
  }

  function verify(progId) {
    var rec = store()[progId];
    if (!rec || !rec.count || !Array.isArray(rec.urls) || !rec.urls.length) return Promise.resolve(null);
    if (typeof caches === 'undefined' || !caches.match) return Promise.resolve(null);
    // Any cache counts, the carry-over one included: the question is whether
    // the page will load offline, and sw.js serves a carried page then.
    return Promise.all(rec.urls.map(function (u) {
      return caches.match(u, { ignoreSearch: true }).then(function (r) { return !!r; }).catch(function () { return false; });
    })).then(function (hits) {
      return { progId: progId, total: rec.urls.length, cached: hits.filter(Boolean).length };
    }).catch(function () { return null; });
  }

  function siblingHrefs(exceptId) {
    var out = [];
    try {
      (window.MC_PM_DATA && MC_PM_DATA.programs || []).forEach(function (p) {
        if (p.id !== exceptId && p.href) out.push(p.href);
      });
    } catch (e) {}
    return out;
  }

  function extractHtmlNames(text) {
    var m = text.match(FILENAME_RE);
    return m ? m : [];
  }

  function crawl(startUrl, exceptId) {
    var blocked = BLOCKLIST.concat(siblingHrefs(exceptId));
    var visited = {};                     // url -> true (fetched-for-links or queued)
    visited[startUrl] = true;
    var frontier = [startUrl];

    function fetchText(url) {
      return fetch(url).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; });
    }

    function pass(urls) {
      return Promise.all(urls.map(fetchText)).then(function (texts) {
        var next = [];
        texts.forEach(function (text) {
          extractHtmlNames(text).forEach(function (name) {
            if (visited[name]) return;
            if (blocked.indexOf(name) >= 0) return;
            if (Object.keys(visited).length >= MAX_PAGES) return;
            visited[name] = true;
            next.push(name);
          });
        });
        return next;
      });
    }

    // depth 2: the landing page itself, then one hop past whatever it names —
    // enough to reach ks's nested cat-ie.html -> iron-engine.html, without
    // crawling indefinitely into pages that reference many other pages.
    return pass(frontier).then(function (depth1) {
      return pass(depth1).then(function () { return Object.keys(visited); });
    });
  }

  // Resolves the URLs that really came back 2xx, in order.
  function prefetchAll(urls) {
    return Promise.all(urls.map(function (url, i) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          fetch(url).then(function (resp) {
            // L8: a fetch() promise resolving is not success — it only
            // REJECTS on a true network failure, so a 404 (a stale/renamed
            // page in a crawled link) used to count as a successful
            // prefetch just like a real 200, inflating the "Available
            // offline ✓" confirmation count with pages that were never
            // actually cached. resp.ok is the real signal (2xx only —
            // this also already excludes an opaque no-cors response, whose
            // status is always 0 and therefore never .ok).
            resolve(resp && resp.ok ? url : null);
          }).catch(function () { resolve(null); });
        }, i * STAGGER_MS);
      });
    })).then(function (results) {
      return results.filter(Boolean);
    });
  }

  function ensure(activeProg) {
    if (!activeProg || !activeProg.id) return Promise.resolve(null);
    if (!window.fetch) return Promise.resolve(null);
    if ('onLine' in navigator && !navigator.onLine) return Promise.resolve(null);
    // L8: up to MAX_PAGES fetches, fired back-to-back (STAGGER_MS apart) the
    // instant a program is picked — respect an explicit low-data signal
    // instead of spending a trainee's data cap or a slow 2G connection on a
    // background prefetch they didn't ask for. `navigator.connection` isn't
    // implemented everywhere (notably Safari/iOS), so its absence is not a
    // signal either way — this only ever SKIPS on an explicit true/2g,
    // never blocks a browser that can't say.
    try {
      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return Promise.resolve(null);
    } catch (e) {}

    // Only catalog programs (mc-pm-data.js) have a fixed page set to find.
    // Custom (cprogId) and PM-published (pubId) programs are built from
    // stored exercise data on ONE runtime page, not a set of static pages —
    // nothing here for a crawl to discover.
    var entry = null;
    try {
      entry = (window.MC_PM_DATA && MC_PM_DATA.programs || []).filter(function (p) {
        return p.id === activeProg.id;
      })[0] || null;
    } catch (e) {}
    if (!entry || !entry.href) return Promise.resolve(null);

    var id = activeProg.id;
    if (inflight[id]) return inflight[id];

    var run = currentCacheName().then(function (cacheName) {
      var prior = store()[id];
      // Still good: recent, filled into the cache that is live now, and every
      // page is still there. A record from before R3 (no urls) or from an
      // older deploy's cache is re-run once.
      var recent = prior && prior.count && (Date.now() - prior.ts) < REFRESH_MS;
      var sameCache = prior && Array.isArray(prior.urls) && (!cacheName || prior.cache === cacheName);
      if (!recent || !sameCache) return null;
      return verify(id).then(function (v) {
        return (v && v.cached >= v.total) ? prior : null;
      });
    }).then(function (stillGood) {
      if (stillGood) return { progId: id, count: stillGood.count };
      return crawl(entry.href, id).then(function (urls) {
        return prefetchAll(urls).then(function (got) {
          // The cache name is read AFTER the fetches, so the record names the
          // cache they actually landed in.
          return currentCacheName().then(function (cacheName) {
            var rec = { ts: Date.now(), count: got.length, urls: got, cache: cacheName };
            var latest = store();          // re-read: another key may have written meanwhile
            latest[id] = rec;
            save(latest);
            return { progId: id, count: got.length };
          });
        });
      });
    }).catch(function () { return null; }).then(function (result) {
      delete inflight[id];
      return result;
    });
    inflight[id] = run;
    return run;
  }

  window.MCOfflinePrefetch = { ensure: ensure, status: status, verify: verify };
})();

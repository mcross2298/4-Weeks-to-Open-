#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-sw.js — LS-4 (audit W-12) regression test for sw.js's
   stale-while-revalidate strategy, run against the REAL source (not a copy).

   sw.js's live fetch handler is guarded to the production origin
   (https://mcross2298.github.io) and self-activates, so it can't be exercised
   on localhost or in a plain require(). This test sandboxes the real file with
   `vm` — the same technique as tools/test-mc-sync-merge.js — providing a no-op
   SW global plus a fake fetch/caches, then calls the hoisted
   staleWhileRevalidate() function directly and asserts the four cases that
   matter:

     1. cache HIT            -> serve cache instantly; refresh cache behind
     2. cache MISS, net OK   -> serve network; populate cache
     3. cache MISS, net FAIL -> serve the offline fallback
     4. cache HIT, net FAIL  -> still serve cache instantly (no throw)

   Offline reload behaviour on the real SW still needs a device check on the
   production origin (see the audit's LS-4 note) — this covers the logic.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const key = req => (typeof req === 'string' ? req : (req && req.url) || String(req));

let checks = 0, failures = 0;
function assert(cond, msg) {
    checks++;
    if (!cond) { failures++; console.error('  ✗ ' + msg); }
}
const flush = () => new Promise(r => setImmediate(r)); // let un-awaited cache puts settle

// ignoreSearch mirrors the real Cache API: strip the query string before
// comparing keys. Needed to test L1 below.
function matchIn(map, req, opts) {
    const k = key(req);
    if (map.has(k)) return map.get(k);
    if (opts && opts.ignoreSearch) {
        const base = k.split('?')[0];
        for (const [sk, sv] of map) { if (sk.split('?')[0] === base) return sv; }
    }
    return undefined;
}

// `store` is THIS deploy's cache (CACHE_NAME) and every name the test does not
// list in `named`. `named` holds the rest by cache name: the R3 carry-over
// cache, an old deploy's cache for the activate tests, and so on.
function loadSW(fetchImpl, store, named) {
    named = named || {};
    const cacheFor = name => named[name] || store;
    const sandbox = {
        self: { addEventListener() {}, registration: {}, clients: {} },
        clients: {},
        caches: {
            open: async name => {
                const m = cacheFor(name);
                return {
                    put: async (req, resp) => { m.set(key(req), resp); },
                    match: async (req, opts) => matchIn(m, req, opts),
                    keys: async () => Array.from(m.keys()).map(url => ({ url })),
                    delete: async (req) => m.delete(key(req)),
                };
            },
            // Searches EVERY cache, like the real one. R3: the fetch path
            // must not use it, or the carry-over copy would beat the network.
            match: async (req, opts) => {
                const hit = matchIn(store, req, opts);
                if (hit) return hit;
                for (const n of Object.keys(named)) { const h = matchIn(named[n], req, opts); if (h) return h; }
                return undefined;
            },
            keys: async () => Object.keys(named),
            delete: async name => { const had = name in named; delete named[name]; return had; },
        },
        fetch: fetchImpl,
        Response: class { constructor(body, init) { this.body = body; this.init = init; this.status = (init && init.status) || 200; this.headers = (init && init.headers) || { get: () => null }; if (body && body.tag) this.tag = body.tag; } clone() { return this; } },
        Headers: class {
            constructor(src) { this.m = new Map(); if (src && src.get) for (const n of ['date', 'content-type', 'x-mc-carried-at']) { const v = src.get(n); if (v != null) this.m.set(n, v); } }
            get(n) { return this.m.has(n) ? this.m.get(n) : null; }
            set(n, v) { this.m.set(n, String(v)); }
        },
        setTimeout, clearTimeout, console,
    };
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox, { filename: 'sw.js' });
    if (typeof sandbox.staleWhileRevalidate !== 'function') {
        console.error('FAIL: staleWhileRevalidate not found in sw.js'); process.exit(1);
    }
    return sandbox;
}

const netResp = (tag, opts) => ({
    status: (opts && opts.status) || 200,
    ok: opts && 'ok' in opts ? opts.ok : true,
    tag,
    body: { tag },   // so a response the SW re-wraps (T3 carry stamp) keeps its tag
    headers: { get: name => (opts && opts.headers && opts.headers[name]) || null },
    clone() { return this; },
});
const fallback = () => ({ status: 200, tag: 'OFFLINE', ok: true, headers: { get: () => null }, clone() { return this; } });

(async () => {
    // 1. cache HIT -> instant cache, revalidate behind
    {
        const store = new Map([['u1', { tag: 'CACHED' }]]);
        const sw = loadSW(async () => netResp('NET'), store);
        const { response, revalidation } = sw.staleWhileRevalidate('u1', fallback);
        const r = await response;
        assert(r && r.tag === 'CACHED', '1: cache hit serves cached copy instantly');
        await revalidation; await flush();
        assert(store.get('u1').tag === 'NET', '1: cache refreshed in background to network copy');
    }
    // 2. cache MISS, network OK -> network + populate cache
    {
        const store = new Map();
        const sw = loadSW(async () => netResp('NET'), store);
        const { response, revalidation } = sw.staleWhileRevalidate('u2', fallback);
        const r = await response;
        assert(r && r.tag === 'NET', '2: cache miss serves network response');
        await revalidation; await flush();
        assert(store.get('u2') && store.get('u2').tag === 'NET', '2: network response cached for next time');
    }
    // 3. cache MISS, network FAIL -> offline fallback
    {
        const store = new Map();
        const sw = loadSW(async () => { throw new Error('offline'); }, store);
        const { response } = sw.staleWhileRevalidate('u3', fallback);
        const r = await response;
        assert(r && r.tag === 'OFFLINE', '3: cache miss + network fail serves offline fallback');
    }
    // 4. cache HIT, network FAIL -> still instant cache, no throw
    {
        const store = new Map([['u4', { tag: 'CACHED' }]]);
        const sw = loadSW(async () => { throw new Error('offline'); }, store);
        const { response, revalidation } = sw.staleWhileRevalidate('u4', fallback);
        const r = await response;
        assert(r && r.tag === 'CACHED', '4: cache hit + network fail still serves cache');
        let threw = false;
        try { await revalidation; } catch (e) { threw = true; }
        assert(!threw, '4: failed revalidation does not reject');
    }

    // 5. L1: a precached navigation queried with app-state params (e.g.
    // `dashboard.html?tab=conditioning`) must hit the no-query cache entry
    // when matchIgnoresSearch (offline navigations) — and must NOT when it's
    // off (versioned asset requests like `base.css?v=68`, where the query is
    // a real cache-buster and a stale match would be a worse bug than L1).
    {
        const store = new Map([['dashboard.html', { tag: 'CACHED' }]]);
        const sw = loadSW(async () => { throw new Error('offline'); }, store);
        const { response: withIgnore } = sw.staleWhileRevalidate('dashboard.html?tab=conditioning', fallback, true);
        assert((await withIgnore).tag === 'CACHED', '5a: navigation with query hits no-query cache entry when ignoreSearch is set');
        const { response: withoutIgnore } = sw.staleWhileRevalidate('dashboard.html?tab=conditioning', fallback, false);
        assert((await withoutIgnore).tag === 'OFFLINE', '5b: asset-style request with query does NOT ignoreSearch (cache-busting stays intact)');
    }

    // 6. L3: a swapped-in response (network returns HTML for a non-HTML
    // request — a captive-portal/proxy substitution, or any misconfigured
    // edge) must NOT be written into the cache, even though it's a real 200.
    {
        const store = new Map();
        const swapped = netResp('SWAPPED', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        const sw = loadSW(async () => swapped, store);
        const { response, revalidation } = sw.staleWhileRevalidate('mc-setlog.js', fallback, false);
        assert((await response).tag === 'SWAPPED', '6a: the swapped response is still served this once (no worse than a broken load)');
        await revalidation; await flush();
        assert(!store.has('mc-setlog.js'), '6b: an HTML response to a non-HTML request is never cached');
    }
    // 6c. control: a genuine 200 with no/non-HTML content-type for a non-HTML
    // request still caches normally (the guard doesn't over-trigger).
    {
        const store = new Map();
        const sw = loadSW(async () => netResp('NET', { headers: { 'Content-Type': 'application/javascript' } }), store);
        const { revalidation } = sw.staleWhileRevalidate('mc-setlog.js', fallback, false);
        await revalidation; await flush();
        assert(store.get('mc-setlog.js') && store.get('mc-setlog.js').tag === 'NET', '6c: a correctly-typed asset response still caches');
    }
    // 6d. control: an HTML response to an HTML (navigation) request is
    // expected and must still cache — the guard is scoped to !isHTML only.
    {
        const store = new Map();
        const sw = loadSW(async () => netResp('NET', { headers: { 'Content-Type': 'text/html' } }), store);
        const { revalidation } = sw.staleWhileRevalidate('dashboard.html', fallback, true);
        await revalidation; await flush();
        assert(store.get('dashboard.html') && store.get('dashboard.html').tag === 'NET', '6d: a real HTML navigation response still caches normally');
    }

    // 7. L5: the offline fallback for a non-HTML asset must be network-error
    // shaped (non-2xx, empty body) — never the HTML shell a <script src>
    // would try (and fail) to parse as JS with no visible error.
    {
        const sw = loadSW(async () => { throw new Error('offline'); }, new Map());
        const r = sw.assetOfflinePage();
        assert(r.status === 503, '7a: assetOfflinePage() returns a non-2xx status');
        assert(r.body === '', '7b: assetOfflinePage() body is empty (nothing for a script/link tag to mis-parse)');
        // control: the HTML navigation fallback is unchanged — still the
        // themed offline shell, still typed as HTML.
        const h = sw.offlinePage();
        assert(typeof h.body === 'string' && h.body.indexOf('<html') !== -1, '7c: offlinePage() (navigations) still returns the themed HTML shell');
    }

    // 8. L4: cacheFirstFont must not cache a failed fetch, and must serve a
    // successful one — real CORS mode (dropped {mode:'no-cors'}) makes
    // resp.ok meaningful, where the old opaque response (status always 0)
    // made success and failure indistinguishable.
    {
        const store = new Map();
        const sw = loadSW(async () => netResp('FONT_FAIL', { ok: false, status: 404 }), store);
        await sw.cacheFirstFont('font.woff2');
        await flush();
        assert(!store.has('font.woff2'), '8a: a failed font fetch is never cached (would otherwise persist forever in FONT_CACHE_NAME)');
    }
    {
        const store = new Map();
        const sw = loadSW(async () => netResp('FONT_OK', { ok: true, status: 200 }), store);
        const r = await sw.cacheFirstFont('font2.woff2');
        assert(r.tag === 'FONT_OK', '8b: a successful font fetch is served');
        await flush();
        assert(store.has('font2.woff2') && store.get('font2.woff2').tag === 'FONT_OK', '8c: a successful font fetch is cached');
    }
    {
        // network throws entirely (offline) -> falls back to whatever was
        // cached (undefined on a cold cache is fine; the real caller is a
        // <link>/@font-face load, which just fails naturally).
        const store = new Map([['font3.woff2', { tag: 'CACHED_FONT' }]]);
        const sw = loadSW(async () => { throw new Error('offline'); }, store);
        const r = await sw.cacheFirstFont('font3.woff2');
        assert(r && r.tag === 'CACHED_FONT', '8d: an already-cached font is still served when the network is down');
    }

    // 9. R3 / D-17: the carry-over cache. A deploy's activate used to delete
    // every page the athlete had prefetched; it now moves what the new cache
    // lacks into CARRY_CACHE_NAME, which is read only when the network fails.
    {
        const probe = loadSW(async () => netResp('NET'), new Map());
        // const bindings are not properties of a vm context; evaluate them in it
        const CARRY = vm.runInContext('CARRY_CACHE_NAME', probe), CUR = vm.runInContext('CACHE_NAME', probe);
        assert(typeof CARRY === 'string' && CARRY !== CUR, '9: sw.js declares a carry-over cache distinct from CACHE_NAME');

        // a: offline, nothing in this deploy's cache -> the carried copy, not the offline page
        const carry = new Map([['mm-p2.html', { tag: 'CARRIED' }]]);
        const sw1 = loadSW(async () => { throw new Error('offline'); }, new Map(), { [CARRY]: carry });
        assert((await sw1.staleWhileRevalidate('mm-p2.html', fallback, true).response).tag === 'CARRIED',
            '9a: offline with a carried copy serves it instead of the offline page');
        assert((await sw1.staleWhileRevalidate('mm-p2.html?day=2', fallback, true).response).tag === 'CARRIED',
            '9b: a carried page still matches a navigation carrying query params');

        // c: online -> the network wins over the carried copy, and is cached
        const cur = new Map();
        const sw2 = loadSW(async () => netResp('NET'), cur, { [CARRY]: new Map([['mm-p2.html', { tag: 'CARRIED' }]]) });
        const r2 = sw2.staleWhileRevalidate('mm-p2.html', fallback, true);
        assert((await r2.response).tag === 'NET', '9c: online, the carried copy is never served ahead of the network');
        await r2.revalidation; await flush();
        assert(cur.get('mm-p2.html') && cur.get('mm-p2.html').tag === 'NET', '9d: the fresh page lands in this deploy\'s cache');

        // e: this deploy's own copy beats the carried one, offline too
        const sw3 = loadSW(async () => { throw new Error('offline'); }, new Map([['mm-p2.html', { tag: 'CACHED' }]]),
            { [CARRY]: new Map([['mm-p2.html', { tag: 'CARRIED' }]]) });
        assert((await sw3.staleWhileRevalidate('mm-p2.html', fallback, true).response).tag === 'CACHED',
            '9e: this deploy\'s cache wins over the carried copy');

        // f: activate moves what the new cache lacks, deletes the old cache, keeps fonts + carry
        const fresh = new Map([['base.css', { tag: 'NEW' }]]);
        const named = {
            'mc-training-v99': new Map([['mm-p2.html', netResp('V99')], ['old-only.html', netResp('V99')]]),
            'mc-training-v100': new Map([['mm-p2.html', netResp('V100')], ['base.css', netResp('OLDCSS')]]),
            'mc-training-fonts-v1': new Map([['f.woff2', { tag: 'FONT' }]]),
            [CARRY]: new Map(),
        };
        named[CUR] = fresh;
        const sw4 = loadSW(async () => netResp('NET'), fresh, named);
        await sw4.retireOldCaches(Object.keys(named));
        const c = named[CARRY];
        assert(!('mc-training-v99' in named) && !('mc-training-v100' in named), '9f: old app caches are deleted');
        assert('mc-training-fonts-v1' in named && CUR in named, '9g: the font cache and this deploy\'s cache survive');
        assert(c.get('mm-p2.html') && c.get('mm-p2.html').tag === 'V100', '9h: the newest old copy is the one carried (v100 over v99, numeric order)');
        assert(c.get('old-only.html') && c.get('old-only.html').tag === 'V99', '9i: a page only an older deploy held is carried too');
        assert(!c.has('base.css'), '9j: nothing this deploy already holds is carried');
    }

    // 10. Phase T1.4: activate prunes the carry-over cache. A copy this deploy
    //     holds goes; one fetched more than 60 days ago goes; a recent copy,
    //     and one with no Date header, stay.
    {
        const CARRY = vm.runInContext('CARRY_CACHE_NAME', loadSW(async () => netResp('N'), new Map()));
        const CUR = vm.runInContext('CACHE_NAME', loadSW(async () => netResp('N'), new Map()));
        const dated = (tag, daysAgo) => netResp(tag, { headers: { date: new Date(Date.now() - daysAgo * 86400000).toUTCString() } });
        const fresh = new Map([['mm-p1.html', { tag: 'NEW' }]]);
        const named = {
            [CARRY]: new Map([
                ['mm-p1.html', dated('DUP', 1)],
                ['old.html', dated('OLD', 61)],
                ['recent.html', dated('RECENT', 5)],
                ['undated.html', netResp('UNDATED')],
            ]),
        };
        named[CUR] = fresh;
        const sw = loadSW(async () => netResp('NET'), fresh, named);
        await sw.retireOldCaches(Object.keys(named));
        const c = named[CARRY];
        assert(!c.has('mm-p1.html'), '10a: a carried copy this deploy holds is dropped');
        assert(!c.has('old.html'), '10b: a carried copy older than 60 days is dropped');
        assert(c.has('recent.html') && c.has('undated.html'), '10c: a recent copy and an undated one stay');
        // T3: an undated copy is stamped on the first prune and ages from there.
        const st = c.get('undated.html');
        const at = st && st.headers && Number(st.headers.get('x-mc-carried-at'));
        assert(at && Math.abs(at - Date.now()) < 60000, '10d: an undated copy is stamped with the time it was first pruned');
        await sw.pruneCarry(await sw.caches.open(CUR), await sw.caches.open(CARRY), Date.now() + 30 * 86400000);
        assert(c.has('undated.html'), '10e: a stamped copy 30 days on stays');
        await sw.pruneCarry(await sw.caches.open(CUR), await sw.caches.open(CARRY), Date.now() + 61 * 86400000);
        assert(!c.has('undated.html'), '10f: 61 days after its stamp it is dropped');
    }

    if (failures) { console.error(`\ntest-mc-sw: ${failures} FAILED of ${checks}`); process.exit(1); }
    console.log(`test-mc-sw: all ${checks} assertions passed`);
})();

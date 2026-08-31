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

function loadSW(fetchImpl, store) {
    const sandbox = {
        self: { addEventListener() {}, registration: {}, clients: {} },
        clients: {},
        caches: {
            // cacheFirstFont() (L4) calls .match() on the per-cache object
            // open() returns, not the top-level caches.match() below — both
            // read/write the same shared `store` for this test harness.
            open: async () => ({
                put: async (req, resp) => { store.set(key(req), resp); },
                match: async req => store.get(key(req)),
            }),
            // ignoreSearch mirrors the real Cache API: strip the query string
            // before comparing keys. Needed to test L1 below.
            match: async (req, opts) => {
                const k = key(req);
                if (store.has(k)) return store.get(k);
                if (opts && opts.ignoreSearch) {
                    const base = k.split('?')[0];
                    for (const [sk, sv] of store) { if (sk.split('?')[0] === base) return sv; }
                }
                return undefined;
            },
            keys: async () => [],
            delete: async () => true,
        },
        fetch: fetchImpl,
        Response: class { constructor(body, init) { this.body = body; this.init = init; this.status = (init && init.status) || 200; } clone() { return this; } },
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

    if (failures) { console.error(`\ntest-mc-sw: ${failures} FAILED of ${checks}`); process.exit(1); }
    console.log(`test-mc-sw: all ${checks} assertions passed`);
})();

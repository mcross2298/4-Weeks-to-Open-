#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-offline-prefetch.js — regression coverage for finding L8 against
   mc-offline-prefetch.js's REAL crawl()/prefetchAll()/ensure() (not a copy).

   Same vm-sandbox technique as tools/test-mc-sw.js: the real module guards
   itself to a browser environment (window, navigator, fetch, localStorage),
   so this provides minimal fakes and drives the real, hoisted top-level
   functions through the module's one public entry point, window.
   MCOfflinePrefetch.ensure().

   L8: (a) the crawl+prefetch used to fire regardless of a Save-Data /
   metered / slow-2G signal — a trainee's data cap or a genuinely slow
   connection had no way to opt this background fetch out. (b) a fetch()
   PROMISE RESOLVING was treated as success — it only rejects on a true
   network failure, so a 404 for a renamed/stale crawled link counted
   exactly like a real 200, inflating the "Available offline ✓" count with
   pages that were never actually cached.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.resolve(__dirname, '../mc-offline-prefetch.js'), 'utf8');

let checks = 0, failures = 0;
function assert(cond, msg) { checks++; if (!cond) { failures++; console.error('  ✗ ' + msg); } }

function loadModule(fetchImpl, connection, env) {
    env = env || {};
    const calls = [];
    const fetchMock = (url) => { calls.push(url); return fetchImpl(url); };
    const MC_PM_DATA = { programs: [{ id: 'p1', href: 'landing.html' }] };
    const nav = { onLine: true };
    if (connection) nav.connection = connection;
    const ls = env.ls || null;
    const sandbox = {
        window: {},
        navigator: nav,
        localStorage: ls
            ? { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); } }
            : { getItem: () => null, setItem: () => {} },
        setTimeout, clearTimeout, console, Promise,
    };
    if (env.caches) sandbox.caches = env.caches;
    sandbox.window.fetch = fetchMock;
    sandbox.fetch = fetchMock;
    sandbox.window.MC_PM_DATA = MC_PM_DATA;
    sandbox.MC_PM_DATA = MC_PM_DATA;
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox, { filename: 'mc-offline-prefetch.js' });
    return { M: sandbox.window.MCOfflinePrefetch, calls };
}

// A page's landing text, containing links a real crawl would find.
const page = (text, ok) => ({ ok: ok !== false, text: () => Promise.resolve(text) });

(async () => {
    // 1. L8a: an explicit Save-Data signal skips the prefetch entirely —
    // not even the landing page itself is fetched.
    {
        const { M, calls } = loadModule(() => Promise.resolve(page('')), { saveData: true });
        const r = await M.ensure({ id: 'p1' });
        assert(r === null, '1: Save-Data connection -> ensure() resolves null');
        assert(calls.length === 0, '1: Save-Data connection -> no fetch is ever made');
    }

    // 2. L8a: an explicit slow-2G effectiveType also skips it.
    {
        const { M, calls } = loadModule(() => Promise.resolve(page('')), { effectiveType: '2g' });
        const r = await M.ensure({ id: 'p1' });
        assert(r === null, '2: 2G connection -> ensure() resolves null');
        assert(calls.length === 0, '2: 2G connection -> no fetch is ever made');
    }

    // 3. L8a control: a normal connection (or no Network Information API at
    // all, e.g. Safari) is NOT blocked — the guard must not over-trigger.
    {
        const { M, calls } = loadModule(() => Promise.resolve(page('')));   // no `connection` object at all
        const r = await M.ensure({ id: 'p1' });
        assert(r && typeof r.count === 'number', '3: no Network Information API -> prefetch still runs normally');
        assert(calls.length > 0, '3: ...and actually fetches something');
    }

    // 4. L8b: a 404 among the crawled links must not count as a successful
    // prefetch — only genuinely successful (resp.ok) fetches do.
    {
        const responses = {
            'landing.html': page('<a href="day1.html">Day 1</a> <a href="day2.html">Day 2</a>'),
            'day1.html': page(''),           // real page, no further links
            'day2.html': page('', false),    // a stale/renamed link -> 404
        };
        const { M } = loadModule((url) => Promise.resolve(responses[url] || page('', false)));
        const r = await M.ensure({ id: 'p1' });
        assert(!!r, '4: ensure() resolves a record');
        assert(r.count === 2, `4: only the 2 genuinely-ok fetches count as success (got ${r && r.count})`);
    }

    // 5. Flagship readiness R3 / D-17: the record names its pages and the
    // cache version it filled, and "still good" is checked against the Cache
    // API, not assumed from the record.
    {
        const ls = {};
        const cached = new Set();
        let names = ['mc-training-v183', 'mc-training-fonts-v1', 'mc-training-carry-v1'];
        const caches = {
            keys: async () => names.slice(),
            match: async (u) => (cached.has(u) ? { ok: true } : undefined),
        };
        const responses = {
            'landing.html': page('<a href="day1.html">Day 1</a> <a href="day2.html">Day 2</a>'),
            'day1.html': page(''), 'day2.html': page(''),
        };
        const net = (url) => { cached.add(url); return Promise.resolve(responses[url] || page('', false)); };

        const a = loadModule(net, null, { ls, caches });
        const r1 = await a.M.ensure({ id: 'p1' });
        const rec = JSON.parse(ls.mc_offline_prefetch_v1 || '{}').p1 || {};
        assert(r1 && r1.count === 3, '5a: the first prefetch records 3 pages (got ' + (r1 && r1.count) + ')');
        assert(Array.isArray(rec.urls) && rec.urls.length === 3, '5b: the record keeps the URLs it fetched');
        assert(rec.cache === 'mc-training-v183', '5c: the record names the app cache it filled, not the font or carry cache (got ' + rec.cache + ')');

        const b = loadModule(net, null, { ls, caches });
        await b.M.ensure({ id: 'p1' });
        assert(b.calls.length === 0, '5d: same cache version, every page still cached -> no refetch (fetched ' + b.calls.length + ')');
        const v = await b.M.verify('p1');
        assert(v && v.total === 3 && v.cached === 3, '5e: verify() counts what the Cache API holds');

        cached.delete('day2.html');
        const v2 = await b.M.verify('p1');
        assert(v2 && v2.cached === 2, '5f: verify() sees a page the cache lost (got ' + (v2 && v2.cached) + ')');
        const c = loadModule(net, null, { ls, caches });
        await c.M.ensure({ id: 'p1' });
        assert(c.calls.length > 0, '5g: a page missing from the cache triggers a refetch, even inside the 14-day window');

        names = ['mc-training-v184', 'mc-training-fonts-v1', 'mc-training-carry-v1'];   // a deploy
        const d = loadModule(net, null, { ls, caches });
        await d.M.ensure({ id: 'p1' });
        const rec2 = JSON.parse(ls.mc_offline_prefetch_v1).p1;
        assert(d.calls.length > 0, '5h: a new deploy\'s cache triggers a refetch');
        assert(rec2.cache === 'mc-training-v184', '5i: and the record moves to the new cache name');

        // a record from before R3 (no urls) is re-run once
        const ls2 = { mc_offline_prefetch_v1: JSON.stringify({ p1: { ts: Date.now(), count: 9 } }) };
        const e = loadModule(net, null, { ls: ls2, caches });
        await e.M.ensure({ id: 'p1' });
        assert(e.calls.length > 0, '5j: a pre-R3 record with no URL list is refreshed');
        assert((await e.M.verify('p1')) !== null, '5k: and becomes verifiable');
    }

    if (failures) { console.error(`\ntest-mc-offline-prefetch: ${failures} FAILED of ${checks}`); process.exit(1); }
    console.log(`test-mc-offline-prefetch: all ${checks} assertions passed`);
})();

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

function loadModule(fetchImpl, connection) {
    const calls = [];
    const fetchMock = (url) => { calls.push(url); return fetchImpl(url); };
    const MC_PM_DATA = { programs: [{ id: 'p1', href: 'landing.html' }] };
    const nav = { onLine: true };
    if (connection) nav.connection = connection;
    const sandbox = {
        window: {},
        navigator: nav,
        localStorage: { getItem: () => null, setItem: () => {} },
        setTimeout, clearTimeout, console, Promise,
    };
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

    if (failures) { console.error(`\ntest-mc-offline-prefetch: ${failures} FAILED of ${checks}`); process.exit(1); }
    console.log(`test-mc-offline-prefetch: all ${checks} assertions passed`);
})();

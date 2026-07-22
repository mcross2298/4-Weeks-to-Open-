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
            open: async () => ({ put: async (req, resp) => { store.set(key(req), resp); } }),
            match: async req => store.get(key(req)),
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

const netResp = tag => ({ status: 200, tag, clone() { return this; } });
const fallback = () => ({ status: 200, tag: 'OFFLINE', clone() { return this; } });

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

    if (failures) { console.error(`\ntest-mc-sw: ${failures} FAILED of ${checks}`); process.exit(1); }
    console.log(`test-mc-sw: all ${checks} assertions passed`);
})();

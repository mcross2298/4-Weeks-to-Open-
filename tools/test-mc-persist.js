#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-persist.js — regression coverage for finding L6 (partial) against
   the REAL try{...} block in mc-finish.js's confirm(), not a copy of it.

   mc-finish.js's confirm() is a large, DOM-heavy function (saveWorkout(),
   saveSessionSummary(), showDone(), several document queries) that would
   need a disproportionate amount of mocking to sandbox whole for what is a
   small, self-contained, already try/caught addition. Instead this extracts
   just that one block via regex from the real source and runs it standalone
   against a minimal localStorage/navigator.storage mock — so a future edit
   that breaks its syntax or its "ask at most once" logic still shows up
   here against the real code, without needing the rest of confirm()'s
   machinery.

   L6 (partial): navigator.storage.persist() was never called anywhere in
   the app, so the browser had no signal that this data matters beyond its
   default (evictable-under-pressure) storage bucket. Requested once, on the
   first completed workout — not on every completion, since in Firefox this
   can be a real permission prompt, not just a Chrome-side heuristic bump.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.resolve(__dirname, '../mc-finish.js'), 'utf8');
const m = /(try\{\s*if\(!localStorage\.getItem\('mc_storage_persist_asked'\)[\s\S]*?\}catch\(e\)\{\}\n)/.exec(SRC);
if (!m) { console.error('FAIL: could not find the storage-persist block in mc-finish.js'); process.exit(1); }
const BLOCK = m[1];

let checks = 0, failures = 0;
function assert(cond, msg) { checks++; if (!cond) { failures++; console.error('  ✗ ' + msg); } }

function run(opts) {
    opts = opts || {};
    const store = Object.assign({}, opts.localStorage || {});
    let persistCalled = 0;
    const sandbox = {
        localStorage: {
            getItem: k => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = v; },
        },
        navigator: opts.hasStorageApi === false ? {} : {
            storage: { persist: () => { persistCalled++; return Promise.resolve(true); } },
        },
        console,
    };
    vm.createContext(sandbox);
    vm.runInContext(BLOCK, sandbox, { filename: 'mc-finish.js persist block' });
    return { store, persistCalled: () => persistCalled };
}

// 1. First-ever completion: persist() is requested, and the flag is set so
// it won't be asked again.
{
    const r = run({});
    assert(r.persistCalled() === 1, '1: persist() is called on the first-ever run');
    assert(r.store.mc_storage_persist_asked === '1', '1: the one-time flag is set');
}

// 2. A second completion (flag already set): NOT asked again — the
// annoyance (a real Firefox permission prompt) isn't worth repeating for a
// decision the browser won't reconsider.
{
    const r = run({ localStorage: { mc_storage_persist_asked: '1' } });
    assert(r.persistCalled() === 0, '2: persist() is NOT called again once already asked');
}

// 3. An older/unsupporting browser (no navigator.storage.persist): the
// whole block must be a safe no-op, never throw.
{
    let threw = false;
    try { run({ hasStorageApi: false }); } catch (e) { threw = true; }
    assert(!threw, '3: missing navigator.storage does not throw');
}

if (failures) { console.error(`\ntest-mc-persist: ${failures} FAILED of ${checks}`); process.exit(1); }
console.log(`test-mc-persist: all ${checks} assertions passed`);

#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-sync-runtime.js — regression coverage for findings S1 and S2
   against mc-sync.js's REAL pull()/push()/maybeReload() flow (not a copy).

   Same vm-sandbox technique as tools/test-mc-sync-merge.js, one level
   further: that file only needs the merge functions (pure, hoisted before
   the early-return guards, so they work even when MC_SB is null). This test
   needs the actual runtime cycle — pull() -> push() -> maybeReload() — which
   only exists once MC_SB.configured is true and the module runs past those
   guards, so this sandbox provides a minimal but real MC_SB (a fake Supabase
   client resolving fixed rows) and a controllable localStorage whose
   setItem() can throw QuotaExceededError for a chosen key. The module's own
   bottom-of-file bootstrap (MC_SB.ready -> currentUser() -> start()) then
   runs its real pull/push/maybeReload cycle automatically, same as in a
   real page — nothing here calls those functions directly except where a
   test needs to re-trigger the drain listeners a real focus event would.

   S1: a local write that fails (quota) must not let push() re-upload the
       stale, still-unmerged local value over what the server holds.
   S2: (a) a reload must never fire while workoutInProgress() is true — it
       must defer and fire once the drain listener (focus) sees the workout
       end; (b) push() must complete before any reload.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.resolve(__dirname, '../mc-sync.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + name); } }
// One setImmediate is enough: Node drains the ENTIRE microtask queue —
// including microtasks newly scheduled by other microtasks — before running
// the next macrotask, and every chain here (MC_SB.ready -> currentUser() ->
// start() -> pull() -> push() -> maybeReload()) is promise-only, no real timers.
const flush = () => new Promise(r => setImmediate(r));

// throwOnKeys: Set of localStorage keys whose setItem() throws (simulates
// QuotaExceededError). log: ordered array of side-effect tags ('upsert:<key>',
// 'reload'), used to assert S2's push-before-reload ordering.
function loadModule(throwOnKeys, wip, log, pullRows) {
    const store = {};
    const upserted = [];
    const windowListeners = {}, docListeners = {};

    const localStorage = {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => {
            if (throwOnKeys.has(k)) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
            store[k] = v;
        },
        removeItem: k => { delete store[k]; },
    };
    const sessionStorage = { getItem: () => null, setItem: () => {} };

    const client = {
        from: () => ({
            select: () => ({ eq: () => Promise.resolve({ data: pullRows || [], error: null }) }),
            upsert: (row) => {
                upserted.push(row.store_key);
                log.push('upsert:' + row.store_key);
                return Promise.resolve({ error: null });
            },
        }),
    };
    const MC_SB = {
        configured: true,
        ready: Promise.resolve(client),
        currentUser: () => Promise.resolve({ id: 'u1' }),
    };

    const doc = {
        visibilityState: 'visible',
        addEventListener(type, cb) { (docListeners[type] = docListeners[type] || []).push(cb); },
        getElementById(id) {
            if (id === 'timerFloat' && wip.timerVisible) return { classList: { contains: c => c === 'visible' } };
            return null;
        },
        querySelector() { return wip.checked ? {} : null; },
    };
    const win = { addEventListener(type, cb) { (windowListeners[type] = windowListeners[type] || []).push(cb); } };
    const location = { reload() { log.push('reload'); } };

    const sandbox = {
        module: { exports: {} },
        window: win, document: doc, location,
        localStorage, sessionStorage,
        setInterval: () => 0, clearInterval() {}, setTimeout, clearTimeout,
        console,
    };
    win.MC_SB = MC_SB;        // module reads window.MC_SB in the early-return guard...
    sandbox.MC_SB = MC_SB;    // ...and bare MC_SB everywhere else (both resolve to `window` in a real page)
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox, { filename: 'mc-sync.js' });
    return {
        M: sandbox.module.exports,
        store, upserted,
        fireFocus: () => (windowListeners.focus || []).forEach(cb => cb()),
    };
}

(async () => {
    // ---- S1: a failed local write must block that key from being re-uploaded ----
    {
        const log = [];
        const { M, store, upserted } = loadModule(new Set(['mc_active_prog']), {}, log,
            [{ store_key: 'mc_active_prog', data: 'remoteNew' }]);
        store['mc_active_prog'] = JSON.stringify('localOld');   // pre-existing local value
        await flush();   // module's own MC_SB.ready->currentUser()->start()->pull()->push() runs automatically
        ok('S1: a write that throws leaves quotaBlocked set for that key', !!M.getQuotaBlocked()['mc_active_prog']);
        ok('S1: the failed write did not corrupt or clear the existing local value',
            store['mc_active_prog'] === JSON.stringify('localOld'));
        ok('S1: snapshot was NOT advanced to the remote value on a failed write',
            M.getSnapshot()['mc_active_prog'] !== JSON.stringify('remoteNew'));
        ok('S1: push() never uploaded the quota-blocked key (would overwrite the server\'s newer data)',
            upserted.indexOf('mc_active_prog') === -1);
    }

    // ---- S1 (control): once the write succeeds, the key is not blocked ----
    {
        const log = [];
        const { M, store } = loadModule(new Set(), {}, log,
            [{ store_key: 'mc_active_prog', data: 'remoteNew' }]);
        store['mc_active_prog'] = JSON.stringify('localOld');
        await flush();
        ok('S1 control: a successful write is not blocked', !M.getQuotaBlocked()['mc_active_prog']);
    }

    // ---- S2a: a reload must not fire while workoutInProgress(), and must
    // fire once the drain listener sees the workout end ----
    {
        const log = [];
        const wip = { checked: true };   // mid-workout: a set is checked
        const { fireFocus } = loadModule(new Set(), wip, log,
            [{ store_key: 'mc_active_prog', data: 'remoteNew' }]);   // a real pulled change, so pulledChange=true
        await flush();
        ok('S2a: no reload while mid-workout, even with a pulled change pending', log.indexOf('reload') === -1);
        wip.checked = false;   // workout ends
        fireFocus();           // the drain listener wired in start() (mirrors mc-sw-update.js's applyIfIdle)
        ok('S2a: the deferred reload fires once idle', log.indexOf('reload') !== -1);
    }

    // ---- S2b: push() must complete before a reload can fire (ordering) ----
    {
        const log = [];
        const { store } = loadModule(new Set(), {}, log,   // idle: no workout in progress
            [{ store_key: 'mc_active_prog', data: 'remoteNew' }]);
        // A second, unrelated store with a genuinely unsynced local value, so
        // push() has something real to upload regardless of what the pull
        // above already reconciled — isolates the ORDERING assertion from
        // the merge-equality details of the pulled key.
        store['mc_workout_log_v1'] = JSON.stringify([{ id: 'w1', ts: 1, note: 'x' }]);
        await flush();
        const upsertIdx = log.indexOf('upsert:mc_workout_log_v1');
        const reloadIdx = log.indexOf('reload');
        ok('S2b: the pushed key\'s upsert happened', upsertIdx !== -1);
        ok('S2b: reload fired', reloadIdx !== -1);
        ok('S2b: push completed before reload (upload is not abandoned by an unload)', upsertIdx < reloadIdx);
    }

    console.log(fail ? `\ntest-mc-sync-runtime: ${fail} FAILED of ${pass + fail}` : `test-mc-sync-runtime: all ${pass} assertions passed`);
    process.exit(fail ? 1 : 0);
})();

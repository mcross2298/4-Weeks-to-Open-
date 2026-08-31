#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-sw-update.js — regression test for mc-sw-update.js's
   controllerchange reload guard, run against the REAL source (not a copy).

   Finding L2: the listener that calls location.reload() on a fresh worker
   taking control had two bugs the mid-workout hold (workoutInProgress()) was
   never applied to:

     (a) self.clients.claim() in sw.js's own `activate` handler claims every
         matching client unconditionally — including a page's very first
         load, the instant its own registration activates (nothing else was
         controlling it yet). That fired 'controllerchange' — and an
         unconditional reload — on every user's first-ever visit, with
         nothing stale to replace.
     (b) postMessage('skipWaiting') targets the ONE shared worker script for
         the whole origin, not just the tab that sent it, so
         self.clients.claim() in its activate handler claims every open tab
         — including an idle tab's neighbour that's mid-set. That tab's own
         controller genuinely changes too, and the listener had no guard, so
         an idle tab applying an update could force-reload a DIFFERENT tab
         out from under an in-progress workout.

   Same vm-sandbox technique as tools/test-mc-sw.js: the real file expects a
   browser environment (navigator.serviceWorker, document, window), which
   this provides as minimal fakes, then drives the module's own
   'controllerchange' listener and asserts reload behaviour under three
   real scenarios: fresh install, idle update, and mid-workout update.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'mc-sw-update.js'), 'utf8');

let checks = 0, failures = 0;
function assert(cond, msg) {
    checks++;
    if (!cond) { failures++; console.error('  ✗ ' + msg); }
}
const flush = () => new Promise(r => setImmediate(r));

function fakeEl() {
    return {
        style: {}, classList: { add() {}, contains() { return false; } },
        appendChild() {}, addEventListener() {}, setAttribute() {},
    };
}

// initialController: truthy simulates a page that already had a worker in
// control before this module ran (an update); falsy simulates a fresh
// install (nothing controlling the page yet).
function loadModule(initialController, workoutInProgressRef) {
    let controllerChangeCb = null;
    const windowListeners = {};
    const win = {
        addEventListener(type, cb) { (windowListeners[type] = windowListeners[type] || []).push(cb); },
        location: { reload() { win.__reloaded = true; } },
    };
    const doc = {
        visibilityState: 'visible',
        addEventListener() {},
        getElementById(id) {
            if (id === 'timerFloat' && workoutInProgressRef.timerVisible) {
                return { classList: { contains: c => c === 'visible' } };
            }
            return null;
        },
        querySelector(sel) { return workoutInProgressRef.checked ? {} : null; },
        querySelectorAll() { return []; },
        createElement() { return fakeEl(); },
        head: { appendChild() {} },
        body: { appendChild() {} },
    };
    const reg = { update() {}, waiting: null, addEventListener() {} };
    const sw = {
        controller: initialController,
        addEventListener(type, cb) { if (type === 'controllerchange') controllerChangeCb = cb; },
        register() { return Promise.resolve(reg); },
    };
    const sandbox = {
        window: win,
        document: doc,
        navigator: { serviceWorker: sw },
        console,
        setInterval: () => 0, clearInterval() {}, setTimeout, clearTimeout,
    };
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox, { filename: 'mc-sw-update.js' });
    return {
        fireControllerChange: () => { if (controllerChangeCb) controllerChangeCb(); },
        fireFocus: () => { (windowListeners.focus || []).forEach(cb => cb()); },
        reloaded: () => !!win.__reloaded,
    };
}

(async () => {
    // 1. Fresh install: no prior controller. clients.claim() still fires
    //    'controllerchange' on this very first load — must NOT reload.
    {
        const wip = {};
        const m = loadModule(null, wip);
        await flush();
        m.fireControllerChange();
        assert(!m.reloaded(), '1: fresh install does not reload on its own first claim');
    }

    // 2. Idle update (the normal, legit path): existing controller, no
    //    workout in progress — must still reload immediately, unchanged.
    {
        const wip = {};
        const m = loadModule({}, wip);
        await flush();
        m.fireControllerChange();
        assert(m.reloaded(), '2: an idle tab still reloads immediately on a real update');
    }

    // 3. Mid-workout update, including the cross-tab case (b): existing
    //    controller, a set is checked — must NOT reload immediately...
    {
        const wip = { checked: true };
        const m = loadModule({}, wip);
        await flush();
        m.fireControllerChange();
        assert(!m.reloaded(), '3a: a mid-workout tab does not reload immediately when its controller changes');
        // ...and must reload once the workout is no longer in progress, via
        // the existing focus-driven applyIfIdle() drain.
        wip.checked = false;
        m.fireFocus();
        assert(m.reloaded(), '3b: the deferred reload fires once idle (focus-driven drain)');
    }

    if (failures) { console.error(`\ntest-mc-sw-update: ${failures} FAILED of ${checks}`); process.exit(1); }
    console.log(`test-mc-sw-update: all ${checks} assertions passed`);
})();

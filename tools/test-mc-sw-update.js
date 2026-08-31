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
        style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
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

// ---- richer DOM mock, only for the U4 (offline banner) tests below —
// positionBanner()/ensureOfflineBanner() need real element creation,
// classList, and a body child list, which the lightweight loadModule()
// above deliberately doesn't provide (its existing L2 tests don't need it).
function makeFakeElement(tag) {
    const el = {
        tag, id: '', className: '', textContent: '', style: {},
        _style: { position: 'static', display: 'block', visibility: 'visible' },
        _rect: { top: 0, bottom: 0, height: 0 },
        children: [],
        appendChild(child) { el.children.push(child); },
        addEventListener() {},
        setAttribute() {},
        getBoundingClientRect() { return el._rect; },
        classList: {
            add(c) { if ((' ' + el.className + ' ').indexOf(' ' + c + ' ') < 0) el.className = (el.className + ' ' + c).trim(); },
            remove(c) { el.className = el.className.split(' ').filter(x => x && x !== c).join(' '); },
            toggle(c, force) {
                const has = el.classList.contains(c);
                const want = force === undefined ? !has : force;
                if (want && !has) el.classList.add(c);
                if (!want && has) el.classList.remove(c);
            },
            contains(c) { return (' ' + el.className + ' ').indexOf(' ' + c + ' ') >= 0; },
        },
    };
    return el;
}

function loadModuleForOffline(opts) {
    opts = opts || {};
    const bodyKids = [];
    const byId = {};
    if (opts.nativeOfflineBar) { byId.offlineBar = makeFakeElement('div'); byId.offlineBar.id = 'offlineBar'; }
    const windowListeners = {};
    const win = {
        addEventListener(type, cb) { (windowListeners[type] = windowListeners[type] || []).push(cb); },
        location: { reload() {} },
    };
    const bodyEl = {
        appendChild(child) { bodyKids.push(child); },
    };
    const doc = {
        visibilityState: 'visible',
        addEventListener() {},
        getElementById(id) { return byId[id] || null; },
        querySelector() { return null; },
        querySelectorAll(sel) { return sel === 'body > *' ? bodyKids : []; },
        createElement(tag) {
            const el = makeFakeElement(tag);
            // track by id once set (createElement callers set .id right after)
            Object.defineProperty(el, 'id', {
                get() { return el._id || ''; },
                set(v) { el._id = v; byId[v] = el; },
            });
            return el;
        },
        head: { appendChild() {} },
        body: bodyEl,
    };
    const reg = { update() {}, waiting: null, addEventListener() {} };
    const sw = {
        controller: {},
        addEventListener() {},
        register() { return Promise.resolve(reg); },
    };
    const nav = { serviceWorker: sw, onLine: opts.onLine !== false };
    const sandbox = {
        window: win,
        document: doc,
        navigator: nav,
        getComputedStyle(el) { return el._style; },
        console,
        setInterval: () => 0, clearInterval() {}, setTimeout, clearTimeout,
    };
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox, { filename: 'mc-sw-update.js' });
    return {
        // A real browser updates navigator.onLine BEFORE dispatching the
        // online/offline events — mirror that so updateOfflineBanner()'s own
        // read of navigator.onLine sees the new state, same as it would live.
        fireOnline: () => { nav.onLine = true; (windowListeners.online || []).forEach(cb => cb()); },
        fireOffline: () => { nav.onLine = false; (windowListeners.offline || []).forEach(cb => cb()); },
        offlineBar: () => byId.mcOfflineBar || byId.offlineBar || null,
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

    // ---- U4: fleet-wide offline banner (pages with no native #offlineBar) ----
    {
        const m = loadModuleForOffline({ onLine: false });
        await flush();
        const bar = m.offlineBar();
        assert(!!bar, '4a: a self-mounted offline banner exists on a page with no native one');
        assert(bar.classList.contains('show'), '4b: it shows immediately when the page loads already offline');

        m.fireOnline();
        assert(!bar.classList.contains('show'), '4c: it hides on the online event');

        m.fireOffline();
        assert(bar.classList.contains('show'), '4d: it re-shows on a later offline event');
    }

    // ---- U4: a page WITH dashboard.html's native #offlineBar is untouched ----
    {
        const m = loadModuleForOffline({ onLine: false, nativeOfflineBar: true });
        const bar = m.offlineBar();
        bar.className = 'offline-bar sentinel';   // dashboard's own script owns this — mark it
        await flush();
        m.fireOffline();
        m.fireOnline();
        assert(bar.className === 'offline-bar sentinel',
            '5: the native #offlineBar\'s classList is never touched by this module (dashboard drives it itself)');
    }

    if (failures) { console.error(`\ntest-mc-sw-update: ${failures} FAILED of ${checks}`); process.exit(1); }
    console.log(`test-mc-sw-update: all ${checks} assertions passed`);
})();

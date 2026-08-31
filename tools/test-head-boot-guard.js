#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-head-boot-guard.js — regression coverage for finding L7 against the
   REAL generated head-boot script (not a copy of it).

   tools/apply-head-contract.py writes THEME_BOOT's inline <script> onto
   every deployable page. Rather than re-implementing that Python string in
   JS and testing the copy, this extracts the actual <script> block from a
   real, already-generated page (mm-p1.html) and runs it in a vm sandbox —
   so a change to apply-head-contract.py that breaks the emitted JS, or a
   forgotten re-run of the generator, shows up here against the real output.

   L7: iOS can kill a backgrounded installed PWA and hand the relaunch a
   fresh sessionStorage, so the pre-existing "stale home-screen shortcut"
   redirect-to-dashboard guard used to fire even when the athlete was mid-
   workout on the very page being redirected away from. It must now check
   mc_session_v1 (mc-session.js's own store) for a live record on the exact
   current page before redirecting.

   S6: the same generated script also registers window 'error' and
   'unhandledrejection' listeners that write a capped ring buffer into
   mc_errors_v1 — previously nothing in production reported a runtime error
   anywhere. Covered here too since it's the same extracted SRC.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PAGE = path.join(__dirname, '..', 'mm-p1.html');
const html = fs.readFileSync(PAGE, 'utf8');
const m = /<script>(\/\* MC head boot[\s\S]*?)<\/script>/.exec(html);
if (!m) { console.error('FAIL: could not find the MC head boot script in ' + PAGE); process.exit(1); }
const SRC = m[1];

let checks = 0, failures = 0;
function assert(cond, msg) { checks++; if (!cond) { failures++; console.error('  ✗ ' + msg); } }

function run(opts) {
    const store = Object.assign({}, opts.localStorage || {});
    const sess = Object.assign({}, opts.sessionStorage || {});
    let redirected = null;
    const listeners = {};
    const win = {
        navigator: { standalone: !!opts.standalone },
        matchMedia: () => ({ matches: !!opts.standaloneMedia }),
        addEventListener: (type, cb) => { (listeners[type] = listeners[type] || []).push(cb); },
    };
    const sandbox = {
        window: win,
        sessionStorage: { getItem: k => (k in sess ? sess[k] : null), setItem: (k, v) => { sess[k] = v; } },
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
        location: { pathname: opts.pathname || '/mm-p1.html', replace: url => { redirected = url; } },
        document: { documentElement: { getAttribute: () => null, setAttribute: () => {} }, querySelector: () => null },
        Date, JSON, Array,
    };
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox, { filename: 'mm-p1.html head boot' });
    return {
        redirected, store,
        fireError: ev => (listeners.error || []).forEach(cb => cb(ev)),
        fireRejection: ev => (listeners.unhandledrejection || []).forEach(cb => cb(ev)),
    };
}
const NOW = Date.now();

// A. standalone, no session record at all -> redirects (the original,
// still-intended "stale home-screen shortcut" behaviour).
assert(run({ standalone: true }).redirected === 'dashboard.html',
    'A: standalone launch with no session record still redirects to the dashboard');

// B. standalone, a LIVE record for THIS exact page -> must NOT redirect.
assert(run({
    standalone: true,
    localStorage: { mc_session_v1: JSON.stringify({ 'mm-p1': { lastTs: NOW } }) },
}).redirected === null, 'B: a live session for the current page is protected — no redirect');

// C. standalone, a record for this page but past the 12h staleness window
// (same window mc-session.js itself prunes on) -> redirects.
assert(run({
    standalone: true,
    localStorage: { mc_session_v1: JSON.stringify({ 'mm-p1': { lastTs: NOW - 13 * 3600 * 1000 } }) },
}).redirected === 'dashboard.html', 'C: a stale (>12h) session record does not block the redirect');

// D. standalone, a live record but for a DIFFERENT page -> redirects (the
// guard must match the exact current page, not just any live session).
assert(run({
    standalone: true,
    pathname: '/mm-p1.html',
    localStorage: { mc_session_v1: JSON.stringify({ 'some-other-page': { lastTs: NOW } }) },
}).redirected === 'dashboard.html', 'D: a live session for a DIFFERENT page does not block the redirect');

// E. not a standalone launch -> the whole guard is inert regardless of
// session state (unchanged pre-existing behaviour).
assert(run({ standalone: false, standaloneMedia: false }).redirected === null,
    'E: a normal (non-standalone) page load never redirects');

// F. already launched this session (flag already set) -> inert regardless.
assert(run({ standalone: true, sessionStorage: { mc_launched: '1' } }).redirected === null,
    'F: a second standalone entry in the same session does not re-trigger the guard');

// G. dashboard.html itself is excluded from the redirect target (unchanged
// pre-existing behaviour, still exercised here as a regression net).
assert(run({ standalone: true, pathname: '/dashboard.html' }).redirected === null,
    'G: dashboard.html itself is never redirected to itself');

// ---- S6: error / unhandledrejection capture --------------------------
{
    const r = run({});
    r.fireError({ message: 'Boom', filename: 'mc-setlog.js', lineno: 42 });
    const all1 = JSON.parse(r.store.mc_errors_v1 || '[]');
    assert(all1.length === 1 && all1[0].m === 'Boom' && all1[0].k === 'error',
        'S6a: a window error event is recorded');

    r.fireRejection({ reason: new Error('Nope') });
    const all2 = JSON.parse(r.store.mc_errors_v1 || '[]');
    assert(all2.length === 2 && all2[0].k === 'unhandledrejection' && all2[0].m === 'Nope',
        'S6b: an unhandled rejection is recorded too, most-recent first');
}
{
    // S6c: the ring buffer is capped, not unbounded growth in localStorage.
    const r = run({});
    for (let i = 0; i < 25; i++) r.fireError({ message: 'e' + i });
    const all = JSON.parse(r.store.mc_errors_v1 || '[]');
    assert(all.length === 20, `S6c: the buffer caps at 20 entries (got ${all.length})`);
    assert(all[0].m === 'e24', 'S6c: the buffer keeps the MOST RECENT entries, oldest dropped first');
}

if (failures) { console.error(`\ntest-head-boot-guard: ${failures} FAILED of ${checks}`); process.exit(1); }
console.log(`test-head-boot-guard: all ${checks} assertions passed`);

#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-outbox.js — per-set cloud writes made with no signal are replayed
   (flagship readiness R3 / D-19), against the REAL mc-supabase.js.

   A set ticked offline used to be dropped from workout_logs: logSet()
   rejected, the caller swallowed it, and nothing tried again. That table is
   what cross-device prefill, the PR baseline and the crash rehydrate (FIX-02)
   read, so a gym with no signal left holes in all three. mc-supabase.js now
   queues a failed write in mc_workout_logs_outbox_v1 and replays it.

   Same vm-sandbox technique as tools/test-mc-sw.js: the module is loaded
   with a fake supabase-js (window.supabase.createClient) whose writes can be
   made to fail and recover, and is driven through MC_SB's own public calls.

   Run: node tools/test-mc-outbox.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.resolve(__dirname, '../mc-supabase.js'), 'utf8');
const KEY = 'mc_workout_logs_outbox_v1';

let checks = 0, failures = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.error('  ✗ ' + msg); } }
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };

function load() {
  const ls = {};
  const net = { up: false, rows: new Map(), calls: [] };
  const rowKey = (r) => r.session_id + '|' + r.exercise + '|' + r.set_number;
  const result = () => (net.up ? Promise.resolve({ data: null, error: null }) : Promise.reject(new Error('Failed to fetch')));
  function deleter() {
    const f = {};
    const q = {
      eq(k, v) { f[k] = v; return q; },
      then(res, rej) {
        net.calls.push('del');
        return result().then(() => { net.rows.delete(f.session_id + '|' + f.exercise + '|' + f.set_number); return { error: null }; }).then(res, rej);
      },
    };
    return q;
  }
  const client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }),
      getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }),
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
    },
    from() {
      return {
        upsert(row) {
          net.calls.push('up');
          return { then: (res, rej) => result().then(() => { net.rows.set(rowKey(row), row); return { error: null }; }).then(res, rej) };
        },
        delete: deleter,
        select() { return { eq() { return this; }, order() { return this; }, limit() { return this; }, maybeSingle() { return Promise.resolve({ data: null }); }, then(r) { return Promise.resolve({ data: [] }).then(r); } }; },
      };
    },
    channel() { return { on() { return this; }, subscribe() { return this; } }; },
  };
  const listeners = {};
  const win = {
    supabase: { createClient: () => client },
    addEventListener(t, cb) { (listeners[t] = listeners[t] || []).push(cb); },
    removeEventListener() {},
    location: { href: 'https://mcross2298.github.io/x/mm-p1.html', pathname: '/x/mm-p1.html', search: '', hash: '' },
  };
  const nav = { onLine: true };
  const sandbox = {
    window: win, navigator: nav, console: { log() {}, warn() {}, error() {} },
    localStorage: {
      getItem: (k) => (k in ls ? ls[k] : null),
      setItem: (k, v) => { ls[k] = String(v); },
      removeItem: (k) => { delete ls[k]; },
    },
    document: { head: { appendChild() {} }, createElement: () => ({}), addEventListener() {}, querySelector: () => null, getElementById: () => null },
    location: win.location,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    Promise, Date, JSON, Math,
  };
  sandbox.self = win;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'mc-supabase.js' });
  return {
    SB: win.MC_SB, ls, net, nav,
    fire: (t) => (listeners[t] || []).forEach(cb => cb()),
    outbox: () => { try { return JSON.parse(ls[KEY] || '[]'); } catch (e) { return null; } },
  };
}
const set = (n, w) => ({ session_id: 's1', exercise: 'Incline DB Press', set_number: n, weight_lbs: w, reps: 8 });

(async () => {
  {
    const t = load();
    ok(t.SB && typeof t.SB.logSet === 'function' && typeof t.SB.flushOutbox === 'function', '0: MC_SB publishes logSet and flushOutbox');
    if (!t.SB) { console.error('test-mc-outbox: MC_SB did not load'); process.exit(1); }

    // 1. A set logged with no signal is queued, not dropped.
    await t.SB.logSet(set(1, 60)).catch(() => {});
    await t.SB.logSet(set(2, 60)).catch(() => {});
    ok(t.outbox().length === 2, '1a: two sets logged offline are queued (got ' + t.outbox().length + ')');
    ok(t.net.rows.size === 0, '1b: nothing reached the table while offline');

    // 2. Re-ticking the same set keeps ONE operation, the latest.
    await t.SB.logSet(set(2, 65)).catch(() => {});
    const q = t.outbox();
    ok(q.length === 2, '2a: re-logging a queued set replaces it rather than adding a second (got ' + q.length + ')');
    ok(q.some(o => o.entry.set_number === 2 && o.entry.weight_lbs === 65), '2b: the queued copy is the latest value');

    // 3. Unticking a queued set while offline leaves a delete, never the upsert.
    await t.SB.unlogSet(set(1, 60)).catch(() => {});
    const q3 = t.outbox();
    ok(q3.filter(o => o.entry.set_number === 1).length === 1 && q3.find(o => o.entry.set_number === 1).op === 'del',
       '3: an offline untick replaces the queued upsert with a delete');

    // 4. The network returns: everything replays, in order, and the queue empties.
    t.net.up = true;
    t.fire('online');
    await flush();
    ok(t.outbox().length === 0, '4a: the online event drains the queue (left ' + t.outbox().length + ')');
    ok(t.net.rows.has('s1|Incline DB Press|2') && t.net.rows.get('s1|Incline DB Press|2').weight_lbs === 65,
       '4b: the replayed set carries the latest weight');
    ok(!t.net.rows.has('s1|Incline DB Press|1'), '4c: the set unticked offline is not in the table');

    // 5. A direct success clears a stale queued copy for the same set.
    t.net.up = false;
    await t.SB.logSet(set(3, 70)).catch(() => {});
    t.net.up = true;
    await t.SB.logSet(set(3, 72));
    ok(t.outbox().length === 0, '5: a later successful write supersedes the queued one');

    // 6. While the browser says it is offline, a flush sends nothing.
    t.net.up = false;
    await t.SB.logSet(set(4, 70)).catch(() => {});
    t.nav.onLine = false;
    const before = t.net.calls.length;
    await t.SB.flushOutbox();
    ok(t.net.calls.length === before, '6: no request is made while navigator.onLine is false');

    // 7. A flush that fails stops and keeps the queue intact.
    t.nav.onLine = true;
    await t.SB.logSet(set(5, 70)).catch(() => {});
    const n = t.outbox().length;
    await t.SB.flushOutbox();
    ok(t.outbox().length === n && n === 2, '7: a flush on a dead network keeps every queued write (' + t.outbox().length + ' of ' + n + ')');
  }

  // 8. A corrupt outbox reads as empty rather than throwing.
  {
    const t = load();
    t.ls[KEY] = '{"not":"an array"}';
    let threw = false;
    try { await t.SB.flushOutbox(); } catch (e) { threw = true; }
    ok(!threw, '8: a corrupt outbox does not throw');
  }

  console.log('test-mc-outbox: ' + (checks - failures) + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})();

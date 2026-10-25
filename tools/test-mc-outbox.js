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
  const net = { up: false, rows: new Map(), calls: [], pushes: [] };
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
          return { then: (res, rej) => result().then(() => {
            if (net.refuse && net.refuse.has(row.set_number)) return { error: { code: '23514', message: 'violates check constraint' }, status: 400 };
            if (net.flaky && net.flaky.has(row.set_number)) return { error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 };
            net.rows.set(rowKey(row), row); return { error: null };
          }).then(res, rej) };
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
    fetch: (url, opts) => { net.pushes.push({ url, body: opts && opts.body }); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); },
  };
  sandbox.self = win;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'mc-supabase.js' });
  return {
    SB: win.MC_SB, ls, net, nav, win,
    fire: (t) => (listeners[t] || []).forEach(cb => cb()),
    outbox: () => { try { return JSON.parse(ls[KEY] || '[]'); } catch (e) { return null; } },
  };
}
function vmRec(t, recs) {
  // mc-supabase.js reads window.MC_ERRLOG at call time.
  t.win.MC_ERRLOG = { rec: (k, m) => recs.push([k, m]) };
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

  // 9. A record set ticked offline sends its push when the replay lands —
  //    once, and not for a write queued without one.
  {
    const t = load();
    const push = { title: 'New PR — Incline DB Press', body: '70 lb, up from 65 lb.' };
    await t.SB.logSet(set(1, 70), push).catch(() => {});
    await t.SB.logSet(set(2, 60)).catch(() => {});
    ok(t.outbox().filter(o => o.push).length === 1, '9a: the queued record set carries its push');
    t.net.up = true;
    await t.SB.flushOutbox(); await flush();
    const sent = t.net.pushes.filter(p => /push-notify/.test(p.url));
    ok(sent.length === 1 && /Incline DB Press/.test(sent[0].body), '9b: the replay sends exactly that push (sent ' + sent.length + ')');
    await t.SB.flushOutbox(); await flush();
    ok(t.net.pushes.length === 1, '9c: a second flush does not send it again');
  }
  // 10. A push queued more than 12 hours ago is old news and is not sent.
  {
    const t = load();
    await t.SB.logSet(set(1, 70), { title: 'New PR', body: 'x' }).catch(() => {});
    const q = t.outbox(); q[0].ts = Date.now() - 13 * 60 * 60 * 1000;
    t.ls[KEY] = JSON.stringify(q);
    t.net.up = true;
    await t.SB.flushOutbox(); await flush();
    ok(t.net.rows.size === 1 && t.net.pushes.length === 0, '10: a stale replay writes the row and skips the push');
  }

  // 11. A write the server REFUSES (Phase T1.3) is dropped, recorded, and does
  //     not hold back the writes queued behind it. An expired session is not a
  //     refusal: that write waits.
  {
    const t = load();
    const recs = [];
    await t.SB.logSet(set(1, 60)).catch(() => {});
    await t.SB.logSet(set(2, 60)).catch(() => {});
    await t.SB.logSet(set(3, 60)).catch(() => {});
    ok(t.outbox().length === 3, '11a: three writes queued offline');
    t.net.up = true;
    t.net.refuse = new Set([1]);
    t.net.flaky = new Set([3]);
    vmRec(t, recs);
    await t.SB.flushOutbox(); await flush();
    const left = t.outbox().map(o => o.entry.set_number);
    ok(!left.includes(1), '11b: the refused write leaves the queue (left ' + JSON.stringify(left) + ')');
    ok(t.net.rows.has('s1|Incline DB Press|2'), '11c: the write behind it still reached the table');
    ok(left.length === 1 && left[0] === 3, '11d: the expired-session write stays queued');
    ok(recs.length === 1 && /refused/.test(recs[0][1]) && recs[0][0] === 'network', '11e: the refusal is recorded once in diagnostics');
    // A direct write the server refuses is not queued at all.
    t.net.refuse = new Set([4]);
    await t.SB.logSet(set(4, 60)).catch(() => {});
    ok(!t.outbox().some(o => o.entry.set_number === 4), '11f: a refused direct write is not queued for a retry');
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

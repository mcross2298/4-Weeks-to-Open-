#!/usr/bin/env node
/* tools/test-mc-report.js — "Report a problem" (field-feedback-roadmap.md FB1)

   Runs the REAL mc-report.js in a vm sandbox with a fake localStorage and a
   fake MC_SB, and holds it to what the sheet promises:
     * a report is queued BEFORE it is sent, so offline / signed-out never
       loses it, and only the rows the server accepted leave the queue;
     * the row fits phase15-client-reports.sql's checks (enums, lengths);
     * nothing from the athlete's training data rides along;
     * error_fps match mc-error-beacon.js's fingerprint() exactly, so a
       report joins to client_errors row for row. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL ' + msg); } }

function sandbox(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store || {});
  const upserts = [];
  const win = {
    addEventListener() {}, matchMedia: () => ({ matches: false }),
    MC_SB: opts.noBackend ? undefined : {
      configured: true,
      currentUser: () => Promise.resolve(opts.signedOut ? null : { id: 'u1' }),
      client: { from: (t) => ({ upsert: (rows, o) => { upserts.push({ t, rows, o }); return Promise.resolve(opts.serverError ? { error: { message: 'nope' } } : {}); } }) }
    }
  };
  const ctx = {
    window: win,
    document: { readyState: 'loading', referrer: opts.referrer || '', getElementById: () => null, head: { appendChild() {} } },
    location: { pathname: '/4-Weeks-to-Open-/' + (opts.page || 'workout-settings.html'), origin: 'https://mcross2298.github.io' },
    navigator: { userAgent: opts.ua || 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', onLine: opts.offline ? false : true },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    URL, Date, Math, JSON, Promise, String, Array, Object, setTimeout: () => 0, console,
    crypto: { randomUUID: () => 'id-' + Math.random().toString(36).slice(2, 12) }
  };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'mc-report.js'), 'utf8'), ctx, { filename: 'mc-report.js' });
  return { R: ctx.window.MC_REPORT, store, upserts, ctx };
}

function beaconFingerprint() {
  const win = { addEventListener() {} };
  const ctx = { window: win, document: { readyState: 'loading' }, localStorage: { getItem: () => null, setItem() {} },
    navigator: { userAgent: '' }, location: { pathname: '/' }, setTimeout: () => 0, Date, JSON, Promise, Math, String };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'mc-error-beacon.js'), 'utf8'), ctx);
  return (e) => ctx.window.MC_ERROR_BEACON._toRow(e).fingerprint;
}

(async function main() {
  const errs = [
    { t: 3, k: 'error', m: 'x is undefined', s: 'https://mcross2298.github.io/4-Weeks-to-Open-/mc-setlog.js?v=3', l: 42, p: 'mm-p1.html' },
    { t: 2, k: 'note', m: 'Repair this device run' },
    { t: 1, k: 'network', m: 'pull failed' },
    { t: 0, k: 'error', m: 'x is undefined', s: 'https://mcross2298.github.io/4-Weeks-to-Open-/mc-setlog.js?v=3', l: 42 }
  ];
  const seeded = {
    mc_errors_v1: JSON.stringify(errs),
    mc_active_prog: 'mm',
    mc_session_v1: JSON.stringify({ 'mm-p1': { lastTs: Date.now() - 60000, sets: [{ w: 225 }] } }),
    mc_workout_log_v1: JSON.stringify([{ id: 'w1', sets: [{ w: 999 }] }]),
    mc_macros_v1: JSON.stringify({ goals: { kcal: 1234 } })
  };

  // 1. row shape
  {
    const { R } = sandbox({ store: seeded });
    const row = R._buildRow({ category: 'friction', severity: 'blocker', message: '  The beep did not play  ' });
    ok(row.category === 'friction' && row.severity === 'blocker', 'category / severity kept');
    ok(row.message === 'The beep did not play', 'message trimmed');
    ok(row.page === 'workout-settings.html', 'page is the current file, got ' + row.page);
    ok(row.workout_page === 'mm-p1.html', 'workout page from the live session, got ' + row.workout_page);
    ok(row.program === 'mm', 'program attached');
    ok(row.platform === 'ios-web', 'platform, got ' + row.platform);
    ok(Array.isArray(row.error_fps) && row.error_fps.length === 2, 'notes skipped and duplicates folded: ' + JSON.stringify(row.error_fps));
    ok(typeof row.client_id === 'string' && row.client_id.length >= 8 && row.client_id.length <= 64, 'client_id fits 8..64');
    const bad = R._buildRow({ category: 'drop table', severity: '9', message: 'x'.repeat(5000) });
    ok(bad.category === 'bug' && bad.severity === 'annoying', 'unknown enums fall back to allowed values');
    ok(bad.message.length === 2000, 'message capped at 2000');
    const serialized = JSON.stringify(row);
    ok(!/225|999|1234/.test(serialized), 'no workout, set or macro data rides along');
  }

  // 2. fingerprints match the beacon's
  {
    const { R } = sandbox();
    const bfp = beaconFingerprint();
    errs.filter((e) => e.k !== 'note').forEach((e) => ok(R._fingerprint(e) === bfp(e), 'fingerprint matches mc-error-beacon.js for ' + e.m));
  }

  // 3. referrer and explicit `from`
  {
    const { R } = sandbox({ referrer: 'https://mcross2298.github.io/4-Weeks-to-Open-/kitchen-sink-s3.html?day=1' });
    ok(R._workoutPage() === 'kitchen-sink-s3.html', 'same-origin referrer names the workout page');
    ok(R._workoutPage('hv-block.html?week=2') === 'hv-block.html', 'explicit from wins');
    const x = sandbox({ referrer: 'https://evil.example/mm-p1.html' });
    ok(x.R._workoutPage() === '', 'a foreign referrer is ignored');
  }

  // 4. queue first, then send; only accepted rows leave the queue
  async function queueAndFlush(o) {
    const s = sandbox(o);
    const row = s.R._buildRow({ message: 'hi' });
    s.store.mc_reports_outbox_v1 = JSON.stringify([row]);
    const r = await s.R.flush();
    return { r, s };
  }
  {
    const { r, s } = await queueAndFlush({});
    ok(r === 'sent 1', 'signed in + online sends, got ' + r);
    ok(s.upserts.length === 1 && s.upserts[0].t === 'client_reports', 'writes client_reports');
    ok(s.upserts[0].o.onConflict === 'user_id,client_id' && s.upserts[0].o.ignoreDuplicates === true, 'a resend is a no-op on the server');
    ok(s.R.queued().length === 0, 'sent rows leave the queue');
  }
  for (const [o, want] of [[{ offline: true }, 'offline'], [{ signedOut: true }, 'signed-out'], [{ noBackend: true }, 'no-backend'], [{ serverError: true }, 'failed']]) {
    const { r, s } = await queueAndFlush(o);
    ok(r === want, JSON.stringify(o) + ' -> ' + want + ', got ' + r);
    ok(s.R.queued().length === 1, JSON.stringify(o) + ' keeps the report queued');
  }
  {
    const { R } = sandbox();
    ok((await R.flush()) === 'nothing', 'an empty queue sends nothing');
  }

  // 5. the SQL accepts what the client sends (enums and limits agree)
  {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/phase15-client-reports.sql'), 'utf8');
    ok(/category in \('bug', 'friction', 'idea'\)/.test(sql), 'SQL category enum matches the sheet');
    ok(/severity in \('blocker', 'annoying', 'minor'\)/.test(sql), 'SQL severity enum matches the sheet');
    ok(/between 1 and 2000/.test(sql), 'SQL message limit matches MAX_MSG');
    ok(/unique \(user_id, client_id\)/.test(sql), 'SQL de-duplicates on (user_id, client_id)');
  }

  // 5b. the first field test: mc_active_prog is a program CARD, not an id,
  // and the cache list includes the fonts cache, which names no build
  {
    const card = JSON.stringify({ id: 'pmc', desc: 'Constantly varied supersets', name: 'PMC' });
    ok(sandbox({ store: { mc_active_prog: card } }).R._program() === 'pmc', 'program is the card id, not its JSON');
    ok(sandbox({ store: { mc_active_prog: 'mm' } }).R._program() === 'mm', 'a bare id still works');
    ok(sandbox({ store: { mc_active_prog: '"ss"' } }).R._program() === 'ss', 'a JSON string id works');
    ok(sandbox({ store: { mc_active_prog: JSON.stringify({ id: 'My secret plan!' }) } }).R._program() === '',
       'a non-id-shaped value is dropped, never sent');
    ok(sandbox({ store: { mc_active_prog: '{broken' } }).R._program() === '', 'unparseable JSON is dropped');
    const { R } = sandbox();
    ok(R._isAppCache('mc-training-market-ci-354') && R._isAppCache('mc-training-v189'), 'app precaches count as the build');
    ok(!R._isAppCache('mc-training-fonts-v1') && !R._isAppCache('mc-training-carry-v1'), 'fonts and carry caches are not a build');
  }

  // 6. FB4 — status read-back and the one-time Fixed note
  {
    const { R } = sandbox();
    const rows = [
      { id: 1, status: 'fixed', resolved_at: '2026-10-27T00:00:00Z', created_at: '2026-10-25T00:00:00Z' },
      { id: 2, status: 'filed' },
      { id: 3, status: 'fixed', resolved_at: '2026-10-26T00:00:00Z', created_at: '2026-10-24T00:00:00Z' },
      { id: 4, status: 'wontfix' }, null
    ];
    const nf = R._newlyFixed(rows, [3]);
    ok(nf.length === 1 && nf[0].id === 1, 'only fixed reports not yet announced, got ' + JSON.stringify(nf.map((r) => r.id)));
    ok(R._newlyFixed(rows, []).map((r) => r.id).join() === '3,1', 'oldest fix first');
    ok(R._newlyFixed(rows, [1, 3]).length === 0, 'an announced fix is never announced again');
    ok(R._newlyFixed(null, null).length === 0, 'no rows, no note');
    ok(R._statusLabel('filed') === 'Being looked at' && R._statusLabel('fixed') === 'Fixed' &&
       R._statusLabel('wontfix') === 'Won’t fix' && R._statusLabel('weird') === 'Sent', 'status labels');
    const html = R._listHtml([{ created_at: '2026-10-25T00:00:00Z', message: '<img src=x onerror=alert(1)>', status: 'fixed' }]);
    ok(!/<img/.test(html) && /&lt;img/.test(html), 'a report message is escaped in the list');
    ok(/is-fixed/.test(html) && /Fixed/.test(html), 'fixed status shown');
  }
  {
    // mine() asks only for this account's rows via the read-own policy and
    // returns null rather than throwing when it cannot read.
    const store = {};
    const selects = [];
    const s = sandbox({ store });
    s.ctx.window.MC_SB.client.from = (t) => ({
      select: (cols) => { selects.push({ t, cols }); return { order: () => ({ limit: () => Promise.resolve({ data: [{ id: 9, status: 'fixed' }] }) }) }; }
    });
    const rows = await s.R.mine();
    ok(Array.isArray(rows) && rows[0].id === 9, 'mine() returns rows');
    ok(selects[0].t === 'client_reports' && !/user_id/.test(selects[0].cols), 'mine() reads client_reports and never asks for user_id');
    const off = sandbox({ offline: true });
    ok((await off.R.mine()) === null, 'offline: mine() is null');
    const so = sandbox({ signedOut: true });
    ok((await so.R.mine()) === null, 'signed out: mine() is null');
  }

  console.log((fail ? 'FAIL' : 'ok') + ' test-mc-report: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();

#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-auto.js — command-center-roadmap.md PR 4, run in a vm sandbox
   against the real mc-log-read.js and mc-auto.js:
     • MC_LOG.sessionSets(): the sets Finish banks (name, PR against earlier
       sessions on any page, swaps, RPE), now shared with the auto-finish.
     • scan(): a session is stale only with ticked sets, no Finish, 12 hours
       since its last write, nothing banked for that page that day, and not
       left alone.
     • finishStale(): banks it once, under an id two phones agree on.
     • undo(): unbanks it, records the deletion, restores the session, and
       never banks it again. The second Undo in 30 days pauses the action;
       resume() turns it back on and resets the count.
   Run: node tools/test-mc-auto.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function eq(name, a, b) {
  const good = JSON.stringify(a) === JSON.stringify(b);
  if (good) pass++; else { fail++; console.error('::error::' + name + '\n   got ' + JSON.stringify(a) + '  want ' + JSON.stringify(b)); }
}
const SRC = f => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');

function fakeEl() {
  return { setAttribute() {}, addEventListener() {}, remove() {}, appendChild() {}, classList: { add() {}, remove() {} }, style: {} };
}
function load(store) {
  const sb = {
    window: {},
    document: { getElementById() { return null; }, createElement: fakeEl, head: fakeEl(), body: fakeEl() },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      key: i => Object.keys(store)[i],
      get length() { return Object.keys(store).length; }
    },
    setTimeout() {}
  };
  vm.createContext(sb);
  vm.runInContext(SRC('mc-log-read.js'), sb);
  vm.runInContext(SRC('mc-auto.js'), sb);
  return sb.window;
}
const H = 3600 * 1000;
function dayOf(ms) { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

const NOW = Date.now();
const T0 = NOW - 20 * H;                       // the session's last tick
const DAY0 = dayOf(T0);
function seed(extra) {
  const setlog = {
    'mm-p1|x-bench-press': [{ d: DAY0, ts: T0, sets: {
      '1': { w: 185, r: 8, n: 'Bench Press', t: T0 - 600000 },
      '2': { w: 205, r: 5, n: 'Bench Press', t: T0, rpe: 'F' } } }],
    'mm-p1|x-row': [{ d: DAY0, ts: T0, sets: { '1': { w: 135, r: 10, sw: 'Cable Row', t: T0 - 300000 } } }],
    // an earlier session of the same lift on another page: 200 is the best to beat
    'cat-strength|x-bench-press': [{ d: '2026-01-05', ts: 1, sets: { '1': { w: 200, r: 3, n: 'Bench Press' } } }]
  };
  const daily = { [DAY0 + '|mm-p1']: { date: DAY0, pid: 'mm-p1', program: 'The Modality Matrix', doneSets: 3, ts: T0 } };
  return Object.assign({
    mc_setlog_v1: JSON.stringify(setlog),
    mc_daily_v1: JSON.stringify(daily),
    mc_workout_log_v1: '[]'
  }, extra || {});
}

{
  const w = load(seed());
  const sets = w.MC_LOG.sessionSets(JSON.parse(seed().mc_setlog_v1), 'mm-p1', DAY0);
  eq('sessionSets: every set of that page and day', sets.length, 3);
  const bench = sets.filter(s => s.name === 'Bench Press').map(s => [s.weight, s.pr]);
  eq('sessionSets: PR only over the best of EARLIER sessions on any page', bench.sort(), [[185, false], [205, true]]);
  eq('sessionSets: a swap is kept', sets.find(s => s.key === 'x-row').swappedFrom, 'Cable Row');
  eq('sessionSets: a set with no stored name reads from its key', sets.find(s => s.key === 'x-row').name.length > 0, true);
  eq('sessionSets: RPE kept', sets.find(s => s.weight === 205).rpe, 'F');
  eq('sessionSets: no other day', w.MC_LOG.sessionSets(JSON.parse(seed().mc_setlog_v1), 'mm-p1', '2026-01-05').length, 0);
}

{
  const w = load(seed());
  const c = w.MC_AUTO.scan(NOW);
  eq('scan: a 20h-old unfinished session is found', c.length, 1);
  eq('scan: its id is the page and the last tick, so two phones agree', c[0].id, 'mm-p1|' + new Date(T0).toISOString());
  eq('scan: not yet stale at 11h', w.MC_AUTO.scan(T0 + 11 * H).length, 0);
}
{
  const banked = JSON.stringify([{ id: 'mm-p1|x', pageId: 'mm-p1', date: new Date(T0 + 60000).toISOString(), sets: [] }]);
  const w = load(seed({ mc_workout_log_v1: banked }));
  eq('scan: nothing when that page has a workout banked that day', w.MC_AUTO.scan(NOW).length, 0);
}
{
  const s = seed(); const sl = JSON.parse(s.mc_setlog_v1);
  delete sl['mm-p1|x-bench-press']; delete sl['mm-p1|x-row'];
  const w = load(Object.assign(s, { mc_setlog_v1: JSON.stringify(sl) }));
  eq('scan: nothing without a ticked set', w.MC_AUTO.scan(NOW).length, 0);
}

{
  const store = seed();
  const w = load(store);
  const done = w.MC_AUTO.finishStale(NOW);
  eq('finishStale: banks one', done.length, 1);
  const log = JSON.parse(store.mc_workout_log_v1);
  eq('finishStale: the workout is in the log, marked auto', [log.length, log[0].auto, log[0].sets.length, log[0].prs], [1, true, 3, 1]);
  eq('finishStale: the session entry is cleared, as Finish does', Object.keys(JSON.parse(store.mc_daily_v1)).length, 0);
  eq('finishStale: nothing left to bank', w.MC_AUTO.scan(NOW).length, 0);
  eq('log(): one action, not undone', w.MC_AUTO.log().map(r => [r.kind, !!r.undoneAt]), [['finish', false]]);

  const res = w.MC_AUTO.undo(done[0]);
  eq('undo: first Undo does not pause', res, 'undone');
  eq('undo: the workout is gone', JSON.parse(store.mc_workout_log_v1).length, 0);
  eq('undo: the deletion is recorded so a sync cannot bring it back', !!JSON.parse(store.mc_workout_log_deleted_v1)['mm-p1|' + new Date(T0).toISOString()], true);
  eq('undo: the session is back', Object.keys(JSON.parse(store.mc_daily_v1)).length, 1);
  eq('undo: and it is never banked again', w.MC_AUTO.scan(NOW + 48 * H).length, 0);
  eq('undo: twice does nothing', w.MC_AUTO.undo(done[0]), null);
  eq('not paused after one Undo', w.MC_AUTO.paused('finish'), false);
}

{
  // Two sessions on two days, both undone: the second Undo pauses.
  const T1 = NOW - 50 * H, DAY1 = dayOf(T1);
  const s = seed();
  const sl = JSON.parse(s.mc_setlog_v1);
  sl['hv-block|x-squat'] = [{ d: DAY1, ts: T1, sets: { '1': { w: 225, r: 5, n: 'Squat', t: T1 } } }];
  const daily = JSON.parse(s.mc_daily_v1);
  daily[DAY1 + '|hv-block'] = { date: DAY1, pid: 'hv-block', program: '4-Week Block', ts: T1 };
  const store = Object.assign(s, { mc_setlog_v1: JSON.stringify(sl), mc_daily_v1: JSON.stringify(daily) });
  const w = load(store);
  const done = w.MC_AUTO.finishStale(NOW);
  eq('two stale sessions are both banked', done.length, 2);
  eq('first Undo', w.MC_AUTO.undo(done[0]), 'undone');
  eq('second Undo in 30 days pauses', w.MC_AUTO.undo(done[1]), 'paused');
  eq('paused', w.MC_AUTO.paused('finish'), true);

  // a new stale session while paused is asked about, not banked
  const T2 = NOW - 30 * H, DAY2 = dayOf(T2);
  const sl2 = JSON.parse(store.mc_setlog_v1);
  sl2['ss|x-curl'] = [{ d: DAY2, ts: T2, sets: { '1': { w: 40, r: 10, n: 'Curl', t: T2 } } }];
  store.mc_setlog_v1 = JSON.stringify(sl2);
  const d2 = JSON.parse(store.mc_daily_v1); d2[DAY2 + '|ss'] = { date: DAY2, pid: 'ss', ts: T2 }; store.mc_daily_v1 = JSON.stringify(d2);
  eq('paused: nothing banked', w.MC_AUTO.finishStale(NOW).length, 0);
  eq('paused: the session waits', w.MC_AUTO.scan(NOW).length, 1);

  w.MC_AUTO.resume('finish');
  eq('resume: no longer paused', w.MC_AUTO.paused('finish'), false);
  const again = w.MC_AUTO.finishStale(NOW);
  eq('resume: banks again', again.length, 1);
  eq('resume: the old Undos no longer count, one more does not pause', w.MC_AUTO.undo(again[0]), 'undone');
}

console.log('test-mc-auto: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

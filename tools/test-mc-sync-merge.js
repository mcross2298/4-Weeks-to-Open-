#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-sync-merge.js — regression coverage for mc-sync.js's real
   sync-conflict merge functions (roadmap B5). mc-sync.js is a browser IIFE
   guarded by `if (window.__mcSync) return;` etc., so it can't be require()'d
   directly in plain Node (no `window` global -> ReferenceError on that guard
   line, which would abort evaluation before module.exports could be read).

   Instead this sandboxes the ACTUAL source file with vm (same technique as
   test-mc-bridge.js), providing a fake window/localStorage/MC_SB so the
   guards resolve to an early return, plus a real `module` object. The file's
   own module.exports hook (added right before the guards, exploiting
   function-declaration hoisting) runs first and captures the merge
   functions — so these tests exercise the real implementation, never a
   duplicated copy that could drift.

   Run: node tools/test-mc-sync-merge.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.resolve(__dirname, '../mc-sync.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('::error::' + name); } }
function eq(name, a, b) { ok(name, JSON.stringify(a) === JSON.stringify(b)); }

function loadMerge() {
  const sandbox = {
    module: { exports: {} },
    window: { __mcSync: false, MC_SB: null },
    document: { addEventListener: function () {} },
    localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
    sessionStorage: { getItem: function () { return null; }, setItem: function () {} },
    setInterval: function () {},
    location: {}
  };
  sandbox.window.__mcSync = false; // MC_SB is null -> guard returns before doing any real work
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return sandbox.module.exports;
}

const M = loadMerge();
ok('module.exports captured all 7 merge fns', !!(M && M.mergeArrayById && M.mergeArrayByIdTs &&
  M.mergeWorkoutLog && M.mergeSetlog && M.mergeActivity && M.mergeDictByTs && M.mergeMacros));

// ---- mergeArrayById: union, first occurrence of each id wins --------------
{
  const local = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }];
  const remote = [{ id: 'b', v: 2 }, { id: 'c', v: 1 }];
  const out = M.mergeArrayById(local, remote);
  eq('arrayById: union of ids', out.map(e => e.id), ['a', 'b', 'c']);
  eq('arrayById: local copy wins on conflict (first occurrence)', out.find(e => e.id === 'b').v, 1);
}

// ---- mergeArrayByIdTs: newer entry wins, including tombstones -------------
{
  const local = [
    { id: 'a', v: 'local-edit', updatedAt: '2026-01-01T00:00:00Z' },
    { id: 'b', v: 'local-only', updatedAt: '2026-01-01T00:00:00Z' }
  ];
  const remote = [
    { id: 'a', v: 'remote-edit-newer', updatedAt: '2026-01-02T00:00:00Z' },
    { id: 'c', deleted: true, updatedAt: '2026-01-03T00:00:00Z' }
  ];
  const out = M.mergeArrayByIdTs(local, remote);
  eq('arrayByIdTs: newer remote edit wins', out.find(e => e.id === 'a').v, 'remote-edit-newer');
  ok('arrayByIdTs: local-only entry preserved', out.some(e => e.id === 'b'));
  ok('arrayByIdTs: tombstone propagates', !!out.find(e => e.id === 'c' && e.deleted));
}
{
  // older remote edit must NOT clobber a newer local edit
  const local = [{ id: 'a', v: 'local-newer', updatedAt: '2026-02-01T00:00:00Z' }];
  const remote = [{ id: 'a', v: 'remote-older', updatedAt: '2026-01-01T00:00:00Z' }];
  const out = M.mergeArrayByIdTs(local, remote);
  eq('arrayByIdTs: newer local edit beats older remote', out.find(e => e.id === 'a').v, 'local-newer');
}

// ---- mergeWorkoutLog: dedupe by id||pageId|date, sort desc, cap 200 -------
{
  const local = [
    { id: 'p1', pageId: 'a.html', date: '2026-01-01T00:00:00Z' },
    { pageId: 'b.html', date: '2026-01-02T00:00:00Z' } // no id -> keyed by pageId|date
  ];
  const remote = [
    { id: 'p1', pageId: 'a.html', date: '2026-01-01T00:00:00Z' }, // duplicate of local
    { pageId: 'b.html', date: '2026-01-02T00:00:00Z' }, // duplicate via pageId|date key
    { id: 'p2', pageId: 'c.html', date: '2026-01-03T00:00:00Z' }
  ];
  const out = M.mergeWorkoutLog(local, remote);
  eq('workoutLog: dedupes id and pageId|date collisions', out.length, 3);
  eq('workoutLog: sorted newest first', out[0].pageId, 'c.html');
}
{
  const many = [];
  for (let i = 0; i < 250; i++) many.push({ id: 's' + i, pageId: 'x', date: new Date(2026, 0, 1 + i).toISOString() });
  const out = M.mergeWorkoutLog(many, []);
  eq('workoutLog: capped at 200', out.length, 200);
}

// ---- mergeSetlog: union sessions by day label, union set numbers, cap 5 --
{
  const local = { 'p|ex1': [
    { d: 'Mon 1/5', sets: { 1: { w: 100, r: 10 } } }
  ] };
  const remote = { 'p|ex1': [
    { d: 'Mon 1/5', sets: { 2: { w: 100, r: 8 } } }, // same day, different set number -> union
    { d: 'Wed 1/7', sets: { 1: { w: 105, r: 10 } } }
  ] };
  const out = M.mergeSetlog(local, remote);
  const monSession = out['p|ex1'].find(s => s.d === 'Mon 1/5');
  eq('setlog: set numbers unioned within same day', Object.keys(monSession.sets).sort(), ['1', '2']);
  ok('setlog: remote-only day present', out['p|ex1'].some(s => s.d === 'Wed 1/7'));
}
{
  const local = {};
  const remote = { 'p|ex1': [1, 2, 3, 4, 5, 6, 7].map(n => ({ d: 'D' + n, sets: { 1: { w: 1, r: 1 } } })) };
  const out = M.mergeSetlog(local, remote);
  eq('setlog: capped at 5 sessions per exercise', out['p|ex1'].length, 5);
}

// ---- mergeActivity: union days, newest `last` wins ------------------------
{
  const local = { last: { title: 'Local Session', ts: 100 }, days: { '2026-01-01': true } };
  const remote = { last: { title: 'Remote Session', ts: 200 }, days: { '2026-01-02': true } };
  const out = M.mergeActivity(local, remote);
  eq('activity: days unioned', Object.keys(out.days).sort(), ['2026-01-01', '2026-01-02']);
  eq('activity: newer `last` (by ts) wins', out.last.title, 'Remote Session');
}
{
  const local = { last: { title: 'Local Newer', ts: 300 }, days: {} };
  const remote = { last: { title: 'Remote Older', ts: 50 }, days: {} };
  const out = M.mergeActivity(local, remote);
  eq('activity: local last kept when it is newer', out.last.title, 'Local Newer');
}

// ---- mergeDictByTs: union keys, greater ts wins on conflict ---------------
{
  const local = { 'k1': { v: 'local', ts: 10 }, 'k2': { v: 'local-only', ts: 5 } };
  const remote = { 'k1': { v: 'remote-newer', ts: 20 }, 'k3': { v: 'remote-only', ts: 1 } };
  const out = M.mergeDictByTs(local, remote);
  eq('dictByTs: conflict resolved by greater ts', out.k1.v, 'remote-newer');
  ok('dictByTs: local-only key kept', out.k2 && out.k2.v === 'local-only');
  ok('dictByTs: remote-only key added', out.k3 && out.k3.v === 'remote-only');
}

// ---- mergeMacros: scalar by top-level ts; per-day entries union by id,
//      greater entry.ts wins -----------------------------------------------
{
  const local = {
    ts: 100, profile: { local: true }, goals: { kcal: 2000 },
    days: { '2026-01-01': { entries: [{ id: 'e1', kcal: 500, ts: 1 }] } }
  };
  const remote = {
    ts: 200, profile: { remote: true }, goals: { kcal: 2400 },
    days: { '2026-01-01': { entries: [{ id: 'e1', kcal: 600, ts: 2 }, { id: 'e2', kcal: 300, ts: 1 }] } }
  };
  const out = M.mergeMacros(local, remote);
  eq('macros: scalar goals from newer top-level ts (remote)', out.goals, { kcal: 2400 });
  eq('macros: max ts kept', out.ts, 200);
  const day = out.days['2026-01-01'].entries;
  eq('macros: same-id entry resolved by greater entry.ts', day.find(e => e.id === 'e1').kcal, 600);
  ok('macros: remote-only entry unioned in', day.some(e => e.id === 'e2'));
}
{
  // local top-level ts newer -> local scalar wins even though remote has data
  const local = { ts: 500, profile: { p: 'local' }, goals: { kcal: 1 }, days: {} };
  const remote = { ts: 50, profile: { p: 'remote' }, goals: { kcal: 2 }, days: {} };
  const out = M.mergeMacros(local, remote);
  eq('macros: newer local scalar wins over older remote', out.profile, { p: 'local' });
}

if (fail) { console.error(`\ntest-mc-sync-merge: ${pass} passed, ${fail} FAILED`); process.exit(1); }
console.log(`test-mc-sync-merge: all ${pass} assertions passed`);

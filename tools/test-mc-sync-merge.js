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
// FIX-06 (roadmap Phase 5.1): mergeSetlog() dates a legacy year-less day key
// through mc-log-read.js before bucketing. In a browser that module is a
// <script> on the same page; the sandbox has no `require`, so without loading
// it here mergeSetlog's own guard would resolve to null and these tests would
// exercise the UN-normalised path while reporting a pass. Load the real file
// into the same context, exactly as a page does.
const LOGSRC = fs.readFileSync(path.resolve(__dirname, '../mc-log-read.js'), 'utf8');

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
  vm.runInContext(LOGSRC, sandbox);   // publishes window.MC_LOG, as a page does
  if (!sandbox.window.MC_LOG || !sandbox.window.MC_LOG.normalizeSessions) {
    throw new Error('mc-log-read.js did not publish normalizeSessions into the sandbox');
  }
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

// ==========================================================================
// Wave 1 strategies (audit G-01 / K-1.2, K-1.3)
// ==========================================================================
ok('module.exports captured the Wave 1 merge fns', !!(M && M.mergeExerciseByName &&
  M.mergeScalarBase && M.mergeDictBase && M.mergeStore));

// ---- exerciseByName: custom exercises have NO id ------------------------
// This is the whole reason the strategy exists: mergeArrayById pushes every
// id-less entry unconditionally, so syncing this store with it would duplicate
// the entire library on every single sync.
{
  const local = [{ name: 'Zercher Squat', muscle: 'Legs', createdAt: 'a' }];
  const remote = [{ name: 'Zercher Squat', muscle: 'Legs', createdAt: 'b' },
                  { name: 'Jefferson Curl', muscle: 'Back', createdAt: 'c' }];
  const viaId = M.mergeArrayById(local, remote);
  ok('exerciseByName: arrayById WOULD duplicate id-less entries (the bug avoided)', viaId.length === 3);
  const out = M.mergeExerciseByName(local, remote);
  eq('exerciseByName: union by name, no duplicates', out.map(e => e.name),
     ['Zercher Squat', 'Jefferson Curl']);
}
{
  // identity must match mc-exercise-catalog.js's normalize(): case, punctuation
  // and parentheticals are not identity-bearing.
  const local = [{ name: 'Incline DB Press' }];
  const remote = [{ name: 'incline db press (bench)' }, { name: 'Incline-DB-Press**' }];
  const out = M.mergeExerciseByName(local, remote);
  eq('exerciseByName: normalized identity collapses case/punct/parens', out.length, 1);
}
{
  const out = M.mergeExerciseByName([], [{ name: 'Sissy Squat' }]);
  eq('exerciseByName: empty local takes remote', out.map(e => e.name), ['Sissy Squat']);
  eq('exerciseByName: non-array inputs are safe', M.mergeExerciseByName(null, null), []);
}

// ---- scalarBase: 3-way LWW using the last-synced value as ancestor -------
{
  const base = JSON.stringify({ id: 'mm', name: 'Modality Matrix' });
  const local = { id: 'mm', name: 'Modality Matrix' };          // unchanged here
  const remote = { id: 'ks', name: 'Kitchen Sink' };            // other device switched
  eq('scalarBase: only remote changed -> remote wins',
     M.mergeScalarBase(local, remote, base), remote);
}
{
  const base = JSON.stringify({ id: 'mm' });
  const local = { id: 'ks' };      // this device switched
  const remote = { id: 'mm' };     // server still on the old one
  eq('scalarBase: only local changed -> local kept',
     M.mergeScalarBase(local, remote, base), local);
}
{
  const base = JSON.stringify({ id: 'mm' });
  const local = { id: 'ks' }, remote = { id: 'pmc' };   // both changed
  eq('scalarBase: true conflict resolves to LOCAL (device in your hand wins)',
     M.mergeScalarBase(local, remote, base), local);
}
{
  eq('scalarBase: no local value -> take remote', M.mergeScalarBase(null, { id: 'x' }, null), { id: 'x' });
  eq('scalarBase: no remote value -> keep local', M.mergeScalarBase({ id: 'y' }, null, null), { id: 'y' });
  // first sync ever: no ancestor recorded, both sides present -> local kept
  eq('scalarBase: null base is not "unchanged"', M.mergeScalarBase({ a: 1 }, { b: 2 }, null), { a: 1 });
}

// ---- dictBase: per-key 3-way, so two devices editing DIFFERENT programs
// both survive (the reason this is not whole-object LWW) ------------------
{
  const base = JSON.stringify({ mm: { weeks: { 1: 'x' } }, pmc: { weeks: {} } });
  const local = { mm: { weeks: { 1: 'LOCAL' } }, pmc: { weeks: {} } };   // edited mm
  const remote = { mm: { weeks: { 1: 'x' } }, pmc: { weeks: { 2: 'REMOTE' } } }; // edited pmc
  const out = M.mergeDictBase(local, remote, base);
  eq('dictBase: local-only edit survives', out.mm.weeks[1], 'LOCAL');
  eq('dictBase: remote-only edit survives', out.pmc.weeks[2], 'REMOTE');
}
{
  const base = JSON.stringify({ mm: { v: 0 } });
  const out = M.mergeDictBase({ mm: { v: 1 } }, { mm: { v: 2 } }, base);
  eq('dictBase: same-key conflict resolves to LOCAL', out.mm, { v: 1 });
}
{
  const out = M.mergeDictBase({ a: 1 }, { b: 2 }, null);
  eq('dictBase: new keys from both sides are unioned', out, { a: 1, b: 2 });
  eq('dictBase: null inputs are safe', M.mergeDictBase(null, null, null), {});
  eq('dictBase: unparseable base does not throw', M.mergeDictBase({ a: 1 }, { a: 2 }, 'not json'), { a: 1 });
}

// ---- dispatcher routes the new strategies and still ignores base for old --
{
  eq('mergeStore routes exerciseByName',
     M.mergeStore('exerciseByName', [{ name: 'A' }], [{ name: 'a' }]).length, 1);
  eq('mergeStore routes scalarBase',
     M.mergeStore('scalarBase', { v: 1 }, { v: 2 }, JSON.stringify({ v: 1 })), { v: 2 });
  eq('mergeStore routes dictBase',
     M.mergeStore('dictBase', { a: 1 }, { b: 2 }, null), { a: 1, b: 2 });
  // the extra `base` argument must not disturb the pre-existing strategies
  eq('mergeStore: base arg is inert for existing strategies',
     M.mergeStore('arrayById', [{ id: 'a' }], [{ id: 'b' }], 'ignored').map(e => e.id), ['a', 'b']);
}

// ==========================================================================
// K-3.2/A-16: delta sync for mc_setlog_v1 — push/pull per page-group, not
// the whole store. mergeSetlog itself is untouched (already tested above);
// these cover the NEW splitting/planning logic on top of it.
// ==========================================================================
ok('module.exports captured the K-3.2 setlog-delta fns', !!(M && M.setlogPageOf &&
  M.splitSetlogByPage && M.joinSetlogGroups && M.computeSetlogPushOps && M.computeSetlogPullResult));

// ---- setlogPageOf: page is everything before the first '|' ---------------
{
  eq('setlogPageOf: normal "page|exId" key', M.setlogPageOf('mm-p1|x-incline-db-press'), 'mm-p1');
  eq('setlogPageOf: a key with no delimiter is its own page (no throw, no split)',
     M.setlogPageOf('no-delimiter-key'), 'no-delimiter-key');
  eq('setlogPageOf: only the FIRST "|" matters (exId can itself contain one)',
     M.setlogPageOf('page|ex|extra'), 'page');
}

// ---- splitSetlogByPage / joinSetlogGroups: lossless round trip -----------
{
  const whole = {
    'mm-p1|x-a': [{ d: 'Jan 1', sets: { 1: { w: 100, r: 5 } } }],
    'mm-p1|x-b': [{ d: 'Jan 1', sets: { 1: { w: 50, r: 10 } } }],
    'bro-split|x-c': [{ d: 'Jan 2', sets: { 1: { w: 200, r: 3 } } }]
  };
  const groups = M.splitSetlogByPage(whole);
  eq('splitSetlogByPage: groups by page prefix', Object.keys(groups).sort(), ['bro-split', 'mm-p1']);
  eq('splitSetlogByPage: both mm-p1 keys land in the same group',
     Object.keys(groups['mm-p1']).sort(), ['mm-p1|x-a', 'mm-p1|x-b']);
  eq('splitSetlogByPage + joinSetlogGroups round-trips losslessly', M.joinSetlogGroups(groups), whole);
  eq('splitSetlogByPage: empty/null input is safe', M.splitSetlogByPage(null), {});
  eq('joinSetlogGroups: empty/null input is safe', M.joinSetlogGroups(null), {});
}

// ---- computeSetlogPushOps: only CHANGED page-groups get an op ------------
{
  const wholeKey = 'mc_setlog_v1';
  const local = {
    'mm-p1|x-a': [{ d: 'Jan 1', sets: { 1: { w: 100, r: 5 } } }],   // will be "changed"
    'bro-split|x-c': [{ d: 'Jan 1', sets: { 1: { w: 200, r: 3 } } }] // will be "unchanged"
  };
  const unchangedJson = JSON.stringify({ 'bro-split|x-c': local['bro-split|x-c'] });
  const snapshot = { [wholeKey + '|bro-split']: unchangedJson }; // mm-p1 group never synced before
  const plan = M.computeSetlogPushOps(wholeKey, local, snapshot);
  eq('computeSetlogPushOps: exactly the changed page gets an op', plan.ops.map(o => o.storeKey),
     [wholeKey + '|mm-p1']);
  eq('computeSetlogPushOps: the op carries only that page\'s data (not the whole store)',
     plan.ops[0].data, { 'mm-p1|x-a': local['mm-p1|x-a'] });
  ok('computeSetlogPushOps: unchanged page is carried forward in the plan, not re-sent',
     plan.carrySnapshot[wholeKey + '|bro-split'] === unchangedJson);
}
{
  // nothing changed at all -> zero ops
  const wholeKey = 'mc_setlog_v1';
  const local = { 'mm-p1|x-a': [{ d: 'Jan 1', sets: {} }] };
  const snapshot = { [wholeKey + '|mm-p1']: JSON.stringify({ 'mm-p1|x-a': local['mm-p1|x-a'] }) };
  const plan = M.computeSetlogPushOps(wholeKey, local, snapshot);
  eq('computeSetlogPushOps: identical local state -> no ops queued', plan.ops.length, 0);
}

// ---- computeSetlogPullResult: each remote row merges into its own slice --
{
  const wholeKey = 'mc_setlog_v1';
  const local = {
    'mm-p1|x-a': [{ d: 'Jan 1', sets: { 1: { w: 100, r: 5 } } }],
    'bro-split|x-c': [{ d: 'Jan 1', sets: { 1: { w: 200, r: 3 } } }]
  };
  const remoteByKey = {
    [wholeKey + '|mm-p1']: { 'mm-p1|x-a': [{ d: 'Jan 1', sets: { 2: { w: 100, r: 4 } } }] }, // same day, new set -> unions
    'unrelated_other_store': { anything: true } // must be ignored (wrong prefix)
  };
  const result = M.computeSetlogPullResult(wholeKey, local, remoteByKey, {});
  const mm1 = result.whole['mm-p1|x-a'][0];
  eq('computeSetlogPullResult: remote page-group merges via mergeSetlog (set numbers unioned)',
     Object.keys(mm1.sets).sort(), ['1', '2']);
  eq('computeSetlogPullResult: a page with no matching remote row is left untouched',
     result.whole['bro-split|x-c'], local['bro-split|x-c']);
  ok('computeSetlogPullResult: snapshot recorded only for the page that actually had a remote row',
     Object.keys(result.newSnapshot).length === 1 && (wholeKey + '|mm-p1') in result.newSnapshot);
}
{
  // legacy whole-blob row (predates this feature): merged in once, same key as before
  const wholeKey = 'mc_setlog_v1';
  const local = { 'mm-p1|x-a': [{ d: 'Jan 1', sets: { 1: { w: 100, r: 5 } } }] };
  const remoteByKey = {
    [wholeKey]: { 'legacy-page|x-old': [{ d: 'Dec 1', sets: { 1: { w: 90, r: 8 } } }] }
  };
  const result = M.computeSetlogPullResult(wholeKey, local, remoteByKey, {});
  ok('computeSetlogPullResult: legacy whole-blob row still merges in',
     !!result.whole['legacy-page|x-old']);
  ok('computeSetlogPullResult: local-only page survives alongside the legacy merge',
     !!result.whole['mm-p1|x-a']);
}

// ==========================================================================
// K-3.2/A-16: async integration coverage for the ACTUAL push()/pull() wiring
// against a mock Supabase client — not just the pure planning functions
// above. A mock client + localStorage lets MC_SYNC.push()/.pull() run for
// real, including the retry-safety fix (whole-key snapshot only commits
// once every queued page-group op succeeds) that pure-function tests alone
// can't exercise, since it's about push()'s own success/failure handling.
// ========================================================================== */
function loadSyncEngine(localData, remoteRows, opts) {
  opts = opts || {};
  const localStore = {};
  Object.keys(localData || {}).forEach(function (k) { localStore[k] = JSON.stringify(localData[k]); });
  const rows = (remoteRows || []).map(function (r) { return { store_key: r.store_key, data: r.data }; });
  const opLog = [];
  const failKeys = opts.failKeys || new Set();
  const mockClient = {
    from: function () {
      return {
        select: function () {
          return { eq: function () { return Promise.resolve({ data: rows.slice(), error: null }); } };
        },
        upsert: function (row) {
          opLog.push(row);
          if (failKeys.has(row.store_key)) return Promise.resolve({ error: { message: 'simulated failure' } });
          const idx = rows.findIndex(function (r) { return r.store_key === row.store_key; });
          const stored = { store_key: row.store_key, data: row.data };
          if (idx >= 0) rows[idx] = stored; else rows.push(stored);
          return Promise.resolve({ error: null });
        }
      };
    }
  };
  const mockSB = {
    configured: true,
    ready: Promise.resolve(mockClient),
    currentUser: function () { return Promise.resolve({ id: 'u1' }); }
  };
  const sandbox = {
    module: { exports: {} },
    window: { __mcSync: false, MC_SB: mockSB, addEventListener: function () {} },
    MC_SB: mockSB,           // mc-sync.js reads this as a BARE identifier too (browser window-aliasing)
    document: { addEventListener: function () {} },
    localStorage: {
      getItem: function (k) { return k in localStore ? localStore[k] : null; },
      setItem: function (k, v) { localStore[k] = v; },
      removeItem: function (k) { delete localStore[k]; }
    },
    sessionStorage: { getItem: function () { return null; }, setItem: function () {} },
    setInterval: function () {},
    location: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { sandbox: sandbox, localStore: localStore, rows: rows, opLog: opLog };
}
function flush() { return new Promise(function (r) { setTimeout(r, 10); }); }
function readSetlog(localStore) { try { return JSON.parse(localStore.mc_setlog_v1 || '{}'); } catch (e) { return {}; } }

async function runAsyncTests() {
  const mmA = [{ d: 'Jan 1', sets: { 1: { w: 100, r: 5 } } }];
  const broC = [{ d: 'Jan 1', sets: { 1: { w: 200, r: 3 } } }];

  // ---- successful push: only per-page rows are written, never a whole-blob row
  {
    const eng = loadSyncEngine({ mc_setlog_v1: { 'mm-p1|x-a': mmA, 'bro-split|x-c': broC } }, []);
    await flush();
    await eng.sandbox.window.MC_SYNC.push();
    const keys = eng.rows.map(function (r) { return r.store_key; }).sort();
    eq('push(): writes one row per changed page, never a whole-blob row',
       keys, ['mc_setlog_v1|bro-split', 'mc_setlog_v1|mm-p1']);
    eq('push(): each row carries only that page\'s slice',
       eng.rows.find(function (r) { return r.store_key === 'mc_setlog_v1|mm-p1'; }).data,
       { 'mm-p1|x-a': mmA });
  }

  // ---- retry safety: a failed group doesn't block the other, and a later
  //      successful push retries ONLY the group that actually failed -------
  {
    const eng = loadSyncEngine(
      { mc_setlog_v1: { 'mm-p1|x-a': mmA, 'bro-split|x-c': broC } }, [],
      { failKeys: new Set(['mc_setlog_v1|mm-p1']) }
    );
    await flush();
    await eng.sandbox.window.MC_SYNC.push();
    const keysAfterFail = eng.rows.map(function (r) { return r.store_key; });
    ok('push(): the failing group is NOT persisted server-side',
       keysAfterFail.indexOf('mc_setlog_v1|mm-p1') === -1);
    ok('push(): the OTHER group still succeeds despite the failure',
       keysAfterFail.indexOf('mc_setlog_v1|bro-split') !== -1);
    // Push again (the simulated failure is still armed): the whole point of
    // the retry-safety fix is that a failed group's snapshot is NEVER
    // committed, so it keeps being retried on every push() call rather than
    // silently getting marked done after one lost attempt.
    eng.opLog.length = 0;
    await eng.sandbox.window.MC_SYNC.push();
    ok('push(): a still-failing group keeps being retried on every push() call (never silently marked done)',
       eng.opLog.some(function (o) { return o.store_key === 'mc_setlog_v1|mm-p1'; }));
    ok('push(): the already-succeeded group is NOT re-sent on a retry cycle (real delta behavior)',
       !eng.opLog.some(function (o) { return o.store_key === 'mc_setlog_v1|bro-split'; }));
  }

  // ---- legacy whole-blob row (predates this feature) still pulls in ------
  {
    const legacy = { 'legacy-page|x-old': [{ d: 'Dec 1', sets: { 1: { w: 90, r: 8 } } }] };
    const eng = loadSyncEngine({ mc_setlog_v1: {} }, [{ store_key: 'mc_setlog_v1', data: legacy }]);
    await flush();
    await eng.sandbox.window.MC_SYNC.pull();
    const local = readSetlog(eng.localStore);
    ok('pull(): a legacy whole-blob row still merges into local mc_setlog_v1',
       !!local['legacy-page|x-old']);
  }

  // ---- round trip: two devices, different pages, both survive ------------
  {
    const eng = loadSyncEngine({ mc_setlog_v1: { 'mm-p1|x-a': mmA } },
      [{ store_key: 'mc_setlog_v1|bro-split', data: { 'bro-split|x-c': broC } }]);
    await flush();
    await eng.sandbox.window.MC_SYNC.pull();
    const local = readSetlog(eng.localStore);
    ok('pull(): remote-only page-group row merges in alongside local-only data',
       !!local['bro-split|x-c'] && !!local['mm-p1|x-a']);
  }

  // ---- status().pending: correctly reflects setlog with no whole-store
  //      snapshot at all — this is exactly what both push()/pull() bugs
  //      found during development got wrong before being fixed. (start()
  //      auto-runs an initial pull+push on load, so "before any push" isn't
  //      an observable window here — only the settled states are checked.) -
  {
    const eng = loadSyncEngine({ mc_setlog_v1: { 'mm-p1|x-a': mmA } }, []);
    await flush();
    ok('status().pending: drops to 0 once the (auto-triggered) push actually succeeds',
       eng.sandbox.window.MC_SYNC.status().pending === 0);
  }
  {
    // the exact regression: a whole-store snapshot mirror set BEFORE the
    // server confirmed anything would make this read "0 pending" while
    // nothing had actually been uploaded yet.
    const eng = loadSyncEngine({ mc_setlog_v1: { 'mm-p1|x-a': mmA } }, [],
      { failKeys: new Set(['mc_setlog_v1|mm-p1']) });
    await flush();
    await eng.sandbox.window.MC_SYNC.push();
    ok('status().pending: a failed push still reads as pending, not falsely settled',
       eng.sandbox.window.MC_SYNC.status().pending >= 1);
  }

  /* ======================================================================
     Phase 3.1 (audit P2-03) — the athlete-authored training stores.
     Replacements, order, notes, tempo, favourites and personal intensifiers
     were export-only: in a manual backup, never synced, so none of them
     followed the athlete to a second device. Replacements are the sharp
     case — a device without them shows the WRONG EXERCISE on the card, not a
     missing preference.
     ====================================================================== */
  ok('Phase 3.1 exports are reachable',
     !!(M && M.mergeStringSetBase && M.prefixStrategy && M.syncableKeys));

  // --- favourites are a SET, and both add and remove are real edits --------
  {
    // A plain union would silently undo an un-favourite: the other device
    // still holds the name, so it comes straight back. This is the assertion
    // that forbids that shortcut.
    const base = JSON.stringify(['Squat', 'Bench', 'Row']);
    const out = M.mergeStringSetBase(['Squat', 'Row'], ['Squat', 'Bench', 'Row'], base);
    ok('a favourite removed locally STAYS removed', out.indexOf('Bench') < 0,
       JSON.stringify(out));
    ok('  and the untouched ones survive', out.indexOf('Squat') >= 0 && out.indexOf('Row') >= 0,
       JSON.stringify(out));
  }
  {
    const base = JSON.stringify(['Squat']);
    const out = M.mergeStringSetBase(['Squat', 'Curl'], ['Squat', 'Dip'], base);
    ok('additions from BOTH devices survive',
       out.indexOf('Curl') >= 0 && out.indexOf('Dip') >= 0 && out.indexOf('Squat') >= 0,
       JSON.stringify(out));
    ok('  and nothing is duplicated', out.length === new Set(out).size, JSON.stringify(out));
  }
  {
    const out = M.mergeStringSetBase(['Squat', 'Bench'], ['Squat', 'Bench'], JSON.stringify(['Squat', 'Bench']));
    ok('no change on either side is a no-op', JSON.stringify(out) === JSON.stringify(['Squat', 'Bench']),
       JSON.stringify(out));
  }
  {
    const out = M.mergeStringSetBase(['A'], ['B'], null);
    ok('no base yet (first sync) keeps both', out.indexOf('A') >= 0 && out.indexOf('B') >= 0,
       JSON.stringify(out));
  }
  ok('a corrupt favourites value never throws',
     Array.isArray(M.mergeStringSetBase(null, undefined, '{oops')), '');
  ok('a non-array remote is ignored rather than adopted',
     JSON.stringify(M.mergeStringSetBase(['A'], { not: 'an array' }, null)) === JSON.stringify(['A']), '');
  ok('mergeStore routes stringSetBase',
     JSON.stringify(M.mergeStore('stringSetBase', ['A'], ['B'], null)) !== JSON.stringify(['A']), '');

  // --- the dynamic page-scoped swap family --------------------------------
  ok('a page-scoped swap key is recognised by prefix',
     M.prefixStrategy('mc_replacements|cat-strength.html') === 'dictBase',
     String(M.prefixStrategy('mc_replacements|cat-strength.html')));
  ok('the GLOBAL swap key is not mistaken for the prefix family',
     M.prefixStrategy('mc_replacements_global') === null,
     String(M.prefixStrategy('mc_replacements_global')));
  ok('an unrelated key matches no prefix', M.prefixStrategy('mc_theme_mode') === null);
  ok('a null key does not throw', M.prefixStrategy(null) === null);

  // syncableKeys() must union in keys the SERVER knows about but this device
  // has never held — without that, a fresh device never receives its swaps,
  // which is the whole case this change exists for.
  {
    const all = M.syncableKeys(['mc_replacements|mm-p1.html', 'mc_theme_mode']);
    ok('a server-only page-scoped key is picked up for pull',
       all['mc_replacements|mm-p1.html'] === 'dictBase', JSON.stringify(all['mc_replacements|mm-p1.html']));
    ok('  but a non-syncing server key is NOT adopted',
       !('mc_theme_mode' in all), '');
    // The FIXED half of the table is not asserted here on purpose: `var
    // STORES` may not have initialised when this file is require()d (the
    // export hook is deliberately placed before the guards). It is checked
    // far more strictly by tools/check-store-coverage.js, which compares
    // every entry against store-registry.json, strategy names included.
  }

  // --- the six stores merge per key, so two devices do not clobber ---------
  {
    // reorder day 1 on the phone, add a note on day 3 from the tablet
    const base = JSON.stringify({ 'day1.html': { a: 1 } });
    const out = M.mergeDictBase(
      { 'day1.html': { a: 2 } },                       // local reordered day 1
      { 'day1.html': { a: 1 }, 'day3.html': { b: 9 } },// remote added day 3
      base);
    ok('a per-page edit on each device survives the other',
       out['day1.html'].a === 2 && out['day3.html'].b === 9, JSON.stringify(out));
  }
  {
    // the sharp case: a swap made on one device reaches the other
    const out = M.mergeStore('dictBase', { 'bench press': 'DB Press' }, {}, JSON.stringify({}));
    ok('a local-only swap is not dropped by an empty remote',
       out['bench press'] === 'DB Press', JSON.stringify(out));
    const out2 = M.mergeStore('dictBase', {}, { 'squat': 'Hack Squat' }, JSON.stringify({}));
    ok('a remote-only swap arrives', out2['squat'] === 'Hack Squat', JSON.stringify(out2));
  }

  /* ======================================================================
     Phase 3.2 (audit EN-9, EN-10) — conflicts that could not be resolved.
     ====================================================================== */

  // --- EN-9: first-writer-wins on an EDITED record ------------------------
  // mc_collections_v1 is the one arrayById store edited IN PLACE: same id,
  // new contents. Whichever copy happened to be local won, forever, so a
  // rename made on one device silently lost.
  {
    const older = { id: 'c1', name: 'Push Day', updatedAt: '2026-01-01T00:00:00.000Z' };
    const newer = { id: 'c1', name: 'Push Day (renamed)', updatedAt: '2026-06-01T00:00:00.000Z' };
    const a = M.mergeArrayByIdTs([older], [newer]);
    ok('EN-9 a remote EDIT beats a stale local copy', a[0].name === 'Push Day (renamed)', JSON.stringify(a));
    const b = M.mergeArrayByIdTs([newer], [older]);
    ok('EN-9 and a local edit beats a stale remote copy', b[0].name === 'Push Day (renamed)', JSON.stringify(b));
    ok('EN-9 the record is not duplicated', a.length === 1 && b.length === 1, '');
  }
  // The field names actually used by these stores must be readable, or the
  // switch to timestamp resolution scores everything 0 and quietly keeps the
  // old behaviour.
  {
    const a = M.mergeArrayByIdTs(
      [{ id: 'x', v: 'old', createdAt: '2026-01-01T00:00:00.000Z' }],
      [{ id: 'x', v: 'new', createdAt: '2026-05-01T00:00:00.000Z' }]);
    ok('EN-9 createdAt is read as a timestamp', a[0].v === 'new', JSON.stringify(a));
    const b = M.mergeArrayByIdTs(
      [{ id: 'y', v: 'old', date: '2026-01-01T00:00:00.000Z' }],
      [{ id: 'y', v: 'new', date: '2026-05-01T00:00:00.000Z' }]);
    ok('EN-9 an ISO date is read as a timestamp', b[0].v === 'new', JSON.stringify(b));
  }
  ok('EN-9 mergeStore routes the arrayById stores to timestamp resolution',
     M.mergeStore('arrayByIdTs',
       [{ id: 'z', v: 'old', date: '2026-01-01T00:00:00.000Z' }],
       [{ id: 'z', v: 'new', date: '2026-05-01T00:00:00.000Z' }], null)[0].v === 'new', '');

  // --- EN-10: the five-session cap fell on ENCOUNTER order ----------------
  // A device holding five OLD sessions, merging one NEW session from the
  // other device, kept the five old ones and dropped the new one.
  // FIX-06 dated `d` itself, so these fixtures carry REAL epoch stamps that
  // agree with their labels. The originals used ts: 1000..9000 — five seconds
  // past the epoch — which was harmless while `ts` was only ever compared
  // against another `ts`, and became wrong the moment a legacy label could be
  // DATED from it: all five collapsed onto 1 Jan 1970 and unioned into one
  // session. The fixture was always nonsense; nothing read it closely enough
  // to matter until now.
  const ms = (y, m, d) => new Date(y, m - 1, d, 12).getTime();
  {
    const day = (label, ts, sn) => ({ d: label, ts, sets: { [sn]: { w: '100', r: '5' } } });
    const local = { 'p|x': [day('Jan 5', ms(2026, 1, 5), 1), day('Jan 4', ms(2026, 1, 4), 1),
                            day('Jan 3', ms(2026, 1, 3), 1), day('Jan 2', ms(2026, 1, 2), 1),
                            day('Jan 1', ms(2026, 1, 1), 1)] };
    const remote = { 'p|x': [day('Jun 1', ms(2026, 6, 1), 1)] };
    const out = M.mergeSetlog(local, remote)['p|x'];
    ok('EN-10 the NEWEST session survives the cap', out.some(s => s.d === '2026-06-01'),
       JSON.stringify(out.map(s => s.d)));
    ok('EN-10 and the OLDEST is the one dropped', !out.some(s => s.d === '2026-01-01'),
       JSON.stringify(out.map(s => s.d)));
    ok('EN-10 the cap still holds at 5', out.length === 5, String(out.length));
    ok('EN-10 the result is newest-first', out[0].d === '2026-06-01',
       JSON.stringify(out.map(s => s.d)));
  }
  {
    // EN-10 could only reorder a list in which EVERY entry carried a stamp, so
    // a mixed list kept encounter order and the cap kept dropping the wrong
    // session. FIX-06 removes that condition: an entry with no `ts` is dated
    // from its own label instead. The stamped entry here is deliberately years
    // old, because a label with no stamp resolves to the most recent PAST
    // occurrence — always within the last year — so the expected order holds
    // whatever date this suite runs on.
    const local = { 'p|x': [{ d: 'Jun 1', ts: ms(2020, 6, 1), sets: {} },
                            { d: 'Jan 5', sets: { 1: { w: '1' } } }] };
    const out = M.mergeSetlog(local, {})['p|x'];
    ok('FIX-06 every merged session comes back dated',
       out.every(s => /^\d{4}-\d{2}-\d{2}$/.test(s.d)), JSON.stringify(out.map(s => s.d)));
    ok('FIX-06 an unstamped entry is ordered by its own dated label, not encounter order',
       out[0].d !== '2020-06-01', JSON.stringify(out.map(s => s.d)));
  }
  {
    // A label this build cannot read is left exactly as it was rather than
    // replaced with a guess, and the list it is in keeps encounter order.
    const local = { 'p|x': [{ d: 'Mon 1/5', sets: { 1: { w: '1' } } },
                            { d: 'Wed 1/7', sets: {} }] };
    const out = M.mergeSetlog(local, {})['p|x'];
    ok('FIX-06 an unreadable label is never replaced with a guess',
       out[0].d === 'Mon 1/5' && out[1].d === 'Wed 1/7', JSON.stringify(out.map(s => s.d)));
  }
  {
    // The cross-version case this whole normalisation exists for: one device
    // still on the old build sends a year-less label for a day this one
    // already holds as a dated key. Without dating both sides first that is
    // two sessions for one training day, each carrying half the sets.
    const today = new Date();
    const iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') +
                '-' + String(today.getDate()).padStart(2, '0');
    const label = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const local = { 'p|x': [{ d: iso, ts: today.getTime(), sets: { 1: { w: '100' } } }] };
    const remote = { 'p|x': [{ d: label, sets: { 2: { w: '110' } } }] };
    const out = M.mergeSetlog(local, remote)['p|x'];
    ok('FIX-06 an old-build device and a new one converge on ONE session',
       out.length === 1, JSON.stringify(out.map(s => s.d)));
    ok('FIX-06 ...and that session holds both devices\' sets',
       out[0] && out[0].sets[1] && out[0].sets[2], JSON.stringify(out[0]));
  }
  {
    // sets from both sides still union, and no `ts` is invented on a legacy entry
    const local = { 'p|x': [{ d: 'Jan 5', sets: { 1: { w: '100' } } }] };
    const remote = { 'p|x': [{ d: 'Jan 5', sets: { 2: { w: '110' } } }] };
    const out = M.mergeSetlog(local, remote)['p|x'];
    ok('EN-10 sets from both devices still union', out[0].sets[1] && out[0].sets[2],
       JSON.stringify(out[0].sets));
    ok('EN-10 no ts is invented on a legacy entry', !('ts' in out[0]), JSON.stringify(out[0]));
  }

  if (fail) { console.error(`\ntest-mc-sync-merge: ${pass} passed, ${fail} FAILED`); process.exit(1); }
  console.log(`test-mc-sync-merge: all ${pass} assertions passed`);
}
runAsyncTests();

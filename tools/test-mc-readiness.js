#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-readiness.js — regression coverage for mc-readiness.js's
   per-muscle recovery math, run against the actual source file instead of a
   duplicated inline copy (same convention as test-mc-suggest.js /
   test-mc-strain.js).

   Run: node tools/test-mc-readiness.js
   ========================================================================== */
const path = require('path');

let fail = false;
function check(desc, actual, expected) {
  if (actual !== expected) {
    console.error(`::error::${desc} — expected ${expected}, got ${actual}`);
    fail = true;
  }
}

function iso(hoursAgo) { return new Date(Date.now() - hoursAgo * 3600000).toISOString(); }
function setOf(name, rpe) { return { name: name, weight: 135, reps: 8, rpe: rpe == null ? 8 : rpe }; }

var kv = {};
global.localStorage = {
  getItem: function (k) { return kv[k] || null; },
  setItem: function (k, v) { kv[k] = v; }
};
// A minimal MC_MUSCLES stand-in — the real classifier's own regex taxonomy
// is exercised by whatever consumes mc-muscle-map.js directly; this test is
// scoped to mc-readiness.js's recovery-curve math, not name classification.
global.window = {
  MC_MUSCLES: {
    groups: [{ id: 'chest' }, { id: 'back' }, { id: 'legs' }, { id: 'other' }],
    classify: function (name) {
      var n = (name || '').toLowerCase();
      if (/bench|chest/.test(n)) return { id: 'chest' };
      if (/row|back/.test(n)) return { id: 'back' };
      if (/squat|leg/.test(n)) return { id: 'legs' };
      return { id: 'other' };
    }
  }
};

const ready = require(path.resolve(__dirname, '../mc-readiness.js'));

function setLog(entries) { kv['mc_workout_log_v1'] = JSON.stringify(entries); }

// ---- never-trained muscle reads fully fresh, not unknown/zero -------------
setLog([]);
check('score(): a muscle with no history reads 100% (nothing to recover from)', ready.score('chest'), 100);
check('byMuscle(): includes every group from MC_MUSCLES, even untrained ones', Object.keys(ready.byMuscle()).length, 4);
check('score(): an id outside MC_MUSCLES.groups returns null', ready.score('not-a-real-muscle'), null);

// ---- recovery climbs toward 100% as hours-since-trained grows -------------
setLog([{ date: iso(2), sets: [setOf('Bench Press')] }]);
var justTrained = ready.score('chest');
setLog([{ date: iso(80), sets: [setOf('Bench Press')] }]);
var recovered = ready.score('chest');
if (!(recovered > justTrained)) {
  console.error(`::error::score(): recovery should climb with elapsed time — 2h=${justTrained}, 80h=${recovered}`);
  fail = true;
}
if (!(justTrained < 40)) {
  console.error(`::error::score(): a muscle trained 2h ago should read overreached (<40), got ${justTrained}`);
  fail = true;
}
if (!(recovered >= 70)) {
  console.error(`::error::score(): a muscle trained 80h (~3.3 days) ago on 1 light set should read fresh (>=70), got ${recovered}`);
  fail = true;
}

// ---- more volume (sets) in the triggering session slows recovery ----------
setLog([{ date: iso(30), sets: [setOf('Bench Press')] }]);
var lightSession = ready.score('chest');
setLog([{ date: iso(30), sets: [setOf('Bench Press'), setOf('Bench Press'), setOf('Bench Press'), setOf('Bench Press'), setOf('Bench Press'), setOf('Bench Press')] }]);
var heavySession = ready.score('chest');
if (!(heavySession < lightSession)) {
  console.error(`::error::score(): a 6-set session should clear slower than a 1-set session at the same elapsed time — 1 set=${lightSession}, 6 sets=${heavySession}`);
  fail = true;
}

// ---- near-failure sets slow recovery further than the same set count at moderate RPE ----
setLog([{ date: iso(30), sets: [setOf('Bench Press', 8), setOf('Bench Press', 8), setOf('Bench Press', 8)] }]);
var moderateEffort = ready.score('chest');
setLog([{ date: iso(30), sets: [setOf('Bench Press', 'F'), setOf('Bench Press', 'F'), setOf('Bench Press', 8)] }]);
var nearFailureEffort = ready.score('chest');
if (!(nearFailureEffort < moderateEffort)) {
  console.error(`::error::score(): near-failure sets should slow recovery vs. the same set count at moderate RPE — moderate=${moderateEffort}, near-failure=${nearFailureEffort}`);
  fail = true;
}

// ---- status buckets --------------------------------------------------------
setLog([{ date: iso(1), sets: [setOf('Bench Press'), setOf('Bench Press'), setOf('Bench Press'), setOf('Bench Press'), setOf('Bench Press'), setOf('Bench Press')] }]);
check('byMuscle(): a just-hit, high-volume muscle is overreached', ready.byMuscle().chest.status, 'overreached');
setLog([]);
check('byMuscle(): an untrained muscle is fresh', ready.byMuscle().back.status, 'fresh');

// ---- stale(): distinct from "recovered" ------------------------------------
setLog([]);
check('stale(): never-trained -> stale', ready.stale('chest'), true);
setLog([{ date: iso(2), sets: [setOf('Bench Press')] }]);
check('stale(): trained 2h ago -> not stale even though days=7 default', ready.stale('chest'), false);
setLog([{ date: iso(24 * 10), sets: [setOf('Bench Press')] }]);
check('stale(): trained 10 days ago, default 7-day window -> stale', ready.stale('chest'), true);
check('stale(): trained 10 days ago, explicit 14-day window -> not stale', ready.stale('chest', 14), false);

// ---- overall(): aggregate mean across real muscle groups only -------------
setLog([]);
check('overall(): fully untrained fleet -> 100% fresh', ready.overall().pct, 100);
check('overall(): fully untrained fleet -> fresh status', ready.overall().status, 'fresh');

setLog([{ date: iso(1), sets: [setOf('Bench Press'), setOf('Bench Press'), setOf('Bench Press'), setOf('Bench Press'), setOf('Bench Press'), setOf('Bench Press')] }]);
var chestOnly = ready.score('chest');
var agg = ready.overall();
var expectedAgg = Math.round((chestOnly + 100 + 100) / 3);
check('overall(): averages byMuscle() pct across the real groups (chest/back/legs in this fixture)', agg.pct, expectedAgg);
if (!(agg.pct < 100)) { console.error('::error::overall(): one just-hit, overreached muscle should pull the aggregate below 100'); fail = true; }

// a set classified to 'other' must never factor into the mean
setLog([{ date: iso(1), sets: [setOf('Random Machine Thing')] }]); // matches none of the mock's patterns -> 'other'
check("overall(): a set classified to 'other' does not drag the aggregate down", ready.overall().pct, 100);

delete global.localStorage;
delete global.window;

if (fail) {
  console.error('\nFix: mc-readiness.js\'s byMuscle()/score()/stale() no longer match expected recovery behavior.');
  process.exit(1);
}
console.log('mc-readiness.js recovery-math regression tests passed');

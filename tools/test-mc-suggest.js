#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-suggest.js — regression coverage for mc-suggest.js's real
   progression-increment math (Cable/Machine/Dumbbell/Barbell/Smith), run
   against the actual source file instead of a duplicated inline copy.

   Run: node tools/test-mc-suggest.js
   ========================================================================== */
const path = require('path');
const suggest = require(path.resolve(__dirname, '../mc-suggest.js'));

let fail = false;
function check(desc, actual, expected) {
  if (actual !== expected) {
    console.error(`::error::${desc} — expected ${expected}, got ${actual}`);
    fail = true;
  }
}

check('Cable step is 2.5 lb', suggest.computeIncrement('Lat Pulldown', 'Cable'), 2.5);
check('Machine step is 2.5 lb', suggest.computeIncrement('Leg Press', 'Machine'), 2.5);
check('Dumbbell step is 5 lb', suggest.computeIncrement('DB Row', 'Dumbbell'), 5);
check('Barbell step is 5 lb for non-BIG lifts', suggest.computeIncrement('Barbell Curl', 'Barbell'), 5);
check('BIG barbell pattern steps 10 lb', suggest.computeIncrement('Barbell Squat', 'Barbell'), 10);
check('Cable face pull steps 2.5 lb', suggest.computeIncrement('Face Pull', 'Cable'), 2.5);

// Smith is a distinct catalog equipment value but isn't leverage-assisted like
// Cable/Machine — it must keep the full Barbell-style step, not the 2.5 lb discount.
check('Smith behaves like Barbell on a non-BIG lift — full 5 lb step', suggest.computeIncrement('Smith Row', 'Smith'), 5);
check('Smith on a BIG pattern still steps 10 lb, no discount', suggest.computeIncrement('Smith Squat', 'Smith'), 10);

// equipCat's catalog lookup path, including resolving Smith from real catalog data
global.window = {
  EXERCISES: [
    { name: 'Smith Machine Squat', equipment: 'Smith' },
    { name: 'Cable Row', equipment: 'Cable' }
  ]
};
check('equipCat resolves Smith from the catalog', suggest.equipCat('Smith Machine Squat'), 'Smith');
check('equipCat resolves Cable from the catalog', suggest.equipCat('Cable Row'), 'Cable');
check('equipCat falls back to keyword match for Dumbbell', suggest.equipCat('DB Bench Press'), 'Dumbbell');
delete global.window;

// ---- classifySession / detectPlateau (Phase 2: plateau/deload detection) ----
global.location = { pathname: '/test-page.html' };
global.window = { MCSetlogUtil: undefined };
// mc-suggest.js's store() always reads the single 'mc_setlog_v1' key, which
// holds an object keyed by "<page>|<exerciseId>" — mirror that shape here.
var setlogData = {};
global.localStorage = {
  getItem: function () { return JSON.stringify(setlogData); },
  setItem: function () {}
};

function session(d, sets) { return { d: d, sets: sets }; }
function loggedSet(w, r, rpe) { return { w: w, r: r, rpe: rpe }; }

check('classifySession: hold when 2+ sets are RPE>=9.5/F',
  suggest.classifySession(session('Jan 1', { 0: loggedSet(135, 8, 'F'), 1: loggedSet(135, 8, 'F'), 2: loggedSet(135, 8, 8) }), '3x8').status,
  'hold');
check('classifySession: repeat when reps fall short of target',
  suggest.classifySession(session('Jan 1', { 0: loggedSet(135, 6, 8), 1: loggedSet(135, 6, 8) }), '2x8').status,
  'repeat');
check('classifySession: progress when every logged set hits the target',
  suggest.classifySession(session('Jan 1', { 0: loggedSet(135, 8, 8), 1: loggedSet(135, 8, 8) }), '2x8').status,
  'progress');
check('classifySession: null for bodyweight/unweighted sets',
  suggest.classifySession(session('Jan 1', { 0: loggedSet(0, 12, 8) }), '1x12'),
  null);

// 4 non-progressing sessions in a row (newest first) → deload, not just a hold
setlogData['test-page|bench'] = [
  session('Jan 4', { 0: loggedSet(135, 6, 8), 1: loggedSet(135, 6, 8) }),
  session('Jan 3', { 0: loggedSet(135, 8, 'F'), 1: loggedSet(135, 8, 'F') }),
  session('Jan 2', { 0: loggedSet(135, 6, 8), 1: loggedSet(135, 6, 8) }),
  session('Jan 1', { 0: loggedSet(135, 6, 8), 1: loggedSet(135, 6, 8) })
];
var deload = suggest.detectPlateau('bench', '2x8');
check('detectPlateau: 4 non-progressing sessions in a row -> deload', deload && deload.level, 'deload');
check('detectPlateau: streak counted correctly', deload && deload.streak, 4);

// exactly 3 in a row → plateau (not yet escalated to deload)
setlogData['test-page|squat'] = [
  session('Jan 3', { 0: loggedSet(225, 6, 8) }),
  session('Jan 2', { 0: loggedSet(225, 6, 8) }),
  session('Jan 1', { 0: loggedSet(225, 6, 8) })
];
var plateau = suggest.detectPlateau('squat', '1x8');
check('detectPlateau: exactly 3 non-progressing sessions -> plateau, not deload', plateau && plateau.level, 'plateau');

// below the 3-session threshold → no flag at all
setlogData['test-page|row'] = [
  session('Jan 2', { 0: loggedSet(95, 6, 8) }),
  session('Jan 1', { 0: loggedSet(95, 6, 8) })
];
check('detectPlateau: below the 3-session threshold -> no flag', suggest.detectPlateau('row', '1x8'), null);

// a progress session anywhere in the streak (even the 2nd-most-recent) breaks it —
// only a continuous run counting back from the most recent session counts
setlogData['test-page|curl'] = [
  session('Jan 4', { 0: loggedSet(45, 6, 8) }),
  session('Jan 3', { 0: loggedSet(45, 12, 8) }),
  session('Jan 2', { 0: loggedSet(45, 6, 8) }),
  session('Jan 1', { 0: loggedSet(45, 6, 8) })
];
check('detectPlateau: a progress session breaks the streak', suggest.detectPlateau('curl', '1x12'), null);

// ---- carry-forward planned loads (Phase 0 item 0.2) ----
setlogData['test-page|press'] = [
  session('Jan 2', { 0: loggedSet(135, 8, 8), 1: loggedSet(135, 8, 8) })
];
var prog = suggest.suggestFor('press', 'Overhead Press', '2x8');
check('suggestFor: progress carries its status', prog && prog.status, 'progress');
check('suggestFor: progress adds the BIG increment', prog && prog.w, 145);
check('suggestFor: base preserves last top weight for pyramid-safe prefill', prog && prog.base, 135);

var kv = {};
global.localStorage = {
  getItem: function (k) { return k === 'mc_setlog_v1' ? JSON.stringify(setlogData) : (kv[k] || null); },
  setItem: function (k, v) { kv[k] = v; }
};
suggest.writeTarget('press', prog);
var targets = JSON.parse(kv['mc_plan_targets_v1'] || '{}');
check('writeTarget persists the planned load to mc_plan_targets_v1',
  targets['test-page|press'] && targets['test-page|press'].w, 145);
check('writeTarget records the status alongside the load',
  targets['test-page|press'] && targets['test-page|press'].status, 'progress');

// ---- deloadWeight (Phase 2.1: auto-deload) ----
check('deloadWeight: -10% off 200 lb barbell rounds to nearest 5 lb', suggest.deloadWeight(200, 'Barbell Squat'), 180);
check('deloadWeight: -10% off 135 lb barbell rounds to nearest 5 lb', suggest.deloadWeight(135, 'Barbell Row'), 120);
check('deloadWeight: Cable/Machine rounds to nearest 2.5 lb', suggest.deloadWeight(100, 'Leg Press'), 90);
check('deloadWeight: Cable/Machine rounds a non-round result to nearest 2.5 lb', suggest.deloadWeight(95, 'Cable Row'), 85);

delete global.window;
delete global.location;
delete global.localStorage;

if (fail) {
  console.error('\nFix: mc-suggest.js\'s computeIncrement/equipCat/classifySession/detectPlateau no longer match expected progression behavior.');
  process.exit(1);
}
console.log('mc-suggest.js progression-math regression tests passed');

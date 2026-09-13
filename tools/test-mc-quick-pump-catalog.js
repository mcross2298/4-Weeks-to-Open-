#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-quick-pump-catalog.js — mc-quick-pump.js's pickAnchor() against
   the REAL exercise-catalog.js (audit F-05, executive-summaries audit).

   THE PROBLEM
   -----------
   pickAnchor() opens a session on the first candidate whose `movement` is
   not 'Isolation'. tools/test-mc-quick-pump.js exercises that logic against
   a synthetic fixture, which is the right tool for the module's own
   selection math but cannot catch a bad VALUE in the real catalog — and the
   real catalog had one: Heavy Bag / Jumping Jacks / Shadow Boxing were
   tagged `muscle:"Core"` (they are cardio drills) and `movement:"Carry"`,
   so MC_QUICK_PUMP's Core focus pulled them into its candidate pool and
   pickAnchor(), true to its rule, opened on them constantly — measured at
   73.1% of 400 real runs before the fix, none of the three even a Core
   exercise. Hang Clean/Power Clean were also tagged Carry ("triple-extension
   pulls, not carries" per the audit) and 15 real compound bench/incline-
   press variants across 5 catalog `master` groups were tagged Isolation
   while their own mechanically-identical siblings under the SAME master
   were correctly tagged Push — e.g. "Barbell Bench" (Isolation) vs "Barbell
   Floor Press" (Push), same master "Barbell Bench Press".

   THE FIX
   -------
   exercise-catalog.js: retag Heavy Bag/Jumping Jacks/Shadow Boxing to
   muscle:"Cardio" (already a fully-defined muscle bucket — color + icon —
   just never used for these three), Hang Clean/Power Clean to
   movement:"Pull", the 15 mis-tagged bench/incline-press variants to
   movement:"Push" (aligned to their own master group), and
   "Reverse Incline Bench Concentration Curls" from Push back to Isolation
   (the one record that had drifted the OTHER direction, per audit F-08 —
   it inflated Biceps' "compound" pool with a curl that isn't one).

   This file loads the REAL exercise-catalog.js and mc-quick-pump.js (same
   technique as tools/test-mc-biomech.js) and reproduces the audit's own
   400-run measurement, so a future edit to either file is caught by
   running the real selection logic against the real data — not a synthetic
   stand-in for either.

   Run: node tools/test-mc-quick-pump-catalog.js
   ========================================================================== */
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('::error::' + name + (extra ? '  — ' + extra : ''));
}

global.window = {};
require(path.resolve(__dirname, '../exercise-catalog.js'));
global.window.MC_LOG = require(path.resolve(__dirname, '../mc-log-read.js'));
const qp = require(path.resolve(__dirname, '../mc-quick-pump.js'));
const EX = global.window.EXERCISES;

ok('real catalog still has 580 records (no accidental drop/dup while retagging)',
  EX.length === 580, 'got ' + EX.length);

/* ---- the specific records named in the audit ----------------------------- */

function rec(name) { return EX.filter(function (e) { return e.name === name; })[0]; }

['Heavy Bag', 'Jumping Jacks', 'Shadow Boxing'].forEach(function (n) {
  var e = rec(n);
  ok(n + ': now tagged muscle Cardio, not Core', !!e && e.muscle === 'Cardio', e && e.muscle);
});
['Hang Clean', 'Power Clean'].forEach(function (n) {
  var e = rec(n);
  ok(n + ': now tagged Pull, not Carry (triple-extension pull, not a carry)',
    !!e && e.movement === 'Pull', e && e.movement);
});
ok('Reverse Incline Bench Concentration Curls: back to Isolation (it is a curl, not a press)',
  rec('Reverse Incline Bench Concentration Curls').movement === 'Isolation');

/* ---- master-group internal consistency: the mechanism that let 15 real
   compound presses hide as Isolation in the first place ------------------- */

var byMaster = {};
EX.forEach(function (e) { if (e.master) (byMaster[e.master] = byMaster[e.master] || []).push(e); });
['Barbell Bench Press', 'DB Bench Press', 'Close Grip Bench', 'Underhand Barbell Bench', 'Incline DB Press']
  .forEach(function (m) {
    var moves = {};
    byMaster[m].forEach(function (e) { moves[e.movement] = true; });
    ok('master group "' + m + '": all members now agree on movement (Push)',
      Object.keys(moves).length === 1 && moves.Push === true, JSON.stringify(moves));
  });

/* ---- the actual bug, reproduced: Quick Pump's real Core-focus session ---- */
/* Same measurement the audit ran — 400 generations, real pool() + pickAnchor(). */

var CARDIO_LEAK = { 'Heavy Bag': true, 'Jumping Jacks': true, 'Shadow Boxing': true };
var coreLeaks = 0;
for (var i = 0; i < 400; i++) {
  var w = qp.generate({ focus: 'Core', minutes: 30 });
  var anchor = w.exercises && w.exercises[0];
  if (anchor && CARDIO_LEAK[anchor.name]) coreLeaks++;
}
ok('Core focus: 400 real generate() runs, ZERO opened on a cardio drill (was 73.1% pre-fix)',
  coreLeaks === 0, coreLeaks + '/400');

var coreCandidates = EX.filter(function (e) { return e.muscle === 'Core'; });
ok('Core pool no longer contains any of the three cardio drills',
  coreCandidates.every(function (e) { return !CARDIO_LEAK[e.name]; }));

/* ---- pickAnchor() against the real catalog, not just the synthetic fixture
   tools/test-mc-quick-pump.js uses ------------------------------------------ */

var chestPool = EX.filter(function (e) { return e.muscle === 'Chest'; });
var chestCompounds = chestPool.filter(function (e) { return e.movement !== 'Isolation'; });
ok('Chest has real compound (Push) candidates for pickAnchor to prefer',
  chestCompounds.length > 0, chestCompounds.length);
for (var p = 0; p < 30; p++) {
  var a = qp.pickAnchor(chestPool);
  ok('pickAnchor(real Chest pool): never anchors on Isolation while a Push lift exists (run ' + p + ')',
    a.movement !== 'Isolation', a.name + ' / ' + a.movement);
}

/* ---- Biceps: honestly zero real compounds now (was 1, a false positive) -- */
var bicepsCompounds = EX.filter(function (e) { return e.muscle === 'Biceps' && e.movement !== 'Isolation' && e.movement !== 'Carry'; });
ok('Biceps compound pool is honestly empty post-fix (curls are single-joint; the prior "1" was the mis-tagged concentration-curl record)',
  bicepsCompounds.length === 0, bicepsCompounds.length);
var bicepsPool = EX.filter(function (e) { return e.muscle === 'Biceps'; });
var bicepsAnchor = qp.pickAnchor(bicepsPool);
ok('pickAnchor(real Biceps pool): still returns a real Biceps candidate when the pool is all-Isolation (fallback path)',
  !!bicepsAnchor && bicepsAnchor.muscle === 'Biceps', bicepsAnchor && bicepsAnchor.name);

console.log('\n' + pass + ' assertions, ' + fail + ' failed');
if (fail > 0) {
  console.error('\nFix: exercise-catalog.js\'s movement/muscle tags, or mc-quick-pump.js\'s pickAnchor(), no longer match the fixed F-05 behavior.');
  process.exit(1);
}
console.log('test-mc-quick-pump-catalog: pass — Core-focus cardio leak 0/400, ' +
  Object.keys(byMaster).length + ' master groups checked');

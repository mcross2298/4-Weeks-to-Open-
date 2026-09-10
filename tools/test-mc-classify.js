#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-classify.js — the ONE exercise-name -> equipment resolver
   (engine-repair roadmap Phase 2.4; audit P2-13, EN-11, EN-12).

   `equipCat()` existed twice, in mc-suggest.js and mc-maxout.js, and the two
   disagreed. mc-maxout.js had no Dumbbell branch at all, so the same lift was
   "Dumbbell" to the progression engine and "Barbell" to the one-rep-max
   estimator — and neither knew Smith, Plate-Loaded or Bodyweight existed,
   three of the seven values exercise-catalog.js actually uses, covering 119
   of its 577 exercises.

   Runs against the real mc-classify.js.
   Run: node tools/test-mc-classify.js
   ========================================================================== */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const C = require(path.resolve(ROOT, 'mc-classify.js'));
const suggest = require(path.resolve(ROOT, 'mc-suggest.js'));
const maxout = require(path.resolve(ROOT, 'mc-maxout.js'));

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('::error::' + name + (extra ? '  — ' + extra : ''));
}

// ---- the three values neither old copy could ever return -------------------
[['Smith Machine Squat', 'Smith'],
 ['Hammer Strength Chest Press', 'Plate-Loaded'],
 ['Hack Squat', 'Plate-Loaded'],
 ['Push-Up', 'Bodyweight'],
 ['Pull-Up', 'Bodyweight']].forEach(function (c) {
  ok('P2-13 "' + c[0] + '" resolves to ' + c[1], C.equipCat(c[0]) === c[1], 'got ' + C.equipCat(c[0]));
});

// ---- the disagreement itself ----------------------------------------------
// mc-maxout.js had no Dumbbell branch; whichever engine asked got a different
// answer about the same lift. Both now route to this module.
['DB Bench Press', 'Dumbbell Row', 'Goblet Squat', 'Cable Row', 'Leg Press',
 'Smith Machine Squat', 'Barbell Curl', 'Push-Up', 'Rope Pushdown'].forEach(function (n) {
  ok('P2-13 both engines agree on "' + n + '"',
     suggest.equipCat(n) === maxout.equipCat(n),
     'suggest=' + suggest.equipCat(n) + ' maxout=' + maxout.equipCat(n));
  ok('P2-13 and both agree with the resolver on "' + n + '"',
     suggest.equipCat(n) === C.equipCat(n));
});
ok('P2-13 a dumbbell lift is Dumbbell to the 1RM estimator too',
   maxout.equipCat('DB Bench Press') === 'Dumbbell', 'got ' + maxout.equipCat('DB Bench Press'));

// ---- the catalog is authoritative, the keywords are the fallback -----------
global.window = { EXERCISES: [
  { name: 'Cable Crunch', equipment: 'Machine' },      // keywords would say Cable
  { name: 'Barbell Hip Thrust', equipment: 'Barbell' }
]};
ok('the catalog overrides the keyword guess',
   C.equipCat('Cable Crunch') === 'Machine', 'got ' + C.equipCat('Cable Crunch'));
ok('the keyword fallback still answers a name the catalog lacks',
   C.equipCat('Seated Dumbbell Curl') === 'Dumbbell', 'got ' + C.equipCat('Seated Dumbbell Curl'));
ok('an unrecognised name never comes back empty',
   C.equipCat('Something Nobody Has Named') === 'Barbell');
delete global.window;

// ---- EN-11: Plate-Loaded is leverage-assisted ------------------------------
['Cable', 'Machine', 'Plate-Loaded'].forEach(function (e) {
  ok('EN-11 ' + e + ' is leverage-assisted', C.isLeverageAssisted(e) === true);
});
['Barbell', 'Smith', 'Dumbbell', 'Bodyweight'].forEach(function (e) {
  ok(e + ' is NOT leverage-assisted', C.isLeverageAssisted(e) === false);
});
ok('EN-11 Plate-Loaded gets the 1RM discount', maxout.applyEquipCoeff(200, 'Plate-Loaded') === 170,
   'got ' + maxout.applyEquipCoeff(200, 'Plate-Loaded'));
ok('EN-11 Plate-Loaded steps 2.5 lb, not 5', suggest.computeIncrement('Hack Squat', 'Plate-Loaded') === 2.5,
   'got ' + suggest.computeIncrement('Hack Squat', 'Plate-Loaded'));
ok('Smith keeps the full estimate — it is not leverage-assisted',
   maxout.applyEquipCoeff(315, 'Smith') === 315);

// ---- EN-12: the warm-up ladder is barbell-shaped ---------------------------
ok('EN-12 a barbell lift floors at the empty bar', C.usesBarbell('Barbell Back Squat') === true);
ok('EN-12 Smith floors at the empty bar too', C.usesBarbell('Smith Machine Squat') === true);
['Cable Pushdown', 'Dumbbell Curl', 'Leg Extension Machine', 'Push-Up'].forEach(function (n) {
  ok('EN-12 "' + n + '" does NOT floor at an empty bar', C.usesBarbell(n) === false);
});
ok('EN-12 round5 still floors a barbell lift at 45', maxout.round5(10) === 45);
ok('EN-12 round5 floors a cable lift at one plate step instead',
   maxout.round5(10, maxout.floorFor('Cable Pushdown')) === 10,
   'got ' + maxout.round5(10, maxout.floorFor('Cable Pushdown')));
// the concrete defect: a 40 lb estimated max on a cable stack used to build a
// ladder of six identical 45 lb rungs, every one at or above the working max.
var cableFloor = maxout.floorFor('Cable Pushdown');
var rungs = [0.25, 0.4, 0.6, 0.75, 0.85, 0.92].map(function (p) { return maxout.round5(40 * p, cableFloor); });
ok('EN-12 a 40 lb cable max builds an ASCENDING ladder below it',
   rungs.every(function (w, i) { return w <= 40 && (i === 0 || w >= rungs[i - 1]); }) &&
   rungs[0] < rungs[rungs.length - 1],
   JSON.stringify(rungs));

// ---- P2-10: a dumbbell increment is PER HAND -------------------------------
ok('P2-10 a BIG dumbbell lift steps 5 per hand, not 10',
   suggest.computeIncrement('DB Bench Press', 'Dumbbell') === 5,
   'got ' + suggest.computeIncrement('DB Bench Press', 'Dumbbell'));
ok('P2-10 a BIG barbell lift still steps 10', suggest.computeIncrement('Barbell Squat', 'Barbell') === 10);
ok('P2-10 a non-BIG dumbbell lift is unchanged at 5',
   suggest.computeIncrement('DB Row', 'Dumbbell') === 5);

// ---- P2-11: the weight field is validated ----------------------------------
[['135', 135], ['  95.5 ', 95.5], ['5000', 5000],
 ['-135', 0], ['0', 0], ['abc', 0], ['', 0], ['5001', 0], ['1e999', 0], [null, 0], [undefined, 0]
].forEach(function (c) {
  ok('P2-11 usableWeight(' + JSON.stringify(c[0]) + ') is ' + c[1],
     suggest.usableWeight(c[0]) === c[1], 'got ' + suggest.usableWeight(c[0]));
});

console.log('test-mc-classify: ' + pass + ' passed, ' + fail + ' failed');
if (fail) {
  console.error('\nFix: the shared equipment resolver or the progression arithmetic built on it ' +
                'no longer matches the P2-10/P2-11/P2-13/EN-11/EN-12 contract.');
  process.exit(1);
}

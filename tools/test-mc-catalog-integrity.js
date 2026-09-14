#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-catalog-integrity.js — exercise-catalog.js data-quality fixes
   (audit F-08, executive-summaries audit), run against the REAL catalog.

   THE PROBLEM
   -----------
   Ten records had a wrong `equipment` or a mis-grouped `master`, found by
   sweeping every `master` group for internal disagreement rather than by
   spot-checking. Two are functional, not cosmetic: `mc-suggest.js`'s
   weight-increment table and `mc-maxout.js`'s Epley coefficient both key
   off `equipment`, so "DB Goblet Squat" and "DB Bulg. Split Squat" — both
   named for the dumbbell in their own hands — were tagged `Barbell` and
   progressed/estimated on barbell steps. The other eight are nomenclature:
   a record grouped under a `master` it does not belong to, so the Library
   showed it beside exercises it has nothing to do with (a front raise
   filed under a lat-pulldown master, a real pull-up filed there too, a
   shoulder press filed under "Rear Delt Fly", two tricep pushdowns filed
   under "Forearm Pushdown", and three pronated-grip chest flies sharing a
   master with an unrelated cable pulldown).

   THE FIX
   -------
   Each mis-grouped record moved to its REAL sibling group (verified by
   inspecting that group's other members before moving anything — "Weighted
   Pull Up (hammer grip)" also had its own `movement` corrected from
   Isolation to Pull to match its new, real siblings, the same
   align-to-master-group pattern audit F-05 used on the bench-press family).
   The three pronated-grip chest flies got a NEW shared master
   ("Pronated Chest Fly") since no existing group fit them; the one true
   pulldown that had been sharing a master with them ("Pronated Fly /
   Pulldown (Pronated)") got `master: null` — a singleton, not grouped with
   anything since it has no true duplicate-spelling sibling in the catalog.

   Deliberately NOT touched here (documented residual, matching audit F-08's
   own count of "16 master groups disagree on movement, 4 on muscle" — this
   fix closes some but not all of them): a handful of remaining internal
   disagreements inside `Shoulder Press`, `Tricep Pushdown`, `Forearm
   Pulldown` and `Forearm Pushdown` that weren't named in the audit's table
   and whose correct resolution isn't evidenced the way these ten were.

   Run: node tools/test-mc-catalog-integrity.js
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
const EX = global.window.EXERCISES;

function rec(name) { return EX.filter(function (e) { return e.name === name; })[0]; }

ok('real catalog still has 580 records', EX.length === 580, 'got ' + EX.length);

/* ---- the two functional equipment fixes ---------------------------------- */

ok('DB Goblet Squat: equipment is Dumbbell, not Barbell',
   rec('DB Goblet Squat').equipment === 'Dumbbell', rec('DB Goblet Squat').equipment);
ok('DB Bulg. Split Squat: equipment is Dumbbell, not Barbell',
   rec('DB Bulg. Split Squat').equipment === 'Dumbbell', rec('DB Bulg. Split Squat').equipment);

/* ---- the eight nomenclature/master-grouping fixes ------------------------ */

ok('Seated Double Arm DB Front Raise (hammer grip): master is Front Raise, not Forearm Pulldown',
   rec('Seated Double Arm DB Front Raise (hammer grip)').master === 'Front Raise',
   rec('Seated Double Arm DB Front Raise (hammer grip)').master);

var wpu = rec('Weighted Pull Up (hammer grip)');
ok('Weighted Pull Up (hammer grip): master is Pull-Up, not Forearm Pulldown',
   wpu.master === 'Pull-Up', wpu.master);
ok('Weighted Pull Up (hammer grip): movement is Pull (aligned to its real siblings), not Isolation',
   wpu.movement === 'Pull', wpu.movement);

ok('Reverse Machine Shoulder Press: master is Shoulder Press, not Rear Delt Fly',
   rec('Reverse Machine Shoulder Press').master === 'Shoulder Press',
   rec('Reverse Machine Shoulder Press').master);

ok('D Grip Tricep Pushdowns: master is Tricep Pushdown, not Forearm Pushdown',
   rec('D Grip Tricep Pushdowns').master === 'Tricep Pushdown', rec('D Grip Tricep Pushdowns').master);
ok('Neutral Grip Tricep Pushdowns: master is Tricep Pushdown, not Forearm Pushdown',
   rec('Neutral Grip Tricep Pushdowns').master === 'Tricep Pushdown', rec('Neutral Grip Tricep Pushdowns').master);

ok('Pronated Fly / Pulldown (Pronated): master is null (a singleton, no longer grouped with chest flies)',
   rec('Pronated Fly / Pulldown (Pronated)').master === null,
   JSON.stringify(rec('Pronated Fly / Pulldown (Pronated)').master));

['Cable Cross Over (pronated grip)', 'Chest Fly Machine (pronated grip)', 'Slight Incline Dumbbell Fly (pronated grip)']
  .forEach(function (n) {
    ok(n + ': master is Pronated Chest Fly, its real group', rec(n).master === 'Pronated Chest Fly', rec(n).master);
  });

/* ---- group-level checks: each destination group is now internally
   consistent on the axis that mattered (no NEW disagreement introduced) --- */

function groupBy(master) { return EX.filter(function (e) { return e.master === master; }); }

var pullUp = groupBy('Pull-Up');
ok('Pull-Up group: every member agrees on movement (Pull)',
   pullUp.every(function (e) { return e.movement === 'Pull'; }), JSON.stringify(pullUp.map(function (e) { return e.movement; })));

var pronatedChestFly = groupBy('Pronated Chest Fly');
ok('Pronated Chest Fly: exactly 3 members, all Chest/Isolation',
   pronatedChestFly.length === 3 &&
   pronatedChestFly.every(function (e) { return e.muscle === 'Chest' && e.movement === 'Isolation'; }),
   JSON.stringify(pronatedChestFly));

var shoulderPress = groupBy('Shoulder Press');
ok('Reverse Machine Shoulder Press is now IN the Shoulder Press group',
   shoulderPress.some(function (e) { return e.name === 'Reverse Machine Shoulder Press'; }));
ok('…and agrees with the group\'s Push-tagged majority',
   rec('Reverse Machine Shoulder Press').movement === 'Push');

var tricepPushdown = groupBy('Tricep Pushdown');
ok('D Grip / Neutral Grip Tricep Pushdowns are now IN the Tricep Pushdown group',
   tricepPushdown.some(function (e) { return e.name === 'D Grip Tricep Pushdowns'; }) &&
   tricepPushdown.some(function (e) { return e.name === 'Neutral Grip Tricep Pushdowns'; }));

console.log('\n' + pass + ' assertions, ' + fail + ' failed');
if (fail > 0) {
  console.error('\nFix: exercise-catalog.js\'s F-08 field corrections no longer match the expected values.');
  process.exit(1);
}
console.log('test-mc-catalog-integrity: pass — 10 records corrected (2 equipment, 8 master/movement)');

#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-muscle-classify.js — one muscle taxonomy, projected two ways
   (engine-repair roadmap Phase 2.2; audit DB-2..DB-11, P2-14).

   THE PROBLEM
   -----------
   Three engines answered "what does this exercise train": mc-muscle-map.js's
   coarse groups (Stats hub, recovery curve, Readiness Brief), mc-biomech.js's
   fine buckets (which lift can substitute for which), and the curated
   `muscle` field on all 577 exercise-catalog.js entries. They disagreed with
   each other and with the catalog, and each of the six ordering defects below
   was measured live on this tree before it was fixed.

   THE SHAPE OF THE FIX
   --------------------
   The catalog is the authority and the regexes are the fallback for a name it
   does not carry — which is most workout cards, since programs write their own
   variant wording. The two taxonomies are now two PROJECTIONS of one record
   rather than two independent opinions.

   Loading order matters here and is reproduced exactly as a page does it:
   exercise-catalog.js, then mc-classify.js, then the two taxonomies, all into
   ONE window. Getting that wrong is how the first measurement of this change
   reported 77% catalog agreement when the catalog was not being read at all.

   Run: node tools/test-mc-muscle-classify.js
   ========================================================================== */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const win = {};
const ctx = vm.createContext({ window: win, console, localStorage: { getItem: () => null, setItem() {} } });
['exercise-catalog.js', 'mc-classify.js', 'mc-muscle-map.js', 'mc-biomech.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
});
const { EXERCISES, MC_MUSCLES, MCBiomech, MC_CLASSIFY } = win;

// The regex layer ALONE, with no catalog behind it — the state every workout
// page is in until mc-card-actions.js's async catalog injection lands.
const bare = {};
vm.runInContext(fs.readFileSync(path.join(ROOT, 'mc-muscle-map.js'), 'utf8'),
                vm.createContext({ window: bare, console }), { filename: 'mc-muscle-map.js(bare)' });

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('::error::' + name + (extra ? '  — ' + extra : ''));
}
function group(n) { return MC_MUSCLES.classify(n).id; }
function bio(n) { return MCBiomech.classify(n); }

ok('all four modules loaded into one window',
   !!(EXERCISES && MC_MUSCLES && MCBiomech && MC_CLASSIFY));
ok('the catalog is reachable from the classifier',
   MC_CLASSIFY.catalogMuscle('21s') === 'Biceps', 'got ' + MC_CLASSIFY.catalogMuscle('21s'));

/* ---- the six ordering defects, each measured before it was fixed --------- */

// 1. A CURL is elbow flexion whatever grip it uses. The old rule demanded a
//    bicep keyword too, so a close-grip curl fell through to a branch where
//    `close grip` filed it as TRICEPS work.
['Barbell Curls (close grip)', 'Close Grip Barbell Curl'].forEach(function (n) {
  ok('DB close-grip curl is biceps: ' + n, group(n) === 'biceps', 'got ' + group(n));
  ok('DB close-grip curl is elbow flexion: ' + n, bio(n).pattern === 'elbow-flexion', 'got ' + bio(n).pattern);
  ok('DB close-grip curl trains Biceps: ' + n, bio(n).muscle === 'Biceps', 'got ' + bio(n).muscle);
});

// 2. `row` matched first, so the `upright row` half of the shrug branch was
//    UNREACHABLE and an upright row was filed as a horizontal pull.
['Cable Upright Row', 'Barbell Upright Row'].forEach(function (n) {
  ok('DB upright row reaches the shrug pattern: ' + n, bio(n).pattern === 'shrug', 'got ' + bio(n).pattern);
});

// 3. `overhead` alone claimed every overhead TRICEPS movement for the shoulder
//    press, and mc-muscle-map.js's `overhead extension` needed the two words
//    adjacent so it matched nothing at all.
['Overhead Cable Tricep Extension', 'Overhead Dumbbell Extension', 'Overhead Rope Extension'].forEach(function (n) {
  ok('DB overhead extension is triceps: ' + n, group(n) === 'triceps', 'got ' + group(n));
  ok('DB overhead extension is elbow extension: ' + n, bio(n).pattern === 'elbow-extension', 'got ' + bio(n).pattern);
});
ok('a real overhead PRESS is still a vertical push',
   bio('Barbell Overhead Press').pattern === 'vertical-push', 'got ' + bio('Barbell Overhead Press').pattern);

// 4. The squat rule claimed calf raises done at a squat/leg-press station, so
//    the substitute picker looked for squats to replace a calf raise with.
['Leg Press Calf Raise', 'Smith Machine Calf Raise'].forEach(function (n) {
  ok('DB calf raise is a calf movement: ' + n, bio(n).pattern === 'calf', 'got ' + bio(n).pattern);
  ok('DB calf raise is calves: ' + n, group(n) === 'calves', 'got ' + group(n));
});
ok('a real squat is still a squat', bio('Barbell Back Squat').pattern === 'squat');

// 5. "BW " was not recognised as bodyweight, so a bodyweight movement was
//    given the Barbell default — and a barbell's leverage factor in the
//    weight conversion.
['BW Calf Raises', 'BW Walking Lunges', 'BW Glute Bridge', 'BW Push-Ups'].forEach(function (n) {
  ok('DB "' + n + '" is Bodyweight', bio(n).equipment === 'Bodyweight', 'got ' + bio(n).equipment);
});

// 6. `lat ` — space-suffixed, no word boundary — matches inside "flat".
['Flat Press', 'Flat Machine Press', 'Flat DB Press'].forEach(function (n) {
  ok('DB "' + n + '" is not Back', bio(n).muscle !== 'Back', 'got ' + bio(n).muscle);
});
ok('a real lat movement is still Back', bio('Lat Pulldown').muscle === 'Back');
ok('"Lat Pulldown" is still a vertical pull', bio('Lat Pulldown').pattern === 'vertical-pull');

/* ---- found by MEASURING, not named by the audit -------------------------- */

// "Flies" is how this app's own programs spell it, and neither engine knew it.
['Slight Incline DB Flies', 'Cable Flies', 'Incline Flies'].forEach(function (n) {
  ok('plural "flies" is chest: ' + n, group(n) === 'chest', 'got ' + group(n));
  ok('plural "flies" is a chest fly: ' + n, bio(n).pattern === 'chest-fly', 'got ' + bio(n).pattern);
});
// `\brow\b` did not match "Rows", and `grip` in the forearms pattern then
// caught the leftovers.
['Underhand Cable Rows', 'V Grip Cable Rows', 'Close Grip Cable Rows',
 'Underhand Bent Over Barbell Rows'].forEach(function (n) {
  ok('plural "rows" is back: ' + n, group(n) === 'back', 'got ' + group(n));
});
// The `press` catch-all in the chest group claimed the overhead press itself.
ok('an overhead barbell press is shoulders, not chest',
   group('Standing Overhead Barbell Press') === 'shoulders',
   'got ' + group('Standing Overhead Barbell Press'));
// `curl` beat forearms, so a wrist curl was biceps work.
['DB Wrist Curl', 'Kneeling Single-Arm DB Forearm Curl'].forEach(function (n) {
  ok('a wrist/forearm curl is forearms: ' + n, group(n) === 'forearms', 'got ' + group(n));
});

/* ---- the catalog is authoritative --------------------------------------- */

// A name with no keyword in it at all: no regex can ever resolve this, and the
// catalog answers it outright.
ok('P2-14 "21s" resolves from the catalog', group('21s') === 'biceps', 'got ' + group('21s'));
ok('P2-14 the regex layer alone still cannot', bare.MC_MUSCLES.classify('21s').id === 'other');

// The 17 catalog entries corrected in this step. Each had its real target
// stated in its own name while the record said otherwise: a GRIP MODIFIER was
// filed as the muscle, and six tricep kickbacks were filed as glute work
// beside five identically-named ones already filed as triceps.
[['Cable Cross Over (pronated grip)', 'chest'],
 ['Chest Fly Machine (pronated grip)', 'chest'],
 ['Slight Incline Dumbbell Fly (pronated grip)', 'chest'],
 ['D Grip Tricep Pushdowns', 'triceps'],
 ['Neutral Grip Tricep Pushdowns', 'triceps'],
 ['Wide Grip Tricep Pulldowns', 'triceps'],
 ['Reverse Grip Pulldowns', 'back'],
 ['V Grip Pulldowns', 'back'],
 ['Pronated Fly / Pulldown (Pronated)', 'back'],
 ['Weighted Pull Up (hammer grip)', 'back'],
 ['Seated Double Arm DB Front Raise (hammer grip)', 'shoulders'],
 ['Barbell Tricep Kickbacks', 'triceps'],
 ['Bent Over DB Tricep Kickbacks', 'triceps'],
 ['Double Arm Cable Tricep Kickbacks', 'triceps'],
 ['Lying DB Kickbacks', 'triceps'],
 ['Seated Double Arm DB Kickbacks', 'triceps'],
 ['Single Arm Tricep Kickbacks', 'triceps']].forEach(function (c) {
  ok('corrected catalog entry "' + c[0] + '" is ' + c[1], group(c[0]) === c[1], 'got ' + group(c[0]));
});
// and the genuine grip work in that same bucket was left alone
['Plate Pinch', 'Towel Hangs', 'DB Wrist Curl', 'Wrist Rolls'].forEach(function (n) {
  ok('genuine grip work stays Forearms: ' + n,
     MC_CLASSIFY.catalogMuscle(n) === 'Forearms', 'got ' + MC_CLASSIFY.catalogMuscle(n));
});

// No catalog entry may be UNCLASSIFIABLE any more. This is the assertion that
// makes the catalog authoritative rather than merely consulted.
// "Cardio" and "Full Body" are not one muscle group, and "other" is the right
// answer for a Battle Rope circuit or a Power Clean — so the sweep is over the
// entries whose curated muscle IS a strength group.
var STRENGTH = function (m) {
  var s = String(m || '').toLowerCase();
  return s !== 'cardio' && s !== 'full body' && s !== '';
};
var stillOther = EXERCISES.filter(function (e) {
  return STRENGTH(e.muscle) && group(e.name) === 'other';
});
ok('every catalog exercise with a real muscle resolves to a group', stillOther.length === 0,
   stillOther.length + ' still "other": ' + stillOther.slice(0, 5).map(function (e) { return e.name; }).join(', '));

// And every catalog entry's group must agree with its own curated muscle —
// the property that "authoritative" actually means.
var CATALOG_GROUP = {
  'chest': 'chest', 'back': 'back', 'shoulders': 'shoulders', 'biceps': 'biceps',
  'triceps': 'triceps', 'forearms': 'forearms', 'core': 'core', 'abs': 'core',
  'calves': 'calves', 'legs - quads': 'legs', 'legs - hamstrings': 'legs',
  'legs - glutes': 'legs', 'quads': 'legs', 'hamstrings': 'legs', 'glutes': 'legs',
  'adductors': 'legs', 'abductors': 'legs', 'legs': 'legs'
};
var disagree = EXERCISES.filter(function (e) {
  var want = CATALOG_GROUP[String(e.muscle || '').toLowerCase()];
  return want && group(e.name) !== want;
});
ok('P2-14 no catalog exercise is classified against its own curated muscle',
   disagree.length === 0,
   disagree.length + ' disagree: ' + disagree.slice(0, 5).map(function (e) {
     return e.name + ' (' + e.muscle + ' -> ' + group(e.name) + ')';
   }).join('; '));

// The fine taxonomy must stay FINE. Collapsing mc-biomech.js onto the coarse
// groups would make every leg exercise a valid substitute for every other, so
// the two projections are deliberately different shapes.
ok('the fine taxonomy still separates quads from hamstrings',
   bio('Barbell Back Squat').muscle === 'Quads' && bio('Lying Leg Curl').muscle === 'Hamstrings',
   bio('Barbell Back Squat').muscle + ' / ' + bio('Lying Leg Curl').muscle);
ok('the coarse taxonomy still lumps them, as the Stats hub needs',
   group('Barbell Back Squat') === 'legs' && group('Lying Leg Curl') === 'legs');

console.log('test-mc-muscle-classify: ' + pass + ' passed, ' + fail + ' failed  (' +
            EXERCISES.length + ' catalog exercises swept)');
if (fail) {
  console.error('\nFix: the muscle taxonomy no longer matches the P2-14 / DB-* contract.');
  process.exit(1);
}

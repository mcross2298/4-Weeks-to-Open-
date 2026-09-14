#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-biomech.js — mc-biomech.js's substitute engine: the movement-
   pattern classifier and the catalog-`master` fallback, run against the
   ACTUAL exercise-catalog.js source (audit F-02, executive-summaries audit).

   THE PROBLEM
   -----------
   The substitute picker (mc-card-actions.js -> openSubstitute() ->
   MCBiomech.alternatives()) requires BOTH pattern and muscle to match
   (strict matching, a locked product decision — see this file's own header).
   Measured against the live catalog before this fix: 109 of 580 exercises
   (18.8%) resolved to no pattern at all ('other'). tieredCandidates()'s tier1
   then matched every one of those 109 against EACH OTHER purely because they
   shared the placeholder value 'other' — so "DB Pullover" (a pull) and
   "Dips" (a bodyweight press) were both offered "Barbell Bench" as their
   top-ranked "equivalent" swap, and 16 records got zero alternatives at all.

   THE SHAPE OF THE FIX
   --------------------
   Two changes, in patternOf() and classify() respectively:
     1. patternOf() gained real vocabulary this app's own catalog and
        programs actually use — a bare "Bench" with no "press", "front
        raise" as its own pattern (never folded into 'lateral-raise', a
        different plane of motion), "21s", "quad extension", and
        space/plural-tolerant pull-up/chin-up/dip/close-grip-bench regexes.
     2. classify() falls back to the catalog's own `master` record (P2-14's
        "catalog first, regex fallback" reasoning, applied here for the
        first time) ONLY when the raw name still resolves to nothing — so it
        can recover a pattern, never override one a more specific keyword
        already matched. This is what "Incline DB (Incline)" / "Machine
        Chest (Hammer)" / "Shoulder (Seated)" needed: named by station +
        angle alone, with the movement itself only in a shared `master`
        ("Incline DB Press" / "Machine Chest Press" / "Shoulder Press").

   THE ONE LANDMINE (fixed by audit F-08, guard kept on a synthetic fixture)
   --------------------------------------------------------------------------
   This catalog used to carry exactly one exercise whose own `master` was
   itself mis-grouped: "Seated Double Arm DB Front Raise (hammer grip)" ->
   master "Forearm Pulldown". Blindly trusting `master` would have
   reclassified a front raise as a lat pulldown; it didn't, because the
   front-raise rule already resolves a record's RAW name before the master
   fallback is ever consulted. Audit F-08 fixed the mis-grouping itself
   (master is now "Front Raise", its real sibling group), which is correct
   for the data but means the real record can no longer demonstrate the
   override-precedence bug — its master and its raw-name pattern now agree.
   The mechanism is still tested below, on an injected synthetic fixture
   built to the landmine's exact shape, so a future data fix can never
   silently disable this guard the way it just would have here.

   Loading order matters and is reproduced exactly as a page does it
   (mc-card-actions.js's own init(): exercise-catalog.js and mc-biomech.js
   both lazy-loaded, mc-classify.js already present from the page's own
   <script> tags) — the same convention test-mc-muscle-classify.js uses.

   Run: node tools/test-mc-biomech.js
   ========================================================================== */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const win = {};
const ctx = vm.createContext({ window: win, console, localStorage: { getItem: () => null, setItem() {} } });
['exercise-catalog.js', 'mc-classify.js', 'mc-biomech.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
});
const { EXERCISES, MCBiomech, MC_CLASSIFY } = win;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('::error::' + name + (extra ? '  — ' + extra : ''));
}
function bio(n, muscle) { return MCBiomech.classify(n, muscle); }
function byName(n) { return EXERCISES.find(function (e) { return e.name === n; }); }

ok('all three modules loaded into one window',
   !!(EXERCISES && MCBiomech && MC_CLASSIFY));
ok('real catalog has 580 exercises (sanity check on the fixture)',
   EXERCISES.length === 580, 'got ' + EXERCISES.length);

/* ---- 1. patternOf() vocabulary gaps, each a real catalog name ----------- */

ok('a bare bench press with no "press" resolves: Barbell Bench',
   bio('Barbell Bench').pattern === 'horizontal-push', 'got ' + bio('Barbell Bench').pattern);
ok('a bare bench press with no master resolves too: 100-Rep Barbell Bench',
   bio('100-Rep Barbell Bench').pattern === 'horizontal-push', 'got ' + bio('100-Rep Barbell Bench').pattern);
ok('a bench-SUPPORTED curl is not swept into horizontal-push: Kneeling Reverse Forearm Curls (bench supported)',
   bio('Kneeling Reverse Forearm Curls (bench supported)').pattern !== 'horizontal-push',
   'got ' + bio('Kneeling Reverse Forearm Curls (bench supported)').pattern);
ok('a bench-performed leg curl is not swept into horizontal-push: Flat Bench Dumbbell Leg Curl',
   bio('Flat Bench Dumbbell Leg Curl').pattern === 'knee-flexion',
   'got ' + bio('Flat Bench Dumbbell Leg Curl').pattern);
ok('the mistagged Chest "superman" is not swept into horizontal-push: Lying Flat Bench Supermans',
   bio('Lying Flat Bench Supermans').pattern !== 'horizontal-push',
   'got ' + bio('Lying Flat Bench Supermans').pattern);

ok('front raise gets its own pattern, not lateral-raise: Front Raise (Standing)',
   bio('Front Raise (Standing)').pattern === 'front-raise', 'got ' + bio('Front Raise (Standing)').pattern);
ok('a real lateral raise still resolves to lateral-raise (unchanged)',
   bio('DB Lateral Raise').pattern === 'lateral-raise', 'got ' + bio('DB Lateral Raise').pattern);
ok('front-raise resolves to Shoulders even with no muscle supplied',
   bio('Barbell Front Raise').muscle === 'Shoulders', 'got ' + bio('Barbell Front Raise').muscle);

ok('the "21s" biceps rep protocol resolves to elbow-flexion: 21s',
   bio('21s').pattern === 'elbow-flexion', 'got ' + bio('21s').pattern);
ok('DB 21 (no s) also resolves',
   bio('DB 21').pattern === 'elbow-flexion', 'got ' + bio('DB 21').pattern);
ok('DB 21\'s (apostrophe-s) also resolves',
   bio('DB 21\'s').pattern === 'elbow-flexion', 'got ' + bio('DB 21\'s').pattern);

ok('close-grip bench with an equipment word in between still resolves: Close-Grip Barbell Bench',
   bio('Close-Grip Barbell Bench').pattern === 'elbow-extension', 'got ' + bio('Close-Grip Barbell Bench').pattern);

ok('a plural dip resolves: Dips',
   bio('Dips').pattern === 'elbow-extension', 'got ' + bio('Dips').pattern);
ok('a plural weighted dip resolves: Weighted Dips',
   bio('Weighted Dips').pattern === 'elbow-extension', 'got ' + bio('Weighted Dips').pattern);

ok('a space-separated pull up resolves to vertical-pull: Weighted Pull Up (hammer grip)',
   bio('Weighted Pull Up (hammer grip)').pattern === 'vertical-pull',
   'got ' + bio('Weighted Pull Up (hammer grip)').pattern);
ok('a space-separated, pluralized chin up resolves: Chin Ups',
   bio('Chin Ups').pattern === 'vertical-pull', 'got ' + bio('Chin Ups').pattern);
ok('the "rack chins" naming shape resolves: Rack Chins on Smith Machine',
   bio('Rack Chins on Smith Machine').pattern === 'vertical-pull',
   'got ' + bio('Rack Chins on Smith Machine').pattern);
ok('the pre-existing hyphenated form is unaffected: Pull-ups',
   bio('Pull-ups').pattern === 'vertical-pull', 'got ' + bio('Pull-ups').pattern);

ok('"Quad Extension(s)" resolves to knee-extension when correctly tagged Quads: Quad Extension Burnout',
   bio('Quad Extension Burnout', 'Legs - Quads').pattern === 'knee-extension',
   'got ' + bio('Quad Extension Burnout', 'Legs - Quads').pattern);
// exercise-catalog.js also carries two "Quad Extension" records mistagged
// muscle=Triceps — a real leg-extension machine, not a triceps movement.
// That's a catalog DATA error, not this file's to silently fix by inventing
// a muscle: the new keyword rule correctly gives it a real PATTERN even so
// (the vocabulary gap this fix closes applies regardless of the muscle
// tag), while its explicitly-supplied muscle stays exactly what the
// catalog says — wrong, unchanged, and visible rather than papered over.
var quadExt = byName('Quad Extension');
ok('the mistagged Triceps "Quad Extension" still gets a real pattern now',
   bio(quadExt.name, quadExt.muscle).pattern === 'knee-extension',
   'got ' + bio(quadExt.name, quadExt.muscle).pattern);
ok('…but its muscle is left exactly as the (wrong) catalog tag says — not silently corrected here',
   bio(quadExt.name, quadExt.muscle).muscle === 'Triceps' && quadExt.muscle === 'Triceps',
   'got classify()=' + bio(quadExt.name, quadExt.muscle).muscle + ', catalog=' + quadExt.muscle);

ok('the master-less Hammer Strength single-arm incline resolves: Single Arm Hammer Strength Incline',
   bio('Single Arm Hammer Strength Incline').pattern === 'incline-push',
   'got ' + bio('Single Arm Hammer Strength Incline').pattern);

/* ---- 2. classify()'s catalog-`master` fallback -------------------------- */

ok('a name-by-station-alone recovers its pattern via master: Incline DB (Incline)',
   bio('Incline DB (Incline)').pattern === 'incline-push', 'got ' + bio('Incline DB (Incline)').pattern);
ok('the whole "Machine Chest (...)" family recovers via master: Machine Chest (Hammer)',
   bio('Machine Chest (Hammer)').pattern === 'horizontal-push', 'got ' + bio('Machine Chest (Hammer)').pattern);
ok('an incline machine-chest variant still resolves the same way (master collapses angle, matching the catalog\'s own grouping): Machine Chest (Machine, Incline)',
   bio('Machine Chest (Machine, Incline)').pattern === 'horizontal-push',
   'got ' + bio('Machine Chest (Machine, Incline)').pattern);
ok('the bare "Shoulder (...)" family recovers via master: Shoulder (Seated)',
   bio('Shoulder (Seated)').pattern === 'vertical-push', 'got ' + bio('Shoulder (Seated)').pattern);
ok('a raise mislabeled without "lateral" recovers via master: Seated Alternating DB Raises',
   bio('Seated Alternating DB Raises').pattern === 'lateral-raise',
   'got ' + bio('Seated Alternating DB Raises').pattern);
ok('a wide-stance leg press variant recovers via master: Leg (Wide)',
   bio('Leg (Wide)').pattern === 'squat', 'got ' + bio('Leg (Wide)').pattern);
ok('a wrist-curl variant recovers via master: EZ Bar Medium Grip',
   bio('EZ Bar Medium Grip').pattern === 'elbow-flexion', 'got ' + bio('EZ Bar Medium Grip').pattern);
ok('a tricep kickback variant recovers via master: Standing Double Arm Cable Kick Outs',
   bio('Standing Double Arm Cable Kick Outs').pattern === 'elbow-extension',
   'got ' + bio('Standing Double Arm Cable Kick Outs').pattern);
ok('an overhead tricep extension variant recovers via master: Standing Double Arm DB Extension',
   bio('Standing Double Arm DB Extension').pattern === 'elbow-extension',
   'got ' + bio('Standing Double Arm DB Extension').pattern);
ok('a bare "Rope Extension" resolves when its muscle is explicitly Triceps',
   bio('Rope Extension', 'Triceps').pattern === 'elbow-extension', 'got ' + bio('Rope Extension', 'Triceps').pattern);

/* ---- 3. the landmine: a mis-grouped `master` must never win ------------- */
// The real catalog's own landmine — "Seated Double Arm DB Front Raise
// (hammer grip)" grouped under master "Forearm Pulldown" — was fixed by
// audit F-08 (now correctly under master "Front Raise"), so it can no
// longer demonstrate the override-precedence bug: its master and its own
// raw-name pattern now agree. The mechanism this guards is still real, so
// it's tested with an injected synthetic fixture instead of depending on a
// real record staying wrong forever — a fixed data bug should never
// silently disable the regression guard that used to ride on it.
var landmine = {
  name: 'ZZZ Test Fixture Front Raise (landmine)',
  muscle: 'Shoulders',
  equipment: 'Dumbbell',
  movement: 'Isolation',
  master: 'ZZZ Test Fixture Lat Pulldown Master' // would resolve to vertical-pull if wrongly trusted
};
EXERCISES.push(landmine);
ok('…classify() never reaches a mis-grouped master: the raw name resolves via front-raise BEFORE any master fallback runs',
   bio(landmine.name, landmine.muscle).pattern === 'front-raise',
   'got ' + bio(landmine.name, landmine.muscle).pattern + ' (would be vertical-pull if the master had won)');
ok('…so its muscle stays Shoulders, not whatever the wrong master would imply',
   bio(landmine.name, landmine.muscle).muscle === 'Shoulders',
   'got ' + bio(landmine.name, landmine.muscle).muscle);
EXERCISES.pop();

/* ---- 3b. audit F-08's fix: the real record now resolves correctly under
   its OWN corrected master, verified against the live catalog ------------ */
var fixedFrontRaise = byName('Seated Double Arm DB Front Raise (hammer grip)');
ok('audit F-08: "Seated Double Arm DB Front Raise (hammer grip)" is no longer grouped under Forearm Pulldown',
   !!(fixedFrontRaise && fixedFrontRaise.master === 'Front Raise'),
   'got master=' + (fixedFrontRaise && fixedFrontRaise.master));

/* ---- 4. movement-equivalence: the substitute picker's own strict rule --- */
// Same assertion the executive-summaries audit ran live: a horizontal press
// must never be offered as a "substitute" for a vertical (overhead) press.
var hAlts = MCBiomech.alternatives('Barbell Bench Press').map(function (a) { return a.name; });
ok('a horizontal bench press is never offered an overhead press as a substitute',
   hAlts.indexOf('Barbell Overhead Press') === -1 && hAlts.indexOf('Barbell Military Press') === -1,
   'got ' + JSON.stringify(hAlts));

/* ---- 5. the fleet-wide count, locked in rather than left to drift ------- */
// Recomputed against the REAL catalog on every run — if a future catalog
// edit reopens a gap this fix closed, or quietly closes one that's still
// meant to be a documented residual, this fails instead of drifting.
var stillOther = EXERCISES.filter(function (e) { return MCBiomech.classify(e.name, e.muscle).pattern === 'other'; });
var stillOtherNames = stillOther.map(function (e) { return e.name; }).sort();

// A range, not an exact count: an unrelated future catalog edit (a new
// Conditioning drill, say) shouldn't fail this file. The item-level
// expectPresent/expectFixed lists below are what actually lock in the fix.
ok('the \'other\' bucket shrank from 109 to under half that (measured: 47)',
   stillOther.length >= 40 && stillOther.length <= 50,
   'got ' + stillOther.length + ' still \'other\': ' + JSON.stringify(stillOtherNames));

// Every one of these is a deliberate non-fix (documented in the audit and in
// mc-biomech.js's own comments), not an oversight:
//   - Cardio/Core/Full-Body conditioning drills (Battle Ropes, Burpees, Jump
//     Rope, Hang Clean, Spider Crawl, ...): the dashboard's own Library tile
//     already excludes Cardio + Core from the strength catalog count — the
//     substitute picker is not their surface, so forcing a resistance-
//     training pattern onto them would be a cosmetic, not a real, fix.
//   - "Seated Double Arm DB Front Raise"'s own bad `master` (already
//     covered above — a genuine catalog data error, not this file's to
//     silently paper over, and it doesn't NEED fixing here since its raw
//     name already resolves correctly without ever consulting it).
//   - Movements with no clean pattern-equivalence bucket at all: isometric
//     grip/hold work (Wrist Rolls, Plate Pinch, Towel Hangs, DB Holds),
//     rotator-cuff/mobility drills (Band IR/ER, Around the Worlds), bodyweight
//     hip-hinge work with no barbell/deadlift equivalent in this catalog
//     (Donkey Kicks, Glute Bridge, Single Leg Glute Bridge — mechanically
//     closer to a hip thrust than a full hinge, but not identical to either),
//     and the pullover family (DB/Barbell/Rope Pullover, Pelican Raise) — a
//     straight-arm shoulder-extension movement distinct enough from both a
//     row and a lat pulldown that lumping it into 'vertical-pull' would
//     recreate the exact "false equivalence" bug this fix exists to close,
//     for real alternatives it would still mostly fail to find (only 3 of
//     580 catalog exercises share this movement, split across two muscle
//     tags — Chest for the DB variant, Back for the rest).
var expectPresent = [
  'DB Pullover', 'Barbell Pullover', 'Rope Pullover', 'Pelican Raise',
  'DB Holds', 'Wrist Rolls', 'Plate Pinch', 'Towel Hangs',
  'Around the Worlds', 'Band IR/ER',
  'Donkey Kicks', 'Glute Bridge', 'Single Leg Glute Bridge',
  'Burpees', 'Hang Clean', 'Power Clean', 'Turkish Get Up', 'Spider Crawl'
];
expectPresent.forEach(function (n) {
  ok('deliberately still \'other\' (documented residual): ' + n,
     stillOtherNames.indexOf(n) !== -1, 'expected it in the residual list, but it resolved');
});

var expectFixed = [
  'Barbell Bench', 'DB Flat Bench', 'Dips', 'Machine Chest (Machine)', 'Incline DB (Incline)',
  'Incline Barbell (Incline)', 'Shoulder (Standing)', 'Front Raise (Incline)', 'DB Front Raises',
  'Cable Front Raise', '21s', 'DB 21s', 'Close-Grip Barbell Bench', 'Weighted Pull Up (hammer grip)',
  'Chin Ups', 'Leg (Wide)', 'Seated Alternating DB Raises', 'EZ Bar Medium Grip',
  'Single Arm Hammer Strength Incline', '100-Rep Barbell Bench', 'Underhand Barbell Bench',
  'Quad Extension', 'Quad Extensions (AMRAP)', 'Rope Extension'
];
expectFixed.forEach(function (n) {
  ok('now resolves (no longer \'other\'): ' + n,
     stillOtherNames.indexOf(n) === -1, 'still \'other\'');
});

console.log('\n' + pass + ' assertions, ' + fail + ' failed');
if (fail > 0) {
  console.error('\nFix: mc-biomech.js\'s patternOf()/classify() no longer match the expected movement-pattern coverage.');
  process.exit(1);
}
console.log('test-mc-biomech: pass — \'other\' bucket: 109 -> ' + stillOther.length);

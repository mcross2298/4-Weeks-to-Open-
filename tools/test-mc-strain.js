#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-strain.js — regression coverage for mc-strain.js's kcal/strain
   math, run against the actual source file instead of a duplicated inline
   copy (same convention as test-mc-suggest.js).

   Run: node tools/test-mc-strain.js
   ========================================================================== */
const path = require('path');

let fail = false;
function check(desc, actual, expected) {
  if (actual !== expected) {
    console.error(`::error::${desc} — expected ${expected}, got ${actual}`);
    fail = true;
  }
}
function checkClose(desc, actual, expected, tol) {
  if (actual == null || Math.abs(actual - expected) > (tol || 0.6)) {
    console.error(`::error::${desc} — expected ~${expected}, got ${actual}`);
    fail = true;
  }
}

function sets(tonnage, n, rpe) {
  var perSet = tonnage / n, w = 135, r = Math.round(perSet / w);
  var out = [];
  for (var i = 0; i < n; i++) out.push({ weight: w, reps: r, rpe: rpe == null ? 8 : rpe });
  return out;
}
function iso(daysAgo) { return new Date(Date.now() - daysAgo * 86400000).toISOString(); }

// ---- session(): pure function, no storage reads ---------------------------
var kv = {};
global.localStorage = {
  getItem: function (k) { return kv[k] || null; },
  setItem: function (k, v) { kv[k] = v; }
};

const strain = require(path.resolve(__dirname, '../mc-strain.js'));

var typical = strain.session({ duration: '45 min', sets: sets(8000, 5) }, 180);
check('session(): tonnage sums logged weight x reps', typical.tonnage, 8100);
checkClose('session(): a dense 45-min/8000lb/180lb-bw session lands in a believable kcal band', typical.kcal, 550, 60);

var zero = strain.session({ duration: '45 min', sets: [] }, 180);
check('session(): no sets logged -> zero kcal, not NaN/garbage', zero.kcal, 0);

var noDuration = strain.session({ duration: '', sets: sets(8000, 5) }, 180);
check('session(): unparseable duration -> zero kcal rather than Infinity', noDuration.kcal, 0);

// near-failure bump: same tonnage/duration, but 2+ sets at RPE>=9.5/F should
// cost more kcal than an identical session logged at moderate RPE. Uses a
// lighter tonnage than the 8000lb case above on purpose — that one's rate
// already saturates the MET clamp (9.0), which would hide the +0.75 bump.
var moderate = strain.session({ duration: '45 min', sets: sets(3600, 5, 8) }, 180);
var nearFailure = strain.session({ duration: '45 min', sets: sets(3600, 5, 'F') }, 180);
if (!(nearFailure.kcal > moderate.kcal)) {
  console.error(`::error::session(): 2+ near-failure sets should cost more kcal than the same tonnage at moderate RPE — got ${nearFailure.kcal} vs ${moderate.kcal}`);
  fail = true;
}

// MET clamp: an absurdly dense tonnage-rate must not produce an unbounded kcal figure
var extreme = strain.session({ duration: '5 min', sets: sets(50000, 5) }, 180);
checkClose('session(): MET is clamped even under an extreme tonnage rate', extreme.kcal, 5 * 9.0 * (180 / 2.20462) / 60, 5);

// ---- today() / trailing(): baseline + strain normalization ----------------
function resetLog(entries) {
  kv['mc_workout_log_v1'] = JSON.stringify(entries);
  kv['mc_body_v1'] = JSON.stringify([{ id: iso(0), date: iso(0), w: 180 }]);
}

// fewer than BASELINE_MIN_SESSIONS (3) prior days -> no baseline, strain null
resetLog([
  { date: iso(0), duration: '45 min', sets: sets(8000, 5) },
  { date: iso(3), duration: '45 min', sets: sets(8000, 5) }
]);
var noBaseline = strain.today();
check('today(): fewer than 3 prior baseline days -> strain is null, not a guess', noBaseline.strain, null);
if (!(noBaseline.kcal > 0)) { console.error('::error::today(): kcal should still be computed with no baseline'); fail = true; }

// no session logged today at all -> kcal 0, strain null
resetLog([{ date: iso(3), duration: '45 min', sets: sets(8000, 5) }]);
var noToday = strain.today();
check('today(): no session logged today -> kcal 0', noToday.kcal, 0);
check('today(): no session logged today -> strain null', noToday.strain, null);

// an exactly-average day against its own baseline should read close to the
// documented ~13.3 anchor (21 x (1 - e^-1))
var avgLog = [];
for (var i = 1; i <= 5; i++) avgLog.push({ date: iso(i * 2), duration: '45 min', sets: sets(8000, 5) });
avgLog.unshift({ date: iso(0), duration: '45 min', sets: sets(8000, 5) });
resetLog(avgLog);
checkClose('today(): an exactly-average day reads ~13.3 strain (the ratio=1 anchor)', strain.today().strain, 13.3, 0.3);

// a day at roughly double the trailing baseline should read meaningfully
// higher, but strain must never reach or exceed the 21 ceiling
var hardLog = [];
for (var j = 1; j <= 5; j++) hardLog.push({ date: iso(j * 2), duration: '45 min', sets: sets(8000, 5) });
hardLog.unshift({ date: iso(0), duration: '90 min', sets: sets(16000, 5) });
resetLog(hardLog);
var hard = strain.today();
if (!(hard.strain > 13.3 && hard.strain < 21)) {
  console.error(`::error::today(): a ~2x-baseline day should read above the average anchor and below the 21 ceiling — got ${hard.strain}`);
  fail = true;
}

// trailing(n) returns oldest -> newest, one entry per finished session
resetLog(avgLog);
var series = strain.trailing(3);
check('trailing(): returns the requested count', series.length, 3);
if (new Date(series[0].date).getTime() > new Date(series[series.length - 1].date).getTime()) {
  console.error('::error::trailing(): expected oldest-first ordering');
  fail = true;
}

// ---- proteinTarget(): post-workout single-feeding protein grams -----------
resetLog([]); // no session today -> strain is null, so no strain bonus applies
check('proteinTarget(): 180lb bodyweight, no strain bonus -> 30g (0.18 g/lb, nearest 5)', strain.proteinTarget(180), 30);
check('proteinTarget(): clamps to the 20g floor for a very light bodyweight', strain.proteinTarget(80), 20);
check('proteinTarget(): clamps to the 60g ceiling for a very heavy bodyweight', strain.proteinTarget(400), 60);
check('proteinTarget(): falls back to stored bodyweight (mc_body_v1) when no override passed', strain.proteinTarget(), 30);

// strain bonus: the same bodyweight on a real hard-strain day should target
// MORE protein than the no-baseline case above (hardLog built above reads
// strain in (13.3, 21)).
resetLog(hardLog);
var withStrain = strain.proteinTarget(180);
if (!(withStrain > 30)) {
  console.error(`::error::proteinTarget(): a high-strain day should target more protein than the no-strain-bonus case — got ${withStrain} vs 30`);
  fail = true;
}
if (!(withStrain <= 30 + 15)) {
  console.error(`::error::proteinTarget(): the strain bonus must stay bounded by PROTEIN_STRAIN_BONUS_MAX_G — got ${withStrain}`);
  fail = true;
}

delete global.localStorage;

if (fail) {
  console.error('\nFix: mc-strain.js\'s session()/today()/trailing() no longer match expected kcal/strain behavior.');
  process.exit(1);
}
console.log('mc-strain.js kcal/strain-math regression tests passed');

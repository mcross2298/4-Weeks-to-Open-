#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-quick-pump.js — regression coverage for mc-quick-pump.js's
   history-aware selection math (Phase 2.4), run against the actual source
   file instead of a duplicated inline copy.

   Run: node tools/test-mc-quick-pump.js
   ========================================================================== */
const path = require('path');

let fail = false;
function check(desc, actual, expected) {
  if (actual !== expected) {
    console.error(`::error::${desc} — expected ${expected}, got ${actual}`);
    fail = true;
  }
}

var CATALOG = [
  { name: 'Bench Press', muscle: 'Chest', equipment: 'Barbell', movement: 'Compound' },
  { name: 'Incline DB Press', muscle: 'Chest', equipment: 'Dumbbell', movement: 'Compound' },
  { name: 'Cable Fly', muscle: 'Chest', equipment: 'Cable', movement: 'Isolation' },
  { name: 'Overhead Press', muscle: 'Shoulders', equipment: 'Barbell', movement: 'Compound' },
  { name: 'Lateral Raise', muscle: 'Shoulders', equipment: 'Dumbbell', movement: 'Isolation' },
  { name: 'Tricep Pushdown', muscle: 'Triceps', equipment: 'Cable', movement: 'Isolation' },
  { name: 'Barbell Row', muscle: 'Back', equipment: 'Barbell', movement: 'Compound' },
  { name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable', movement: 'Compound' },
  { name: 'DB Curl', muscle: 'Biceps', equipment: 'Dumbbell', movement: 'Isolation' }
];

var localStorageData = {};
global.window = { EXERCISES: CATALOG };
global.localStorage = {
  getItem: function (k) { return localStorageData[k] || null; },
  setItem: function (k, v) { localStorageData[k] = v; }
};

const qp = require(path.resolve(__dirname, '../mc-quick-pump.js'));

// ---- preferFresh ----------------------------------------------------------
check('preferFresh: no recent muscles -> candidates unchanged',
  qp.preferFresh(CATALOG, {}).length, CATALOG.length);

var chestTrained = { Chest: true };
var freshResult = qp.preferFresh(CATALOG, chestTrained);
check('preferFresh: excludes the recently-trained muscle when enough remain',
  freshResult.some(function (e) { return e.muscle === 'Chest'; }), false);
check('preferFresh: keeps non-recent muscles',
  freshResult.some(function (e) { return e.muscle === 'Back'; }), true);

// narrow catalog where filtering would leave < 4 -> falls back to full list
var smallCatalog = CATALOG.slice(0, 3); // Bench Press, Incline DB Press, Cable Fly (all Chest)
var smallResult = qp.preferFresh(smallCatalog, chestTrained);
check('preferFresh: falls back to the full pool when filtering would leave <4',
  smallResult.length, smallCatalog.length);

// ---- balanceFullBody --------------------------------------------------------
var muscleList = ['Chest', 'Shoulders', 'Triceps', 'Back', 'Biceps'];
localStorageData['mc_workout_log_v1'] = JSON.stringify([
  { date: new Date().toISOString(), sets: [
    { name: 'Bench Press', weight: 185, reps: 8 },
    { name: 'Bench Press', weight: 185, reps: 8 },
    { name: 'Overhead Press', weight: 95, reps: 8 }
  ] }
]);
var balanced = qp.balanceFullBody(CATALOG, muscleList);
// Chest (2 sets) and Shoulders (1 set) were trained this week; Triceps/Back/Biceps (0 sets)
// are the least-trained half and should be what's left after balancing.
check('balanceFullBody: prioritizes muscles with the least logged volume this week',
  balanced.some(function (e) { return e.muscle === 'Back'; }), true);
check('balanceFullBody: deprioritizes the most-trained muscle out of the result',
  balanced.some(function (e) { return e.muscle === 'Chest'; }), false);

// ---- recentlyTrainedMuscles / weeklySetsByMuscle ---------------------------
var now = Date.now();
localStorageData['mc_workout_log_v1'] = JSON.stringify([
  { date: new Date(now - 10 * 3600 * 1000).toISOString(), sets: [{ name: 'Bench Press', weight: 185, reps: 8 }] },        // 10h ago
  { date: new Date(now - 72 * 3600 * 1000).toISOString(), sets: [{ name: 'Barbell Row', weight: 135, reps: 8 }] }          // 72h ago
]);
var recent = qp.recentlyTrainedMuscles(48);
check('recentlyTrainedMuscles: catches a set logged 10h ago (within 48h)', !!recent['Chest'], true);
check('recentlyTrainedMuscles: excludes a set logged 72h ago (outside 48h)', !!recent['Back'], false);

var weekly = qp.weeklySetsByMuscle();
check('weeklySetsByMuscle: counts a set from 72h ago (within 7 days)', weekly['Back'], 1);

// ---- lastWeightFor ----------------------------------------------------------
localStorageData['mc_workout_log_v1'] = JSON.stringify([
  { date: new Date(now - 2 * 3600 * 1000).toISOString(), sets: [{ name: 'Bench Press', weight: 195, reps: 5 }] },
  { date: new Date(now - 50 * 3600 * 1000).toISOString(), sets: [{ name: 'Bench Press', weight: 185, reps: 8 }] }
]);
check('lastWeightFor: returns the most recent logged weight (newest-first log)',
  qp.lastWeightFor('Bench Press'), 195);
check('lastWeightFor: case-insensitive match', qp.lastWeightFor('bench press'), 195);
check('lastWeightFor: null when never logged', qp.lastWeightFor('Skull Crusher'), null);

// ---- generate() end-to-end: a seeded weight rides through to the exercise --
localStorageData['mc_workout_log_v1'] = JSON.stringify([
  { date: new Date(now - 2 * 3600 * 1000).toISOString(), sets: [{ name: 'Bench Press', weight: 195, reps: 5 }] }
]);
var built = qp.generate({ minutes: 30, focus: 'Push' });
var benchEx = built.exercises.filter(function (e) { return e.name === 'Bench Press'; })[0];
check('generate(): carries a local weight seed onto the matching exercise',
  benchEx && benchEx.seedWeight, benchEx ? 195 : undefined);
var nonMatch = built.exercises.filter(function (e) { return e.name !== 'Bench Press'; });
check('generate(): exercises with no logged history get no seedWeight field',
  nonMatch.every(function (e) { return e.seedWeight === undefined; }), true);

delete global.window;
delete global.localStorage;

if (fail) {
  console.error('\nFix: mc-quick-pump.js\'s history-aware selection no longer matches expected behavior.');
  process.exit(1);
}
console.log('mc-quick-pump.js history-aware selection tests passed');

#!/usr/bin/env node
'use strict';
/* Flagship audit — engine checks (Node only, no browser).
   Runs the REAL modules (mc-suggest.js, mc-log-read.js, mc-classify.js,
   mc-sync.js) against expected values taken from the owner's decisions in
   flagship-readiness-roadmap.md. Each check states the EXPECTED behaviour, so
   on the audited tree (main @ 27fc096) the defects show up as FAIL lines.
   A FAIL here is an open roadmap item, not a broken harness.

   Usage: node GO_LIVE/flagship-audit/scenarios/fa-engines.js
*/
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '../../..');

// mc-suggest.js decides "am I in a browser" from `typeof window` at load, so it
// must be required BEFORE a window stub exists or it tries to touch document.
const suggest = require(path.join(ROOT, 'mc-suggest.js'));
const logRead = require(path.join(ROOT, 'mc-log-read.js'));
const classify = require(path.join(ROOT, 'mc-classify.js'));
const setlog = require(path.join(ROOT, 'mc-setlog.js'));

global.window = {};
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'exercise-catalog.js'), 'utf8')
  .replace(/^const /mg, 'var ').replace(/^let /mg, 'var '));
const CATALOG = window.EXERCISES || [];
window.MCSetlogUtil = Object.assign({}, setlog);
window.MC_LOG = logRead;
window.MC_CLASSIFY = classify;
global.location = { pathname: '/fa.html' };
global.localStorage = { getItem: function () { return '{}'; }, setItem: function () {} };

let pass = 0, fail = 0;
function check(id, title, expected, observed) {
  const ok = String(expected) === String(observed);
  if (ok) pass++; else fail++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + id + ' ' + title +
    ' — expected: ' + expected + (ok ? '' : ' | observed: ' + observed));
}
function session(sets) {
  return { d: '2026-10-16', sets: Object.fromEntries(sets.map(function (s, i) {
    return [String(i + 1), { w: String(s[0]), r: String(s[1]) }];
  })) };
}

console.log('Flagship audit — engine checks (decisions: per-set, top of range, ×0.5 increments)\n');

// ---- progression (roadmap R4 / B) -----------------------------------------
check('E-01', 'rep range targets the top of the range (4×10-12)', 12, suggest.topRep('4×10-12'));
check('E-02', 'rep range targets the top of the range (4×8-10)', 10, suggest.topRep('4×8-10'));
check('E-03', '10,10,10,10 on 4×10-12 does not progress', 'repeat',
  suggest.classifySession(session([[100, 10], [100, 10], [100, 10], [100, 10]]), '4×10-12').status);
check('E-04', 'pyramid 12,10,8,8 done as 8,8,8,8 does not progress', 'repeat',
  suggest.classifySession(session([[135, 8], [135, 8], [135, 8], [135, 8]]), '12,10,8,8').status);
check('E-05', '2 of 5 prescribed sets logged holds the weight', 'repeat',
  suggest.classifySession(session([[60, 5], [60, 5]]), '5x5').status);
check('E-06', 'all sets at the top of the range progresses (control)', 'progress',
  suggest.classifySession(session([[100, 12], [100, 12], [100, 12], [100, 12]]), '4×10-12').status);

// ---- increments: CLAUDE.md Task 3.3, "Cable/Machine ×0.5 step" -------------
// The owner also chose to TIGHTEN the big-lift pattern, because "bench" alone
// also matches a bench used as a PROP for another movement ("Reverse Incline
// Bench Concentration Curls" steps 10 lb today). "Bench press only" is too
// strict — real benches are often named without "press" ("Barbell Bench",
// "Close-Grip Barbell Bench") — so a big lift here is the current pattern
// minus names whose movement is an isolation word. The exact rule is the fix
// phase's to settle; E-09b/E-09c pin the two directions it must get right.
const BIG = /squat|deadlift|leg press|bench|overhead press|ohp|barbell press|military/i;
const PROP_MOVEMENT = /\b(fly|flye|flyes|flies|curls?|pushdowns?|push-downs?|extensions?|kickbacks?|raises?|supermans?|crunch(es)?|rows?)\b/i;
function isBig(name) { return BIG.test(name) && !PROP_MOVEMENT.test(name); }
check('E-07', 'Leg Press steps half the big-lift jump', 5, suggest.computeIncrement('Leg Press', classify.equipCat('Leg Press')));
check('E-08', 'Hack Squat steps half the big-lift jump', 5, suggest.computeIncrement('Hack Squat', classify.equipCat('Hack Squat')));
let mismatch = 0;
CATALOG.forEach(function (e) {
  const eq = classify.equipCat(e.name);
  if (!classify.isLeverageAssisted(eq)) return;
  const want = (isBig(e.name) ? 10 : 5) * 0.5;
  if (suggest.computeIncrement(e.name, eq) !== want) mismatch++;
});
check('E-09', 'cable/machine/plate-loaded lifts off the ×0.5 rule (catalog of ' + CATALOG.length + ')', 0, mismatch);
const curl = 'Reverse Incline Bench Concentration Curls';
check('E-09b', 'a bench used as a prop is not a big lift (' + curl + ')', 5, suggest.computeIncrement(curl, classify.equipCat(curl)));
check('E-09c', 'a real bench stays a big lift (Close-Grip Barbell Bench, control)', 10,
  suggest.computeIncrement('Close-Grip Barbell Bench', classify.equipCat('Close-Grip Barbell Bench')));

// ---- strength estimate ------------------------------------------------------
check('E-10', 'a true single is its own max (315 × 1)', 315, logRead.e1rm(315, 1, 'Barbell Bench Press'));
check('E-11', 'Epley control (225 × 5)', 263, logRead.e1rm(225, 5, 'Barbell Squat'));

// ---- sync: a delete must stay deleted (roadmap A3) -------------------------
const sandbox = { window: {}, module: { exports: {} }, console: console,
  localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
  document: { addEventListener: function () {} }, setTimeout: setTimeout, clearTimeout: clearTimeout };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'mc-sync.js'), 'utf8'), sandbox);
const sync = sandbox.module.exports;
const A = { id: 'a', pageId: 'p', date: '2026-10-20T00:00:00Z' };
const B = { id: 'b', pageId: 'p', date: '2026-10-21T00:00:00Z' };
const merged = sync.mergeStore('workoutLog', [A], [A, B], [A, B]);
check('E-12', 'a workout deleted on this device stays deleted after a pull', 'a',
  (merged || []).map(function (e) { return e.id; }).join(','));

console.log('\n' + (pass + fail) + ' checks: ' + pass + ' pass, ' + fail + ' fail' +
  (fail ? '  (each FAIL is an open item in flagship-readiness-roadmap.md)' : ''));
process.exit(fail ? 1 : 0);

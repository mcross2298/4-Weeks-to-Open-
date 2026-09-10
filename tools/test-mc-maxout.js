#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-maxout.js — regression coverage for mc-maxout.js's real 1RM-ladder
   math (Cable/Machine e1RM discount, Smith, round5 bar floor), run against
   the actual source file instead of a duplicated inline copy.

   Run: node tools/test-mc-maxout.js
   ========================================================================== */
const path = require('path');
const maxout = require(path.resolve(__dirname, '../mc-maxout.js'));

let fail = false;
function check(desc, actual, expected) {
  if (actual !== expected) {
    console.error(`::error::${desc} — expected ${expected}, got ${actual}`);
    fail = true;
  }
}

check('Cable e1RM coeff: 200*0.85=170', maxout.applyEquipCoeff(200, 'Cable'), 170);
check('Machine e1RM coeff: 200*0.85=170', maxout.applyEquipCoeff(200, 'Machine'), 170);
check('Barbell e1RM coeff: no change', maxout.applyEquipCoeff(315, 'Barbell'), 315);

// Smith is a distinct catalog equipment value but isn't leverage-assisted like
// Cable/Machine — it must keep the full estimate, no ×0.85 discount.
check('Smith e1RM coeff: no change (behaves like Barbell)', maxout.applyEquipCoeff(315, 'Smith'), 315);

check('round5 rounds to the nearest 5', maxout.round5(207), 205);
check('round5 never drops below the bar (45 lb)', maxout.round5(10), 45);

// equipCat's catalog lookup path, including resolving Smith from real catalog data
global.window = {
  EXERCISES: [
    { name: 'Smith Bench Press', equipment: 'Smith' },
    { name: 'Leg Press', equipment: 'Machine' }
  ]
};
check('equipCat resolves Smith from the catalog', maxout.equipCat('Smith Bench Press'), 'Smith');
check('equipCat resolves Machine from the catalog', maxout.equipCat('Leg Press'), 'Machine');
delete global.window;

// ---- ONE estimator (roadmap Phase 4 step 2) --------------------------------
// There were two. This file's capped reps at 12 and discounted leverage-assisted
// equipment; mc-exercise-trends.js's did neither, so the same logged set
// reported maxes 26-52% apart depending on which screen the athlete opened.
// These are the real divergence cases, measured before the estimators were
// collapsed onto mc-log-read.js.
const log = require(path.resolve(__dirname, '../mc-log-read.js'));
global.window = {
  EXERCISES: [
    { name: 'Tricep Rope Pushdown', equipment: 'Cable' },
    { name: 'Cable Crossover', equipment: 'Cable' },
    { name: 'Leg Press', equipment: 'Machine' },
    { name: 'Barbell Bench Press', equipment: 'Barbell' },
    { name: 'DB Curl', equipment: 'Dumbbell' }
  ]
};
check('cable 60x20: capped and discounted, not 100', log.e1rm(60, 20, 'Tricep Rope Pushdown'), 71);
check('cable 40x25: capped and discounted, not 73', log.e1rm(40, 25, 'Cable Crossover'), 48);
check('machine 300x15: capped and discounted, not 450', log.e1rm(300, 15, 'Leg Press'), 357);
check('barbell 225x5: unchanged, the case both always agreed on', log.e1rm(225, 5, 'Barbell Bench Press'), 263);
check('dumbbell 35x12: at the cap, no discount', log.e1rm(35, 12, 'DB Curl'), 49);

// The cap is a claim about Epley, not about the athlete: 13 reps and 30 reps
// must produce the same estimate, or a high-rep finisher invents a max.
check('reps above the cap do not raise the estimate',
      log.e1rm(100, 30, 'Barbell Bench Press'), log.e1rm(100, 12, 'Barbell Bench Press'));

// Audit L-05: a negative weight used to yield a negative max, and negative
// reps an estimate BELOW the working weight.
check('a negative weight is zero, not a negative max', log.e1rm(-100, 5, 'Barbell Bench Press'), 0);
check('negative reps floor at one, never below the working weight', log.e1rm(100, -4, 'Barbell Bench Press'), 103);
check('a NaN weight is zero', log.e1rm(NaN, 5, 'Barbell Bench Press'), 0);
check('a zero weight is zero', log.e1rm(0, 5, 'Barbell Bench Press'), 0);

// mc-maxout.js's own export must BE the shared one now, not a second copy that
// happens to agree today — that is how six makeRestTimer variants came to exist.
check('mc-maxout re-exports the shared coefficient', maxout.applyEquipCoeff(200, 'Cable'), log.applyEquipCoeff(200, 'Cable'));
delete global.window;

// A source check, because a second Epley expression anywhere is the whole
// defect returning. check-single-impl.js catches a second `e1rm` DECLARATION;
// this catches the arithmetic written inline under any name.
const fs = require('fs');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const tracked = execSync('git ls-files "*.js" "*.html"', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean);
const EPLEY = /\(\s*1\s*\+\s*[A-Za-z0-9_.()\[\], ]*?\/\s*30\s*\)/;
// Comments are stripped first. The formula is DESCRIBED in prose in several
// headers, and a scan that reads prose as code reports a file that does not
// contain the arithmetic at all — which is exactly what the first version of
// this check did, on mc-exercise-trends.js's own header line.
function decomment(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}
const strays = tracked.filter(function (f) {
  if (f === 'mc-log-read.js' || f.startsWith('tools/')) return false;
  let src;
  try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return false; }
  return EPLEY.test(decomment(src));
});
if (strays.length) {
  console.error('::error::a second Epley estimate exists outside mc-log-read.js — ' + strays.join(', '));
  fail = true;
}

if (fail) {
  console.error('\nFix: the one estimated-1RM implementation (mc-log-read.js e1rm/applyEquipCoeff) or mc-maxout.js\'s equipCat/round5 no longer match expected 1RM-ladder behavior.');
  process.exit(1);
}
console.log('mc-maxout.js max-out-math regression tests passed (one estimator, ' + tracked.length + ' files swept)');

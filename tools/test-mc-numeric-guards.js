#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-numeric-guards.js — TEST 4 of the Phase 0 launch gates
   --------------------------------------------------------------------------
   The numeric layer has to be TOTAL: every exported calculation must return a
   finite, non-negative number for every input, including the ones real stored
   data actually produces. Three separate failures motivated this (audit L-03,
   L-04, L-05, L-06), and none of them threw where anyone would notice:

     * a null member or a non-array set list crashed the strain calculation,
       which runs inside the end-of-session recap and the dashboard ring;
     * the one-rep-max chain propagated NaN through rounding, the equipment
       coefficient and the Epley estimate into the warm-up ladder, so the
       athlete was shown "NaN lb" rungs;
     * a negative weight produced negative tonnage beside a POSITIVE calorie
       figure, and negative reps an estimate below the working weight —
       confidently wrong output rather than an error.

   Pure Node, no browser: it calls the real exported functions, so it cannot
   drift from a copy of them. It extends the three suites that already exist
   for these modules rather than replacing them.

   Run: node tools/test-mc-numeric-guards.js
   ========================================================================== */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const strain = require(path.join(ROOT, 'mc-strain.js'));
const maxout = require(path.join(ROOT, 'mc-maxout.js'));
const logread = require(path.join(ROOT, 'mc-log-read.js'));

let failed = 0;
let checked = 0;

function ok(label, cond, detail) {
  checked++;
  if (!cond) { failed++; console.log('  FAIL  ' + label + (detail ? '  ' + detail : '')); }
}

function finiteNonNeg(label, v) {
  ok(label, typeof v === 'number' && Number.isFinite(v) && v >= 0, '-> ' + String(v));
}

// Every hostile input a real store can hand these functions. `undefined` and
// `null` come from a missing field, the strings from a text input, 1e308 from
// a fat-fingered entry, and the objects/arrays from valid JSON of the wrong
// shape — which is the class that actually crashed three modules.
const HOSTILE = [
  0, -1, -1e6, NaN, Infinity, -Infinity, 1e308, -1e308,
  null, undefined, 'abc', '', '  ', {}, [], true, false
];

console.log('TEST 4 — numeric boundary contract\n');

/* ---- mc-maxout.js -------------------------------------------------------- */
console.log('mc-maxout.js');
HOSTILE.forEach((v) => {
  finiteNonNeg('round5(' + JSON.stringify(v) + ')', maxout.round5(v));
  ['Cable', 'Machine', 'Plate-Loaded', 'Barbell', 'Dumbbell', undefined].forEach((eq) => {
    finiteNonNeg('applyEquipCoeff(' + JSON.stringify(v) + ', ' + eq + ')',
      maxout.applyEquipCoeff(v, eq));
  });
});
// The discount must actually apply, or the guard above passes on a function
// that quietly stopped discounting anything.
ok('Cable is discounted', maxout.applyEquipCoeff(100, 'Cable') === 85);
ok('Machine is discounted', maxout.applyEquipCoeff(100, 'Machine') === 85);
ok('Plate-Loaded is discounted (audit EN-11)', maxout.applyEquipCoeff(100, 'Plate-Loaded') === 85);
ok('Barbell is not discounted', maxout.applyEquipCoeff(100, 'Barbell') === 100);
ok('round5 still rounds a real weight', maxout.round5(137) === 135, '-> ' + maxout.round5(137));

/* ---- mc-strain.js -------------------------------------------------------- */
console.log('mc-strain.js');
HOSTILE.forEach((v) => {
  finiteNonNeg('proteinTarget(' + JSON.stringify(v) + ')', strain.proteinTarget(v));
});
ok('proteinTarget stays inside its own band', (() => {
  const g = strain.proteinTarget(180);
  return g >= 20 && g <= 60;
})(), '-> ' + strain.proteinTarget(180));

// The set-list shapes that crashed it. Each of these is valid JSON.
const SET_SHAPES = [
  [null],
  [undefined],
  [{ a: 1 }],
  [null, { name: 'X', weight: 100, reps: 10 }],
  { notAnArray: true },
  'a string',
  42,
  null,
  undefined,
  [{ name: 'X', weight: -50, reps: 10 }],
  [{ name: 'X', weight: 1e308, reps: 10 }],
  [{ name: 'X', weight: 100, reps: -5 }],
  [{ name: 'X', weight: 'abc', reps: 'def' }],
  [{ name: 'X', weight: Infinity, reps: Infinity }]
];

SET_SHAPES.forEach((sets, i) => {
  let r;
  try {
    r = strain.session({ date: new Date().toISOString(), duration: '60 min', sets: sets });
  } catch (e) {
    failed++; checked++;
    console.log('  FAIL  strain.session threw on shape ' + i + ': ' + e.message);
    return;
  }
  finiteNonNeg('session(shape ' + i + ').kcal', r.kcal);
  finiteNonNeg('session(shape ' + i + ').tonnage', r.tonnage);
});

// A session left open must not grow calories forever (audit L-06).
const long = strain.session({ date: new Date().toISOString(), duration: '100000 min',
  sets: [{ name: 'X', weight: 100, reps: 10 }] });
finiteNonNeg('session(100000 min).kcal', long.kcal);
ok('an absurd duration is capped', long.kcal < 10000, '-> ' + long.kcal);

// And a real session must still produce a real number, or every guard above
// is passing on a function that returns zero for everything.
const real = strain.session({ date: new Date().toISOString(), duration: '60 min',
  sets: [{ name: 'Bench', weight: 185, reps: 8 }, { name: 'Bench', weight: 185, reps: 8 }] });
ok('a real session still computes tonnage', real.tonnage === 2960, '-> ' + real.tonnage);
ok('a real session still computes kcal', real.kcal > 0, '-> ' + real.kcal);

/* ---- mc-log-read.js ------------------------------------------------------ */
console.log('mc-log-read.js');
[null, undefined, 42, 'x', {}, { sets: {} }, { sets: 'x' }, { sets: [null, 1, 'a'] }]
  .forEach((entry, i) => {
    const r = logread.readSets(entry);
    ok('readSets(shape ' + i + ') is an array', Array.isArray(r));
    ok('readSets(shape ' + i + ') drops bad members', r.every((x) => x && typeof x === 'object'));
  });
ok('readSets keeps real members',
  logread.readSets({ sets: [{ name: 'X' }, null] }).length === 1);
// In Node there is no localStorage at all; the reader must survive that too,
// since these modules are require()'d by this very suite.
ok('readWorkoutLog() survives having no storage', Array.isArray(logread.readWorkoutLog()));

console.log('\n' + checked + ' assertions, ' + failed + ' failed');
console.log(failed ? 'test-mc-numeric-guards: FAIL' : 'test-mc-numeric-guards: pass');
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-suggest.js — regression coverage for mc-suggest.js's real
   progression-increment math (Cable/Machine/Dumbbell/Barbell/Smith), run
   against the actual source file instead of a duplicated inline copy.

   Run: node tools/test-mc-suggest.js
   ========================================================================== */
const path = require('path');
const suggest = require(path.resolve(__dirname, '../mc-suggest.js'));

let fail = false;
function check(desc, actual, expected) {
  if (actual !== expected) {
    console.error(`::error::${desc} — expected ${expected}, got ${actual}`);
    fail = true;
  }
}

check('Cable step is 2.5 lb', suggest.computeIncrement('Lat Pulldown', 'Cable'), 2.5);
check('Machine step is 2.5 lb', suggest.computeIncrement('Leg Press', 'Machine'), 2.5);
check('Dumbbell step is 5 lb', suggest.computeIncrement('DB Row', 'Dumbbell'), 5);
check('Barbell step is 5 lb for non-BIG lifts', suggest.computeIncrement('Barbell Curl', 'Barbell'), 5);
check('BIG barbell pattern steps 10 lb', suggest.computeIncrement('Barbell Squat', 'Barbell'), 10);
check('Cable face pull steps 2.5 lb', suggest.computeIncrement('Face Pull', 'Cable'), 2.5);

// Smith is a distinct catalog equipment value but isn't leverage-assisted like
// Cable/Machine — it must keep the full Barbell-style step, not the 2.5 lb discount.
check('Smith behaves like Barbell on a non-BIG lift — full 5 lb step', suggest.computeIncrement('Smith Row', 'Smith'), 5);
check('Smith on a BIG pattern still steps 10 lb, no discount', suggest.computeIncrement('Smith Squat', 'Smith'), 10);

// equipCat's catalog lookup path, including resolving Smith from real catalog data
global.window = {
  EXERCISES: [
    { name: 'Smith Machine Squat', equipment: 'Smith' },
    { name: 'Cable Row', equipment: 'Cable' }
  ]
};
check('equipCat resolves Smith from the catalog', suggest.equipCat('Smith Machine Squat'), 'Smith');
check('equipCat resolves Cable from the catalog', suggest.equipCat('Cable Row'), 'Cable');
check('equipCat falls back to keyword match for Dumbbell', suggest.equipCat('DB Bench Press'), 'Dumbbell');
delete global.window;

if (fail) {
  console.error('\nFix: mc-suggest.js\'s computeIncrement/equipCat no longer match expected progression-step behavior.');
  process.exit(1);
}
console.log('mc-suggest.js progression-math regression tests passed');

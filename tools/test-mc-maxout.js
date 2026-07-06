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

if (fail) {
  console.error('\nFix: mc-maxout.js\'s applyEquipCoeff/equipCat/round5 no longer match expected 1RM-ladder behavior.');
  process.exit(1);
}
console.log('mc-maxout.js max-out-math regression tests passed');

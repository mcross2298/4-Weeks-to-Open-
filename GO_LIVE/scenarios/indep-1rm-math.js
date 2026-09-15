// INDEPENDENT validation of MC Training's critical calculations.
// Expected values are computed here from the published formula, NOT by
// calling the app's own function and agreeing with itself.
global.window = global.window || {};
global.localStorage = { getItem: () => null, setItem: () => {} };
const LR = require('/home/user/4-Weeks-to-Open-/mc-log-read.js');
const CAP = LR.EPLEY_REP_CAP;
let pass = 0, fail = 0;
const t = (name, got, want) => {
  if (got === want) { pass++; }
  else { fail++; console.log(`  FAIL ${name}: got ${got}, expected ${want}`); }
};
console.log('EPLEY_REP_CAP =', CAP);

// 1. Epley against an independently written formula, barbell (no coefficient).
//    Barbell is the default when the classifier is absent.
const epley = (w, r) => Math.round(w * (1 + Math.min(r, CAP) / 30));
for (const w of [45, 95, 135, 225, 315, 405, 1, 2.5, 500]) {
  for (const r of [1, 2, 3, 5, 8, 10, 12, 15, 20, 30]) {
    t(`e1rm(${w},${r})`, LR.e1rm(w, r, 'Barbell Bench Press'), epley(w, r));
  }
}
// 2. Invariant: an estimated max is never BELOW the weight actually lifted.
for (const w of [45, 100, 225]) for (const r of [1, 5, 12, 40, 0, -3]) {
  const e = LR.e1rm(w, r, 'Barbell Bench Press');
  if (e < w) { fail++; console.log(`  FAIL invariant e1rm(${w},${r})=${e} < lifted ${w}`); } else pass++;
}
// 3. Monotonic in reps up to the cap, flat beyond it.
let prev = 0, mono = true;
for (let r = 1; r <= CAP; r++) { const e = LR.e1rm(200, r, 'Barbell Bench Press'); if (e < prev) mono = false; prev = e; }
t('monotonic in reps to cap', mono, true);
t('flat beyond cap', LR.e1rm(200, CAP, 'BB') === LR.e1rm(200, CAP + 50, 'BB'), true);
// 4. Garbage in -> 0, never NaN/Infinity/negative.
for (const bad of [0, -1, -100, NaN, Infinity, -Infinity, 'abc', null, undefined, {}]) {
  t(`e1rm(${String(bad)}) guarded`, LR.e1rm(bad, 5, 'BB'), 0);
}
// 5. Leverage-assisted coefficient is 0.85 of the barbell estimate.
for (const w of [60, 100, 150]) for (const r of [8, 12, 20]) {
  t(`coeff(${w},${r})`, LR.applyEquipCoeff(epley(w, r), 'Cable'), Math.round(epley(w, r) * 0.85));
  t(`coeff-barbell(${w},${r})`, LR.applyEquipCoeff(epley(w, r), 'Barbell'), epley(w, r));
}
// 6. Cluster reps: a 5+5+5 cluster must estimate off the TOP mini-set (5),
//    not the sum (15) — a rested mid-set total invents a max nobody lifted.
t('repsTop(5+5+5)', LR.repsTop('5+5+5'), 5);
t('repsTotal(5+5+5)', LR.repsTotal('5+5+5'), 15);
t('cluster max uses top', LR.e1rm(200, LR.repsTop('5+5+5'), 'BB'), epley(200, 5));
console.log(`\nindependent-math: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

/* GO_LIVE — independent validation of the estimated 1RM (mc-log-read.js e1rm).
   ==========================================================================
   Expected values are NOT computed by calling the app's own function, and they
   are NOT computed by restating its formula here either. They are a FROZEN
   table, derived once from the published Epley equation

       1RM = weight x (1 + min(reps, 12) / 30),  rounded

   and written in literally. Two reasons, and the second is the one that matters:

     1. A restated formula in a test tracks the source. If somebody edits the
        coefficient in mc-log-read.js and edits the same coefficient in a test
        that re-derives it, the test still passes. A frozen number cannot move.

     2. tools/test-mc-maxout.js sweeps every tracked .js and .html for a second
        Epley implementation, because roadmap Phase 4.2 collapsed two disagreeing
        estimators into one (a cable pushdown at 60x20 read 71 on one screen and
        100 on another). It exempts mc-log-read.js and tools/ — app code gets one
        implementation, test code may restate it. This file sat outside both and
        correctly failed that scan on its first CI run. A golden table satisfies
        the gate AND is the better test, so nothing was excluded to accommodate
        it.

   Run: node GO_LIVE/scenarios/indep-1rm-math.js
   ========================================================================== */
global.window = global.window || {};
global.localStorage = { getItem: () => null, setItem: () => {} };
const LR = require('/home/user/4-Weeks-to-Open-/mc-log-read.js');

let pass = 0, fail = 0;
const t = (name, got, want) => {
  if (got === want) { pass++; return; }
  fail++;
  console.log(`  FAIL ${name}: got ${got}, expected ${want}`);
};

console.log('EPLEY_REP_CAP reported by the module =', LR.EPLEY_REP_CAP);
t('the rep cap is 12, as the frozen table assumes', LR.EPLEY_REP_CAP, 12);

// ---- 1. the frozen ladder -------------------------------------------------
// Rows are [weight, [estimate at each rep count in REPS]]. Barbell, so no
// leverage coefficient applies.
const REPS = [1, 2, 3, 5, 8, 10, 12, 15, 20, 30];
const GOLDEN = [
  [45,  [47, 48, 50, 53, 57, 60, 63, 63, 63, 63]],
  [95,  [98, 101, 105, 111, 120, 127, 133, 133, 133, 133]],
  [135, [140, 144, 149, 158, 171, 180, 189, 189, 189, 189]],
  [225, [233, 240, 248, 263, 285, 300, 315, 315, 315, 315]],
  [315, [326, 336, 347, 368, 399, 420, 441, 441, 441, 441]],
  [405, [419, 432, 446, 473, 513, 540, 567, 567, 567, 567]],
  [1,   [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
  [2.5, [3, 3, 3, 3, 3, 3, 4, 4, 4, 4]],
  [500, [517, 533, 550, 583, 633, 667, 700, 700, 700, 700]]
];
GOLDEN.forEach(([w, expected]) => {
  REPS.forEach((r, i) => {
    t(`e1rm(${w}, ${r})`, LR.e1rm(w, r, 'Barbell Bench Press'), expected[i]);
  });
});
// The last four columns of every row are identical on purpose: that IS the rep
// cap. Beyond 12 reps the estimate must stop climbing.
GOLDEN.forEach(([w, expected]) => {
  t(`the estimate is flat beyond the cap for ${w} lb`,
    expected[6] === expected[7] && expected[7] === expected[8] && expected[8] === expected[9], true);
});

// ---- 2. invariants that hold whatever the constants are -------------------
// An estimated max below the weight actually lifted is nonsense, and negative
// reps used to produce exactly that (audit L-05).
[45, 100, 225].forEach((w) => {
  [1, 5, 12, 40, 0, -3].forEach((r) => {
    const e = LR.e1rm(w, r, 'Barbell Bench Press');
    t(`e1rm(${w}, ${r}) is never below the ${w} lb actually lifted`, e >= w, true);
  });
});
let monotonic = true, prev = 0;
for (let r = 1; r <= 12; r++) {
  const e = LR.e1rm(200, r, 'Barbell Bench Press');
  if (e < prev) monotonic = false;
  prev = e;
}
t('more reps at the same weight never estimates a LOWER max', monotonic, true);

// ---- 3. garbage in, zero out (never NaN, Infinity or a negative) ----------
[0, -1, -100, NaN, Infinity, -Infinity, 'abc', null, undefined, {}].forEach((bad) => {
  t(`e1rm(${String(bad)}, 5) is guarded to 0`, LR.e1rm(bad, 5, 'BB'), 0);
});

// ---- 4. the leverage-assisted coefficient --------------------------------
// Cable / Machine / Plate-Loaded discount the estimate to 85%. Frozen rows:
// [weight, reps, barbell estimate, leverage-assisted estimate].
const COEFF = [
  [60, 8, 76, 65], [60, 12, 84, 71], [60, 20, 84, 71],
  [100, 8, 127, 108], [100, 12, 140, 119], [100, 20, 140, 119],
  [150, 8, 190, 162], [150, 12, 210, 179], [150, 20, 210, 179]
];
COEFF.forEach(([w, r, barbell, assisted]) => {
  t(`applyEquipCoeff(${barbell}, 'Barbell') passes through`, LR.applyEquipCoeff(barbell, 'Barbell'), barbell);
  t(`applyEquipCoeff(${barbell}, 'Cable') discounts to 85%`, LR.applyEquipCoeff(barbell, 'Cable'), assisted);
  t(`applyEquipCoeff(${barbell}, 'Machine') discounts to 85%`, LR.applyEquipCoeff(barbell, 'Machine'), assisted);
  t(`the barbell ladder still reads ${barbell} at ${w}x${r}`, LR.e1rm(w, r, 'Barbell Bench Press'), barbell);
});

// ---- 5. a cluster is rested mid-set ---------------------------------------
// "5+5+5" is three mini-sets with rest between them. An estimate off the SUMMED
// 15 reps invents a max nobody lifted, so the top mini-set is what counts.
t('repsTop("5+5+5") reads the top mini-set', LR.repsTop('5+5+5'), 5);
t('repsTotal("5+5+5") still sums for tonnage', LR.repsTotal('5+5+5'), 15);
t('a cluster max estimates off the top mini-set, not the sum',
  LR.e1rm(200, LR.repsTop('5+5+5'), 'BB'), 233);
t('and that is NOT what the summed reps would have given',
  LR.e1rm(200, LR.repsTop('5+5+5'), 'BB') !== LR.e1rm(200, LR.repsTotal('5+5+5'), 'BB'), true);

console.log(`\nindep-1rm-math: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

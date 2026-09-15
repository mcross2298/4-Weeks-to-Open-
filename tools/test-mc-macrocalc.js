#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-mc-macrocalc.js — the nutrition goal calculator, against the PUBLISHED
   formulas rather than against itself
   --------------------------------------------------------------------------
   mc-macrocalc.js turns a profile into the calorie and macro targets every
   ring on the Nutrition tab is measured against. It is a number the athlete
   eats to, and until this file existed it was the one calculation in the app
   with NO regression coverage at all: mc-suggest, mc-maxout, mc-strain,
   mc-readiness and mc-log-read each have a suite in verify.yml; the goal
   calculator had none, so a changed multiplier or a flipped sex constant would
   have shipped silently.

   Expected values here are computed from the published formulas, not by calling
   the app's own function and agreeing with it:

     Mifflin-St Jeor   male   BMR = 10*kg + 6.25*cm - 5*age + 5
                       female BMR = 10*kg + 6.25*cm - 5*age - 161
     TDEE              BMR x activity multiplier
     target            TDEE x (1 + goal adjustment), rounded to 10
     split             protein & fat anchored to bodyweight, carbs absorb the
                       remainder, and the three must re-derive the target under
                       Atwater 4/4/9

   Run: node tools/test-mc-macrocalc.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'mc-macrocalc.js');
// The module is a browser IIFE that publishes onto window and has no
// module.exports hook, so load it the way test-mc-bridge.js loads its subject:
// a vm sandbox with a window object, then read the global back off it.
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SRC, 'utf8'), sandbox, { filename: 'mc-macrocalc.js' });
const C = sandbox.window.MCMacroCalc;
if (!C) { console.error('::error::mc-macrocalc.js did not publish window.MCMacroCalc'); process.exit(1); }

let failed = false, checks = 0;
function eq(msg, got, want) {
  checks++;
  if (got === want) return;
  failed = true;
  console.error(`::error::${msg} — got ${got}, expected ${want}`);
}
function near(msg, got, want, tol) {
  checks++;
  if (Math.abs(got - want) <= tol) return;
  failed = true;
  console.error(`::error::${msg} — got ${got}, expected ${want} (+/-${tol})`);
}
function truthy(msg, got) { eq(msg, !!got, true); }

const LB_PER_KG = 2.2046226218;
const msj = (lb, cm, age, sex) =>
  10 * (lb / LB_PER_KG) + 6.25 * cm - 5 * age + (sex === 'female' ? -161 : 5);

// Read the multipliers and goal adjustments off the module's own published
// tables rather than restating them, so this file checks the ARITHMETIC that
// consumes them and stays correct if a label changes. A changed NUMBER still
// fails, because the BMR/target/split expectations below are computed
// independently from the formula.
const MULT = {}; C.ACTIVITY.forEach((a) => { MULT[a.id] = a.mult; });
const GOAL = {}; C.GOALS.forEach((g) => { GOAL[g.id] = g; });

// The published multipliers themselves — these ARE the standard Harris/Mifflin
// activity factors, so pin them: a typo here silently re-prescribes every user.
eq('sedentary multiplier', MULT.sedentary, 1.2);
eq('light multiplier', MULT.light, 1.375);
eq('moderate multiplier', MULT.moderate, 1.55);
eq('very active multiplier', MULT.active, 1.725);
eq('athlete multiplier', MULT.athlete, 1.9);
eq('cut is a 20% deficit', GOAL.cut.adjust, -0.20);
eq('maintain does not adjust', GOAL.maintain.adjust, 0);
eq('bulk is a 15% surplus', GOAL.bulk.adjust, 0.15);
eq('protein rides highest on a cut', GOAL.cut.proteinPerLb > GOAL.bulk.proteinPerLb, true);

const PEOPLE = [
  ['200 lb / 180 cm / 30 y male',   { sex: 'male',   age: 30, heightCm: 180, weightLb: 200 }],
  ['140 lb / 165 cm / 28 y female', { sex: 'female', age: 28, heightCm: 165, weightLb: 140 }],
  ['250 lb / 190 cm / 45 y male',   { sex: 'male',   age: 45, heightCm: 190, weightLb: 250 }],
  ['110 lb / 155 cm / 60 y female', { sex: 'female', age: 60, heightCm: 155, weightLb: 110 }]
];

PEOPLE.forEach(([label, p]) => {
  const want = msj(p.weightLb, p.heightCm, p.age, p.sex);
  near(`BMR matches Mifflin-St Jeor for ${label}`, C.bmr(p), want, 0.51);

  Object.keys(MULT).forEach((act) => {
    near(`TDEE = BMR x ${act} multiplier for ${label}`,
      C.tdee(Object.assign({}, p, { activity: act })), want * MULT[act], 0.51);
  });

  Object.keys(GOAL).forEach((g) => {
    ['sedentary', 'moderate', 'athlete'].forEach((act) => {
      const prof = Object.assign({}, p, { activity: act, goal: g });
      const r = C.recommend(prof);
      const target = Math.round((want * MULT[act] * (1 + GOAL[g].adjust)) / 10) * 10;
      eq(`target kcal for ${label} / ${act} / ${g}`, r.kcal, target);
      eq(`protein is anchored to bodyweight for ${label} / ${g}`,
        r.p, Math.round(p.weightLb * GOAL[g].proteinPerLb));
      eq(`carbs absorb the remainder for ${label} / ${act} / ${g}`,
        r.c, Math.max(0, Math.round((r.kcal - r.p * 4 - r.f * 9) / 4)));
      // Atwater closure: the split must add back up to the target it came from.
      near(`the split re-derives its own calorie target for ${label} / ${act} / ${g}`,
        r.p * 4 + r.f * 9 + r.c * 4, r.kcal, 4);
      // A target nobody can eat to is a bug even when the arithmetic is right.
      truthy(`every macro is a finite, non-negative number for ${label} / ${act} / ${g}`,
        [r.kcal, r.p, r.f, r.c].every((v) => Number.isFinite(v) && v >= 0));
    });
  });

  // Direction: cutting must prescribe fewer calories than bulking.
  const cut = C.recommend(Object.assign({}, p, { activity: 'moderate', goal: 'cut' }));
  const bulk = C.recommend(Object.assign({}, p, { activity: 'moderate', goal: 'bulk' }));
  eq(`a cut prescribes fewer calories than a bulk for ${label}`, cut.kcal < bulk.kcal, true);
});

// Atwater, directly.
eq('kcalFromMacros uses 4/4/9', C.kcalFromMacros(200, 70, 300), 200 * 4 + 300 * 4 + 70 * 9);
const pc = C.macroPercents(200, 70, 300);
near('macro percentages sum to 100', pc.p + pc.f + pc.c, 100, 2);

// ---- boundaries: a real person types nonsense into these fields ------------
eq('zero bodyweight cannot prescribe negative protein', C.splitFromCalories(2000, 0, 'cut').p, 0);
eq('carbs never go negative when protein+fat exceed the target',
  C.splitFromCalories(100, 250, 'cut').c, 0);
[NaN, Infinity, -Infinity, 'abc', null, undefined, {}, -200].forEach((bad) => {
  const r = C.recommend({ sex: 'male', age: 30, heightCm: 180, weightLb: bad, activity: 'moderate', goal: 'cut' });
  truthy(`weightLb=${String(bad)} still yields finite, non-negative targets`,
    [r.kcal, r.p, r.f, r.c].every((v) => Number.isFinite(v) && v >= 0));
});
const unknown = C.recommend({ sex: 'male', age: 30, heightCm: 180, weightLb: 200, activity: 'nope', goal: 'nope' });
truthy('an unknown activity/goal falls back rather than producing NaN',
  Number.isFinite(unknown.kcal) && unknown.kcal > 0);

if (failed) { console.error(`test-mc-macrocalc: FAIL (${checks} checks)`); process.exit(1); }
console.log(`test-mc-macrocalc: pass — ${checks} assertions against the published Mifflin-St Jeor / Atwater formulas`);

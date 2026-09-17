'use strict';
/* ==========================================================================
   cr-indep-math.js — Data Integrity Engineer, independent validation.
   --------------------------------------------------------------------------
   Protocol §0.10 and the MC Training gate both require that critical
   calculations have INDEPENDENT validation. So every expected value below is
   computed here from the PUBLISHED formula, written out longhand, with no
   reference to the app's source. The app's module is then required and asked
   the same question. Where the app deliberately deviates from the textbook
   (Epley's rep cap, the leverage coefficient) that deviation is asserted as a
   SPEC CLAIM in its own right rather than folded into the formula — otherwise
   the test would be validating the app against itself, which is exactly what
   this file exists to avoid.

   Formulas, as published:
     Epley 1RM        1RM = w * (1 + r/30)
     MET energy cost  kcal = MET * body_mass_kg * hours
     Mifflin-St Jeor  BMR(male)   = 10*kg + 6.25*cm - 5*age + 5
                      BMR(female) = 10*kg + 6.25*cm - 5*age - 161
     Atwater factors  protein 4 kcal/g · carbohydrate 4 kcal/g · fat 9 kcal/g
   ========================================================================== */
const path = require('path'); const fs = require('fs'); const vm = require('vm');
const ROOT = path.join(__dirname, '../../..');
/* Some modules are browser IIFEs that touch `window` at parse time and cannot
   be require()d; they load in a vm sandbox and are read back off the fake
   window — the same technique this repo's own committed suites already use. */
function R(file, globalName) {
  if (!globalName) return require(path.join(ROOT, file));
  const sandbox = { window: {}, document: { addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  const g = sandbox.window[globalName];
  if (!g) throw new Error(file + ' did not publish window.' + globalName);
  return g;
}

let pass = 0, fail = 0; const failures = [];
function eq(label, got, want, tol = 0) {
  const ok = (typeof want === 'number' && typeof got === 'number')
    ? Math.abs(got - want) <= tol : JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; failures.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}${tol ? ' ±' + tol : ''}`); }
}

/* ---------- 1. Epley ---------------------------------------------------- */
const LOG = R('mc-log-read.js');
const LB_PER_KG = 2.20462;

// Textbook Epley, written here from the formula, not read from the app.
const epley = (w, r) => w * (1 + r / 30);

// Barbell: no equipment coefficient applies, so inside the rep cap the app
// must equal rounded textbook Epley exactly.
for (const [w, r] of [[135, 1], [225, 3], [315, 5], [185, 8], [95, 10], [405, 2], [225, 12]]) {
  eq(`epley barbell ${w}x${r}`, LOG.e1rm(w, r, 'Barbell Bench Press'), Math.round(epley(w, r)));
}
// The documented deviation: reps above 12 are evaluated AT 12, because Epley
// is not fitted above roughly a dozen reps. Asserted as a spec claim.
eq('epley rep cap is 12', LOG.EPLEY_REP_CAP, 12);
for (const r of [13, 15, 20, 25, 40]) {
  eq(`epley cap barbell 100x${r}`, LOG.e1rm(100, r, 'Barbell Bench Press'), Math.round(epley(100, 12)));
}
// Without a cap a 25-rep set would claim +83%; with it, +40%. Both stated.
eq('uncapped 25-rep claim would be', Math.round(epley(100, 25)), 183);
// The leverage discount: 0.85 on Cable/Machine/Plate-Loaded only.
const capped = (w, r) => Math.round(w * (1 + Math.min(r, 12) / 30));
eq('cable discounted', LOG.e1rm(100, 10, 'Cable Tricep Pushdown'), Math.round(capped(100, 10) * 0.85));
eq('machine discounted', LOG.e1rm(200, 8, 'Leg Press Machine'), Math.round(capped(200, 8) * 0.85));
eq('dumbbell NOT discounted', LOG.e1rm(60, 10, 'Incline DB Press'), capped(60, 10));
// Boundary hardening (audit L-05): no negative or absurd max from bad input.
for (const [w, r, want] of [[0, 5, 0], [-100, 5, 0], [100, 0, Math.round(epley(100, 1))],
                            [100, -3, Math.round(epley(100, 1))], [NaN, 5, 0], [100, NaN, Math.round(epley(100, 1))]]) {
  eq(`epley guard ${w}x${r}`, LOG.e1rm(w, r, 'Barbell Bench Press'), want);
}

/* ---------- 2. Session energy cost (MET) -------------------------------- */
const STRAIN = R('mc-strain.js');
// Independent MET model, from the file's own DOCUMENTED rule (5.0 baseline,
// +1 per 25 lb/min, +0.75 for 2+ near-failure sets, clamped 3.5-9.0) — this
// is a spec-conformance check; the kcal identity below is the formula check.
function indepMET(tonnage, min, nearFail) {
  let met = 5.0 + (min > 0 ? tonnage / min : 0) / 25;
  if (nearFail >= 2) met += 0.75;
  return Math.max(3.5, Math.min(9.0, met));
}
function indepKcal(tonnage, min, nearFail, bwLb) {
  if (!min || !tonnage) return 0;
  return Math.round(indepMET(tonnage, min, nearFail) * (bwLb / LB_PER_KG) * (min / 60));
}
/* The store's own set shape is {weight, reps} — verified against mc-strain.js's
   sessionTonnage reader, not assumed from the input element class names. */
const mkSets = (n, weight, reps, rpe) => Array.from({ length: n }, () => ({ weight, reps, rpe, done: true }));
const CASES = [
  { lbl: 'moderate day', sets: mkSets(20, 135, 8), min: 60, bw: 200 },
  { lbl: 'heavy low-vol', sets: mkSets(6, 405, 3), min: 50, bw: 200 },
  { lbl: 'near-failure',  sets: mkSets(10, 185, 10, 'F'), min: 45, bw: 180 },
  { lbl: 'tiny session',  sets: mkSets(1, 45, 5), min: 5, bw: 150 },
];
for (const c of CASES) {
  const tonnage = c.sets.reduce((a, s) => a + s.weight * s.reps, 0);
  const nf = c.sets.filter(s => s.rpe === 'F' || parseFloat(s.rpe) >= 9.5).length;
  const got = STRAIN.session({ sets: c.sets, duration: c.min + ' min' }, c.bw);
  eq(`strain tonnage ${c.lbl}`, got.tonnage, tonnage);
  eq(`strain kcal ${c.lbl}`, got.kcal, indepKcal(tonnage, c.min, nf, c.bw), 1);
}
// A session with zero tonnage or zero duration must cost zero, not NaN.
eq('zero-tonnage kcal', STRAIN.session({ sets: [], duration: '60 min' }, 200).kcal, 0);
eq('zero-duration kcal', STRAIN.session({ sets: mkSets(5, 100, 10), duration: '' }, 200).kcal, 0);

/* ---------- 3. Mifflin-St Jeor + Atwater --------------------------------- */
const MACRO = R('mc-macrocalc.js', 'MCMacroCalc');
const KG = lb => lb / LB_PER_KG;
const msjMale   = (kg, cm, age) => 10 * kg + 6.25 * cm - 5 * age + 5;
const msjFemale = (kg, cm, age) => 10 * kg + 6.25 * cm - 5 * age - 161;
for (const [lb, cm, age, sex] of [[200, 178, 30, 'male'], [140, 163, 28, 'female'],
                                  [180, 183, 45, 'male'], [120, 152, 22, 'female']]) {
  const want = (sex === 'male' ? msjMale : msjFemale)(KG(lb), cm, age);
  const got = MACRO.bmr({ weightLb: lb, heightCm: cm, age, sex });
  eq(`Mifflin-St Jeor ${sex} ${lb}lb/${cm}cm/${age}y`, got, want, 0.5);
}
/* The negative-input floor the module documents (meas()): a pasted "-200"
   must not reach the arithmetic. Asserted independently of the fix's code. */
eq('BMR floors negative weight', MACRO.bmr({ weightLb: -200, heightCm: 178, age: 30, sex: 'male' }),
   msjMale(0, 178, 30), 0.5);
eq('BMR floors negative height', MACRO.bmr({ weightLb: 200, heightCm: -178, age: 30, sex: 'male' }),
   msjMale(KG(200), 0, 30), 0.5);
eq('BMR never returns non-finite',
   [[-1,-1,-1],[0,0,0],[1e9,1e9,1e9]].every(([w,h,a]) => isFinite(MACRO.bmr({weightLb:w,heightCm:h,age:a,sex:'male'}))), true);
// Atwater: the kcal a macro split represents must equal 4P + 4C + 9F exactly.
for (const [p, f, c] of [[180, 70, 250], [0, 0, 0], [200, 60, 300], [1, 1, 1]]) {
  eq(`Atwater ${p}p/${f}f/${c}c`, MACRO.kcalFromMacros(p, f, c), p * 4 + c * 4 + f * 9);
}
// Percentages must sum to ~100 and never divide by zero.
const pc = MACRO.macroPercents(180, 70, 250);
eq('macro percents sum ~100', Math.abs(pc.p + pc.f + pc.c - 100) <= 1, true);
eq('macro percents on all-zero do not NaN',
   Object.values(MACRO.macroPercents(0, 0, 0)).every(v => isFinite(v)), true);

/* ---------- report ------------------------------------------------------- */
console.log(`cr-indep-math — ${pass + fail} independent assertions`);
console.log(`  PASS ${pass}   FAIL ${fail}`);
if (fail) { console.log('\nFAILURES:'); failures.forEach(f => console.log('  ' + f)); process.exitCode = 1; }

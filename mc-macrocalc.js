/* ==========================================================================
   mc-macrocalc.js — macro calculator engine (pure math, no DOM)
   --------------------------------------------------------------------------
   The "engine" behind the Nutrition tab's goal-setting. Given a profile
   (sex / age / height / weight / activity / goal) it suggests a daily calorie
   target and a protein/fat/carb split. The UI (mc-macros.js) takes these
   suggestions and lets the user tune them with increase/decrease bars — so
   this file only owns the numbers, never the rendering.

   Chain (standard sports-nutrition arithmetic):
     1. BMR  — Mifflin-St Jeor (height/weight/age/sex)
     2. TDEE — BMR × activity factor
     3. goal — surplus (+%) / maintenance (0) / deficit (−%)
     4. split — protein & fat anchored to bodyweight, carbs fill the remainder

   Exposed as window.MCMacroCalc. All inputs are plain numbers; weight is in
   POUNDS and height in CENTIMETRES (the profile's stored units). Nothing here
   touches localStorage or the DOM, so it's trivially testable.
   ========================================================================== */
(function () {
  if (window.MCMacroCalc) return;

  var LB_PER_KG = 2.2046226218;

  // Activity multipliers applied to BMR to get TDEE.
  var ACTIVITY = [
    { id: 'sedentary', label: 'Sedentary', sub: 'Desk job, little exercise', mult: 1.2 },
    { id: 'light',     label: 'Light',     sub: 'Train 1–3 days/week',       mult: 1.375 },
    { id: 'moderate',  label: 'Moderate',  sub: 'Train 3–5 days/week',       mult: 1.55 },
    { id: 'active',    label: 'Very active', sub: 'Train 6–7 days/week',      mult: 1.725 },
    { id: 'athlete',   label: 'Athlete',   sub: 'Hard daily training / job', mult: 1.9 }
  ];

  // Goal calorie adjustment (fraction of TDEE) + the protein anchor (g per lb
  // of bodyweight). Protein rides higher on a cut to protect muscle.
  var GOALS = [
    { id: 'cut',      label: 'Cut',         sub: 'Lose fat (deficit)',    adjust: -0.20, proteinPerLb: 1.10 },
    { id: 'maintain', label: 'Maintain',    sub: 'Hold steady',           adjust:  0.00, proteinPerLb: 1.00 },
    { id: 'bulk',     label: 'Bulk',        sub: 'Build muscle (surplus)', adjust:  0.15, proteinPerLb: 0.90 }
  ];

  var FAT_PER_LB = 0.35;   // fat grams per lb of bodyweight (≈25–30% of kcal)

  function lookup(list, id, fallback) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return fallback || list[0];
  }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }

  // ---- step 1: BMR (Mifflin-St Jeor) --------------------------------------
  // weightLb → kg internally. sex 'female' subtracts the constant.
  function bmr(profile) {
    var kg = num(profile.weightLb) / LB_PER_KG;
    var cm = num(profile.heightCm);
    var age = num(profile.age);
    var base = 10 * kg + 6.25 * cm - 5 * age;
    return (profile.sex === 'female') ? (base - 161) : (base + 5);
  }

  // ---- step 2: TDEE -------------------------------------------------------
  function tdee(profile) {
    return bmr(profile) * lookup(ACTIVITY, profile.activity).mult;
  }

  // ---- step 4: split from a calorie target --------------------------------
  // Protein & fat anchored to bodyweight; carbs absorb whatever calories are
  // left (never negative). Rounded to whole grams.
  function splitFromCalories(kcal, weightLb, goalId) {
    var goal = lookup(GOALS, goalId);
    var lb = num(weightLb);
    var p = Math.round(lb * goal.proteinPerLb);
    var f = Math.round(lb * FAT_PER_LB);
    var carbKcal = num(kcal) - (p * 4) - (f * 9);
    var c = Math.max(0, Math.round(carbKcal / 4));
    return { p: p, f: f, c: c };
  }

  // ---- step 3+4 combined: full recommendation -----------------------------
  function recommend(profile) {
    var b = bmr(profile);
    var t = b * lookup(ACTIVITY, profile.activity).mult;
    var goal = lookup(GOALS, profile.goal);
    var kcal = Math.round((t * (1 + goal.adjust)) / 10) * 10;   // round to 10
    var split = splitFromCalories(kcal, profile.weightLb, profile.goal);
    return {
      bmr: Math.round(b),
      tdee: Math.round(t),
      kcal: kcal,
      p: split.p, f: split.f, c: split.c
    };
  }

  // calories implied by a macro set (Atwater 4/4/9). Used when the user drags
  // the per-macro bars so the calorie readout stays consistent.
  function kcalFromMacros(p, f, c) {
    return Math.round(num(p) * 4 + num(c) * 4 + num(f) * 9);
  }

  // percentage of total calories from each macro (for the bar labels)
  function macroPercents(p, f, c) {
    var total = kcalFromMacros(p, f, c) || 1;
    return {
      p: Math.round((num(p) * 4 / total) * 100),
      f: Math.round((num(f) * 9 / total) * 100),
      c: Math.round((num(c) * 4 / total) * 100)
    };
  }

  window.MCMacroCalc = {
    ACTIVITY: ACTIVITY,
    GOALS: GOALS,
    LB_PER_KG: LB_PER_KG,
    bmr: bmr,
    tdee: tdee,
    recommend: recommend,
    splitFromCalories: splitFromCalories,
    kcalFromMacros: kcalFromMacros,
    macroPercents: macroPercents
  };
})();

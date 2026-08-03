/* ==========================================================================
   mc-strain.js — session energy expenditure + daily strain score
   --------------------------------------------------------------------------
   CI initiative roadmap, Phase 2 / Initiative 01. Reads mc_workout_log_v1
   (finished sessions) and mc_body_v1 (bodyweight) to compute, for a real
   trainee day:

     • Session/day kcal expenditure — MET-based estimate:
         kcal = MET × bodyweight_kg × duration_hours
       MET (metabolic equivalent) starts from a moderate-resistance-training
       baseline (5.0) and is scaled by the session's tonnage RATE (lb/min —
       how much weight actually moved per minute, not just how long the
       trainee was in the gym) and nudged up further when the session ran
       genuinely close to failure (2+ sets logged at RPE >= 9.5/F — the same
       near-max threshold mc-suggest.js's classifySession() already uses for
       'hold'). This is a hardcoded-multiplier estimate in the same spirit as
       mc-suggest.js's equipment-increment table and mc-maxout.js's Epley
       coefficients — directionally correct, not a clinical measurement.

     • Daily strain — a 0-21 score (WHOOP-style scale, same idea: a bounded,
       saturating readout of "how hard was today," not a raw number that
       keeps climbing). Self-referential on purpose: today's kcal load is
       compared against the trainee's OWN trailing-28-day mean load, not a
       population norm, via a saturating exponential curve
       (21 × (1 - e^-ratio)) so an exactly-average day reads ~13, a brutal
       2x-average day reads ~18, and no single day can ever hit the ceiling.
       Needs at least 3 prior sessions in the trailing 28 days to have a
       baseline worth comparing against — before that, strain is null rather
       than a fabricated number (mc-suggest.js's plateau detection and
       mc-body.js's trend7d follow the same "no history, no number" rule).

   window.MC_STRAIN.session(entry) — {kcal, tonnage} for one raw
     mc_workout_log_v1 entry. Pure function, no storage reads — same
     convention as mc-suggest.js's classifySession().
   window.MC_STRAIN.today() — {kcal, strain} aggregated across every
     session logged today (a two-a-day is one strain day, not two, matching
     how the real metric this is modeled on works). null-safe fields when
     there's no session today / no baseline yet.
   window.MC_STRAIN.trailing(n) — last n finished sessions, oldest→newest,
     each as {date, kcal, strain}, for a future sparkline — strain per
     entry uses the baseline as of THAT session's own date, not today's.
   window.MC_STRAIN.proteinTarget(bodyweightLb?) — recommended post-workout
     SINGLE-FEEDING protein grams (not a daily total), from bodyweight ×
     a per-meal-MPS-threshold multiplier plus a bonus scaled by today's
     strain, clamped to a plausible per-meal range. See Phase 3 / Initiative
     03 ("The Refuel Handoff") below for the full rationale.

   mc-macros.js (train-day calorie bonus) and mc-bridge.js (today()'s
   expenditure/strain fields, consumed by the cookbook) both read this.
   mc-finish.js's Refuel row (Phase 3 / Initiative 03) reads proteinTarget().
   ========================================================================== */
(function () {
  var isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    if (window.MC_STRAIN) return;
  }

  var WL_KEY = 'mc_workout_log_v1';
  var BODY_KEY = 'mc_body_v1';
  var DAY = 24 * 3600 * 1000;
  var LB_PER_KG = 2.20462;
  var DEFAULT_BODYWEIGHT_LB = 180; // matches mc-macros.js's calculator placeholder default

  var BASELINE_LOOKBACK_DAYS = 28;
  var BASELINE_MIN_SESSIONS = 3; // fewer than this and there's nothing real to self-reference against
  var STRAIN_MAX = 21;

  // Post-workout refuel target (Phase 3 / Initiative 03 — "The Refuel
  // Handoff"): a SINGLE-FEEDING protein number, not a daily total. 0.18 g/lb
  // sits at the high end of the widely-cited 0.25-0.4 g/kg (~0.11-0.18 g/lb)
  // per-meal threshold for maximal muscle protein synthesis, since this is
  // the day's biggest feeding, not a snack. Scaled up further on harder days
  // (today's 0-21 strain, same self-referential score as above) since more
  // total muscle protein breakdown needs more to resynthesize — up to +15 g
  // on the hardest days. Same hardcoded-multiplier philosophy as
  // mc-suggest.js's equipment increments and this file's own MET table:
  // directionally correct, not a clinical macro prescription.
  var PROTEIN_G_PER_LB = 0.18;
  var PROTEIN_STRAIN_BONUS_MAX_G = 15;
  var PROTEIN_MIN_G = 20; // below the per-meal MPS threshold, not worth targeting
  var PROTEIN_MAX_G = 60; // past this a single feeding stops mattering more; spread it out instead

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch (e) { return fallback; }
  }

  function workoutLog() { return readJSON(WL_KEY, []); }

  // Latest logged bodyweight, same store/shape mc-macros.js's own
  // latestWeightLb() reads — duplicated rather than imported so this module
  // has no load-order dependency on mc-macros.js (it's the other way around).
  function latestBodyweightLb() {
    var a = readJSON(BODY_KEY, []);
    for (var i = 0; i < a.length; i++) {
      var w = parseFloat(a[i] && a[i].w);
      if (w > 0) return w;
    }
    return DEFAULT_BODYWEIGHT_LB;
  }

  function parseDurationMin(entry) {
    var m = /(\d+)/.exec(String(entry && entry.duration || ''));
    if (m) return Math.max(1, parseInt(m[1], 10));
    return entry && /<\s*1\s*min/i.test(entry.duration || '') ? 1 : 0;
  }

  function sessionTonnage(sets) {
    var t = 0;
    (sets || []).forEach(function (s) {
      var w = parseFloat(s.weight) || 0, r = parseInt(s.reps, 10) || 0;
      t += w * r;
    });
    return t;
  }

  function nearFailureSetCount(sets) {
    return (sets || []).filter(function (s) {
      return s.rpe === 'F' || parseFloat(s.rpe) >= 9.5;
    }).length;
  }

  // MET scaling: 5.0 baseline, +1 MET per 25 lb/min of tonnage rate (a brisk
  // pyramid/superset day runs meaningfully hotter than a slow heavy-single
  // day of the same duration), +0.75 MET when 2+ sets ran near failure,
  // clamped to a plausible resistance-training band (3.5-9.0) so a single
  // outlier session can't produce an absurd kcal figure.
  function sessionMET(tonnage, durationMin, sets) {
    var rate = durationMin > 0 ? tonnage / durationMin : 0;
    var met = 5.0 + rate / 25;
    if (nearFailureSetCount(sets) >= 2) met += 0.75;
    return Math.max(3.5, Math.min(9.0, met));
  }

  // {kcal, tonnage} for one raw mc_workout_log_v1 entry. Pure — takes the
  // entry and (optionally) a bodyweight override so callers building a
  // trailing series don't re-read localStorage per session.
  function session(entry, bodyweightLb) {
    if (!entry) return { kcal: 0, tonnage: 0 };
    var durationMin = parseDurationMin(entry);
    var tonnage = sessionTonnage(entry.sets);
    if (!durationMin || !tonnage) return { kcal: 0, tonnage: tonnage };
    var bw = bodyweightLb || latestBodyweightLb();
    var met = sessionMET(tonnage, durationMin, entry.sets);
    var kcal = met * (bw / LB_PER_KG) * (durationMin / 60);
    return { kcal: Math.round(kcal), tonnage: tonnage };
  }

  function dayKey(d) {
    d = d ? new Date(d) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Every finished entry for one calendar day, summed into one {kcal} —
  // matches how the real metric this is modeled on treats a two-a-day as a
  // single strain day, not two separate readings.
  function dayLoad(log, key, bodyweightLb) {
    var kcal = 0, any = false;
    log.forEach(function (e) {
      if (!e || !e.date || dayKey(e.date) !== key) return;
      any = true;
      kcal += session(e, bodyweightLb).kcal;
    });
    return any ? kcal : null;
  }

  // Mean daily kcal load over the trailing window, EXCLUDING the day being
  // scored (a day can't be its own baseline). Returns null under the
  // minimum-sessions floor.
  function baselineMean(log, excludeKey, asOfMs, bodyweightLb) {
    var cutoff = asOfMs - BASELINE_LOOKBACK_DAYS * DAY;
    var byDay = {};
    log.forEach(function (e) {
      if (!e || !e.date) return;
      var t = +new Date(e.date);
      if (isNaN(t) || t < cutoff || t >= asOfMs) return;
      var k = dayKey(e.date);
      if (k === excludeKey) return;
      byDay[k] = (byDay[k] || 0) + session(e, bodyweightLb).kcal;
    });
    var days = Object.keys(byDay);
    if (days.length < BASELINE_MIN_SESSIONS) return null;
    var sum = days.reduce(function (s, k) { return s + byDay[k]; }, 0);
    return sum / days.length;
  }

  // Saturating exponential: ratio=1 (an exactly average day) -> ~13.3,
  // ratio=2 -> ~18.2, ratio=3 -> ~20.0 — climbs fast off zero, flattens hard
  // approaching the 21 ceiling, and can never reach or exceed it.
  function strainFromRatio(ratio) {
    var raw = STRAIN_MAX * (1 - Math.exp(-ratio));
    return Math.round(Math.max(0, Math.min(STRAIN_MAX, raw)) * 10) / 10;
  }

  function today() {
    var log = workoutLog();
    var bw = latestBodyweightLb();
    var key = dayKey();
    var kcal = dayLoad(log, key, bw);
    if (kcal == null) return { kcal: 0, strain: null };
    var baseline = baselineMean(log, key, Date.now(), bw);
    var strain = baseline ? strainFromRatio(kcal / baseline) : null;
    return { kcal: kcal, strain: strain };
  }

  // Last n finished sessions (by mc_workout_log_v1's stored order, newest
  // first), oldest -> newest, each scored against the baseline as of that
  // session's own date — so a sparkline reads as "how hard for THAT day,"
  // not distorted by today's baseline.
  function trailing(n) {
    var log = workoutLog();
    var bw = latestBodyweightLb();
    var slice = log.slice(0, n || 7).slice().reverse();
    return slice.map(function (e) {
      var s = session(e, bw);
      var key = dayKey(e.date);
      var baseline = baselineMean(log, key, +new Date(e.date), bw);
      return {
        date: e.date,
        kcal: s.kcal,
        strain: baseline ? strainFromRatio(s.kcal / baseline) : null
      };
    });
  }

  // Recommended post-workout single-feeding protein target, in grams,
  // rounded to the nearest 5 (a gym-floor-friendly number, same rounding
  // spirit as mc-suggest.js's weight increments). Pure over its inputs — a
  // bodyweight override skips the localStorage read for callers (mc-finish.js)
  // that already have it, matching session()'s own convention.
  function proteinTarget(bodyweightLb) {
    var bw = bodyweightLb || latestBodyweightLb();
    var strain = today().strain;
    var base = bw * PROTEIN_G_PER_LB;
    var bonus = strain != null ? (strain / STRAIN_MAX) * PROTEIN_STRAIN_BONUS_MAX_G : 0;
    var clamped = Math.max(PROTEIN_MIN_G, Math.min(PROTEIN_MAX_G, base + bonus));
    return Math.round(clamped / 5) * 5;
  }

  var API = { session: session, today: today, trailing: trailing, proteinTarget: proteinTarget };
  if (isBrowser) window.MC_STRAIN = API;

  // Node-side hook so CI can regression-test the real kcal/strain math (see
  // tools/test-mc-strain.js), same convention as mc-suggest.js.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})();

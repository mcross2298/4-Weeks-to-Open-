/* ==========================================================================
   mc-bridge.js  —  shared cross-app READ layer (cookbook ↔ workout)
   --------------------------------------------------------------------------
   Roadmap B0. A deployment-agnostic, READ-ONLY view over the data the two apps
   share. It only ever reads localStorage — it never writes, and it is
   IDENTICAL in both repos (4-Weeks-to-Open- and Mikes-Cookbook), the same way
   the nutrition modules are kept in lock-step. Edit one, copy to the other.

   How the data gets here differs by deployment shape, but this module doesn't
   care — it just reads whatever keys are present:
     • Standalone PWAs (two origins): each app's mc-sync.js PULLS the other
       app's stores read-only from the shared Supabase user_sync table into
       local localStorage. Signed out, the cross-app keys simply aren't there
       and every getter degrades to an empty/neutral result.
     • Rolodex market mount (same origin): the cookbook lives under ./cookbook/
       alongside the workout app, so both apps' keys are already local.

   Keys it reads (see cookbook-bridge-roadmap.md for the ownership contract):
     mc-cookbook:mealplan   — cookbook-owned; today's planned meals
     mc_activity            — workout-owned; trained-today / streak / last
     mc_workout_log_v1      — workout-owned; finished sessions (recap)
     mc_macros_v1           — shared; goals -> per-day macro TARGETS

   Recipe titles/macros only resolve where recipes-data.js is loaded (the
   cookbook). Off-cookbook (e.g. the workout dashboard) meals come back as bare
   references {recipeId, serving, slot} with title/macros null — the consumer
   decides how to render that. Consumers MUST escape any string before
   inserting it via innerHTML; this module returns data, not markup.
   ========================================================================== */
(function () {
  "use strict";
  if (window.MCBridge) return;

  var MEALPLAN_KEY = 'mc-cookbook:mealplan';
  var ACT_KEY      = 'mc_activity';
  var WLOG_KEY     = 'mc_workout_log_v1';
  var MACROS_KEY   = 'mc_macros_v1';
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // == cookbook-home.js

  function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function todayCode() { return DAYS[(new Date().getDay() + 6) % 7]; } // JS getDay(): Sun=0..Sat=6

  // Recipe metadata is only available where recipes-data.js is loaded.
  function recipeMeta(id) {
    var R = window.RECIPES;
    if (!Array.isArray(R)) return null;
    for (var i = 0; i < R.length; i++) if (R[i] && R[i].recipe_id === id) return R[i];
    return null;
  }
  // macro_profiles are per single serving and identical across authored tiers,
  // so the first present tier is representative.
  // recipes-data.js's macro_profiles fields are calories/protein_g/fat_g/carbs_g
  // (see Mikes-Cookbook/recipes-data.js) — normalized here to {kcal,p,f,c}, the
  // shape mc_macros_v1 entries already use natively, so a caller can pass this
  // straight into an addEntry() `per:` field with no further translation. This
  // mirrors the normalization cookbook-home.js's mealSnapshot() does when it
  // denormalizes macros directly onto a meal entry (the primary path); this is
  // only the fallback for legacy entries that predate that snapshot.
  function perServingMacros(r) {
    if (!r || !r.macro_profiles) return null;
    var m = null;
    for (var k in r.macro_profiles) if (r.macro_profiles[k]) { m = r.macro_profiles[k]; break; }
    return m ? { kcal: m.calories || 0, p: m.protein_g || 0, f: m.fat_g || 0, c: m.carbs_g || 0 } : null;
  }

  // consecutive-day streak counting back from today; matches mc-live-tracker.js.
  function streakFrom(days) {
    if (!days) return 0;
    var cur = new Date(), n = 0;
    if (!days[dayKey(cur)]) cur.setDate(cur.getDate() - 1); // today not logged yet: don't break it
    while (days[dayKey(cur)]) { n++; cur.setDate(cur.getDate() - 1); }
    return n;
  }
  function weekStartMs() {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
    return d.getTime();
  }

  // Historical per-weekday training pattern (roadmap B2) — NOT a predicted
  // future schedule (neither app tracks one); the trainee's own established
  // rhythm from real finished-workout dates over a trailing window. Powers
  // Smart Week's day-aware meal bias without inventing certainty the data
  // doesn't have. Returns {} (no pattern) until enough real history exists.
  var TRAIN_PATTERN_LOOKBACK_DAYS = 56; // ~8 weeks
  var TRAIN_PATTERN_MIN_SESSIONS = 3;   // trained that weekday on ~half the weeks in the window
  function likelyTrainingDays() {
    var log = read(WLOG_KEY);
    if (!Array.isArray(log)) return {};
    var cutoff = Date.now() - TRAIN_PATTERN_LOOKBACK_DAYS * 86400000;
    var counts = {};
    log.forEach(function (e) {
      if (!e || !e.date) return;
      var t = +new Date(e.date);
      if (isNaN(t) || t < cutoff) return;
      var code = DAYS[(new Date(t).getDay() + 6) % 7];
      counts[code] = (counts[code] || 0) + 1;
    });
    var out = {};
    DAYS.forEach(function (code) { out[code] = (counts[code] || 0) >= TRAIN_PATTERN_MIN_SESSIONS; });
    return out;
  }

  // ---- public reads (all safe when signed out / data absent) ---------------

  // Today's planned meals (cookbook meal plan), scoped to today's weekday code.
  // Meals with day === null are unscheduled and excluded from "today".
  //
  // The cookbook denormalizes {title,icon,macros} directly onto each meal
  // entry when it's added (see cookbook-home.js's mealSnapshot()) — that
  // snapshot is what makes rendering possible here on the workout side, which
  // never loads recipes-data.js and so has no other way to resolve a bare
  // recipe id. Prefer the snapshot; fall back to a live window.RECIPES lookup
  // (used on the cookbook itself, and for any pre-snapshot legacy entries).
  function todaysMeals() {
    var plan = read(MEALPLAN_KEY);
    var meals = (plan && Array.isArray(plan.meals)) ? plan.meals : [];
    var code = todayCode();
    return meals.filter(function (m) { return m && m.day === code; }).map(function (m) {
      var r = recipeMeta(m.id);
      return {
        uid: m.uid, recipeId: m.id, serving: m.serving || null,
        slot: m.slot || null, completed: !!m.completed,
        title: m.title || (r ? r.title : null),
        icon: m.icon || (r ? r.icon : null),
        macros: m.macros || (r ? perServingMacros(r) : null) // per single serving
      };
    });
  }

  // Today's workout state, from the workout app's activity ping.
  function todaysWorkout() {
    var a = read(ACT_KEY) || {};
    var days = a.days || {}, last = a.last || null;
    return {
      trainedToday: !!days[dayKey()],
      streak: streakFrom(days),
      last: last ? { pageId: last.pageId, title: last.title, done: last.done, total: last.total, ts: last.ts } : null
    };
  }

  // Per-day macro TARGETS. These live in the SHARED tracker store's goals,
  // not in any workout-only store — both apps already write mc_macros_v1.
  function macroTargets() {
    var m = read(MACROS_KEY), g = m && m.goals;
    if (!g) return null;
    return { kcal: g.kcal || null, protein: g.p || null, fat: g.f || null, carbs: g.c || null };
  }

  // Recent finished workouts (newest-first), for the fused weekly recap.
  function recentWorkouts(limit) {
    var log = read(WLOG_KEY);
    if (!Array.isArray(log)) return [];
    return log.slice(0, limit || 7).map(function (e) {
      return { id: e.id, pageId: e.pageId, name: e.workoutName, date: e.date, prs: e.prs || 0, duration: e.duration || null };
    });
  }

  // Count of finished workouts since a cutoff (Date/ISO/ms; default: this week).
  function workoutsSince(since) {
    var log = read(WLOG_KEY);
    if (!Array.isArray(log)) return 0;
    var cut = since != null ? +new Date(since) : weekStartMs();
    return log.filter(function (e) { return e && +new Date(e.date) >= cut; }).length;
  }

  // Rolled-up activity for a training-aware planner / recap (B2).
  function recentActivity() {
    var w = todaysWorkout();
    return {
      trainedToday: w.trainedToday,
      streak: w.streak,
      workoutsThisWeek: workoutsSince(),
      recentWorkouts: recentWorkouts(7)
    };
  }

  // One call for a unified "Today" strip (B3).
  function today() {
    return { meals: todaysMeals(), workout: todaysWorkout(), targets: macroTargets() };
  }

  window.MCBridge = {
    todaysMeals: todaysMeals,
    todaysWorkout: todaysWorkout,
    macroTargets: macroTargets,
    recentWorkouts: recentWorkouts,
    workoutsSince: workoutsSince,
    recentActivity: recentActivity,
    likelyTrainingDays: likelyTrainingDays,
    today: today,
    _todayCode: todayCode // exposed for tests
  };
})();

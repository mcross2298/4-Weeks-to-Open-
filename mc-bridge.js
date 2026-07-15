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
  function perServingMacros(r) {
    if (!r || !r.macro_profiles) return null;
    for (var k in r.macro_profiles) if (r.macro_profiles[k]) return r.macro_profiles[k];
    return null;
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
    today: today,
    _todayCode: todayCode // exposed for tests
  };
})();

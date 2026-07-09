/* ==========================================================================
   mc-quick-pump.js — "Quick Pump" 30/45-min smart workout generator.
   --------------------------------------------------------------------------
   Two modes:
     generate({minutes, muscles})   — cross-program variety: builds a fresh
       session from the full 577-exercise catalog (exercise-catalog.js),
       sized to the time budget.
     abbreviateCurrentPage(minutes) — trims the workout page you're already
       on down to fit the time budget (station-anchored .ss-card pairs move
       together; no persisted "my current program" concept exists in this
       app, so this only makes sense from inside a live workout page).

   Both modes emit the exact object shape build-workout.html's
   createWorkout() already produces, and save into the SAME
   mc_custom_workouts_v1 store — so run-workout.html (the existing custom-
   workout runner) plays the result with zero new runner code, and the
   generated session shows up in "My Custom Workouts" / Bonus Workouts like
   any hand-built one.

   Time-budget heuristic (pump pace — higher rep, shorter rest than a
   strength day): a standalone exercise costs ~5 min (3 sets), a
   station-anchored superset pair costs ~8 min for both lifts combined.
   One standalone "anchor" compound, then as many pairs as fit.
   ========================================================================== */
(function () {
  if (window.MCQuickPump) return;

  var CW_KEY = 'mc_custom_workouts_v1';
  var OVERHEAD_MIN = 5;
  var MIN_PER_SINGLE = 5;
  var MIN_PER_PAIR = 8;

  var MUSCLE_GROUPS = {
    'Full Body': ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs - Quads', 'Legs - Hamstrings', 'Core'],
    'Push': ['Chest', 'Shoulders', 'Triceps'],
    'Pull': ['Back', 'Biceps', 'Forearms'],
    'Legs': ['Legs - Quads', 'Legs - Hamstrings', 'Legs - Glutes', 'Calves', 'Adductors'],
    'Core': ['Core']
  };

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---- history-aware selection (Phase 2.4) ---------------------------------
  // Catalog lookup by exercise name — the same technique mc-suggest.js's
  // equipCat() uses. Reading e.muscle here (not a separate classifier) keeps
  // this in the exact taxonomy MUSCLE_GROUPS already keys on, so nothing
  // needs reconciling against mc-recap.js/mc-stats.js's different muscle
  // grouping or mc-setlog.js's own classifier.
  function catalogEntry(name) {
    if (!window.EXERCISES) return null;
    var nl = (name || '').toLowerCase();
    for (var i = 0; i < window.EXERCISES.length; i++) {
      if (window.EXERCISES[i].name.toLowerCase() === nl) return window.EXERCISES[i];
    }
    return null;
  }

  function workoutLog() {
    try { return JSON.parse(localStorage.getItem('mc_workout_log_v1') || '[]') || []; }
    catch (e) { return []; }
  }

  // Muscles trained within the trailing `hours` — a set is over the whole
  // window's real logs, not just today, so a Monday/Wednesday split still
  // gets it right.
  function recentlyTrainedMuscles(hours) {
    var cutoff = Date.now() - (hours || 48) * 3600 * 1000;
    var trained = {};
    workoutLog().forEach(function (e) {
      if (new Date(e.date || 0).getTime() < cutoff) return;
      (e.sets || []).forEach(function (s) {
        var cat = catalogEntry(s.name);
        if (cat && cat.muscle) trained[cat.muscle] = true;
      });
    });
    return trained;
  }

  // Sets logged per muscle over the trailing 7 days — for biasing a Full
  // Body pump toward whatever's seen the least volume this week, instead of
  // uniformly random across every muscle the focus spans.
  function weeklySetsByMuscle() {
    var cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    var counts = {};
    workoutLog().forEach(function (e) {
      if (new Date(e.date || 0).getTime() < cutoff) return;
      (e.sets || []).forEach(function (s) {
        var cat = catalogEntry(s.name);
        if (cat && cat.muscle) counts[cat.muscle] = (counts[cat.muscle] || 0) + 1;
      });
    });
    return counts;
  }

  // Bias away from muscles trained <48h — prefer candidates whose muscle
  // wasn't recently hit, but never narrow the pool so far a workout can't be
  // built (a Push day still needs chest+shoulders+triceps even if one of
  // those was trained yesterday).
  function preferFresh(candidates, recent) {
    if (!Object.keys(recent).length) return candidates;
    var fresh = candidates.filter(function (e) { return !recent[e.muscle]; });
    return fresh.length >= 4 ? fresh : candidates;
  }

  // Full Body spans several muscle groups — bias toward whichever have seen
  // the least volume this week, so a "just give me a workout" pump fills
  // gaps instead of reinforcing whatever's already been trained most.
  function balanceFullBody(candidates, muscleList) {
    var counts = weeklySetsByMuscle();
    var sorted = muscleList.slice().sort(function (a, b) { return (counts[a] || 0) - (counts[b] || 0); });
    var under = {};
    sorted.slice(0, Math.ceil(sorted.length / 2)).forEach(function (m) { under[m] = true; });
    var prioritized = candidates.filter(function (e) { return under[e.muscle]; });
    return prioritized.length >= 4 ? prioritized : candidates;
  }

  // Most recent logged weight for this exercise name, local-only (no
  // sign-in needed) — mc_setlog_v1 can't be used here (a fresh Quick Pump
  // session gets a new id every generation, so it's siloed with no history
  // to read), but mc_workout_log_v1 is timestamped and keyed by exercise
  // name regardless of which page/session logged it. When there's no local
  // match, this returns null and leaves the exercise's data-fill unset —
  // mc-setlog.js's existing trySupabasePrefill() already fills that gap for
  // signed-in users generically, page-agnostic, no extra call needed here.
  function lastWeightFor(name) {
    var nl = (name || '').toLowerCase();
    var log = workoutLog();
    for (var i = 0; i < log.length; i++) {
      var sets = log[i].sets || [];
      for (var j = 0; j < sets.length; j++) {
        var s = sets[j];
        if ((s.name || '').toLowerCase() === nl && parseFloat(s.weight) > 0) return parseFloat(s.weight);
      }
    }
    return null;
  }

  function blockCounts(minutes) {
    var avail = Math.max(minutes - OVERHEAD_MIN, 10);
    var pairs = Math.max(1, Math.floor((avail - MIN_PER_SINGLE) / MIN_PER_PAIR));
    return { singles: 1, pairs: pairs };
  }

  // ---- variety mode: pull from the full catalog ---------------------------
  function pool(muscles) {
    if (!window.EXERCISES) return [];
    var set = {};
    muscles.forEach(function (m) { set[m] = true; });
    return window.EXERCISES.filter(function (e) { return set[e.muscle]; });
  }

  function pickAnchor(candidates) {
    var compounds = candidates.filter(function (e) { return e.movement !== 'Isolation'; });
    var src = compounds.length ? compounds : candidates;
    return shuffle(src)[0];
  }

  // Two exercises sharing equipment need no walk across the floor — the
  // simplest reliable stand-in for the archetype rules (A-D) without knowing
  // a specific gym's floor layout.
  function pickPair(candidates, used) {
    var byEquip = {};
    candidates.forEach(function (e) {
      if (used[e.name]) return;
      (byEquip[e.equipment] = byEquip[e.equipment] || []).push(e);
    });
    var equips = shuffle(Object.keys(byEquip).filter(function (k) { return byEquip[k].length >= 2; }));
    if (equips.length) return shuffle(byEquip[equips[0]]).slice(0, 2);
    var rest = shuffle(candidates.filter(function (e) { return !used[e.name]; }));
    return rest.slice(0, 2);
  }

  function toExercise(e, opts) {
    var ex = {
      name: e.name, muscle: e.muscle,
      sets: opts.sets, reps: opts.reps, tempo: '', rest: opts.rest,
      drops: [], superset: !!opts.superset, cluster: '', clusterRest: ''
    };
    var w = lastWeightFor(e.name);
    if (w) ex.seedWeight = w;
    return ex;
  }

  function generate(cfg) {
    cfg = cfg || {};
    var minutes = cfg.minutes === 45 ? 45 : 30;
    var focus = MUSCLE_GROUPS[cfg.focus] ? cfg.focus : 'Full Body';
    var candidates = pool(MUSCLE_GROUPS[focus]);
    if (!candidates.length) return { name: 'Quick Pump', exercises: [] };

    // History-aware selection (Phase 2.4): fill weekly volume gaps first
    // (Full Body only — a single-focus pump has no gaps to balance within
    // itself), then bias away from whatever's already sore from <48h ago.
    if (focus === 'Full Body') candidates = balanceFullBody(candidates, MUSCLE_GROUPS[focus]);
    candidates = preferFresh(candidates, recentlyTrainedMuscles(48));

    var counts = blockCounts(minutes);
    var used = {};
    var exercises = [];

    var anchor = pickAnchor(candidates);
    if (anchor) {
      used[anchor.name] = true;
      exercises.push(toExercise(anchor, { sets: 3, reps: '12', rest: 60, superset: false }));
    }

    for (var i = 0; i < counts.pairs; i++) {
      var pair = pickPair(candidates, used);
      if (!pair.length) break;
      pair.forEach(function (e, idx) {
        used[e.name] = true;
        // only the second half of the pair carries a rest timer — the first
        // move straight into its partner (mirrors mc-s1-back.html's rSS()).
        exercises.push(toExercise(e, { sets: 3, reps: '15', rest: idx === 1 ? 60 : 0, superset: idx === 1 }));
      });
      if (pair.length < 2) break;
    }

    var label = focus === 'Full Body' ? '' : ' · ' + focus;
    return { name: 'Quick Pump — ' + minutes + ' min' + label, exercises: exercises };
  }

  // ---- abbreviate mode: trim the page you're already on -------------------
  var CARD_SEL = '.ex-card, .ex-item, .lift-card';
  var NAME_SEL = '.ex-name, .lift-name, .var-name, .ss-name';

  function nameOf(el) {
    var n = el.querySelector(NAME_SEL);
    return n ? n.textContent.trim() : (el.textContent || '').trim().slice(0, 60);
  }

  // Walks the page in DOM order, treating a .ss-card (superset wrapper) as
  // one atomic 2-lift block and a standalone card as one lift, until the
  // time budget for `minutes` is spent.
  function abbreviateCurrentPage(minutes) {
    minutes = minutes === 45 ? 45 : 30;
    var avail = Math.max(minutes - OVERHEAD_MIN, 10);
    var items = document.querySelectorAll(CARD_SEL + ', .ss-card');
    var exercises = [];
    var spent = 0;
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      if (el.closest && el.closest('.ss-card') && !el.classList.contains('ss-card')) continue; // skip legs, handled via wrapper
      if (el.classList.contains('ss-card')) {
        if (spent + MIN_PER_PAIR > avail && exercises.length) break;
        var legs = el.querySelectorAll('.ss-ex');
        if (legs.length < 2) continue;
        exercises.push(toExercise({ name: nameOf(legs[0]), muscle: '' }, { sets: 3, reps: '12', rest: 0, superset: false }));
        exercises.push(toExercise({ name: nameOf(legs[1]), muscle: '' }, { sets: 3, reps: '12', rest: 60, superset: true }));
        spent += MIN_PER_PAIR;
      } else {
        if (spent + MIN_PER_SINGLE > avail && exercises.length) break;
        exercises.push(toExercise({ name: nameOf(el), muscle: '' }, { sets: 3, reps: '12', rest: 60, superset: false }));
        spent += MIN_PER_SINGLE;
      }
    }
    var title = (document.querySelector('.title, .header-inner .title') || {}).textContent || 'Workout';
    return { name: 'Quick Pump — ' + minutes + ' min (from ' + title.trim() + ')', exercises: exercises };
  }

  // ---- Conditioning Corner fast-finisher suggestion ------------------------
  function conditioningPick(minutes) {
    // CONDITIONING is declared with `const` in conditioning-data.js, so it's
    // a shared top-level binding visible to every script on the page but
    // never a window property — check the bare identifier, not window.*.
    if (typeof CONDITIONING === 'undefined') return null;
    var fits = [];
    CONDITIONING.subcategories.forEach(function (sub) {
      (sub.routines || []).forEach(function (r) {
        var mins = null;
        (r.stats || []).forEach(function (s) {
          var m = /(\d+)\s*min/i.exec(s);
          if (m) mins = parseInt(m[1], 10);
        });
        if (mins && mins <= minutes) fits.push(r);
      });
    });
    if (!fits.length) return null;
    return shuffle(fits)[0];
  }

  // ---- persist + hand off to the existing custom-workout runner -----------
  function saveAndStart(built) {
    if (!built || !built.exercises.length) return;
    var all; try { all = JSON.parse(localStorage.getItem(CW_KEY) || '[]'); } catch (e) { all = []; }
    var now = new Date().toISOString();
    var wk = {
      id: 'cw-' + Date.now().toString(36),
      name: built.name, created: now, publishedAt: now,
      program: '', collection: '', exercises: built.exercises
    };
    all.unshift(wk);
    try { localStorage.setItem(CW_KEY, JSON.stringify(all)); } catch (e) {}
    location.href = 'run-workout.html?id=' + encodeURIComponent(wk.id);
  }

  window.MCQuickPump = {
    MUSCLE_GROUPS: MUSCLE_GROUPS,
    generate: generate,
    abbreviateCurrentPage: abbreviateCurrentPage,
    conditioningPick: conditioningPick,
    saveAndStart: saveAndStart
  };

  // Node-side hook so CI can regression-test the history-aware selection
  // math (see tools/test-mc-quick-pump.js) against the real source file.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      MUSCLE_GROUPS: MUSCLE_GROUPS,
      generate: generate,
      preferFresh: preferFresh,
      balanceFullBody: balanceFullBody,
      recentlyTrainedMuscles: recentlyTrainedMuscles,
      weeklySetsByMuscle: weeklySetsByMuscle,
      lastWeightFor: lastWeightFor
    };
  }
})();

/* ==========================================================================
   mc-readiness.js — per-muscle-group recovery model
   --------------------------------------------------------------------------
   CI initiative roadmap, Phase 2 / Initiative 02. Reads mc_workout_log_v1
   (finished sessions) and classifies every logged set by muscle group via
   mc-muscle-map.js's MC_MUSCLES.classify() — the same taxonomy the Stats
   hub's volume-by-muscle view already uses, so this introduces no second
   classification vocabulary.

   Recovery model: for each muscle, find the most recent finished session
   that hit it (newest-first — mc-finish.js unshifts, so log[0] is always
   the newest) and compute a 0-100% recovery curve from hours-since-trained,
   using the same saturating-exponential shape mc-strain.js's strain score
   uses (100 x (1 - e^-hours/tau)) — consistent math language across both
   Phase 2 modules. tau (how long full recovery takes) isn't fixed: it
   stretches with how much volume that session put on the muscle (more sets
   = longer to clear) and stretches further again if 1+ of those sets ran
   at RPE >= 9.5/F. A muscle with no logged history at all reads 100% (fully
   fresh — there's nothing to recover from) rather than 0%/unknown.

   window.MC_READY.byMuscle() — { <muscleId>: {pct, status, hoursSince, sets} }
     for every group in MC_MUSCLES.groups. status is 'fresh' (pct>=70),
     'accumulating' (40-69), or 'overreached' (<40) — the three states the
     dashboard readiness board's under-bar renders in semantic color.
   window.MC_READY.score(muscleId) — just that muscle's pct, or null for an
     unrecognized id.
   window.MC_READY.stale(muscleId, days) — true when a muscle either has NO
     logged history, or hasn't been trained in `days` (default 7) — distinct
     from "recovered": a muscle can be 100% recovered and NOT stale (trained
     4 days ago, tau cleared quickly) or recovered AND stale (untouched for
     two weeks). Consumed by mc-quick-pump.js's Full Body balancing in place
     of its old weekly-set-count-only heuristic.
   window.MC_READY.overall() — {pct, status}, a plain mean of byMuscle()'s
     pct across the 9 real groups (excludes 'other'). Consumed by the
     dashboard's compact weekly pulse strip (mc-recap.js's
     renderPulseStrip()) and the Stats page's Weekly Review muscle panel
     for the current week (mc-stats.js) — see readiness-stats-roadmap.md.
   ========================================================================== */
(function () {
  var isBrowser = typeof window !== 'undefined';
  if (isBrowser) {
    if (window.MC_READY) return;
  }

  var WL_KEY = 'mc_workout_log_v1';
  var HOUR = 3600 * 1000;
  var BASE_TAU_HOURS = 20; // a single light set clears ~63% by hour 20, ~95% by hour 60

  var FRESH_MIN = 70;
  var ACCUMULATING_MIN = 40;

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch (e) { return fallback; }
  }

  function workoutLog() { return readJSON(WL_KEY, []); }

  function classify(name) {
    try {
      if (isBrowser && window.MC_MUSCLES) return window.MC_MUSCLES.classify(name).id;
    } catch (e) {}
    return 'other';
  }

  function muscleIds() {
    try {
      if (isBrowser && window.MC_MUSCLES) return window.MC_MUSCLES.groups.map(function (g) { return g.id; });
    } catch (e) {}
    return ['calves', 'shoulders', 'legs', 'triceps', 'back', 'chest', 'core', 'biceps', 'forearms', 'other'];
  }

  // The most recent finished session with at least one set classified to
  // this muscle, and that session's own set count / near-failure count for
  // it — null if the muscle has never been logged.
  function lastStimulus(muscleId) {
    var log = workoutLog();
    for (var i = 0; i < log.length; i++) {
      var e = log[i];
      if (!e || !e.date) continue;
      var matching = (e.sets || []).filter(function (s) { return classify(s.name) === muscleId; });
      if (!matching.length) continue;
      var nearFailure = matching.filter(function (s) {
        return s.rpe === 'F' || parseFloat(s.rpe) >= 9.5;
      }).length;
      return {
        date: e.date,
        hoursSince: (Date.now() - new Date(e.date).getTime()) / HOUR,
        sets: matching.length,
        nearFailureSets: nearFailure
      };
    }
    return null;
  }

  function statusFor(pct) {
    if (pct >= FRESH_MIN) return 'fresh';
    if (pct >= ACCUMULATING_MIN) return 'accumulating';
    return 'overreached';
  }

  function recoveryFor(muscleId) {
    var stim = lastStimulus(muscleId);
    if (!stim) return { pct: 100, status: 'fresh', hoursSince: null, sets: 0 };
    var tau = BASE_TAU_HOURS * (1 + stim.sets / 10) * (stim.nearFailureSets >= 1 ? 1.25 : 1);
    var pct = Math.round(Math.max(0, Math.min(100, 100 * (1 - Math.exp(-stim.hoursSince / tau)))));
    return { pct: pct, status: statusFor(pct), hoursSince: Math.round(stim.hoursSince), sets: stim.sets };
  }

  function byMuscle() {
    var out = {};
    muscleIds().forEach(function (id) { out[id] = recoveryFor(id); });
    return out;
  }

  function score(muscleId) {
    if (muscleIds().indexOf(muscleId) === -1) return null;
    return recoveryFor(muscleId).pct;
  }

  // Single aggregate readiness figure (Phase 3 / Initiative 05 — "The
  // Readout"), a plain mean across the 9 real muscle groups. 'other' is
  // excluded — same reasoning renderBoard() already applies to the chip
  // grid: it's a catch-all bucket for unclassified exercise names, not a
  // real trained muscle, so folding it in would silently drag the aggregate
  // toward its permanent 100%-fresh reading whenever a page's exercise names
  // don't match any of the 9 real patterns.
  function overall() {
    var ids = muscleIds().filter(function (id) { return id !== 'other'; });
    if (!ids.length) return { pct: 100, status: 'fresh' };
    var data = byMuscle();
    var sum = ids.reduce(function (s, id) { return s + (data[id] ? data[id].pct : 100); }, 0);
    var pct = Math.round(sum / ids.length);
    return { pct: pct, status: statusFor(pct) };
  }

  function stale(muscleId, days) {
    var stim = lastStimulus(muscleId);
    if (!stim) return true;
    return stim.hoursSince >= (days || 7) * 24;
  }

  var API = { byMuscle: byMuscle, score: score, stale: stale, overall: overall };
  if (isBrowser) window.MC_READY = API;

  // Node-side hook so CI can regression-test the real recovery math (see
  // tools/test-mc-readiness.js), same convention as mc-suggest.js/mc-strain.js.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
  // typeof document, not isBrowser: a Node test harness may mock a bare
  // `window` global without `document` (test-mc-readiness.js does exactly
  // that), and everything below has no reason to run outside a real page.
  if (typeof document === 'undefined') return;

  var STATUS_COLOR = { fresh: '#34d399', accumulating: '#f59e0b', overreached: '#f87171' };

  function injectCss() {
    if (document.getElementById('mcReadyCss')) return;
    var st = document.createElement('style');
    st.id = 'mcReadyCss';
    st.textContent =
      '.ready-dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:6px;vertical-align:middle;}';
    document.head.appendChild(st);
  }

  // ---- exercise-card freshness dot (.ex-name / .ss-name) --------------------
  // A 6px dot next to each exercise's name, colored by that muscle's current
  // recovery status — the same three-color scale the readiness board uses.
  // MutationObserver-driven (same technique mc-setlog.js/mc-superset-hop.js
  // use for the identical problem — exercise cards render at wildly
  // different times across the fleet's various render engines) with a few
  // retry passes for anything the observer's first tick missed.
  function decorateName(el, data) {
    if (el.dataset.mcReadyDot) return;
    el.dataset.mcReadyDot = '1';
    var name = el.textContent.trim();
    if (!name) return;
    var id = window.MC_MUSCLES.classify(name).id;
    var r = data[id];
    if (!r) return;
    injectCss();
    var dot = document.createElement('span');
    dot.className = 'ready-dot';
    dot.style.background = STATUS_COLOR[r.status];
    dot.setAttribute('role', 'img');
    dot.setAttribute('aria-label', r.status + ' — ' + r.pct + '% recovered');
    dot.title = r.status + ' — ' + r.pct + '% recovered';
    el.appendChild(dot);
  }
  function decorateCards() {
    if (!window.MC_MUSCLES || !workoutLog().length) return;
    var data = byMuscle();
    document.querySelectorAll('.ex-name, .ss-name').forEach(function (el) { decorateName(el, data); });
  }

  function init() {
    decorateCards();
    var obs = new MutationObserver(function () { decorateCards(); });
    obs.observe(document.body, { childList: true, subtree: true });
    [500, 1500, 3000].forEach(function (d) { setTimeout(decorateCards, d); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

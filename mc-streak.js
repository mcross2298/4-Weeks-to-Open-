/* ==========================================================================
   mc-streak.js — ONE streak, and it counts adherence, not calendar days
   (engine-repair roadmap Phase 4 step 1; audit EN-4)
   --------------------------------------------------------------------------
   WHAT WAS WRONG

   Two implementations of one concept, over two different stores:

     mc-live-tracker.js  computeStreak()    walked mc_activity.days backwards
                                            over consecutive CALENDAR days
     dashboard.html      maybeCheckStreak() independently re-derived a 7-day
                                            streak from mc_workout_log_v1 to
                                            decide whether to fire the
                                            milestone push

   Both broke on the same fact: EVERY program in this app rests at least one
   day a week (ss rests [6,7], mm rests [5], hv rests a different pair each
   week). An athlete who follows a prescription EXACTLY loses the streak on
   their first prescribed rest day, and the seven-day milestone is not merely
   hard — it is unreachable without disobeying the program.

   WHAT THIS COUNTS INSTEAD

   Three modes, picked by what the athlete's data can actually support. The
   caller supplies the data; this file holds no I/O, so every branch is a pure
   function over its arguments and is unit-tested against the real source.

     'schedule'  The active program declares a schedule (ss, mm, hv today —
                 three of ten; F5 left the other seven without one on purpose
                 because their metas describe collections, not blocks). Walk
                 the program's own day sequence backwards from the last
                 completed day: a prescribed REST day is skipped, a completed
                 training day extends the streak, and the first prescribed
                 training day with no completion ends it. No calendar mapping
                 is involved or needed — the day sequence IS the prescription.

     'history'   No schedule. The athlete's own training weekdays stand in for
                 one, via mc-bridge.js's likelyTrainingDays() — already derived
                 from mc_workout_log_v1 for the cookbook, so this is a second
                 consumer of existing arithmetic rather than a new copy. Walk
                 calendar days backwards: a weekday they historically rest is
                 skipped, a weekday they historically train must carry a
                 session.

     'calendar'  Neither is available — a brand-new athlete with no history and
                 no schedule. The original consecutive-calendar-day count, kept
                 so the first week still reads as something.

   STALENESS

   A schedule streak has no calendar in it, so on its own it would freeze: stop
   training for a month and it still reads 12. The grace window is DERIVED from
   the program rather than picked — the longest run of consecutive prescribed
   rest days anywhere in the block, plus one. hv rests [3,6] one week and [6,7]
   another, so its own longest run answers for it; nothing here needs to know
   which program it is looking at.

   The day arithmetic itself is NOT reimplemented here: the caller passes
   mc-program-progress.js's own isRest(), which is the one place that knows how
   a day number maps onto a week position and a phase.
   ========================================================================== */
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.MC_STREAK) return;

  var DAY_MS = 86400000;
  // Weekday codes in the order mc-bridge.js's likelyTrainingDays() returns.
  // Its own DAYS array is CAPITALISED ("Mon", "Tue", …) and is byte-identical
  // with the cookbook's, so it is not ours to change — the pattern is
  // lower-cased on the way in instead. Found by driving the dashboard with a
  // real eight-week log, not by reading: assuming the casing made every
  // history-mode athlete fall silently through to calendar mode.
  var DAY_CODES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  // A walk that cannot terminate on bad data still has to stop.
  var MAX_WALK_DAYS = 730;

  function dayKey(d) {
    var t = new Date(d);
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') +
           '-' + String(t.getDate()).padStart(2, '0');
  }
  function codeOf(d) { return DAY_CODES[(new Date(d).getDay() + 6) % 7]; }
  function intOr(v, d) { var n = parseInt(v, 10); return isFinite(n) ? n : d; }

  // ---- schedule mode -------------------------------------------------------

  // The longest run of consecutive prescribed rest days anywhere in the block.
  // Read off isRest() rather than off a rest array, so a program whose rest
  // pattern varies week to week (hv) answers for itself.
  function longestRestRun(total, isRest) {
    var best = 0, run = 0;
    for (var d = 1; d <= total; d++) {
      if (isRest(d)) { run++; if (run > best) best = run; }
      else run = 0;
    }
    return best;
  }

  function scheduleStreak(rec, isRest, now) {
    var completed = (rec && rec.completed) || {};
    var last = 0, lastTs = 0;
    for (var k in completed) {
      var d = intOr(k, 0);
      if (d > last) { last = d; lastTs = (completed[k] && completed[k].ts) || 0; }
    }
    if (!last) return { n: 0, stale: false };

    var total = Math.max(last, intOr(rec && rec.weeks, 0) * intOr(rec && rec.perWeek, 0));
    var grace = (longestRestRun(total, isRest) + 1) * DAY_MS;
    if (lastTs && now && (now - lastTs) > grace) return { n: 0, stale: true };

    var n = 0;
    for (var day = last; day >= 1; day--) {
      if (isRest(day)) continue;                 // prescribed rest: preserved
      if (completed[String(day)]) { n++; continue; }
      break;                                     // a missed training day ends it
    }
    return { n: n, stale: false };
  }

  // ---- history mode --------------------------------------------------------

  // Accepts whatever casing the caller's source uses and answers in ours.
  function normalizePattern(p) {
    if (!p) return null;
    var out = null;
    for (var k in p) {
      if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
      var c = String(k).toLowerCase();
      if (DAY_CODES.indexOf(c) < 0) continue;
      (out = out || {})[c] = !!p[k];
    }
    return out;
  }

  function historyStreak(days, pattern, now) {
    var cur = new Date(now);
    var n = 0, walked = 0;
    // Today counts only if it was trained; an untrained today does not break a
    // streak, exactly as the original calendar count allowed.
    if (pattern[codeOf(cur)] && !days[dayKey(cur)]) cur.setDate(cur.getDate() - 1);
    while (walked++ < MAX_WALK_DAYS) {
      var trainingDay = !!pattern[codeOf(cur)];
      if (trainingDay) {
        if (!days[dayKey(cur)]) break;
        n++;
      }
      cur.setDate(cur.getDate() - 1);
    }
    return { n: n };
  }

  // ---- calendar mode (the original) ----------------------------------------

  function calendarStreak(days, now) {
    var cur = new Date(now), n = 0, walked = 0;
    if (!days[dayKey(cur)]) cur.setDate(cur.getDate() - 1);
    while (days[dayKey(cur)] && walked++ < MAX_WALK_DAYS) {
      n++; cur.setDate(cur.getDate() - 1);
    }
    return { n: n };
  }

  // ---- public --------------------------------------------------------------

  /* compute({ rec, isRest, days, pattern, now }) -> { n, mode, stale }

     rec      mc_program_progress_v1 record for the ACTIVE program, or null
     isRest   MC_PROGRAM_PROGRESS.isRest bound to that record, or null
     days     mc_activity.days — { "YYYY-MM-DD": true }
     pattern  MCBridge.likelyTrainingDays() — { mon: bool, … }, or null
     now      ms timestamp; defaults to Date.now()

     Every argument is optional and every branch degrades to the next one, so a
     caller missing a module gets a weaker answer rather than an exception. */
  function compute(opts) {
    var o = opts || {};
    var days = o.days || {};
    var now = o.now || Date.now();

    if (o.rec && typeof o.isRest === 'function' &&
        o.rec.completed && Object.keys(o.rec.completed).length) {
      var s = scheduleStreak(o.rec, o.isRest, now);
      return { n: s.n, mode: 'schedule', stale: !!s.stale };
    }
    var pattern = normalizePattern(o.pattern);
    if (pattern && DAY_CODES.some(function (c) { return pattern[c]; })) {
      return { n: historyStreak(days, pattern, now).n, mode: 'history', stale: false };
    }
    return { n: calendarStreak(days, now).n, mode: 'calendar', stale: false };
  }

  var API = {
    compute: compute,
    // exposed for the unit test and for anything that wants the parts
    _longestRestRun: longestRestRun,
    _normalizePattern: normalizePattern,
    _dayKey: dayKey,
    _codeOf: codeOf
  };

  if (typeof window !== 'undefined') window.MC_STREAK = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();

/* ==========================================================================
   mc-program-day.js — the day-identity contract (roadmap F4)
   --------------------------------------------------------------------------
   THE PROBLEM THIS SOLVES. A completed workout has to be attributed to a
   PROGRAM DAY ("mm, week 3, position 2") so mc-program-progress.js can tick it
   off. Until now the only page that could do that was cat-strength.html, and
   only because it serves its workouts in-page: it holds currentWorkoutId and
   activeWeek in its own scope and did the day-number arithmetic inline. Every
   other program puts its workouts on separate pages (mm-p1.html, hv-block.html
   …), so when the athlete finishes there, no program page is open, nobody
   knows which day just got trained, and the completion is dropped.

   That was only fixable once F3 gave every page ONE workout per screen. While
   a page rendered its whole block at once there was no single answer to "which
   day is this" -- the D0 finding that started this whole roadmap.

   WHY A FUNCTION, NOT A CONSTANT. The week is live state, not a property of
   the file: mm-engine.js owns `currentWeek` and `openDayIdx` INSIDE its IIFE,
   and switching week or day re-renders without navigating. A page therefore
   registers a RESOLVER that closes over its own state and is called at
   completion time. This is the same root cause as D0's MC_PID_OVERRIDE
   finding -- every consumer of that captured at module load, so a static
   declaration would have been read before the value existed.

   WHAT A PAGE PROVIDES. Either shape, whichever the page naturally has:

     MC_PROGRAM_DAY.provide(function () {
       return { prog: 'mm', week: 3, position: 2 };   // 1-based slot in the week
     });                                              // (rest slots included)

     MC_PROGRAM_DAY.provide(function () {
       return { prog: 'ss', week: 3, rank: 1 };       // 1-based among the week's
     });                                              // TRAINING days only

   `position` is the direct slot and is what an engine whose day array already
   includes its rest days has. `rank` is for a page that lists only trainable
   workouts (cat-strength) -- the rank→position conversion lives here rather
   than being re-derived per page, since getting it wrong silently attributes
   the wrong day. Return null when no day is open.

   IT NEVER INVENTS A SCHEDULE. Banking is skipped unless the program actually
   carries a `schedule` record in mc-pm-data.js. F1b's mount() had to learn the
   same rule the hard way: with no record, normalize() happily invented a 7-day
   2-rest week and rendered it as the program's real schedule. A program with
   no record here simply keeps today's behaviour -- the completion still
   reaches mc_workout_log_v1, it just isn't attributed to a program day.
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_PROGRAM_DAY) return;

  var resolver = null;

  function provide(fn) { resolver = (typeof fn === 'function') ? fn : null; }

  // ORDER MUST NOT MATTER. A page registers either by calling provide() or by
  // setting window.MC_PROGRAM_DAY_RESOLVER, and this reads whichever exists at
  // CALL time. The distinction is not academic: mm-engine.js registers from
  // inside its own IIFE, which runs the moment that file loads, and the first
  // wiring of this contract put the <script> tag for THIS file twelve lines
  // further down the page. The `if (window.MC_PROGRAM_DAY)` guard was simply
  // false, registration never happened, and nothing threw — a finished workout
  // just silently failed to attribute. Reading lazily makes a mis-ordered page
  // work instead of failing quietly, which is the failure mode this codebase
  // has been bitten by repeatedly (see A-17's dropped `defer` sweep).
  function activeResolver() {
    if (resolver) return resolver;
    var g = window.MC_PROGRAM_DAY_RESOLVER;
    return (typeof g === 'function') ? g : null;
  }

  // Always reached through `window.` rather than as a bare global. In a browser
  // the two are the same thing, so the difference is invisible there -- but the
  // unit test drives this source in a vm sandbox where `window` is an ordinary
  // object and a bare reference throws. Consistency here is what lets the test
  // exercise shipped code instead of a copy.
  function defOf(progId) {
    try {
      var data = window.MC_PM_DATA;
      var p = data && data.program && data.program(progId);
      return (p && p.schedule) || null;
    } catch (e) { return null; }
  }

  // Resolve the page's own answer, normalised. Returns null when the page has
  // no day open, has not registered, or hands back something unusable -- a
  // caller must never have to distinguish those.
  function current() {
    var fn = activeResolver();
    if (!fn) return null;
    var d;
    try { d = fn(); } catch (e) { return null; }
    if (!d || !d.prog) return null;
    var week = parseInt(d.week, 10);
    if (!week || week < 1) return null;
    var out = { prog: String(d.prog), week: week, position: null };
    if (d.position != null) {
      var pos = parseInt(d.position, 10);
      if (!pos || pos < 1) return null;
      out.position = pos;
    } else if (d.rank != null) {
      var rank = parseInt(d.rank, 10);
      if (!rank || rank < 1) return null;
      out.position = positionOfRank(out.prog, rank);
      if (!out.position) return null;
    } else {
      return null;
    }
    return out;
  }

  // rank (1-based among the week's TRAINING days) -> position (1-based slot in
  // the week, rest days counted). Reads the live record so a reordered or
  // re-rested week resolves against what the athlete actually has, not the
  // authored default.
  function positionOfRank(progId, rank) {
    var PD = window.MC_PROGRAM_PROGRESS;
    var def = defOf(progId);
    if (!PD || !def) return null;
    var rec = PD.get(progId, def);
    if (!rec || !rec.perWeek) return null;
    var rest = rec.rest || [];
    var seen = 0;
    for (var p = 1; p <= rec.perWeek; p++) {
      if (rest.indexOf(p) >= 0) continue;
      seen++;
      if (seen === rank) return p;
    }
    return null;
  }

  // The continuous day number across the block (week 2 position 1 = day 8 on a
  // 7-day week), which is the key mc-program-progress.js records against.
  function dayNumber() {
    var d = current();
    if (!d) return null;
    var PD = window.MC_PROGRAM_PROGRESS;
    var def = defOf(d.prog);
    if (!PD || !def) return null;
    var rec = PD.get(d.prog, def);
    if (!rec || !rec.perWeek) return null;
    if (d.position > rec.perWeek) return null;
    return (d.week - 1) * rec.perWeek + d.position;
  }

  // Bank the completion. Returns the day number banked, or null when there was
  // nothing to attribute it to -- callers use that to decide whether to
  // refresh a list.
  function bank(entry) {
    var d = current();
    if (!d) return null;
    var PD = window.MC_PROGRAM_PROGRESS;
    var def = defOf(d.prog);
    if (!PD || !def) return null;
    var day = dayNumber();
    if (!day) return null;
    var rec = PD.get(d.prog, def);
    // A rest slot is not a workout. If a page ever reports one, that is a bug
    // in its resolver, not something to record as a trained day.
    if (PD.isRest(rec, day)) return null;
    entry = entry || {};
    PD.complete(d.prog, day, { logId: entry.id || null }, def);
    return day;
  }

  // mc-finish.js's _FW.confirm() is the app's ONE completion point and emits
  // this (D0-D3); inert on every page that has not registered a resolver.
  document.addEventListener('mc:workout-finished', function (ev) {
    var day = bank((ev.detail && ev.detail.entry) || {});
    if (day == null) return;
    var d = current();
    document.dispatchEvent(new CustomEvent('mc:program-day-banked', {
      detail: { prog: d && d.prog, week: d && d.week, day: day }
    }));
  });

  window.MC_PROGRAM_DAY = {
    provide: provide,
    current: current,
    dayNumber: dayNumber,
    bank: bank
  };

  // tools/test-mc-program-day.js drives this exact source in a vm-sandboxed
  // window (the test-mc-bridge.js technique), so the browser IIFE stays the
  // only runtime path and the test can never drift from a copy.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { provide: provide, current: current, dayNumber: dayNumber, bank: bank };
  }
})();

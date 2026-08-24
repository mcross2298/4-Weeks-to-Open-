/* ==========================================================================
   mc-program-progress.js — per-program day progression state
   --------------------------------------------------------------------------
   program-day-view-roadmap.md, phase D0. The single answer to "which day of
   this program am I on, which days are done, and which are rest days."

   WHY THIS STORE EXISTS AT ALL (the D0 finding). A day-by-day program view
   needs to know that a finished session was *Day 8 of the block*. Nothing in
   mc_workout_log_v1 can say that for a multi-day SPA page: cat-strength.html
   serves all five training days and all six weeks, does not set
   MC_PID_OVERRIDE, so every module keying off page identity resolves the same
   pageId ('cat-strength') for Legs Week 1 and Arms Week 6 — and the entry's
   only other identifying field, workoutName, is document.title, a constant.
   MC_PID_OVERRIDE is not the fix either: every consumer (mc-finish.js,
   mc-setlog.js, mc-session.js, mc-summary.js) captures it at MODULE LOAD, so
   setting it when a view opens would be read by nobody.

   So the prescribed-day identity is recorded HERE, explicitly, by the page
   that knows it — with the banked log entry's id stored alongside, so a
   completed day can still deep-link into real history. Division of truth:
     mc_workout_log_v1  — what was lifted (unchanged, still authoritative)
     mc_program_progress_v1 — which prescribed day that was

   SHAPE, keyed by program id (mc-pm-data.js's `id`):
     {
       "ss": {
         startedAt: "<iso>",
         weeks: 6, perWeek: 7,
         order: ["legs","chest",...],     // training days, in week order
         rest:  [6, 7],                   // 1-based positions within a week
         weekOrder: { "2": [...] },       // per-week reorder override, sparse
         completed: { "8": { ts, workoutId, week, logId } },
         cursor: 8,                       // explicit override; usually derived
         ts: <ms>
       }
     }

   Day numbers are CONTINUOUS across the block — Day 8 is week 2, position 1 —
   matching the reference UI. Rest positions are data (defaulting to the Weekly
   Layout Standard's 5-on 2-off), never hardcoded in a renderer.

   Synced under mc-sync.js's existing 'dictBase' strategy — per-program key
   granularity, exactly as mc_weekly_overrides_v1 already works, so two devices
   advancing two different programs both survive. Declared in
   store-registry.json and mc-export.js's KEYS in the same change.
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_PROGRAM_PROGRESS) return;

  var KEY = 'mc_program_progress_v1';

  // Weekly Layout Standard (CLAUDE.md): 7-day week, days 1-5 train, 6-7 recover.
  var DEFAULT_PER_WEEK = 7;
  var DEFAULT_REST = [6, 7];

  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeAll(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
    try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e) {}
  }
  function nowIso() { return new Date().toISOString(); }
  function intOr(v, d) { var n = parseInt(v, 10); return isFinite(n) ? n : d; }

  // ---- record access -------------------------------------------------------

  // Normalizes whatever is stored (possibly nothing, possibly a record written
  // by an older shape) against the caller's declared program definition. `def`
  // is the program's own truth — { weeks, perWeek, order, rest } — so a program
  // that later gains a week or reorders its days doesn't need a migration.
  function normalize(rec, def) {
    def = def || {};
    rec = rec || {};
    var order = rec.order && rec.order.length ? rec.order : (def.order || []);
    var rest = rec.rest && rec.rest.length ? rec.rest : (def.rest || DEFAULT_REST);
    var perWeek = intOr(rec.perWeek, intOr(def.perWeek, DEFAULT_PER_WEEK));
    return {
      startedAt: rec.startedAt || null,
      weeks: intOr(rec.weeks, intOr(def.weeks, 1)),
      perWeek: perWeek,
      order: order.slice(),
      rest: rest.slice().filter(function (p) { return p >= 1 && p <= perWeek; }),
      // AUTHORED phase content (roadmap F5), re-derived from `def` on every
      // read and deliberately NEVER persisted. A multi-phase block runs a
      // different day set in each phase -- The Modality Matrix is 15 weeks of
      // three 5-week phases with entirely different lifts -- which a single
      // flat `order` cannot express.
      //
      // It is kept separate from weekOrder because weekOrder is ATHLETE state
      // (reorderWeek writes it, sparse, per week). Carrying authored phase
      // content in there would let a reorder of week 6 overwrite phase 2's
      // real prescription, and restart() would wipe the program's own
      // definition along with the athlete's progress.
      phases: (def.phases || []).map(function (ph) {
        return {
          weeks: intOr(ph.weeks, 0),
          order: (ph.order || []).slice(),
          // Per-phase rest, because a real program needed it: the High-Volume
          // block rests at positions [3,6] in week 1 and [6,7] in week 2. A
          // single flat `rest` cannot describe that, and assuming it could
          // would silently mark a training day as rest. Absent -> the phase
          // inherits the program's flat rest.
          rest: (ph.rest || []).slice().filter(function (q) { return q >= 1 && q <= perWeek; })
        };
      }),
      weekOrder: rec.weekOrder || {},
      completed: rec.completed || {},
      cursor: rec.cursor != null ? intOr(rec.cursor, null) : null,
      ts: intOr(rec.ts, 0)
    };
  }

  function get(progId, def) {
    return normalize(readAll()[progId], def);
  }

  function save(progId, rec) {
    var all = readAll();
    rec.ts = Date.now();
    all[progId] = rec;
    writeAll(all);
    return rec;
  }

  // First touch stamps startedAt so "day 1" has a real calendar anchor.
  function ensure(progId, def) {
    var all = readAll();
    var rec = normalize(all[progId], def);
    if (!rec.startedAt) {
      rec.startedAt = nowIso();
      all[progId] = rec;
      rec.ts = Date.now();
      writeAll(all);
    }
    return rec;
  }

  // ---- the day model -------------------------------------------------------

  function totalDays(rec) { return Math.max(0, rec.weeks * rec.perWeek); }

  // 1-based position of a continuous day number within its week.
  function positionOf(rec, day) {
    return ((day - 1) % rec.perWeek) + 1;
  }
  function weekOf(rec, day) {
    return Math.floor((day - 1) / rec.perWeek) + 1;
  }
  function isRest(rec, day) {
    return restForWeek(rec, weekOf(rec, day)).indexOf(positionOf(rec, day)) >= 0;
  }

  // The rest pattern in effect for one week: the authored phase's own, when it
  // declares one, else the program's flat pattern. Every rest-aware read goes
  // through here so a phase-varying block cannot be half-supported.
  function restForWeek(rec, week) {
    var ph = phaseForWeek(rec, week);
    return (ph && ph.rest && ph.rest.length) ? ph.rest : rec.rest;
  }

  // The training-day order in effect for one week — the per-week reorder
  // override when the athlete has dragged days around, else the program order.
  // Precedence: the athlete's own reorder for THIS week wins; then the
  // authored phase that contains the week; then the program's flat order.
  // Anything else would make a reorder invisible or a phase unreachable.
  function orderForWeek(rec, week) {
    var o = rec.weekOrder && rec.weekOrder[String(week)];
    if (o && o.length) return o;
    var ph = phaseForWeek(rec, week);
    if (ph && ph.order.length) return ph.order;
    return rec.order;
  }

  // Which authored phase a block week falls in. Phases are consecutive and
  // 1-based: with three 5-week phases, week 6 is the first week of phase 2.
  function phaseForWeek(rec, week) {
    var list = rec.phases || [];
    if (!list.length) return null;
    var start = 1;
    for (var i = 0; i < list.length; i++) {
      var end = start + list[i].weeks - 1;
      if (week >= start && week <= end) return list[i];
      start = end + 1;
    }
    return null;
  }

  // Which workout a continuous day number prescribes. Rest days map to null.
  // Training positions are ranked among the week's NON-rest positions, so a
  // rest pattern of [4,7] and one of [6,7] both index the order array 0..n-1
  // without either renderer or caller special-casing the pattern.
  function workoutFor(rec, day) {
    if (isRest(rec, day)) return null;
    var pos = positionOf(rec, day);
    var rest = restForWeek(rec, weekOf(rec, day));
    var rank = 0;
    for (var p = 1; p < pos; p++) {
      if (rest.indexOf(p) < 0) rank++;
    }
    var order = orderForWeek(rec, weekOf(rec, day));
    return order[rank] != null ? order[rank] : null;
  }

  function completionOf(rec, day) {
    return (rec.completed && rec.completed[String(day)]) || null;
  }
  function isComplete(rec, day) { return !!completionOf(rec, day); }

  // Everything a renderer needs about one day, in one object.
  function dayInfo(progId, day, def) {
    var rec = (def && def.__rec) ? def.__rec : get(progId, def);
    return dayInfoFrom(rec, day);
  }
  function dayInfoFrom(rec, day) {
    var rest = isRest(rec, day);
    var done = completionOf(rec, day);
    return {
      day: day,
      week: weekOf(rec, day),
      position: positionOf(rec, day),
      rest: rest,
      workoutId: workoutFor(rec, day),
      complete: !!done,
      completedAt: done ? done.ts : null,
      logId: done ? done.logId : null,
      inBlock: day >= 1 && day <= totalDays(rec)
    };
  }

  // One week's worth of dayInfo, for the schedule bar.
  function week(progId, weekNum, def) {
    var rec = (def && def.__rec) ? def.__rec : get(progId, def);
    return weekFrom(rec, weekNum);
  }
  function weekFrom(rec, weekNum) {
    var out = [];
    var first = (weekNum - 1) * rec.perWeek + 1;
    for (var i = 0; i < rec.perWeek; i++) out.push(dayInfoFrom(rec, first + i));
    return out;
  }

  // The day the UI should open on: an explicit cursor when one is set (the
  // athlete jumped somewhere, or completion advanced it), else the first
  // incomplete day, else the last day of the block once everything is done.
  function currentDay(progId, def) {
    var rec = (def && def.__rec) ? def.__rec : get(progId, def);
    return currentDayFrom(rec);
  }
  function currentDayFrom(rec) {
    if (rec.cursor && rec.cursor >= 1 && rec.cursor <= totalDays(rec)) return rec.cursor;
    return firstIncompleteFrom(rec);
  }
  function firstIncompleteFrom(rec) {
    var total = totalDays(rec);
    for (var d = 1; d <= total; d++) {
      if (isRest(rec, d)) continue;          // a rest day is never "owed"
      if (!isComplete(rec, d)) return d;
    }
    return total || 1;
  }

  // The next day after `day` that is still in the block. Rest days are real
  // stops, not skipped — the spec's progression advances onto them.
  function nextDayFrom(rec, day) {
    var total = totalDays(rec);
    return day < total ? day + 1 : null;
  }

  // The next TRAINING day at or after `day` — what a rest hero peeks at.
  function nextTrainingFrom(rec, day) {
    var total = totalDays(rec);
    for (var d = day; d <= total; d++) {
      if (!isRest(rec, d)) return d;
    }
    return null;
  }

  // ---- mutations -----------------------------------------------------------

  // Mark a day done and advance the cursor onto the next day (training or
  // rest, whichever is next chronologically — the spec's automatic
  // progression). meta carries the banked log entry so the completed hero can
  // deep-link: { logId, workoutId }.
  function complete(progId, day, meta, def) {
    var rec = get(progId, def);
    if (!rec.startedAt) rec.startedAt = nowIso();
    meta = meta || {};
    rec.completed[String(day)] = {
      ts: Date.now(),
      week: weekOf(rec, day),
      workoutId: meta.workoutId || workoutFor(rec, day),
      logId: meta.logId || null
    };
    var next = nextDayFrom(rec, day);
    rec.cursor = next != null ? next : day;
    return save(progId, rec);
  }

  // Undo one day's completion (a mis-tap on Finish). Does not move the cursor
  // backwards on its own — an athlete who un-completes Day 8 while sitting on
  // Day 9 usually means to go back, so callers pass `rewind` when they do.
  function uncomplete(progId, day, rewind, def) {
    var rec = get(progId, def);
    delete rec.completed[String(day)];
    if (rewind) rec.cursor = day;
    return save(progId, rec);
  }

  // Explicit jump — the schedule bar tapping a day pill.
  function setCursor(progId, day, def) {
    var rec = get(progId, def);
    var total = totalDays(rec);
    if (day < 1) day = 1;
    if (total && day > total) day = total;
    rec.cursor = day;
    return save(progId, rec);
  }

  // Drag-and-drop within one week. `order` is that week's training-day ids in
  // their new order; stored per-week so other weeks keep the program order.
  // Passing an order equal to the program order clears the override rather
  // than storing a redundant copy that would drift if the program changes.
  function reorderWeek(progId, weekNum, order, def) {
    var rec = get(progId, def);
    if (!order || !order.length) {
      delete rec.weekOrder[String(weekNum)];
    } else if (order.join(' ') === rec.order.join(' ')) {
      delete rec.weekOrder[String(weekNum)];
    } else {
      rec.weekOrder[String(weekNum)] = order.slice();
    }
    return save(progId, rec);
  }

  // Which week positions are rest. Adjusting this changes the split frequency
  // without touching the program template — same immutable-template principle
  // mc-schedule.js follows.
  function setRest(progId, positions, def) {
    var rec = get(progId, def);
    var perWeek = rec.perWeek;
    var clean = [], seen = {};
    (positions || []).forEach(function (p) {
      p = intOr(p, 0);
      if (p >= 1 && p <= perWeek && !seen[p]) { seen[p] = 1; clean.push(p); }
    });
    clean.sort(function (a, b) { return a - b; });
    // Never leave a week with no training slots — that would make the whole
    // block unreachable and there is no UI path back out of it.
    if (clean.length >= perWeek) return rec;
    rec.rest = clean;
    return save(progId, rec);
  }

  // Full reset back to Day 1. Returns the fresh record.
  function restart(progId, def) {
    var all = readAll();
    delete all[progId];
    writeAll(all);
    return ensure(progId, def);
  }

  // ---- rollup for the rest hero -------------------------------------------

  // Days since the most recent completion, and this week's completed count —
  // the two recovery numbers the rest hero shows. `null` days-since means
  // nothing has ever been completed for this program.
  function stats(progId, day, def) {
    var rec = (def && def.__rec) ? def.__rec : get(progId, def);
    var latest = 0, thisWeek = 0, total = 0;
    var wk = weekOf(rec, day || currentDayFrom(rec));
    for (var k in rec.completed) {
      if (!Object.prototype.hasOwnProperty.call(rec.completed, k)) continue;
      var c = rec.completed[k];
      total++;
      if (c.ts > latest) latest = c.ts;
      if (weekOf(rec, intOr(k, 0)) === wk) thisWeek++;
    }
    var trainPerWeek = rec.perWeek - rec.rest.length;
    return {
      daysSinceLast: latest ? Math.floor((Date.now() - latest) / 86400000) : null,
      lastTs: latest || null,
      completedThisWeek: thisWeek,
      trainingDaysPerWeek: trainPerWeek,
      completedTotal: total,
      totalTrainingDays: trainPerWeek * rec.weeks
    };
  }

  window.MC_PROGRAM_PROGRESS = {
    KEY: KEY,
    get: get,
    ensure: ensure,
    save: save,
    totalDays: function (rec) { return totalDays(rec); },
    weekOf: function (rec, d) { return weekOf(rec, d); },
    positionOf: function (rec, d) { return positionOf(rec, d); },
    isRest: function (rec, d) { return isRest(rec, d); },
    workoutFor: function (rec, d) { return workoutFor(rec, d); },
    orderForWeek: orderForWeek,
    phaseForWeek: phaseForWeek,
    restForWeek: restForWeek,
    dayInfo: dayInfo,
    dayInfoFrom: dayInfoFrom,
    week: week,
    weekFrom: weekFrom,
    currentDay: currentDay,
    currentDayFrom: currentDayFrom,
    nextDayFrom: nextDayFrom,
    nextTrainingFrom: nextTrainingFrom,
    complete: complete,
    uncomplete: uncomplete,
    setCursor: setCursor,
    reorderWeek: reorderWeek,
    setRest: setRest,
    restart: restart,
    stats: stats
  };

  // tools/test-mc-program-progress.js drives this exact source in a
  // vm-sandboxed window/localStorage (the test-mc-bridge.js technique), so
  // the browser IIFE stays the only runtime path and the test can never
  // drift from a copy.
})();

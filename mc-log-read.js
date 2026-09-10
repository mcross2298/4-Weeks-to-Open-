/* ==========================================================================
   mc-log-read.js — the ONE reader for mc_workout_log_v1 (FIX-04, audit L-03)
   --------------------------------------------------------------------------
   Six modules carried the same five-line reader:

     function logs() {
       try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]') || []; }
       catch (e) { return []; }
     }

   and all six had the same hole. try/catch catches malformed TEXT. It does
   not catch valid JSON of the wrong SHAPE, which is what actually reaches
   these modules: an object where an array belongs (`all.forEach is not a
   function`) or an array carrying a null member (`Cannot read properties of
   null`). The stats page, the history page and the dashboard each threw and
   rendered half a screen. Deliberately corrupting four stores at once with
   malformed text produced no errors anywhere — every crash found in three
   passes of audit came through this narrower door.

   So the reader is total: anything that is not an array of objects comes back
   as an empty array, and a bad member is dropped rather than handed on.
   `readWorkoutLog` is registered in tools/check-single-impl.js, so a seventh
   copy cannot appear — including a byte-identical one, since a duplicate that
   agrees today is exactly how six divergent variants came to exist before.

   Load order: this file has no dependencies and every consumer calls it at
   runtime, not at parse time, so its tag only has to be on the same page.
   ========================================================================== */
(function () {
  var WL_KEY = 'mc_workout_log_v1';

  function readWorkoutLog() {
    var v;
    try { v = JSON.parse(localStorage.getItem(WL_KEY) || '[]'); }
    catch (e) { return []; }                     // malformed text
    if (!Array.isArray(v)) return [];            // valid JSON, wrong type
    return v.filter(function (e) {               // null / primitive members
      return e && typeof e === 'object';
    });
  }

  // A finished session's own set list has the same problem one level down:
  // entry.sets is whatever was written, and every consumer iterates it.
  function readSets(entry) {
    var s = entry && entry.sets;
    if (!Array.isArray(s)) return [];
    return s.filter(function (x) { return x && typeof x === 'object'; });
  }

  // ---- reps on a CLUSTER set (audit P2-08) --------------------------------
  // mc-setlog.js's clusterRVal() writes one logged value per mini-set, joined
  // with '+': a cluster of 5, then 5, then 6 is stored as the string "5+5+6".
  // Every consumer then ran parseInt over it, which stops at the first '+' and
  // reads 5 — so a cluster set reported a third of the reps the athlete
  // actually did. In the progression classifier that is fatal rather than
  // merely wrong: the set is compared against its rep target, comes up short
  // every time, and the exercise is judged a failed session forever. 48
  // distinct cluster prescriptions are authored in this tree.
  //
  // The two right answers differ by what is being asked, so there are two
  // functions rather than one that quietly picks:
  //
  //   repsTotal  every rep performed in the set. This is the volume answer —
  //              sets × reps × weight, weekly tonnage, session strain — and
  //              the one the progression comparison wants, since the question
  //              is "did the prescribed work get done".
  //   repsTop    the largest single mini-set. This is the STRENGTH answer: an
  //              Epley estimate off "16 reps" for a 5+5+6 cluster would invent
  //              a one-rep max the athlete has no claim to, because a cluster
  //              is rested mid-set and a straight set is not.
  function splitReps(v) {
    var str = String(v == null ? '' : v).trim();
    if (!str) return [];
    return str.split('+').map(function (p) { return parseInt(p, 10); })
              .filter(function (n) { return isFinite(n); });
  }
  function repsTotal(v) {
    var parts = splitReps(v);
    if (!parts.length) return 0;
    return parts.reduce(function (a, b) { return a + b; }, 0);
  }
  function repsTop(v) {
    var parts = splitReps(v);
    if (!parts.length) return 0;
    return Math.max.apply(null, parts);
  }
  // True only when the value really is a logged number (or cluster of them),
  // so "did the athlete log reps at all" stays distinguishable from "0".
  function repsLogged(v) {
    return splitReps(v).length > 0;
  }

  // ---- estimated one-rep max (roadmap Phase 4 step 2) ---------------------
  // ONE estimate, because there were two and they disagreed about the same
  // logged set. mc-maxout.js capped reps at 12 and discounted leverage-assisted
  // equipment by 15%; mc-exercise-trends.js did neither. Measured on real
  // shapes before this landed:
  //
  //   Tricep Rope Pushdown  60 x 20   Cable     71 vs 100  (+41%)
  //   Cable Crossover       40 x 25   Cable     48 vs  73  (+52%)
  //   Leg Press            300 x 15   Machine  357 vs 450  (+26%)
  //   Barbell Bench Press  225 x 5    Barbell  263 vs 263    (0%)
  //
  // They agreed only on a barbell or dumbbell set at or under the cap, so the
  // same lift reported two different maxes depending on which screen the
  // athlete opened. This file is the home because every page that loads
  // mc-exercise-trends.js already loads it (79 of 79, checked) and so does
  // max-out.html — one implementation, no new script tag anywhere.
  //
  // Epley (w x (1 + r/30)) is fitted on low-rep work and runs away above about
  // a dozen reps: a 25-rep set would claim a max 83% over the working weight.
  // The cap is a claim about the FORMULA, not about the athlete.
  var EPLEY_REP_CAP = 12;

  // Resolved lazily, never at parse time: script order across ~140 pages does
  // not guarantee mc-classify.js has run when this file parses. Same shape
  // mc-maxout.js and mc-suggest.js already use for the one equipment resolver.
  function _cls() {
    if (typeof window !== 'undefined' && window.MC_CLASSIFY) return window.MC_CLASSIFY;
    try { return require('./mc-classify.js'); } catch (e) { return null; }
  }

  // Cable/Machine/Plate-Loaded estimates are discounted to offset machine
  // leverage; Smith and everything else (Barbell included) are unchanged.
  // Takes an equipment CATEGORY, not a name — mc-maxout.js's ladder already
  // has the category in hand and should not re-resolve it.
  function applyEquipCoeff(e1, equip) {
    e1 = Number(e1);
    if (!isFinite(e1) || e1 <= 0) return 0;
    var C = _cls();
    return (C ? C.isLeverageAssisted(equip)
              : (equip === 'Cable' || equip === 'Machine' || equip === 'Plate-Loaded'))
      ? Math.round(e1 * 0.85) : e1;
  }

  // The estimate itself, from a logged set. `reps` should already be the TOP
  // mini-set for a cluster (repsTop above), never the total — a cluster is
  // rested mid-set, so an estimate off its summed reps invents a max nobody
  // lifted. Total for every input: a negative weight used to yield a negative
  // max and negative reps an estimate BELOW the working weight (audit L-05).
  function e1rm(weight, reps, name) {
    var w = Number(weight), r = Number(reps);
    if (!isFinite(w) || w <= 0) return 0;
    if (!isFinite(r) || r < 1) r = 1;
    var raw = Math.round(w * (1 + Math.min(r, EPLEY_REP_CAP) / 30));
    if (!isFinite(raw) || raw <= 0) return 0;
    var C = _cls();
    return applyEquipCoeff(raw, C ? C.equipCat(name) : 'Barbell');
  }

  if (typeof window !== 'undefined') {
    window.MC_LOG = window.MC_LOG || {};
    window.MC_LOG.readWorkoutLog = readWorkoutLog;
    window.MC_LOG.readSets = readSets;
    window.MC_LOG.repsTotal = repsTotal;
    window.MC_LOG.repsTop = repsTop;
    window.MC_LOG.repsLogged = repsLogged;
    window.MC_LOG.e1rm = e1rm;
    window.MC_LOG.applyEquipCoeff = applyEquipCoeff;
    window.MC_LOG.EPLEY_REP_CAP = EPLEY_REP_CAP;
  }

  // Node-side hook so tools/test-mc-numeric-guards.js can call the real
  // implementation rather than a copy of it.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      readWorkoutLog: readWorkoutLog, readSets: readSets,
      repsTotal: repsTotal, repsTop: repsTop, repsLogged: repsLogged,
      e1rm: e1rm, applyEquipCoeff: applyEquipCoeff, EPLEY_REP_CAP: EPLEY_REP_CAP
    };
  }
})();

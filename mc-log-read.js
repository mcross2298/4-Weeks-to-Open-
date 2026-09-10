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

  if (typeof window !== 'undefined') {
    window.MC_LOG = window.MC_LOG || {};
    window.MC_LOG.readWorkoutLog = readWorkoutLog;
    window.MC_LOG.readSets = readSets;
  }

  // Node-side hook so tools/test-mc-numeric-guards.js can call the real
  // implementation rather than a copy of it.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { readWorkoutLog: readWorkoutLog, readSets: readSets };
  }
})();

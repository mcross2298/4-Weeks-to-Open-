/* ==========================================================================
   mc-vitals.js — manual daily wellness entry (flagship-immersive-roadmap.md H3)
   --------------------------------------------------------------------------
   Store: localStorage 'mc_vitals_v1' — append-only [{id:<iso>, date,
   restingHr, sleepHrs, readiness, source:'manual'}], synced via mc-sync.js
   'arrayById' (same pattern as mc_body_v1). One entry per log; all three
   fields are optional per entry.

   Deliberately NOT wired into mc-readiness.js's per-muscle recovery formula
   — that function is real, already tested (tools/test-mc-readiness.js) and
   consumed everywhere (dashboard readiness board, mc-quick-pump.js's Full
   Body balancing, the Stats hub's Recovery mode, exercise-card freshness
   dots), so changing its math is its own, separately-verified follow-up per
   this phase's locked AskUserQuestion decision. recoveryScore() below reads
   ONLY this store — never mc_workout_log_v1 — so it cannot silently
   influence any of those consumers.

   window.MC_VITALS.log(entry)      append a manual entry, arms mc-sync push
   window.MC_VITALS.latest()        most recent entry, or null
   window.MC_VITALS.recoveryScore() 0-100 reading from the latest entry alone,
     or null with no entry logged yet (never a fabricated number)
   ========================================================================== */
(function () {
  if (window.MC_VITALS) return;

  var KEY = 'mc_vitals_v1';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function write(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }

  function log(entry) {
    var iso = new Date().toISOString();
    var e = { id: iso, date: iso, source: 'manual' };
    if (entry && entry.restingHr != null) e.restingHr = entry.restingHr;
    if (entry && entry.sleepHrs != null) e.sleepHrs = entry.sleepHrs;
    if (entry && entry.readiness != null) e.readiness = entry.readiness;
    var a = read();
    a.unshift(e);
    write(a.slice(0, 1000));
    try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e2) {}
    return e;
  }

  function latest() {
    var a = read();
    return a.length ? a[0] : null;
  }

  // Bounded 0-100 reading from the latest entry alone. readiness (1-5,
  // self-reported) is the anchor when logged (1->20 ... 5->100); sleepHrs
  // nudges +/-15 around an 8h baseline (clamped). restingHr is informational
  // only and does not move the score — moving it would need a personal
  // baseline history this phase deliberately doesn't build (a single reading
  // means nothing without one to compare against). No entry at all -> null.
  function recoveryScore() {
    var e = latest();
    if (!e) return null;
    var score = (e.readiness != null) ? e.readiness * 20 : 70;
    if (e.sleepHrs != null) score += Math.max(-15, Math.min(15, (e.sleepHrs - 8) * 6));
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  window.MC_VITALS = { log: log, latest: latest, recoveryScore: recoveryScore };
})();

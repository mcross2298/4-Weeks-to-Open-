/* ==========================================================================
   mc-haptics.js — shared haptic feedback façade
   --------------------------------------------------------------------------
   Every navigator.vibrate() call in the app should route through here, so
   MC_PREFS.haptics (the same haptics toggle mc-timer.js's rest-timer buzz
   already respects) is honored everywhere — not just on the handful of
   modules that happened to gate it locally. Before this module existed,
   roughly two dozen vibrate sites duplicated the same
   "(typeof MC_PREFS!=='undefined')?MC_PREFS.get().haptics:true" guard, and
   several (mc-live-tracker.js's hidden-tab catch-up alert, every
   conditioning-routine page's buzz()) had no guard at all.

   MC_PREFS lives in mc-timer.js; on a page that doesn't load it (a few
   conditioning/log pages don't), haptics simply default to on, matching the
   fallback every pre-existing local guard already used.

   Four semantic presets cover the app's own vocabulary (a light set-check
   tap, a mid-weight confirm, the rest-timer/workout-done buzz, a PR
   flourish). Pages with a richer per-cue vocabulary (the conditioning
   circuit timers — work-start blip, round-transition, finish fanfare, all
   different patterns) call the pattern() escape hatch directly instead of
   forcing every cue into one of the four presets.
   ========================================================================== */
(function () {
  if (window.MC_HAPTICS) return;

  function on() {
    try { return typeof MC_PREFS !== 'undefined' ? MC_PREFS.get().haptics : true; }
    catch (e) { return true; }
  }

  function fire(pattern) {
    if (!on()) return;
    try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {}
  }

  window.MC_HAPTICS = {
    pattern: fire,                                          // arbitrary pattern, still gated
    tap: function () { fire(15); },                          // light UI tap — set-check, chip toggle
    confirm: function () { fire(30); },                       // action confirmed — workout saved
    complete: function () { fire([200, 100, 200, 100, 400]); }, // rest timer / workout done
    pr: function () { fire([60, 40, 120]); }                  // personal record
  };
})();

/* ==========================================================================
   mc-workout-engine.js — HTML escaping and rest-timer markup shared by 20 program pages (audit G5)
   --------------------------------------------------------------------------
   Lifted verbatim out of the pages that used to carry byte-identical copies of
   it. Behaviour is unchanged: these are the same function bodies, now stored
   once. Each page keeps its own render(), which is genuinely per-page — it
   names that page's data and sections.

   Reads page-level state (activeIdx, checkState, the page's workout data) and
   TMR from mc-timer.js. Classic scripts share one global lexical environment,
   so those resolve at call time; load this after mc-timer.js and before the
   page's inline script.
   ========================================================================== */

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function makeRestTimer(r, n) {
  var s = TMR.parseSeconds(r);
  if (!s) return '<span style="opacity:0.5">' + r + '</span>';
  var nm = (n||'').substring(0,25).replace(/['"/\\]/g,'');
  return '<span class="rest-timer idle" data-rest="' + r + '" ' +
    'onclick="buildTimerFloat();TMR.toggle(this,' + s + ',&quot;' + nm + '&quot;)" ' +
    'title="Tap to start">' +
    '<span class="rest-timer-label">' + r + '</span></span>';
}

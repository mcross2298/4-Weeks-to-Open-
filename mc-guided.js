/* ==========================================================================
   mc-guided.js — guided linear workout mode (Tier 4 Phase 5)
   --------------------------------------------------------------------------
   Opt-in overlay that works on ANY page using the shared exercise-card
   convention (.ex-card / .ss-card, as rendered by every flagship/influencer
   program day page plus run-workout.html/run-program.html) — no per-page
   wiring needed, the same principle mc-suggest.js already uses by attaching
   wherever .mcl-toggle exists. Loaded dynamically by mc-setlog.js (see the
   bottom of that file) rather than hand-added to each program page, since
   mc-setlog.js already has the broadest coverage of any shared script and
   is this feature's actual prerequisite (no .mcl-count badges, no signal).

   Auto-advance is pure external polling of the existing DOM — mc-setlog.js
   fires no completion event, and this file makes no edits to it or to
   mc-timer.js. A step counts complete when either (a) every mcl-count-<id>
   badge inside it reads done>=total, or (b) the lifter manually toggles
   .checked on it (each page's own existing tap-to-check behavior). One
   step = one top-level .ex-card or .ss-card, so a superset/triset block
   advances as a single unit — matching the station-anchoring day design.

   "Rest timer front-and-center": while active and mc-timer.js's #timerFloat
   is showing, a scrim dims everything behind it. mc-timer.js itself is
   untouched.
   ========================================================================== */
(function () {
  if (window.MC_GUIDED) return;

  var STEP_SEL = '.ex-card, .ss-card';
  var active = false;
  var steps = [];
  var current = 0;
  var poll = null;
  var entryBtn, exitBtn, scrim;

  function countDone(el) {
    // mc-setlog.js sets this badge's textContent to "done/total"; a step
    // whose Log Sets panel hasn't rendered yet just reads as not-done.
    var badge = el.querySelector('[class*="mcl-count-"]');
    if (!badge) return null;
    var m = /(\d+)\s*\/\s*(\d+)/.exec(badge.textContent || '');
    return m ? { done: +m[1], total: +m[2] } : null;
  }

  function isComplete(stepEl) {
    if (stepEl.classList.contains('checked')) return true;
    if (stepEl.classList.contains('ss-card')) {
      var exs = stepEl.querySelectorAll('.ss-ex');
      if (!exs.length) return false;
      return Array.prototype.every.call(exs, function (ex) {
        if (ex.classList.contains('checked')) return true;
        var c = countDone(ex);
        return !!(c && c.total > 0 && c.done >= c.total);
      });
    }
    var c = countDone(stepEl);
    return !!(c && c.total > 0 && c.done >= c.total);
  }

  function focusStep(i) {
    steps.forEach(function (s, idx) {
      s.classList.toggle('mc-guided-current', idx === i);
      s.classList.toggle('mc-guided-dim', idx !== i);
    });
    if (steps[i]) steps[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function tick() {
    if (!steps.length) return;
    if (!document.body.contains(steps[0])) { stop(); return; }  // page re-rendered (e.g. week switch) — bail out cleanly
    if (current < steps.length && isComplete(steps[current]) && current < steps.length - 1) {
      current++;
      focusStep(current);
    }
    var tf = document.getElementById('timerFloat');
    if (scrim) scrim.classList.toggle('show', !!(tf && tf.classList.contains('visible')));
  }

  function onStepClick(e) {
    var step = e.target.closest(STEP_SEL);
    if (!step) return;
    var i = steps.indexOf(step);
    if (i >= 0 && i !== current) { current = i; focusStep(current); }
  }

  function injectCSS() {
    if (document.getElementById('mcGuidedCss')) return;
    var st = document.createElement('style');
    st.id = 'mcGuidedCss';
    st.textContent =
      '.mc-guided-dim{opacity:0.35;filter:saturate(0.6);transition:opacity .2s,filter .2s;}' +
      '.mc-guided-current{transition:box-shadow .2s;box-shadow:0 0 0 2px var(--accent,#d4af37),0 8px 28px -10px rgba(0,0,0,.6);border-radius:14px;}' +
      '.mcgd-entry{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 14px;' +
        'padding:11px 16px;border-radius:12px;background:rgba(212,175,55,0.12);' +
        'border:1px solid rgba(212,175,55,0.3);color:#d4af37;font-size:13px;font-weight:800;' +
        'cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
      /* top offset clears mc-summary.css's .prog-bar-wrap.mcs-stat sticky bar
         (46px, only present once a session is active) with a safety margin */
      '.mcgd-exit{position:fixed;top:calc(58px + env(safe-area-inset-top));right:10px;z-index:170;' +
        'padding:8px 13px;border-radius:20px;background:rgba(10,10,11,.85);color:#e2e8f0;' +
        'border:1px solid rgba(255,255,255,.15);font-size:12px;font-weight:800;cursor:pointer;' +
        'backdrop-filter:blur(8px);-webkit-tap-highlight-color:transparent;display:none;}' +
      '.mcgd-scrim{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,0);pointer-events:none;' +
        'transition:background .25s;}' +
      '.mcgd-scrim.show{background:rgba(0,0,0,0.55);}';
    document.head.appendChild(st);
  }

  function buildExit() {
    exitBtn = document.createElement('div');
    exitBtn.className = 'mcgd-exit';
    exitBtn.textContent = '✕ Exit Guided';
    exitBtn.setAttribute('role', 'button');
    exitBtn.addEventListener('click', stop);
    document.body.appendChild(exitBtn);
  }

  function buildScrim() {
    scrim = document.createElement('div');
    scrim.className = 'mcgd-scrim';
    document.body.appendChild(scrim);
  }

  function start() {
    steps = Array.prototype.slice.call(document.querySelectorAll(STEP_SEL));
    if (!steps.length) return;
    active = true;
    if (entryBtn) entryBtn.style.display = 'none';
    if (!exitBtn) buildExit();
    exitBtn.style.display = 'block';
    if (!scrim) buildScrim();
    // resume at the first not-yet-complete step rather than always index 0
    current = steps.length - 1;
    for (var i = 0; i < steps.length; i++) { if (!isComplete(steps[i])) { current = i; break; } }
    focusStep(current);
    document.addEventListener('click', onStepClick, true);
    poll = setInterval(tick, 500);
  }

  function stop() {
    active = false;
    steps.forEach(function (s) { s.classList.remove('mc-guided-current', 'mc-guided-dim'); });
    if (entryBtn && document.body.contains(entryBtn)) entryBtn.style.display = '';
    if (exitBtn) exitBtn.style.display = 'none';
    if (scrim) scrim.classList.remove('show');
    document.removeEventListener('click', onStepClick, true);
    if (poll) { clearInterval(poll); poll = null; }
  }

  function buildEntry() {
    var found = document.querySelectorAll(STEP_SEL);
    if (!found.length) return;
    entryBtn = document.createElement('div');
    entryBtn.className = 'mcgd-entry';
    entryBtn.setAttribute('role', 'button');
    entryBtn.setAttribute('tabindex', '0');
    entryBtn.textContent = '🎯 Start Guided Mode';
    entryBtn.addEventListener('click', start);
    entryBtn.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); } });
    found[0].parentNode.insertBefore(entryBtn, found[0]);
  }

  function init() {
    injectCSS();
    if (!entryBtn || !document.body.contains(entryBtn)) buildEntry();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // Program pages render their exercise cards from an inline script that may
  // run after (or race with) this file — retry a few times, same pattern
  // mc-suggest.js uses for the same reason.
  [300, 900, 1800].forEach(function (d) { setTimeout(init, d); });

  window.MC_GUIDED = { start: start, stop: stop, isActive: function () { return active; } };
})();

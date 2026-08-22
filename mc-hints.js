/* ==========================================================================
   mc-hints.js — one-time contextual "first natural use" callouts
   --------------------------------------------------------------------------
   K-3.4/G-11/VOC-C1: the app has real depth (readiness, strain, cues,
   voice, the meatball's whole toolkit) but the Quick Tour is the only
   discovery surface for any of it — nothing ties a feature to the moment
   it would actually matter. This module owns the "have we shown this
   before" gate and the callout's visual/dismiss mechanics; call sites stay
   a couple of lines: MC_HINTS.show(id, targetEl, text) points a small
   dismissible callout at targetEl, exactly once ever per device
   (localStorage flag), and never shows again once seen or dismissed.

   Deliberately NOT auto-wired to any feature itself — each site decides
   what "first natural use" means for it (e.g. mc-card-actions.js calls
   this the first time a card's meatball renders on a workout page).
   ========================================================================== */
(function () {
  if (window.MC_HINTS) return;

  var KEY = 'mc_hints_seen_v1';
  var AUTO_MS = 6000;

  function seen() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function markSeen(id) {
    try { var s = seen(); s[id] = 1; localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  function injectCSS() {
    if (document.getElementById('mcHintsCss')) return;
    var s = document.createElement('style');
    s.id = 'mcHintsCss';
    s.textContent =
      '.mc-hint{position:absolute;z-index:230;max-width:240px;' +
        'display:flex;align-items:flex-start;gap:8px;padding:10px 10px 10px 12px;' +
        'background:#0e0e0e;color:#e2e8f0;border:1px solid rgba(251,191,36,0.4);border-radius:11px;' +
        'box-shadow:0 8px 24px rgba(0,0,0,0.45);font-size:12.5px;font-weight:600;line-height:1.4;' +
        'opacity:0;transform:translateY(6px);transition:opacity 0.2s ease,transform 0.2s ease;}' +
      '.mc-hint.show{opacity:1;transform:translateY(0);}' +
      '.mc-hint-txt{flex:1;min-width:0;}' +
      '.mc-hint-x{flex-shrink:0;appearance:none;border:0;background:none;color:#94a3b8;' +
        'font-size:13px;line-height:1;cursor:pointer;padding:2px;-webkit-tap-highlight-color:transparent;}' +
      'html[data-theme="light"] .mc-hint{background:#fff;color:#1c1a17;border-color:rgba(217,119,6,0.4);' +
        'box-shadow:0 8px 24px rgba(0,0,0,0.14);}' +
      'html[data-theme="light"] .mc-hint-x{color:#8a6d1a;}';
    document.head.appendChild(s);
  }

  // Most program pages reserve a fixed bottom strip for the Finish/Exit bar
  // + primary nav (roughly 140-160px, varies by page); a hint that always
  // drops BELOW its target can land underneath that strip, invisible or
  // overlapping a real CTA — verified live: a card near the bottom of the
  // viewport put the meatball hint half-hidden behind the Finish/Exit bar.
  // Flip above the target instead whenever below wouldn't clear it.
  var BOTTOM_SAFE = 150;
  function position(el, targetEl) {
    var r = targetEl.getBoundingClientRect();
    var h = el.offsetHeight;
    var fitsBelow = (r.bottom + 8 + h) <= (window.innerHeight - BOTTOM_SAFE);
    var top = fitsBelow ? (r.bottom + window.scrollY + 8) : (r.top + window.scrollY - h - 8);
    var maxLeft = window.scrollX + document.documentElement.clientWidth - el.offsetWidth - 10;
    var left = Math.min(Math.max(window.scrollX + 10, r.left + window.scrollX - 160), Math.max(window.scrollX + 10, maxLeft));
    el.style.top = top + 'px';
    el.style.left = left + 'px';
  }

  function show(id, targetEl, text) {
    if (!targetEl || !id) return;
    if (seen()[id]) return;
    // Mark seen the instant the hint is SHOWN, not when it's dismissed: the
    // call site (e.g. mc-card-actions.js's scan(), which re-runs on every
    // MC_SCAN pass) only checks seen() before calling show() — if "seen"
    // waited for a dismiss, a second scan pass firing before the athlete
    // reacts would find seen() still false and stack a duplicate hint. Real
    // bug, not hypothetical: caught live with 20+ .mc-hint elements piled up
    // within seconds of page load before this line existed.
    markSeen(id);
    injectCSS();

    var el = document.createElement('div');
    el.className = 'mc-hint';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span class="mc-hint-txt"></span>' +
      '<button type="button" class="mc-hint-x" aria-label="Dismiss">✕</button>';
    el.querySelector('.mc-hint-txt').textContent = text;
    document.body.appendChild(el);
    position(el, targetEl);

    var autoTimer = null, outsideBound = false;
    function dismiss() {
      clearTimeout(autoTimer);
      if (outsideBound) document.removeEventListener('click', onOutside, true);
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
    }
    function onOutside(e) { if (!el.contains(e.target) && e.target !== targetEl) dismiss(); }

    el.querySelector('.mc-hint-x').addEventListener('click', dismiss);
    requestAnimationFrame(function () { el.classList.add('show'); });
    autoTimer = setTimeout(dismiss, AUTO_MS);
    // Delay binding the outside-click listener one tick so the very click
    // that triggered "first natural use" (e.g. opening this card) doesn't
    // immediately dismiss the hint it just caused to appear.
    setTimeout(function () { outsideBound = true; document.addEventListener('click', onOutside, true); }, 50);
  }

  window.MC_HINTS = {
    show: show,
    seen: function (id) { return !!seen()[id]; }
  };
})();

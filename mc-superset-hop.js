/* ==========================================================================
   mc-superset-hop.js  —  auto-advance ("hop") between superset / triset members
   --------------------------------------------------------------------------
   When a user finishes one exercise inside a superset (A) or triset (A/B/C),
   the app advances them to the NEXT exercise in that block instead of leaving
   them to scroll and hunt:  finish Quad Extensions  ->  hop to Romanian
   Deadlifts, with its set logger opened. A short (default 10s) buffer with a
   SKIP button gives them time to set up the next station; skipping or letting
   it run out smooth-scrolls the next exercise into view and pulse-highlights it.

   What counts as "finishing" an exercise (either fires the hop):
     1. Checking off the LAST set in that exercise's set logger (the natural
        "I'm done logging this station" gesture), OR
     2. Tapping the exercise card to check it off.

   Design notes
   - Works by DELEGATION on the document in the CAPTURE phase, so it needs no
     edits to any page's inline render/click code (or to mc-setlog.js) and it
     survives re-renders. Both the card ".ss-ex" handler and the set-logger
     ".mcl-ck" handler call stopPropagation() in the BUBBLE phase, which does
     NOT affect a capture-phase listener that has already fired.
   - At capture time the elements have NOT yet toggled, so we read the PRE-toggle
     state to tell "checking ON" (advance) from "un-checking" (ignore), and we
     re-check the settled state on a 0ms timeout for set completion.
   - Advance is LINEAR: A->B (->C for trisets). The final member does NOT hop —
     that is the rest period, owned by the existing rest timer. The user scrolls
     back up for the next round.
   ========================================================================== */
(function () {
  if (window.__mcSSHop) return;
  window.__mcSSHop = true;

  var BUFFER_SECS = 10;          // buffer countdown length
  var RADIUS = 20;
  var C = 2 * Math.PI * RADIUS;  // progress-ring circumference

  // Card sub-elements that must NOT trigger a hop via the CARD-tap path.
  var IGNORE_SEL = [
    '.mcl-toggle', '.mcl-wrap', '.mcl-ck', '.mcl-inp',
    '.setlog-toggle', '.setlog-wrap', '.set-check', '.set-input',
    '.rest-timer', '.mc-meatball', '.mc-note', '.mc-reorder-ctrls',
    'input', 'button', 'a', 'select', 'textarea'
  ].join(',');

  // ---- styles (injected so the feature is self-contained) ----------------
  function injectStyles() {
    if (document.getElementById('sshop-styles')) return;
    var s = document.createElement('style');
    s.id = 'sshop-styles';
    s.textContent = [
      '.ss-ex{scroll-margin-top:84px;scroll-margin-bottom:140px;}',
      '.ss-ex.sshop-target{background:rgba(168,85,247,0.10);transition:background .3s;}',
      '.sshop-pulse{animation:sshopPulse 1.6s ease-out 1;}',
      '@keyframes sshopPulse{0%{box-shadow:inset 0 0 0 2px rgba(168,85,247,0.9);}' +
        '70%{box-shadow:inset 0 0 0 2px rgba(168,85,247,0);}' +
        '100%{box-shadow:inset 0 0 0 2px rgba(168,85,247,0);}}',
      '.sshop-buffer{position:fixed;left:0;right:0;bottom:0;z-index:130;' +
        'padding:14px 18px calc(14px + env(safe-area-inset-bottom));' +
        'background:rgba(13,6,24,0.97);backdrop-filter:blur(16px);' +
        '-webkit-backdrop-filter:blur(16px);border-top:1px solid rgba(168,85,247,0.45);' +
        'box-shadow:0 -6px 28px rgba(0,0,0,0.6);transform:translateY(120%);' +
        'transition:transform .28s cubic-bezier(.22,1,.36,1);' +
        'display:flex;align-items:center;gap:14px;}',
      '.sshop-buffer.show{transform:translateY(0);}',
      '.sshop-ring{position:relative;width:46px;height:46px;flex:0 0 46px;}',
      '.sshop-ring svg{transform:rotate(-90deg);display:block;}',
      '.sshop-ring-bg{stroke:rgba(168,85,247,0.18);}',
      '.sshop-ring-fg{stroke:#a855f7;stroke-linecap:round;' +
        'transition:stroke-dashoffset 1s linear;}',
      '.sshop-count{position:absolute;inset:0;display:flex;align-items:center;' +
        'justify-content:center;font-size:16px;font-weight:800;color:#e9d5ff;}',
      '.sshop-txt{flex:1;min-width:0;}',
      '.sshop-lead{font-size:10.5px;font-weight:800;letter-spacing:0.09em;' +
        'text-transform:uppercase;color:#c084fc;margin-bottom:3px;}',
      '.sshop-next{font-size:15px;font-weight:700;color:#fff;white-space:nowrap;' +
        'overflow:hidden;text-overflow:ellipsis;}',
      '.sshop-skip{flex:0 0 auto;background:rgba(168,85,247,0.18);' +
        'border:1px solid rgba(168,85,247,0.5);color:#e9d5ff;font-weight:800;' +
        'font-size:13px;letter-spacing:0.04em;padding:11px 18px;border-radius:10px;' +
        'cursor:pointer;-webkit-tap-highlight-color:transparent;}',
      '.sshop-skip:active{transform:scale(0.96);}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  // ---- buffer UI ----------------------------------------------------------
  var buffer, ringFg, countEl, nextEl, timer = null, remaining = 0, pending = null;

  function ensureBuffer() {
    if (buffer) return;
    buffer = document.createElement('div');
    buffer.className = 'sshop-buffer';
    buffer.setAttribute('role', 'status');
    buffer.innerHTML =
      '<div class="sshop-ring">' +
        '<svg width="46" height="46" viewBox="0 0 46 46">' +
          '<circle class="sshop-ring-bg" cx="23" cy="23" r="' + RADIUS + '" fill="none" stroke-width="4"/>' +
          '<circle class="sshop-ring-fg" cx="23" cy="23" r="' + RADIUS + '" fill="none" stroke-width="4" ' +
            'stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="0"/>' +
        '</svg>' +
        '<div class="sshop-count">' + BUFFER_SECS + '</div>' +
      '</div>' +
      '<div class="sshop-txt">' +
        '<div class="sshop-lead">⚡ Next up · get set</div>' +
        '<div class="sshop-next"></div>' +
      '</div>' +
      '<button class="sshop-skip" type="button">SKIP →</button>';
    document.body.appendChild(buffer);
    ringFg = buffer.querySelector('.sshop-ring-fg');
    countEl = buffer.querySelector('.sshop-count');
    nextEl = buffer.querySelector('.sshop-next');
    buffer.querySelector('.sshop-skip').addEventListener('click', function (e) {
      e.stopPropagation();
      finishBuffer();
    });
  }

  function exName(el) {
    var n = el.querySelector('.ss-name, .ex-name, .lift-name');
    return n ? n.textContent.trim() : 'Next exercise';
  }

  // Next member in the same superset/triset block. LINEAR (no wrap): the last
  // member returns null, because that transition is the rest period.
  function nextTarget(fromEl) {
    var card = fromEl.closest('.ss-card');
    if (!card) return null;
    var members = Array.prototype.slice.call(card.querySelectorAll('.ss-ex'));
    if (members.length < 2) return null;
    var idx = members.indexOf(fromEl);
    if (idx < 0 || idx >= members.length - 1) return null;
    return members[idx + 1];
  }

  function startBuffer(target) {
    pending = target;
    ensureBuffer();
    nextEl.textContent = exName(target);
    remaining = BUFFER_SECS;
    countEl.textContent = remaining;
    // reset ring to full without animating, then deplete over the countdown
    ringFg.style.transition = 'none';
    ringFg.style.strokeDashoffset = '0';
    void ringFg.offsetWidth; // reflow so the next change animates
    ringFg.style.transition = 'stroke-dashoffset 1s linear';
    buffer.classList.add('show');
    clearInterval(timer);
    timer = setInterval(function () {
      remaining--;
      countEl.textContent = Math.max(remaining, 0);
      ringFg.style.strokeDashoffset = (C * ((BUFFER_SECS - remaining) / BUFFER_SECS)).toFixed(2);
      if (remaining <= 0) finishBuffer();
    }, 1000);
  }

  function finishBuffer() {
    clearInterval(timer);
    timer = null;
    if (buffer) buffer.classList.remove('show');
    var t = pending;
    pending = null;
    if (t) hopTo(t);
  }

  // Open the target exercise's "Log Sets" dropdown so the user lands on its log.
  function openLog(el) {
    var wrap = el.querySelector('.mcl-wrap');
    var tog = el.querySelector('.mcl-toggle');
    if (wrap && !wrap.classList.contains('open')) {
      wrap.classList.add('open');
      if (tog) {
        tog.classList.add('open');
        var lbl = tog.querySelector('.mcl-lbl');
        if (lbl) lbl.textContent = 'Hide';
      }
    }
  }

  function hopTo(target) {
    openLog(target);
    try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    catch (e) { target.scrollIntoView(); }
    target.classList.add('sshop-pulse', 'sshop-target');
    setTimeout(function () { target.classList.remove('sshop-pulse'); }, 1700);
    setTimeout(function () { target.classList.remove('sshop-target'); }, 2600);
  }

  // ---- hop dispatch (debounced so the two trigger paths don't double-fire) -
  var lastFrom = null, lastT = 0;
  function triggerHop(fromEx) {
    var now = Date.now();
    if (fromEx === lastFrom && now - lastT < 2500) return;
    var target = nextTarget(fromEx);
    if (!target || target === fromEx) return;
    lastFrom = fromEx;
    lastT = now;
    setTimeout(function () { startBuffer(target); }, 60);
  }

  // ---- triggers (capture phase, before card/logger toggle their state) ----
  document.addEventListener('click', function (e) {
    // (1) Set-logger checkbox: hop when the LAST set of the exercise is checked.
    var ck = e.target.closest('.mcl-ck');
    if (ck) {
      var exC = ck.closest('.ss-ex[data-type="ssex"]');
      if (!exC) return;
      var wasDone = ck.classList.contains('done'); // pre-toggle
      // Re-check the SETTLED state after mc-setlog's onCheck has toggled it.
      setTimeout(function () {
        if (wasDone) return;                       // they un-checked a set
        var cks = exC.querySelectorAll('.mcl-ck');
        if (!cks.length) return;
        var allDone = Array.prototype.every.call(cks, function (c) {
          return c.classList.contains('done');
        });
        if (allDone) triggerHop(exC);
      }, 30);
      return;
    }

    // (2) Tapping the exercise card to check it off.
    var ex = e.target.closest('.ss-ex[data-type="ssex"]');
    if (!ex) return;
    if (e.target.closest(IGNORE_SEL)) return;
    var willCheck = !ex.classList.contains('checked'); // pre-toggle
    if (!willCheck) return;                            // un-checking -> no hop
    triggerHop(ex);
  }, true);

  injectStyles();
})();

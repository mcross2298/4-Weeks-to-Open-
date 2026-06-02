/* ==========================================================================
   mc-superset-hop.js  —  auto-advance ("hop") between superset / triset members
   --------------------------------------------------------------------------
   Supersets/trisets are run SET-BY-SET, alternating stations:
       A set1 -> B set1 -> A set2 -> B set2 -> ...   (A/B/C for trisets)
   So every time the user completes ONE set, the app hops them to the next
   station to enter that station's next set, with a short (default 10s) buffer
   and a SKIP button to set up. Example: complete Quad Extensions set 1 ->
   buffer -> land on Romanian Deadlifts (log open, set 1 highlighted).

   The hop targets the next station (cycling A->B->...->A) that STILL has an
   unlogged set. When every set of every member is logged, the superset is
   complete and no hop fires — the rest period (existing rest timer) takes over.

   Design notes
   - Pure DELEGATION on the document in the CAPTURE phase: no edits to any
     page's inline code or to mc-setlog.js, and it survives re-renders. The set
     logger's ".mcl-ck" handler calls stopPropagation() in the BUBBLE phase,
     which does NOT affect a capture-phase listener that already fired.
   - mc-setlog starts a rest timer when a set on the FINAL member is checked.
     On an in-between hop that is premature (you go straight to the next
     station), so we stop it; on the last set of the block we leave it running.
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
      '.mcl-row.sshop-nextset{box-shadow:inset 0 0 0 1.5px rgba(168,85,247,0.85);' +
        'border-radius:8px;}',
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

  // ---- helpers ------------------------------------------------------------
  function exName(el) {
    var n = el.querySelector('.ss-name, .ex-name, .lift-name');
    return n ? n.textContent.trim() : 'Next exercise';
  }
  // Index (0-based) of the first unlogged set row in a member, or -1 if none.
  function firstUndoneIdx(m) {
    var cks = m.querySelectorAll('.mcl-ck');
    for (var i = 0; i < cks.length; i++) {
      if (!cks[i].classList.contains('done')) return i;
    }
    return -1;
  }
  function hasUndoneSet(m) { return firstUndoneIdx(m) !== -1; }

  // Next station (cycling A->B->...->A) that still has an unlogged set.
  // Returns null when only the current member (or nobody) has work left.
  function nextStation(fromEl) {
    var card = fromEl.closest('.ss-card');
    if (!card) return null;
    var members = Array.prototype.slice.call(card.querySelectorAll('.ss-ex'));
    if (members.length < 2) return null;
    var i = members.indexOf(fromEl);
    if (i < 0) return null;
    for (var k = 1; k <= members.length; k++) {
      var m = members[(i + k) % members.length];
      if (m === fromEl) return null;     // wrapped back to self -> nobody else
      if (hasUndoneSet(m)) return m;
    }
    return null;
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

  function startBuffer(target) {
    pending = target;
    ensureBuffer();
    var setIdx = firstUndoneIdx(target);
    nextEl.textContent = exName(target) + (setIdx >= 0 ? ' · Set ' + (setIdx + 1) : '');
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

  // Open the target's "Log Sets" dropdown so the user lands on its log.
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
  // Outline the next set row to enter on the target.
  function highlightNextSet(el) {
    var idx = firstUndoneIdx(el);
    if (idx < 0) return;
    var rows = el.querySelectorAll('.mcl-row');
    var row = rows[idx];
    if (!row) return;
    row.classList.add('sshop-nextset');
    setTimeout(function () { row.classList.remove('sshop-nextset'); }, 3200);
  }

  function hopTo(target) {
    openLog(target);
    try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    catch (e) { target.scrollIntoView(); }
    target.classList.add('sshop-pulse', 'sshop-target');
    highlightNextSet(target);
    setTimeout(function () { target.classList.remove('sshop-pulse'); }, 1700);
    setTimeout(function () { target.classList.remove('sshop-target'); }, 2600);
  }

  // ---- hop dispatch (debounced so a single tap can't double-fire) ---------
  var lastFrom = null, lastT = 0;
  function triggerHop(fromEx) {
    var now = Date.now();
    if (fromEx === lastFrom && now - lastT < 1500) return;
    var target = nextStation(fromEx);
    if (!target || target === fromEx) return;
    lastFrom = fromEx;
    lastT = now;
    // In-between hops shouldn't sit under a freshly-started rest timer.
    try { if (typeof TMR !== 'undefined' && TMR.stop) TMR.stop(); } catch (e) {}
    setTimeout(function () { startBuffer(target); }, 60);
  }

  // ---- triggers (capture phase, before card/logger toggle their state) ----
  document.addEventListener('click', function (e) {
    // (1) Set-logger checkbox: hop on EACH set completion.
    var ck = e.target.closest('.mcl-ck');
    if (ck) {
      var exC = ck.closest('.ss-ex[data-type="ssex"]');
      if (!exC) return;
      var wasDone = ck.classList.contains('done'); // pre-toggle
      setTimeout(function () {
        if (wasDone) return;                        // they un-checked a set
        if (!ck.classList.contains('done')) return; // didn't end up checked
        triggerHop(exC);
      }, 40);
      return;
    }

    // (2) Tapping the exercise card to check it off (fallback gesture).
    var ex = e.target.closest('.ss-ex[data-type="ssex"]');
    if (!ex) return;
    if (e.target.closest(IGNORE_SEL)) return;
    var willCheck = !ex.classList.contains('checked'); // pre-toggle
    if (!willCheck) return;                            // un-checking -> no hop
    triggerHop(ex);
  }, true);

  injectStyles();
})();

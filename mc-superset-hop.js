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

   LOGGER-AGNOSTIC: PMC pages ship two different per-set loggers and they can
   even race each other in the DOM:
     - mc-setlog.js  -> ".mcl-toggle / .mcl-wrap / .mcl-row / .mcl-ck"
     - page-native   -> ".setlog-toggle / .setlog-wrap / .sl-row / .sl-ck"
   Both mark a completed set checkbox with ".done", so this module supports
   whichever one is actually rendered.

   Design notes
   - Pure DELEGATION on the document in the CAPTURE phase: no edits to any
     page's inline code or to mc-setlog.js, and it survives re-renders. Both
     loggers' checkbox handlers call stopPropagation() in the BUBBLE phase,
     which does NOT affect a capture-phase listener that already fired.
   - A logger starts a rest timer when a set on the final member is checked. On
     an in-between hop that is premature (you go straight to the next station),
     so we stop it; on the last set of the block we leave it running.
   ========================================================================== */
(function () {
  if (window.__mcSSHop) return;
  window.__mcSSHop = true;

  var BUFFER_SECS = 10;          // buffer countdown length
  var RADIUS = 20;
  var C = 2 * Math.PI * RADIUS;  // progress-ring circumference

  var CK_SEL = '.mcl-ck, .sl-ck'; // a "complete set" checkbox in either logger

  // Card sub-elements that must NOT trigger a hop via the CARD-tap path.
  var IGNORE_SEL = [
    '.mcl-toggle', '.mcl-wrap', '.mcl-ck', '.mcl-inp',
    '.setlog-toggle', '.setlog-wrap', '.sl-ck', '.sl-inp',
    '.set-check', '.set-input',
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
      '.mcl-row.sshop-nextset,.sl-row.sshop-nextset{' +
        'box-shadow:inset 0 0 0 1.5px rgba(168,85,247,0.85);border-radius:8px;}',
      '.sshop-buffer{position:fixed;left:0;right:0;bottom:0;z-index:1000;' +
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
      '.sshop-skip:active{transform:scale(0.96);}',
      // round-break (long "after" rest) gets a stronger tint than a quick hop
      '.sshop-buffer.sshop-rest{border-top-color:rgba(168,85,247,0.85);' +
        'box-shadow:0 -6px 30px rgba(88,28,135,0.55);}',
      '.sshop-rest .sshop-lead{color:#d8b4fe;}',
      '.sshop-rest .sshop-ring-fg{stroke:#c084fc;}'
    ].join('');
    (document.head || document.documentElement).appendChild(s);
  }

  // ---- logger-agnostic helpers -------------------------------------------
  function exName(el) {
    var n = el.querySelector('.ss-name, .ex-name, .lift-name');
    return n ? n.textContent.trim() : 'Next exercise';
  }
  // The active logger's set checkboxes for a member (prefer mcl, else native).
  function setChecks(m) {
    var mcl = m.querySelectorAll('.mcl-ck');
    return mcl.length ? mcl : m.querySelectorAll('.sl-ck');
  }
  // The active logger's set rows for a member.
  function setRows(m) {
    return m.querySelector('.mcl-ck')
      ? m.querySelectorAll('.mcl-row')
      : m.querySelectorAll('.sl-row');
  }
  // Index (0-based) of the first unlogged set in a member, or -1 if none.
  function firstUndoneIdx(m) {
    var cks = setChecks(m);
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

  // Open the target's log dropdown (either logger) so the user lands on its log.
  function openLog(el) {
    var w = el.querySelector('.mcl-wrap'), t = el.querySelector('.mcl-toggle');
    if (w) {
      if (!w.classList.contains('open')) {
        w.classList.add('open');
        if (t) {
          t.classList.add('open');
          var l = t.querySelector('.mcl-lbl');
          if (l) l.textContent = 'Hide';
        }
      }
      return;
    }
    var nw = el.querySelector('.setlog-wrap'), nt = el.querySelector('.setlog-toggle');
    if (nw && !nw.classList.contains('open')) {
      nw.classList.add('open');
      if (nt) {
        var lbl = nt.querySelector('[id^="sll-"]'); if (lbl) lbl.textContent = 'HIDE';
        var arr = nt.querySelector('[id^="sla-"]'); if (arr) arr.textContent = '▴';
      }
    }
  }
  // Outline the next set row to enter on the target.
  function highlightNextSet(el) {
    var idx = firstUndoneIdx(el);
    if (idx < 0) return;
    var row = setRows(el)[idx];
    if (!row) return;
    row.classList.add('sshop-nextset');
    setTimeout(function () { row.classList.remove('sshop-nextset'); }, 3200);
  }

  // ---- buffer UI ----------------------------------------------------------
  var buffer, ringFg, countEl, nextEl, leadEl, timer = null, remaining = 0,
      activeSecs = BUFFER_SECS, pending = null;

  function fmtCount(s) {
    if (s >= 60) { var m = Math.floor(s / 60), x = s % 60; return m + ':' + String(x < 10 ? '0' + x : x); }
    return String(s);
  }

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
    leadEl = buffer.querySelector('.sshop-lead');
    buffer.querySelector('.sshop-skip').addEventListener('click', function (e) {
      e.stopPropagation();
      finishBuffer();
    });
  }

  // Sit the buffer directly above any fixed bottom bar (e.g. the Finish
  // Workout / Summary bar) so it is never clipped behind it.
  function bottomOffset() {
    var bars = document.querySelectorAll('.fw-bar, .timer-float');
    var off = 0;
    Array.prototype.forEach.call(bars, function (b) {
      var cs = getComputedStyle(b);
      if (cs.display !== 'none' && cs.visibility !== 'hidden' && cs.position === 'fixed') {
        off = Math.max(off, b.offsetHeight || 0);
      }
    });
    return off;
  }

  function startBuffer(target, info) {
    info = info || { secs: BUFFER_SECS, boundary: false, manageRest: false };
    pending = target;
    ensureBuffer();
    // When the card manages its own rest (data-between/data-after), claim the rest
    // UI: kill any float a logger just started on this set-check so the buffer
    // is the single countdown. Cards without the data attrs are untouched.
    if (info.manageRest) { try { if (typeof TMR !== 'undefined' && TMR.stop) TMR.stop(); } catch (e) {} }
    var off = bottomOffset();
    buffer.style.bottom = off + 'px';
    buffer.style.paddingBottom = off > 0 ? '14px' : 'calc(14px + env(safe-area-inset-bottom))';
    var setIdx = firstUndoneIdx(target);
    if (leadEl) leadEl.textContent = info.boundary ? '⚡ Round rest · next round' : '⚡ Next up · get set';
    buffer.classList.toggle('sshop-rest', !!info.boundary);
    nextEl.textContent = exName(target) + (setIdx >= 0 ? ' · Set ' + (setIdx + 1) : '');
    activeSecs = info.secs || BUFFER_SECS;
    remaining = activeSecs;
    countEl.textContent = fmtCount(remaining);
    // reset ring to full without animating, then deplete over the countdown
    ringFg.style.transition = 'none';
    ringFg.style.strokeDashoffset = '0';
    void ringFg.offsetWidth; // reflow so the next change animates
    ringFg.style.transition = 'stroke-dashoffset 1s linear';
    buffer.classList.add('show');
    clearInterval(timer);
    timer = setInterval(function () {
      remaining--;
      countEl.textContent = fmtCount(Math.max(remaining, 0));
      ringFg.style.strokeDashoffset = (C * ((activeSecs - remaining) / activeSecs)).toFixed(2);
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
  // Decide how long the buffer should run. Cards that opt in via
  // data-between / data-after (the mc-group-split superset/triset splitter) get a SHORT
  // member→member pause inside a round and the LONG round-break rest when the
  // hop wraps back to an earlier station. Cards without those attrs (PMC, MC, …)
  // fall back to the original fixed BUFFER_SECS for every hop — unchanged.
  function restInfoFor(fromEx, target) {
    var card = fromEx.closest('.ss-card');
    var members = card ? Array.prototype.slice.call(card.querySelectorAll('.ss-ex')) : [];
    var fi = members.indexOf(fromEx), ti = members.indexOf(target);
    var boundary = (ti >= 0 && fi >= 0 && ti <= fi);   // wrapped to an earlier station = round done
    var betA = card && card.getAttribute('data-between');
    var aftA = card && card.getAttribute('data-after');
    if (betA == null && aftA == null) return { secs: BUFFER_SECS, boundary: false, manageRest: false };
    var bet = parseInt(betA != null ? betA : BUFFER_SECS, 10);
    var aft = parseInt(aftA != null ? aftA : betA, 10);
    var secs = boundary ? aft : bet;
    if (!secs || isNaN(secs)) secs = BUFFER_SECS;
    return { secs: secs, boundary: boundary, manageRest: true };
  }

  var lastFrom = null, lastT = 0;
  function triggerHop(fromEx) {
    var now = Date.now();
    if (fromEx === lastFrom && now - lastT < 1500) return;
    var target = nextStation(fromEx);
    if (!target || target === fromEx) return;
    lastFrom = fromEx;
    lastT = now;
    var info = restInfoFor(fromEx, target);
    // In-between hops shouldn't sit under a freshly-started rest timer.
    try { if (typeof TMR !== 'undefined' && TMR.stop) TMR.stop(); } catch (e) {}
    setTimeout(function () { startBuffer(target, info); }, 60);
  }

  // ---- triggers (capture phase, before card/logger toggle their state) ----
  document.addEventListener('click', function (e) {
    // (1) Set-logger checkbox (either logger): hop on EACH set completion.
    var ck = e.target.closest(CK_SEL);
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

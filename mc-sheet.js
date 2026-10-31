/* ==========================================================================
   mc-sheet.js — one sheet contract, and Back that does what it looks like
   --------------------------------------------------------------------------
   Flagship readiness R5 (D-15, D-16). Every overlay in this app was built by
   its own module, and measured across eleven of them: three carried a dialog
   role, four moved focus, one closed on Escape, one locked the page behind
   it. And the phone's Back gesture had no handling anywhere, so from an open
   day — or with a sheet up — it left the page for the dashboard.

   This module gives every sheet the same contract without each module having
   to adopt it:

     * role="dialog" + aria-modal on the overlay, focus moved in on open and
       back to where it came from on close, Tab kept inside;
     * Escape closes it, and so does Back;
     * the page behind does not scroll.

   It ADOPTS overlays rather than asking each module to call in: after a
   click, a key, a history move or a render, it looks for a visible overlay
   from SHEET_SEL (or any element marked data-mc-sheet). That is deliberately
   not a subtree attribute observer: tools/measure-session.js counts mutation
   records delivered to the app's observers, and an attribute observer on the
   body would see every set row's class change. Closing goes through the
   module's own path — a click on its backdrop, which every adopted overlay
   already treats as "close", or its cancel button as a fallback — so a module
   never ends up with a sheet it thinks is open.

   Opening a day on the F3 day-list pages (any page that renders the shared
   .mc-day-back control) is a history entry too, and Back returns to the list
   by pressing that control, so no engine needed a change.

   HISTORY RULE: this module never calls history.back() on its own initiative
   — a module that closes its sheet and then navigates (Browse all → the
   exercise library) would have that navigation cancelled by a back() queued a
   moment earlier. An entry whose sheet or day was closed on screen is marked
   SPENT instead (replaceState), and the next Back that lands past a spent
   entry steps over it, so one press still does what it looks like it should.

   window.MC_SHEET:
     confirm(message, {ok, cancel, danger}) -> Promise<boolean>
     alert(message, {ok}) -> Promise<void>
       In-app replacements for window.confirm/alert, built on this contract.
     check()  re-scan now (for an overlay opened from a timer, not a click)
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_SHEET) return;

  var SHEET_SEL = [
    '.mc-menu-overlay', '.fw-modal-overlay', '.fw-recap-overlay', '.acct-overlay',
    '.mct-overlay', '.mcgs-overlay', '.mcq-overlay', '.bc-overlay', '.mcis-overlay',
    '.mc-pm-overlay', '[data-mc-sheet]'
  ].join(',');
  var CANCEL_SEL = '[data-mc-sheet-cancel],[data-sub="cancel"],[data-act="cancel"],.mc-item-cancel,' +
    '.fw-cancel,[aria-label="Close"],[aria-label="close"],.close,.sheet-close,.mcis-cancel';
  var FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  var stack = [];            // adopted sheets, newest last: {el, id, returnTo, popped}
  var seq = 0;
  var lastPointerTarget = null;

  // ---- history -------------------------------------------------------------
  function mine(st) { return !!(st && (st.mcSheet || st.mcDay || st.mcSpent)); }
  function push(state) {
    try {
      var cur = history.state;
      if (cur && cur.mcSpent) history.replaceState(state, '');
      else history.pushState(state, '');
    } catch (e) {}
  }
  function spend(state) {
    try {
      var cur = history.state;
      if (cur && state && ((state.mcSheet && cur.mcSheet === state.mcSheet) || (state.mcDay && cur.mcDay === state.mcDay))) {
        history.replaceState({ mcSpent: 1 }, '');
      }
    } catch (e) {}
  }
  // A reload keeps the history entry and loses the sheet or day behind it.
  try { if (mine(history.state) && !history.state.mcSpent) history.replaceState({ mcSpent: 1 }, ''); } catch (e) {}

  // ---- visibility ------------------------------------------------------------
  function visible(el) {
    if (!el || !el.isConnected) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') return false;
    if (parseFloat(cs.opacity || '1') < 0.05) return false;
    return true;
  }

  // ---- scroll lock -----------------------------------------------------------
  // overflow:hidden on the root keeps scrollY where it was (no jump on
  // close), and overscroll-behavior on the overlay stops a scroll inside the
  // sheet chaining out to the page.
  var locked = false, prevHtml = '', prevBody = '';
  function lock() {
    if (locked) return;
    locked = true;
    prevHtml = document.documentElement.style.overflow;
    prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
  function unlock() {
    if (!locked || stack.length) return;
    locked = false;
    document.documentElement.style.overflow = prevHtml;
    document.body.style.overflow = prevBody;
  }

  // ---- adopt / release -------------------------------------------------------
  function adopt(el) {
    var id = 'sheet' + (++seq);
    var entry = { el: el, id: id, returnTo: document.activeElement && document.activeElement !== document.body
      ? document.activeElement : lastPointerTarget, popped: false };
    stack.push(entry);
    if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    if (!el.style.overscrollBehavior) el.style.overscrollBehavior = 'contain';
    lock();
    push({ mcSheet: id });
    // Focus the sheet's first control, without scrolling anything.
    setTimeout(function () {
      if (stack.indexOf(entry) < 0) return;
      if (el.contains(document.activeElement)) return;
      var f = el.querySelector(FOCUSABLE);
      try { (f || el).focus({ preventScroll: true }); } catch (e) {}
    }, 30);
  }
  function release(entry) {
    var i = stack.indexOf(entry);
    if (i < 0) return;
    stack.splice(i, 1);
    if (!entry.popped) spend({ mcSheet: entry.id });
    unlock();
    var back = entry.returnTo;
    if (back && back.isConnected && typeof back.focus === 'function') {
      try { back.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  // Close a sheet the way its own module does.
  function requestClose(entry) {
    var el = entry.el;
    try { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    setTimeout(function () {
      if (!visible(el)) { check(); return; }
      var c = el.querySelector(CANCEL_SEL);
      if (c) c.click();
      setTimeout(check, 60);
    }, 60);
  }

  // ---- the F3 day view as a history entry ------------------------------------
  var dayState = null;            // the mcDay id we pushed, or 'deep' for a ?day= landing
  var dayChecked = false;
  function checkDay() {
    var back = document.querySelector('.mc-day-back');
    if (!dayChecked) {
      dayChecked = true;
      if (back) { dayState = 'deep'; return; }   // landed straight in a day: Back leaves, as it should
    }
    if (back && !dayState) {
      dayState = 'day' + (++seq);
      push({ mcDay: dayState });
    } else if (!back && dayState) {
      if (dayState !== 'deep') spend({ mcDay: dayState });
      dayState = null;
    }
  }

  // ---- the scan ----------------------------------------------------------------
  function check() {
    // released: a sheet its module has closed
    stack.slice().forEach(function (e) { if (!visible(e.el)) release(e); });
    // adopted: a sheet that is showing now
    var all = document.querySelectorAll(SHEET_SEL);
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (stack.some(function (e) { return e.el === el; })) continue;
      if (visible(el)) adopt(el);
    }
    checkDay();
  }
  var t1 = null, t2 = null;
  function soon() {
    clearTimeout(t1); clearTimeout(t2);
    t1 = setTimeout(check, 50);
    t2 = setTimeout(check, 420);    // after an open/close transition settles
  }

  document.addEventListener('pointerdown', function (e) { lastPointerTarget = e.target; }, true);
  document.addEventListener('click', soon, true);
  document.addEventListener('keydown', function (e) {
    var top = stack[stack.length - 1];
    if (e.key === 'Escape' && top) {
      e.preventDefault();
      requestClose(top);
      return;
    }
    if (e.key === 'Tab' && top) {
      var f = Array.prototype.filter.call(top.el.querySelectorAll(FOCUSABLE), function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!top.el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      return;
    }
    soon();
  }, true);

  // The phone's Back gesture.
  var lastState = (function () { try { return history.state; } catch (e) { return null; } })();
  window.addEventListener('popstate', function (e) {
    var left = lastState;
    lastState = e.state;
    // Stepped back off a spent entry: it looked exactly like the one below
    // it, so keep going — one press, one visible step.
    if (left && left.mcSpent) {
      try { history.back(); } catch (er) {}
      return;
    }
    var top = stack[stack.length - 1];
    if (top && left && left.mcSheet === top.id) {
      top.popped = true;
      requestClose(top);
      return;
    }
    if (left && left.mcDay && left.mcDay === dayState) {
      var back = document.querySelector('.mc-day-back');
      dayState = null;
      if (back) back.click();
      setTimeout(check, 60);
    }
  });
  // keep lastState in step with our own pushes/replaces
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    if (!orig) return;
    history[m] = function (state) {
      var r = orig.apply(this, arguments);
      lastState = state;
      return r;
    };
  });

  if (window.MC_SCAN && MC_SCAN.subscribe) {
    MC_SCAN.subscribe(function () { soon(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(check, 300); });
  else setTimeout(check, 300);

  // ---- confirm / alert ---------------------------------------------------------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function injectCss() {
    if (document.getElementById('mcSheetCss')) return;
    var st = document.createElement('style');
    st.id = 'mcSheetCss';
    st.textContent =
      // Above the bottom nav (--z-nav 140) and level with the card sheets (1350),
      // which an in-app confirm is usually opened from.
      '.mcsh-overlay{position:fixed;inset:0;z-index:1360;background:rgba(0,0,0,0.55);display:flex;' +
        'align-items:flex-end;justify-content:center;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom));}' +
      '.mcsh-card{width:100%;max-width:440px;background:var(--surface,#141311);color:var(--text,#faf7f0);' +
        'border:1px solid var(--hairline,rgba(255,255,255,0.1));border-radius:var(--r-lg,16px);padding:18px 16px 14px;' +
        'box-shadow:0 12px 40px rgba(0,0,0,0.5);}' +
      '.mcsh-msg{font-size:15px;line-height:1.45;white-space:pre-line;margin:0 0 14px;}' +
      '.mcsh-row{display:flex;gap:8px;}' +
      '.mcsh-btn{flex:1;min-height:48px;border-radius:var(--r-md,12px);font:inherit;font-size:15px;font-weight:800;' +
        'cursor:pointer;border:1px solid var(--hairline,rgba(255,255,255,0.14));background:transparent;color:inherit;}' +
      '.mcsh-btn.ok{background:var(--accent,#e6c579);color:#1c1a17;border-color:transparent;}' +
      '.mcsh-btn.ok.danger{background:#dc2626;color:#fff;}' +
      'html[data-theme="light"] .mcsh-card{background:#fffdf8;color:#1c1a17;border-color:rgba(28,26,23,0.12);}';
    document.head.appendChild(st);
  }
  function dialog(message, opts, withCancel) {
    opts = opts || {};
    return new Promise(function (resolve) {
      injectCss();
      var ov = document.createElement('div');
      ov.className = 'mcsh-overlay';
      ov.setAttribute('data-mc-sheet', '');
      ov.setAttribute('role', 'alertdialog');
      ov.innerHTML = '<div class="mcsh-card"><p class="mcsh-msg">' + esc(message) + '</p><div class="mcsh-row">' +
        (withCancel ? '<button type="button" class="mcsh-btn" data-mc-sheet-cancel>' + esc(opts.cancel || 'Cancel') + '</button>' : '') +
        '<button type="button" class="mcsh-btn ok' + (opts.danger ? ' danger' : '') + '" data-mcsh-ok>' + esc(opts.ok || 'OK') + '</button>' +
        '</div></div>';
      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        ov.remove();
        check();
        resolve(v);
      }
      ov.addEventListener('click', function (e) {
        if (e.target.closest('[data-mcsh-ok]')) finish(true);
        else if (e.target === ov || e.target.closest('[data-mc-sheet-cancel]')) finish(withCancel ? false : true);
      });
      document.body.appendChild(ov);
      check();
      var ok = ov.querySelector('[data-mcsh-ok]');
      setTimeout(function () { try { (withCancel ? ov.querySelector('[data-mc-sheet-cancel]') : ok).focus({ preventScroll: true }); } catch (e) {} }, 40);
    });
  }

  // ---- ghost taps ----------------------------------------------------------
  // QA cycle 2 (qa-collision-audit.md): a second tap that lands where the
  // first one did, a moment later, on a DIFFERENT control is not a decision
  // the athlete made. Something appeared or moved under the finger between
  // the two taps. Measured, each with a double-tap 120ms apart:
  //   Log workout -> Session Complete opens with Done on the same spot, and
  //                  closes before it is read;
  //   last set    -> the auto-opened recap's backdrop takes the second tap
  //                  and closes it;
  //   ⋯ menu      -> the second tap picks "Replace exercise";
  //   Skip        -> the next exercise expands under the finger and the
  //                  second tap TICKS ITS FIRST SET (a phantom logged set);
  //   + Set       -> lands on another card's strip or a weight field.
  // So: within GHOST_MS and GHOST_PX of the previous tap, a tap on a control
  // that is not the same one is swallowed. "The same one" is compared by
  // tag, class and text, so a control re-rendered in place (+ Set, +15s)
  // still takes a deliberate double tap. Window capture runs before every
  // document-level listener. Keyboard activations (no pointer) never count,
  // and neither does a mouse: a ghost tap is a finger's second tap, and a
  // mouse user who clicks Replace and then the first suggestion fast is
  // choosing both (it failed the swap journeys on CI, where a scripted mouse
  // picks a substitute well inside 450ms).
  var GHOST_MS = 450, GHOST_PX = 24;
  var lastTap = null, ghost = false;
  function tapTarget(t) {
    var el = t && t.closest ? t.closest('button,a,input,select,textarea,label,[role="button"],[role="checkbox"],[onclick],.mcl-strip') : null;
    return el || t;
  }
  function sig(el) {
    if (!el || !el.tagName) return '';
    return el.tagName + '|' + (typeof el.className === 'string' ? el.className.replace(/\b(done|open|active|is-done|mcl-ghost)\b/g, '').replace(/\s+/g, ' ').trim() : '') +
      '|' + (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  window.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') { lastTap = null; ghost = false; return; }
    var el = tapTarget(e.target), now = Date.now();
    ghost = !!(lastTap && now - lastTap.t < GHOST_MS &&
      Math.abs(e.clientX - lastTap.x) < GHOST_PX && Math.abs(e.clientY - lastTap.y) < GHOST_PX &&
      el !== lastTap.el && sig(el) !== lastTap.sig);
    // a swallowed tap does not become the reference for the next one
    if (!ghost) lastTap = { t: now, x: e.clientX, y: e.clientY, el: el, sig: sig(el) };
  }, true);
  function swallow(e) {
    if (!ghost) return;
    if (e.type === 'click') { if (!e.detail) return; ghost = false; }
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  window.addEventListener('touchend', swallow, true);   // also stops the focus a tap gives an input
  window.addEventListener('mousedown', swallow, true);
  window.addEventListener('click', swallow, true);

  window.MC_SHEET = {
    confirm: function (message, opts) { return dialog(message, opts, true); },
    alert: function (message, opts) { return dialog(message, opts, false).then(function () {}); },
    check: check
  };
})();

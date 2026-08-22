/* ==========================================================================
   mc-resume.js  —  Resume-last-workout banner for program category pages
   --------------------------------------------------------------------------
   Renders a single GLOBAL "Resume last workout" banner near the top of every
   program "inside" page (cat-*.html). The banner points at whichever workout
   the user last had in progress, regardless of which program owns it.

   Source of truth: localStorage['mc_activity'].last, written by
   mc-live-tracker.js on workout pages. This module reads that store DIRECTLY
   (mc-live-tracker.js is not loaded on category pages) and stays self-contained.

   Show conditions (MUST stay byte-identical to mc-live-tracker.js's read-side
   filter in window.MCActivity.get):
     • last exists
     • last.done > 0 && last.done < last.total   (work started, not complete)
     • !last.dismissed                            (user hasn't dismissed it)
     • Date.now() - last.ts <= EXPIRE_MS          (not stale, 36h window)

   Self-contained IIFE. Injects its own scoped <style> so no per-page CSS edit
   is needed.
   ========================================================================== */
(function () {
  if (window.__mcResume) return;             // guard against double-include
  window.__mcResume = true;

  var ACT_KEY   = 'mc_activity';
  var EXPIRE_MS = 36 * 3600 * 1000;          // keep identical to mc-live-tracker.js

  // ---- page detection -----------------------------------------------------
  var page = (location.pathname.split('/').pop() || '').toLowerCase();
  var onDashboard = (page === 'dashboard.html' || page === '' || page === 'index.html');
  if (page.indexOf('cat-') !== 0 && !onDashboard) return;  // category pages + dashboard

  // ---- storage ------------------------------------------------------------
  function readAct() {
    try { return JSON.parse(localStorage.getItem(ACT_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeAct(a) { try { localStorage.setItem(ACT_KEY, JSON.stringify(a)); } catch (e) {} }

  function isResumable(L) {
    return !!(L && L.done > 0 && L.done < L.total && !L.dismissed &&
              (Date.now() - L.ts) <= EXPIRE_MS);
  }

  // ---- time-ago -----------------------------------------------------------
  function ago(ts) {
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return 'Started ' + m + 'm ago';
    var h = Math.round(m / 60);
    if (h < 24) return 'Started ' + h + 'h ago';
    return 'Started ' + Math.round(h / 24) + 'd ago';
  }

  // ---- styles (scoped; mirrors dashboard's .gz-resume look) ---------------
  function injectCSS() {
    if (document.getElementById('mcrCss')) return;
    var s = document.createElement('style');
    s.id = 'mcrCss';
    s.textContent =
      '.mcr-banner{display:flex;align-items:center;gap:10px;margin:0 0 18px;' +
        'background:rgba(132,204,22,0.12);border:1px solid rgba(132,204,22,0.32);' +
        'border-radius:12px;padding:10px 12px;cursor:pointer;' +
        '-webkit-tap-highlight-color:transparent;transition:background 0.15s,transform 0.1s;}' +
      '.mcr-banner:active{background:rgba(132,204,22,0.22);transform:scale(0.99);}' +
      '.mcr-ico{font-size:18px;}' +
      '.mcr-body{min-width:0;flex:1;}' +
      '.mcr-lbl{font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#84cc16;}' +
      '.mcr-name{font-size:13px;font-weight:800;color:#f0fdf4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.mcr-ago{font-size:11px;font-weight:700;color:#94a3b8;margin-top:2px;}' +
      '.mcr-prog{font-size:11px;font-weight:700;color:#a3e635;margin-left:auto;flex-shrink:0;}' +
      '.mcr-arrow{color:#d9f99d;font-size:15px;flex-shrink:0;}' +
      '.mcr-dismiss{background:none;border:0;color:#94a3b8;font-size:15px;line-height:1;' +
        'padding:4px 6px;margin-left:2px;flex-shrink:0;cursor:pointer;' +
        '-webkit-tap-highlight-color:transparent;}' +
      '.mcr-dismiss:active{color:#e2e8f0;}';
    document.head.appendChild(s);
  }

  // ---- find where to drop the banner --------------------------------------
  function insertBanner(node) {
    // dashboard: slot the banner right above the Current Program section
    var dash = document.getElementById('scr-dashboard');
    if (dash) {
      var sec = dash.querySelector('.sec-header');
      if (sec) {
        node.style.margin = '0 18px 18px';
        sec.parentNode.insertBefore(node, sec);
        return;
      }
    }

    var back = document.querySelector('.back-link');
    if (back && back.parentNode) { back.parentNode.insertBefore(node, back.nextSibling); return; }

    var backNav = document.querySelector('.back-nav');
    if (backNav && backNav.parentNode) { backNav.parentNode.insertBefore(node, backNav.nextSibling); return; }

    var header = document.querySelector('.header');
    if (header && header.parentNode) { header.parentNode.insertBefore(node, header); return; }

    var sec = document.querySelector('.sec-head, .plan-card');
    if (sec && sec.parentNode) { sec.parentNode.insertBefore(node, sec); return; }

    var wrap = document.querySelector('#view-dashboard, .container, .wrap, .page-wrap');
    if (wrap) { wrap.insertBefore(node, wrap.firstChild); return; }

    document.body.insertBefore(node, document.body.firstChild);
  }

  // ==========================================================================
  //  VOC-C2: "Session saved" reassurance toast — walking away mid-session
  //  already worked (mc-live-tracker.js's logSession() writes mc_activity.last
  //  on 'pagehide', the moment a nav-bar tap navigates away) but nothing ever
  //  *said so*, so the athlete had no confirmation their sets weren't lost.
  //  One hook, no new state: L.ts is already fresh (written on the pagehide
  //  that got us here) the instant this page loads right after leaving an
  //  active session, so a small recency check on the SAME store the persistent
  //  banner below already reads is enough to tell "just left" from "resuming
  //  later" — no separate store needed. A sessionStorage flag only guards
  //  against a double-fire (e.g. the dashboard re-rendering its screen without
  //  a full reload); it isn't itself the trigger.
  // ==========================================================================
  var TOAST_RECENT_MS = 8000;

  function injectToastCSS() {
    if (document.getElementById('mcrToastCss')) return;
    var s = document.createElement('style');
    s.id = 'mcrToastCss';
    s.textContent =
      '.mcr-toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%) translateY(12px);' +
        'z-index:220;display:flex;align-items:center;gap:8px;max-width:calc(100% - 32px);' +
        'background:rgba(15,23,42,0.96);border:1px solid rgba(132,204,22,0.4);border-radius:11px;' +
        'padding:10px 14px;box-shadow:0 8px 24px rgba(0,0,0,0.4);' +
        'font-size:12.5px;font-weight:700;color:#f0fdf4;white-space:nowrap;' +
        'opacity:0;transition:opacity 0.25s ease,transform 0.25s ease;pointer-events:none;}' +
      '.mcr-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}' +
      '.mcr-toast .mcr-toast-ico{color:#84cc16;font-size:14px;}';
    document.head.appendChild(s);
  }

  function maybeShowSavedToast(L) {
    if (!L || (Date.now() - L.ts) > TOAST_RECENT_MS) return;
    var shownKey = 'mc_resume_toast_shown';
    try { if (sessionStorage.getItem(shownKey) === String(L.ts)) return; } catch (e) {}
    injectToastCSS();
    var el = document.createElement('div');
    el.className = 'mcr-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = '<span class="mcr-toast-ico">✓</span><span>Session saved — resume from the dashboard</span>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 3200);
    try { sessionStorage.setItem(shownKey, String(L.ts)); } catch (e) {}
  }

  // ---- render -------------------------------------------------------------
  function render() {
    // Never show on an active workout view that happens to be a cat- page.
    // Checks for real exercise cards, not '.fw-bar' (Volume II Phase 5 /
    // Initiative 07 fix): mc-finish.js now loads on every cat-*.html page
    // for capability-contract parity, and it injects '#fwBar' unconditionally
    // on load regardless of whether the page has any exercise cards to
    // finish — a split-picker LANDING view (no cards yet) always had a
    // '.fw-bar' in the DOM once mc-finish.js loaded there, which silently
    // suppressed this banner on every such page.
    if (document.querySelector('.ex-card, .ss-card')) return;

    var a = readAct(), L = a.last;
    if (!isResumable(L)) return;

    maybeShowSavedToast(L);
    injectCSS();

    // a session synced in from another device gets called out as such
    var otherDevice = false;
    try {
      var myDev = localStorage.getItem('mc_device_id');
      otherDevice = !!(L.deviceId && myDev && L.deviceId !== myDev);
    } catch (e) {}

    var el = document.createElement('div');
    el.className = 'mcr-banner';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.innerHTML =
      '<span class="mcr-ico">↩️</span>' +
      '<div class="mcr-body">' +
        '<div class="mcr-lbl">' + (otherDevice ? 'Resume — from your other device' : 'Resume last workout') + '</div>' +
        '<div class="mcr-name"></div>' +
        '<div class="mcr-ago"></div>' +
      '</div>' +
      '<span class="mcr-prog">' + L.done + '/' + L.total + '</span>' +
      '<span class="mcr-arrow">→</span>' +
      '<button class="mcr-dismiss" aria-label="Dismiss">✕</button>';
    el.querySelector('.mcr-name').textContent = L.title;   // textContent = no HTML injection
    el.querySelector('.mcr-ago').textContent = ago(L.ts);

    function go() { location.href = L.pageId; }
    el.addEventListener('click', go);
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); }
    });
    el.querySelector('.mcr-dismiss').addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      var cur = readAct();
      if (cur.last) { cur.last.dismissed = true; writeAct(cur); }
      if (el.parentNode) el.parentNode.removeChild(el);
    });

    insertBanner(el);
  }

  // ==========================================================================
  //  A-5: "Restore discarded workout" — the recoverable half of the confirm
  //  + undo pattern mc-finish.js's discard() needs but cannot hold itself,
  //  since discard() ends by navigating to dashboard.html (there is no page
  //  left afterward to run an in-memory Undo toast the way applySwap()'s
  //  does). mc-finish.js writes the snapshot right before wiping; this reads
  //  it back. Independent feature from the resume-in-progress banner above
  //  — different trigger (a deliberate discard, not an unfinished session),
  //  different store, dashboard-only.
  // ==========================================================================
  var DISCARD_KEY = 'mc_discard_snapshot_v1';
  var DISCARD_EXPIRE_MS = 2 * 3600 * 1000;   // fat-thumb recovery window, not a history feature

  function readDiscard() {
    try { return JSON.parse(localStorage.getItem(DISCARD_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function clearDiscard() { try { localStorage.removeItem(DISCARD_KEY); } catch (e) {} }

  function injectRestoreCSS() {
    if (document.getElementById('mcrRestoreCss')) return;
    var s = document.createElement('style');
    s.id = 'mcrRestoreCss';
    s.textContent =
      '.mcr-banner.mcr-restore{background:rgba(234,179,8,0.12);border-color:rgba(234,179,8,0.32);}' +
      '.mcr-banner.mcr-restore:active{background:rgba(234,179,8,0.22);}' +
      '.mcr-restore .mcr-lbl{color:#eab308;}' +
      '.mcr-restore .mcr-arrow{color:#fde68a;}';
    document.head.appendChild(s);
  }

  function renderDiscardRestore() {
    if (!onDashboard) return;                       // per the roadmap: dashboard-only
    if (document.querySelector('.ex-card, .ss-card')) return;

    var snap = readDiscard();
    if (!snap || !snap.pageId) return;
    if ((Date.now() - (snap.ts || 0)) > DISCARD_EXPIRE_MS) { clearDiscard(); return; }

    // A newer session already exists for that page — the athlete started
    // fresh since discarding. Restoring the old snapshot on top would
    // clobber real, newer progress, so the stale snapshot is dropped instead
    // of offered.
    var sessAll = {};
    try { sessAll = JSON.parse(localStorage.getItem('mc_session_v1') || '{}') || {}; } catch (e) {}
    if (sessAll[snap.pageId]) { clearDiscard(); return; }

    var setCount = 0;
    Object.keys(snap.sets || {}).forEach(function (k) {
      var sess = snap.sets[k];
      if (sess && sess.sets) setCount += Object.keys(sess.sets).length;
    });
    if (!setCount && !snap.session) { clearDiscard(); return; }

    injectCSS();
    injectRestoreCSS();

    var el = document.createElement('div');
    el.className = 'mcr-banner mcr-restore';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.innerHTML =
      '<span class="mcr-ico">🗑️</span>' +
      '<div class="mcr-body">' +
        '<div class="mcr-lbl">Discarded workout</div>' +
        '<div class="mcr-name"></div>' +
        '<div class="mcr-ago">Tap to restore</div>' +
      '</div>' +
      (setCount ? '<span class="mcr-prog">' + setCount + ' set' + (setCount === 1 ? '' : 's') + '</span>' : '') +
      '<span class="mcr-arrow">↩️</span>' +
      '<button class="mcr-dismiss" aria-label="Dismiss">✕</button>';
    el.querySelector('.mcr-name').textContent = snap.workoutName || snap.pageId;

    function restore() {
      try {
        if (snap.session) {
          var s2 = JSON.parse(localStorage.getItem('mc_session_v1') || '{}') || {};
          s2[snap.pageId] = snap.session;
          localStorage.setItem('mc_session_v1', JSON.stringify(s2));
        }
        var sl = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}') || {};
        Object.keys(snap.sets || {}).forEach(function (k) {
          if (!sl[k]) sl[k] = [];
          sl[k].unshift(snap.sets[k]);
        });
        localStorage.setItem('mc_setlog_v1', JSON.stringify(sl));
      } catch (e) {}
      clearDiscard();
      location.href = snap.pageId + '.html';
    }
    el.addEventListener('click', restore);
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); restore(); }
    });
    el.querySelector('.mcr-dismiss').addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      clearDiscard();
      if (el.parentNode) el.parentNode.removeChild(el);
    });

    insertBanner(el);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { render(); renderDiscardRestore(); });
  } else { render(); renderDiscardRestore(); }
})();

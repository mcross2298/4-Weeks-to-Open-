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

  // ---- render -------------------------------------------------------------
  function render() {
    // Never show on an active workout view that happens to be a cat- page.
    if (document.querySelector('.fw-bar')) return;

    var a = readAct(), L = a.last;
    if (!isResumable(L)) return;

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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();

/* ==========================================================================
   mc-sw-update.js  —  shared service-worker registration + reliable auto-update
   --------------------------------------------------------------------------
   Previously only the Dashboard registered the SW and it checked for updates
   just once on load, so users living in the workout pages could stay stuck on
   a stale build for a long time. This shared module:

     - registers sw.js with updateViaCache:'none' (the SW script itself is
       always fetched fresh, never served from the HTTP cache),
     - checks for a new version on load, whenever the tab becomes visible /
       focused, and on a periodic timer,
     - activates a newly-installed worker immediately (skipWaiting) and reloads
       the page exactly once when it takes control,
     - keeps the Dashboard's "Update available" banner working via doSwUpdate().

   Include it (cache-busted) near the end of every page that should self-update.
   ========================================================================== */
(function () {
  if (!navigator.serviceWorker) return;
  if (window.__mcSwUpdate) return;
  window.__mcSwUpdate = true;

  var swWaiting = null;

  // Reload exactly once when a fresh worker takes control of the page.
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (window.__mcSwReloaded) return;
    window.__mcSwReloaded = true;
    window.location.reload();
  });

  // Manual fallback used by the Dashboard's #swUpdate banner (onclick).
  window.doSwUpdate = function () {
    try { if (swWaiting) swWaiting.postMessage('skipWaiting'); } catch (e) {}
    window.location.reload();
  };

  // The Dashboard ships its own in-flow #swUpdate banner. Every OTHER page had
  // none, so showBanner() was a silent no-op there — and because
  // workoutInProgress() below stays true for the whole page lifetime once a
  // single set is checked (the .done node stays in the DOM even after the timer
  // stops and the card collapses — verified live), a held update on a workout
  // page was both permanent and invisible. That is how a device ends up running
  // a stale build for days. Self-mount a banner when the page has no #swUpdate,
  // so the hold is always visible and always manually applicable.
  function ensureBanner() {
    var b = document.getElementById('swUpdate');
    if (b) return b;
    if (!document.body) return null;
    if (!document.getElementById('mcSwUpdCss')) {
      var st = document.createElement('style');
      st.id = 'mcSwUpdCss';
      st.textContent =
        '.mc-swupd{position:fixed;left:12px;right:12px;z-index:var(--z-sw-update,60);' +
        'display:none;background:rgba(52,211,153,0.14);border:1px solid rgba(52,211,153,0.4);' +
        'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);' +
        'border-radius:12px;padding:11px 14px;min-height:44px;box-sizing:border-box;' +
        'font-size:13px;font-weight:800;color:#34d399;text-align:center;cursor:pointer;' +
        'letter-spacing:0.03em;box-shadow:0 6px 20px rgba(0,0,0,0.5);}' +
        '.mc-swupd.show{display:block;}' +
        // Light mode does not redefine --success, so the dark-mode green
        // (#34d399) would land at ~1.8:1 on the #f5f2ec light body.
        'html[data-theme="light"] .mc-swupd{background:rgba(4,120,87,0.10);' +
        'border-color:rgba(4,120,87,0.42);color:#046c4e;' +
        'box-shadow:0 6px 20px rgba(28,26,23,0.16);}';
      document.head.appendChild(st);
    }
    b = document.createElement('button');
    b.id = 'swUpdate';
    b.className = 'mc-swupd';
    b.type = 'button';
    b.textContent = '\u21bb Update available \u2014 tap to reload';
    b.addEventListener('click', function () { window.doSwUpdate(); });
    document.body.appendChild(b);
    return b;
  }

  // Sit clear of whatever fixed chrome already owns the top of this page (the
  // 46px .prog-bar-wrap.mcs-stat session bar, a notch inset, or nothing).
  function positionBanner(b) {
    var top = 0;
    var nodes = document.querySelectorAll('body > *');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el === b) continue;
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
      var r = el.getBoundingClientRect();
      if (r.height > 0 && r.top <= 4 && r.bottom > top) top = r.bottom;
    }
    b.style.top = (top + 8) + 'px';
  }

  function showBanner() {
    var b = ensureBanner();
    if (!b) return;
    if (b.className.indexOf('mc-swupd') !== -1) positionBanner(b);
    b.classList.add('show');
  }

  var pendingWorker = null;

  // A workout is "in progress" if a rest timer is counting or any set is
  // checked — i.e. the user is mid-session and must not be force-reloaded.
  function workoutInProgress() {
    var tf = document.getElementById('timerFloat');
    if (tf && tf.classList.contains('visible')) return true;
    return !!document.querySelector(
      '.ex-card.checked, .ss-ex.checked, .lift-card.checked, .mcl-ck.done, .set-check.done');
  }

  function apply(worker) {
    swWaiting = worker;
    try { worker.postMessage('skipWaiting'); } catch (e) {}   // → controllerchange → reload
  }

  function activate(worker) {
    swWaiting = worker;     // keep available so the banner's manual apply works anytime
    showBanner();
    if (workoutInProgress()) { pendingWorker = worker; return; }   // hold: never reload mid-set
    apply(worker);
  }

  // Apply a held update the moment the user is no longer mid-workout (also
  // covered naturally by navigating away, e.g. finishing → dashboard).
  function applyIfIdle() {
    if (pendingWorker && !workoutInProgress()) {
      var w = pendingWorker; pendingWorker = null;
      apply(w);
    }
  }

  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
    function check() { try { reg.update(); } catch (e) {} }

    // Check now, on every return to the tab, and periodically — and each of
    // those is also a chance to apply an update that was held during a workout.
    check();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { check(); applyIfIdle(); }
    });
    window.addEventListener('focus', function () { check(); applyIfIdle(); });
    setInterval(function () { check(); applyIfIdle(); }, 60000);

    // A new worker may already be waiting from a previous check.
    if (reg.waiting && navigator.serviceWorker.controller) activate(reg.waiting);

    reg.addEventListener('updatefound', function () {
      var nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', function () {
        // Only auto-activate for UPDATES (a controller already exists); on the
        // very first install there's nothing stale to replace.
        if (nw.state === 'installed' && navigator.serviceWorker.controller) activate(nw);
      });
    });
  }).catch(function () {});
})();

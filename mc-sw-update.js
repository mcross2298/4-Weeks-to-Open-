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
  if (!('serviceWorker' in navigator)) return;
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

  function showBanner() {
    var b = document.getElementById('swUpdate');
    if (b) b.classList.add('show');
  }

  function activate(worker) {
    swWaiting = worker;
    try { worker.postMessage('skipWaiting'); } catch (e) {}
    showBanner();
  }

  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
    function check() { try { reg.update(); } catch (e) {} }

    // Check now, on every return to the tab, and periodically.
    check();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') check();
    });
    window.addEventListener('focus', check);
    setInterval(check, 60000);

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

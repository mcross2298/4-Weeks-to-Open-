/* ==========================================================================
   mc-nav.js  —  Phase 2.1 shared bottom navigation
   --------------------------------------------------------------------------
   Adds a persistent Dashboard / Programs / Conditioning tab bar to every
   content page (workouts, category pages, tools), so the hub is reachable from
   anywhere. Programs/Conditioning deep-link into the dashboard's own tabs via
   ?tab=. Skips pages that already have a native .tab-bar (the dashboard).
   Self-contained IIFE; portable; no per-page wiring.
   ========================================================================== */
(function () {
  if (window.__mcNav) return;
  window.__mcNav = true;

  var HUB = 'dashboard.html';
  var TABS = [
    { label: 'Dashboard',    ico: '⚡',  href: HUB },
    { label: 'Programs',     ico: '🏋️', href: HUB + '?tab=programs' },
    { label: 'Conditioning', ico: '🔥', href: HUB + '?tab=conditioning' }
  ];

  function build() {
    // dashboard already ships its own tab bar — don't double up
    if (document.querySelector('.tab-bar') || document.querySelector('.mc-nav')) return;

    var nav = document.createElement('nav');
    nav.className = 'mc-nav';
    nav.setAttribute('aria-label', 'Primary');
    TABS.forEach(function (t) {
      var a = document.createElement('a');
      a.className = 'mc-nav-tab';
      a.href = t.href;
      a.innerHTML = '<span class="mc-nav-ico">' + t.ico + '</span><span>' + t.label + '</span>';
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
    document.body.classList.add('mc-has-nav');
    // a fixed Finish-Workout bar needs to clear the nav bar + extra body padding.
    // It is often rendered late by the page's own JS, so re-check for a bit.
    flagFinishBar();
    [300, 900, 1800].forEach(function (d) { setTimeout(flagFinishBar, d); });
  }
  function flagFinishBar() {
    if (document.querySelector('.fw-bar')) document.body.classList.add('mc-has-fw');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();

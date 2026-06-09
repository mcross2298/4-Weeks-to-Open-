/* ==========================================================================
   mc-nav.js  —  Phase 2.1 shared bottom navigation
   --------------------------------------------------------------------------
   Adds a persistent Dashboard / Programs / Conditioning tab bar to every
   content page (workouts, category pages, tools), so the hub is reachable from
   anywhere. Programs/Conditioning deep-link into the dashboard's own tabs via
   ?tab=. Skips pages that already have a native .tab-bar (the dashboard).
   Self-contained IIFE; portable; no per-page wiring.
   ========================================================================== */

// ── PWA COLD-LAUNCH GUARD (Phase 4) ──────────────────────────────────────────
// When the app is opened as an installed PWA / standalone home-screen shell,
// force the Dashboard as the landing page — iOS captures the install-time URL
// and ignores the manifest start_url, so a stale bookmark can otherwise open a
// deep page (e.g. the old programs screen) with no way back. Fires at most once
// per launch via a session flag, so in-app navigation is never disturbed.
(function () {
  try {
    var standalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (!standalone) return;
    if (sessionStorage.getItem('mc_launched')) return;   // already past the cold launch
    sessionStorage.setItem('mc_launched', '1');
    var page = (location.pathname.split('/').pop() || '').toLowerCase();
    var onHub = page === '' || page === 'index.html' || page === 'dashboard.html';
    if (!onHub) location.replace('dashboard.html');
  } catch (e) {}
})();

(function () {
  if (window.__mcNav) return;
  window.__mcNav = true;

  var HUB = 'dashboard.html';
  var TABS = [
    { label: 'Dashboard',    ico: '⚡',  href: HUB,                        match: 'dashboard' },
    { label: 'Programs',     ico: '🏋️', href: HUB + '?tab=programs',     match: 'programs'  },
    { label: 'Conditioning', ico: '🔥', href: HUB + '?tab=conditioning',  match: 'conditioning' }
  ];

  // Determine which tab should be active based on current page filename
  var CONDITIONING_PAGES = [
    'battle-ropes','boxing-routine','driveway-demolition','full-body-pyramid',
    'hell-week','popeye','turn-and-burn','45-minute-burner','the-500',
    '2on-1off','3on-1off-high-freq','5on-2off','every-arms-day','every-chest-day',
    'run-workout','bobw'
  ];
  function activeTab() {
    var page = (location.pathname.split('/').pop() || '').replace('.html','').toLowerCase();
    if (!page || page === 'dashboard') return 'dashboard';
    if (page.startsWith('cat-')) return 'programs';
    for (var i = 0; i < CONDITIONING_PAGES.length; i++) {
      if (page === CONDITIONING_PAGES[i] || page.startsWith(CONDITIONING_PAGES[i])) return 'conditioning';
    }
    return 'programs';
  }

  function build() {
    // dashboard already ships its own tab bar — don't double up
    if (document.querySelector('.tab-bar') || document.querySelector('.mc-nav')) return;

    var nav = document.createElement('nav');
    nav.className = 'mc-nav';
    nav.setAttribute('aria-label', 'Primary');
    var active = activeTab();
    TABS.forEach(function (t) {
      var a = document.createElement('a');
      a.className = 'mc-nav-tab' + (t.match === active ? ' mc-nav-active' : '');
      a.href = t.href;
      a.setAttribute('aria-current', t.match === active ? 'page' : false);
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

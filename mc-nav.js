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

// ── SAFE-AREA / NOTCH ────────────────────────────────────────────────────────
// Activate iOS safe-area insets (viewport-fit=cover) so the fixed bottom chrome
// — nav, Finish bar, rest-timer float, all already padded with
// env(safe-area-inset-bottom) — actually clears the home indicator, and pad the
// few fixed/sticky TOP bars so they clear the status bar/notch in standalone.
// env() is 0 in non-notch / browser contexts, so this is a no-op there.
// Central + reversible: no per-page edits.
(function () {
  try {
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      var c = vp.getAttribute('content') || '';
      if (!/viewport-fit/.test(c)) vp.setAttribute('content', c.replace(/\s*,?\s*$/, '') + ', viewport-fit=cover');
    }
    if (!document.getElementById('mcSafeAreaCss')) {
      var st = document.createElement('style');
      st.id = 'mcSafeAreaCss';
      st.textContent =
        '@supports (top: env(safe-area-inset-top)) {' +
          '.topbar{padding-top:calc(20px + env(safe-area-inset-top));}' +
          '.week-tabs{padding-top:env(safe-area-inset-top);}' +
          '.fw-auto-banner{padding-top:calc(12px + env(safe-area-inset-top));}' +
          '.prog-bar-wrap{top:env(safe-area-inset-top);}' +
        '}';
      document.head.appendChild(st);
    }
  } catch (e) {}
})();

(function () {
  if (window.__mcNav) return;
  window.__mcNav = true;

  var HUB = 'dashboard.html';
  var TABS = [
    { label: 'Dashboard',    ico: '⚡',  href: HUB },
    { label: 'Programs',     ico: '🏋️', href: HUB + '?tab=programs' },
    { label: 'Conditioning', ico: '🔥', href: HUB + '?tab=conditioning' },
    { label: 'Stats',        ico: '📈', href: 'stats.html' }
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

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

// ── THEME EARLY-APPLY (Phase 7) ───────────────────────────────────────────────
// Pages that don't already load mc-appearance.js in <head> (only dashboard.html
// and stats.html do today) need data-theme set before first paint, or a
// returning light-mode user sees a flash of dark before it flips. Duplicates
// mc-appearance.js's own read/apply logic inline so it runs the instant this
// script tag is parsed (same timing as the PWA guard above) instead of
// waiting on a second script's network fetch, then loads mc-appearance.js
// itself so window.MC_APPEARANCE is ready for the toggle button below.
(function () {
  try {
    var mode = localStorage.getItem('mc_theme_mode') === 'light' ? 'light' : 'dark';
    if (mode === 'light') document.documentElement.setAttribute('data-theme', 'light');
  } catch (e) {}
  if (!document.querySelector('script[src="mc-appearance.js"]')) {
    var s = document.createElement('script');
    s.src = 'mc-appearance.js';
    (document.head || document.documentElement).appendChild(s);
  }
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
    { label: 'Nutrition',    ico: '🍎', href: HUB + '?tab=nutrition' },
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

  // Toggle button — identical markup/behavior to the one hand-placed in
  // dashboard.html's topbar. Pages here have no topbar icon rail to slot
  // into, so it renders as its own fixed circular button (mc-nav.css
  // positions it top-right, mirroring .back-link's top-left placement).
  // Skips dashboard.html/stats.html, which already ship their own.
  function buildThemeToggle() {
    if (document.querySelector('.mc-theme-toggle')) return;
    var btn = document.createElement('div');
    btn.className = 'mc-theme-toggle mc-theme-toggle-float';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('title', 'Toggle light/dark mode');
    btn.setAttribute('aria-label', 'Toggle light/dark mode');
    btn.innerHTML =
      '<svg class="theme-icon-dark" width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" stroke="#c9c9cf" stroke-width="2" stroke-linejoin="round"/></svg>' +
      '<svg class="theme-icon-light" width="17" height="17" viewBox="0 0 24 24" fill="none" style="display:none;"><circle cx="12" cy="12" r="4.5" stroke="#c9c9cf" stroke-width="2"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" stroke="#c9c9cf" stroke-width="2" stroke-linecap="round"/></svg>';
    btn.addEventListener('click', function () { if (window.MC_APPEARANCE) MC_APPEARANCE.toggle(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
    });
    document.body.appendChild(btn);
  }

  // ── SMART BACK (history trail fix) ──────────────────────────────────────
  // Every "← Back" is a plain forward <a href> pointing at the page's known
  // parent (its category page), so tapping it — like tapping any other
  // link — pushes a NEW history entry instead of popping the one already
  // there. A real gym session (cat page -> workout -> Back -> another
  // workout -> ...) then leaves a long trail behind it, and an iOS
  // back-swipe replays that whole trail hop by hop instead of retracing one
  // step at a time.
  //
  // Fix: when this page's referrer is exactly the back-link's target (true
  // for the overwhelming majority of real taps — you arrived here BY
  // clicking a link on that page), call history.back() instead of
  // navigating forward, so Back actually pops the stack. If there's no
  // referrer or it doesn't match (deep link, PWA cold launch, direct URL),
  // the link falls back to normal forward navigation — never broken, just
  // not optimized in that edge case.
  function fileName(path) {
    return (path || '').split('/').pop().split('?')[0].split('#')[0];
  }
  function initSmartBack() {
    var links = document.querySelectorAll('.back-link, .back');
    if (!links.length || history.length <= 1) return;
    var ref;
    try { ref = document.referrer ? new URL(document.referrer) : null; } catch (e) { ref = null; }
    if (!ref || ref.origin !== location.origin) return;
    var refFile = fileName(ref.pathname);
    Array.prototype.forEach.call(links, function (a) {
      if (fileName(a.getAttribute('href')) === refFile) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          history.back();
        });
      }
    });
  }

  function init() {
    build();
    buildThemeToggle();
    initSmartBack();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

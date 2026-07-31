/* ==========================================================================
   mc-appearance.js — Sand light-mode toggle (Tier 4 Phase 3)
   --------------------------------------------------------------------------
   Scope: dashboard.html's shared chrome only (topbar, tab bar, page canvas —
   see the "Sand light mode" CSS block in dashboard.html). Persists to
   mc_theme_mode ('dark' default | 'light') and sets/removes a data-theme
   attribute on <html>; all visual work lives in attribute-gated CSS rather
   than inline var overrides, since several screens redeclare the same
   token names at higher specificity than :root/<html> (see the Onyx
   per-screen blocks in dashboard.html) — an inline override on <html>
   can't win against those.
   ========================================================================== */
(function () {
  if (window.MC_APPEARANCE) return;

  var KEY = 'mc_theme_mode';

  function get() {
    try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; }
    catch (e) { return 'dark'; }
  }

  // A page can opt out of light mode entirely with <html data-theme-lock="dark">
  // — see tools/apply-head-contract.py. The conditioning pages use it because
  // their stylesheet is a deliberate dark design with no light grammar, and a
  // half-lightened hybrid is worse than either theme (audit G-3.1).
  function locked() {
    return !!document.documentElement.getAttribute('data-theme-lock');
  }

  function apply(mode) {
    var html = document.documentElement;
    if (mode === 'light' && !locked()) html.setAttribute('data-theme', 'light');
    else html.removeAttribute('data-theme');
  }

  function set(mode) {
    mode = mode === 'light' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, mode); } catch (e) {}
    apply(mode);
    // Same-tab listeners need an explicit signal — the storage event only
    // reaches OTHER tabs. mc-theme.js re-derives the accent from this, because
    // an accent that clears contrast on the dark ground can fail on the light
    // one and vice versa (audit G-04).
    try { document.dispatchEvent(new CustomEvent('mc:theme-changed', { detail: { mode: mode } })); }
    catch (e) {}
  }

  window.MC_APPEARANCE = {
    get: get,
    set: set,
    toggle: function () { set(get() === 'light' ? 'dark' : 'light'); }
  };

  apply(get());
})();

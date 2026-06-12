/* ==========================================================================
   mc-theme.js — program-adaptive accent (Phase 4.1)
   --------------------------------------------------------------------------
   The app chrome takes on the color of whichever program is pinned as the
   active program: pin Strength & Supersets and the dashboard glows crimson,
   pin PMC and it shifts violet. Pure-black surfaces stay; only the accent
   tokens move.

   Scope: shared-chrome pages only (dashboard, stats, logs, library, builder,
   guide). Workout and category pages keep their own intentional program
   colors — they are NOT overridden.

   window.MC_THEME is also the single source for the program palette
   (previously only inside dashboard.html's PROGS array).
   ========================================================================== */
(function () {
  if (window.MC_THEME) return;

  var PALETTE = {
    ss:    '#e11d48',   // Strength & Supersets — crimson
    pmc:   '#7F77DD',   // Project Muscle Confusion — violet
    mc:    '#d4af37',   // Mike Cross' Favorites — gold (brand default)
    bobw:  '#14b8a6',   // Best of Both Worlds — teal
    ie:    '#f97316',   // Iron & Engine — orange
    stndr: '#1D9E75',   // STNDR — green
    pump:  '#D85A30',   // Daily Pump — deep orange
    gainz: '#378ADD',   // Daily Gainz — blue
    psu:   '#639922',   // PSU Football — olive
    cond:  '#E24B4A'    // Conditioning — red
  };
  var DEFAULT = PALETTE.mc;

  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }

  function activeColor() {
    try {
      var p = JSON.parse(localStorage.getItem('mc_active_prog') || 'null');
      if (p && p.id && PALETTE[p.id]) return PALETTE[p.id];
      if (p && p.color) return p.color;          // custom programs carry their own
    } catch (e) {}
    return DEFAULT;
  }

  function apply() {
    var hex = activeColor();
    var rgb = hexToRgb(hex);
    if (!rgb) return;
    var root = document.documentElement.style;
    var rgbStr = rgb.join(',');
    root.setProperty('--accent', hex);
    root.setProperty('--accent-rgb', rgbStr);
    // dashboard chrome tokens (no-ops on pages that don't use them)
    root.setProperty('--gold', hex);
    root.setProperty('--gold-dim', 'rgba(' + rgbStr + ',0.15)');
    root.setProperty('--gold-glow', 'rgba(' + rgbStr + ',0.25)');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#0a0a0a');
  }

  window.MC_THEME = {
    palette: PALETTE,
    colorFor: function (id) { return PALETTE[id] || DEFAULT; },
    apply: apply
  };

  apply();
  // re-apply when the pinned program changes (same tab via custom event from
  // the dashboard, other tabs via the storage event)
  window.addEventListener('storage', function (e) {
    if (e.key === 'mc_active_prog') apply();
  });
  document.addEventListener('mc:program-changed', apply);
})();

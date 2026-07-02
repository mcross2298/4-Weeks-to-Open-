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
    ie:    '#f97316',   // Iron & Engine — orange
    /* MARKET:STRIP influencer-theme START */
    stndr: '#1D9E75',   // STNDR — green
    pump:  '#D85A30',   // Daily Pump — deep orange
    gainz: '#378ADD',   // Daily Gainz — blue
    psu:   '#639922',   // PSU Football — olive
    /* MARKET:STRIP influencer-theme END */
    cond:  '#E24B4A'    // Conditioning — red
  };
  var DEFAULT = PALETTE.mc;

  // PM Phase 2 — named ThemeConfig presets. Each bundles the four spec fields
  // (PrimaryBgColor, CardBgColor, AccentThemeColor, TypographyStyle). Original
  // strings only — leak-safe.
  var PRESETS = {
    midnight: { name: 'Midnight Gold', primaryBg: '#0a0a0a', cardBg: '#101010', accent: '#d4af37', typography: 'sans' },
    crimson:  { name: 'Crimson Steel', primaryBg: '#0a0506', cardBg: '#16090c', accent: '#e11d48', typography: 'athletic' },
    violet:   { name: 'Violet Haze',   primaryBg: '#090712', cardBg: '#140d22', accent: '#7F77DD', typography: 'sans' },
    teal:     { name: 'Deep Teal',     primaryBg: '#04100e', cardBg: '#0a1c19', accent: '#14b8a6', typography: 'sans' },
    ember:    { name: 'Ember',         primaryBg: '#0f0a06', cardBg: '#1a1206', accent: '#f97316', typography: 'athletic' }
  };

  // Resolved ThemeConfig for the global app-chrome scope: published+local via
  // MC_PO when present, else the local working copy directly (so theming still
  // paints on pages that load mc-theme.js before program-overrides.js). A
  // preset supplies defaults; explicit fields override it.
  function rawConfig() {
    try {
      if (window.MC_PO && MC_PO.themeFor) { var t = MC_PO.themeFor('global'); if (t) return t; }
    } catch (e) {}
    try {
      var doc = JSON.parse(localStorage.getItem('mc_pm_overrides') || '{}');
      var e2 = doc.themes && doc.themes.global;
      if (e2 && !e2.reset) return e2;
    } catch (e) {}
    return null;
  }
  function resolveConfig() {
    var cfg = rawConfig() || {};
    var base = (cfg.preset && PRESETS[cfg.preset]) ? PRESETS[cfg.preset] : {};
    return {
      primaryBg:  cfg.primaryBg  || base.primaryBg  || null,
      cardBg:     cfg.cardBg     || base.cardBg     || null,
      accent:     cfg.accent     || base.accent     || null,
      typography: cfg.typography || base.typography || null,
      density:    cfg.density    || null,
      motion:     cfg.motion     || null
    };
  }

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
    var cfg = resolveConfig();
    // accent: explicit ThemeConfig wins; otherwise the program-adaptive color
    // (unchanged legacy behavior — nothing moves until a theme is set).
    var hex = cfg.accent || activeColor();
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

    // ThemeConfig surfaces + knobs (CSS consumes these; absent = app default).
    var html = document.documentElement;
    // --body-bg/--card-bg are the tokens base.css already consumes; --surface-bg
    // is an alias for components that reference it.
    if (cfg.primaryBg) { root.setProperty('--body-bg', cfg.primaryBg); root.setProperty('--surface-bg', cfg.primaryBg); }
    else { root.removeProperty('--body-bg'); root.removeProperty('--surface-bg'); }
    if (cfg.cardBg) root.setProperty('--card-bg', cfg.cardBg); else root.removeProperty('--card-bg');
    if (cfg.typography) html.setAttribute('data-typography', cfg.typography); else html.removeAttribute('data-typography');
    if (cfg.density)    html.setAttribute('data-density', cfg.density);       else html.removeAttribute('data-density');
    if (cfg.motion)     html.setAttribute('data-motion', cfg.motion);         else html.removeAttribute('data-motion');

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', cfg.primaryBg || '#0a0a0a');
  }

  window.MC_THEME = {
    palette: PALETTE,
    presets: PRESETS,
    colorFor: function (id) { return PALETTE[id] || DEFAULT; },
    config: resolveConfig,
    // owner writer — persists the global ThemeConfig to the override layer's
    // local working copy (instant preview; Publish path unchanged). Falls back
    // to a direct local write if MC_PO isn't loaded on this page.
    setConfig: function (cfg) {
      try {
        if (window.MC_PO && MC_PO.setThemeLocal) { MC_PO.setThemeLocal('global', cfg || null); apply(); return; }
        var doc = JSON.parse(localStorage.getItem('mc_pm_overrides') || '{}');
        if (!doc.themes) doc.themes = {};
        if (cfg) doc.themes.global = cfg; else delete doc.themes.global;
        localStorage.setItem('mc_pm_overrides', JSON.stringify(doc));
      } catch (e) {}
      apply();
    },
    apply: apply
  };

  apply();
  // re-apply when the pinned program changes (same tab via custom event from
  // the dashboard, other tabs via the storage event)
  window.addEventListener('storage', function (e) {
    if (e.key === 'mc_active_prog' || e.key === 'mc_pm_overrides') apply();
  });
  document.addEventListener('mc:program-changed', apply);
  document.addEventListener('mc:layout-changed', apply);
  document.addEventListener('mc:names-changed', apply);
})();

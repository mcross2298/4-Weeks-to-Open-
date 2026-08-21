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

   Program colors are NOT authored here. mc-pm-data.js's `color` field is the
   single source of truth (audit G-01); this module derives from it at call
   time, because every page that loads mc-theme.js loads mc-pm-data.js AFTER
   it (or not at all), so a load-time read would see nothing.
   ========================================================================== */
(function () {
  if (window.MC_THEME) return;

  // Brand gold — the app's default accent, matching base.css's `--accent`.
  // Deliberately NOT the `mc` program's color: they were conflated before
  // (DEFAULT = PALETTE.mc), which is what let the MC program render #d4af37
  // while its card rendered #d8b463.
  var DEFAULT = '#d4af37';

  // Non-program accents. Conditioning is a surface, not a registered program,
  // so it has no mc-pm-data.js entry to derive from.
  var EXTRA = { cond: '#E24B4A' };

  // Last-resort copies of each program's color, used only on pages that never
  // load mc-pm-data.js. tools/check-program-colors.js asserts these stay equal
  // to mc-pm-data.js and that every registered program appears here, so this
  // map cannot silently drift the way the old hand-kept PALETTE did.
  var FALLBACK = {
    ss:    '#c9505a',   // Strength & Supersets
    pmc:   '#8b7ff0',   // Project Muscle Confusion
    mc:    '#d8b463',   // Mike Cross' Favorite Splits
    ks:    '#e0a03c',   // Everything Under the Kitchen Sink
    mm:    '#6f77e0',   // The Modality Matrix
    hv:    '#9fbf4a',   // High-Volume Training Template
    /* MARKET:STRIP influencer-theme START */
    stndr: '#1D9E75',   // STNDR
    pump:  '#D85A30',   // Daily Pump
    gainz: '#378ADD',   // Daily Gainz
    psu:   '#639922',   // PSU Football
    /* MARKET:STRIP influencer-theme END */
  };

  // Derived at call time, never cached at load: mc-pm-data.js may not have
  // parsed yet when this IIFE runs, but it always has by the time a user
  // action or a re-apply event reaches us.
  function palette() {
    var out = {}, k;
    for (k in FALLBACK) if (FALLBACK.hasOwnProperty(k)) out[k] = FALLBACK[k];
    try {
      var progs = (window.MC_PM_DATA && MC_PM_DATA.programs) || [];
      for (var i = 0; i < progs.length; i++) {
        if (progs[i] && progs[i].id && progs[i].color) out[progs[i].id] = progs[i].color;
      }
    } catch (e) {}
    for (k in EXTRA) if (EXTRA.hasOwnProperty(k)) out[k] = EXTRA[k];
    return out;
  }

  // PM Phase 2 — named ThemeConfig presets. Each bundles the four spec fields
  // (PrimaryBgColor, CardBgColor, AccentThemeColor, TypographyStyle). Original
  // strings only — leak-safe.
  var PRESETS = {
    midnight: { name: 'Midnight Gold', primaryBg: '#0a0a0a', cardBg: '#101010', accent: '#d4af37', typography: 'sans' },
    crimson:  { name: 'Crimson Steel', primaryBg: '#0a0506', cardBg: '#16090c', accent: '#e11d48', typography: 'sans' },
    violet:   { name: 'Violet Haze',   primaryBg: '#090712', cardBg: '#140d22', accent: '#7F77DD', typography: 'sans' },
    teal:     { name: 'Deep Teal',     primaryBg: '#04100e', cardBg: '#0a1c19', accent: '#14b8a6', typography: 'sans' },
    ember:    { name: 'Ember',         primaryBg: '#0f0a06', cardBg: '#1a1206', accent: '#f97316', typography: 'sans' }
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

  // Personal layer (Phase 2.5) — device-local, unsynced, same "for non-PM
  // users" pattern as program-overrides.js's mc_personal_intensifiers. Only
  // accent + density are personalizable; typography/motion/backgrounds stay
  // owner-controlled. Wins over the owner's published/local ThemeConfig and
  // any preset, since it's a deliberate per-device choice, not a fallback.
  var PERSONAL_KEY = 'mc_personal_theme_v1';
  function personalConfig() {
    try { return JSON.parse(localStorage.getItem(PERSONAL_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function setPersonalConfig(patch) {
    var next = personalConfig();
    Object.keys(patch || {}).forEach(function (k) {
      if (patch[k] == null || patch[k] === '') delete next[k]; else next[k] = patch[k];
    });
    try { localStorage.setItem(PERSONAL_KEY, JSON.stringify(next)); } catch (e) {}
    apply();
  }

  function resolveConfig() {
    var cfg = rawConfig() || {};
    var base = (cfg.preset && PRESETS[cfg.preset]) ? PRESETS[cfg.preset] : {};
    var personal = personalConfig();
    return {
      primaryBg:  cfg.primaryBg  || base.primaryBg  || null,
      cardBg:     cfg.cardBg     || base.cardBg     || null,
      accent:     personal.accent || cfg.accent     || base.accent || null,
      typography: cfg.typography || base.typography || null,
      density:    personal.density || cfg.density    || null,
      motion:     cfg.motion     || null
    };
  }

  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }

  // ── light-mode accent adaptation (audit G-04) ──────────────────────────────
  // Every accent in this app was picked against the near-black ground. On the
  // Sand light ground they collapse: brand gold reads 1.88:1, and four of the
  // ten program colors fail outright. Rather than hand-maintain a second
  // palette (the exact duplication G-01 was about), darken the SAME hue until
  // it clears WCAG AA. Hue is preserved to within a degree, so each program
  // still reads as itself.
  var LIGHT_GROUND = [245, 242, 236];   // #f5f2ec, base.css's --body-bg on light
  var AA = 4.5;

  function relLum(rgb) {
    var c = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var l1 = relLum(a), l2 = relLum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h, s, l = (mx + mn) / 2;
    if (mx === mn) { h = s = 0; }
    else {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    if (s === 0) { var v = l * 255; return [v, v, v]; }
    function hue(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
  }
  function toHex(rgb) {
    return '#' + rgb.map(function (v) {
      return Math.round(Math.max(0, Math.min(255, v))).toString(16).replace(/^(.)$/, '0$1');
    }).join('');
  }

  // Returns [hex, rgbArray] adapted to the ground currently in play. Dark mode
  // is returned untouched — those values are already correct there.
  function adaptToGround(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return null;
    if (document.documentElement.getAttribute('data-theme') !== 'light') return [hex, rgb];
    if (contrast(rgb, LIGHT_GROUND) >= AA) return [hex, rgb];
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    var h = hsl[0], s = Math.min(1, hsl[1] * 1.05), l = hsl[2];
    for (var i = 0; i < 100 && l > 0; i++) {
      var out = hslToRgb(h, s, l);
      if (contrast(out, LIGHT_GROUND) >= AA) return [toHex(out), out.map(Math.round)];
      l -= 0.01;
    }
    var floor = hslToRgb(h, s, 0);
    return [toHex(floor), floor.map(Math.round)];
  }

  function activeColor() {
    try {
      var p = JSON.parse(localStorage.getItem('mc_active_prog') || 'null');
      if (!p) return DEFAULT;
      // The pinned card is a copy of the MC_PM_DATA entry (dashboard.html's
      // PROGS), so its own `color` is authoritative — custom and published
      // programs carry theirs the same way. Checking the palette first is what
      // let a stale hand-kept hex override the real one (audit G-01).
      if (p.color) return p.color;
      if (p.id) { var pal = palette(); if (pal[p.id]) return pal[p.id]; }
    } catch (e) {}
    return DEFAULT;
  }

  function apply() {
    var cfg = resolveConfig();
    // accent: explicit ThemeConfig wins; otherwise the program-adaptive color
    // (unchanged legacy behavior — nothing moves until a theme is set).
    var hex = cfg.accent || activeColor();
    // Darken for the Sand ground when light mode is on (audit G-04). This runs
    // on the resolved accent, so an owner ThemeConfig accent gets the same
    // treatment as a program color. No-op in dark mode.
    var adapted = adaptToGround(hex);
    if (!adapted) return;
    hex = adapted[0];
    var rgb = adapted[1];
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

    // Keep the browser/standalone chrome in step with the resolved theme. An
    // owner ThemeConfig wins; otherwise follow light/dark, matching the value
    // the head block (tools/apply-head-contract.py) already set before paint —
    // without the light branch this would stamp the dark ground back over it.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var isLight = html.getAttribute('data-theme') === 'light';
      meta.setAttribute('content', cfg.primaryBg || (isLight ? '#f5f2ec' : '#0a0a0a'));
    }
  }

  window.MC_THEME = {
    // Resolved fresh on each access — mc-pm-data.js may load after this module.
    get palette() { return palette(); },
    presets: PRESETS,
    colorFor: function (id) { return palette()[id] || DEFAULT; },
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
    apply: apply,
    // trainee-facing personal layer — no PM/owner unlock needed
    personal: { get: personalConfig, set: setPersonalConfig }
  };

  apply();
  // re-apply when the pinned program changes (same tab via custom event from
  // the dashboard, other tabs via the storage event)
  window.addEventListener('storage', function (e) {
    if (e.key === 'mc_active_prog' || e.key === 'mc_pm_overrides' ||
        e.key === PERSONAL_KEY || e.key === 'mc_theme_mode') apply();
  });
  document.addEventListener('mc:theme-changed', apply);
  document.addEventListener('mc:program-changed', apply);
  document.addEventListener('mc:layout-changed', apply);
  document.addEventListener('mc:names-changed', apply);
})();

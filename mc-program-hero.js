/* ==========================================================================
   mc-program-hero.js — "Onyx" Program Landing hero
   --------------------------------------------------------------------------
   Per README.md (Handoff: Program Landing Page). Renders the hero section
   used at the top of every program entry page (full variant, with stats +
   7-day schedule strip) and every collection-picker page (trimmed variant,
   title block + "what's inside" split list + "Browse splits" CTA).

   Usage: MCProgramHero.mount(document.getElementById('programHero'), cfg)
   cfg = {
     variant: 'full' | 'trimmed',   // default 'full'
     accent, iconKey, tierLabel, name, tagline,
     weeks, daysPerWeek, level, scheduleLabel,   // full variant only
     whatsInside: [{ icon:'chevron'|'bars', title, body, href }],
     ctaLabel, backHref,
     startHref,     // optional — CTA navigates here if set
     onStart        // optional — CTA calls this if startHref is not set
   }
   Consumed by every cat-*.html program entry page.
   ========================================================================== */
(function () {
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function hexToRgb(hex) {
    var h = String(hex || '#e6c579').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return r + ',' + g + ',' + b;
  }

  function lighten(hex, amt) {
    var h = String(hex || '#e6c579').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // Per-program hero-badge glyphs — reuses the exact paths drawn for each
  // program id in Programs Redesign.dc.html (the flagship/influencer card set).
  var ICONS = {
    ss: { fill: 'none', d: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>' },
    pmc: { fill: 'none', d: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>' },
    mc: { fill: 'none', d: '<path d="M4 8l3.5 2.5L12 4l4.5 6.5L20 8l-1.5 10h-13z"/>' },
    ks: { fill: 'cur', d: '<path d="M12 3c1.6 3 4 4.2 4 7.5A4 4 0 0 1 8 11c0-1 .3-1.7.8-2.4C8 9 7 10.3 7 12.5A5 5 0 0 0 17 12.5C17 8 13.5 6 12 3z"/>' },
    mm: { fill: 'none', d: '<path d="M12 2.5 20 7v10l-8 4.5L4 17V7z" stroke-linejoin="round"/>' },
    hv: { fill: 'none', d: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
    stndr: { fill: 'none', d: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>' },
    pump: { fill: 'none', d: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>' },
    gainz: { fill: 'none', d: '<path d="M7 12h10M4 9v6M8 6v12M16 6v12M20 9v6"/>' },
    psu: { fill: 'none', d: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/>' }
  };
  var ROW_ICONS = {
    chevron: '<path d="M9 6l6 6-6 6"/>',
    bars: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
  };

  function heroIconSvg(key, accent) {
    var icon = ICONS[key] || ICONS.ss;
    var fill = icon.fill === 'cur' ? accent : 'none';
    var stroke = icon.fill === 'cur' ? 'none' : accent;
    return '<svg width="21" height="21" viewBox="0 0 24 24" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2" stroke-linecap="round">' + icon.d + '</svg>';
  }

  function rowIconSvg(key) {
    var d = ROW_ICONS[key] || ROW_ICONS.chevron;
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  }

  function renderScheduleStrip(daysPerWeek, scheduleLabel) {
    var glyphs = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    var n = parseInt(daysPerWeek, 10) || 0;
    var cells = glyphs.map(function (g, i) {
      var on = i < n;
      return '<div class="pl-day ' + (on ? 'on' : 'off') + '">' +
        '<div class="pl-day-swatch">' + (on ? '&#9679;' : '&middot;') + '</div>' +
        '<div class="pl-day-label">' + g + '</div></div>';
    }).join('');
    return '<div class="pl-sched"><div class="pl-sched-head">' +
      '<div class="pl-sched-title">This week</div>' +
      '<div class="pl-sched-tag">' + escapeHtml(scheduleLabel || '') + '</div>' +
      '</div><div class="pl-sched-row">' + cells + '</div></div>';
  }

  function renderInsideRow(row) {
    var icon = '<div class="pl-inside-icon" style="color:var(--pl-accent)">' + rowIconSvg(row.icon) + '</div>';
    var text = '<div><div class="pl-inside-title">' + escapeHtml(row.title) + '</div>' +
      (row.body ? '<div class="pl-inside-body">' + escapeHtml(row.body) + '</div>' : '') + '</div>';
    var tag = row.href ? 'a' : 'div';
    var hrefAttr = row.href ? ' href="' + escapeHtml(row.href) + '"' : '';
    return '<' + tag + ' class="pl-inside-row"' + hrefAttr + '>' + icon + text + '</' + tag + '>';
  }

  function render(cfg) {
    var accent = cfg.accent || '#e6c579';
    var rgb = hexToRgb(accent);
    var light = lighten(accent, 0.3);
    var full = cfg.variant !== 'trimmed';

    var statsHtml = full ? (
      '<div class="pl-stats">' +
      '<div class="pl-stat"><div class="pl-stat-v">' + escapeHtml(cfg.weeks) + '</div><div class="pl-stat-l">Weeks</div></div>' +
      '<div class="pl-stat"><div class="pl-stat-v">' + escapeHtml(cfg.daysPerWeek) + '</div><div class="pl-stat-l">Days / wk</div></div>' +
      '<div class="pl-stat"><div class="pl-stat-v">' + escapeHtml(cfg.level) + '</div><div class="pl-stat-l">Level</div></div>' +
      '</div>'
    ) : '';

    var schedHtml = full ? renderScheduleStrip(cfg.daysPerWeek, cfg.scheduleLabel) : '';

    var insideRows = (cfg.whatsInside || []).map(renderInsideRow).join('');
    var insideHtml = '<div class="pl-inside"><div class="pl-inside-title-h">What’s inside</div><div class="pl-inside-list">' + insideRows + '</div></div>';

    var ctaLabel = cfg.ctaLabel || (full ? 'Start Program' : 'Browse splits');
    var ctaHint = full && cfg.weeks ? ('View full ' + escapeHtml(cfg.weeks) + '-week schedule &rarr;') : '';

    return '' +
      '<div class="pl-hero" style="--pl-accent:' + accent + ';--pl-accent-rgb:' + rgb + ';--pl-accent-light:' + light + ';">' +
      '<div class="pl-hero-inner">' +
      '<div class="pl-topbar">' +
      '<a class="pl-icon-btn pl-back" href="' + escapeHtml(cfg.backHref || 'dashboard.html') + '" aria-label="Back">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e2e2e6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>' +
      '</a>' +
      '<div class="pl-tier-label">' + escapeHtml(cfg.tierLabel || '') + '</div>' +
      '<div class="pl-icon-btn pl-menu" aria-hidden="true">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="' + accent + '"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>' +
      '</div>' +
      '</div>' +
      '<div class="pl-imgband">' +
      '<div class="pl-imgband-scrim"></div>' +
      '<div class="pl-sheen"></div>' +
      '<div class="pl-badge">' + heroIconSvg(cfg.iconKey, accent) + '</div>' +
      '</div>' +
      '<div class="pl-title-block">' +
      '<div class="pl-tier-pill">' + escapeHtml(cfg.tierLabel || '') + '</div>' +
      '<div class="pl-name">' + escapeHtml(cfg.name) + '</div>' +
      '<div class="pl-tagline">' + escapeHtml(cfg.tagline || '') + '</div>' +
      '</div>' +
      statsHtml +
      schedHtml +
      insideHtml +
      '<div class="pl-cta-wrap">' +
      '<button type="button" class="pl-cta" id="plCtaBtn">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="#14110b"><path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5z"/></svg>' +
      '<span>' + escapeHtml(ctaLabel) + '</span>' +
      '</button>' +
      (ctaHint ? '<button type="button" class="pl-cta-hint" id="plCtaHint">' + ctaHint + '</button>' : '') +
      '</div>' +
      '</div>' +
      '</div>';
  }

  function mount(targetEl, cfg) {
    if (!targetEl) return null;
    targetEl.innerHTML = render(cfg);
    var hero = targetEl.querySelector('.pl-hero');
    function go() {
      if (cfg.startHref) { window.location.href = cfg.startHref; return; }
      if (typeof cfg.onStart === 'function') { cfg.onStart(); return; }
      var next = targetEl.nextElementSibling;
      if (next && next.scrollIntoView) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    var btn = hero.querySelector('#plCtaBtn');
    var hint = hero.querySelector('#plCtaHint');
    if (btn) btn.addEventListener('click', go);
    if (hint) hint.addEventListener('click', go);
    return hero;
  }

  window.MCProgramHero = { render: render, mount: mount };
})();

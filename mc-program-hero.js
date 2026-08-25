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
     progId,        // F6 — derives the stat row (see statsFor); trimmed variant
     stats,         // optional explicit [{v,l}] override for a page with no
                    // mc-pm-data.js entry (cat-faint / cat-ie / cat-custom)
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
    hv: { fill: 'none', d: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' }
    /* MARKET:STRIP influencer-icons START */,
    stndr: { fill: 'none', d: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>' },
    pump: { fill: 'none', d: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>' },
    gainz: { fill: 'none', d: '<path d="M7 12h10M4 9v6M8 6v12M16 6v12M20 9v6"/>' },
    psu: { fill: 'none', d: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/>' }
    /* MARKET:STRIP influencer-icons END */
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

  /* F6 — the stat row that replaced the empty .pl-imgband placeholder.
     Derived, never authored, by the same reasoning as gen-schedules.js: a
     hand-typed copy of a program's own facts is free to drift from them.

     A program carrying a real `schedule` record yields all three cells
     exactly. The other seven describe collections rather than blocks (F5),
     so they have no record and never get one invented for them — their cells
     are parsed out of the `meta` string every entry already has, which is the
     same string the dashboard card renders. */
  function statsFor(progId) {
    var p = (window.MC_PM_DATA && MC_PM_DATA.program) ? MC_PM_DATA.program(progId) : null;
    if (!p) return [];
    var sc = p.schedule;
    if (!sc || !sc.weeks || !sc.perWeek) return metaStats(p.meta);

    // Rest can vary phase to phase — hv rests at [3,6], [6,7], [3,7] then [4],
    // so it trains 5 days for three weeks and 6 in the fourth. Reading only
    // sc.rest would print a week-1 figure as if it held for the whole block,
    // which is the drift F5 built restForWeek() to prevent. A block whose
    // training count actually varies says so as a range.
    var counts = [];
    ((sc.phases && sc.phases.length) ? sc.phases : [sc]).forEach(function (ph) {
      var rest = (ph.rest || sc.rest || []).length;
      counts.push(sc.perWeek - rest);
    });
    var lo = Math.min.apply(null, counts), hi = Math.max.apply(null, counts);

    var out = [
      { v: (lo === hi ? lo : lo + '\u2013' + hi) + 'x', l: 'Per Week' },
      { v: String(sc.weeks), l: sc.weeks === 1 ? 'Week' : 'Weeks' }
    ];

    // Minutes only where the days actually carry a figure. ss is hand-authored
    // and does; the generated mm/hv records do not, and a third cell invented
    // from set counts would be a guess dressed as a program fact — so those
    // programs simply show two cells.
    var mins = [];
    (sc.days || []).forEach(function (d) {
      var n = parseInt(d && d.min, 10);
      if (n > 0) mins.push(n);
    });
    if (mins.length) {
      var a = Math.min.apply(null, mins), b = Math.max.apply(null, mins);
      out.push({ v: a === b ? String(a) : (a + '\u2013' + b), l: 'Minutes' });
    }
    return out;
  }

  /* "15 Weeks \u00B7 3 Phases \u00B7 4-Day Split" -> three value/label cells.
     A leading numeric token (including ranges like "5\u20136") is the value and
     the remainder is the label; a segment with no leading number becomes a
     single-line cell, since inventing a label for it would be fiction. */
  function metaStats(meta) {
    if (!meta) return [];
    return String(meta).split('\u00B7').map(function (seg) {
      var t = seg.trim();
      if (!t) return null;
      var m = /^([0-9]+(?:[\u2013\u2014-][0-9]+)?)[\s\u00A0]*(.*)$/.exec(t);
      if (m && m[2]) return { v: m[1], l: m[2] };
      return { v: t, l: '' };
    }).filter(Boolean).slice(0, 3);
  }

  function renderStats(cells) {
    if (!cells || !cells.length) return '';
    return '<div class="pl-stats">' + cells.map(function (c) {
      return '<div class="pl-stat">' +
        '<div class="pl-stat-v">' + escapeHtml(c.v) + '</div>' +
        (c.l ? '<div class="pl-stat-l">' + escapeHtml(c.l) + '</div>' : '') +
        '</div>';
    }).join('') + '</div>';
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
    /* P2 (premium-design-roadmap.md, decision 4 — one accent per screen):
       the icon glyph used to be painted with an inline color:var(--pl-accent),
       which put a second accent on the screen no stylesheet could override
       without !important. Presentation belongs in mc-program-hero.css, which
       now colours it from the neutral ramp in both themes. */
    var icon = '<div class="pl-inside-icon">' + rowIconSvg(row.icon) + '</div>';
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

    // The full variant keeps its authored three cells. The trimmed variant
    // (every cat-*.html landing) derives them, or takes an explicit override
    // from a page with no mc-pm-data.js entry to read.
    var statsHtml = full
      ? renderStats([
          { v: cfg.weeks, l: 'Weeks' },
          { v: cfg.daysPerWeek, l: 'Days / wk' },
          { v: cfg.level, l: 'Level' }
        ])
      : renderStats(cfg.stats || statsFor(cfg.progId));

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
      '<div class="pl-topbar-sp" aria-hidden="true"></div>' +
      '<div class="pl-icon-btn pl-menu" aria-hidden="true">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="' + accent + '"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>' +
      '</div>' +
      '</div>' +
      // F6: the 190px .pl-imgband placeholder is gone — it held a stripe
      // gradient and never an image (this roadmap rules photography out), and
      // the stat row now occupies that space. .pl-badge moves into the title
      // block rather than going with it: it is the program's identity glyph,
      // the only place the per-program icon appears on the landing.
      // The tier label dropped from .pl-topbar is a duplicate of
      // .pl-tier-pill below, which is also what mount() binds onBadgeTap to
      // (resume-last-workout on cat-pmc / cat-strength) — so the pill is what
      // had to survive, and it does.
      '<div class="pl-title-block">' +
      '<div class="pl-badge">' + heroIconSvg(cfg.iconKey, accent) + '</div>' +
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
    if (typeof cfg.onBadgeTap === 'function') {
      var badges = hero.querySelectorAll('.pl-tier-label, .pl-tier-pill');
      for (var i = 0; i < badges.length; i++) {
        badges[i].classList.add('pl-tier-tappable');
        badges[i].setAttribute('role', 'button');
        badges[i].setAttribute('tabindex', '0');
        badges[i].addEventListener('click', cfg.onBadgeTap);
        badges[i].addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cfg.onBadgeTap(); }
        });
      }
    }
    return hero;
  }

  window.MCProgramHero = { render: render, mount: mount };
})();

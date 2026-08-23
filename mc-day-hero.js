/* ==========================================================================
   mc-day-hero.js — the day hero card (training / completed / rest)
   --------------------------------------------------------------------------
   program-day-view-roadmap.md, phase D2. One card, three states:

     training   accent art + title + target tags + Exercises/Sets/Minutes
                + [View workout] [Start Day N]
     completed  same card with a ✓ Completed badge over the art, and the
                primary action swapped to [View log →]
     rest       recovery state (decision 2) — days since last session, this
                week's completed count, the next training day, and an
                explicit "Train anyway" override

   MEDIA (decision 4). The repo ships zero photo assets and mc-program-hero.js
   already renders a deliberate accent-stripe band rather than imagery. This
   extends that treatment per-day: the day's own hue drives a gradient +
   diagonal stripe + scrim, with the day glyph as the focal mark. No photo
   pipeline, no precache size decision, no licensing question.

   A PURE RENDERER over mc-program-progress.js — the caller supplies the
   record and the day, this file owns no state. It also renders NO
   achievement banner: `bannerHtml` is an opt-in slot the caller fills, and
   the app has no achievements engine today (roadmap non-goal), so a
   "Badge Unlocked!" strip is not invented here to sit above nothing.

   Usage:
     MC_DAY_HERO.mount(el, {
       rec, day, accent,
       dayMeta: fn(workoutId) -> { title, tags[], exercises, sets, minutes,
                                   icon, color },
       bannerHtml,                 // optional slot, rendered above the card
       onStart: fn(day, workoutId),
       onView:  fn(day, workoutId),
       onLog:   fn(day, logId),
       onPreview: fn(nextTrainingDay)
     })
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_DAY_HERO) return;

  // Weekly Layout Standard's governed recovery palette — the same teal/slate
  // Day 6 / Day 7 already use, so a rest day reads identically wherever it
  // appears in the app.
  var ACTIVE_REST = '#0d9488';
  var FULL_REST = '#334155';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function hexToRgb(hex) {
    var h = String(hex || '#c9505a').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    if (!isFinite(r) || !isFinite(g) || !isFinite(b)) return '201,80,90';
    return r + ',' + g + ',' + b;
  }

  function statCell(value, label) {
    return '<div class="mdh-stat"><div class="mdh-stat-v">' + escapeHtml(value) +
      '</div><div class="mdh-stat-l">' + escapeHtml(label) + '</div></div>';
  }

  function statGrid(cells) {
    return '<div class="mdh-stats">' + cells.join('') + '</div>';
  }

  // The synthetic media band. `glyph` is the day's emoji/icon; the stripe and
  // gradient are derived from the day's hue so every day of a program is
  // recognisably the same family without needing an asset each.
  function artBand(glyph, doneBadge) {
    return '<div class="mdh-art">' +
      '<div class="mdh-art-scrim"></div>' +
      (glyph ? '<div class="mdh-art-glyph" aria-hidden="true">' + escapeHtml(glyph) + '</div>' : '') +
      (doneBadge ? '<div class="mdh-done-badge"><span class="mdh-done-tick" aria-hidden="true">✓</span>Completed</div>' : '') +
      '</div>';
  }

  function tagRow(tags) {
    if (!tags || !tags.length) return '';
    return '<div class="mdh-tags">' + tags.map(function (t) {
      return '<span class="mdh-tag">' + escapeHtml(t) + '</span>';
    }).join('<span class="mdh-tag-sep" aria-hidden="true">·</span>') + '</div>';
  }

  // ---- rest state ----------------------------------------------------------

  function daysSinceText(n) {
    if (n == null) return 'No sessions yet';
    if (n === 0) return 'Trained today';
    if (n === 1) return '1 day since your last session';
    return n + ' days since your last session';
  }

  function renderRest(cfg, info) {
    var P = window.MC_PROGRAM_PROGRESS;
    var rec = cfg.rec;
    var stats = P.stats(null, info.day, { __rec: rec });
    var nextDay = P.nextTrainingFrom(rec, info.day);
    var nextInfo = nextDay ? P.dayInfoFrom(rec, nextDay) : null;
    var nextMeta = (nextInfo && typeof cfg.dayMeta === 'function') ? (cfg.dayMeta(nextInfo.workoutId) || {}) : {};

    // The Weekly Layout Standard distinguishes an Active Rest day from a full
    // Rest day; the last rest position of a week is the full-rest one.
    var restPositions = rec.rest || [];
    var isFullRest = restPositions.length ? (info.position === restPositions[restPositions.length - 1]) : true;
    var accent = isFullRest ? FULL_REST : ACTIVE_REST;
    var title = isFullRest ? 'Rest Day' : 'Active Rest Day';
    var glyph = isFullRest ? '🌙' : '🚶';
    var focus = isFullRest
      ? ['Full Rest', 'Deep Sleep & Recovery', 'Optimized Nutrition']
      : ['Low Intensity Cardio', 'Stretching', 'Mobility Work'];

    var rows = focus.map(function (f) {
      return '<li class="mdh-rest-row">' + escapeHtml(f) + '</li>';
    }).join('');

    var nextBtn = nextInfo
      ? '<button type="button" class="mdh-btn mdh-btn-primary" data-act="preview" data-day="' + nextDay + '">' +
        'Next: ' + escapeHtml(nextMeta.title || ('Day ' + nextDay)) + '</button>'
      : '<button type="button" class="mdh-btn mdh-btn-primary" data-act="preview" disabled>Block complete</button>';

    // "Train anyway" is deliberately the secondary action, not hidden: a rest
    // day is a prescription, not a lock, and an athlete who moved their week
    // around needs a way in without first editing the schedule.
    var trainBtn = nextInfo
      ? '<button type="button" class="mdh-btn mdh-btn-ghost" data-act="start" data-day="' + nextDay + '">Train anyway</button>'
      : '';

    return '<div class="mdh mdh-rest" style="--mdh-accent:' + accent + ';--mdh-accent-rgb:' + hexToRgb(accent) + ';">' +
      artBand(glyph, false) +
      '<div class="mdh-body">' +
      '<div class="mdh-eyebrow">Day ' + info.day + ' · Week ' + info.week + '</div>' +
      '<h2 class="mdh-title">' + escapeHtml(title) + '</h2>' +
      '<div class="mdh-rest-since">' + escapeHtml(daysSinceText(stats.daysSinceLast)) + '</div>' +
      statGrid([
        statCell(stats.completedThisWeek + '/' + stats.trainingDaysPerWeek, 'This week'),
        statCell(String(stats.completedTotal), 'Sessions'),
        statCell(stats.daysSinceLast == null ? '—' : String(stats.daysSinceLast), 'Days rested')
      ]) +
      '<ul class="mdh-rest-list">' + rows + '</ul>' +
      '<div class="mdh-cta">' + trainBtn + nextBtn + '</div>' +
      '</div></div>';
  }

  // ---- training / completed state -----------------------------------------

  function renderTraining(cfg, info) {
    var meta = (typeof cfg.dayMeta === 'function' ? cfg.dayMeta(info.workoutId) : null) || {};
    var accent = meta.color || cfg.accent || '#c9505a';
    var done = info.complete;

    var stats = statGrid([
      statCell(meta.exercises != null ? String(meta.exercises) : '—', 'Exercises'),
      statCell(meta.sets != null ? String(meta.sets) : '—', 'Sets'),
      statCell(meta.minutes != null ? String(meta.minutes) : '—', 'Minutes')
    ]);

    // Completed swaps the PRIMARY action to the log; "View workout" stays,
    // because re-reading a finished day's prescription is a normal thing to
    // want and losing it would be a regression against the current page.
    var primary = done
      ? '<button type="button" class="mdh-btn mdh-btn-primary" data-act="log" data-day="' + info.day + '">View log &rsaquo;</button>'
      : '<button type="button" class="mdh-btn mdh-btn-primary" data-act="start" data-day="' + info.day + '">Start Day ' + info.day + '</button>';

    var secondary = '<button type="button" class="mdh-btn mdh-btn-ghost" data-act="view" data-day="' + info.day + '">View workout</button>';

    var unavailable = !info.workoutId || meta.comingSoon;
    if (unavailable) {
      primary = '<button type="button" class="mdh-btn mdh-btn-primary" disabled>Coming soon</button>';
      secondary = '';
    }

    return '<div class="mdh' + (done ? ' is-done' : '') + '" style="--mdh-accent:' + escapeHtml(accent) +
      ';--mdh-accent-rgb:' + hexToRgb(accent) + ';">' +
      artBand(meta.icon || '🏋️', done) +
      '<div class="mdh-body">' +
      '<div class="mdh-eyebrow">Day ' + info.day + ' · Week ' + info.week + '</div>' +
      '<h2 class="mdh-title">' + escapeHtml(meta.title || ('Day ' + info.day)) + '</h2>' +
      tagRow(meta.tags) +
      stats +
      '<div class="mdh-cta">' + secondary + primary + '</div>' +
      '</div></div>';
  }

  function render(cfg) {
    var P = window.MC_PROGRAM_PROGRESS;
    if (!P || !cfg || !cfg.rec) return '';
    var info = P.dayInfoFrom(cfg.rec, cfg.day);
    var banner = cfg.bannerHtml || '';     // opt-in slot; empty by default
    return banner + (info.rest ? renderRest(cfg, info) : renderTraining(cfg, info));
  }

  function mount(el, cfg) {
    if (!el) return null;
    el.innerHTML = render(cfg);

    el.onclick = function (ev) {
      var btn = ev.target.closest ? ev.target.closest('.mdh-btn') : null;
      if (!btn || btn.disabled) return;
      var act = btn.getAttribute('data-act');
      var day = parseInt(btn.getAttribute('data-day'), 10);
      if (!isFinite(day)) return;
      var P = window.MC_PROGRAM_PROGRESS;
      var info = P.dayInfoFrom(cfg.rec, day);

      if (act === 'start' && typeof cfg.onStart === 'function') cfg.onStart(day, info.workoutId);
      else if (act === 'view' && typeof cfg.onView === 'function') cfg.onView(day, info.workoutId);
      else if (act === 'log' && typeof cfg.onLog === 'function') cfg.onLog(day, info.logId);
      else if (act === 'preview' && typeof cfg.onPreview === 'function') cfg.onPreview(day);
    };
    return el;
  }

  window.MC_DAY_HERO = { render: render, mount: mount };
})();

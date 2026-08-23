/* ==========================================================================
   mc-week-bar.js — paginated weekly schedule bar
   --------------------------------------------------------------------------
   program-day-view-roadmap.md, phase D2. The `‹ Week N ›` row of seven day
   pills above the day hero: which day is active, which are done, which are
   rest, and tap-to-jump.

   A PURE RENDERER over mc-program-progress.js. It holds no state of its own —
   the week it is paged to is passed in and owned by the caller, and every day
   fact comes from MC_PROGRAM_PROGRESS.weekFrom(). Nothing here knows that a
   rest day is usually position 6 or 7; the rest pattern is data, so a program
   that rests mid-week renders correctly with no change to this file.

   Usage:
     MC_WEEK_BAR.mount(el, {
       rec,                  // the MC_PROGRAM_PROGRESS record
       week,                 // 1-based week currently shown
       activeDay,            // continuous day number the hero is on
       accent,               // program hue
       onWeek: fn(weekNum),  // page arrows
       onDay:  fn(dayNumber) // pill tap
     })
   Re-mounting is the update path: it is one small innerHTML write per change,
   not a live-updating widget, which keeps it off the mutation-record budget
   the card-integration roadmap spent five phases reclaiming.
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_WEEK_BAR) return;

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ✓ for a completed day, a moon for rest, else the day's own number — the
  // number is the useful glyph on an unstarted day and the reference's
  // hard-coded check on every pill is exactly the mistake R3 already fixed
  // once on the card strip (a check on an unstarted row reads as "logged").
  var CHECK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" ' +
    'stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.7 6.7 0 0 0 10.5 10.5z"/></svg>';
  var ARROW_L = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
  var ARROW_R = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';

  function pill(info, activeDay) {
    var active = info.day === activeDay;
    var cls = ['mwb-day'];
    if (active) cls.push('is-active');
    if (info.complete) cls.push('is-done');
    if (info.rest) cls.push('is-rest');

    var label = info.rest ? 'REST' : 'DAY';
    var mark = info.complete ? CHECK : (info.rest ? MOON : String(info.day));

    // The pill's accessible name says the whole thing once. A visible "DAY"
    // over a bare number is legible on screen but reads as "day eight" with
    // no state to a screen reader, so state goes in the label, not in a
    // separate visually-hidden node that could drift out of sync.
    var state = info.complete ? 'completed' : (info.rest ? 'rest day' : 'not yet trained');
    var aria = (info.rest ? 'Rest day ' : 'Day ') + info.day + ', ' + state;

    return '<button type="button" class="' + cls.join(' ') + '" data-day="' + info.day + '"' +
      (active ? ' aria-current="true"' : '') +
      ' aria-label="' + escapeHtml(aria) + '">' +
      '<span class="mwb-day-lbl">' + label + '</span>' +
      '<span class="mwb-day-mark" aria-hidden="true">' + mark + '</span>' +
      '</button>';
  }

  function render(cfg) {
    var P = window.MC_PROGRAM_PROGRESS;
    if (!P || !cfg || !cfg.rec) return '';
    var rec = cfg.rec;
    var week = cfg.week || 1;
    var days = P.weekFrom(rec, week);
    var lastWeek = rec.weeks || 1;

    var prevDisabled = week <= 1 ? ' disabled' : '';
    var nextDisabled = week >= lastWeek ? ' disabled' : '';

    return '<div class="mwb" style="--mwb-accent:' + escapeHtml(cfg.accent || '#c9505a') + ';">' +
      '<div class="mwb-head">' +
      '<button type="button" class="mwb-arrow" data-week="' + (week - 1) + '"' + prevDisabled +
      ' aria-label="Previous week">' + ARROW_L + '</button>' +
      '<div class="mwb-title" aria-live="polite">Week ' + week + '</div>' +
      '<button type="button" class="mwb-arrow" data-week="' + (week + 1) + '"' + nextDisabled +
      ' aria-label="Next week">' + ARROW_R + '</button>' +
      '</div>' +
      '<div class="mwb-row" role="group" aria-label="Week ' + week + ' schedule">' +
      days.map(function (d) { return pill(d, cfg.activeDay); }).join('') +
      '</div>' +
      '</div>';
  }

  function mount(el, cfg) {
    if (!el) return null;
    el.innerHTML = render(cfg);

    // One delegated listener on the container, re-bound with each mount —
    // seven pills and two arrows would otherwise be nine listeners re-added
    // on every week page and every completion.
    el.onclick = function (ev) {
      var arrow = ev.target.closest ? ev.target.closest('.mwb-arrow') : null;
      if (arrow && !arrow.disabled) {
        var w = parseInt(arrow.getAttribute('data-week'), 10);
        if (isFinite(w) && typeof cfg.onWeek === 'function') cfg.onWeek(w);
        return;
      }
      var day = ev.target.closest ? ev.target.closest('.mwb-day') : null;
      if (day) {
        var d = parseInt(day.getAttribute('data-day'), 10);
        if (isFinite(d) && typeof cfg.onDay === 'function') cfg.onDay(d);
      }
    };
    return el;
  }

  window.MC_WEEK_BAR = { render: render, mount: mount };
})();

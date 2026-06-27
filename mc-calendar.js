/* ==========================================================================
   mc-calendar.js — interactive workout-history calendar (Phase 4)
   --------------------------------------------------------------------------
   Fills the #calendarCard placeholder on the dashboard with a fully tappable
   month grid built from the same history the rest of the app uses:

     • mc_workout_log_v1 — finished sessions (date, name, sets, prs, duration)
     • mc_daily_v1       — live per-day sessions (logged before "Finish")

   A day with a *finished* workout is a "completed day" and is painted with
   green diagonal slashes. Days that only have a live/in-progress session get a
   subtler green dot. Tapping any day reveals that day's workout history below
   the grid; the ‹ › arrows page between months. Self-contained: injects its
   own CSS (mirrors mc-recap.js) so base.css needs no changes.

   Market-safe: no brand terms, no licensed-file references — survives the
   Rolodex build untouched.
   ========================================================================== */
(function () {
  'use strict';

  var host = document.getElementById('calendarCard');
  if (!host) return;

  var WL_KEY = 'mc_workout_log_v1';
  var DAILY_KEY = 'mc_daily_v1';
  var WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // local YYYY-MM-DD for a Date (history is keyed in local time elsewhere)
  function keyOf(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function finishedLogs() {
    try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function liveSessions() {
    try {
      var o = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}') || {};
      return Object.keys(o).map(function (k) { return o[k]; });
    } catch (e) { return []; }
  }

  // Build { 'YYYY-MM-DD': { finished:[...], live:[...] } } from both sources.
  function indexHistory() {
    var byDay = {};
    function bucket(key) { return (byDay[key] = byDay[key] || { finished: [], live: [] }); }
    finishedLogs().forEach(function (e) {
      if (!e || !e.date) return;
      var d = new Date(e.date);
      if (isNaN(d)) return;
      bucket(keyOf(d)).finished.push(e);
    });
    liveSessions().forEach(function (e) {
      if (!e || !e.date) return;
      bucket(e.date).live.push(e);   // mc_daily_v1 already stores local YYYY-MM-DD
    });
    return byDay;
  }

  // ── state ──
  var byDay = indexHistory();
  var today = new Date();
  var todayKey = keyOf(today);
  var viewY = today.getFullYear();
  var viewM = today.getMonth();
  var selKey = todayKey;
  var CAL_COLLAPSED_KEY = 'mc_cal_collapsed';
  var collapsed = sessionStorage.getItem(CAL_COLLAPSED_KEY) !== '0';

  function setMonth(y, m) {
    // normalize overflow (m === 12 → next year, m === -1 → prev year)
    var d = new Date(y, m, 1);
    viewY = d.getFullYear();
    viewM = d.getMonth();
    render();
  }

  // ── render ──
  function render() {
    byDay = indexHistory();

    var first = new Date(viewY, viewM, 1);
    var lead = (first.getDay() + 6) % 7;            // Mon=0 offset of the 1st
    var daysIn = new Date(viewY, viewM + 1, 0).getDate();

    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<div class="cal-cell cal-blank"></div>';
    for (var day = 1; day <= daysIn; day++) {
      var key = viewY + '-' + String(viewM + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      var rec = byDay[key];
      var done = !!(rec && rec.finished.length);
      var live = !!(rec && !rec.finished.length && rec.live.length);
      var future = key > todayKey;
      var cls = 'cal-cell cal-day';
      if (done) cls += ' cal-done';
      else if (live) cls += ' cal-live';
      if (key === todayKey) cls += ' cal-today';
      if (key === selKey) cls += ' cal-sel';
      if (future) cls += ' cal-future';
      cells += '<button class="' + cls + '" data-key="' + key + '" ' +
        'aria-label="' + esc(MONTHS[viewM] + ' ' + day) + (done ? ', workout completed' : '') + '">' +
        '<span class="cal-num">' + day + '</span>' +
        (live ? '<span class="cal-dot"></span>' : '') +
        '</button>';
    }

    var chevron = collapsed ? '▸' : '▾';
    var head =
      '<div class="sec-header cal-toggle-header" style="margin-bottom:0;cursor:pointer;" id="calToggleHeader" aria-expanded="' + (!collapsed) + '">' +
        '<div class="sec-title">History <span class="cal-chevron">' + chevron + '</span></div>' +
        '<a class="sec-link" href="workout-logs.html" style="text-decoration:none;" onclick="event.stopPropagation()">All logs →</a>' +
      '</div>';

    var nav =
      '<div class="cal-monthbar">' +
        '<button class="cal-nav" data-step="-1" aria-label="Previous month">‹</button>' +
        '<button class="cal-month" id="calMonthLbl">' + esc(MONTHS[viewM]) + ' ' + viewY + '</button>' +
        '<button class="cal-nav" data-step="1" aria-label="Next month">›</button>' +
      '</div>';

    var dow = '<div class="cal-dow">' +
      WD.map(function (w) { return '<div>' + w[0] + '</div>'; }).join('') + '</div>';

    var bodyHtml = collapsed ? '' :
      '<div class="cal-card">' +
        nav +
        dow +
        '<div class="cal-grid">' + cells + '</div>' +
        '<div class="cal-legend">' +
          '<span class="cal-lg"><i class="cal-lg-slash"></i>Completed</span>' +
          '<span class="cal-lg"><i class="cal-lg-dot"></i>In progress</span>' +
        '</div>' +
        '<div class="cal-detail" id="calDetail"></div>' +
      '</div>';

    host.innerHTML = head + bodyHtml;

    // wire header toggle
    var toggleHeader = host.querySelector('#calToggleHeader');
    if (toggleHeader) toggleHeader.onclick = function () { toggle(); };

    // wire interactions (only when expanded)
    host.querySelectorAll('.cal-nav').forEach(function (b) {
      b.onclick = function () { setMonth(viewY, viewM + parseInt(b.getAttribute('data-step'), 10)); };
    });
    var lbl = host.querySelector('#calMonthLbl');
    if (lbl) lbl.onclick = jumpToToday;
    host.querySelectorAll('.cal-day').forEach(function (b) {
      b.onclick = function () { selKey = b.getAttribute('data-key'); render(); };
    });

    if (!collapsed) renderDetail();
    injectCss();
  }

  function jumpToToday() {
    selKey = todayKey;
    setMonth(today.getFullYear(), today.getMonth());
  }

  function toggle() {
    collapsed = !collapsed;
    sessionStorage.setItem(CAL_COLLAPSED_KEY, collapsed ? '1' : '0');
    render();
    if (!collapsed) {
      try { host.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    }
  }

  function prettyKey(key) {
    var p = key.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function renderDetail() {
    var box = host.querySelector('#calDetail');
    if (!box) return;
    var rec = byDay[selKey];
    var html = '<div class="cal-detail-date">' + esc(prettyKey(selKey)) +
      (selKey === todayKey ? ' <span class="cal-detail-today">Today</span>' : '') + '</div>';

    var hasFinished = rec && rec.finished.length;
    var hasLive = rec && rec.live.length;

    if (!hasFinished && !hasLive) {
      html += '<div class="cal-empty">' +
        (selKey > todayKey ? 'Nothing scheduled yet.' : 'No workout logged this day.') +
        '</div>';
      box.innerHTML = html;
      return;
    }

    if (hasFinished) {
      rec.finished.forEach(function (log) {
        var sets = (log.sets || []).length;
        html +=
          '<div class="cal-log">' +
            '<div class="cal-log-head">' +
              '<span class="cal-log-name">' + esc(log.workoutName || 'Workout') + '</span>' +
              (log.time ? '<span class="cal-log-time">' + esc(log.time) + '</span>' : '') +
            '</div>' +
            '<div class="cal-log-tags">' +
              '<span class="cal-tag">' + sets + ' set' + (sets === 1 ? '' : 's') + '</span>' +
              (log.duration ? '<span class="cal-tag">⏱ ' + esc(log.duration) + '</span>' : '') +
              (log.prs ? '<span class="cal-tag gold">🏆 ' + log.prs + ' PR' + (log.prs > 1 ? 's' : '') + '</span>' : '') +
            '</div>' +
          '</div>';
      });
    }

    if (hasLive) {
      rec.live.forEach(function (e) {
        html +=
          '<div class="cal-log cal-log-live">' +
            '<div class="cal-log-head">' +
              '<span class="cal-log-name">' + esc(e.program || e.pid || 'Session') + '</span>' +
              '<span class="cal-log-time cal-live-badge">In progress</span>' +
            '</div>' +
            '<div class="cal-log-tags">' +
              '<span class="cal-tag">' + (e.doneSets || 0) + ' sets</span>' +
              '<span class="cal-tag gold">' + (e.pct || 0) + '% complete</span>' +
            '</div>' +
          '</div>';
      });
    }

    box.innerHTML = html;
  }

  // ── self-contained styles (mirrors mc-recap.js) ──
  function injectCss() {
    if (document.getElementById('mcCalCss')) return;
    var st = document.createElement('style');
    st.id = 'mcCalCss';
    st.textContent =
      '#calendarCard{display:block;}' +
      '.cal-toggle-header{-webkit-tap-highlight-color:transparent;user-select:none;}' +
      '.cal-chevron{font-size:14px;color:var(--muted2,#64748b);margin-left:6px;transition:transform 0.2s;}' +
      '.cal-card{margin:0 18px 28px;background:var(--card-bg,#0f0f0f);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:14px 14px 16px;}' +
      '.cal-monthbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}' +
      '.cal-nav{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:var(--gold,#d4af37);font-size:18px;font-weight:900;cursor:pointer;line-height:1;-webkit-tap-highlight-color:transparent;}' +
      '.cal-nav:active{background:rgba(255,255,255,0.1);}' +
      '.cal-month{flex:1;text-align:center;background:none;border:none;color:var(--text,#fff);font-size:15px;font-weight:900;letter-spacing:-0.01em;cursor:pointer;font-family:inherit;}' +
      '.cal-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px;}' +
      '.cal-dow div{text-align:center;font-size:10px;font-weight:800;letter-spacing:0.04em;color:#64748b;}' +
      '.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}' +
      '.cal-cell{aspect-ratio:1/1;border-radius:9px;}' +
      '.cal-blank{background:transparent;}' +
      '.cal-day{position:relative;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);color:#cbd5e1;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent;overflow:hidden;}' +
      '.cal-day:active{transform:scale(0.94);}' +
      '.cal-num{position:relative;z-index:1;}' +
      '.cal-future{opacity:0.4;}' +
      // green diagonal slashes for completed days
      '.cal-done{border-color:rgba(52,211,153,0.55);color:#eafff5;}' +
      '.cal-done::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(52,211,153,0.45) 3px,rgba(52,211,153,0.45) 5px);z-index:0;}' +
      '.cal-dot{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);width:5px;height:5px;border-radius:50%;background:#34d399;z-index:1;}' +
      '.cal-today{box-shadow:inset 0 0 0 1.5px var(--gold,#d4af37);color:var(--gold,#d4af37);}' +
      '.cal-sel{outline:2px solid var(--gold,#d4af37);outline-offset:1px;}' +
      '.cal-sel .cal-num{color:#fff;}' +
      '.cal-legend{display:flex;gap:16px;justify-content:center;margin-top:12px;}' +
      '.cal-lg{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;}' +
      '.cal-lg-slash{width:14px;height:14px;border-radius:4px;border:1px solid rgba(52,211,153,0.55);background:repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(52,211,153,0.5) 2px,rgba(52,211,153,0.5) 4px);}' +
      '.cal-lg-dot{width:7px;height:7px;border-radius:50%;background:#34d399;margin:0 3px;}' +
      '.cal-detail{margin-top:14px;border-top:1px solid rgba(255,255,255,0.07);padding-top:12px;}' +
      '.cal-detail-date{font-size:13px;font-weight:900;color:var(--text,#e2e8f0);margin-bottom:10px;display:flex;align-items:center;gap:8px;}' +
      '.cal-detail-today{font-size:9px;font-weight:900;letter-spacing:0.08em;color:#000;background:var(--gold,#d4af37);border-radius:5px;padding:2px 6px;}' +
      '.cal-empty{font-size:12px;font-weight:600;color:#64748b;padding:8px 0 4px;}' +
      '.cal-log{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-left:3px solid #34d399;border-radius:10px;padding:10px 12px;margin-bottom:8px;}' +
      '.cal-log-live{border-left-color:#fbbf24;}' +
      '.cal-log-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px;}' +
      '.cal-log-name{font-size:13px;font-weight:800;color:#e2e8f0;line-height:1.3;}' +
      '.cal-log-time{font-size:11px;font-weight:600;color:#64748b;white-space:nowrap;flex-shrink:0;}' +
      '.cal-live-badge{color:#fbbf24;font-weight:800;}' +
      '.cal-log-tags{display:flex;gap:6px;flex-wrap:wrap;}' +
      '.cal-tag{font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,0.05);color:#94a3b8;border:1px solid rgba(255,255,255,0.07);letter-spacing:0.03em;}' +
      '.cal-tag.gold{background:rgba(212,175,55,0.12);color:var(--gold,#d4af37);border-color:rgba(212,175,55,0.25);}';
    document.head.appendChild(st);
  }

  // expose hooks so the topbar 📅 can toggle/focus the calendar
  window.MCCalendar = {
    toggle: function () { toggle(); },
    focus: function () {
      if (collapsed) { collapsed = false; sessionStorage.setItem(CAL_COLLAPSED_KEY, '0'); render(); }
      jumpToToday();
      try { host.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();

/* ==========================================================================
   mc-recap.js — weekly stats data layer + dashboard pulse strip
   --------------------------------------------------------------------------
   Reads mc_workout_log_v1 (finished sessions) + mc_activity (streak) and
   exposes weekly summaries: sessions, sets, tonnage (Σ weight×reps), PRs.

   window.MC_RECAP.weeklyStats() — trailing-7-days-from-now window. Kept
   exactly as-is: mc-macros.js (Phase 2.2, training-load-aware calorie
   targets) depends on this precise contract for a real volume signal.

   window.MC_RECAP.statsForWeek(offset) — a discrete **calendar week**
   (Mon-Sun), offset weeks back from the current week (0 = this week, 1 =
   last week, ...). Different window definition from weeklyStats() on
   purpose — a "Weekly Review" picker needs nameable, non-overlapping weeks,
   not a rolling trailing window. Powers stats.html's Weekly Review section
   (mc-stats.js); also returns {start, end} timestamps so that section can
   scope its own muscle-volume-for-that-week computation to the same bounds
   without re-deriving the Monday-start math itself.

   readiness-stats-roadmap.md (2026-08-03): the old #recapCard full card
   (Strain/Readiness rings, Workouts/Sets/Tonnage/PRs grid, 7-day spark) was
   dashboard-only and has been retired along with the div — its detail now
   lives in Stats' Weekly Review instead. renderPulseStrip() replaces it on
   the dashboard with a single glanceable line (readiness % + this week's
   workout count), so the Current Program hero and Programs rail — what
   most trainees actually open the app to reach — aren't pushed below a
   full card's worth of stats every time. Requires mc-chart.js only for the
   (now-removed) rings/spark; kept as a dependency of the page, not this
   file, since Stats' own Weekly Review still uses it.
   ========================================================================== */
(function () {
  var WL_KEY = 'mc_workout_log_v1';
  var DAY = 24 * 3600 * 1000;

  function logs() {
    try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]') || []; }
    catch (e) { return []; }
  }

  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  function summarize(entries) {
    var s = { sessions: 0, sets: 0, tonnage: 0, prs: 0 };
    entries.forEach(function (e) {
      s.sessions++;
      s.prs += e.prs || 0;
      (e.sets || []).forEach(function (set) {
        s.sets++;
        var w = parseFloat(set.weight) || 0, r = parseInt(set.reps, 10) || 0;
        s.tonnage += w * r;
      });
    });
    return s;
  }

  // Trailing-7-day { sessions, sets, tonnage, prs } — callable from anywhere,
  // independent of any host div existing on the current page.
  function weeklyStats() {
    var now = Date.now();
    var weekStart = startOfDay(new Date(now - 6 * DAY)).getTime();
    var thisWeek = logs().filter(function (e) { return new Date(e.date || 0).getTime() >= weekStart; });
    return summarize(thisWeek);
  }

  function startOfWeek(d) {
    var x = startOfDay(d);
    var day = x.getDay(); // 0=Sun..6=Sat
    var diff = (day === 0 ? 6 : day - 1); // days back to Monday
    x.setDate(x.getDate() - diff);
    return x;
  }

  // Discrete calendar week (Mon-Sun), `offset` weeks back from the current
  // week (0 = this week, 1 = last week, ...) — see file header for why this
  // is a separate window definition from weeklyStats() above.
  function statsForWeek(offset) {
    var start = startOfWeek(new Date()).getTime() - (offset || 0) * 7 * DAY;
    var end = start + 7 * DAY;
    var entries = logs().filter(function (e) {
      var t = new Date(e.date || 0).getTime();
      return t >= start && t < end;
    });
    var s = summarize(entries);
    var perDay = [];
    for (var i = 0; i < 7; i++) {
      var d0 = start + i * DAY, d1 = d0 + DAY;
      var sets = 0;
      entries.forEach(function (e) {
        var t = new Date(e.date || 0).getTime();
        if (t >= d0 && t < d1) sets += (e.sets || []).length;
      });
      perDay.push({ label: new Date(d0).toLocaleDateString('en-US', { weekday: 'narrow' }), value: sets });
    }
    s.perDay = perDay;
    s.start = start;
    s.end = end;
    return s;
  }

  window.MC_RECAP = { weeklyStats: weeklyStats, statsForWeek: statsForWeek };

  // ---- dashboard pulse strip (#weeklyPulseStrip) ---------------------------
  // Same "empty host, hidden until earned" convention as #todayStrip/
  // #momentumStrip — a brand-new trainee with zero logged history sees
  // nothing here. Deliberately one line: readiness-stats-roadmap.md's whole
  // point is that Current Program/Programs rail shouldn't compete with a
  // full card's worth of stats for the top of Home.
  var READY_COLOR = { fresh: '#34d399', accumulating: '#f59e0b', overreached: '#f87171' };

  function injectPulseCss() {
    if (document.getElementById('mcPulseCss')) return;
    var st = document.createElement('style');
    st.id = 'mcPulseCss';
    st.textContent =
      '#weeklyPulseStrip:empty{display:none;}' +
      '.pulse-strip{display:flex;align-items:center;gap:8px;margin:0 18px 24px;padding:12px 14px;' +
        'background:var(--card-bg,#0f0f0f);border:1px solid rgba(255,255,255,0.07);border-radius:14px;' +
        'text-decoration:none;}' +
      '.pulse-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}' +
      '.pulse-val{font-size:12px;font-weight:800;color:var(--text,#e2e8f0);}' +
      '.pulse-sep{color:#64748b;font-size:12px;}' +
      '.pulse-link{margin-left:auto;font-size:12px;font-weight:800;color:var(--accent,#d4af37);flex-shrink:0;}';
    document.head.appendChild(st);
  }

  function renderPulseStrip() {
    var host = document.getElementById('weeklyPulseStrip');
    if (!host) return;

    var wk = weeklyStats();
    var hasReady = window.MC_READY && MC_READY.overall;
    var ov = hasReady ? MC_READY.overall() : { pct: null, status: null };
    if (!wk.sessions && ov.pct == null) { host.innerHTML = ''; return; }

    var readyHtml = ov.pct != null
      ? '<span class="pulse-dot" style="background:' + (READY_COLOR[ov.status] || '#34d399') + '"></span>' +
        '<span class="pulse-val">' + ov.pct + '% ready</span>'
      : '';
    var workoutsHtml = wk.sessions
      ? '<span class="pulse-val">' + wk.sessions + ' workout' + (wk.sessions === 1 ? '' : 's') + ' this week</span>'
      : '';
    var sepHtml = (readyHtml && workoutsHtml) ? '<span class="pulse-sep">·</span>' : '';

    injectPulseCss();
    host.innerHTML =
      '<a class="pulse-strip" href="stats.html">' +
        readyHtml + sepHtml + workoutsHtml +
        '<span class="pulse-link">Stats →</span>' +
      '</a>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderPulseStrip);
  else renderPulseStrip();
})();

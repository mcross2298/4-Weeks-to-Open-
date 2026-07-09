/* ==========================================================================
   mc-recap.js — weekly recap card on the dashboard (Phase 3.1)
   --------------------------------------------------------------------------
   Fills the #recapCard placeholder with an automated this-week vs last-week
   summary from mc_workout_log_v1 (finished sessions) + mc_activity (streak):
   sessions, sets, tonnage (Σ weight×reps), PRs, and a 7-day spark bar.
   Hidden until there is at least one finished workout in the window.
   Requires mc-chart.js.

   window.MC_RECAP.weeklyStats() exposes the trailing-7-day summarize() this
   card already computes, independent of #recapCard existing on the page —
   mc-macros.js (Phase 2.2, training-load-aware calorie targets) reads it to
   replace a day-count-only activity heuristic with a real volume signal.
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

  // Trailing-7-day { sessions, sets, tonnage, prs } — same window/math render()
  // uses for "This Week," callable from anywhere regardless of #recapCard.
  function weeklyStats() {
    var now = Date.now();
    var weekStart = startOfDay(new Date(now - 6 * DAY)).getTime();
    var thisWeek = logs().filter(function (e) { return new Date(e.date || 0).getTime() >= weekStart; });
    return summarize(thisWeek);
  }

  window.MC_RECAP = { weeklyStats: weeklyStats };

  var host = document.getElementById('recapCard');
  if (!host) return;

  function fmtTons(n) {
    if (n >= 1000) return (Math.round(n / 100) / 10) + 'k';
    return String(Math.round(n));
  }

  function delta(cur, prev) {
    if (!prev) return '';
    var pct = Math.round(((cur - prev) / prev) * 100);
    if (!pct) return '';
    var up = pct > 0;
    return ' <span style="font-size:10px;font-weight:800;color:' + (up ? '#34d399' : '#94a3b8') + ';">' +
      (up ? '▲' : '▼') + Math.abs(pct) + '%</span>';
  }

  function render() {
    var all = logs();
    var now = Date.now();
    var weekStart = startOfDay(new Date(now - 6 * DAY)).getTime();      // trailing 7 days
    var prevStart = weekStart - 7 * DAY;

    var thisWeek = [], lastWeek = [];
    all.forEach(function (e) {
      var t = new Date(e.date || 0).getTime();
      if (t >= weekStart) thisWeek.push(e);
      else if (t >= prevStart) lastWeek.push(e);
    });
    if (!thisWeek.length && !lastWeek.length) return;

    var cur = summarize(thisWeek), prev = summarize(lastWeek);

    // 7-day spark: sets logged per day
    var perDay = [];
    for (var i = 6; i >= 0; i--) {
      var d0 = startOfDay(new Date(now - i * DAY)).getTime();
      var d1 = d0 + DAY;
      var sets = 0;
      thisWeek.forEach(function (e) {
        var t = new Date(e.date || 0).getTime();
        if (t >= d0 && t < d1) sets += (e.sets || []).length;
      });
      var lbl = new Date(d0).toLocaleDateString('en-US', { weekday: 'narrow' });
      perDay.push({ label: lbl, value: sets });
    }

    var streak = 0;
    try { if (window.MCActivity) streak = MCActivity.get().streak || 0; } catch (e) {}

    host.innerHTML =
      '<div class="sec-header"><div class="sec-title">This Week</div>' +
      '<a class="sec-link" href="stats.html">Stats →</a></div>' +
      '<div class="recap-card">' +
        '<div class="recap-grid">' +
          '<div class="recap-cell"><div class="recap-val">' + cur.sessions + delta(cur.sessions, prev.sessions) + '</div><div class="recap-lbl">Workouts</div></div>' +
          '<div class="recap-cell"><div class="recap-val">' + cur.sets + delta(cur.sets, prev.sets) + '</div><div class="recap-lbl">Sets</div></div>' +
          '<div class="recap-cell"><div class="recap-val">' + fmtTons(cur.tonnage) + delta(cur.tonnage, prev.tonnage) + '</div><div class="recap-lbl">Tonnage (lb)</div></div>' +
          '<div class="recap-cell"><div class="recap-val">' + (cur.prs ? '🏆 ' + cur.prs : '—') + '</div><div class="recap-lbl">PRs</div></div>' +
        '</div>' +
        (window.MC_CHART ? '<div class="recap-spark">' + MC_CHART.bars(perDay, { labels: true, height: 64 }) + '</div>' : '') +
        (streak > 1 ? '<div class="recap-streak">🔥 ' + streak + '-day streak</div>' : '') +
      '</div>';

    if (!document.getElementById('mcRecapCss')) {
      var st = document.createElement('style');
      st.id = 'mcRecapCss';
      st.textContent =
        '#recapCard{display:block;}' +
        '.recap-card{margin:0 18px 28px;background:var(--card-bg,#0f0f0f);border:1px solid rgba(255,255,255,0.07);' +
          'border-radius:16px;padding:16px;}' +
        '.recap-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}' +
        '.recap-cell{text-align:center;}' +
        '.recap-val{font-size:17px;font-weight:900;color:var(--text,#e2e8f0);}' +
        '.recap-lbl{font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;margin-top:3px;}' +
        '.recap-spark{margin:4px 2px 0;}' +
        '.recap-streak{margin-top:10px;text-align:center;font-size:12px;font-weight:800;color:#a3e635;}';
      document.head.appendChild(st);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();

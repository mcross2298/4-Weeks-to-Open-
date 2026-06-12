/* ==========================================================================
   mc-stats.js — Stats hub renderer (Phase 3.3)
   --------------------------------------------------------------------------
   Renders stats.html entirely from on-device data, so the page works offline:
     • headline counters     mc_workout_log_v1
     • consistency heatmap   mc_activity.days  (via MC_CHART.heatmap)
     • volume per muscle     mc_workout_log_v1 sets × MC_MUSCLES.classify
     • monthly tonnage       mc_workout_log_v1 (via MC_CHART.bars)
     • PR timeline           sets flagged pr:true by mc-finish.js
   ========================================================================== */
(function () {
  var WL_KEY = 'mc_workout_log_v1';
  var ACT_KEY = 'mc_activity';
  var DAY = 24 * 3600 * 1000;

  function logs() {
    try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function activity() {
    try { return JSON.parse(localStorage.getItem(ACT_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function fmtTons(n) {
    if (n >= 1000000) return (Math.round(n / 100000) / 10) + 'M';
    if (n >= 1000) return (Math.round(n / 100) / 10) + 'k';
    return String(Math.round(n));
  }

  function renderTop(all) {
    var host = document.getElementById('statsTop');
    if (!host) return;
    var sets = 0, prs = 0;
    all.forEach(function (e) { sets += (e.sets || []).length; prs += e.prs || 0; });
    host.innerHTML =
      '<div class="stat-cell"><div class="stat-num">' + all.length + '</div><div class="stat-lbl">Workouts</div></div>' +
      '<div class="stat-cell"><div class="stat-num">' + sets + '</div><div class="stat-lbl">Sets Logged</div></div>' +
      '<div class="stat-cell"><div class="stat-num">' + prs + '</div><div class="stat-lbl">PRs Set</div></div>';
  }

  function renderHeatmap() {
    var host = document.getElementById('heatmapCard');
    if (!host) return;
    var a = activity();
    var days = a.days || {};
    if (!Object.keys(days).length) {
      host.innerHTML = '<div class="empty">No training days recorded yet — check off a workout to light this up.</div>';
      return;
    }
    var streak = 0;
    try { if (window.MCActivity) streak = MCActivity.get().streak || 0; } catch (e) {}
    host.innerHTML = MC_CHART.heatmap(days, { weeks: 16 }) +
      (streak > 0 ? '<div class="streak-line">🔥 ' + streak + '-day streak</div>' : '');
  }

  function renderMuscles(all) {
    var host = document.getElementById('muscleCard');
    if (!host) return;
    var cutoff = Date.now() - 30 * DAY;
    var byGroup = {};
    all.forEach(function (e) {
      if (new Date(e.date || 0).getTime() < cutoff) return;
      (e.sets || []).forEach(function (s) {
        var g = MC_MUSCLES.classify(s.name);
        var b = byGroup[g.id] || (byGroup[g.id] = { g: g, sets: 0, tonnage: 0 });
        b.sets++;
        b.tonnage += (parseFloat(s.weight) || 0) * (parseInt(s.reps, 10) || 0);
      });
    });
    var rows = Object.keys(byGroup).map(function (k) { return byGroup[k]; })
      .sort(function (a, b) { return b.sets - a.sets; });
    if (!rows.length) {
      host.innerHTML = '<div class="empty">Finish a workout with logged sets to see your muscle-group split.</div>';
      return;
    }
    var max = rows[0].sets;
    host.innerHTML = rows.map(function (r) {
      return '<div class="mg-row">' +
        '<span class="mg-ico">' + r.g.icon + '</span>' +
        '<span class="mg-name">' + r.g.label + '</span>' +
        '<div class="mg-bar-wrap"><div class="mg-bar" style="width:' + Math.round((r.sets / max) * 100) + '%"></div></div>' +
        '<span class="mg-val">' + r.sets + ' sets</span>' +
      '</div>';
    }).join('');
  }

  function renderTonnage(all) {
    var host = document.getElementById('tonnageCard');
    if (!host) return;
    var months = [];
    var now = new Date();
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: d.getFullYear() + '-' + d.getMonth(),
                    label: d.toLocaleDateString('en-US', { month: 'short' }), value: 0 });
    }
    var byKey = {};
    months.forEach(function (m) { byKey[m.key] = m; });
    var any = false;
    all.forEach(function (e) {
      var d = new Date(e.date || 0);
      var m = byKey[d.getFullYear() + '-' + d.getMonth()];
      if (!m) return;
      (e.sets || []).forEach(function (s) {
        var t = (parseFloat(s.weight) || 0) * (parseInt(s.reps, 10) || 0);
        if (t) { m.value += t; any = true; }
      });
    });
    if (!any) {
      host.innerHTML = '<div class="empty">Tonnage builds as you log weights — Σ weight × reps per month.</div>';
      return;
    }
    host.innerHTML = MC_CHART.bars(months.map(function (m) {
      return { label: m.label + ' · ' + fmtTons(m.value), value: m.value };
    }), { labels: true, height: 120, highlight: 5 });
  }

  function renderPRs(all) {
    var host = document.getElementById('prCard');
    if (!host) return;
    var prs = [];
    all.forEach(function (e) {
      (e.sets || []).forEach(function (s) {
        if (s.pr) prs.push({ name: s.name, weight: s.weight, reps: s.reps, date: e.date });
      });
    });
    if (!prs.length) {
      host.innerHTML = '<div class="empty">No PRs yet — beat a previous weight on any exercise and it lands here automatically. 🏆</div>';
      return;
    }
    host.innerHTML = prs.slice(0, 30).map(function (p) {
      var d = new Date(p.date || 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return '<div class="pr-row">' +
        '<span class="pr-ico">🏆</span>' +
        '<span class="pr-name">' + String(p.name || '').replace(/</g, '&lt;') + '</span>' +
        '<span class="pr-wt">' + p.weight + ' lb × ' + (p.reps || '?') + '</span>' +
        '<span class="pr-date">' + d + '</span>' +
      '</div>';
    }).join('');
  }

  // verified 1RMs from max-out mode (mc_max_v1) — best per lift
  function renderMaxes() {
    var host = document.getElementById('maxCard');
    if (!host) return;
    var best = {};
    try {
      (JSON.parse(localStorage.getItem('mc_max_v1') || '[]') || []).forEach(function (m) {
        if (!best[m.exercise] || m.weight > best[m.exercise].weight) best[m.exercise] = m;
      });
    } catch (e) {}
    var rows = Object.keys(best).map(function (k) { return best[k]; })
      .sort(function (a, b) { return b.weight - a.weight; });
    if (!rows.length) {
      host.innerHTML = '<div class="empty">No verified maxes yet — Max-Out Mode walks you ' +
        'through a proper 1RM test day, warm-ups to attempts.</div>';
      return;
    }
    host.innerHTML = rows.slice(0, 12).map(function (m) {
      var d = new Date(m.date || 0).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return '<div class="pr-row"><span class="pr-ico">🥇</span>' +
        '<span class="pr-name">' + String(m.exercise).replace(/</g, '&lt;') + '</span>' +
        '<span class="pr-wt">' + m.weight + ' lb</span>' +
        '<span class="pr-date">' + d + '</span></div>';
    }).join('');
  }

  function init() {
    var all = logs();
    renderTop(all);
    renderHeatmap();
    renderMuscles(all);
    renderTonnage(all);
    renderPRs(all);
    renderMaxes();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

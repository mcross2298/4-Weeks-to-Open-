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

  // ---- Muscle Map (flagship-immersive-roadmap.md H1) ----------------------
  // Replaces the old bar-list renderMuscles() with MC_CHART.bodyMap() over
  // the same two data sources the roadmap already computes elsewhere:
  // Volume from this file's own 30-day set tally (unchanged math, new
  // rendering), Recovery straight from mc-readiness.js's MC_READY.byMuscle().
  //
  // Tap-through targets a chip legend, not the SVG regions themselves — a
  // region on a phone-width figure (two views side by side, ~120-150px each)
  // measures well under the app's 44px touch floor once you account for how
  // thin a forearm or bicep region actually renders at that scale, and
  // padding every limb's hit-area out to 44px would make neighboring
  // regions' hit zones overlap so much that tapping one reliably hits
  // another instead. The chip grid reuses .ready-board/.ready-chip's
  // existing pattern from renderCurrentReadiness() below, which is already
  // a real ≥44px target — same visual language, not a second component.
  var muscleMapMode = 'recovery'; // in-memory only; a reload always opens on Recovery, per the locked default

  function exerciseTally(all, cutoff) {
    var byGroup = {};
    all.forEach(function (e) {
      if (cutoff != null && new Date(e.date || 0).getTime() < cutoff) return;
      (e.sets || []).forEach(function (s) {
        var g = MC_MUSCLES.classify(s.name);
        if (g.id === 'other') return;
        var b = byGroup[g.id] || (byGroup[g.id] = { g: g, sets: 0, byExercise: {} });
        b.sets++;
        var nm = String(s.name || '').trim();
        if (nm) b.byExercise[nm] = (b.byExercise[nm] || 0) + 1;
      });
    });
    return byGroup;
  }

  function topExerciseName(tally) {
    var best = null, bestN = 0;
    Object.keys(tally || {}).forEach(function (nm) {
      if (tally[nm] > bestN) { bestN = tally[nm]; best = nm; }
    });
    return best;
  }

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // dataPct: {groupId: 0-100}. tapNameByGroup: {groupId: exerciseName|undefined}.
  // labelFor(groupId) -> display string for a group WITH data (never called otherwise).
  function renderMuscleChips(dataPct, tapNameByGroup, labelFor) {
    var groups = MC_MUSCLES.groups.filter(function (g) { return g.id !== 'other'; });
    return '<div class="ready-board">' + groups.map(function (g) {
      var pct = dataPct[g.id];
      var hasData = (pct != null && !isNaN(pct));
      var col = hasData ? MC_CHART.bodyMapColorFor(Math.max(0, Math.min(100, pct)), {}) : 'rgba(255,255,255,0.12)';
      var label = hasData ? labelFor(g.id) : '';
      var exName = tapNameByGroup[g.id];
      var cls = 'ready-chip mg-chip' + (exName ? '' : ' static');
      return '<div class="' + cls + '"' + (exName ? ' data-ex="' + escAttr(exName) + '"' : '') +
        ' title="' + escAttr(g.label + (label ? ' — ' + label : '')) + '">' +
        '<span class="ready-icon">' + g.icon + '</span>' +
        '<span class="ready-lbl">' + g.label + '</span>' +
        '<span class="ready-bar" style="background:' + col + '"></span>' +
        '<span class="mg-chip-val">' + (label || '—') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderMuscleMap(all) {
    var host = document.getElementById('muscleCard');
    if (!host) return;
    var mode = muscleMapMode;
    var cutoff = Date.now() - 30 * DAY;
    var tally30 = exerciseTally(all, cutoff);
    var tallyAll = exerciseTally(all, null); // tap-through should find a lift even outside the 30-day window
    var tapNameByGroup = {};
    Object.keys(tallyAll).forEach(function (id) { tapNameByGroup[id] = topExerciseName(tallyAll[id].byExercise); });

    var bodyData = {}, chipHtml, note = '';
    if (mode === 'recovery') {
      var ready = (window.MC_READY && window.MC_MUSCLES) ? MC_READY.byMuscle() : null;
      if (!ready) {
        chipHtml = '<div class="empty">Log a session or two to see your recovery by muscle group.</div>';
      } else {
        Object.keys(ready).forEach(function (id) { bodyData[id] = ready[id].pct; });
        chipHtml = renderMuscleChips(bodyData, tapNameByGroup, function (id) { return Math.round(ready[id].pct) + '%'; });
      }
    } else {
      var rows = Object.keys(tally30).map(function (k) { return tally30[k]; });
      if (!rows.length) {
        chipHtml = '<div class="empty">Finish a workout with logged sets to see your muscle-group split.</div>';
      } else {
        var max = rows.reduce(function (m, r) { return Math.max(m, r.sets); }, 1);
        var setsById = {};
        rows.forEach(function (r) { bodyData[r.g.id] = (r.sets / max) * 100; setsById[r.g.id] = r.sets; });
        chipHtml = renderMuscleChips(bodyData, tapNameByGroup, function (id) { return setsById[id] + ' sets'; });
        note = '<div class="mg-note">last 30 days</div>';
      }
    }

    var figHtml = '<div class="mg-figures">' +
      '<div class="mg-fig">' + MC_CHART.bodyMap(bodyData, { view: 'front', width: 130 }) + '<div class="mg-fig-cap">Front</div></div>' +
      '<div class="mg-fig">' + MC_CHART.bodyMap(bodyData, { view: 'back', width: 130 }) + '<div class="mg-fig-cap">Back</div></div>' +
    '</div>';

    host.innerHTML =
      '<div class="mg-toggle">' +
        '<button type="button" data-mode="recovery" class="' + (mode === 'recovery' ? 'active' : '') + '">Recovery</button>' +
        '<button type="button" data-mode="volume" class="' + (mode === 'volume' ? 'active' : '') + '">Volume</button>' +
      '</div>' +
      figHtml + note + chipHtml;

    host.querySelectorAll('.mg-toggle button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        muscleMapMode = btn.getAttribute('data-mode');
        renderMuscleMap(all);
      });
    });
    host.querySelectorAll('.mg-chip[data-ex]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        if (window.MCTrends) MCTrends.open(chip.getAttribute('data-ex'));
      });
    });
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

  // ---- Weekly Review (readiness-stats-roadmap.md, 2026-08-03) --------------
  // A prev/next calendar-week picker over MC_RECAP.statsForWeek(offset).
  // The muscle panel underneath swaps meaning by week: offset 0 (this week)
  // shows the live 9-chip Readiness grid (MC_READY.byMuscle()) since
  // recovery % is only ever a right-now figure; any past week instead shows
  // that week's actual volume-by-muscle split (fully reconstructable from
  // the dated log — same classify-and-sum approach renderMuscles() above
  // uses for its 30-day window, just scoped to the picked week's bounds).
  function weekLabel(offset, start, end) {
    if (offset === 0) return 'This Week';
    if (offset === 1) return 'Last Week';
    var fmt = function (t) { return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    return 'Week of ' + fmt(start) + ' – ' + fmt(end - DAY);
  }

  function renderWeekMuscles(all, start, end) {
    var byGroup = {};
    all.forEach(function (e) {
      var t = new Date(e.date || 0).getTime();
      if (t < start || t >= end) return;
      (e.sets || []).forEach(function (s) {
        var g = MC_MUSCLES.classify(s.name);
        var b = byGroup[g.id] || (byGroup[g.id] = { g: g, sets: 0 });
        b.sets++;
      });
    });
    var rows = Object.keys(byGroup).map(function (k) { return byGroup[k]; })
      .sort(function (a, b) { return b.sets - a.sets; });
    if (!rows.length) return '<div class="empty">No sets logged that week.</div>';
    var max = rows[0].sets;
    return rows.map(function (r) {
      return '<div class="mg-row">' +
        '<span class="mg-ico">' + r.g.icon + '</span>' +
        '<span class="mg-name">' + r.g.label + '</span>' +
        '<div class="mg-bar-wrap"><div class="mg-bar" style="width:' + Math.round((r.sets / max) * 100) + '%"></div></div>' +
        '<span class="mg-val">' + r.sets + ' sets</span>' +
      '</div>';
    }).join('');
  }

  function renderCurrentReadiness() {
    if (!window.MC_READY || !window.MC_MUSCLES) {
      return '<div class="empty">Log a session or two to see your recovery by muscle group.</div>';
    }
    var groups = MC_MUSCLES.groups.filter(function (g) { return g.id !== 'other'; });
    var data = MC_READY.byMuscle();
    var STATUS_COLOR = { fresh: '#34d399', accumulating: '#f59e0b', overreached: '#f87171' };
    return '<div class="ready-board">' + groups.map(function (g) {
      var r = data[g.id] || { pct: 100, status: 'fresh' };
      return '<div class="ready-chip" title="' + g.label + ' — ' + r.pct + '% recovered (' + r.status + ')">' +
        '<span class="ready-icon">' + g.icon + '</span>' +
        '<span class="ready-lbl">' + g.label + '</span>' +
        '<span class="ready-bar" style="background:' + STATUS_COLOR[r.status] + '"></span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function renderWeekReview(all) {
    if (!window.MC_RECAP) return;
    var prevBtn = document.getElementById('weekPrev'), nextBtn = document.getElementById('weekNext');
    var labelEl = document.getElementById('weekLabel');
    var gridEl = document.getElementById('weekStatsGrid');
    var sparkEl = document.getElementById('weekSpark');
    var muscleTitleEl = document.getElementById('weekMuscleTitle');
    var muscleCardEl = document.getElementById('weekMuscleCard');
    if (!prevBtn || !nextBtn || !labelEl || !gridEl) return;

    var earliest = all.reduce(function (min, e) {
      var t = new Date(e.date || 0).getTime();
      return (t && (min == null || t < min)) ? t : min;
    }, null);

    var weekOffset = 0;

    function paint() {
      var wk = MC_RECAP.statsForWeek(weekOffset);
      labelEl.textContent = weekLabel(weekOffset, wk.start, wk.end);
      gridEl.innerHTML =
        '<div class="wk-cell"><div class="wk-val">' + wk.sessions + '</div><div class="wk-lbl">Workouts</div></div>' +
        '<div class="wk-cell"><div class="wk-val">' + wk.sets + '</div><div class="wk-lbl">Sets</div></div>' +
        '<div class="wk-cell"><div class="wk-val">' + fmtTons(wk.tonnage) + '</div><div class="wk-lbl">Tonnage (lb)</div></div>' +
        '<div class="wk-cell"><div class="wk-val">' + (wk.prs ? '🏆 ' + wk.prs : '—') + '</div><div class="wk-lbl">PRs</div></div>';
      sparkEl.innerHTML = (window.MC_CHART && wk.perDay.some(function (p) { return p.value > 0; }))
        ? MC_CHART.bars(wk.perDay, { labels: true, height: 64 })
        : '';

      if (weekOffset === 0) {
        muscleTitleEl.textContent = "💪 This Week's Readiness";
        muscleCardEl.innerHTML = renderCurrentReadiness();
      } else {
        muscleTitleEl.textContent = '💪 Volume by Muscle — ' + weekLabel(weekOffset, wk.start, wk.end);
        muscleCardEl.innerHTML = renderWeekMuscles(all, wk.start, wk.end);
      }

      nextBtn.disabled = weekOffset === 0;
      prevBtn.disabled = (earliest == null) || (earliest >= wk.start);
    }

    prevBtn.onclick = function () { weekOffset++; paint(); };
    nextBtn.onclick = function () { if (weekOffset > 0) { weekOffset--; paint(); } };
    paint();
  }

  function init() {
    var all = logs();
    renderTop(all);
    renderHeatmap();
    renderMuscleMap(all);
    renderTonnage(all);
    renderPRs(all);
    renderMaxes();
    renderWeekReview(all);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

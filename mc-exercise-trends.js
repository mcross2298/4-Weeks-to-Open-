/* ==========================================================================
   mc-exercise-trends.js — per-exercise progress sheet (Phase 3.2)
   --------------------------------------------------------------------------
   window.MCTrends.open(exerciseName) renders a bottom sheet charting that
   exercise across every finished workout in mc_workout_log_v1 (matched by
   name app-wide, so a lift's history follows it across programs):

     • Top weight   — heaviest logged set per session
     • Est. 1RM     — Epley (w × (1 + r/30)) on the best set per session
     • Total reps   — volume per session

   Opened from the ⋮ menu ("Exercise progress", wired in mc-card-actions.js)
   and by tapping the "Last: …" history cue on any Log Sets toggle.
   Requires mc-chart.js.
   ========================================================================== */
(function () {
  if (window.MCTrends) return;

  var WL_KEY = 'mc_workout_log_v1';
  var overlay = null, mode = 'weight', curName = '';

  function logs() {
    try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]') || []; }
    catch (e) { return []; }
  }

  function norm(s) { return String(s || '').trim().toLowerCase(); }

  // one point per finished session that contains this exercise
  function seriesFor(name) {
    var key = norm(name);
    var out = [];
    logs().slice().reverse().forEach(function (e) {       // oldest → newest
      var best = null, reps = 0;
      (e.sets || []).forEach(function (s) {
        if (norm(s.name) !== key && norm(s.name).indexOf(key) !== 0) return;
        var w = parseFloat(s.weight) || 0, r = parseInt(s.reps, 10) || 0;
        reps += r;
        if (!best || w > best.w) best = { w: w, r: r };
      });
      if (!best) return;
      var d = new Date(e.date || 0);
      out.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weight: best.w,
        e1rm: best.w ? Math.round(best.w * (1 + best.r / 30)) : 0,
        reps: reps
      });
    });
    return out;
  }

  function build() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'mct-overlay';
    overlay.innerHTML =
      '<div class="mct-sheet">' +
        '<div class="mct-handle"></div>' +
        '<div class="mct-title" id="mctTitle"></div>' +
        '<div class="mct-tabs">' +
          '<button class="mct-tab on" data-mode="weight">Top weight</button>' +
          '<button class="mct-tab" data-mode="e1rm">Est. 1RM</button>' +
          '<button class="mct-tab" data-mode="reps">Total reps</button>' +
        '</div>' +
        '<div class="mct-chart" id="mctChart"></div>' +
        '<div class="mct-meta" id="mctMeta"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
      var tab = e.target.closest('.mct-tab');
      if (tab) {
        mode = tab.dataset.mode;
        overlay.querySelectorAll('.mct-tab').forEach(function (t) {
          t.classList.toggle('on', t === tab);
        });
        draw();
      }
    });

    var st = document.createElement('style');
    st.textContent =
      '.mct-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;display:none;' +
        'align-items:flex-end;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);}' +
      '.mct-overlay.open{display:flex;}' +
      '.mct-sheet{width:100%;max-width:680px;margin:0 auto;background:#101010;border-radius:18px 18px 0 0;' +
        'border:1px solid rgba(255,255,255,0.1);border-bottom:0;padding:10px 18px calc(20px + env(safe-area-inset-bottom));}' +
      '.mct-handle{width:38px;height:4px;border-radius:2px;background:rgba(255,255,255,0.18);margin:2px auto 12px;}' +
      '.mct-title{font-size:15px;font-weight:900;color:#e2e8f0;margin-bottom:12px;}' +
      '.mct-tabs{display:flex;gap:6px;margin-bottom:14px;}' +
      '.mct-tab{flex:1;padding:7px 0;border-radius:9px;border:1px solid rgba(255,255,255,0.1);' +
        'background:rgba(255,255,255,0.04);color:#94a3b8;font-size:11px;font-weight:800;cursor:pointer;' +
        '-webkit-tap-highlight-color:transparent;}' +
      '.mct-tab.on{color:#fbbf24;border-color:rgba(212,175,55,0.45);background:rgba(212,175,55,0.12);}' +
      '.mct-chart{min-height:120px;}' +
      '.mct-meta{margin-top:10px;font-size:11px;font-weight:700;color:#64748b;text-align:center;}' +
      '.mct-empty{padding:28px 0;text-align:center;color:#64748b;font-size:13px;font-weight:700;}';
    document.head.appendChild(st);
  }

  function draw() {
    var series = seriesFor(curName);
    var chart = document.getElementById('mctChart');
    var meta = document.getElementById('mctMeta');
    if (!series.length) {
      chart.innerHTML = '<div class="mct-empty">No finished workouts with this exercise yet.<br>' +
        'Log sets and tap Finish Workout — the trend builds from there.</div>';
      meta.textContent = '';
      return;
    }
    var pts = series.map(function (p) { return { x: p.date, y: p[mode === 'weight' ? 'weight' : mode] }; });
    var unit = mode === 'reps' ? ' reps' : ' lb';
    chart.innerHTML = (window.MC_CHART && series.length > 1)
      ? MC_CHART.line(pts, { height: 140 })
      : '<div class="mct-empty">' + pts[0].y + unit + ' · ' + series[0].date +
        '<br>One session logged — two make a trend.</div>';
    var first = pts[0].y, last = pts[pts.length - 1].y;
    meta.textContent = series.length + ' sessions · ' + first + unit + ' → ' + last + unit +
      (first ? ' (' + (last >= first ? '+' : '') + Math.round(((last - first) / first) * 100) + '%)' : '');
  }

  function open(name) {
    if (!name) return;
    build();
    curName = name;
    document.getElementById('mctTitle').textContent = '📈 ' + name;
    overlay.classList.add('open');
    draw();
  }
  function close() { if (overlay) overlay.classList.remove('open'); }

  window.MCTrends = { open: open, close: close };

  // the "Last: …" cue on every Log Sets toggle doubles as a trend shortcut
  document.addEventListener('click', function (e) {
    var hist = e.target.closest('.mcl-hist');
    if (!hist || !hist.textContent) return;
    var card = hist.closest('.ex-card, .ss-ex, .ex-item, .lift-card');
    var nm = card && card.querySelector('.ex-name, .ss-name, .lift-name');
    if (nm) { e.stopPropagation(); e.preventDefault(); open(nm.textContent.trim()); }
  }, true);
})();

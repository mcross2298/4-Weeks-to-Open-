/* ==========================================================================
   mc-body.js — bodyweight tracking (Horizon 2)
   --------------------------------------------------------------------------
   Store: localStorage 'mc_body_v1' — append-only [{id:<iso>, date, w}],
   synced via mc-sync.js 'arrayById'. One entry per log; the chart uses the
   latest entry per day. Renders into #bodyCard on the Stats hub: current
   weight, 30-day delta, trend line (mc-chart.js), and a Log button.

   window.MC_BODY.trend7d() exposes a smoothed trailing-7-day trend,
   independent of #bodyCard existing on the page — mc-macros.js (Phase 2.3,
   adaptive macro control loop) reads it to reconcile the calorie goal
   against a real bodyweight signal instead of guessing.
   ========================================================================== */
(function () {
  var KEY = 'mc_body_v1';
  var DAY = 24 * 3600 * 1000;

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function write(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }

  function log(w) {
    var iso = new Date().toISOString();
    var a = read();
    a.unshift({ id: iso, date: iso, w: w });
    write(a.slice(0, 1000));
    try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e) {}
  }

  // latest entry per calendar day, oldest → newest
  function series() {
    var byDay = {};
    read().forEach(function (e) {
      var d = (e.date || '').slice(0, 10);
      if (d && (!byDay[d] || e.date > byDay[d].date)) byDay[d] = e;
    });
    return Object.keys(byDay).sort().map(function (d) {
      return { x: d.slice(5), y: parseFloat(byDay[d].w) || 0, date: byDay[d].date };
    }).filter(function (p) { return p.y > 0; });
  }

  // Smoothed trailing-7-day trend: average of the older half of the window's
  // points vs. the newer half, rather than a noisy two-point diff (a single
  // high/low weigh-in shouldn't swing a control-loop decision). Needs at
  // least 3 distinct calendar-day entries in the window to say anything.
  function trend7d() {
    var pts = series().filter(function (p) { return Date.now() - new Date(p.date).getTime() <= 7 * DAY; });
    if (pts.length < 3) return null;
    var mid = Math.ceil(pts.length / 2);
    var older = pts.slice(0, mid), newer = pts.slice(pts.length - mid);
    var avg = function (a) { return a.reduce(function (s, p) { return s + p.y; }, 0) / a.length; };
    return { deltaLb: Math.round((avg(newer) - avg(older)) * 10) / 10, count: pts.length };
  }

  window.MC_BODY = { trend7d: trend7d };

  var host = document.getElementById('bodyCard');
  if (!host) return;

  function render() {
    var pts = series();
    var btn = '<button class="bw-log" id="bwLog">＋ Log weight</button>';
    if (!pts.length) {
      host.innerHTML = '<div class="empty">Track the other side of the equation — ' +
        'strength up, scale where you want it.</div>' + btn;
    } else {
      var cur = pts[pts.length - 1];
      var ago = null;
      for (var i = pts.length - 1; i >= 0; i--) {
        if (Date.now() - new Date(pts[i].date).getTime() >= 30 * DAY) { ago = pts[i]; break; }
      }
      var delta = ago
        ? '<span class="bw-delta">' + (cur.y >= ago.y ? '+' : '') +
          (Math.round((cur.y - ago.y) * 10) / 10) + ' lb / 30d</span>'
        : '';
      host.innerHTML =
        '<div class="bw-top"><span class="bw-now">' + cur.y + ' lb</span>' + delta + btn + '</div>' +
        (pts.length > 1 && window.MC_CHART
          ? MC_CHART.line(pts.slice(-30), { height: 110 })
          : '<div class="empty" style="padding:10px 0;">One entry logged — two make a trend.</div>');
    }
    document.getElementById('bwLog').addEventListener('click', function () {
      MCInputSheet.prompt({
        title: 'Bodyweight',
        label: 'Weight in pounds',
        placeholder: 'e.g. 184.6',
        inputMode: 'decimal',
        validate: function (v) {
          var w = parseFloat(v);
          return (w > 0 && w <= 1500) ? null : 'Enter a weight in pounds, e.g. 184.6';
        }
      }).then(function (v) {
        log(Math.round(parseFloat(v) * 10) / 10);
        render();
      }, function () {});
    });

    if (!document.getElementById('mcBodyCss')) {
      var st = document.createElement('style');
      st.id = 'mcBodyCss';
      st.textContent =
        '.bw-top{display:flex;align-items:center;gap:10px;margin-bottom:10px;}' +
        '.bw-now{font-size:22px;font-weight:900;color:var(--accent,#d4af37);}' +
        '.bw-delta{font-size:11px;font-weight:800;color:#94a3b8;}' +
        '.bw-log{margin-left:auto;padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.14);' +
          'background:rgba(255,255,255,0.06);color:#e2e8f0;font-size:12px;font-weight:800;cursor:pointer;' +
          'font-family:inherit;-webkit-tap-highlight-color:transparent;}';
      document.head.appendChild(st);
    }
  }

  render();
})();

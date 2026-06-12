/* ==========================================================================
   mc-wrapped.js — MC Wrapped: the periodic recap card (Horizon 4)
   --------------------------------------------------------------------------
   Auto-generates a month / year recap from data already on the device:
     mc_workout_log_v1  workouts, sets, tonnage, PRs, favorite lift
     mc_activity.days   training days + longest streak in the period
     mc_max_v1          verified maxes set in the period
     MC_MUSCLES         most-trained muscle group
   Renders the on-page card and exports a 1080×1350 PNG via canvas
   ("Save card") for sharing anywhere. Fully offline.
   ========================================================================== */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var DAY = 24 * 3600 * 1000;

  function read(k, fb) {
    try { return JSON.parse(localStorage.getItem(k) || fb) || JSON.parse(fb); }
    catch (e) { return JSON.parse(fb); }
  }
  function fmtTons(n) {
    if (n >= 1000000) return (Math.round(n / 100000) / 10) + 'M';
    if (n >= 1000) return (Math.round(n / 100) / 10) + 'k';
    return String(Math.round(n));
  }

  // ---- periods ---------------------------------------------------------------
  function periods() {
    var now = new Date();
    var mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    var lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var yStart = new Date(now.getFullYear(), 0, 1);
    return [
      { id: 'month', lbl: 'This Month', from: mStart.getTime(), to: Date.now(),
        title: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) },
      { id: 'lastmonth', lbl: 'Last Month', from: lmStart.getTime(), to: mStart.getTime() - 1,
        title: lmStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) },
      { id: 'year', lbl: 'This Year', from: yStart.getTime(), to: Date.now(),
        title: String(now.getFullYear()) }
    ];
  }

  // ---- compute -----------------------------------------------------------------
  function compute(p) {
    var logs = read('mc_workout_log_v1', '[]');
    var act = read('mc_activity', '{}');
    var maxes = read('mc_max_v1', '[]');

    var s = { title: p.title, workouts: 0, sets: 0, tonnage: 0, prs: 0,
              topPr: null, fav: null, muscle: null, streak: 0, days: 0, maxes: 0 };
    var favCount = {}, muscleSets = {};

    logs.forEach(function (e) {
      var t = new Date(e.date || 0).getTime();
      if (t < p.from || t > p.to) return;
      s.workouts++;
      s.prs += e.prs || 0;
      var seen = {};
      (e.sets || []).forEach(function (set) {
        s.sets++;
        var w = parseFloat(set.weight) || 0, r = parseInt(set.reps, 10) || 0;
        s.tonnage += w * r;
        if (set.pr && w && (!s.topPr || w > s.topPr.w)) s.topPr = { name: set.name, w: w };
        var k = String(set.name || '').trim();
        if (k && !seen[k]) { favCount[k] = (favCount[k] || 0) + 1; seen[k] = 1; }
        if (window.MC_MUSCLES && k) {
          var g = MC_MUSCLES.classify(k);
          muscleSets[g.id] = muscleSets[g.id] || { g: g, n: 0 };
          muscleSets[g.id].n++;
        }
      });
    });

    Object.keys(favCount).forEach(function (k) {
      if (!s.fav || favCount[k] > s.fav.n) s.fav = { name: k, n: favCount[k] };
    });
    Object.keys(muscleSets).forEach(function (k) {
      if (!s.muscle || muscleSets[k].n > s.muscle.n) s.muscle = muscleSets[k];
    });

    maxes.forEach(function (m) {
      var t = new Date(m.date || 0).getTime();
      if (t >= p.from && t <= p.to) s.maxes++;
    });

    // training days + longest streak inside the period
    var days = act.days || {};
    var run = 0, cur = new Date(p.from);
    while (cur.getTime() <= p.to) {
      var key = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0') +
                '-' + String(cur.getDate()).padStart(2, '0');
      if (days[key]) { s.days++; run++; if (run > s.streak) s.streak = run; }
      else run = 0;
      cur = new Date(cur.getTime() + DAY);
    }
    return s;
  }

  // ---- on-page render ------------------------------------------------------------
  var current = null;

  function rows(s) {
    var out = [
      ['🏋️', s.workouts + ' workouts', s.days + ' training days'],
      ['🔩', s.sets + ' sets logged', fmtTons(s.tonnage) + ' lb moved'],
    ];
    if (s.streak > 1) out.push(['🔥', s.streak + '-day best streak', '']);
    if (s.topPr) out.push(['🏆', s.prs + ' PRs', 'biggest: ' + s.topPr.name + ' · ' + s.topPr.w + ' lb']);
    else if (s.prs) out.push(['🏆', s.prs + ' PRs', '']);
    if (s.maxes) out.push(['🥇', s.maxes + ' verified max' + (s.maxes > 1 ? 'es' : ''), 'tested in Max-Out Mode']);
    if (s.fav) out.push(['❤️', 'Favorite lift', s.fav.name + ' · ' + s.fav.n + ' sessions']);
    if (s.muscle) out.push([s.muscle.g.icon, 'Most-trained muscle', s.muscle.g.label + ' · ' + s.muscle.n + ' sets']);
    return out;
  }

  function render(p) {
    current = compute(p);
    var s = current;
    var host = $('wrapCard');
    if (!s.workouts && !s.days) {
      host.innerHTML = '<div class="wr-empty">Nothing logged in this period yet.<br>' +
        'Finish a workout and come back — Wrapped builds itself.</div>';
      $('wrapSave').style.display = 'none';
      return;
    }
    host.innerHTML =
      '<div class="wr-eyebrow">MC TRAINING · WRAPPED</div>' +
      '<div class="wr-title">' + s.title + '</div>' +
      rows(s).map(function (r) {
        return '<div class="wr-row"><span class="wr-ico">' + r[0] + '</span>' +
          '<span class="wr-main">' + r[1] + '</span>' +
          '<span class="wr-sub">' + r[2] + '</span></div>';
      }).join('') +
      '<div class="wr-foot">Every rep counted. ⚡</div>';
    $('wrapSave').style.display = 'block';
  }

  // ---- PNG export ------------------------------------------------------------------
  function save() {
    if (!current) return;
    var s = current;
    var W = 1080, H = 1350;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var x = cv.getContext('2d');
    var gold = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d4af37';

    x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, W, H);
    var grad = x.createRadialGradient(W * 0.2, H * 0.15, 60, W * 0.2, H * 0.15, 900);
    grad.addColorStop(0, 'rgba(212,175,55,0.14)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = grad; x.fillRect(0, 0, W, H);
    x.strokeStyle = gold; x.lineWidth = 6; x.strokeRect(24, 24, W - 48, H - 48);

    x.fillStyle = gold;
    x.font = '700 34px system-ui'; x.letterSpacing = '10px';
    x.fillText('MC TRAINING · WRAPPED', 70, 130);
    x.letterSpacing = '0px';
    x.fillStyle = '#ffffff'; x.font = '900 92px system-ui';
    x.fillText(s.title, 70, 240);

    var y = 360;
    rows(s).forEach(function (r) {
      x.font = '56px system-ui'; x.fillText(r[0], 70, y);
      x.fillStyle = '#ffffff'; x.font = '900 52px system-ui';
      x.fillText(r[1], 170, y);
      if (r[2]) {
        x.fillStyle = '#94a3b8'; x.font = '600 34px system-ui';
        x.fillText(r[2], 170, y + 46);
      }
      x.fillStyle = '#e2e8f0';
      y += r[2] ? 128 : 96;
    });

    x.fillStyle = gold; x.font = '800 36px system-ui';
    x.fillText('Every rep counted. ⚡', 70, H - 90);

    cv.toBlob(function (blob) {
      var file = new File([blob], 'mc-wrapped.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'MC Wrapped — ' + s.title }).catch(function () {});
      } else {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mc-wrapped-' + s.title.replace(/\s+/g, '-').toLowerCase() + '.png';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      }
    }, 'image/png');
  }

  // ---- wire --------------------------------------------------------------------------
  var ps = periods();
  $('wrapTabs').innerHTML = ps.map(function (p, i) {
    return '<button class="wr-tab' + (i === 0 ? ' on' : '') + '" data-i="' + i + '">' + p.lbl + '</button>';
  }).join('');
  $('wrapTabs').addEventListener('click', function (e) {
    var b = e.target.closest('.wr-tab'); if (!b) return;
    document.querySelectorAll('.wr-tab').forEach(function (t) { t.classList.toggle('on', t === b); });
    render(ps[parseInt(b.dataset.i, 10)]);
  });
  $('wrapSave').addEventListener('click', save);
  render(ps[0]);
})();

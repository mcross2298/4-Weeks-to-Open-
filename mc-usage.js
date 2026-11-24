/* ==========================================================================
   mc-usage.js — friction in the gym, against the owner's targets
   --------------------------------------------------------------------------
   autonomy-exec-roadmap.md Part 2. The 12-month measure is less friction in
   the gym: under 30 seconds from opening a workout to its first ticked set,
   and one tap per set when the suggestion is taken unchanged. mc-setlog.js
   counts both on every tick into mc_usage_v1 (per phone and week, synced);
   this file adds the phones up and draws Stats' "In the gym" card.

   mc_usage_v1: { "<device>": { ts, weeks: { "<monday YYYY-MM-DD>":
     { sessions, firstSetSecs[], taps, sets, ghostSets, ghostTaps } } } }

   window.MC_USAGE:
     weeks(now, n) -> newest first, n weeks to the one holding `now`:
       [{ monday, sessions, sets, medianFirst, tapsPerSet, tapsPerUnchanged }]
       a figure with nothing behind it is null, never 0
     render(host)  the Stats card
     TARGET_FIRST_SECS, TARGET_TAPS
   ========================================================================== */
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.MC_USAGE) return;

  var KEY = 'mc_usage_v1', TARGET_FIRST_SECS = 30, TARGET_TAPS = 1, DAY = 864e5;

  function dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function mondayOf(t) {
    var d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }
  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || '{}'); return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {}; }
    catch (e) { return {}; }
  }
  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  }
  function round1(n) { return Math.round(n * 10) / 10; }

  function weeks(now, n) {
    now = now || Date.now(); n = n || 5;
    var all = read(), out = [], mon = mondayOf(now);
    for (var i = 0; i < n; i++) {
      var d = new Date(mon); d.setDate(d.getDate() - 7 * i);
      var k = dayKey(d), sum = { sessions: 0, firstSetSecs: [], taps: 0, sets: 0, ghostSets: 0, ghostTaps: 0 };
      Object.keys(all).forEach(function (dev) {
        var w = all[dev] && all[dev].weeks && all[dev].weeks[k];
        if (!w) return;
        sum.sessions += +w.sessions || 0;
        sum.firstSetSecs = sum.firstSetSecs.concat((w.firstSetSecs || []).filter(function (x) { return isFinite(x) && x >= 0; }));
        sum.taps += +w.taps || 0; sum.sets += +w.sets || 0;
        sum.ghostTaps += +w.ghostTaps || 0; sum.ghostSets += +w.ghostSets || 0;
      });
      out.push({
        monday: k, sessions: sum.sessions, sets: sum.sets,
        medianFirst: median(sum.firstSetSecs),
        tapsPerSet: sum.sets ? round1(sum.taps / sum.sets) : null,
        tapsPerUnchanged: sum.ghostSets ? round1(sum.ghostTaps / sum.ghostSets) : null
      });
    }
    return out;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function css() {
    if (document.getElementById('mcUsageCss')) return;
    var st = document.createElement('style');
    st.id = 'mcUsageCss';
    st.textContent =
      '.mcu-p{font-size:var(--fs-sm,13px);color:#a8a196;line-height:1.5;margin:0 0 12px;}' +
      '.mcu-row{display:grid;grid-template-columns:1fr auto auto;gap:4px 12px;align-items:baseline;padding:10px 0;border-top:1px solid rgba(255,255,255,0.07);font-size:var(--fs-md,14px);}' +
      '.mcu-row .wk{color:#ede7d9;font-weight:800;}' +
      '.mcu-row .v{text-align:right;color:#ede7d9;font-weight:800;white-space:nowrap;}' +
      '.mcu-row .v.miss{color:#f59e0b;}' +
      '.mcu-row .v small{display:block;font-size:var(--fs-2xs,11px);font-weight:700;color:#a8a196;}' +
      '.mcu-row .none{color:#a8a196;font-weight:600;}' +
      'html[data-theme="light"] .mcu-p,html[data-theme="light"] .mcu-row .v small,html[data-theme="light"] .mcu-row .none{color:#6b6459;}' +
      'html[data-theme="light"] .mcu-row .wk,html[data-theme="light"] .mcu-row .v{color:var(--text);}' +
      'html[data-theme="light"] .mcu-row .v.miss{color:#a16207;}' +
      'html[data-theme="light"] .mcu-row{border-top-color:rgba(28,26,23,.08);}';
    document.head.appendChild(st);
  }

  function render(host) {
    if (!host) return;
    css();
    var ws = weeks(Date.now(), 5).filter(function (w) { return w.sets > 0; });
    var intro = '<p class="mcu-p">How quickly a workout gets going, against your targets: under ' + TARGET_FIRST_SECS +
      ' seconds from opening it to the first ticked set, and ' + TARGET_TAPS + ' tap per set when you take the suggested load unchanged. ' +
      'Counted on each phone, added together here.</p>';
    if (!ws.length) {
      host.innerHTML = intro + '<div class="empty">Starts counting with your next logged set.</div>';
      return;
    }
    host.innerHTML = intro + ws.map(function (w) {
      var d = new Date(w.monday + 'T12:00:00');
      var label = 'Week of ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      var first = w.medianFirst == null ? '<span class="none">—</span>'
        : '<span class="v' + (w.medianFirst > TARGET_FIRST_SECS ? ' miss' : '') + '">' + w.medianFirst + ' s<small>to first set</small></span>';
      var taps = w.tapsPerUnchanged == null
        ? (w.tapsPerSet == null ? '<span class="none">—</span>' : '<span class="v">' + w.tapsPerSet + '<small>' + (w.tapsPerSet === 1 ? 'tap' : 'taps') + ' per set</small></span>')
        : '<span class="v' + (w.tapsPerUnchanged > TARGET_TAPS ? ' miss' : '') + '">' + w.tapsPerUnchanged + '<small>' + (w.tapsPerUnchanged === 1 ? 'tap' : 'taps') + ' per unchanged set</small></span>';
      return '<div class="mcu-row" aria-label="' + esc(label + ': ' + (w.medianFirst == null ? 'no session started' : w.medianFirst + ' seconds to first set') +
        ', ' + (w.tapsPerUnchanged == null ? (w.tapsPerSet == null ? 'no sets' : w.tapsPerSet + ' taps per set') : w.tapsPerUnchanged + ' taps per unchanged set')) + '">' +
        '<span class="wk">' + esc(label) + '</span>' + first + taps + '</div>';
    }).join('');
  }

  window.MC_USAGE = { weeks: weeks, render: render, TARGET_FIRST_SECS: TARGET_FIRST_SECS, TARGET_TAPS: TARGET_TAPS };
})();

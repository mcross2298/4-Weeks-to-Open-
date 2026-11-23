/* ==========================================================================
   mc-block.js — the block on Home: position row, progress ring, block sheet
   --------------------------------------------------------------------------
   command-center-roadmap.md PR 1. A renderer over mc-program-progress.js's
   record; it keeps no state of its own and invents no schedule (a program
   without a `schedule` record gets no row, the F1b/F4 rule).

   window.MC_BLOCK:
     summary(rec, now) -> { week, weeks, day, total, trainDone, trainTotal, pct,
                            thisWeek, lastWeek, delta }
       thisWeek / lastWeek count completions by when they happened: Monday to
       now, against last Monday to the same moment a week ago. A block week is
       not the measure, because moving a week ahead is not a change worth
       showing (the owner's "vs last week").
     grid(rec, now) -> [{ week, deload, days:[{ day, state, logId, workoutId }] }]
       state is done | missed | rest | today | upcoming. Missed is a training
       day before the current day with no completion.
     mountRow(el, { rec, accent, title, onOpenDay })
     openSheet({ rec, accent, title, onOpenDay })
   ========================================================================== */
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.MC_BLOCK) return;

  var DAY = 86400000;
  function P() { return (typeof window !== 'undefined' && window.MC_PROGRAM_PROGRESS) || null; }

  function mondayOf(ms) {
    var d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    var back = (d.getDay() + 6) % 7;
    return d.getTime() - back * DAY;
  }

  function summary(rec, now) {
    var p = P();
    now = now || Date.now();
    var total = p.totalDays(rec);
    var day = p.currentDayFrom(rec);
    var trainTotal = 0, trainDone = 0;
    for (var d = 1; d <= total; d++) {
      if (p.isRest(rec, d)) continue;
      trainTotal++;
      if (rec.completed && rec.completed[String(d)]) trainDone++;
    }
    var mon = mondayOf(now), thisWeek = 0, lastWeek = 0;
    var c = rec.completed || {};
    for (var k in c) {
      if (!Object.prototype.hasOwnProperty.call(c, k)) continue;
      var ts = c[k] && c[k].ts;
      if (!ts) continue;
      if (ts >= mon && ts <= now) thisWeek++;
      else if (ts >= mon - 7 * DAY && ts <= now - 7 * DAY) lastWeek++;
    }
    return {
      week: p.weekOf(rec, day), weeks: rec.weeks, day: day, total: total,
      trainDone: trainDone, trainTotal: trainTotal,
      pct: trainTotal ? Math.round(trainDone / trainTotal * 100) : 0,
      thisWeek: thisWeek, lastWeek: lastWeek, delta: thisWeek - lastWeek
    };
  }

  function grid(rec, now) {
    var p = P();
    var cur = p.currentDayFrom(rec);
    var out = [];
    for (var w = 1; w <= rec.weeks; w++) {
      var days = p.weekFrom(rec, w).map(function (info) {
        var state = info.rest ? 'rest' : info.complete ? 'done' : info.day === cur ? 'today' : info.day < cur ? 'missed' : 'upcoming';
        return { day: info.day, state: state, logId: info.logId, workoutId: info.workoutId };
      });
      out.push({ week: w, deload: !!(p.isDeloadWeek && p.isDeloadWeek(rec, w)), days: days });
    }
    return out;
  }

  // ---- rendering -------------------------------------------------------------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }

  function injectCss() {
    if (document.getElementById('mcBlockCss')) return;
    var st = document.createElement('style');
    st.id = 'mcBlockCss';
    st.textContent =
      '.mcb-row{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;margin:8px 0 0;padding:8px 12px;' +
        'background:transparent;border:1px solid var(--hairline);border-radius:var(--r-md);color:var(--text);font:inherit;' +
        'text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
      '.mcb-body{flex:1;min-width:0;}' +
      '.mcb-pos{font-size:var(--fs-lg);font-weight:var(--fw-bold);}' +
      '.mcb-sub{font-size:var(--fs-sm);color:var(--muted);margin-top:2px;}' +
      '.mcb-sub .down{color:var(--danger);}' +
      '.mcb-ring{position:relative;flex:0 0 44px;width:44px;height:44px;}' +
      '.mcb-ring span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:var(--fs-2xs);font-weight:var(--fw-bold);}' +
      '.mcb-ov{position:fixed;inset:0;z-index:var(--z-modal);background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;' +
        'padding:16px;padding-top:calc(16px + env(safe-area-inset-top));padding-bottom:calc(16px + env(safe-area-inset-bottom));}' +
      '.mcb-card{width:100%;max-width:480px;max-height:100%;overflow:auto;background:var(--surface-bg);color:var(--text);' +
        'border:1px solid var(--hairline);border-radius:var(--r-lg);padding:16px;}' +
      '.mcb-head{display:flex;align-items:center;gap:12px;margin-bottom:12px;}' +
      '.mcb-head h2{flex:1;margin:0;font-size:var(--fs-2xl);font-weight:var(--fw-bold);}' +
      '.mcb-close{min-width:48px;min-height:48px;border:0;background:transparent;color:var(--text);font-size:var(--fs-3xl);cursor:pointer;}' +
      '.mcb-stat{font-size:var(--fs-md);color:var(--muted);margin:0 0 12px;}' +
      '.mcb-key{display:flex;flex-wrap:wrap;gap:8px 14px;font-size:var(--fs-sm);color:var(--muted);margin:0 0 12px;}' +
      '.mcb-key i{display:inline-block;width:10px;height:10px;border-radius:var(--r-xs);margin-right:6px;vertical-align:-1px;}' +
      '.mcb-wk{margin:0 0 10px;}' +
      '.mcb-wk-lbl{font-size:var(--fs-sm);font-weight:var(--fw-bold);color:var(--muted);margin:0 0 6px;}' +
      '.mcb-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;}' +
      '.mcb-day{min-height:48px;border-radius:var(--r-sm);border:1px solid var(--hairline);background:transparent;color:var(--text);' +
        'font:inherit;font-size:var(--fs-sm);font-weight:var(--fw-bold);display:flex;align-items:center;justify-content:center;padding:0;}' +
      '.mcb-day.done{background:var(--acc);border-color:var(--acc);color:var(--on-acc);cursor:pointer;}' +
      '.mcb-day.missed{border-color:var(--danger);border-style:dashed;}' +
      '.mcb-day.rest{color:var(--muted);border-style:dotted;}' +
      '.mcb-day.today{border-color:var(--acc);border-width:2px;}' +
      '.mcb-i-done{background:var(--acc);}.mcb-i-missed{border:1px dashed var(--danger);}' +
      '.mcb-i-rest{border:1px dotted var(--muted);}.mcb-i-today{border:2px solid var(--acc);}';
    document.head.appendChild(st);
  }

  function deltaText(s) {
    if (!s.lastWeek && !s.thisWeek) return '';
    if (s.delta === 0) return ' · same as last week';
    var word = s.delta > 0 ? '↑' + s.delta : '↓' + (-s.delta);
    return ' · <span class="' + (s.delta < 0 ? 'down' : '') + '">' + word + ' vs last week</span>';
  }

  function mountRow(el, opts) {
    if (!el || !opts || !opts.rec || !P()) return;
    injectCss();
    var s = summary(opts.rec);
    var ring = (window.MC_CHART && MC_CHART.ring) ? MC_CHART.ring(s.pct, { size: 44, stroke: 4, color: opts.accent }) : '';
    el.innerHTML =
      '<button type="button" class="mcb-row" aria-label="Week ' + s.week + ' of ' + s.weeks + ', day ' + s.day + ' of ' + s.total +
        '. ' + s.trainDone + ' of ' + s.trainTotal + ' training days done. ' + s.thisWeek + ' this week, ' + s.lastWeek +
        ' by now last week. Open the block.">' +
        '<span class="mcb-body"><span class="mcb-pos" style="display:block">Week ' + s.week + ' of ' + s.weeks + ' · Day ' + s.day + ' of ' + s.total + '</span>' +
        '<span class="mcb-sub" style="display:block">' + s.thisWeek + (s.thisWeek === 1 ? ' day' : ' days') + ' this week' + deltaText(s) + '</span></span>' +
        '<span class="mcb-ring" aria-hidden="true">' + ring + '<span>' + s.pct + '%</span></span>' +
      '</button>';
    el.firstChild.onclick = function () { openSheet(opts); };
  }

  // Ink for text on the accent: the darkest or lightest end of the ramp,
  // whichever reads better on that colour (WCAG relative luminance). The ramp
  // ends are the same in both themes, so this holds in light mode too.
  function inkOn(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return 'var(--ink-0)';
    var n = parseInt(m[1], 16), ch = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? 'var(--ink-0)' : 'var(--ink-11)';
  }

  var LABEL = { done: 'done', missed: 'missed', rest: 'rest', today: 'today', upcoming: 'upcoming' };

  function openSheet(opts) {
    if (!opts || !opts.rec || !P()) return;
    injectCss();
    var rec = opts.rec, s = summary(rec), g = grid(rec);
    var acc = opts.accent || 'var(--accent)';
    var ov = document.createElement('div');
    ov.className = 'mcb-ov';
    ov.setAttribute('data-mc-sheet', '');
    ov.setAttribute('aria-label', 'Block');
    ov.style.setProperty('--acc', acc);
    ov.style.setProperty('--on-acc', inkOn(opts.accent));
    ov.innerHTML = '<div class="mcb-card">' +
      '<div class="mcb-head"><h2>' + esc(opts.title || 'Block') + '</h2>' +
        '<button type="button" class="mcb-close" aria-label="Close">×</button></div>' +
      '<p class="mcb-stat">' + s.trainDone + ' of ' + s.trainTotal + ' training days done · week ' + s.week + ' of ' + s.weeks + '</p>' +
      '<div class="mcb-key"><span><i class="mcb-i-done"></i>Done</span><span><i class="mcb-i-today"></i>Today</span>' +
        '<span><i class="mcb-i-missed"></i>Missed</span><span><i class="mcb-i-rest"></i>Rest</span></div>' +
      g.map(function (w) {
        return '<div class="mcb-wk"><div class="mcb-wk-lbl">Week ' + w.week + (w.deload ? ' · deload' : '') + '</div><div class="mcb-days">' +
          w.days.map(function (d) {
            var lbl = 'Day ' + d.day + ', ' + LABEL[d.state] + (d.state === 'done' ? '. Open the workout.' : '');
            return d.state === 'done' && d.logId
              ? '<button type="button" class="mcb-day done" data-log="' + esc(d.logId) + '" aria-label="' + lbl + '">' + d.day + '</button>'
              : '<span class="mcb-day ' + d.state + '" role="img" aria-label="' + lbl + '">' + (d.state === 'rest' ? 'R' : d.day) + '</span>';
          }).join('') + '</div></div>';
      }).join('') + '</div>';
    function close() { ov.remove(); if (window.MC_SHEET) MC_SHEET.check(); }
    ov.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-log]') : null;
      if (b) {
        close();
        if (opts.onOpenDay) opts.onOpenDay(b.getAttribute('data-log'));
        else location.href = 'workout-detail.html?id=' + encodeURIComponent(b.getAttribute('data-log'));
        return;
      }
      if (e.target === ov || (e.target.closest && e.target.closest('.mcb-close'))) close();
    });
    document.body.appendChild(ov);
    if (window.MC_SHEET) MC_SHEET.check();
    var cur = ov.querySelector('.mcb-day.today');
    if (cur && cur.scrollIntoView) { try { cur.scrollIntoView({ block: 'center' }); } catch (e) {} }
  }

  var api = { summary: summary, grid: grid, mountRow: mountRow, openSheet: openSheet, mondayOf: mondayOf, inkOn: inkOn };
  if (typeof window !== 'undefined') window.MC_BLOCK = api;
})();

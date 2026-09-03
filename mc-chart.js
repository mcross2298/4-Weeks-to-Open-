/* ==========================================================================
   mc-chart.js — tiny hand-rolled SVG charts (Phase 3)
   --------------------------------------------------------------------------
   Offline-first and no build step rule out chart libraries; the app's needs
   are small primitives over ≤200-point datasets:

     MC_CHART.line(points, opts)     trend line with dots + min/max labels
     MC_CHART.bars(values, opts)     vertical bars (sparkline or labeled)
     MC_CHART.heatmap(days, opts)    GitHub-style consistency calendar
     MC_CHART.ring(pct, opts)        circular progress ring, 0-100
     MC_CHART.ringCircumference(opts) circumference for a ring's stroke-dasharray math
     MC_CHART.bodyMap(dataByGroup, opts)  front/back anatomical figure, one
                                           region per MC_MUSCLES group id

   All return SVG markup strings; colors default to the page accent.
   ========================================================================== */
(function () {
  if (window.MC_CHART) return;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function accent(opts) {
    return (opts && opts.color) || 'var(--accent, #d4af37)';
  }

  // points: [{x:label, y:number}] in chronological order
  function line(points, opts) {
    opts = opts || {};
    var W = opts.width || 320, H = opts.height || 120, pad = 14;
    if (!points || !points.length) return '';
    var ys = points.map(function (p) { return p.y; });
    var min = Math.min.apply(null, ys), max = Math.max.apply(null, ys);
    if (min === max) { min -= 1; max += 1; }
    var n = points.length;
    var X = function (i) { return n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - pad * 2); };
    var Y = function (v) { return H - pad - ((v - min) / (max - min)) * (H - pad * 2); };
    var col = accent(opts);

    var path = points.map(function (p, i) {
      return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1);
    }).join(' ');
    var dots = points.map(function (p, i) {
      return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="3" fill="' + col + '">' +
             '<title>' + esc(p.x) + ': ' + esc(p.y) + '</title></circle>';
    }).join('');
    var lastY = points[n - 1].y;

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;">' +
      '<path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>' +
      dots +
      '<text x="' + pad + '" y="11" font-size="10" font-weight="700" fill="#64748b">' + esc(opts.maxLabel != null ? opts.maxLabel : max) + '</text>' +
      '<text x="' + pad + '" y="' + (H - 3) + '" font-size="10" font-weight="700" fill="#475569">' + esc(opts.minLabel != null ? opts.minLabel : min) + '</text>' +
      '<text x="' + (W - pad) + '" y="11" text-anchor="end" font-size="10" font-weight="800" fill="' + col + '">' + esc(lastY) + '</text>' +
      '</svg>';
  }

  // values: [{label, value}] — bars scaled to max
  function bars(values, opts) {
    opts = opts || {};
    var W = opts.width || 320, H = opts.height || (opts.labels ? 110 : 56);
    if (!values || !values.length) return '';
    var max = Math.max.apply(null, values.map(function (v) { return v.value; })) || 1;
    var n = values.length, gap = 4;
    var bw = (W - gap * (n - 1)) / n;
    var labH = opts.labels ? 16 : 0;
    var col = accent(opts);
    var out = values.map(function (v, i) {
      var h = Math.max(2, (v.value / max) * (H - labH - 4));
      var x = i * (bw + gap);
      var y = H - labH - h;
      var hl = opts.highlight === i;
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '"' +
        ' rx="3" fill="' + col + '" opacity="' + (hl ? '1' : v.value ? '0.55' : '0.18') + '">' +
        '<title>' + esc(v.label) + ': ' + esc(v.value) + '</title></rect>' +
        (opts.labels ? '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#64748b">' + esc(v.label) + '</text>' : '');
    }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;">' + out + '</svg>';
  }

  // days: {'YYYY-MM-DD': true}; renders the trailing `weeks` (default 16)
  function heatmap(days, opts) {
    opts = opts || {};
    var weeks = opts.weeks || 16, cell = 12, gap = 3;
    var col = accent(opts);
    var W = weeks * (cell + gap), H = 7 * (cell + gap);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    // grid ends on today's column; column = week, row = weekday (Mon top)
    var end = new Date(today);
    var dow = (end.getDay() + 6) % 7;           // Mon=0
    var out = '';
    for (var w = 0; w < weeks; w++) {
      for (var d = 0; d < 7; d++) {
        var offset = (weeks - 1 - w) * 7 + (dow - d);
        if (offset < 0) continue;
        var dt = new Date(today); dt.setDate(dt.getDate() - offset);
        var key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
        var on = days && days[key];
        out += '<rect x="' + (w * (cell + gap)) + '" y="' + (d * (cell + gap)) + '" width="' + cell + '" height="' + cell + '" rx="3"' +
          ' fill="' + (on ? col : 'rgba(255,255,255,0.06)') + '"' + (on ? '' : ' stroke="rgba(255,255,255,0.05)"') + '>' +
          '<title>' + key + (on ? ' — trained' : '') + '</title></rect>';
      }
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block;">' + out + '</svg>';
  }

  function ringCircumference(opts) {
    opts = opts || {};
    var size = opts.size || 36, stroke = opts.stroke || 3.5;
    return 2 * Math.PI * ((size / 2) - stroke);
  }

  // pct: 0-100 (clamped here). opts: {size, stroke, trackStroke, color, track}
  // trackStroke defaults to stroke (all existing callers keep a uniform ring
  // width, and the radius math below is UNCHANGED from before trackStroke
  // existed) — pass a smaller trackStroke for a thinner background track
  // under a bolder progress arc (e.g. The Readout's paired Strain/Readiness
  // rings); it must stay <= stroke or the track will overflow the arc's edge.
  function ring(pct, opts) {
    opts = opts || {};
    var size = opts.size || 36, stroke = opts.stroke || 3.5;
    var trackStroke = opts.trackStroke || stroke;
    var r = (size / 2) - stroke;
    var c = 2 * Math.PI * r;
    var p = Math.max(0, Math.min(100, pct || 0));
    var dash = (p / 100) * c;
    var col = accent(opts);
    var track = opts.track || 'rgba(255,255,255,0.12)';
    var cx = size / 2, cy = size / 2;
    return '<svg class="mcchart-ring" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + track + '" stroke-width="' + trackStroke + '"/>' +
      '<circle class="mcchart-ring-arc" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + stroke +
        '" stroke-linecap="round" stroke-dasharray="' + dash.toFixed(2) + ' ' + c.toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>' +
      '</svg>';
  }

  // ── bodyMap ──────────────────────────────────────────────────────────
  // dataByGroup: {calves,shoulders,legs,triceps,back,chest,core,biceps,forearms}
  // each value 0-100 or omitted/null for "no data" (rendered as a neutral
  // silhouette region, not zero — matches mc-readiness.js's own "no history
  // = fully fresh" convention rather than reading as low/bad).
  //
  // Front and back are two independent stylized figures, not anatomically
  // literal plates: each MC_MUSCLES group renders on whichever figure best
  // shows it (shoulders/chest/core/biceps/forearms/legs/calves up front,
  // back/triceps behind), and the other figure dims that same region for
  // context rather than re-coloring it — there is one value per group, not
  // one per figure. opts.view picks 'front' | 'back' | 'both' (default);
  // 'both' returns two sibling <svg> strings for the caller's own flex
  // layout, same "no wrapping markup" convention as every other function
  // in this file.
  //
  // opts: { view, width (per-figure, default 150), lowColor, midColor,
  //         highColor, thresholds:[low,high] default [40,70], colorFor(pct) }
  var BODYMAP_LABELS = {
    calves: 'Calves', shoulders: 'Shoulders', legs: 'Legs', triceps: 'Triceps',
    back: 'Back', chest: 'Chest', core: 'Core', biceps: 'Biceps', forearms: 'Forearms'
  };
  var BODYMAP_VB_W = 150, BODYMAP_VB_H = 330;

  function bodyMapColor(pct, opts) {
    if (opts.colorFor) return opts.colorFor(pct);
    var t = opts.thresholds || [40, 70];
    if (pct < t[0]) return opts.lowColor || 'var(--danger, #f87171)';
    if (pct < t[1]) return opts.midColor || accent(opts);
    return opts.highColor || 'var(--success, #34d399)';
  }

  // shapes shared by both figures: id -> array of {tag, attrs}
  var BODYMAP_SHAPES = {
    shoulders: [
      { tag: 'ellipse', attrs: { cx: 40, cy: 72, rx: 16, ry: 13 } },
      { tag: 'ellipse', attrs: { cx: 110, cy: 72, rx: 16, ry: 13 } }
    ],
    chest: [
      { tag: 'path', attrs: { d: 'M52 64 Q75 56 98 64 L98 108 Q75 118 52 108 Z' } }
    ],
    back: [
      { tag: 'path', attrs: { d: 'M50 62 Q75 54 100 62 L98 112 Q75 122 52 112 Z' } }
    ],
    core: [
      { tag: 'rect', attrs: { x: 56, y: 112, width: 38, height: 46, rx: 12 } }
    ],
    biceps: [
      { tag: 'rect', attrs: { x: 26, y: 80, width: 17, height: 46, rx: 8.5, transform: 'rotate(-6 34 103)' } },
      { tag: 'rect', attrs: { x: 107, y: 80, width: 17, height: 46, rx: 8.5, transform: 'rotate(6 116 103)' } }
    ],
    triceps: [
      { tag: 'rect', attrs: { x: 26, y: 80, width: 17, height: 46, rx: 8.5, transform: 'rotate(-6 34 103)' } },
      { tag: 'rect', attrs: { x: 107, y: 80, width: 17, height: 46, rx: 8.5, transform: 'rotate(6 116 103)' } }
    ],
    forearms: [
      { tag: 'rect', attrs: { x: 22, y: 124, width: 15, height: 42, rx: 7.5, transform: 'rotate(-4 29 145)' } },
      { tag: 'rect', attrs: { x: 113, y: 124, width: 15, height: 42, rx: 7.5, transform: 'rotate(4 120 145)' } }
    ],
    legs: [
      { tag: 'rect', attrs: { x: 58, y: 162, width: 16, height: 82, rx: 8 } },
      { tag: 'rect', attrs: { x: 76, y: 162, width: 16, height: 82, rx: 8 } }
    ],
    calves: [
      { tag: 'rect', attrs: { x: 59, y: 248, width: 14, height: 52, rx: 7 } },
      { tag: 'rect', attrs: { x: 77, y: 248, width: 14, height: 52, rx: 7 } }
    ]
  };
  // Every shape drawn on a figure, and which of those are that figure's
  // OWN groups (data-colored) vs. carried over from the other figure for
  // anatomical context only (always dimmed/neutral, regardless of data —
  // there is one value per group, and it belongs to its primary figure).
  var BODYMAP_FRONT_ALL = ['shoulders', 'chest', 'core', 'biceps', 'forearms', 'legs', 'calves'];
  var BODYMAP_FRONT_PRIMARY = BODYMAP_FRONT_ALL; // front is every one of these groups' canonical view
  var BODYMAP_BACK_ALL = ['shoulders', 'back', 'core', 'triceps', 'forearms', 'legs', 'calves'];
  var BODYMAP_BACK_PRIMARY = ['back', 'triceps']; // the only two groups back is canonical for
  var BODYMAP_NEUTRAL_ALWAYS = [
    { tag: 'ellipse', attrs: { cx: 75, cy: 26, rx: 17, ry: 19 } },      // head
    { tag: 'rect', attrs: { x: 66, y: 42, width: 18, height: 12, rx: 4 } }, // neck
    { tag: 'ellipse', attrs: { cx: 66, cy: 308, rx: 9, ry: 6 } },       // foot
    { tag: 'ellipse', attrs: { cx: 84, cy: 308, rx: 9, ry: 6 } }        // foot
  ];

  function bodyMapShapeMarkup(tag, attrs, fill, extra) {
    var a = '';
    for (var k in attrs) { if (attrs.hasOwnProperty(k)) a += ' ' + k + '="' + attrs[k] + '"'; }
    return '<' + tag + a + ' fill="' + fill + '"' + (extra || '') + ' class="mcchart-bodymap-region"/>';
  }

  function bodyMapFigure(allIds, primaryIds, data, opts) {
    var neutralFill = 'rgba(255,255,255,0.06)', neutralStroke = ' stroke="rgba(255,255,255,0.10)" stroke-width="1"';
    var out = '';
    BODYMAP_NEUTRAL_ALWAYS.forEach(function (s) { out += bodyMapShapeMarkup(s.tag, s.attrs, neutralFill, neutralStroke); });
    var isPrimary = {}; primaryIds.forEach(function (id) { isPrimary[id] = true; });
    allIds.forEach(function (id) {
      if (!BODYMAP_SHAPES[id]) return;
      var v = isPrimary[id] ? data[id] : null; // non-primary groups always render as context, never data-colored
      var hasData = (v != null && !isNaN(v));
      var fill = hasData ? bodyMapColor(Math.max(0, Math.min(100, v)), opts) : neutralFill;
      var extra = hasData ? '' : neutralStroke;
      var title = hasData ? '<title>' + esc(BODYMAP_LABELS[id] || id) + ' · ' + Math.round(v) + '%</title>' : '';
      BODYMAP_SHAPES[id].forEach(function (s, i) {
        var markup = bodyMapShapeMarkup(s.tag, s.attrs, fill, extra);
        out += (i === 0 && title) ? markup.replace('/>', '>' + title + '</' + s.tag + '>') : markup;
      });
    });
    var w = (opts.width || BODYMAP_VB_W);
    return '<svg class="mcchart-bodymap" viewBox="0 0 ' + BODYMAP_VB_W + ' ' + BODYMAP_VB_H + '"' +
      ' width="' + w + '" style="width:' + w + 'px;height:auto;display:inline-block;">' + out + '</svg>';
  }

  function bodyMap(dataByGroup, opts) {
    opts = opts || {};
    var data = dataByGroup || {};
    var view = opts.view || 'both';
    var front = view !== 'back' ? bodyMapFigure(BODYMAP_FRONT_ALL, BODYMAP_FRONT_PRIMARY, data, opts) : '';
    var back = view !== 'front' ? bodyMapFigure(BODYMAP_BACK_ALL, BODYMAP_BACK_PRIMARY, data, opts) : '';
    return front + back;
  }

  window.MC_CHART = {
    line: line, bars: bars, heatmap: heatmap, ring: ring, ringCircumference: ringCircumference,
    bodyMap: bodyMap,
    // exposed so a caller can color a companion legend/chip with the exact
    // same low/mid/high thresholds bodyMap used — one implementation, not
    // a second copy of the bucket logic at the call site
    bodyMapColorFor: bodyMapColor
  };
})();

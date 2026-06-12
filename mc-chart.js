/* ==========================================================================
   mc-chart.js — tiny hand-rolled SVG charts (Phase 3)
   --------------------------------------------------------------------------
   Offline-first and no build step rule out chart libraries; the app's needs
   are three small primitives over ≤200-point datasets:

     MC_CHART.line(points, opts)     trend line with dots + min/max labels
     MC_CHART.bars(values, opts)     vertical bars (sparkline or labeled)
     MC_CHART.heatmap(days, opts)    GitHub-style consistency calendar

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

  window.MC_CHART = { line: line, bars: bars, heatmap: heatmap };
})();

/* PDF export — a self-contained writer, behind the Executive Summary's
   "Export PDF" button.

   No library, no build step, no bundler — the same constraint as every other
   mc-*.js module. It writes PDF 1.4 by hand using the two Core-14 fonts every
   reader already has, so nothing is embedded and nothing is fetched, and it
   works with zero signal from the service worker's cache like any other asset.

   The content is read off the LIVE DOM rather than re-described here:
   quick-tour-overview.html is hand-authored prose that changes whenever the
   app does (CLAUDE.md's Documentation currency rule), and a second copy of it
   inside a generator is exactly the drift that rule exists to prevent.
   Anything marked .no-pdf is skipped.

   Emoji and other characters outside WinAnsi are folded or dropped (see FOLD)
   — this app's copy is full of them, and a dropped glyph is preferable to a
   byte a reader rejects.

   MC_PDF.fromElement(el, opts).build(label) -> a PDF string
   MC_PDF.download(pdfString, filename)      -> saves it
   MC_PDF.save(el, opts)                     -> both, the usual call. */
(function () {
  'use strict';

  /* ---------- font metrics ----------
     Advance widths (1/1000 em) for Helvetica and Helvetica-Bold, codes 32-126.
     These are the Adobe Core-14 AFM values; they are used ONLY to decide where
     a line wraps, so a wrong entry costs a slightly ragged break, never a
     malformed file. Codes 160-255 fall through to a flat estimate for the same
     reason. */
  var W_REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,
    667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    278,278,278,469,556,333,
    556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,
    334,260,334,584];
  var W_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
    556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,
    722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,
    333,278,333,584,556,333,
    556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,
    389,280,389,584];

  /* Text reaches the file as WinAnsi bytes, so anything outside that encoding
     has to become something that is inside it before it is written — an emoji
     dropped silently is better than a byte the reader rejects. */
  var FOLD = {
    '—': '-', '–': '-', '‒': '-', '−': '-',
    '‘': "'", '’': "'", '‚': "'", '′': "'",
    '“': '"', '”': '"', '„': '"', '″': '"',
    '…': '...', '→': '->', '←': '<-', '⇒': '=>',
    '•': '·', '⁃': '·', ' ': ' ',
    '≠': '!=', '≤': '<=', '≥': '>=', '≈': '~',
    '×': 'x', '⁄': '/', ' ': ' ', ' ': ' ',
    '✓': '', '✔': '', '✗': '', '★': '', '☆': ''
  };

  function fold(s) {
    var out = '', i, ch, code;
    s = String(s == null ? '' : s);
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i);
      if (Object.prototype.hasOwnProperty.call(FOLD, ch)) { out += FOLD[ch]; continue; }
      code = s.charCodeAt(i);
      if (code >= 32 && code <= 126) { out += ch; continue; }
      if (code >= 160 && code <= 255) { out += ch; continue; }
      if (code === 9 || code === 10) { out += ' '; continue; }
      /* Surrogate pairs (emoji) are two units — skip the low half too. */
      if (code >= 0xD800 && code <= 0xDBFF) { i++; }
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  function widthOf(text, size, bold) {
    var table = bold ? W_BOLD : W_REG, total = 0, i, c;
    for (i = 0; i < text.length; i++) {
      c = text.charCodeAt(i);
      total += (c >= 32 && c <= 126) ? table[c - 32] : 556;
    }
    return total * size / 1000;
  }

  function wrap(text, size, bold, maxWidth) {
    var words = text.split(' '), lines = [], line = '', i, w, probe;
    for (i = 0; i < words.length; i++) {
      w = words[i];
      if (!w) continue;
      probe = line ? line + ' ' + w : w;
      if (widthOf(probe, size, bold) <= maxWidth || !line) {
        /* A single word wider than the column still has to go somewhere; break
           it by character rather than let it run off the page. */
        if (!line && widthOf(w, size, bold) > maxWidth) {
          var part = '';
          for (var j = 0; j < w.length; j++) {
            if (widthOf(part + w.charAt(j), size, bold) > maxWidth && part) { lines.push(part); part = ''; }
            part += w.charAt(j);
          }
          line = part;
          continue;
        }
        line = probe;
      } else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function esc(s) { return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }

  /* ---------- document ---------- */
  var PAGE_W = 612, PAGE_H = 792, MARGIN = 54, FOOT = 40;

  function create(opts) {
    opts = opts || {};
    var pages = [], cur = null, y = 0;
    var col = MARGIN, colW = PAGE_W - MARGIN * 2;

    function newPage() {
      cur = [];
      pages.push(cur);
      y = PAGE_H - MARGIN;
    }
    function room(h) { if (!cur || y - h < MARGIN + FOOT) { newPage(); return true; } return false; }
    function op(s) { cur.push(s); }

    function text(str, x, baseline, size, bold, gray) {
      op('BT ' + (gray == null ? 0.13 : gray) + ' g /' + (bold ? 'F2' : 'F1') + ' ' + size +
         ' Tf 1 0 0 1 ' + x.toFixed(2) + ' ' + baseline.toFixed(2) + ' Tm (' + esc(str) + ') Tj ET');
    }

    /* Every block funnels through here so page breaks, wrapping and the
       cursor exist in exactly one place. */
    function block(raw, cfg) {
      var s = fold(raw);
      if (!s) return api;
      var size = cfg.size, bold = !!cfg.bold, lead = cfg.lead || size * 1.35;
      var indent = cfg.indent || 0;
      var width = colW - indent - (cfg.marker ? 12 : 0);
      var lines = wrap(s, size, bold, width);
      y -= (cfg.before || 0);
      var i;
      for (i = 0; i < lines.length; i++) {
        if (room(lead)) { /* a fresh page resets y; nothing else to do */ }
        y -= lead;
        if (i === 0 && cfg.marker) text(cfg.marker, col + indent, y, size, false, 0.45);
        text(lines[i], col + indent + (cfg.marker ? 12 : 0), y, size, bold, cfg.gray);
      }
      y -= (cfg.after || 0);
      if (cfg.rule) {
        y -= 4;
        room(2);
        op('0.80 G 0.6 w ' + col + ' ' + y.toFixed(2) + ' m ' + (col + colW) + ' ' + y.toFixed(2) + ' l S');
        y -= 4;
      }
      return api;
    }

    var api = {
      h1: function (t) { return block(t, { size: 17, bold: true, lead: 21, before: 12, after: 4 }); },
      h2: function (t) { return block(t, { size: 12.5, bold: true, lead: 16, before: 16, after: 2, rule: true }); },
      h3: function (t) { return block(t, { size: 10.5, bold: true, lead: 14, before: 9, after: 2 }); },
      eyebrow: function (t) { return block(String(t).toUpperCase(), { size: 7.5, bold: true, lead: 10, before: 8, after: 1, gray: 0.45 }); },
      p: function (t) { return block(t, { size: 9.5, lead: 13, after: 5, gray: 0.2 }); },
      note: function (t) { return block(t, { size: 8.5, lead: 11.5, after: 4, gray: 0.45 }); },
      bullet: function (t) { return block(t, { size: 9.5, lead: 13, after: 3, indent: 6, marker: '·', gray: 0.2 }); },
      /* Label left, figure right, on one baseline. The label wraps into
         whatever the figure leaves it rather than running underneath it, which
         is the failure the first version had on a long category name. */
      kv: function (label, value) {
        var s = fold(label), v = fold(value);
        if (!s && !v) return api;
        var size = 9.5, lead = 13, i;
        var vw = v ? widthOf(v, size, false) : 0;
        if (vw > colW * 0.55) { v = v.slice(0, 60); vw = widthOf(v, size, false); }
        var labelW = Math.max(colW * 0.3, colW - vw - 14);
        var lines = wrap(s, size, true, labelW);
        for (i = 0; i < lines.length; i++) {
          room(lead);
          y -= lead;
          text(lines[i], col, y, size, true, 0.2);
          if (i === 0 && v) text(v, col + colW - vw, y, size, false, 0.2);
        }
        y -= 3;
        return api;
      },
      spacer: function (h) { y -= (h || 8); return api; },
      pageBreak: function () { newPage(); return api; },

      /* The header is drawn after the body so the cover block can sit on a page
         that already exists; callers just call it first and it opens page 1. */
      cover: function (title, subtitle, meta) {
        if (!cur) newPage();
        block(title, { size: 21, bold: true, lead: 25, after: 2 });
        if (subtitle) block(subtitle, { size: 10.5, lead: 14, after: 2, gray: 0.35 });
        if (meta) block(meta, { size: 8.5, lead: 11, after: 6, gray: 0.5 });
        y -= 2;
        room(2);
        op('0.55 G 1 w ' + col + ' ' + y.toFixed(2) + ' m ' + (col + colW) + ' ' + y.toFixed(2) + ' l S');
        y -= 6;
        return api;
      },

      build: function (footerLabel) {
        if (!cur) newPage();
        var n = pages.length, i, streams = [];
        for (i = 0; i < n; i++) {
          var f = fold((footerLabel || '') + (footerLabel ? '  ·  ' : '') + 'Page ' + (i + 1) + ' of ' + n);
          var fw = widthOf(f, 8, false);
          streams.push(pages[i].join('\n') + '\nBT 0.5 g /F1 8 Tf 1 0 0 1 ' +
            (PAGE_W - MARGIN - fw).toFixed(2) + ' ' + (MARGIN - 12) + ' Tm (' + esc(f) + ') Tj ET');
        }
        return serialize(streams);
      }
    };
    return api;
  }

  function serialize(streams) {
    var n = streams.length, objs = [], i;
    var firstPage = 5;                       /* 1 catalog, 2 pages, 3-4 fonts */
    var kids = [], pageIds = [];
    for (i = 0; i < n; i++) { pageIds.push(firstPage + i * 2); kids.push((firstPage + i * 2) + ' 0 R'); }

    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    for (i = 0; i < n; i++) {
      var pid = pageIds[i], cid = pid + 1;
      objs[pid] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGE_W + ' ' + PAGE_H + ']' +
        ' /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + cid + ' 0 R >>';
      objs[cid] = '<< /Length ' + streams[i].length + ' >>\nstream\n' + streams[i] + '\nendstream';
    }

    var out = '%PDF-1.4\n', offsets = [], max = 4 + n * 2;
    for (i = 1; i <= max; i++) {
      offsets[i] = out.length;
      out += i + ' 0 obj\n' + objs[i] + '\nendobj\n';
    }
    var xref = out.length;
    out += 'xref\n0 ' + (max + 1) + '\n0000000000 65535 f \n';
    for (i = 1; i <= max; i++) out += pad(offsets[i]) + ' 00000 n \n';
    out += 'trailer\n<< /Size ' + (max + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    return out;
  }

  function pad(n) { var s = String(n); while (s.length < 10) s = '0' + s; return s; }

  /* latin1 out, byte for byte — every character is <= 255 after fold(), so the
     string's length is also its byte length, which is what the xref offsets
     above were counted in. A UTF-8 Blob would silently invalidate all of them. */
  function toBlob(str) {
    var buf = new Uint8Array(str.length), i;
    for (i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i) & 0xFF;
    return new Blob([buf], { type: 'application/pdf' });
  }

  function download(pdfString, filename) {
    var url = URL.createObjectURL(toBlob(pdfString));
    var a = document.createElement('a');
    a.href = url;
    a.download = String(filename || 'document').replace(/[^\w.\- ]+/g, '') || 'document';
    if (!/\.pdf$/i.test(a.download)) a.download += '.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  /* ---------- DOM capture ----------
     The summary is rendered from live data, so the only copy of it that cannot
     drift is the one already on screen. This reads that, rather than a second
     hand-maintained description of the same page. */
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, BUTTON: 1, SVG: 1, CANVAS: 1, NOSCRIPT: 1,
                    INPUT: 1, SELECT: 1, TEXTAREA: 1, IFRAME: 1, VIDEO: 1, AUDIO: 1, TEMPLATE: 1 };
  var SKIP_CLASS = /(^|\s)(no-print|no-pdf|pdf-skip|topbar|jump-row|qt-top|tour-dots|hero-glow|meter|sparkline)(\s|$)/;
  var BLOCK_TAGS = { DIV: 1, SECTION: 1, ARTICLE: 1, P: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
                     UL: 1, OL: 1, LI: 1, TABLE: 1, THEAD: 1, TBODY: 1, TR: 1, TD: 1, TH: 1,
                     HEADER: 1, FOOTER: 1, MAIN: 1, ASIDE: 1, NAV: 1, FIGURE: 1, BLOCKQUOTE: 1,
                     DL: 1, DT: 1, DD: 1, FORM: 1, FIELDSET: 1, HR: 1 };

  function skipped(el, extra) {
    if (SKIP_TAGS[el.tagName]) return true;
    var cls = el.getAttribute('class') || '';
    if (SKIP_CLASS.test(cls)) return true;
    if (extra && extra.test(cls)) return true;
    if (el.hasAttribute('hidden')) return true;
    try { if (getComputedStyle(el).display === 'none') return true; } catch (e) { /* detached */ }
    return false;
  }

  function txt(el) { return fold(el.textContent || ''); }

  /* An <a> is inline in a sentence and a container when it wraps a card — this
     app builds half its tiles as link-wrapped divs. Reading it as inline in both
     cases is what made a grid of KPI tiles come out as one run-on paragraph;
     reading it as a block in both cases pulls an in-sentence link out of the
     sentence it belongs to. So the tag doesn't decide it, its contents do. */
  function isBlockish(el) {
    if (BLOCK_TAGS[el.tagName]) return true;
    return el.tagName === 'A' && hasBlockChild(el);
  }

  function hasBlockChild(el) {
    var kids = el.children, i;
    for (i = 0; i < kids.length; i++) if (isBlockish(kids[i])) return true;
    return false;
  }

  function classStyle(el, map) {
    var cls = (el.getAttribute('class') || '').split(/\s+/), i;
    for (i = 0; i < cls.length; i++) if (cls[i] && map[cls[i]]) return map[cls[i]];
    return null;
  }

  function emitTable(el, doc) {
    var rows = el.querySelectorAll('tr'), i;
    for (i = 0; i < rows.length; i++) {
      var cells = rows[i].children;
      if (!cells.length) continue;
      if (cells.length === 1) { doc.p(txt(cells[0])); continue; }
      var label = txt(cells[0]);
      var rest = [], j;
      for (j = 1; j < cells.length; j++) { var t = txt(cells[j]); if (t) rest.push(t); }
      doc.kv(label, rest.join('  ·  '));
    }
    doc.spacer(4);
  }

  /* `pair` classes are elements whose children are a label/value/sub trio —
     rendering them as three stacked paragraphs reads as noise, so they collapse
     into one line. */
  function emitPair(el, doc, pairSel) {
    var label = el.querySelector(pairSel.label), value = el.querySelector(pairSel.value);
    var sub = pairSel.sub ? el.querySelector(pairSel.sub) : null;
    var l = label ? txt(label) : '', v = value ? txt(value) : '', s = sub ? txt(sub) : '';
    if (!l && !v) { doc.p(txt(el)); return; }
    doc.kv(l, v + (s ? '   (' + s + ')' : ''));
  }

  function walk(el, doc, opts) {
    var kids = el.children, i;
    for (i = 0; i < kids.length; i++) {
      var node = kids[i];
      if (skipped(node, opts.skip)) continue;

      if (node.tagName === 'TABLE') { emitTable(node, doc); continue; }
      if (node.tagName === 'HR') { doc.spacer(6); continue; }

      var pairSel = opts.pairs && classStyle(node, opts.pairs);
      if (pairSel) { emitPair(node, doc, pairSel); continue; }

      if (node.tagName === 'UL' || node.tagName === 'OL') {
        var items = node.children, j;
        for (j = 0; j < items.length; j++) {
          if (items[j].tagName !== 'LI' || skipped(items[j], opts.skip)) continue;
          doc.bullet(txt(items[j]));
        }
        doc.spacer(3);
        continue;
      }

      var style = classStyle(node, opts.styles || {}) ||
                  ({ H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3' })[node.tagName] || null;

      if (style && !hasBlockChild(node)) { doc[style](txt(node)); continue; }
      if (hasBlockChild(node)) {
        if (style) doc[style](fold(ownText(node)));
        walk(node, doc, opts);
        continue;
      }
      var t = txt(node);
      if (t) doc[style || (node.tagName === 'LI' ? 'bullet' : 'p')](t);
    }
  }

  /* Text belonging to this element rather than to a block child — a heading
     that also wraps a nested card would otherwise print its whole subtree
     twice, once as the heading and once as the card. */
  function ownText(el) {
    var out = '', n;
    for (n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeType === 1 && !isBlockish(n) && !SKIP_TAGS[n.tagName]) out += n.textContent;
    }
    return out;
  }

  function fromElement(root, opts) {
    opts = opts || {};
    var doc = create();
    doc.cover(opts.title || document.title, opts.subtitle || '', opts.meta || '');
    walk(root, doc, opts);
    return doc;
  }

  function save(root, opts) {
    opts = opts || {};
    var doc = fromElement(root, opts);
    download(doc.build(opts.footer || opts.title || ''), opts.filename || 'export');
  }

  window.MC_PDF = { create: create, fromElement: fromElement, download: download, save: save, fold: fold };
})();

/* ==========================================================================
   mc-program-status.js — Program landing status strip
   --------------------------------------------------------------------------
   Replaces mc-program-hero.js on the (non-SPA) category landing pages.
   Renders one slim action: "Resume <split> — d/total" if the user has an
   in-progress workout that belongs to THIS program, else "Start <first
   split>". No workout page needs to declare its programId — ownership is
   worked out by checking whether mc_activity.last.pageId equals (or starts
   with) one of this program's own split hrefs.

   Usage: MCProgramStatus.mount(el, cfg)
   cfg = {
     name, accent,
     splits: [{ title, href, hrefPrefix? }],   // hrefPrefix for multi-page splits
     startHref                                  // optional, defaults to splits[0].href
   }
   Source of truth: localStorage['mc_activity'].last, written by
   mc-live-tracker.js on workout pages. Read directly (mc-live-tracker.js is
   not loaded on category pages), same contract as mc-resume.js.
   ========================================================================== */
(function () {
  var ACT_KEY = 'mc_activity';
  var EXPIRE_MS = 36 * 3600 * 1000; // keep identical to mc-resume.js / mc-live-tracker.js

  function readAct() {
    try { return JSON.parse(localStorage.getItem(ACT_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeAct(a) { try { localStorage.setItem(ACT_KEY, JSON.stringify(a)); } catch (e) {} }

  function isResumable(L) {
    return !!(L && L.done > 0 && L.done < L.total && !L.dismissed &&
              (Date.now() - L.ts) <= EXPIRE_MS);
  }

  function ownsPage(pageId, splits) {
    for (var i = 0; i < splits.length; i++) {
      var s = splits[i];
      if (s.href === pageId) return s;
      if (s.hrefPrefix && pageId.indexOf(s.hrefPrefix) === 0) return s;
    }
    return null;
  }

  function ago(ts) {
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + 'm ago';
    var h = Math.round(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.round(h / 24) + 'd ago';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function hexToRgb(hex) {
    var h = String(hex || '#d4af37').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return r + ',' + g + ',' + b;
  }

  function render(cfg) {
    var a = readAct(), L = a.last;
    var owner = L ? ownsPage(L.pageId, cfg.splits || []) : null;
    var resuming = isResumable(L) && !!owner;
    var accent = cfg.accent || '#d4af37';

    var html = '<div class="mps-strip" style="--mps-accent:' + escapeHtml(accent) + ';--mps-accent-rgb:' + hexToRgb(accent) + ';">';

    if (resuming) {
      html += '<a class="mps-main mps-resume" href="' + escapeHtml(L.pageId) + '">' +
        '<span class="mps-ico">↩️</span>' +
        '<span class="mps-body">' +
        '<span class="mps-lbl">Resume &middot; ' + escapeHtml(owner.title) + '</span>' +
        '<span class="mps-sub">' + escapeHtml(ago(L.ts)) + '</span>' +
        '</span>' +
        '<span class="mps-prog">' + L.done + '/' + L.total + '</span>' +
        '<span class="mps-arrow">→</span>' +
        '</a>' +
        '<button type="button" class="mps-dismiss" aria-label="Dismiss">✕</button>';
    } else {
      var first = (cfg.splits || [])[0] || {};
      var href = cfg.startHref || first.href || '#';
      html += '<a class="mps-main mps-start" href="' + escapeHtml(href) + '">' +
        '<span class="mps-ico">▶️</span>' +
        '<span class="mps-body">' +
        '<span class="mps-lbl">Start &middot; ' + escapeHtml(first.title || cfg.name || 'Program') + '</span>' +
        '<span class="mps-sub">Begin this program</span>' +
        '</span>' +
        '<span class="mps-arrow">→</span>' +
        '</a>';
    }

    html += '</div>';
    return html;
  }

  function mount(el, cfg) {
    if (!el) return null;
    el.innerHTML = render(cfg);
    var dismiss = el.querySelector('.mps-dismiss');
    if (dismiss) {
      dismiss.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var a = readAct();
        if (a.last) { a.last.dismissed = true; writeAct(a); }
        mount(el, cfg);
      });
    }
    return el;
  }

  window.MCProgramStatus = { mount: mount };
})();

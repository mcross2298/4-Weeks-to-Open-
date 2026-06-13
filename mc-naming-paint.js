/* ==========================================================================
   mc-naming-paint.js  —  Phase 2 paint surfaces for v2 naming overrides
   --------------------------------------------------------------------------
   Loaded dynamically by program-overrides.js after mc-naming.js is ready.
   Paints the following surfaces whenever mc:names-changed fires:

     • Badge chips  — any element with a lb-* or tb-* CSS class
     • Badge key legend rows — .badge-row .badge-demo elements (cat pages)
     • Split hub headers — .hero .title (split name) on pmc-split*.html /
       mc-split*.html (page must also load mc-supabase.js + program-overrides.js)
     • Dashboard hero + program select — wraps allProgs() so program names,
       descriptions, and split chips resolve through MC_NAMES before render;
       re-calls renderHero() on mc:names-changed

   All paints are idempotent: text is only written when it differs from the
   current content, and data-mc-orig-* attributes capture originals so resets
   revert live without a reload.
   ========================================================================== */
(function () {
  if (window.__mcNamingPaint) return;
  window.__mcNamingPaint = true;

  // ---- helpers -------------------------------------------------------------
  function setText(el, txt) { if (el && el.textContent !== txt) el.textContent = txt; }

  function badgeIdOf(el) {
    var cls = el.className || '';
    if (typeof cls !== 'string') cls = cls.baseVal || '';
    var m = cls.match(/\b((?:lb|tb)-[a-z0-9]+)\b/);
    return m ? m[1] : null;
  }

  function getProgId() {
    if (!window.MC_NAMES || !window.MC_PO) return null;
    return MC_NAMES.progOf(MC_PO.pageId);
  }

  // ---- BADGE CHIPS ---------------------------------------------------------
  // Repaints label + color for any lb-* / tb-* element.
  // Reverts to captured original when override is removed.
  function paintBadges() {
    if (!window.MC_NAMES) return;
    var progId = getProgId();
    var els = document.querySelectorAll('[class*="lb-"],[class*="tb-"]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var badgeId = badgeIdOf(el);
      if (!badgeId) continue;

      // capture original on first pass
      var origText = el.getAttribute('data-mc-orig-badge');
      if (!origText) {
        origText = el.textContent;
        el.setAttribute('data-mc-orig-badge', origText);
      }

      var resolved = MC_NAMES.badge(progId, badgeId);
      var wasPainted = el.hasAttribute('data-mc-badge-painted');

      if (!resolved) {
        if (wasPainted) {
          setText(el, origText);
          el.style.removeProperty('color');
          el.style.removeProperty('background');
          el.style.removeProperty('border-color');
          el.removeAttribute('data-mc-badge-painted');
        }
        continue;
      }

      if (resolved.reset) {
        setText(el, origText);
        el.style.removeProperty('color');
        el.style.removeProperty('background');
        el.style.removeProperty('border-color');
        el.removeAttribute('data-mc-badge-painted');
      } else {
        if (resolved.label) setText(el, resolved.label);
        if (resolved.color) {
          el.style.color = resolved.color;
          el.style.background = resolved.color + '22';
          el.style.borderColor = resolved.color + '66';
        }
        el.setAttribute('data-mc-badge-painted', '1');
      }
    }
  }

  // ---- SPLIT HUB HEADER ---------------------------------------------------
  // Paints the .hero .title (= split name) on pmc-split*.html / mc-split*.html.
  // Uses MC_NAMES.splitOf(pageId) to get the canonical PROGS key, then
  // MC_NAMES.split(progId, origSplit) to resolve the display name.
  function paintSplitHubHeader() {
    if (!window.MC_NAMES || !window.MC_PO) return;
    var pageId = MC_PO.pageId;
    var progId = MC_NAMES.progOf(pageId);
    var canonSplit = MC_NAMES.splitOf(pageId);
    if (!progId || !canonSplit) return;

    var titleEl = document.querySelector('.hero .title, .hero h1.title, .hero-inner .title, .hero-inner h1.title');
    if (!titleEl) return;

    var origTitle = titleEl.getAttribute('data-mc-orig-split');
    if (!origTitle) {
      origTitle = titleEl.textContent.trim();
      titleEl.setAttribute('data-mc-orig-split', origTitle);
    }

    var resolved = MC_NAMES.split(progId, canonSplit);
    setText(titleEl, resolved || origTitle);
  }

  // ---- DASHBOARD ALL-PROGS HOOK -------------------------------------------
  // Wraps the page-global allProgs() function to resolve program names,
  // descriptions, and split names through MC_NAMES before render.
  // Only runs once per page load; subsequent mc:names-changed calls
  // trigger repaintDashboard() which re-renders through the wrapped function.
  var _origAllProgs = null;

  function hookDashboard() {
    if (!window.allProgs || _origAllProgs) return;
    _origAllProgs = window.allProgs;
    window.allProgs = function () {
      var progs = _origAllProgs();
      if (!window.MC_NAMES) return progs;
      return progs.map(function (p) {
        var out = {}, key;
        for (key in p) out[key] = p[key];
        var progName = MC_NAMES.program(p.id);
        if (progName) out.name = progName;
        if (p.splits && p.id) {
          out.splits = p.splits.map(function (s) {
            return MC_NAMES.split(p.id, s) || s;
          });
        }
        return out;
      });
    };
  }

  function repaintDashboard() {
    if (!window.renderHero && !window.buildProgCards) return;
    // re-resolve activeProg through the wrapped allProgs so hero uses new names
    try {
      if (window.activeProg && window.allProgs) {
        var fresh = allProgs().find(function (p) { return p.id === activeProg.id; });
        if (fresh) window.activeProg = fresh;
      }
    } catch (e) {}
    try { if (window.renderHero) renderHero(); } catch (e) {}
    // only rebuild prog cards if the select sheet is visible
    try {
      if (window.buildProgCards && document.querySelector('.ps-overlay.open')) {
        buildProgCards();
      }
    } catch (e) {}
  }

  // ---- MAIN PAINT TICK -----------------------------------------------------
  var scanTimer = null;

  function paint() {
    paintBadges();
    paintSplitHubHeader();
    hookDashboard();
    repaintDashboard();
  }

  function schedule() { clearTimeout(scanTimer); scanTimer = setTimeout(paint, 80); }

  document.addEventListener('mc:names-changed', schedule);

  // Initial paint — hook dashboard first, then paint after page JS has settled
  function initPaint() {
    hookDashboard();
    setTimeout(paint, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPaint);
  } else {
    initPaint();
  }
})();

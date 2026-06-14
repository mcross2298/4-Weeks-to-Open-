/* ==========================================================================
   mc-layout.js — structural layout resolver + painters (PM Phase 2)
   --------------------------------------------------------------------------
   Each "view" (program cards, landing, split, workout) has a default
   structural style plus override-selectable alternatives. A style is just a
   CSS class on the view's root — no DOM is destroyed, only re-flowed, so a
   swap is fully reversible (invariant G1 of pm-rename-design.md).

   Resolution mirrors MC_NAMES: styleFor(view, id) returns the override
   (MC_PO.layoutFor(scope)) if present, else the authored default. Defaults
   reflect the app AS IT SHIPS today, so nothing changes for users until an
   override is published ("Style B is additive, behind the toggle").

     window.MC_LAYOUT
       .styleFor(view, id)        → resolved style id
       .scopeOf(view, id)         → override scope key
       .OPTIONS                   → { view: [styleIds...] } for the editor
       .paintProgramCards(el?)    → apply the program-cards layout class
       .repaint()                 → re-run all painters on this page
   ========================================================================== */
(function () {
  if (window.MC_LAYOUT) return;

  // Authored defaults = current shipped appearance. Per the spec, the
  // accordion split layout is the default for Strength & Supersets (ss) ONLY;
  // every other program defaults to tabbed.
  var DEFAULT_LAYOUT = {
    'program-cards': 'stack',     // current dashboard = vertical stack
    landing: 'hero',
    split: 'tabbed',
    splitSS: 'accordion',         // ss only
    workout: 'list'
  };

  // Selectable styles per view (base A/B + the Phase-2 Module-8 additions).
  var OPTIONS = {
    'program-cards': ['stack', 'grid', 'featured', 'carousel'],
    landing:  ['hero', 'split', 'timeline'],
    split:    ['accordion', 'tabbed', 'week-calendar'],
    workout:  ['list', 'swipe', 'superset-grouped']
  };

  function scopeOf(view, id) {
    if (view === 'program-cards') return 'program-cards';
    return view + ':' + (id || '');
  }

  function defaultFor(view, id) {
    if (view === 'split' && id === 'ss') return DEFAULT_LAYOUT.splitSS;
    return DEFAULT_LAYOUT[view] || '';
  }

  function styleFor(view, id) {
    var override = (window.MC_PO && MC_PO.layoutFor) ? MC_PO.layoutFor(scopeOf(view, id)) : null;
    var style = override || defaultFor(view, id);
    if (OPTIONS[view] && OPTIONS[view].indexOf(style) === -1) style = defaultFor(view, id);
    return style;
  }

  // ---- painters ------------------------------------------------------------
  // Program cards: applies `lay-<style>` to the flagship grid container.
  function paintProgramCards(el) {
    el = el || document.getElementById('flagGrid');
    if (!el) return;
    var style = styleFor('program-cards');
    el.className = ('prog-cards lay-' + style);
  }

  function repaint() {
    try { paintProgramCards(); } catch (e) {}
  }

  window.MC_LAYOUT = {
    DEFAULT_LAYOUT: DEFAULT_LAYOUT,
    OPTIONS: OPTIONS,
    scopeOf: scopeOf,
    styleFor: styleFor,
    paintProgramCards: paintProgramCards,
    repaint: repaint
  };

  // repaint when the override layer changes (owner editing) or finishes loading
  document.addEventListener('mc:layout-changed', repaint);
  document.addEventListener('mc:names-changed', repaint);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', repaint);
  else repaint();
})();

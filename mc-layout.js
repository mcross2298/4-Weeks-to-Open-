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
    workout: 'list',
    conditioning: 'cards'         // Conditioning Corner = current card stack
  };

  // Selectable styles per view (base A/B + the Phase-2 Module-8 additions).
  var OPTIONS = {
    'program-cards': ['stack', 'grid', 'featured', 'carousel'],
    landing:  ['hero', 'split', 'timeline'],
    split:    ['accordion', 'tabbed', 'week-calendar'],
    workout:  ['list', 'swipe', 'superset-grouped'],
    conditioning: ['cards', 'compact', 'grid']
  };

  function scopeOf(view, id) {
    if (view === 'program-cards') return 'program-cards';
    if (view === 'conditioning') return 'conditioning';
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

  var PAGE_ID = (location.pathname.split('/').pop() || 'index.html').split('?')[0];

  // ---- painters ------------------------------------------------------------
  // Program cards: applies `lay-<style>` to the flagship grid container.
  function paintProgramCards(el) {
    el = el || document.getElementById('flagGrid');
    if (!el) return;
    var style = styleFor('program-cards');
    el.className = ('prog-cards lay-' + style);
  }

  // Workout cards: re-flows the existing card markup (.ex-card/.ss-card/.a-card)
  // shared by every workout page. Sets body[data-workout-layout] (CSS in
  // base.css) and tags the detected cards container for the swipe layout. No
  // per-page rewrite — only a class swap on shared structure (G1). No-op on
  // pages without workout cards.
  function paintWorkout() {
    var cards = document.querySelectorAll('.ex-card, .ss-card, .a-card');
    if (!cards.length) return;
    var style = styleFor('workout', PAGE_ID);
    var body = document.body;
    if (style && style !== 'list') body.setAttribute('data-workout-layout', style);
    else body.removeAttribute('data-workout-layout');
    // tag the container holding the cards (their common parent) for swipe
    var container = cards[0].parentElement;
    if (container) {
      var prev = document.querySelector('[data-mc-cards]');
      if (prev && prev !== container) prev.removeAttribute('data-mc-cards');
      container.setAttribute('data-mc-cards', '');
    }
  }

  // Conditioning Corner: re-flows the dashboard Conditioning tab cards by
  // tagging #condBody with the resolved style. CSS in dashboard.html keys off
  // [data-cond-layout]; the default 'cards' clears the attribute so nothing
  // changes for users until an override is published. Attribute-only + reversible.
  function paintConditioning(el) {
    el = el || document.getElementById('condBody');
    if (!el) return;
    var style = styleFor('conditioning');
    if (style && style !== 'cards') el.setAttribute('data-cond-layout', style);
    else el.removeAttribute('data-cond-layout');
  }

  function repaint() {
    try { paintProgramCards(); } catch (e) {}
    try { paintWorkout(); } catch (e) {}
    try { paintConditioning(); } catch (e) {}
  }

  window.MC_LAYOUT = {
    DEFAULT_LAYOUT: DEFAULT_LAYOUT,
    OPTIONS: OPTIONS,
    scopeOf: scopeOf,
    styleFor: styleFor,
    paintProgramCards: paintProgramCards,
    paintWorkout: paintWorkout,
    paintConditioning: paintConditioning,
    repaint: repaint
  };

  // repaint when the override layer changes (owner editing) or finishes loading
  document.addEventListener('mc:layout-changed', repaint);
  document.addEventListener('mc:names-changed', repaint);
  // workout cards render after load — repaint when the DOM settles. MC_SCAN
  // observes childList/subtree only and our writes are attribute-only +
  // idempotent, so this cannot loop.
  if (window.MC_SCAN && MC_SCAN.subscribe) MC_SCAN.subscribe(repaint);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', repaint);
  else repaint();
})();
